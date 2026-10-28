import mongoose from 'mongoose';
import { Want, IWant } from '../models/Want.js';
import { WantMatch } from '../models/WantMatch.js';
import { Auction, IAuction } from '../models/Auction.js';
import { User } from '../models/User.js';
import { createNotification } from './notificationService.js';
import { sendGroupedMatchEmail } from './emailService.js';

// Synonym map for student keywords
const SYNONYM_MAP: Record<string, string[]> = {
  calc: ['calculator', 'calculators', 'scientific'],
  calculator: ['calc', 'calculators', 'classwiz', 'casio'],
  cycle: ['bicycle', 'bike', 'cycles', 'bicycles'],
  bicycle: ['cycle', 'bike', 'cycles', 'bicycles'],
  bike: ['cycle', 'bicycle', 'cycles'],
  textbook: ['book', 'books', 'textbooks', 'grewal', 'notes'],
  book: ['textbook', 'textbooks', 'books'],
  kettle: ['electric kettle', 'prestige'],
  drafter: ['mini drafter', 'drawing board', 'omega'],
};

const CONDITION_RANK: Record<string, number> = {
  'Heavily Used': 1,
  'Fair': 2,
  'Good': 3,
  'Like New': 4,
  'New': 5,
};

/**
 * Check if an auction listing is active and open for bidding
 */
export function isListingEligible(listing: IAuction | any): boolean {
  return listing.status === 'active' && new Date(listing.closingAt) > new Date();
}

/**
 * Check if a want is active and not expired
 */
export function isWantEligible(want: IWant | any): boolean {
  return want.status === 'ACTIVE' && new Date(want.expiresAt) > new Date();
}

/**
 * Determine if a listing matches a student's want criteria
 */
export function doesListingMatchWant(
  listing: IAuction | any,
  want: IWant | any
): { matches: boolean; reason?: string } {
  // 1. Seller Exclusion: Students cannot match their own listings
  const sellerIdStr = listing.sellerId?._id ? listing.sellerId._id.toString() : listing.sellerId?.toString();
  const studentIdStr = want.student?._id ? want.student._id.toString() : want.student?.toString();
  if (sellerIdStr && studentIdStr && sellerIdStr === studentIdStr) {
    return { matches: false };
  }

  // 2. Listing and Want Eligibility
  if (!isListingEligible(listing) || !isWantEligible(want)) {
    return { matches: false };
  }

  // 3. Category constraint
  if (want.category && want.category !== listing.category) {
    return { matches: false };
  }

  // 4. Starting Price constraint (Applies to startingPrice, not fluctuating leading bids)
  if (want.maxPrice !== undefined && want.maxPrice !== null && want.maxPrice > 0) {
    if (listing.startingPrice > want.maxPrice) {
      return { matches: false };
    }
  }

  // 5. Condition constraint (Preferred condition serves as minimum acceptable quality)
  if (want.condition) {
    const wantRank = CONDITION_RANK[want.condition] ?? 0;
    const listingRank = CONDITION_RANK[listing.condition] ?? 0;
    if (listingRank < wantRank) {
      return { matches: false };
    }
  }

  // 6. Token-based Keyword Matching
  const rawKeywords = want.keywords.toLowerCase().trim();
  const tokens = rawKeywords
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((t: string) => t.length >= 2);

  if (tokens.length === 0) {
    return { matches: false };
  }

  const searchableTarget = [
    listing.title || '',
    listing.description || '',
    listing.category || '',
  ]
    .join(' ')
    .toLowerCase();

  // Every token in the want must match either directly or via a synonym
  const allTokensMatched = tokens.every((token: string) => {
    if (searchableTarget.includes(token)) return true;

    // Check synonyms
    const synonyms = SYNONYM_MAP[token] || [];
    return synonyms.some((syn) => searchableTarget.includes(syn));
  });

  if (!allTokensMatched) {
    return { matches: false };
  }

  // Construct truthful, verified match reason
  const reasons: string[] = [];
  reasons.push(`Matched keywords "${want.keywords}"`);
  if (want.category) reasons.push(`Category: ${want.category}`);
  if (want.maxPrice) reasons.push(`Starting price ₹${listing.startingPrice} ≤ ₹${want.maxPrice}`);
  if (want.condition) reasons.push(`Condition: ${want.condition}`);

  return {
    matches: true,
    reason: reasons.join(' • '),
  };
}

/**
 * Scan existing active listings for a specific want (on create, resume, or renew)
 */
