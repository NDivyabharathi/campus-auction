import http from 'http';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { connectDB } from '../config/db.js';
import { ENV } from '../config/env.js';
import { User } from '../models/User.js';

async function runApiTests() {
  console.log('--- TESTING ASSISTANT REST API ENDPOINTS ---');
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
    // 1. Unauthenticated request check
    const unauthRes = await fetch(`${baseUrl}/api/assistant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Find me a cycle' }),
    });

    assert(
      'Test 1: Unauthenticated chat request is rejected with 401',
      unauthRes.status === 401
    );

    // 2. Fetch authenticated test user
    const rahul = await User.findOne({ email: 'rahul.it@kongu.edu' });
    if (!rahul) {
      console.error('Seed user rahul not found!');
      process.exit(1);
    }

    const token = jwt.sign({ id: rahul._id.toString() }, ENV.JWT_SECRET, { expiresIn: '1d' });
    const authHeaders = {
      'Content-Type': 'application/json',
      Cookie: `token=${token}`,
    };

    // 3. Empty message validation
    const emptyRes = await fetch(`${baseUrl}/api/assistant/chat`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ message: '' }),
    });

    assert(
      'Test 2: Empty message rejected with 400',
      emptyRes.status === 400
    );

    // 4. Successful search query
    const searchRes = await fetch(`${baseUrl}/api/assistant/chat`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ message: 'Find a cycle under ₹2,000' }),
    });
    const searchBody = await searchRes.json();

    assert(
      'Test 3: Search query returns 200 with results and suggestions',
      searchRes.status === 200 &&
        searchBody.success === true &&
        Array.isArray(searchBody.results) &&
        searchBody.results.length > 0 &&
        Array.isArray(searchBody.followUpSuggestions),
      searchBody
    );

    // 5. Follow-up query using context
    const previousResultIds = searchBody.results.map((r: any) => r.id);
    const followUpRes = await fetch(`${baseUrl}/api/assistant/chat`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        message: 'Which one has the longest time remaining?',
        context: {
          previousSearch: searchBody.criteria,
          previousResultIds,
        },
      }),
    });
    const followUpBody = await followUpRes.json();

    assert(
      'Test 4: Follow-up query maintains context and returns refined items',
      followUpRes.status === 200 &&
        followUpBody.success === true &&
        followUpBody.intent === 'refine_search',
      followUpBody
    );

    // 6. Bid recommendation request
    const bidRes = await fetch(`${baseUrl}/api/assistant/chat`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ message: 'Suggest a bid for this calculator' }),
    });
    const bidBody = await bidRes.json();

    assert(
      'Test 5: Bid suggestion request returns recommendation object with minNextBid and explanation',
      bidRes.status === 200 &&
        bidBody.success === true &&
        bidBody.bidRecommendation !== null &&
        bidBody.bidRecommendation.minimumNextBid > 0 &&
        bidBody.bidRecommendation.explanation.length > 0,
      bidBody
    );

    // 7. Security: Verify no private fields (emails, password hashes) in response
    const bodyStr = JSON.stringify(searchBody);
    assert(
      'Test 6: Security check - No private emails or password hashes exposed',
      !bodyStr.includes('@kongu.edu') && !bodyStr.includes('passwordHash'),
      bodyStr
    );

    console.log(`\n========================================`);
    console.log(`API TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
  }

  process.exit(failed > 0 ? 1 : 0);
}

runApiTests().catch((err) => {
  console.error('API Test crashed:', err);
  process.exit(1);
});
