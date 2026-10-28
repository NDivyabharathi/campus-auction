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
import { Notification } from '../models/Notification.js';

async function runAutoBiddingTestSuite() {
  console.log('===============================================================');
  console.log('--- STARTING AUTOMATIC BIDDING (PROXY BIDDING) TEST SUITE ---');
  console.log('===============================================================');

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
    // 1. Fetch test users
    const divya = await User.findOne({ email: 'divya.cse@kongu.edu' });     // Seller
    const rahul = await User.findOne({ email: 'rahul.it@kongu.edu' });       // Buyer 1
    const priya = await User.findOne({ email: 'priya.ece@kongu.edu' });     // Buyer 2
    const karthik = await User.findOne({ email: 'karthik.mech@kongu.edu' }); // Buyer 3
    const sneha = await User.findOne({ email: 'sneha.aids@kongu.edu' });     // Buyer 4

    if (!divya || !rahul || !priya || !karthik || !sneha) {
      console.error('Seed students not found in database! Please run seed first.');
      process.exit(1);
    }

    const tokenDivya = jwt.sign({ id: divya._id.toString() }, ENV.JWT_SECRET, { expiresIn: '1d' });
    const tokenRahul = jwt.sign({ id: rahul._id.toString() }, ENV.JWT_SECRET, { expiresIn: '1d' });
    const tokenPriya = jwt.sign({ id: priya._id.toString() }, ENV.JWT_SECRET, { expiresIn: '1d' });
    const tokenKarthik = jwt.sign({ id: karthik._id.toString() }, ENV.JWT_SECRET, { expiresIn: '1d' });
    const tokenSneha = jwt.sign({ id: sneha._id.toString() }, ENV.JWT_SECRET, { expiresIn: '1d' });

    // Helper for requests
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
    // TEST 1: Authentication & Fairness validations
    // =========================================================================
    console.log('\n--- [TEST GROUP 1] Permission & Input Validations ---');
    const testAuc1 = await Auction.create({
      sellerId: divya._id,
      title: 'AutoBid Test Item 1',
      description: 'Engineering tool for proxy testing',
      category: 'Other',
      condition: 'Good',
      imageUrls: ['https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800'],
      startingPrice: 1000,
      minimumBidIncrement: 50,
      closingAt: new Date(Date.now() + 3600 * 1000),
      status: 'active',
      bidCount: 0,
    });
    testAuctionsToClean.push(testAuc1._id);

    // 1.1 Unauthenticated enable attempt
    const resNoAuth = await apiRequest(`/api/auctions/${testAuc1._id}/auto-bid`, {
      method: 'POST',
      body: { maxAmount: 1500 },
    });
    assert('Unauthenticated user receives 401 Unauthorized', resNoAuth.status === 401);

    // 1.2 Seller self-bidding prevention
    const resSeller = await apiRequest(`/api/auctions/${testAuc1._id}/auto-bid`, {
      method: 'POST',
      token: tokenDivya,
      body: { maxAmount: 1500 },
    });
    assert('Seller cannot enable auto-bid on their own listing (403)', resSeller.status === 403);

    // 1.3 Invalid max amount below starting price
    const resBelowStart = await apiRequest(`/api/auctions/${testAuc1._id}/auto-bid`, {
      method: 'POST',
      token: tokenRahul,
      body: { maxAmount: 800 },
    });
    assert('Max amount below starting price is rejected (400)', resBelowStart.status === 400);

    // =========================================================================
    // TEST 2: Initial Auto-Bid on Fresh Listing (0 bids)
    // =========================================================================
    console.log('\n--- [TEST GROUP 2] Initial Auto-Bid on Fresh Listing ---');
    // Rahul enables auto-bid with max ₹1,500
    const resEnableRahul = await apiRequest(`/api/auctions/${testAuc1._id}/auto-bid`, {
      method: 'POST',
      token: tokenRahul,
      body: { maxAmount: 1500 },
    });
    assert('Rahul enables auto-bid successfully (200/201)', resEnableRahul.status === 200 || resEnableRahul.status === 201);
    assert('Response confirms maxAmount is 1500', resEnableRahul.data?.autoBid?.maxAmount === 1500);

    // Wait a brief moment for async proxy evaluation
    await new Promise((r) => setTimeout(r, 200));

    // Verify auction status: starting bid placed at startingPrice (1000), not maxAmount (1500)
    const checkAuc1 = await Auction.findById(testAuc1._id);
    assert('Auction currentLeadingBid is 1000 (starting price)', checkAuc1?.currentLeadingBid === 1000);
    assert('Auction bidCount is 1', checkAuc1?.bidCount === 1);
    assert('Leading bidder is Rahul', checkAuc1?.currentLeadingBidderId?.toString() === rahul._id.toString());

    // Check Bid record in DB
    const firstBid = await Bid.findOne({ auctionId: testAuc1._id });
    assert('First bid recorded with bidSource AUTO', (firstBid as any)?.bidSource === 'AUTO');
    assert('First bid amount is 1000', firstBid?.amount === 1000);

    // =========================================================================
    // TEST 3: Competing Manual Bid & Automatic Proxy Counter
    // =========================================================================
    console.log('\n--- [TEST GROUP 3] Manual Bid vs Auto-Bid ---');
    // Priya places manual bid of ₹1,100
    const resManualPriya = await apiRequest(`/api/auctions/${testAuc1._id}/bids`, {
      method: 'POST',
      token: tokenPriya,
      body: { amount: 1100 },
    });
    assert('Priya places manual bid of ₹1,100 (201)', resManualPriya.status === 201);

    // Wait for Rahul's proxy to evaluate and counter
    await new Promise((r) => setTimeout(r, 300));

    const checkAucAfterCounter = await Auction.findById(testAuc1._id);
    assert('Rahul automatically counter-bid at ₹1,150 (1100 + 50)', checkAucAfterCounter?.currentLeadingBid === 1150);
    assert('Rahul retains lead', checkAucAfterCounter?.currentLeadingBidderId?.toString() === rahul._id.toString());
    assert('Bid count incremented to 3', checkAucAfterCounter?.bidCount === 3);

    // =========================================================================
    // TEST 4: Privacy Verification
    // =========================================================================
    console.log('\n--- [TEST GROUP 4] Privacy Guarantees ---');
    // 4.1 Public auction details endpoint must NOT leak maxAmount
    const resPublicAuc = await apiRequest(`/api/auctions/${testAuc1._id}`);
    assert('Public auction query does NOT expose maxAmount', (resPublicAuc.data?.auction as any)?.maxAmount === undefined);

    // 4.2 Public bid history endpoint must NOT leak maxAmount
    const resPublicBids = await apiRequest(`/api/auctions/${testAuc1._id}/bids`);
    const anyLeakedBid = resPublicBids.data?.bids?.some((b: any) => b.maxAmount !== undefined);
    assert('Public bid history does NOT expose maxAmount in any bid item', anyLeakedBid === false);

    // 4.3 Priya calling /auto-bid/me gets autoBid: null
    const resPriyaAutoBid = await apiRequest(`/api/auctions/${testAuc1._id}/auto-bid/me`, { token: tokenPriya });
    assert('Priya cannot see Rahul\'s autoBid (returns null)', resPriyaAutoBid.data?.autoBid === null);

    // 4.4 Rahul calling /auto-bid/me sees his own configuration
    const resRahulAutoBid = await apiRequest(`/api/auctions/${testAuc1._id}/auto-bid/me`, { token: tokenRahul });
    assert('Rahul can privately view his own maxAmount (1500)', resRahulAutoBid.data?.autoBid?.maxAmount === 1500);
    assert('Rahul is marked as currently leading', resRahulAutoBid.data?.isLeading === true);

    // =========================================================================
    // TEST 5: Manual Bid Exceeding Proxy Limit
    // =========================================================================
    console.log('\n--- [TEST GROUP 5] Exceeding Auto-Bid Maximum ---');
    // Karthik bids ₹1,600 (above Rahul's ₹1,500 ceiling)
    const resKarthikHigh = await apiRequest(`/api/auctions/${testAuc1._id}/bids`, {
      method: 'POST',
      token: tokenKarthik,
      body: { amount: 1600 },
    });
    assert('Karthik places bid of ₹1,600 (201)', resKarthikHigh.status === 201);

    await new Promise((r) => setTimeout(r, 300));

    const checkAucAfterKarthik = await Auction.findById(testAuc1._id);
    assert('Karthik takes the lead at ₹1,600', checkAucAfterKarthik?.currentLeadingBidderId?.toString() === karthik._id.toString());
    assert('Rahul\'s proxy did NOT bid above ₹1,500', checkAucAfterKarthik?.currentLeadingBid === 1600);

    // Check notification sent to Rahul
    const rahulNotif = await Notification.findOne({
      recipientId: rahul._id,
      auctionId: testAuc1._id,
      type: 'auto_bid_max_exceeded',
    });
    assert('Rahul received auto_bid_max_exceeded notification', Boolean(rahulNotif));

    // =========================================================================
    // TEST 6: Updating Ceiling (Increasing Max Amount)
    // =========================================================================
    console.log('\n--- [TEST GROUP 6] Updating Maximum Ceiling ---');
    // Rahul updates max to ₹1,800
    const resUpdateMax = await apiRequest(`/api/auctions/${testAuc1._id}/auto-bid`, {
      method: 'PATCH',
      token: tokenRahul,
      body: { maxAmount: 1800 },
    });
    assert('Rahul successfully raises max to ₹1,800 (200)', resUpdateMax.status === 200);

    await new Promise((r) => setTimeout(r, 300));

    const checkAucAfterRaise = await Auction.findById(testAuc1._id);
    assert('Rahul automatically counter-bid at ₹1,650 to regain lead', checkAucAfterRaise?.currentLeadingBid === 1650);
    assert('Rahul is leading again', checkAucAfterRaise?.currentLeadingBidderId?.toString() === rahul._id.toString());

    // =========================================================================
    // TEST 7: Pausing & Resuming Auto-Bidding
    // =========================================================================
    console.log('\n--- [TEST GROUP 7] Pause and Resume Auto-Bidding ---');
    // Rahul pauses auto-bid
    const resPause = await apiRequest(`/api/auctions/${testAuc1._id}/auto-bid`, {
      method: 'PATCH',
      token: tokenRahul,
      body: { status: 'paused' },
    });
    assert('Rahul pauses auto-bid (200)', resPause.status === 200 && resPause.data?.autoBid?.status === 'paused');

    // Priya bids ₹1,700
    await apiRequest(`/api/auctions/${testAuc1._id}/bids`, {
      method: 'POST',
      token: tokenPriya,
      body: { amount: 1700 },
    });
    await new Promise((r) => setTimeout(r, 300));

    const checkAucWhilePaused = await Auction.findById(testAuc1._id);
    assert('Priya leads at ₹1,700 while Rahul is paused', checkAucWhilePaused?.currentLeadingBid === 1700 && checkAucWhilePaused?.currentLeadingBidderId?.toString() === priya._id.toString());

    // Rahul resumes auto-bid
    const resResume = await apiRequest(`/api/auctions/${testAuc1._id}/auto-bid`, {
      method: 'PATCH',
      token: tokenRahul,
      body: { status: 'active' },
    });
    assert('Rahul resumes auto-bid (200)', resResume.status === 200 && resResume.data?.autoBid?.status === 'active');

    await new Promise((r) => setTimeout(r, 300));

    const checkAucAfterResume = await Auction.findById(testAuc1._id);
    assert('Rahul automatically counter-bids at ₹1,750 after resumption', checkAucAfterResume?.currentLeadingBid === 1750);
    assert('Rahul is leading again', checkAucAfterResume?.currentLeadingBidderId?.toString() === rahul._id.toString());

    // =========================================================================
    // TEST 8: Multi-Bidder Proxy Competition (Auto vs Auto)
    // =========================================================================
    console.log('\n--- [TEST GROUP 8] Competing Auto-Bidders (Proxy vs Proxy) ---');
    const testAuc2 = await Auction.create({
      sellerId: divya._id,
      title: 'AutoBid Test Item 2 - Competing Proxies',
      description: 'Scientific Calculator fx-991EX',
      category: 'Electronics',
      condition: 'Like New',
      imageUrls: ['https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800'],
      startingPrice: 500,
      minimumBidIncrement: 50,
      closingAt: new Date(Date.now() + 3600 * 1000),
      status: 'active',
      bidCount: 0,
    });
    testAuctionsToClean.push(testAuc2._id);

    // Karthik sets max ₹800
    await apiRequest(`/api/auctions/${testAuc2._id}/auto-bid`, {
      method: 'POST',
      token: tokenKarthik,
      body: { maxAmount: 800 },
    });
    await new Promise((r) => setTimeout(r, 200));

    // Karthik should lead with starting price 500
    const auc2Step1 = await Auction.findById(testAuc2._id);
    assert('Karthik enters proxy at ₹500', auc2Step1?.currentLeadingBid === 500);

    // Sneha sets max ₹1,100 (higher than Karthik's 800)
    await apiRequest(`/api/auctions/${testAuc2._id}/auto-bid`, {
      method: 'POST',
      token: tokenSneha,
      body: { maxAmount: 1100 },
    });
    await new Promise((r) => setTimeout(r, 400));

    const auc2Step2 = await Auction.findById(testAuc2._id);
    // Competing resolution: Karthik's max is pushed to 800, and Sneha counter-bids at 850 (800 + 50)
    assert('Sneha takes lead at ₹850 (Karthik max 800 + increment 50)', auc2Step2?.currentLeadingBid === 850);
    assert('Sneha holds the lead', auc2Step2?.currentLeadingBidderId?.toString() === sneha._id.toString());

    // =========================================================================
    // TEST 9: Deterministic Tie-Breaker (Identical Max Amounts)
    // =========================================================================
    console.log('\n--- [TEST GROUP 9] Deterministic Tie-Breaker ---');
    const testAuc3 = await Auction.create({
      sellerId: divya._id,
      title: 'AutoBid Test Item 3 - Tie Breaker',
      description: 'Hostel kettle',
      category: 'Hostel Essentials',
      condition: 'Good',
      imageUrls: ['https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800'],
      startingPrice: 300,
      minimumBidIncrement: 50,
      closingAt: new Date(Date.now() + 3600 * 1000),
      status: 'active',
      bidCount: 0,
    });
    testAuctionsToClean.push(testAuc3._id);

    // Rahul sets max ₹600 at T1
    await apiRequest(`/api/auctions/${testAuc3._id}/auto-bid`, {
      method: 'POST',
      token: tokenRahul,
      body: { maxAmount: 600 },
    });
    await new Promise((r) => setTimeout(r, 200));

    // Priya sets identical max ₹600 at T2 (T2 > T1)
    await apiRequest(`/api/auctions/${testAuc3._id}/auto-bid`, {
      method: 'POST',
      token: tokenPriya,
      body: { maxAmount: 600 },
    });
    await new Promise((r) => setTimeout(r, 400));

    const auc3Resolved = await Auction.findById(testAuc3._id);
    // When both have max 600, both are willing to bid up to 600.
    // Price reaches 600, and earlier registrant (Rahul) holds the lead!
    assert('Auction price reached tie max amount of ₹600', auc3Resolved?.currentLeadingBid === 600);
    assert('Earlier registrant (Rahul) wins the tie-breaker', auc3Resolved?.currentLeadingBidderId?.toString() === rahul._id.toString());

    // =========================================================================
    // TEST 10: Disabling Auto-Bidding
    // =========================================================================
    console.log('\n--- [TEST GROUP 10] Disabling Auto-Bidding ---');
    const resDisable = await apiRequest(`/api/auctions/${testAuc1._id}/auto-bid`, {
      method: 'DELETE',
      token: tokenRahul,
    });
    assert('Rahul disables auto-bidding (200)', resDisable.status === 200 && resDisable.data?.autoBid?.status === 'disabled');

    const autoBidDoc = await AutoBid.findOne({ auctionId: testAuc1._id, userId: rahul._id });
    assert('AutoBid document status in DB is disabled', autoBidDoc?.status === 'disabled');

    // Verify existing bids were NOT deleted
    const countBids = await Bid.countDocuments({ auctionId: testAuc1._id });
    assert('Existing bids in history remain intact', countBids > 0);

    // =========================================================================
    // TEST 11: Anti-Sniping Integration with Proxy Bidding
    // =========================================================================
    console.log('\n--- [TEST GROUP 11] Anti-Sniping Integration with Auto-Bidding ---');
    const now = Date.now();
    const testAuc4 = await Auction.create({
      sellerId: divya._id,
      title: 'AutoBid Anti-Sniping Extension Item',
      description: 'Testing proxy extension when <= 30 seconds remain',
      category: 'Electronics',
      condition: 'Good',
      imageUrls: ['https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800'],
      startingPrice: 500,
      minimumBidIncrement: 50,
      closingAt: new Date(now + 20 * 1000), // 20 seconds remaining!
      status: 'active',
      bidCount: 0,
    });
    testAuctionsToClean.push(testAuc4._id);

    // Setup Socket.IO listener to verify auction:extended broadcast
    const socket = ioClient(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
    let extensionBroadcastReceived = false;
    let broadcastNewClosingTime: string | null = null;

    await new Promise<void>((resolve) => {
      socket.on('connect', () => {
        socket.emit('join_auction', testAuc4._id.toString());
        socket.on('auction:extended', (data: any) => {
          if (data.auctionId === testAuc4._id.toString()) {
            extensionBroadcastReceived = true;
            broadcastNewClosingTime = data.newClosingTime;
          }
        });
        resolve();
      });
    });

    // Rahul enables auto-bid on the 20s-remaining auction with max 800
    await apiRequest(`/api/auctions/${testAuc4._id}/auto-bid`, {
      method: 'POST',
      token: tokenRahul,
      body: { maxAmount: 800 },
    });

    // Wait for bid placement and Socket.IO broadcast
    await new Promise((r) => setTimeout(r, 600));

    const checkAucExtended = await Auction.findById(testAuc4._id);
    const originalClosing = now + 20 * 1000;
    const newClosingTimeMs = new Date(checkAucExtended!.closingAt).getTime();

    assert('Auto-bid placed with <= 30s remaining extended the closing time', newClosingTimeMs > originalClosing);
    assert('New closing time is approximately 60s in future', newClosingTimeMs >= Date.now() + 55 * 1000);
    assert('Socket.IO auction:extended event was broadcast', extensionBroadcastReceived);

    socket.disconnect();

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
    }
    await Notification.deleteMany({ title: /Automatic Bidding|Maximum Auto-Bid/ });

    server.close();
    await mongoose.disconnect();

    console.log('\n===============================================================');
    console.log(`TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('===============================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runAutoBiddingTestSuite();
