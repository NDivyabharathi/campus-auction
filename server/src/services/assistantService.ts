import mongoose from 'mongoose';
import { Auction, IAuction, AuctionCategory, ItemCondition } from '../models/Auction.js';

export interface ParsedSearchCriteria {
  category?: AuctionCategory;
  searchKeyword?: string;
  maxPrice?: number;
  minPrice?: number;
  condition?: ItemCondition;
  conditionExclude?: ItemCondition;
  closingBefore?: Date;
  closingAfter?: Date;
  sortBy?: 'price_asc' | 'price_desc' | 'ending_soon' | 'ending_later' | 'most_active';
}

export interface AssistantContext {
  previousSearch?: ParsedSearchCriteria;
  previousResultIds?: string[];
  currentAuctionId?: string;
}

export interface AssistantItemResult {
  id: string;
  title: string;
  category: AuctionCategory;
  condition: ItemCondition;
  startingPrice: number;
  currentLeadingBid: number;
  minimumNextBid: number;
  bidCount: number;
  closingAt: string;
  imageUrl?: string;
  matchReason: string;
}

export interface BidRecommendation {
  auctionId: string;
  title: string;
  category: string;
  startingPrice: number;
  currentLeadingBid: number;
  minimumBidIncrement: number;
  bidCount: number;
  minimumNextBid: number;
  explanation: string;
}

export interface AssistantResponseData {
  reply: string;
  intent: 'search_auctions' | 'refine_search' | 'suggest_bid' | 'greeting' | 'clarification';
  criteria?: ParsedSearchCriteria;
  results: AssistantItemResult[];
  bidRecommendation?: BidRecommendation | null;
  followUpSuggestions: string[];
}

/**
 * Valid categories and conditions matching schema
 */
const VALID_CATEGORIES: AuctionCategory[] = [
  'Books and Study Materials',
  'Electronics',
  'Cycles and Transportation',
  'Hostel Essentials',
  'Clothing and Accessories',
  'Sports Equipment',
  'Laboratory Equipment',
  'Other',
];

const VALID_CONDITIONS: ItemCondition[] = ['New', 'Like New', 'Good', 'Fair', 'Heavily Used'];

/**
 * Category detection patterns
 */
const CATEGORY_PATTERNS: { regex: RegExp; category: AuctionCategory; keyword?: string }[] = [
  // Cycles & Transportation
  { regex: /\b(cycles?|bicycles?|bikes?|transport(?:ation)?|scooters?)\b/i, category: 'Cycles and Transportation', keyword: 'cycle' },
  // Electronics
  { regex: /\b(calculators?|scientific calculators?|fx-991\w*|casio|laptops?|chargers?|headphones?|earbuds?|phones?|mobiles?|arduinos?|gadgets?|monitors?|keyboards?|mou?se)\b/i, category: 'Electronics' },
  // Books & Study Materials
  { regex: /\b(books?|textbooks?|stud(?:y|ies)|notes?|grewal|engineering mathematics|exam guides?|syllabus)\b/i, category: 'Books and Study Materials', keyword: 'book' },
  // Hostel Essentials
  { regex: /\b(hostels?|hostel essentials?|kettles?|electric kettles?|mattress(?:es)?|bedsheets?|buckets?|room tables?|bed desks?|iron box(?:es)?|pillows?)\b/i, category: 'Hostel Essentials', keyword: 'hostel' },
  // Clothing & Accessories
  { regex: /\b(cloth(?:ing|es)|shirts?|t-shirts?|jackets?|hoodies?|shoes?|sneakers?|pants?|formals?)\b/i, category: 'Clothing and Accessories' },
  // Sports Equipment
  { regex: /\b(sports?|crickets?|badmintons?|footballs?|gym|dumbbells?|rackets?|shuttles?|sports equipment)\b/i, category: 'Sports Equipment' },
  // Laboratory Equipment
  { regex: /\b(labs?|laborator(?:y|ies)|drafters?|mini drafters?|drawing boards?|aprons?|multimeters?|breadboards?|lab equipment)\b/i, category: 'Laboratory Equipment', keyword: 'drafter' },
];

/**
 * Parse currency strings like "₹2,000", "2k", "400 rupees", "1.5k" into numbers
 */
