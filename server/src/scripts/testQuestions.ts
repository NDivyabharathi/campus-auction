import http from 'http';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { connectDB } from '../config/db.js';
import { ENV } from '../config/env.js';
import { User } from '../models/User.js';
import { Auction } from '../models/Auction.js';
import { Question } from '../models/Question.js';
import { Notification } from '../models/Notification.js';

async function runQuestionsTestSuite() {
  console.log('--- STARTING QUESTIONS & ANSWERS TEST SUITE ---');
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
    // 1. Setup test users
    const divya = await User.findOne({ email: 'divya.cse@kongu.edu' }); // Seller
    const rahul = await User.findOne({ email: 'rahul.it@kongu.edu' });   // Student Asker
    const priya = await User.findOne({ email: 'priya.ece@kongu.edu' });   // Peer Student Respondent

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

    // Find an active auction listed by Divya
    let activeAuction = await Auction.findOne({ sellerId: divya._id, status: 'active', closingAt: { $gt: new Date() } });
    if (!activeAuction) {
      activeAuction = await Auction.create({
        sellerId: divya._id,
        title: 'Casio Scientific Calculator Test QA',
        description: 'For testing Q&A feature functionality.',
        category: 'Electronics',
        condition: 'Good',
        startingPrice: 300,
        minimumBidIncrement: 20,
        closingAt: new Date(Date.now() + 24 * 3600 * 1000),
        status: 'active',
      });
    }

    // Clean any prior questions for this auction
    await Question.deleteMany({ auctionId: activeAuction._id });

    // Test 1: Unauthenticated request to ask question is rejected
    const unauthRes = await fetch(`${baseUrl}/api/auctions/${activeAuction._id}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Is this calculator allowed in semester exams?' }),
    });
    assert('Test 1: Unauthenticated question submission rejected with 401', unauthRes.status === 401);

    // Test 2: Empty or too short question is rejected
    const shortRes = await fetch(`${baseUrl}/api/auctions/${activeAuction._id}/questions`, {
      method: 'POST',
      headers: headersRahul,
      body: JSON.stringify({ text: 'hi' }),
    });
    assert('Test 2: Short question (< 3 chars) rejected with 400', shortRes.status === 400);

    // Test 3: Oversized question (> 500 chars) is rejected
    const longRes = await fetch(`${baseUrl}/api/auctions/${activeAuction._id}/questions`, {
      method: 'POST',
      headers: headersRahul,
      body: JSON.stringify({ text: 'a'.repeat(501) }),
    });
    assert('Test 3: Oversized question (> 500 chars) rejected with 400', longRes.status === 400);

    // Test 4: Authenticated student asks a valid question
    const qText = 'Does the slide cover lock securely and are the solar cells working?';
    const askRes = await fetch(`${baseUrl}/api/auctions/${activeAuction._id}/questions`, {
      method: 'POST',
      headers: headersRahul,
      body: JSON.stringify({ text: qText }),
    });
    const askBody: any = await askRes.json();
    assert(
      'Test 4: Rahul successfully submits question on Divya’s auction',
      askRes.status === 201 && askBody.success === true && askBody.question.text === qText,
      askBody
    );
    const question1Id = askBody.question._id;

    // Test 5: Seller receives in-app notification about the new question
    const sellerNotif = await Notification.findOne({
      recipientId: divya._id,
      type: 'question_asked',
      auctionId: activeAuction._id,
    });
    assert(
      'Test 5: Seller (Divya) receives a notification for the question',
      sellerNotif !== null && sellerNotif.type === 'question_asked',
      sellerNotif
    );

    // Test 6: An unanswered question can be edited by its author
    const updatedText = 'Does the slide cover lock securely and does it have original box?';
    const editRes = await fetch(`${baseUrl}/api/questions/${question1Id}`, {
      method: 'PATCH',
      headers: headersRahul,
      body: JSON.stringify({ text: updatedText }),
    });
    const editBody: any = await editRes.json();
    assert(
      'Test 6: Author (Rahul) can edit unanswered question',
      editRes.status === 200 && editBody.success === true && editBody.question.text === updatedText,
      editBody
    );

    // Test 7: Another student (Priya) CANNOT edit Rahul's question
    const unauthorizedEditRes = await fetch(`${baseUrl}/api/questions/${question1Id}`, {
      method: 'PATCH',
      headers: headersPriya,
      body: JSON.stringify({ text: 'Malicious modification attempt' }),
    });
    assert('Test 7: Other student cannot edit another’s question (403)', unauthorizedEditRes.status === 403);

    // Test 8: Another student (Priya) CANNOT delete Rahul's question
    const unauthorizedDelRes = await fetch(`${baseUrl}/api/questions/${question1Id}`, {
      method: 'DELETE',
      headers: headersPriya,
    });
    assert('Test 8: Other student cannot delete another’s question (403)', unauthorizedDelRes.status === 403);

    // Test 9: Seller (Divya) answers the question (Role: Seller Answer)
    const sellerAnsText = 'Yes, the slide cover clicks tightly and the solar panel charges in room light.';
    const sellerAnsRes = await fetch(`${baseUrl}/api/questions/${question1Id}/answers`, {
      method: 'POST',
      headers: headersDivya,
      body: JSON.stringify({ text: sellerAnsText }),
    });
    const sellerAnsBody: any = await sellerAnsRes.json();
    assert(
      'Test 9: Seller (Divya) posts answer with correct seller badge',
      sellerAnsRes.status === 201 &&
        sellerAnsBody.success === true &&
        sellerAnsBody.question.answers.length === 1 &&
        sellerAnsBody.question.answers[0].isSeller === true,
      sellerAnsBody
    );

    // Test 10: Another student (Priya) answers the question (Role: Student Answer)
    const studentAnsText = 'I have the same model; it is approved for Anna University & Kongu autonomous exams.';
    const studentAnsRes = await fetch(`${baseUrl}/api/questions/${question1Id}/answers`, {
      method: 'POST',
      headers: headersPriya,
      body: JSON.stringify({ text: studentAnsText }),
    });
    const studentAnsBody: any = await studentAnsRes.json();
    assert(
      'Test 10: Peer student (Priya) posts answer with student badge (isSeller = false)',
      studentAnsRes.status === 201 &&
        studentAnsBody.question.answers.length === 2 &&
        studentAnsBody.question.answers[1].isSeller === false,
      studentAnsBody
    );

    // Test 11: Question author receives notification when answered
    const askerNotif = await Notification.findOne({
      recipientId: rahul._id,
      type: 'answer_received',
      auctionId: activeAuction._id,
    });
    assert(
      'Test 11: Question author (Rahul) receives notification when answer is posted',
      askerNotif !== null && (askerNotif.type === 'answer_received' || askerNotif.title.includes('replied')),
      askerNotif
    );

    // Test 12: Question CANNOT be edited once it has answers
    const blockedEditRes = await fetch(`${baseUrl}/api/questions/${question1Id}`, {
      method: 'PATCH',
      headers: headersRahul,
      body: JSON.stringify({ text: 'Trying to edit after answers are present' }),
    });
    assert('Test 12: Question cannot be edited once answers exist (400)', blockedEditRes.status === 400);

    // Test 13: Question CANNOT be deleted once it has answers
    const blockedDelRes = await fetch(`${baseUrl}/api/questions/${question1Id}`, {
      method: 'DELETE',
      headers: headersRahul,
    });
    assert('Test 13: Question cannot be deleted once answers exist (400)', blockedDelRes.status === 400);

    // Test 14: Create a second question and verify author can delete it while unanswered
    const q2Res = await fetch(`${baseUrl}/api/auctions/${activeAuction._id}/questions`, {
      method: 'POST',
      headers: headersRahul,
      body: JSON.stringify({ text: 'Temporary test question to delete' }),
    });
    const q2Body: any = await q2Res.json();
    const q2Id = q2Body.question._id;

    const delRes = await fetch(`${baseUrl}/api/questions/${q2Id}`, {
      method: 'DELETE',
      headers: headersRahul,
    });
    assert('Test 14: Author can delete unanswered question (200)', delRes.status === 200);

    // Verify q2 is gone
    const verifyDel = await Question.findById(q2Id);
    assert('Test 15: Deleted question no longer exists in MongoDB', verifyDel === null);

    // Test 16: Public GET endpoint returns questions with author roles
    const getRes = await fetch(`${baseUrl}/api/auctions/${activeAuction._id}/questions`);
    const getBody: any = await getRes.json();
    assert(
      'Test 16: Public GET returns discussions with populated authors & answers',
      getRes.status === 200 &&
        getBody.success === true &&
        getBody.questions.length === 1 &&
        getBody.questions[0].answers.length === 2,
      getBody
    );

    // Test 17: Closed auction disables new questions and answers
    const closedAuction = await Auction.create({
      sellerId: divya._id,
      title: 'Closed Auction for Testing Q&A Blocking',
      description: 'Closed test auction.',
      category: 'Electronics',
      condition: 'Good',
      startingPrice: 500,
      minimumBidIncrement: 50,
      closingAt: new Date(Date.now() - 3600 * 1000), // Ended 1 hour ago
      status: 'sold',
    });

    const closedQuestionRes = await fetch(`${baseUrl}/api/auctions/${closedAuction._id}/questions`, {
      method: 'POST',
      headers: headersRahul,
      body: JSON.stringify({ text: 'Will this be accepted on closed auction?' }),
    });
    assert('Test 17: New questions rejected on closed auction (400)', closedQuestionRes.status === 400);

    await Auction.deleteOne({ _id: closedAuction._id });

    console.log(`\n========================================`);
    console.log(`Q&A TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
  }

  process.exit(failed > 0 ? 1 : 0);
}

runQuestionsTestSuite().catch((err) => {
  console.error('Q&A Test suite crashed:', err);
  process.exit(1);
});
