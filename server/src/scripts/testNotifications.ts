import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Auction } from '../models/Auction.js';
import { Bid } from '../models/Bid.js';
import { Transaction } from '../models/Transaction.js';
import { Notification } from '../models/Notification.js';
import {
  createNotification,
  getUserNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from '../services/notificationService.js';
import { processAuctionClosure } from '../services/auctionClosureService.js';

const runTests = async () => {
  try {
    await connectDB();
    console.log('--- STARTING NOTIFICATION SYSTEM INTEGRATION TESTS ---');

    // Fetch test users
    const seller = await User.findOne({ email: 'divya.cse@kongu.edu' });
    const bidder1 = await User.findOne({ email: 'rahul.it@kongu.edu' });
    const bidder2 = await User.findOne({ email: 'priya.ece@kongu.edu' });
    const unrelated = await User.findOne({ email: 'karthik.mech@kongu.edu' });

    if (!seller || !bidder1 || !bidder2 || !unrelated) {
      throw new Error('Seed users not found. Run seed script first.');
    }

    // 1. Test basic notification creation & persistence
    console.log('[Test 1] Testing notification creation for Seller...');
    const notif1 = await createNotification({
      recipientId: seller._id,
      type: 'bid_received',
      title: 'Test Bid Alert',
      message: 'Rahul placed a test bid of ₹500.',
      deduplicationKey: `test_bid_${Date.now()}`,
    });
    if (!notif1 || notif1.recipientId.toString() !== seller._id.toString()) {
      throw new Error('Test 1 failed: notification not created or recipient mismatch.');
    }
    console.log('✓ Test 1 Passed: Notification persisted for Seller.');

    // 2. Test outbid notification
    console.log('[Test 2] Testing outbid notification for Bidder 1...');
    const outbidNotif = await createNotification({
      recipientId: bidder1._id,
      type: 'outbid',
      title: "You've been outbid!",
      message: 'Someone placed a higher bid on Casio Calculator.',
      deduplicationKey: `test_outbid_${Date.now()}`,
    });
    if (!outbidNotif || outbidNotif.type !== 'outbid') {
      throw new Error('Test 2 failed: outbid notification invalid.');
    }
    console.log('✓ Test 2 Passed: Outbid notification successfully sent to Bidder 1.');

    // 3. Test deduplication prevention
    console.log('[Test 3] Testing idempotency / duplicate key prevention...');
    const dupKey = `unique_closure_alert_${Date.now()}`;
    const firstAlert = await createNotification({
      recipientId: seller._id,
      type: 'auction_sold',
      title: 'Auction Sold',
      message: 'Your auction sold.',
      deduplicationKey: dupKey,
    });
    const secondAlert = await createNotification({
      recipientId: seller._id,
      type: 'auction_sold',
      title: 'Auction Sold',
      message: 'Your auction sold.',
      deduplicationKey: dupKey,
    });
    if (!firstAlert || !secondAlert || firstAlert._id.toString() !== secondAlert._id.toString()) {
      throw new Error('Test 3 failed: deduplication did not return the existing record.');
    }
    const countWithKey = await Notification.countDocuments({ deduplicationKey: dupKey });
    if (countWithKey !== 1) {
      throw new Error(`Test 3 failed: expected 1 notification in DB for dupKey, got ${countWithKey}`);
    }
    console.log('✓ Test 3 Passed: Duplicate notifications strictly prevented via deduplicationKey.');

    // 4. Test unread count calculation
    console.log('[Test 4] Testing unread count...');
    const unreadBefore = await getUnreadCount(seller._id);
    if (unreadBefore <= 0) {
      throw new Error('Test 4 failed: expected unread notifications for seller.');
    }
    console.log(`✓ Test 4 Passed: Unread count calculated correctly (${unreadBefore} unread).`);

    // 5. Test mark as read
    console.log('[Test 5] Testing mark single notification as read...');
    const readResult = await markNotificationAsRead(notif1._id.toString(), seller._id);
    if (!readResult || !readResult.readAt) {
      throw new Error('Test 5 failed: notification not marked as read.');
    }
    const unreadAfterSingle = await getUnreadCount(seller._id);
    if (unreadAfterSingle !== unreadBefore - 1) {
      throw new Error('Test 5 failed: unread count did not decrement.');
    }
    console.log('✓ Test 5 Passed: Single notification marked read, unread count decremented.');

    // 6. Test mark all as read
    console.log('[Test 6] Testing mark all notifications as read...');
    await markAllNotificationsAsRead(seller._id);
    const unreadFinal = await getUnreadCount(seller._id);
    if (unreadFinal !== 0) {
      throw new Error(`Test 6 failed: expected 0 unread, got ${unreadFinal}`);
    }
    console.log('✓ Test 6 Passed: Mark all as read cleared all unread notifications to 0.');

    // 7. Test user isolation (access control)
    console.log('[Test 7] Testing user data isolation...');
    const unrelatedFetch = await getUserNotifications(unrelated._id);
    const foundOtherUserNotif = unrelatedFetch.notifications.some(
      (n) => n.recipientId.toString() === seller._id.toString()
    );
    if (foundOtherUserNotif) {
      throw new Error("Test 7 failed: privacy breach, user can see another student's notifications.");
    }
    console.log("✓ Test 7 Passed: User notifications are strictly scoped to recipient's identity.");

    // 8. Test auction closure automatic notification generation
    console.log('[Test 8] Testing auction closure with winner notification generation...');
    const testAuction = await Auction.create({
      sellerId: seller._id,
      title: 'Automated Test Drafter Listing',
      description: 'Used for notification closure integration testing.',
      category: 'Laboratory Equipment',
      condition: 'Like New',
      startingPrice: 100,
      minimumBidIncrement: 10,
      closingAt: new Date(Date.now() - 1000), // Expired
      status: 'active',
      currentLeadingBid: 150,
      currentLeadingBidderId: bidder1._id,
      bidCount: 2,
    });

    await Bid.create([
      { auctionId: testAuction._id, bidderId: bidder2._id, amount: 120, createdAt: new Date(Date.now() - 2000) },
      { auctionId: testAuction._id, bidderId: bidder1._id, amount: 150, createdAt: new Date(Date.now() - 1500) },
    ]);

    await processAuctionClosure(testAuction._id.toString());

    // Check that seller got auction_sold notification
    const sellerSoldNotif = await Notification.findOne({
      recipientId: seller._id,
      auctionId: testAuction._id,
      type: 'auction_sold',
    });
    if (!sellerSoldNotif) {
      throw new Error('Test 8 failed: seller did not receive auction_sold notification.');
    }

    // Check that winner (bidder1) got auction_won notification
    const winnerWonNotif = await Notification.findOne({
      recipientId: bidder1._id,
      auctionId: testAuction._id,
      type: 'auction_won',
    });
    if (!winnerWonNotif) {
      throw new Error('Test 8 failed: winner did not receive auction_won notification.');
    }

    // Check that other bidder (bidder2) got auction_lost notification
    const otherLostNotif = await Notification.findOne({
      recipientId: bidder2._id,
      auctionId: testAuction._id,
      type: 'auction_lost',
    });
    if (!otherLostNotif) {
      throw new Error('Test 8 failed: non-winning bidder did not receive auction_lost notification.');
    }

    console.log('✓ Test 8 Passed: Closure worker created seller sold alert, winner won alert, and other bidder outcome alert.');

    // 9. Test dismissal / deletion
    console.log('[Test 9] Testing dismiss notification...');
    const dismissed = await deleteNotification(sellerSoldNotif._id.toString(), seller._id);
    if (!dismissed) {
      throw new Error('Test 9 failed: notification not deleted.');
    }
    const checkDeleted = await Notification.findById(sellerSoldNotif._id);
    if (checkDeleted) {
      throw new Error('Test 9 failed: notification still present after deletion.');
    }
    console.log('✓ Test 9 Passed: Notification dismissal works cleanly.');

    // Cleanup test auction & bids
    await Auction.deleteOne({ _id: testAuction._id });
    await Bid.deleteMany({ auctionId: testAuction._id });
    await Transaction.deleteMany({ auctionId: testAuction._id });
    await Notification.deleteMany({ auctionId: testAuction._id });

    console.log('--- ALL NOTIFICATION SYSTEM INTEGRATION TESTS PASSED (9/9) ---');
    process.exit(0);
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
};

runTests();