function parseRupeeAmount(valStr: string, multiplierStr?: string): number | undefined {
  if (!valStr) return undefined;
  const cleanStr = valStr.replace(/,/g, '').trim();
  let val = parseFloat(cleanStr);
  if (isNaN(val) || val <= 0) return undefined;

  if (multiplierStr) {
    const mult = multiplierStr.toLowerCase().trim();
    if (mult === 'k' || mult.startsWith('thous')) {
      val = val * 1000;
    }
  }
  return Math.round(val);
}

/**
 * Extract max price from natural query
 */
function extractMaxPrice(text: string): number | undefined {
  // e.g. "under ₹2,000", "below 400 rupees", "less than 500", "max budget 1500", "within 800", "budget 2k", "at most 1000"
  const maxPriceRegexes = [
    /(?:under|below|less than|max(?:imum)?(?: budget)?|within|cheaper than|at most|up to)\s*(?:₹|rs\.?|inr)?\s*([0-9]+(?:,[0-9]+)?(?:\.[0-9]+)?)\s*(k|thousand|rupees|rs)?\b/i,
    /(?:₹|rs\.?|inr)\s*([0-9]+(?:,[0-9]+)?(?:\.[0-9]+)?)\s*(k|thousand)?\s*(?:or less|budget|max|limit)\b/i,
  ];

  for (const rx of maxPriceRegexes) {
    const match = text.match(rx);
    if (match) {
      const parsed = parseRupeeAmount(match[1], match[2]);
      if (parsed !== undefined) return parsed;
    }
  }
  return undefined;
}

/**
 * Extract min price from natural query
 */
function extractMinPrice(text: string): number | undefined {
  // e.g. "above ₹200", "more than 500", "at least 300", "over 1000"
  const minPriceRegexes = [
    /(?:above|more than|at least|greater than|min(?:imum)?|over)\s*(?:₹|rs\.?|inr)?\s*([0-9]+(?:,[0-9]+)?(?:\.[0-9]+)?)\s*(k|thousand|rupees|rs)?\b/i,
  ];

  for (const rx of minPriceRegexes) {
    const match = text.match(rx);
    if (match) {
      const parsed = parseRupeeAmount(match[1], match[2]);
      if (parsed !== undefined) return parsed;
    }
  }
  return undefined;
}

/**
 * Extract condition preference
 */