export async function checkExistingListingsForWant(
  wantId: string
): Promise<{ matchedListings: any[]; newMatchesCount: number }> {
  const want = await Want.findById(wantId);
  if (!want || !isWantEligible(want)) {
    return { matchedListings: [], newMatchesCount: 0 };
  }

  const now = new Date();
  const activeAuctions = await Auction.find({
    status: 'active',
    closingAt: { $gt: now },
    sellerId: { $ne: want.student },
  }).lean();

  const newMatches: any[] = [];

  for (const auc of activeAuctions) {
    const matchCheck = doesListingMatchWant(auc, want);
    if (matchCheck.matches) {
      try {
        await WantMatch.create({
          want: want._id,
          listing: auc._id,
          student: want.student,
          matchReason: matchCheck.reason || `Matched keywords "${want.keywords}"`,
          matchedAt: now,
        });
        newMatches.push(auc);
      } catch (err: any) {
        // Code 11000: duplicate key error safely ignored
        if (err.code !== 11000) {
          console.error('[WantMatch Insert Error]', err);
        }
      }
    }
  }

  // Update total match count on want
  const totalMatches = await WantMatch.countDocuments({ want: want._id });
  want.matchCount = totalMatches;
  await want.save();

  // If new matches found, dispatch grouped in-app notification & optional email
  if (newMatches.length > 0) {
    const minStart = Math.min(...newMatches.map((m) => m.startingPrice));
    const titleSample = newMatches
      .map((m) => m.title)
      .slice(0, 2)
      .join(', ');
    const moreCount = newMatches.length > 2 ? ` and ${newMatches.length - 2} more` : '';

    const notifMessage = `Your want "${want.keywords}" matched ${newMatches.length} listing(s): ${titleSample}${moreCount}. Starting from ₹${minStart}.`;

    const sortedIds = newMatches.map((m) => m._id.toString()).sort().join('_');
    const notif = await createNotification({
      recipientId: want.student.toString(),
      type: 'want_match',
      title: 'New items match your saved want!',
      message: notifMessage,
      auctionId: newMatches[0]._id, // Links to first matching auction
      deduplicationKey: `want_match_${want._id}_${sortedIds}`,
      metadata: {
        wantId: want._id.toString(),
        matchCount: newMatches.length,
        listingIds: newMatches.map((m) => m._id.toString()),
      },
    });

    // Optional email dispatch
    const studentUser = await User.findById(want.student).select('fullName email');
    if (studentUser) {
      sendGroupedMatchEmail({
        recipientEmail: studentUser.email,
        recipientName: studentUser.fullName,
        wantKeywords: want.keywords,
        maxPrice: want.maxPrice,
        listings: newMatches.map((m) => ({
          id: m._id.toString(),
          title: m.title,
          startingPrice: m.startingPrice,
          category: m.category,
        })),
      }).catch((err) => console.error('[Match Email Error]', err));
    }
  }

  // Retrieve all current matches for this want
  const allMatches = await WantMatch.find({ want: want._id })
    .populate('listing')
    .sort({ matchedAt: -1 })
    .lean();

  return {
    matchedListings: allMatches,
    newMatchesCount: newMatches.length,
  };
}

/**
 * Scan active wants when a new auction listing is published
 */
export async function checkNewListingMatches(listing: IAuction | any): Promise<number> {
  if (!isListingEligible(listing)) return 0;

  const sellerIdStr = listing.sellerId?._id ? listing.sellerId._id.toString() : listing.sellerId?.toString();
  const now = new Date();

  // Find all active, non-expired wants not owned by the seller
  const activeWants = await Want.find({
    status: 'ACTIVE',
    expiresAt: { $gt: now },
    student: { $ne: new mongoose.Types.ObjectId(sellerIdStr) },
  });

  let matchCount = 0;

  for (const want of activeWants) {
    const matchCheck = doesListingMatchWant(listing, want);
    if (matchCheck.matches) {
      try {
        const matchRecord = await WantMatch.create({
          want: want._id,
          listing: listing._id,
          student: want.student,
          matchReason: matchCheck.reason || `Matched keywords "${want.keywords}"`,
          matchedAt: now,
        });

        // Increment count
        await Want.findByIdAndUpdate(want._id, { $inc: { matchCount: 1 } });
        matchCount++;

        // Send instant notification to student
        const notif = await createNotification({
          recipientId: want.student.toString(),
          type: 'want_match',
          title: 'New item matches your saved want!',
          message: `"${listing.title}" matches your want for "${want.keywords}"! Starting price: ₹${listing.startingPrice}.`,
          auctionId: listing._id,
          deduplicationKey: `want_match_${want._id}_${listing._id}`,
          metadata: {
            wantId: want._id.toString(),
            listingId: listing._id.toString(),
          },
        });

        // Optional email dispatch
        const studentUser = await User.findById(want.student).select('fullName email');
        if (studentUser) {
          sendGroupedMatchEmail({
            recipientEmail: studentUser.email,
            recipientName: studentUser.fullName,
            wantKeywords: want.keywords,
            maxPrice: want.maxPrice,
            listings: [
              {
                id: listing._id.toString(),
                title: listing.title,
                startingPrice: listing.startingPrice,
                category: listing.category,
              },
            ],
          }).catch((err) => console.error('[Match Email Error]', err));
        }
      } catch (err: any) {
        if (err.code !== 11000) {
          console.error('[New Listing WantMatch Error]', err);
        }
      }
    }
  }

  return matchCount;
}

/**
 * Scan and update expired wants (past 30 days) to EXPIRED status
 */
export async function scanAndExpireWants(): Promise<number> {
  const result = await Want.updateMany(
    { status: 'ACTIVE', expiresAt: { $lte: new Date() } },
    { $set: { status: 'EXPIRED' } }
  );
  return result.modifiedCount;
}
