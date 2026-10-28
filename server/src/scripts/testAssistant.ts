import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Auction } from '../models/Auction.js';
import {
  parseNaturalLanguageQuery,
  executeAuctionSearch,
  getBidRecommendation,
  processAssistantMessage,
} from '../services/assistantService.js';

async function runAssistantTests() {
  console.log('--- STARTING ASSISTANT TEST SUITE ---');
  await connectDB();

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

  // 1. Natural Language Parser Unit Tests
  console.log('\n--- 1. Testing NLP Query Parser ---');

  // Test 1: Cycle under ₹2,000
  const q1 = parseNaturalLanguageQuery('Find me a cycle under ₹2,000.');
  assert(
    'Query 1: Extracts Cycles category and maxPrice 2000',
    q1.criteria.category === 'Cycles and Transportation' && q1.criteria.maxPrice === 2000,
    q1
  );

  // Test 2: Scientific calculators below ₹400
  const q2 = parseNaturalLanguageQuery('Show scientific calculators below ₹400.');
  assert(
    'Query 2: Extracts Electronics category, calculator keyword, and maxPrice 400',
    q2.criteria.category === 'Electronics' &&
      q2.criteria.searchKeyword === 'calculator' &&
      q2.criteria.maxPrice === 400,
    q2
  );

  // Test 3: Good-condition textbook under ₹300
  const q3 = parseNaturalLanguageQuery('Find a good-condition textbook under ₹300.');
  assert(
    'Query 3: Extracts Books category, Good condition, and maxPrice 300',
    q3.criteria.category === 'Books and Study Materials' &&
      q3.criteria.condition === 'Good' &&
      q3.criteria.maxPrice === 300,
    q3
  );

  // Test 4: Items ending soon
  const q4 = parseNaturalLanguageQuery('What items are ending soon?');
  assert(
    'Query 4: Recognizes ending_soon sort preference',
    q4.criteria.sortBy === 'ending_soon',
    q4
  );

  // Test 5: Hostel essentials under ₹500
  const q5 = parseNaturalLanguageQuery('Find something useful for hostel life under ₹500.');
  assert(
    'Query 5: Recognizes Hostel Essentials category and maxPrice 500',
    q5.criteria.category === 'Hostel Essentials' && q5.criteria.maxPrice === 500,
    q5
  );

  // Test 6: Cycles not ending in the next 10 minutes
  const q6 = parseNaturalLanguageQuery('Show cycles that aren’t ending in the next ten minutes.');
  assert(
    'Query 6: Recognizes closingAfter condition > 9 minutes in the future',
    q6.criteria.category === 'Cycles and Transportation' &&
      q6.criteria.closingAfter !== undefined &&
      q6.criteria.closingAfter.getTime() > Date.now() + 9 * 60 * 1000,
    q6
  );

  // Test 7: Contextual refinement (Which one has longest time remaining?)
  const q7 = parseNaturalLanguageQuery('Which one has the longest time remaining?', {
    previousSearch: { category: 'Cycles and Transportation', maxPrice: 2000 },
    previousResultIds: ['dummy1', 'dummy2'],
  });
  assert(
    'Query 7: Refines previous search with ending_later sort',
    q7.isFollowUp === true &&
      q7.criteria.category === 'Cycles and Transportation' &&
      q7.criteria.sortBy === 'ending_later',
    q7
  );

  // Test 8: Contextual refinement (Show the cheapest one)
  const q8 = parseNaturalLanguageQuery('Show the cheapest one', {
    previousSearch: { category: 'Cycles and Transportation', maxPrice: 2000 },
    previousResultIds: ['dummy1', 'dummy2'],
  });
  assert(
    'Query 8: Refines previous search with price_asc sort',
    q8.isFollowUp === true && q8.criteria.sortBy === 'price_asc',
    q8
  );

  // Test 9: Contextual refinement (Only show good-condition ones)
  const q9 = parseNaturalLanguageQuery('Only show good-condition ones', {
    previousSearch: { category: 'Books and Study Materials' },
    previousResultIds: ['dummy1'],
  });
  assert(
    'Query 9: Merges condition: Good into previous Books search',
    q9.isFollowUp === true &&
      q9.criteria.category === 'Books and Study Materials' &&
      q9.criteria.condition === 'Good',
    q9
  );

  // Test 10: Bid recommendation intent
  const q10 = parseNaturalLanguageQuery('Can you suggest a valid bid for this calculator?');
  assert(
    'Query 10: Recognizes suggest_bid intent and calculator keyword',
    q10.intent === 'suggest_bid' && q10.targetAuctionKeyword === 'calculator',
    q10
  );

  // 2. Real Database Integration Tests
  console.log('\n--- 2. Testing Database Search Execution ---');

  const divya = await User.findOne({ email: 'divya.cse@kongu.edu' });
  const rahul = await User.findOne({ email: 'rahul.it@kongu.edu' });

  if (!divya || !rahul) {
    console.error('Seed users not found! Run seed script first.');
    process.exit(1);
  }

  // Test 11: Real DB query for cycles
  const cycleSearch = await executeAuctionSearch(divya._id.toString(), {
    category: 'Cycles and Transportation',
    maxPrice: 2000,
  });
  assert(
    'Query 11: Real DB search returns matching cycles and valid matchReason',
    cycleSearch.results.length > 0 &&
      cycleSearch.results[0].category === 'Cycles and Transportation' &&
      cycleSearch.results[0].matchReason.length > 0,
    cycleSearch
  );

  // Test 12: Exclude current user's own listing
  // divya created the Casio calculator listing
  const divyaCalcSearch = await executeAuctionSearch(divya._id.toString(), {
    category: 'Electronics',
    searchKeyword: 'calculator',
  });
  assert(
    "Query 12: Seller's own listings are excluded from recommendations",
    divyaCalcSearch.results.every((r) => r.title !== 'Casio fx-991EX ClassWiz Scientific Calculator'),
    divyaCalcSearch
  );

  // However, rahul SHOULD see divya's calculator
  const rahulCalcSearch = await executeAuctionSearch(rahul._id.toString(), {
    category: 'Electronics',
    searchKeyword: 'calculator',
  });
  assert(
    "Query 13: Other buyers can find the listing",
    rahulCalcSearch.results.some((r) => r.title.includes('Calculator')),
    rahulCalcSearch
  );

  // Test 14: Bid recommendation logic with live data
  const calcAuction = await Auction.findOne({ title: /Casio fx-991EX/ });
  if (calcAuction) {
    const bidRec = await getBidRecommendation(rahul._id.toString(), 'calculator');
    assert(
      'Query 14: Calculates minimum valid next bid (currentLeadingBid + minIncrement)',
      bidRec.recommendation !== null &&
        bidRec.recommendation.minimumNextBid ===
          calcAuction.currentLeadingBid + calcAuction.minimumBidIncrement,
      bidRec
    );
  }

  // Test 15: Bid recommendation for 0-bid auction (should equal startingPrice)
  const mathBook = await Auction.findOne({ title: /Engineering Mathematics/ });
  if (mathBook) {
    const rec0 = await getBidRecommendation(divya._id.toString(), undefined, {
      currentAuctionId: mathBook._id.toString(),
    });
    assert(
      'Query 15: For 0 bids, minimumNextBid equals startingPrice',
      rec0.recommendation !== null &&
        rec0.recommendation.minimumNextBid === mathBook.startingPrice &&
        rec0.recommendation.bidCount === 0,
      rec0
    );
  }

  // Test 16: End-to-end processAssistantMessage
  const fullFlow = await processAssistantMessage(rahul._id.toString(), 'Find a cycle under ₹2,000');
  assert(
    'Query 16: Full message pipeline returns truthful reply, results, and follow-up suggestions',
    fullFlow.results.length > 0 &&
      fullFlow.followUpSuggestions.length > 0 &&
      fullFlow.reply.length > 0,
    fullFlow
  );

  console.log(`\n========================================`);
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runAssistantTests().catch((err) => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