function extractCondition(text: string): { condition?: ItemCondition; conditionExclude?: ItemCondition } {
  // Check negative condition first: "not heavily used", "not used roughly"
  if (/not (?:heavily used|bad|broken)/i.test(text)) {
    return { conditionExclude: 'Heavily Used' };
  }

  if (/\b(like new|almost new|mint)\b/i.test(text)) {
    return { condition: 'Like New' };
  }
  if (/\b(brand new|new)\b/i.test(text) && !/what(?:'s| is) new/i.test(text)) {
    return { condition: 'New' };
  }
  if (/\b(good condition|in good condition|decent|good)\b/i.test(text)) {
    return { condition: 'Good' };
  }
  if (/\b(fair condition|fair)\b/i.test(text)) {
    return { condition: 'Fair' };
  }
  if (/\b(heavily used)\b/i.test(text)) {
    return { condition: 'Heavily Used' };
  }

  return {};
}

/**
 * Extract time constraints
 */
function extractTimeConstraints(text: string): {
  closingBefore?: Date;
  closingAfter?: Date;
  timeSort?: 'ending_soon' | 'ending_later';
} {
  const now = Date.now();

  // "ending soonest" / "ending soon"
  if (/\b(ending soon|ending soonest|closes soon|ending quick)\b/i.test(text)) {
    return { timeSort: 'ending_soon' };
  }

  // "longest time remaining", "ending later", "ending last"
  if (/\b(longest time|most time remaining|ending later|ending last|more time)\b/i.test(text)) {
    return { timeSort: 'ending_later' };
  }

  // "not ending in the next ten minutes", "more than 10 minutes", "aren't ending in the next ten minutes"
  const notEndingMatch = text.match(/(?:not|isn['’]?t|aren['’]?t|won['’]?t be)\s+ending\s+in\s+(?:the\s+)?next\s+(\d+|ten)\s+minutes?/i);
  if (notEndingMatch) {
    const mins = notEndingMatch[1].toLowerCase() === 'ten' ? 10 : parseInt(notEndingMatch[1], 10);
    return { closingAfter: new Date(now + (mins || 10) * 60 * 1000) };
  }

  // "more than 10 minutes remaining"
  if (/\b(?:more than|at least)\s+(\d+|ten)\s+minutes?(?:\s+remaining)?\b/i.test(text)) {
    const minsMatch = text.match(/\b(?:more than|at least)\s+(\d+|ten)\s+minutes?/i);
    const mins = minsMatch && minsMatch[1].toLowerCase() === 'ten' ? 10 : parseInt(minsMatch ? minsMatch[1] : '10', 10);
    return { closingAfter: new Date(now + (mins || 10) * 60 * 1000) };
  }

  // "more than one hour remaining", "more than 1 hour"
  if (/\b(more than (?:1|one) hour|longer than (?:1|one) hour)\b/i.test(text)) {
    return { closingAfter: new Date(now + 60 * 60 * 1000) };
  }

  // "ending today"
  if (/\b(ending today|closes today)\b/i.test(text)) {
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    return { closingBefore: endOfDay, timeSort: 'ending_soon' };
  }

  // "ending tomorrow"
  if (/\b(ending tomorrow|closes tomorrow)\b/i.test(text)) {
    const endOfTomorrow = new Date();
    endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
    endOfTomorrow.setHours(23, 59, 59, 999);
    return { closingBefore: endOfTomorrow, timeSort: 'ending_soon' };
  }

  return {};
}

/**
 * Extract sorting preference
 */
function extractSortPreference(text: string): 'price_asc' | 'price_desc' | 'ending_soon' | 'ending_later' | 'most_active' | undefined {
  if (/\b(cheapest|lowest price|lowest current bid|lowest bid|least expensive|affordable)\b/i.test(text)) {
    return 'price_asc';
  }
  if (/\b(highest price|most expensive|highest bid)\b/i.test(text)) {
    return 'price_desc';
  }
  if (/\b(most active|most bids|popular|most contested|hot)\b/i.test(text)) {
    return 'most_active';
  }
  if (/\b(longest time remaining|ending later|ending last)\b/i.test(text)) {
    return 'ending_later';
  }
  if (/\b(ending soon|ending soonest|closing soon|urgent)\b/i.test(text)) {
    return 'ending_soon';
  }
  return undefined;
}

/**
 * Natural Language Parser for student auction queries
 */
export function parseNaturalLanguageQuery(
  rawMessage: string,
  context?: AssistantContext
): {
  intent: 'search_auctions' | 'refine_search' | 'suggest_bid' | 'greeting' | 'clarification';
  criteria: ParsedSearchCriteria;
  targetAuctionKeyword?: string;
  isFollowUp: boolean;
} {
  const text = rawMessage.trim().replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  const lower = text.toLowerCase();

  // 1. Detect Greeting
  if (/^(hi|hello|hey|greetings|hola|good morning|good afternoon|good evening|sup|yo)[\s!.]*$/i.test(lower)) {
    return {
      intent: 'greeting',
      criteria: {},
      isFollowUp: false,
    };
  }

  // 2. Detect Bid Recommendation request
  // e.g. "Suggest a bid for this calculator", "What should I bid", "Can you suggest a valid bid for this calculator?"
  if (/\b(suggest a bid|recommend a bid|what should i bid|how much should i bid|suggest bid|valid bid)\b/i.test(lower)) {
    // Extract target item keyword if present
    let targetKeyword: string | undefined;
    if (/calculator/i.test(lower)) targetKeyword = 'calculator';
    else if (/cycle|bicycle/i.test(lower)) targetKeyword = 'cycle';
    else if (/textbook|book/i.test(lower)) targetKeyword = 'book';
    else if (/kettle/i.test(lower)) targetKeyword = 'kettle';
    else if (/drafter/i.test(lower)) targetKeyword = 'drafter';
    else if (/arduino/i.test(lower)) targetKeyword = 'arduino';

    return {
      intent: 'suggest_bid',
      criteria: {},
      targetAuctionKeyword: targetKeyword,
      isFollowUp: false,
    };
  }

  // 3. Detect follow-up refinement
  // e.g. "Which one has the longest time remaining?", "Show the cheapest one", "Only show good-condition ones", "Filter by like new"
  const isRefinePhrasing =
    /\b(which one|the cheapest one|only show|show only|filter by|the first one|the second one|that one|out of these)\b/i.test(lower) ||
    ((context?.previousResultIds?.length ?? 0) > 0 && /^(cheapest|longest time|good condition|like new|show more)$/i.test(lower));

  const maxPrice = extractMaxPrice(text);
  const minPrice = extractMinPrice(text);
  const { condition, conditionExclude } = extractCondition(text);
  const { closingBefore, closingAfter, timeSort } = extractTimeConstraints(text);
  const sortPref = extractSortPreference(text) || timeSort;

  // Category detection
  let detectedCategory: AuctionCategory | undefined;
  let detectedKeyword: string | undefined;
  for (const item of CATEGORY_PATTERNS) {
    if (item.regex.test(text)) {
      detectedCategory = item.category;
      if (item.keyword) detectedKeyword = item.keyword;
      break;
    }
  }

  // If specific keywords exist (e.g. "calculator", "drafter", "cycle", "kettle")
  if (/calculator/i.test(text)) detectedKeyword = 'calculator';
  else if (/drafter/i.test(text)) detectedKeyword = 'drafter';
  else if (/kettle/i.test(text)) detectedKeyword = 'kettle';
  else if (/arduino/i.test(text)) detectedKeyword = 'arduino';
  else if (/grewal/i.test(text)) detectedKeyword = 'grewal';

  // If this is a follow-up refinement and previous search exists:
  if (isRefinePhrasing && context?.previousSearch) {
    const mergedCriteria: ParsedSearchCriteria = {
      ...context.previousSearch,
      ...(detectedCategory ? { category: detectedCategory } : {}),
      ...(detectedKeyword ? { searchKeyword: detectedKeyword } : {}),
      ...(maxPrice !== undefined ? { maxPrice } : {}),
      ...(minPrice !== undefined ? { minPrice } : {}),
      ...(condition ? { condition } : {}),
      ...(conditionExclude ? { conditionExclude } : {}),
      ...(closingBefore ? { closingBefore } : {}),
      ...(closingAfter ? { closingAfter } : {}),
      ...(sortPref ? { sortBy: sortPref } : {}),
    };

    return {
      intent: 'refine_search',
      criteria: mergedCriteria,
      isFollowUp: true,
    };
  }

  // Otherwise, fresh search
  const criteria: ParsedSearchCriteria = {
    ...(detectedCategory ? { category: detectedCategory } : {}),
    ...(detectedKeyword ? { searchKeyword: detectedKeyword } : {}),
    ...(maxPrice !== undefined ? { maxPrice } : {}),
    ...(minPrice !== undefined ? { minPrice } : {}),
    ...(condition ? { condition } : {}),
    ...(conditionExclude ? { conditionExclude } : {}),
    ...(closingBefore ? { closingBefore } : {}),
    ...(closingAfter ? { closingAfter } : {}),
    ...(sortPref ? { sortBy: sortPref } : {}),
  };

  // If no criteria could be extracted at all and input is short/ambiguous
  const hasAnyFilter =
    criteria.category ||
    criteria.searchKeyword ||
    criteria.maxPrice !== undefined ||
    criteria.minPrice !== undefined ||
    criteria.condition ||
    criteria.conditionExclude ||
    criteria.closingBefore ||
    criteria.closingAfter ||
    criteria.sortBy;

  if (!hasAnyFilter) {
    // Check if it's general query for items
    if (/\b(item|items|auctions?|listings?|what do you have|show me everything|browse)\b/i.test(lower)) {
      return {
        intent: 'search_auctions',
        criteria: { sortBy: 'ending_soon' },
        isFollowUp: false,
      };
    }
    return {
      intent: 'clarification',
      criteria: {},
      isFollowUp: false,
    };
  }

  return {
    intent: 'search_auctions',
    criteria,
    isFollowUp: false,
  };
}

/**
 * Execute real database search on MongoDB Auction model with strict safety rules:
 * - Only active auctions
 * - Excludes current user's listings (sellerId != currentUserId)
 * - Excludes expired auctions (closingAt > now)
 * - Formats prices, remaining times, and match explanations
 */
export async function executeAuctionSearch(
  currentUserId: string,
  criteria: ParsedSearchCriteria,
  context?: AssistantContext,
  limit = 5
): Promise<{ results: AssistantItemResult[]; summaryMessage: string; followUpSuggestions: string[] }> {
  const now = new Date();
  const query: any = {
    status: 'active',
    closingAt: { $gt: now },
  };

  // 1. Exclude current user's own listings from recommendations
  if (currentUserId && mongoose.Types.ObjectId.isValid(currentUserId)) {
    query.sellerId = { $ne: new mongoose.Types.ObjectId(currentUserId) };
  }

  // 2. Category filter
  if (criteria.category) {
    query.category = criteria.category;
  }

  // 3. Keyword filter
  if (criteria.searchKeyword) {
    const rx = new RegExp(criteria.searchKeyword, 'i');
    query.$or = [{ title: rx }, { description: rx }];
  }

  // 4. Condition filter
  if (criteria.condition) {
    query.condition = criteria.condition;
  } else if (criteria.conditionExclude) {
    query.condition = { $ne: criteria.conditionExclude };
  }

  // 5. Price filter (considers currentLeadingBid if bidCount > 0, else startingPrice)
  if (criteria.maxPrice !== undefined || criteria.minPrice !== undefined) {
    const priceRange: any = {};
    if (criteria.maxPrice !== undefined) priceRange.$lte = criteria.maxPrice;
    if (criteria.minPrice !== undefined) priceRange.$gte = criteria.minPrice;

    const priceOr = [
      { bidCount: { $gt: 0 }, currentLeadingBid: priceRange },
      { bidCount: 0, startingPrice: priceRange },
    ];

    if (query.$or) {
      // Merge with existing keyword $or
      query.$and = [{ $or: query.$or }, { $or: priceOr }];
      delete query.$or;
    } else {
      query.$or = priceOr;
    }
  }

  // 6. Closing time constraints
  const closingConditions: any = { $gt: now };
  if (criteria.closingBefore) {
    closingConditions.$lte = criteria.closingBefore;
  }
  if (criteria.closingAfter && criteria.closingAfter > now) {
    closingConditions.$gt = criteria.closingAfter;
  }
  query.closingAt = closingConditions;

  // 7. If this is a follow-up referring to previous result set
  if (context?.previousResultIds && context.previousResultIds.length > 0 && criteria.sortBy) {
    const validIds = context.previousResultIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (validIds.length > 0) {
      query._id = { $in: validIds };
    }
  }

  // 8. Sorting
  let sortOption: any = { closingAt: 1 }; // Default: ending soonest
  if (criteria.sortBy === 'price_asc') {
    sortOption = { currentLeadingBid: 1, startingPrice: 1 };
  } else if (criteria.sortBy === 'price_desc') {
    sortOption = { currentLeadingBid: -1, startingPrice: -1 };
  } else if (criteria.sortBy === 'ending_later') {
    sortOption = { closingAt: -1 };
  } else if (criteria.sortBy === 'most_active') {
    sortOption = { bidCount: -1 };
  } else if (criteria.sortBy === 'ending_soon') {
    sortOption = { closingAt: 1 };
  }

  const rawAuctions = await Auction.find(query)
    .sort(sortOption)
    .limit(limit)
    .lean<IAuction[]>();

  // Map to safe AssistantItemResult
  const results: AssistantItemResult[] = rawAuctions.map((auc) => {
    const hasBids = auc.bidCount > 0;
    const currentPrice = hasBids ? auc.currentLeadingBid : auc.startingPrice;
    const minNext = hasBids ? auc.currentLeadingBid + auc.minimumBidIncrement : auc.startingPrice;

    // Build truthful match reason based on verified criteria
    const reasons: string[] = [];
    if (criteria.category) reasons.push(auc.category);
    if (criteria.maxPrice !== undefined) reasons.push(`≤ ₹${criteria.maxPrice}`);
    if (auc.condition) reasons.push(auc.condition);

    const diffHours = Math.max(0, Math.round((new Date(auc.closingAt).getTime() - now.getTime()) / (1000 * 60 * 60)));
    if (diffHours < 1) {
      const diffMins = Math.max(1, Math.round((new Date(auc.closingAt).getTime() - now.getTime()) / (1000 * 60)));
      reasons.push(`${diffMins}m left`);
    } else if (diffHours < 24) {
      reasons.push(`${diffHours}h left`);
    } else {
      reasons.push(`${Math.round(diffHours / 24)}d left`);
    }

    const matchReason = reasons.join(' • ');

    return {
      id: auc._id.toString(),
      title: auc.title,
      category: auc.category,
      condition: auc.condition,
      startingPrice: auc.startingPrice,
      currentLeadingBid: auc.currentLeadingBid,
      minimumNextBid: minNext,
      bidCount: auc.bidCount,
      closingAt: new Date(auc.closingAt).toISOString(),
      imageUrl: auc.imageUrls && auc.imageUrls.length > 0 ? auc.imageUrls[0] : undefined,
      matchReason,
    };
  });

  // Construct truthful reply & follow-up suggestions
  if (results.length === 0) {
    const catText = criteria.category ? criteria.category.toLowerCase() : 'items';
    const priceText = criteria.maxPrice ? ` within ₹${criteria.maxPrice.toLocaleString('en-IN')}` : '';
    const summaryMessage = `I couldn't find an active listing for ${catText}${priceText} right now. Would you like to expand your search or see other categories?`;

    const followUpSuggestions: string[] = [];
    if (criteria.maxPrice) {
      followUpSuggestions.push(`Increase budget to ₹${Math.round(criteria.maxPrice * 1.5).toLocaleString('en-IN')}`);
    }
    if (criteria.category) {
      followUpSuggestions.push(`Show all ${criteria.category}`);
    }
    followUpSuggestions.push('Show items ending soon', 'Find hostel essentials under ₹500');

    return { results, summaryMessage, followUpSuggestions };
  }

  const countStr = results.length === 1 ? '1 active item' : `${results.length} active items`;
  let summaryMessage = `I found ${countStr} matching your request.`;
  if (criteria.sortBy === 'price_asc') {
    summaryMessage = `Here are the lowest-priced listings matching your request.`;
  } else if (criteria.sortBy === 'ending_later') {
    summaryMessage = `Here are the matching listings with the longest time remaining.`;
  } else if (criteria.sortBy === 'ending_soon') {
    summaryMessage = `Here are matching items ending soonest on campus.`;
  }

  // Dynamic follow-up chips
  const followUpSuggestions: string[] = [];
  if (results.length > 1) {
    if (criteria.sortBy !== 'price_asc') followUpSuggestions.push('Show the cheapest one');
    if (criteria.sortBy !== 'ending_later') followUpSuggestions.push('Which one has the longest time remaining?');
  }
  if (!criteria.condition) {
    followUpSuggestions.push('Only show good-condition ones');
  }
  if (results.length > 0) {
    followUpSuggestions.push(`Suggest a bid for ${results[0].title.slice(0, 24)}...`);
  }

  return { results, summaryMessage, followUpSuggestions };
}

/**
 * Generate a safe bid recommendation for an auction:
 * - Calculates minimum valid next bid strictly from actual DB fields
 * - Never auto-submits a bid; directs student to the auction page
 */
export async function getBidRecommendation(
  currentUserId: string,
  targetKeyword?: string,
  context?: AssistantContext
): Promise<{ recommendation: BidRecommendation | null; reply: string; followUpSuggestions: string[] }> {
  const now = new Date();
  const query: any = {
    status: 'active',
    closingAt: { $gt: now },
  };

  // If specific auction was referenced in context
  if (context?.currentAuctionId && mongoose.Types.ObjectId.isValid(context.currentAuctionId)) {
    query._id = new mongoose.Types.ObjectId(context.currentAuctionId);
  } else if (targetKeyword) {
    const rx = new RegExp(targetKeyword, 'i');
    query.$or = [{ title: rx }, { description: rx }];
  } else if (context?.previousResultIds && context.previousResultIds.length > 0) {
    const firstId = context.previousResultIds[0];
    if (mongoose.Types.ObjectId.isValid(firstId)) {
      query._id = new mongoose.Types.ObjectId(firstId);
    }
  }

  const auction = await Auction.findOne(query).sort({ bidCount: -1 }).lean<IAuction>();

  if (!auction) {
    return {
      recommendation: null,
      reply: "I couldn't find an active auction matching that item to suggest a bid for. Please specify the item or search for it first.",
      followUpSuggestions: [
        'Find a cycle under ₹2,000',
        'Show calculators below ₹400',
        'Find items ending soon',
      ],
    };
  }

  const isSelf = auction.sellerId.toString() === currentUserId;
  const hasBids = auction.bidCount > 0;
  const minNextBid = hasBids
    ? auction.currentLeadingBid + auction.minimumBidIncrement
    : auction.startingPrice;

  let explanation = '';
  if (isSelf) {
    explanation = `This is your own listing! Under Campus Auction fairness rules, sellers cannot place bids on their own items.`;
  } else if (!hasBids) {
    explanation = `This auction currently has 0 bids. The starting price is ₹${auction.startingPrice}. Your minimum valid first bid is ₹${minNextBid}. You can place this bid on the official auction page.`;
  } else {
    explanation = `The current leading bid is ₹${auction.currentLeadingBid}, and the minimum bid increment is ₹${auction.minimumBidIncrement}. Your minimum valid next bid is ₹${minNextBid}. You can enter ₹${minNextBid} or higher on the official auction page.`;
  }

  const recommendation: BidRecommendation = {
    auctionId: auction._id.toString(),
    title: auction.title,
    category: auction.category,
    startingPrice: auction.startingPrice,
    currentLeadingBid: auction.currentLeadingBid,
    minimumBidIncrement: auction.minimumBidIncrement,
    bidCount: auction.bidCount,
    minimumNextBid: minNextBid,
    explanation,
  };

  const reply = isSelf
    ? `You cannot bid on "${auction.title}" because you are the seller.`
    : `Here is the bid recommendation for "${auction.title}".`;

  return {
    recommendation,
    reply,
    followUpSuggestions: [
      `View "${auction.title.slice(0, 20)}..." auction`,
      'Show items ending soon',
      'Find calculators below ₹400',
    ],
  };
}

/**
 * Main Assistant Service Handler
 */
export async function processAssistantMessage(
  currentUserId: string,
  message: string,
  context?: AssistantContext
): Promise<AssistantResponseData> {
  const parsed = parseNaturalLanguageQuery(message, context);

  // 1. Greeting
  if (parsed.intent === 'greeting') {
    return {
      reply: 'Hi! 👋 What are you looking for today? Tell me what you need, your budget, or when you want an auction to end. I will search live campus listings for you.',
      intent: 'greeting',
      results: [],
      bidRecommendation: null,
      followUpSuggestions: [
        'Find a cycle under ₹2,000',
        'Show calculators below ₹400',
        'Find items ending soon',
        'Show good-condition books',
        'Find hostel essentials under ₹500',
      ],
    };
  }

  // 2. Bid Suggestion Request
  if (parsed.intent === 'suggest_bid') {
    const { recommendation, reply, followUpSuggestions } = await getBidRecommendation(
      currentUserId,
      parsed.targetAuctionKeyword,
      context
    );

    return {
      reply,
      intent: 'suggest_bid',
      results: [],
      bidRecommendation: recommendation,
      followUpSuggestions,
    };
  }

  // 3. Clarification if nothing was recognized
  if (parsed.intent === 'clarification') {
    return {
      reply: 'I am not sure what you are looking for. Are you looking for a cycle, calculator, textbook, hostel essentials, or something else on campus?',
      intent: 'clarification',
      results: [],
      bidRecommendation: null,
      followUpSuggestions: [
        'Find a cycle under ₹2,000',
        'Show scientific calculators below ₹400',
        'Show items ending soon',
        'Find hostel essentials under ₹500',
      ],
    };
  }

  // 4. Search or Refine Search
  const { results, summaryMessage, followUpSuggestions } = await executeAuctionSearch(
    currentUserId,
    parsed.criteria,
    context
  );

  return {
    reply: summaryMessage,
    intent: parsed.intent,
    criteria: parsed.criteria,
    results,
    bidRecommendation: null,
    followUpSuggestions,
  };
}
