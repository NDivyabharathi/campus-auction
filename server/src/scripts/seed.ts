import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Auction } from '../models/Auction.js';
import { Bid } from '../models/Bid.js';
import { Transaction } from '../models/Transaction.js';
import { Notification } from '../models/Notification.js';

const DEMO_PASSWORD = 'kongupassword123';

export const seedDatabase = async () => {
  try {
    await connectDB();
    console.log('[Seed] Starting Campus Auction database seed for Kongu Engineering College...');

    // Clear existing collections
    await User.deleteMany({});
    await Auction.deleteMany({});
    await Bid.deleteMany({});
    await Transaction.deleteMany({});
    await Notification.deleteMany({});
    console.log('[Seed] Cleared existing demo data.');

    // 1. Create Student Accounts
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

    const studentsData = [
      {
        fullName: 'Divyabharathi N',
        email: 'divya.cse@kongu.edu',
        passwordHash,
        department: 'CSE',
        year: 3,
      },
      {
        fullName: 'Rahul S',
        email: 'rahul.it@kongu.edu',
        passwordHash,
        department: 'IT',
        year: 2,
      },
      {
        fullName: 'Priya K',
        email: 'priya.ece@kongu.edu',
        passwordHash,
        department: 'ECE',
        year: 3,
      },
      {
        fullName: 'Karthik M',
        email: 'karthik.mech@kongu.edu',
        passwordHash,
        department: 'MECH',
        year: 4,
      },
      {
        fullName: 'Sneha R',
        email: 'sneha.aids@kongu.edu',
        passwordHash,
        department: 'AIDS',
        year: 1,
      },
    ];

    const users = await User.insertMany(studentsData);
    const [divya, rahul, priya, karthik, sneha] = users;
    console.log(`[Seed] Created ${users.length} student accounts.`);

    const now = Date.now();

    // 2. Create Diverse Auction Listings
    // Listing 1: Active with competitive bids
    const calc = await Auction.create({
      sellerId: divya._id,
      title: 'Casio fx-991EX ClassWiz Scientific Calculator',
      description: 'Used for Engineering Mathematics & Physics. Original condition with slide cover, solar battery working perfectly.',
      category: 'Electronics',
      condition: 'Like New',
      startingPrice: 300,
      minimumBidIncrement: 20,
      closingAt: new Date(now + 2 * 24 * 60 * 60 * 1000), // 2 days
      status: 'active',
      currentLeadingBid: 420,
      currentLeadingBidderId: priya._id,
      bidCount: 4,
      imageUrls: [
        'https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1611117765276-6c84c1f3cf9f?auto=format&fit=crop&w=800&q=80',
      ],
    });

    await Bid.create([
      { auctionId: calc._id, bidderId: rahul._id, amount: 300, createdAt: new Date(now - 10 * 3600 * 1000) },
      { auctionId: calc._id, bidderId: priya._id, amount: 340, createdAt: new Date(now - 8 * 3600 * 1000) },
      { auctionId: calc._id, bidderId: karthik._id, amount: 380, createdAt: new Date(now - 4 * 3600 * 1000) },
      { auctionId: calc._id, bidderId: priya._id, amount: 420, createdAt: new Date(now - 1 * 3600 * 1000) },
    ]);

    // Listing 2: Campus Cycle (Active, Ending Soon in 45 mins)
    const cycle = await Auction.create({
      sellerId: karthik._id,
      title: 'Hero Sprint 26T Campus Bicycle with Front Basket',
      description: 'Reliable campus cycle used between Kaveri Hostel and Mechanical Block. Serviced last month with new brake pads and bell.',
      category: 'Cycles and Transportation',
      condition: 'Good',
      startingPrice: 1500,
      minimumBidIncrement: 100,
      closingAt: new Date(now + 45 * 60 * 1000), // 45 minutes
      status: 'active',
      currentLeadingBid: 1800,
      currentLeadingBidderId: rahul._id,
      bidCount: 2,
      imageUrls: [
        'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80',
      ],
    });

    await Bid.create([
      { auctionId: cycle._id, bidderId: divya._id, amount: 1500, createdAt: new Date(now - 5 * 3600 * 1000) },
      { auctionId: cycle._id, bidderId: rahul._id, amount: 1800, createdAt: new Date(now - 2 * 3600 * 1000) },
    ]);

    // Listing 3: Active with 0 bids (Starting price display test)
    await Auction.create({
      sellerId: priya._id,
      title: 'Higher Engineering Mathematics - B.S. Grewal (44th Ed)',
      description: 'Clean textbook with no markings. Essential for all 1st and 2nd year engineering students across all branches.',
      category: 'Books and Study Materials',
      condition: 'Good',
      startingPrice: 280,
      minimumBidIncrement: 20,
      closingAt: new Date(now + 4 * 24 * 60 * 60 * 1000),
      status: 'active',
      currentLeadingBid: 0,
      currentLeadingBidderId: null,
      bidCount: 0,
      imageUrls: [
        'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
      ],
    });

    // Listing 4: Electronics - Arduino Kit (Active)
    const arduino = await Auction.create({
      sellerId: rahul._id,
      title: 'Arduino Uno R3 Ultimate Starter Kit with Sensors',
      description: 'Includes Arduino Uno, breadboard, ultrasonic sensor, IR sensor, servo motor, LEDs, resistors, and jumper wires in plastic box.',
      category: 'Electronics',
      condition: 'Like New',
      startingPrice: 650,
      minimumBidIncrement: 50,
      closingAt: new Date(now + 3 * 24 * 60 * 60 * 1000),
      status: 'active',
      currentLeadingBid: 750,
      currentLeadingBidderId: sneha._id,
      bidCount: 2,
      imageUrls: [
        'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
      ],
    });

    await Bid.create([
      { auctionId: arduino._id, bidderId: priya._id, amount: 650, createdAt: new Date(now - 12 * 3600 * 1000) },
      { auctionId: arduino._id, bidderId: sneha._id, amount: 750, createdAt: new Date(now - 3 * 3600 * 1000) },
    ]);

    // Listing 5: Laboratory Equipment - Mini Drafter (Reserved, Awaiting Handover)
    const drafter = await Auction.create({
      sellerId: karthik._id,
      title: 'Omega Engineering Mini Drafter & Full Imperial Board',
      description: 'High precision mini drafter with clamp, scales, and waterproof carry bag. Ideal for 1st year Engineering Graphics.',
      category: 'Laboratory Equipment',
      condition: 'Good',
      startingPrice: 450,
      minimumBidIncrement: 30,
      closingAt: new Date(now - 2 * 3600 * 1000), // Ended 2 hours ago
      status: 'reserved',
      currentLeadingBid: 540,
      currentLeadingBidderId: sneha._id,
      bidCount: 3,
      imageUrls: [
        'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
      ],
    });

    await Bid.create([
      { auctionId: drafter._id, bidderId: rahul._id, amount: 450, createdAt: new Date(now - 14 * 3600 * 1000) },
      { auctionId: drafter._id, bidderId: divya._id, amount: 480, createdAt: new Date(now - 10 * 3600 * 1000) },
      { auctionId: drafter._id, bidderId: sneha._id, amount: 540, createdAt: new Date(now - 3 * 3600 * 1000) },
    ]);

    // Create reservation transaction for drafter
    await Transaction.create({
      auctionId: drafter._id,
      sellerId: karthik._id,
      buyerId: sneha._id,
      amount: 540,
      status: 'handover_scheduled',
      handoverLocation: 'Convention Center Main Lobby',
      handoverDateTime: new Date(now + 18 * 3600 * 1000),
      handoverNotes: 'Will bring the drafter in black bag after 4:30 PM lab classes.',
      reservationDeadline: new Date(now + 22 * 3600 * 1000),
      attemptNumber: 1,
    });

    // Listing 6: Hostel Essentials - Electric Kettle (Completed Handover)
    const kettle = await Auction.create({
      sellerId: sneha._id,
      title: 'Prestige 1.5L Stainless Steel Electric Kettle',
      description: 'Fast boiling auto cut-off electric kettle used in ladies hostel. Perfect for hot water, tea, and noodles.',
      category: 'Hostel Essentials',
      condition: 'Good',
      startingPrice: 350,
      minimumBidIncrement: 25,
      closingAt: new Date(now - 24 * 3600 * 1000),
      status: 'sold',
      currentLeadingBid: 425,
      currentLeadingBidderId: divya._id,
      bidCount: 2,
      imageUrls: [
        'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
      ],
    });

    await Bid.create([
      { auctionId: kettle._id, bidderId: priya._id, amount: 350, createdAt: new Date(now - 30 * 3600 * 1000) },
      { auctionId: kettle._id, bidderId: divya._id, amount: 425, createdAt: new Date(now - 25 * 3600 * 1000) },
    ]);

    await Transaction.create({
      auctionId: kettle._id,
      sellerId: sneha._id,
      buyerId: divya._id,
      amount: 425,
      status: 'completed',
      handoverLocation: 'Ladies Hostel Gate 1',
      handoverDateTime: new Date(now - 12 * 3600 * 1000),
      handoverNotes: 'Exchanged near hostel security desk.',
      sellerConfirmedAt: new Date(now - 11 * 3600 * 1000),
      buyerConfirmedAt: new Date(now - 11 * 3600 * 1000),
      reservationDeadline: new Date(now),
      attemptNumber: 1,
    });

    // 4. Seed sample notifications for demo evaluation
    await Notification.create([
      {
        recipientId: divya._id,
        type: 'bid_received',
        title: 'New Bid of ₹420',
        message: 'Priya K placed a bid of ₹420 on your listing "Casio fx-991EX ClassWiz Scientific Calculator".',
        auctionId: calc._id,
        actorId: priya._id,
        readAt: null, // Unread alert for Divya
        createdAt: new Date(now - 1 * 3600 * 1000),
      },
      {
        recipientId: rahul._id,
        type: 'outbid',
        title: "You've been outbid!",
        message: 'Someone placed a higher bid of ₹340 on "Casio fx-991EX ClassWiz Scientific Calculator".',
        auctionId: calc._id,
        actorId: priya._id,
        readAt: null, // Unread alert for Rahul
        createdAt: new Date(now - 8 * 3600 * 1000),
      },
      {
        recipientId: sneha._id,
        type: 'auction_won',
        title: 'You Won the Auction! 🎉',
        message: 'Congratulations! You won "Omega Engineering Mini Drafter & Full Imperial Board" for ₹540.',
        auctionId: drafter._id,
        actorId: karthik._id,
        readAt: null, // Unread alert for Sneha
        createdAt: new Date(now - 2 * 3600 * 1000),
      },
      {
        recipientId: divya._id,
        type: 'transaction_completed',
        title: 'Handover Completed! 🎉',
        message: 'Physical handover for "Prestige 1.5L Stainless Steel Electric Kettle" is completed. Enjoy your item!',
        auctionId: kettle._id,
        actorId: sneha._id,
        readAt: new Date(now - 10 * 3600 * 1000), // Read
        createdAt: new Date(now - 11 * 3600 * 1000),
      },
      {
        recipientId: rahul._id,
        type: 'auction_ending_soon',
        title: 'Auction Ending Soon (< 45 mins)',
        message: '"Hero Sprint 26T Campus Bicycle with Front Basket" is in its final hour! Current leading bid is ₹1800.',
        auctionId: cycle._id,
        readAt: null, // Unread alert for Rahul
        createdAt: new Date(now - 10 * 60 * 1000),
      },
    ]);

    console.log('[Seed] Database successfully seeded with 5 Kongu students, 6 varied auctions, bids, transactions, and notifications!');
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error] Failed to seed database:', error);
    process.exit(1);
  }
};

seedDatabase();
