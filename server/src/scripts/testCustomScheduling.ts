import http from 'http';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { io as ioClient } from 'socket.io-client';
import { createApp } from '../app.js';
import { connectDB } from '../config/db.js';
import { ENV } from '../config/env.js';
import { initSocket } from '../socket.js';
import { User } from '../models/User.js';
import { Auction } from '../models/Auction.js';
import { Bid } from '../models/Bid.js';
import { AutoBid } from '../models/AutoBid.js';
import { Transaction } from '../models/Transaction.js';
import { Notification } from '../models/Notification.js';
import { activateScheduledAuction, processAuctionClosure } from '../services/auctionClosureService.js';

// IST Date/Time Formatter matching frontend formatISTDateTime
function formatISTDateTime(dateInput: string | Date): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'Invalid Date';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

async function runCustomSchedulingTestSuite() {
  console.log('====================================================================');
  console.log('--- STARTING CUSTOM AUCTION SCHEDULING COMPREHENSIVE TEST SUITE ---');
  console.log('====================================================================\n');

  await connectDB();
  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);

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

  const testAuctionsToClean: mongoose.Types.ObjectId[] = [];

  try {
    // 1. Fetch test students
    const divya = await User.findOne({ email: 'divya.cse@kongu.edu' });     // Seller
    const rahul = await User.findOne({ email: 'rahul.it@kongu.edu' });       // Buyer 1
    const priya = await User.findOne({ email: 'priya.ece@kongu.edu' });     // Buyer 2

    if (!divya || !rahul || !priya) {
      console.error('Seed students not found in database! Please run seed first.');
      process.exit(1);
    }

    const tokenDivya = jwt.sign({ id: divya._id.toString() }, ENV.JWT_SECRET, { expiresIn: '1d' });
    const tokenRahul = jwt.sign({ id: rahul._id.toString() }, ENV.JWT_SECRET, { expiresIn: '1d' });
    const tokenPriya = jwt.sign({ id: priya._id.toString() }, ENV.JWT_SECRET, { expiresIn: '1d' });

    // Request helper
    async function apiRequest(
      path: string,
      options: { method?: string; token?: string; body?: any } = {}
    ): Promise<{ status: number; data: any }> {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (options.token) {
        headers['Cookie'] = `token=${options.token}`;
      }
      const res = await fetch(`${baseUrl}${path}`, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      const data: any = await res.json().catch(() => null);
      return { status: res.status, data };
    }

    // =========================================================================
    // Test 1: Creating a 1-day auction
    // =========================================================================
    console.log('\n--- 1. Preset Duration: 1-Day Auction ---');
    const res1 = await apiRequest('/api/auctions', {
      method: 'POST',
      token: tokenDivya,
      body: {
        title: 'Engineering Mechanics Textbook - 1 Day',
        description: 'Semester 1 prescribed textbook in excellent condition with notes.',
        category: 'Books and Study Materials',
        condition: 'Like New',
        startingPrice: 250,
        minimumBidIncrement: 20,
        duration: '1d',
      },
    });

    const auc1 = res1.data?.auction;
    if (auc1?._id) testAuctionsToClean.push(auc1._id);

    const diff1d = auc1 ? new Date(auc1.closingAt).getTime() - new Date(auc1.startTime).getTime() : 0;
    const isApprox24h = Math.abs(diff1d - 24 * 60 * 60 * 1000) < 5000;

    assert(
      'Test 1: 1-day auction created with active status and ~24h duration',
      res1.status === 201 && auc1?.status === 'active' && isApprox24h,
      { status: res1.status, diffHours: diff1d / (1000 * 3600), auctionStatus: auc1?.status }
    );

    // =========================================================================
    // Test 2: Creating a 3-day auction
    // =========================================================================
    console.log('\n--- 2. Preset Duration: 3-Day Auction ---');
    const res2 = await apiRequest('/api/auctions', {
      method: 'POST',
      token: tokenDivya,
      body: {
        title: 'Hero Sprint Cycle - 3 Days',
        description: 'Single-speed campus cycle with bell and front basket.',
        category: 'Cycles and Transportation',
        condition: 'Good',
        startingPrice: 1500,
        minimumBidIncrement: 50,
        duration: '3d',
      },
    });

    const auc2 = res2.data?.auction;
    if (auc2?._id) testAuctionsToClean.push(auc2._id);

    const diff3d = auc2 ? new Date(auc2.closingAt).getTime() - new Date(auc2.startTime).getTime() : 0;
    const isApprox72h = Math.abs(diff3d - 72 * 60 * 60 * 1000) < 5000;

    assert(
      'Test 2: 3-day auction created with active status and ~72h duration',
      res2.status === 201 && auc2?.status === 'active' && isApprox72h,
      { status: res2.status, diffHours: diff3d / (1000 * 3600), auctionStatus: auc2?.status }
    );

    // =========================================================================
    // Test 3: Creating a 1-week auction
    // =========================================================================
    console.log('\n--- 3. Preset Duration: 1-Week Auction ---');
    const res3 = await apiRequest('/api/auctions', {
      method: 'POST',
      token: tokenDivya,
      body: {
        title: 'Arduino Uno Starter Kit - 1 Week',
        description: 'Official board with sensors, breadboard, resistors, and jumper wires.',
        category: 'Laboratory Equipment',
        condition: 'Like New',
        startingPrice: 600,
        minimumBidIncrement: 30,
        duration: '7d',
      },
    });

    const auc3 = res3.data?.auction;
    if (auc3?._id) testAuctionsToClean.push(auc3._id);

    const diff7d = auc3 ? new Date(auc3.closingAt).getTime() - new Date(auc3.startTime).getTime() : 0;
    const isApprox168h = Math.abs(diff7d - 168 * 60 * 60 * 1000) < 5000;

    assert(
      'Test 3: 1-week auction created with active status and ~168h duration',
      res3.status === 201 && auc3?.status === 'active' && isApprox168h,
      { status: res3.status, diffHours: diff7d / (1000 * 3600), auctionStatus: auc3?.status }
    );

    // =========================================================================
    // Test 4: Creating a valid custom-schedule auction
    // =========================================================================
    console.log('\n--- 4. Valid Custom Schedule Auction ---');
    const customStart = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
    const customClose = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6 hours from now

    const res4 = await apiRequest('/api/auctions', {
      method: 'POST',
      token: tokenDivya,
      body: {
        title: 'Casio fx-991ES Plus Scientific Calculator - Scheduled',
        description: 'Authentic 417-function non-programmable calculator approved for Anna University exams.',
        category: 'Electronics',
        condition: 'Good',
        startingPrice: 400,
        minimumBidIncrement: 25,
        duration: 'custom',
        startTime: customStart.toISOString(),
        closingAt: customClose.toISOString(),
      },
    });

    const auc4 = res4.data?.auction;
    if (auc4?._id) testAuctionsToClean.push(auc4._id);

    assert(
      'Test 4: Custom schedule auction created with scheduled status and exact start/closing dates',
      res4.status === 201 &&
        auc4?.status === 'scheduled' &&
        new Date(auc4.startTime).getTime() === customStart.getTime() &&
        new Date(auc4.closingAt).getTime() === customClose.getTime(),
      { status: res4.status, auction: auc4 }
    );

    // =========================================================================
    // Test 5: Rejecting an invalid custom schedule (missing dates/times)
    // =========================================================================
    console.log('\n--- 5. Validation: Missing Custom Schedule Dates ---');
    const res5 = await apiRequest('/api/auctions', {
      method: 'POST',
      token: tokenDivya,
      body: {
        title: 'Invalid Schedule Test - Missing Times',
        description: 'Should be rejected because custom duration requires both start and closing times.',
        category: 'Electronics',
        condition: 'Good',
        startingPrice: 300,
        duration: 'custom',
      },
    });

    assert(
      'Test 5: Rejects custom schedule when start or closing time is missing',
      res5.status === 400 && res5.data?.message?.includes('Custom schedule requires'),
      { status: res5.status, message: res5.data?.message }
    );

    // =========================================================================
    // Test 6: Rejecting closing time before or equal to opening time
    // =========================================================================
    console.log('\n--- 6. Validation: Closing Time Before Opening Time ---');
    const res6 = await apiRequest('/api/auctions', {
      method: 'POST',
      token: tokenDivya,
      body: {
        title: 'Invalid Schedule Test - Close Before Open',
        description: 'Should be rejected because closingAt is earlier than startTime.',
        category: 'Electronics',
        condition: 'Good',
        startingPrice: 300,
        duration: 'custom',
        startTime: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
        closingAt: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      },
    });

    assert(
      'Test 6: Rejects custom schedule when closing time is before opening time',
      res6.status === 400 && res6.data?.message?.includes('after opening time'),
      { status: res6.status, message: res6.data?.message }
    );

    // =========================================================================
    // Test 7: Rejecting invalid date strings / timestamps
    // =========================================================================
    console.log('\n--- 7. Validation: Malformed Date Strings ---');
    const res7 = await apiRequest('/api/auctions', {
      method: 'POST',
      token: tokenDivya,
      body: {
        title: 'Invalid Schedule Test - Malformed Dates',
        description: 'Should be rejected because date strings are garbage.',
        category: 'Electronics',
        condition: 'Good',
        startingPrice: 300,
        duration: 'custom',
        startTime: 'not-a-valid-date-timestamp',
        closingAt: 'completely-invalid',
      },
    });

    assert(
      'Test 7: Rejects custom schedule with malformed date strings',
      res7.status === 400,
      { status: res7.status, message: res7.data?.message }
    );

    // =========================================================================
    // Test 8: Rejecting manual bids before opening time
    // =========================================================================
    console.log('\n--- 8. Bidding Guard: Reject Manual Bids When Scheduled ---');
    const res8 = await apiRequest(`/api/auctions/${auc4._id}/bids`, {
      method: 'POST',
      token: tokenRahul,
      body: { amount: 400 },
    });

    assert(
      'Test 8: Rejects manual bid on scheduled auction before opening time',
      res8.status === 400 && res8.data?.message?.includes('not opened yet'),
      { status: res8.status, message: res8.data?.message }
    );

    // =========================================================================
    // Test 9: Accepting manual bids once the auction opens
    // =========================================================================
    console.log('\n--- 9. Bidding Guard: Accept Manual Bids When Opened ---');
    const auc9 = await Auction.create({
      sellerId: divya._id,
      title: 'Opened Auction Test - Lab Coat',
      description: 'Clean white cotton chemistry lab coat, size 38.',
      category: 'Clothing and Accessories',
      condition: 'Good',
      startingPrice: 150,
      minimumBidIncrement: 15,
      startTime: new Date(Date.now() - 10 * 60 * 1000), // opened 10 mins ago
      closingAt: new Date(Date.now() + 60 * 60 * 1000),  // closes in 1 hour
      status: 'active',
    });
    testAuctionsToClean.push(auc9._id);

    const res9 = await apiRequest(`/api/auctions/${auc9._id}/bids`, {
      method: 'POST',
      token: tokenRahul,
      body: { amount: 150 },
    });

    assert(
      'Test 9: Accepts manual bid once auction is open',
      res9.status === 201 && res9.data?.success === true && res9.data?.auction?.currentLeadingBid === 150,
      { status: res9.status, data: res9.data }
    );

    // =========================================================================
    // Test 10: Rejecting bids after effective closing time
    // =========================================================================
    console.log('\n--- 10. Bidding Guard: Reject Bids After Closing Time ---');
    const auc10 = await Auction.create({
      sellerId: divya._id,
      title: 'Expired Auction Test',
      description: 'Auction that has passed its closing deadline.',
      category: 'Electronics',
      condition: 'Good',
      startingPrice: 300,
      minimumBidIncrement: 20,
      startTime: new Date(Date.now() - 2 * 3600 * 1000),
      closingAt: new Date(Date.now() - 60 * 1000), // expired 1 minute ago
      status: 'active',
    });
    testAuctionsToClean.push(auc10._id);

    const res10 = await apiRequest(`/api/auctions/${auc10._id}/bids`, {
      method: 'POST',
      token: tokenPriya,
      body: { amount: 300 },
    });

    assert(
      'Test 10: Rejects bid on auction past its closing time',
      res10.status === 400 &&
        (res10.data?.message?.toLowerCase().includes('closing deadline') ||
          res10.data?.message?.toLowerCase().includes('closed')),
      { status: res10.status, message: res10.data?.message }
    );

    // =========================================================================
    // Test 11: Activating scheduled auction at the correct time
    // =========================================================================
    console.log('\n--- 11. Lifecycle: Activating Scheduled Auction ---');
    const auc11 = await Auction.create({
      sellerId: divya._id,
      title: 'Scheduled Auction Due for Activation',
      description: 'Auction whose opening time is right now or past.',
      category: 'Books and Study Materials',
      condition: 'Like New',
      startingPrice: 180,
      minimumBidIncrement: 20,
      startTime: new Date(Date.now() - 2000), // 2 seconds ago
      closingAt: new Date(Date.now() + 3600 * 1000),
      status: 'scheduled',
    });
    testAuctionsToClean.push(auc11._id);

    const activationResult = await activateScheduledAuction(auc11._id.toString());
    const activatedAuc = await Auction.findById(auc11._id);

    assert(
      'Test 11: Scheduled auction activates when opening time arrives',
      activationResult !== null && activatedAuc?.status === 'active',
      { activationResult, status: activatedAuc?.status }
    );

    // =========================================================================
    // Test 12: Closing expired auction exactly once
    // =========================================================================
    console.log('\n--- 12. Lifecycle: Closing Expired Auction Exactly Once ---');
    const auc12 = await Auction.create({
      sellerId: divya._id,
      title: 'Expired Unsold Auction for Single-Closure Test',
      description: 'Auction with no bids whose closing time has elapsed.',
      category: 'Hostel Essentials',
      condition: 'Fair',
      startingPrice: 100,
      minimumBidIncrement: 10,
      startTime: new Date(Date.now() - 3600 * 1000),
      closingAt: new Date(Date.now() - 5000),
      status: 'active',
    });
    testAuctionsToClean.push(auc12._id);

    const closureResult1 = await processAuctionClosure(auc12._id.toString());
    const closureResult2 = await processAuctionClosure(auc12._id.toString());
    const closedAuc12 = await Auction.findById(auc12._id);

    assert(
      'Test 12: Expired auction closes on first run and is safely skipped on subsequent runs',
      closedAuc12?.status === 'unsold' &&
        closureResult1?.status === 'unsold' &&
        closureResult2?.status === 'unsold',
      { closureResult1: closureResult1?.status, closureResult2: closureResult2?.status, status: closedAuc12?.status }
    );

    // =========================================================================
    // Test 13: Applying anti-sniping extension correctly
    // =========================================================================
    console.log('\n--- 13. Anti-Sniping: Last-Minute Extension on Scheduled/Active Auction ---');
    const initialClosing13 = new Date(Date.now() + 20_000); // 20 seconds remaining (<= 30s)
    const auc13 = await Auction.create({
      sellerId: divya._id,
      title: 'Anti-Sniping Schedule Extension Test',
      description: 'Testing extension when bid arrives with <= 30 seconds remaining.',
      category: 'Electronics',
      condition: 'Good',
      startingPrice: 350,
      minimumBidIncrement: 25,
      startTime: new Date(Date.now() - 10000),
      closingAt: initialClosing13,
      status: 'active',
    });
    testAuctionsToClean.push(auc13._id);

    const bid13Res = await apiRequest(`/api/auctions/${auc13._id}/bids`, {
      method: 'POST',
      token: tokenRahul,
      body: { amount: 350 },
    });

    const updated13 = await Auction.findById(auc13._id);
    const newClosing13Ms = new Date(updated13!.closingAt).getTime();
    const approxExpected13Ms = Date.now() + 60_000;

    assert(
      'Test 13: Bid with <= 30s remaining extends closing time to 60s after bid',
      bid13Res.status === 201 &&
        bid13Res.data?.auction?.isExtended === true &&
        newClosing13Ms > initialClosing13.getTime() &&
        Math.abs(newClosing13Ms - approxExpected13Ms) < 3000,
      { initial: initialClosing13, updated: updated13?.closingAt, isExtended: bid13Res.data?.auction?.isExtended }
    );

    // =========================================================================
    // Test 14: Preventing stale workers from closing extended auctions
    // =========================================================================
    console.log('\n--- 14. Anti-Sniping: Stale Worker Does Not Close Extended Auction ---');
    const prematureClosureResult = await processAuctionClosure(auc13._id.toString());
    const stillActiveAuc13 = await Auction.findById(auc13._id);

    assert(
      'Test 14: Stale closure run does not close extended auction before new deadline',
      prematureClosureResult?.status === 'active' && stillActiveAuc13?.status === 'active',
      { prematureClosureStatus: prematureClosureResult?.status, status: stillActiveAuc13?.status }
    );

    // =========================================================================
    // Test 15: Keeping automatic bidding disabled until auction opens
    // =========================================================================
    console.log('\n--- 15. Automatic Bidding Guard: Disabled on Scheduled Auction ---');
    const res15 = await apiRequest(`/api/auctions/${auc4._id}/auto-bid`, {
      method: 'POST',
      token: tokenRahul,
      body: { maxAmount: 800 },
    });

    assert(
      'Test 15: Automatic bidding rejected on scheduled auction before opening',
      res15.status === 400 && res15.data?.message?.includes('cannot be configured before the auction opens'),
      { status: res15.status, message: res15.data?.message }
    );

    // =========================================================================
    // Test 16: Preserving existing manual bidding increment rules
    // =========================================================================
    console.log('\n--- 16. Manual Bidding: Preserve Increment Rules ---');
    // auc9 currently has leading bid 150, min increment 15.
    // Minimum acceptable bid is 150 + 15 = 165.
    // Bid of 160 should be rejected.
    const res16Invalid = await apiRequest(`/api/auctions/${auc9._id}/bids`, {
      method: 'POST',
      token: tokenPriya,
      body: { amount: 160 },
    });

    // Bid of 165 should be accepted.
    const res16Valid = await apiRequest(`/api/auctions/${auc9._id}/bids`, {
      method: 'POST',
      token: tokenPriya,
      body: { amount: 165 },
    });

    assert(
      'Test 16: Enforces minimum bid increment (rejects 160, accepts 165 on base 150+15)',
      res16Invalid.status === 400 && res16Valid.status === 201 && res16Valid.data?.auction?.currentLeadingBid === 165,
      { invalidStatus: res16Invalid.status, validStatus: res16Valid.status }
    );

    // =========================================================================
    // Test 17: Preserving winner selection and handover creation
    // =========================================================================
    console.log('\n--- 17. Winner Selection & Campus Handover Creation ---');
    // Fast-forward auc9 closing time to past and process closure
    auc9.closingAt = new Date(Date.now() - 2000);
    await auc9.save();

    const closureResult17 = await processAuctionClosure(auc9._id.toString());
    const winningAuc9 = await Auction.findById(auc9._id);
    const handover = await Transaction.findOne({ auctionId: auc9._id });

    assert(
      'Test 17: Closed auction with bids transitions to reserved and creates physical handover transaction',
      closureResult17?.status === 'reserved' &&
        winningAuc9?.status === 'reserved' &&
        handover !== null &&
        handover.status === 'awaiting_handover' &&
        handover.buyerId.toString() === priya._id.toString() &&
        handover.sellerId.toString() === divya._id.toString() &&
        handover.amount === 165,
      {
        auctionStatus: winningAuc9?.status,
        handoverBuyer: handover?.buyerId,
        handoverStatus: handover?.status,
        handoverAmount: handover?.amount,
      }
    );

    // =========================================================================
    // Test 18: Displaying dates and times correctly in IST
    // =========================================================================
    console.log('\n--- 18. Timezone: IST Formatting Verification ---');
    // UTC 2026-10-28 10:00:00 UTC -> IST is +05:30 -> 2026-10-28 3:30 PM IST
    const testUtcDate = new Date('2026-10-28T10:00:00.000Z');
    const istFormatted = formatISTDateTime(testUtcDate);

    // Should include 28 Oct 2026, 3:30 pm (or PM)
    const matchesIST =
      istFormatted.includes('28') &&
      istFormatted.includes('2026') &&
      istFormatted.includes('3:30') &&
      istFormatted.toLowerCase().includes('pm');

    assert(
      'Test 18: Formats UTC date into correct Asia/Kolkata (IST) presentation',
      matchesIST,
      { istFormatted, expectedPortion: '3:30 pm' }
    );

    // =========================================================================
    // Test 19: Updating connected clients through Socket.IO (auction_opened)
    // =========================================================================
    console.log('\n--- 19. Real-Time: Socket.IO auction_opened Broadcast ---');
    const auc19 = await Auction.create({
      sellerId: divya._id,
      title: 'Real-Time Socket Activation Test',
      description: 'Verifying auction_opened socket event upon activation.',
      category: 'Electronics',
      condition: 'Like New',
      startingPrice: 500,
      minimumBidIncrement: 50,
      startTime: new Date(Date.now() - 1000),
      closingAt: new Date(Date.now() + 3600 * 1000),
      status: 'scheduled',
    });
    testAuctionsToClean.push(auc19._id);

    const socketState = { openedReceived: false };
    let receivedPayload: any = null;

    const socket = ioClient(baseUrl, {
      transports: ['websocket'],
      forceNew: true,
    });

    await new Promise<void>((resolve) => {
      socket.on('connect', () => {
        socket.emit('join_auction', auc19._id.toString());
        socket.on('auction_opened', (data: any) => {
          if (data.auctionId === auc19._id.toString()) {
            socketState.openedReceived = true;
            receivedPayload = data;
          }
        });
        resolve();
      });
    });

    await activateScheduledAuction(auc19._id.toString());
    // Wait briefly for socket message propagation
    await new Promise((r) => setTimeout(r, 600));

    assert(
      'Test 19: Socket.IO broadcast auction_opened to connected clients',
      socketState.openedReceived && receivedPayload?.status === 'active',
      { socketOpenedReceived: socketState.openedReceived, receivedPayload }
    );

    socket.disconnect();

    // =========================================================================
    // Test 20: Preventing duplicate closure notifications
    // =========================================================================
    console.log('\n--- 20. Idempotency: No Duplicate Closure Notifications ---');
    // Count notifications for seller and buyer from Test 17 (auctionId is top-level ObjectId)
    const notifsBefore = await Notification.countDocuments({
      auctionId: auc9._id,
    });

    // Run processAuctionClosure again twice
    await processAuctionClosure(auc9._id.toString());
    await processAuctionClosure(auc9._id.toString());

    const notifsAfter = await Notification.countDocuments({
      auctionId: auc9._id,
    });

    assert(
      'Test 20: Re-running closure process produces zero duplicate notifications',
      notifsBefore > 0 && notifsBefore === notifsAfter,
      { notifsBefore, notifsAfter }
    );

  } catch (err: any) {
    console.error('Unexpected error in test suite:', err);
    failed++;
  } finally {
    // Cleanup test auctions and associated bids/autoBids
    console.log('\n--- Cleaning up test artifacts ---');
    for (const aucId of testAuctionsToClean) {
      await Auction.deleteOne({ _id: aucId });
      await Bid.deleteMany({ auctionId: aucId });
      await AutoBid.deleteMany({ auctionId: aucId });
      await Transaction.deleteMany({ auctionId: aucId });
    }
    await Notification.deleteMany({
      title: /Engineering Mechanics|Hero Sprint|Arduino Uno|Casio fx-991ES|Lab Coat|Real-Time Socket/,
    });

    server.close();
    await mongoose.disconnect();

    console.log('\n====================================================================');
    console.log(`CUSTOM SCHEDULING RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('====================================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runCustomSchedulingTestSuite();
