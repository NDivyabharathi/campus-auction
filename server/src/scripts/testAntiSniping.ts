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
import { Transaction } from '../models/Transaction.js';
import { processAuctionClosure } from '../services/auctionClosureService.js';

function formatTimeRemaining(closingAt: string | Date) {
  const diff = new Date(closingAt).getTime() - Date.now();
  if (diff <= 0) return { text: 'Auction Ended', isEnded: true };
  const seconds = Math.floor((diff / 1000) % 60);
  return { text: `${seconds}s left`, isEnded: false };
}

async function runAntiSnipingTestSuite() {
  console.log('--- STARTING ANTI-SNIPING (LAST-MINUTE EXTENSIONS) TEST SUITE ---');
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
    const divya = await User.findOne({ email: 'divya.cse@kongu.edu' }); // Seller
    const rahul = await User.findOne({ email: 'rahul.it@kongu.edu' });   // Buyer 1
    const priya = await User.findOne({ email: 'priya.ece@kongu.edu' });   // Buyer 2

    if (!divya || !rahul || !priya) {
      console.error('Seed students not found in database!');
      process.exit(1);
    }

    const tokenRahul = jwt.sign({ id: rahul._id.toString() }, ENV.JWT_SECRET, { expiresIn: '1d' });
    const tokenDivya = jwt.sign({ id: divya._id.toString() }, ENV.JWT_SECRET, { expiresIn: '1d' });
    const tokenPriya = jwt.sign({ id: priya._id.toString() }, ENV.JWT_SECRET, { expiresIn: '1d' });

    const headersRahul = { 'Content-Type': 'application/json', Cookie: `token=${tokenRahul}` };
    const headersDivya = { 'Content-Type': 'application/json', Cookie: `token=${tokenDivya}` };
    const headersPriya = { 'Content-Type': 'application/json', Cookie: `token=${tokenPriya}` };

    // =========================================================================
    // Test 1: A valid bid with more than 30 seconds remaining does not extend the auction
    // =========================================================================
    const initialClosing1 = new Date(Date.now() + 50_000); // 50s remaining (> 30s)
    const auc1 = await Auction.create({
      sellerId: divya._id,
      title: 'Anti-Sniping Test 1: 50s Remaining (No Extension)',
      description: 'Auction with 50 seconds remaining for testing anti-sniping threshold.',
      category: 'Electronics',
      condition: 'Good',
      startingPrice: 200,
      minimumBidIncrement: 20,
      closingAt: initialClosing1,
      status: 'active',
    });
    testAuctionsToClean.push(auc1._id);

    const bid1Res = await fetch(`${baseUrl}/api/auctions/${auc1._id}/bids`, {
      method: 'POST',
      headers: headersRahul,
      body: JSON.stringify({ amount: 200 }),
    });
    const bid1Body: any = await bid1Res.json();
    const updated1 = await Auction.findById(auc1._id);

    const diff1 = Math.abs(new Date(updated1!.closingAt).getTime() - initialClosing1.getTime());
    assert(
      'Test 1: A valid bid with > 30s remaining does not extend the auction',
      bid1Res.status === 201 && bid1Body.auction.isExtended === false && diff1 < 1000,
      { bid1Body, diff1 }
    );

    // =========================================================================
    // Test 2: A valid bid with exactly 30 seconds remaining extends closing time to 60s after bid
    // =========================================================================
    const initialClosing2 = new Date(Date.now() + 30_000); // exactly 30s remaining
    const auc2 = await Auction.create({
      sellerId: divya._id,
      title: 'Anti-Sniping Test 2: Exactly 30s Remaining',
      description: 'Auction on the exact 30-second boundary.',
      category: 'Electronics',
      condition: 'Good',
      startingPrice: 300,
      minimumBidIncrement: 20,
      closingAt: initialClosing2,
      status: 'active',
    });
    testAuctionsToClean.push(auc2._id);

    const bid2Time = Date.now();
    const bid2Res = await fetch(`${baseUrl}/api/auctions/${auc2._id}/bids`, {
      method: 'POST',
      headers: headersRahul,
      body: JSON.stringify({ amount: 300 }),
    });
    const bid2Body: any = await bid2Res.json();
    const updated2 = await Auction.findById(auc2._id);

    const expectedClosing2 = bid2Time + 60_000;
    const actualClosing2 = new Date(updated2!.closingAt).getTime();
    const diff2 = Math.abs(actualClosing2 - expectedClosing2);

    assert(
      'Test 2: A valid bid with exactly 30s remaining extends closing time to 60s after bid',
      bid2Res.status === 201 && bid2Body.auction.isExtended === true && diff2 < 2000,
      { bid2Body, diff2 }
    );

    // =========================================================================
    // Test 3: A valid bid with less than 30 seconds remaining extends closing time
    // =========================================================================
    const initialClosing3 = new Date(Date.now() + 15_000); // 15s remaining
    const auc3 = await Auction.create({
      sellerId: divya._id,
      title: 'Anti-Sniping Test 3: 15s Remaining (Extension)',
      description: 'Auction with 15 seconds remaining.',
      category: 'Electronics',
      condition: 'Good',
      startingPrice: 250,
      minimumBidIncrement: 25,
      closingAt: initialClosing3,
      status: 'active',
    });
    testAuctionsToClean.push(auc3._id);

    const bid3Time = Date.now();
    const bid3Res = await fetch(`${baseUrl}/api/auctions/${auc3._id}/bids`, {
      method: 'POST',
      headers: headersRahul,
      body: JSON.stringify({ amount: 250 }),
    });
    const bid3Body: any = await bid3Res.json();
    const updated3 = await Auction.findById(auc3._id);

    const expectedClosing3 = bid3Time + 60_000;
    const actualClosing3 = new Date(updated3!.closingAt).getTime();
    const diff3 = Math.abs(actualClosing3 - expectedClosing3);

    assert(
      'Test 3: A valid bid with < 30s remaining extends closing time to 60s after accepted bid',
      bid3Res.status === 201 && bid3Body.auction.isExtended === true && diff3 < 2000,
      { bid3Body, diff3 }
    );

    // =========================================================================
    // Test 4: A rejected bid never extends the auction
    // =========================================================================
    const initialClosing4 = new Date(Date.now() + 20_000);
    const auc4 = await Auction.create({
      sellerId: divya._id,
      title: 'Anti-Sniping Test 4: Rejected Bid Check',
      description: 'Auction with 20 seconds remaining testing rejected bid.',
      category: 'Electronics',
      condition: 'Good',
      startingPrice: 500,
      minimumBidIncrement: 50,
      closingAt: initialClosing4,
      status: 'active',
      currentLeadingBid: 500,
      bidCount: 1,
    });
    testAuctionsToClean.push(auc4._id);

    // Rahul submits bid lower than min increment (520 < 550)
    const bid4Res = await fetch(`${baseUrl}/api/auctions/${auc4._id}/bids`, {
      method: 'POST',
      headers: headersRahul,
      body: JSON.stringify({ amount: 520 }),
    });
    const updated4 = await Auction.findById(auc4._id);
    const diff4 = Math.abs(new Date(updated4!.closingAt).getTime() - initialClosing4.getTime());

    assert(
      'Test 4: A rejected bid never extends the auction',
      bid4Res.status === 400 && diff4 === 0,
      { status: bid4Res.status, diff4 }
    );

    // =========================================================================
    // Test 5: A bid against an expired auction is rejected
    // =========================================================================
    const expiredClosing = new Date(Date.now() - 5_000); // Ended 5s ago
    const auc5 = await Auction.create({
      sellerId: divya._id,
      title: 'Anti-Sniping Test 5: Expired Auction',
      description: 'Auction whose deadline has already elapsed.',
      category: 'Electronics',
      condition: 'Good',
      startingPrice: 300,
      minimumBidIncrement: 20,
      closingAt: expiredClosing,
      status: 'active',
    });
    testAuctionsToClean.push(auc5._id);

    const bid5Res = await fetch(`${baseUrl}/api/auctions/${auc5._id}/bids`, {
      method: 'POST',
      headers: headersRahul,
      body: JSON.stringify({ amount: 300 }),
    });
    assert(
      'Test 5: A bid against an expired auction is rejected (400)',
      bid5Res.status === 400
    );

    // =========================================================================
    // Test 6: A seller cannot extend their own auction by bidding
    // =========================================================================
    const auc6Closing = new Date(Date.now() + 15_000);
    const auc6 = await Auction.create({
      sellerId: divya._id,
      title: 'Anti-Sniping Test 6: Seller Self-Bid Check',
      description: 'Auction testing self-bidding prevention.',
      category: 'Electronics',
      condition: 'Good',
      startingPrice: 400,
      minimumBidIncrement: 20,
      closingAt: auc6Closing,
      status: 'active',
    });
    testAuctionsToClean.push(auc6._id);

    const bid6Res = await fetch(`${baseUrl}/api/auctions/${auc6._id}/bids`, {
      method: 'POST',
      headers: headersDivya, // Divya is seller
      body: JSON.stringify({ amount: 400 }),
    });
    const updated6 = await Auction.findById(auc6._id);
    const diff6 = Math.abs(new Date(updated6!.closingAt).getTime() - auc6Closing.getTime());

    assert(
      'Test 6: A seller cannot extend their own auction by bidding (403)',
      bid6Res.status === 403 && diff6 === 0
    );

    // =========================================================================
    // Test 7: Concurrent valid bids preserve the correct highest bid and closing timestamp
    // =========================================================================
    const initialClosing7 = new Date(Date.now() + 20_000);
    const auc7 = await Auction.create({
      sellerId: divya._id,
      title: 'Anti-Sniping Test 7: Concurrency Test',
      description: 'Auction testing concurrent simultaneous bids.',
      category: 'Electronics',
      condition: 'Good',
      startingPrice: 500,
      minimumBidIncrement: 50,
      closingAt: initialClosing7,
      status: 'active',
    });
    testAuctionsToClean.push(auc7._id);

    // Fire 2 concurrent bids for the first slot
    const [resA, resB] = await Promise.all([
      fetch(`${baseUrl}/api/auctions/${auc7._id}/bids`, {
        method: 'POST',
        headers: headersRahul,
        body: JSON.stringify({ amount: 500 }),
      }),
      fetch(`${baseUrl}/api/auctions/${auc7._id}/bids`, {
        method: 'POST',
        headers: headersPriya,
        body: JSON.stringify({ amount: 500 }),
      }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    const updated7 = await Auction.findById(auc7._id);

    assert(
      'Test 7: Concurrent valid bids preserve atomic consistency (one 201, one rejected with 409 or 400)',
      statuses[0] === 201 && (statuses[1] === 409 || statuses[1] === 400) && updated7!.bidCount === 1,
      { statuses, bidCount: updated7!.bidCount }
    );

    // =========================================================================
    // Test 8: The closing worker does not close an auction using a stale deadline
    // =========================================================================
    // Suppose auction was extended. Background closure worker runs.
    const initialClosing8 = new Date(Date.now() + 10_000);
    const auc8 = await Auction.create({
      sellerId: divya._id,
      title: 'Anti-Sniping Test 8: Worker Race Condition Guard',
      description: 'Auction testing that worker respects extended deadline.',
      category: 'Electronics',
      condition: 'Good',
      startingPrice: 600,
      minimumBidIncrement: 50,
      closingAt: initialClosing8,
      status: 'active',
    });
    testAuctionsToClean.push(auc8._id);

    // Bid arrives with 10s left -> extends to now + 60s
    await fetch(`${baseUrl}/api/auctions/${auc8._id}/bids`, {
      method: 'POST',
      headers: headersRahul,
      body: JSON.stringify({ amount: 600 }),
    });

    // Now call processAuctionClosure as the worker would
    const workerResult = await processAuctionClosure(auc8._id.toString());
    const checkAuc8 = await Auction.findById(auc8._id);

    assert(
      'Test 8: The closing worker does not close an auction using a stale deadline',
      checkAuc8!.status === 'active' && new Date(checkAuc8!.closingAt).getTime() > Date.now() + 45_000,
      { status: checkAuc8!.status, closingAt: checkAuc8!.closingAt }
    );

    // =========================================================================
    // Test 9: Socket.IO broadcasts the new deadline after a successful extension
    // =========================================================================
    const initialClosing9 = new Date(Date.now() + 20_000);
    const auc9 = await Auction.create({
      sellerId: divya._id,
      title: 'Anti-Sniping Test 9: Socket.IO Broadcast',
      description: 'Auction testing real-time socket extension broadcast.',
      category: 'Electronics',
      condition: 'Good',
      startingPrice: 350,
      minimumBidIncrement: 20,
      closingAt: initialClosing9,
      status: 'active',
    });
    testAuctionsToClean.push(auc9._id);

    // Connect test Socket.IO client
    const socket: any = ioClient(baseUrl, {
      transports: ['websocket'],
      auth: { token: `Bearer ${tokenPriya}` },
    });

    let socketExtendedReceived: any = null;
    let newBidReceived: any = null;

    await new Promise<void>((resolve) => {
      socket.on('connect', () => {
        socket.emit('join_auction', auc9._id.toString());
        resolve();
      });
    });

    socket.on('auction:extended', (data: any) => {
      socketExtendedReceived = data;
    });

    socket.on('new_bid', (data: any) => {
      newBidReceived = data;
    });

    // Place extension bid
    await fetch(`${baseUrl}/api/auctions/${auc9._id}/bids`, {
      method: 'POST',
      headers: headersRahul,
      body: JSON.stringify({ amount: 350 }),
    });

    // Wait 500ms for socket delivery
    await new Promise((r) => setTimeout(r, 600));

    assert(
      'Test 9: Socket.IO broadcasts auction:extended and new_bid with new deadline',
      socketExtendedReceived !== null &&
        socketExtendedReceived.auctionId === auc9._id.toString() &&
        socketExtendedReceived.extensionSeconds === 60 &&
        newBidReceived !== null &&
        newBidReceived.isExtended === true,
      { socketExtendedReceived, newBidReceived }
    );

    // =========================================================================
    // Test 10: Clients update countdown when extension event arrives
    // =========================================================================
    const timeFormatted = formatTimeRemaining(socketExtendedReceived.newClosingTime);
    assert(
      'Test 10: Countdown formatting updates immediately with newly received deadline',
      !timeFormatted.isEnded && timeFormatted.text.includes('s left'),
      timeFormatted
    );

    socket.disconnect();

    // =========================================================================
    // Test 11: A client reconnecting after an extension receives the latest closing timestamp
    // =========================================================================
    const getReconnected = await fetch(`${baseUrl}/api/auctions/${auc9._id}`);
    const getJson: any = await getReconnected.json();

    const matchesPersisted =
      new Date(getJson.auction.closingAt).toISOString() ===
      new Date(socketExtendedReceived.newClosingTime).toISOString();

    assert(
      'Test 11: Client reconnecting after an extension receives the latest persisted closing timestamp',
      getJson.success === true && matchesPersisted,
      { apiClosing: getJson.auction.closingAt, socketClosing: socketExtendedReceived.newClosingTime }
    );

    // =========================================================================
    // Test 12: Existing bidding and auction settlement tests continue to pass
    // =========================================================================
    // When auction finally expires past its extension deadline, it settles cleanly
    const auc12 = await Auction.create({
      sellerId: divya._id,
      title: 'Anti-Sniping Test 12: Legitimate Settlement',
      description: 'Auction closing after extension with winning bidder.',
      category: 'Electronics',
      condition: 'Good',
      startingPrice: 500,
      minimumBidIncrement: 50,
      closingAt: new Date(Date.now() - 2000), // Ended 2s ago
      status: 'active',
      currentLeadingBid: 600,
      currentLeadingBidderId: rahul._id,
      bidCount: 2,
    });
    testAuctionsToClean.push(auc12._id);

    await Bid.create({
      auctionId: auc12._id,
      bidderId: rahul._id,
      amount: 600,
      createdAt: new Date(Date.now() - 3000),
    });

    const settledAuction = await processAuctionClosure(auc12._id.toString());
    const reservation = await Transaction.findOne({ auctionId: auc12._id });

    assert(
      'Test 12: Existing settlement creates reservation and assigns winner after deadline passes',
      settledAuction !== null &&
        settledAuction.status === 'reserved' &&
        reservation !== null &&
        reservation.buyerId.toString() === rahul._id.toString() &&
        reservation.amount === 600,
      { settledStatus: settledAuction?.status, reservation }
    );

    console.log(`\n========================================`);
    console.log(`ANTI-SNIPING TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);
  } finally {
    // Clean up test auctions and bids
    if (testAuctionsToClean.length > 0) {
      await Auction.deleteMany({ _id: { $in: testAuctionsToClean } });
      await Bid.deleteMany({ auctionId: { $in: testAuctionsToClean } });
      await Transaction.deleteMany({ auctionId: { $in: testAuctionsToClean } });
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
  }

  process.exit(failed > 0 ? 1 : 0);
}

runAntiSnipingTestSuite().catch((err) => {
  console.error('Anti-Sniping test suite crashed:', err);
  process.exit(1);
});
