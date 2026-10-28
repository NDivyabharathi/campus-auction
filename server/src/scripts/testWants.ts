import http from 'http';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { connectDB } from '../config/db.js';
import { ENV } from '../config/env.js';
import { User } from '../models/User.js';
import { Auction } from '../models/Auction.js';
import { Want } from '../models/Want.js';
import { WantMatch } from '../models/WantMatch.js';
import { Notification } from '../models/Notification.js';
import { doesListingMatchWant, checkExistingListingsForWant, checkNewListingMatches } from '../services/wantService.js';
import { sendGroupedMatchEmail } from '../services/emailService.js';

async function runWantsTestSuite() {
  console.log('--- STARTING SAVED WANTS & SMART ALERTS TEST SUITE ---');
  await connectDB();
  const app = createApp();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  let failed = 0;

  function assert(desc: string, condition: boolean, details?: any) {
    if (condition) {
      console.log(`✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${desc}`);
      if (details) console.error('   Details:', details);
      failed++;
    }
  }

  try {
    // 1. Setup test students
    const divya = await User.findOne({ email: 'divya.cse@kongu.edu' }); // Seller
    const rahul = await User.findOne({ email: 'rahul.it@kongu.edu' });   // Buyer 1
    const priya = await User.findOne({ email: 'priya.ece@kongu.edu' });   // Buyer 2

    if (!divya || !rahul || !priya) {
      console.error('Seed students not found!');
      process.exit(1);
    }

    const tokenDivya = jwt.sign({ id: divya._id.toString() }, ENV.JWT_SECRET, { expiresIn: '1d' });
    const tokenRahul = jwt.sign({ id: rahul._id.toString() }, ENV.JWT_SECRET, { expiresIn: '1d' });
    const tokenPriya = jwt.sign({ id: priya._id.toString() }, ENV.JWT_SECRET, { expiresIn: '1d' });

    const headersRahul = { 'Content-Type': 'application/json', Cookie: `token=${tokenRahul}` };
    const headersDivya = { 'Content-Type': 'application/json', Cookie: `token=${tokenDivya}` };
    const headersPriya = { 'Content-Type': 'application/json', Cookie: `token=${tokenPriya}` };

    // Clean prior wants and matches for test isolation
    await Want.deleteMany({ student: { $in: [rahul._id, priya._id] } });
    await WantMatch.deleteMany({ student: { $in: [rahul._id, priya._id] } });

    // Test 1: Unauthenticated request rejected
    const unauthRes = await fetch(`${baseUrl}/api/wants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: 'scientific calculator' }),
    });
    assert('Test 1: Unauthenticated create want rejected with 401', unauthRes.status === 401);

    // Test 2: Invalid input (empty keywords) rejected
    const emptyRes = await fetch(`${baseUrl}/api/wants`, {
      method: 'POST',
      headers: headersRahul,
      body: JSON.stringify({ keywords: '  ' }),
    });
    assert('Test 2: Empty keywords rejected with 400', emptyRes.status === 400);

    // Test 3: Authenticated student creates a valid want
    const createRes = await fetch(`${baseUrl}/api/wants`, {
      method: 'POST',
      headers: headersRahul,
      body: JSON.stringify({
        keywords: 'scientific calculator',
        category: 'Electronics',
        maxPrice: 400,
        condition: 'Good',
      }),
    });
    const createBody: any = await createRes.json();
    assert(
      'Test 3: Rahul successfully creates a saved want',
      createRes.status === 201 && createBody.success === true && createBody.want.keywords === 'scientific calculator',
      createBody
    );
    const want1Id = createBody.want._id;

    // Test 4: Immediate scan finds existing matching active listings
    // Divya has active Casio ClassWiz calculator in seed data (starting price 300 <= 400, category Electronics)
    const existingMatches = await WantMatch.find({ want: want1Id });
    assert(
      'Test 4: Creating want immediately checks existing listings and finds Casio calculator',
      existingMatches.length > 0 && existingMatches.some((m) => m.matchReason.toLowerCase().includes('matched keywords') || m.matchReason.toLowerCase().includes('keywords matched')),
      existingMatches
    );

    // Test 5: In-app notification sent with want_match type
    const matchNotif = await Notification.findOne({
      recipientId: rahul._id,
      type: 'want_match',
    }).sort({ createdAt: -1 });
    assert(
      'Test 5: Rahul receives an in-app notification of type want_match',
      matchNotif !== null && matchNotif.type === 'want_match',
      matchNotif
    );

    // Test 6: Another student (Priya) cannot view or modify Rahul's want
    const getOtherRes = await fetch(`${baseUrl}/api/wants/${want1Id}`, {
      method: 'GET',
      headers: headersPriya,
    });
    assert('Test 6: Other student cannot access another’s want (403)', getOtherRes.status === 403);

    // Test 7: Student can pause and resume want
    const pauseRes = await fetch(`${baseUrl}/api/wants/${want1Id}`, {
      method: 'PATCH',
      headers: headersRahul,
      body: JSON.stringify({ status: 'PAUSED' }),
    });
    const pauseBody: any = await pauseRes.json();
    assert(
      'Test 7: Rahul can pause their active want',
      pauseRes.status === 200 && pauseBody.want.status === 'PAUSED',
      pauseBody
    );

    // Resume want
    const resumeRes = await fetch(`${baseUrl}/api/wants/${want1Id}`, {
      method: 'PATCH',
      headers: headersRahul,
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    const resumeBody: any = await resumeRes.json();
    assert(
      'Test 8: Rahul can resume their paused want',
      resumeRes.status === 200 && resumeBody.want.status === 'ACTIVE',
      resumeBody
    );

    // Test 9: Unique compound index on (want, listing) prevents duplicate matches
    const firstListingId = existingMatches[0].listing;
    let duplicateErrorCaught = false;
    try {
      await WantMatch.create({
        want: want1Id,
        listing: firstListingId,
        student: rahul._id,
        matchReason: 'Duplicate attempt test',
        matchedAt: new Date(),
      });
    } catch (err: any) {
      if (err.code === 11000) duplicateErrorCaught = true;
    }
    assert('Test 9: Compound unique index prevents duplicate want-listing match records', duplicateErrorCaught);

    // Test 10: Enforce active-wants limit of 10
    const extraWants = [];
    for (let i = 0; i < 9; i++) {
      extraWants.push({
        student: rahul._id,
        keywords: `test item ${i}`,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      });
    }
    await Want.insertMany(extraWants);

    // 10 active wants now exist for Rahul. Attempting 11th should be rejected.
    const overflowRes = await fetch(`${baseUrl}/api/wants`, {
      method: 'POST',
      headers: headersRahul,
      body: JSON.stringify({ keywords: 'overflow item 11' }),
    });
    const overflowBody: any = await overflowRes.json();
    assert(
      'Test 10: Creating 11th active want rejected with 400 (limit 10)',
      overflowRes.status === 400 && overflowBody.message.includes('limit of 10'),
      overflowBody
    );

    // Clean up temporary extra wants
    await Want.deleteMany({ student: rahul._id, keywords: /^test item/ });

    // Test 11: Matching excludes seller's own listings
    // Divya creates a want for calculators. Divya's own calculator must NOT match.
    const divyaWant = await Want.create({
      student: divya._id,
      keywords: 'scientific calculator',
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    });
    const divyaMatches = await checkExistingListingsForWant(divyaWant._id.toString());
    const matchedOwn = divyaMatches.matchedListings.some((m) => m.listing?.sellerId?.toString() === divya._id.toString());
    assert("Test 11: Want matching excludes student's own listings", !matchedOwn);
    await Want.deleteOne({ _id: divyaWant._id });

    // Test 12: Publishing new auction listing triggers match for active wants
    // Rahul has want for 'scientific calculator'
    const newAuction = await Auction.create({
      sellerId: divya._id,
      title: 'Brand New Citizen Scientific Calculator with Solar Backup',
      description: 'Used for engineering calculations, perfect working condition.',
      category: 'Electronics',
      condition: 'Good',
      startingPrice: 350,
      minimumBidIncrement: 20,
      closingAt: new Date(Date.now() + 24 * 3600 * 1000),
      status: 'active',
    });

    const newMatchCount = await checkNewListingMatches(newAuction);
    assert(
      'Test 12: Publishing new listing automatically matches Rahul’s want and triggers alert',
      newMatchCount > 0
    );

    // Test 13: Price constraint prevents matching if starting price exceeds maxPrice
    const expensiveAuction = await Auction.create({
      sellerId: divya._id,
      title: 'Texas Instruments Graphing Scientific Calculator',
      description: 'Advanced graphing calculator.',
      category: 'Electronics',
      condition: 'Good',
      startingPrice: 1500, // Exceeds Rahul's maxPrice of 400
      minimumBidIncrement: 50,
      closingAt: new Date(Date.now() + 24 * 3600 * 1000),
      status: 'active',
    });
    const expensiveMatch = doesListingMatchWant(expensiveAuction, createBody.want);
    assert('Test 13: Listing with starting price > maxPrice does not match', !expensiveMatch.matches);

    // Test 14: Category constraint prevents matching wrong category
    const wrongCategoryAuction = await Auction.create({
      sellerId: divya._id,
      title: 'Calculator Tricks and Formula Book',
      description: 'Textbook with engineering formula tips.',
      category: 'Books and Study Materials', // Rahul's want category is Electronics
      condition: 'Good',
      startingPrice: 200,
      minimumBidIncrement: 20,
      closingAt: new Date(Date.now() + 24 * 3600 * 1000),
      status: 'active',
    });
    const wrongCatMatch = doesListingMatchWant(wrongCategoryAuction, createBody.want);
    assert('Test 14: Listing with non-matching category does not match', !wrongCatMatch.matches);

    // Test 15: Closed or expired auctions do not trigger alerts
    const closedAuction = await Auction.create({
      sellerId: divya._id,
      title: 'Casio Scientific Calculator Closed Unit',
      description: 'Already finished auction.',
      category: 'Electronics',
      condition: 'Good',
      startingPrice: 250,
      minimumBidIncrement: 20,
      closingAt: new Date(Date.now() - 3600 * 1000), // Ended 1 hr ago
      status: 'sold',
    });
    const closedMatch = doesListingMatchWant(closedAuction, createBody.want);
    assert('Test 15: Closed/expired auction does not match active want', !closedMatch.matches);

    // Test 16: Mark want as FULFILLED
    const fulfillRes = await fetch(`${baseUrl}/api/wants/${want1Id}/fulfill`, {
      method: 'POST',
      headers: headersRahul,
    });
    const fulfillBody: any = await fulfillRes.json();
    assert(
      'Test 16: Student can mark want as FULFILLED',
      fulfillRes.status === 200 && fulfillBody.want.status === 'FULFILLED',
      fulfillBody
    );

    // Test 17: Renew expired want extends expiresAt by 30 days and sets ACTIVE
    const renewRes = await fetch(`${baseUrl}/api/wants/${want1Id}/renew`, {
      method: 'POST',
      headers: headersRahul,
    });
    const renewBody: any = await renewRes.json();
    assert(
      'Test 17: Student can renew want for 30 days',
      renewRes.status === 200 && renewBody.want.status === 'ACTIVE',
      renewBody
    );

    // Test 18: Delete want removes want and its WantMatch records
    const deleteRes = await fetch(`${baseUrl}/api/wants/${want1Id}`, {
      method: 'DELETE',
      headers: headersRahul,
    });
    assert('Test 18: Student can delete their own want (200)', deleteRes.status === 200);

    const checkWantGone = await Want.findById(want1Id);
    const checkMatchesGone = await WantMatch.find({ want: want1Id });
    assert(
      'Test 19: Deleted want and its matches are permanently removed',
      checkWantGone === null && checkMatchesGone.length === 0
    );

    // Test 20: Missing SMTP configuration does not throw or break the app
    const emailResult = await sendGroupedMatchEmail({
      recipientEmail: 'rahul.it@kongu.edu',
      recipientName: 'Rahul S',
      wantKeywords: 'calculator',
      listings: [],
    });
    assert(
      'Test 20: Missing SMTP gracefully returns without crashing application',
      emailResult.sent === false && emailResult.reason === 'smtp_not_configured'
    );

    // Cleanup test auctions
    await Auction.deleteMany({ _id: { $in: [newAuction._id, expensiveAuction._id, wrongCategoryAuction._id, closedAuction._id] } });

    console.log(`\n========================================`);
    console.log(`WANTS TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
  }

  process.exit(failed > 0 ? 1 : 0);
}

runWantsTestSuite().catch((err) => {
  console.error('Wants test suite crashed:', err);
  process.exit(1);
});
