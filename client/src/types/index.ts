export interface User {
  _id: string;
  fullName: string;
  email: string;
  department?: string;
  year?: number;
  createdAt: string;
}

export type AuctionCategory =
  | 'Books and Study Materials'
  | 'Electronics'
  | 'Cycles and Transportation'
  | 'Hostel Essentials'
  | 'Clothing and Accessories'
  | 'Sports Equipment'
  | 'Laboratory Equipment'
  | 'Other';

export type ItemCondition = 'New' | 'Like New' | 'Good' | 'Fair' | 'Heavily Used';

export type AuctionStatus = 'active' | 'ended' | 'reserved' | 'sold' | 'unsold' | 'cancelled';

export interface Auction {
  _id: string;
  sellerId: User | string;
  title: string;
  description: string;
  category: AuctionCategory;
  condition: ItemCondition;
  imageUrls: string[];
  startingPrice: number;
  minimumBidIncrement: number;
  closingAt: string;
  status: AuctionStatus;
  currentLeadingBid: number;
  currentLeadingBidderId?: User | string | null;
  bidCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Bid {
  _id: string;
  auctionId: string;
  bidderId: {
    _id: string;
    fullName: string;
    department?: string;
  } | string;
  amount: number;
  bidSource?: 'MANUAL' | 'AUTO';
  createdAt: string;
}

export type AutoBidStatus = 'active' | 'paused' | 'disabled';

export interface AutoBid {
  _id: string;
  auctionId: string;
  userId: string;
  maxAmount: number;
  status: AutoBidStatus;
  maxRegisteredAt: string;
  lastAutoBidAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MyAutoBidResponse {
  success: boolean;
  autoBid: AutoBid | null;
  isLeading: boolean;
  currentLeadingBid: number;
}

export type TransactionStatus =
  | 'awaiting_handover'
  | 'handover_scheduled'
  | 'completed'
  | 'failed'
  | 'reassigned';

export interface Transaction {
  _id: string;
  auctionId: Auction | string;
  sellerId: User;
  buyerId: User;
  amount: number;
  status: TransactionStatus;
  handoverLocation?: string;
  handoverDateTime?: string;
  handoverNotes?: string;
  sellerConfirmedAt?: string | null;
  buyerConfirmedAt?: string | null;
  reservationDeadline: string;
  pickupDeadline?: string;
  failureReason?: string;
  attemptNumber: number;
  createdAt: string;
  updatedAt: string;
}

export type NotificationType =
  | 'bid_received'
  | 'outbid'
  | 'auction_won'
  | 'auction_lost'
  | 'auction_sold'
  | 'auction_unsold'
  | 'auction_ending_soon'
  | 'handover_scheduled'
  | 'handover_confirmed_by_peer'
  | 'transaction_completed'
  | 'transaction_failed'
  | 'handover_reassigned'
  | 'question_asked'
  | 'answer_received'
  | 'want_match'
  | 'want_fulfilled_suggestion'
  | 'auto_bid_placed'
  | 'auto_bid_outbid'
  | 'auto_bid_max_exceeded'
  | 'auto_bid_enabled'
  | 'auto_bid_updated'
  | 'auto_bid_paused'
  | 'auto_bid_disabled'
  | 'system';

export interface AppNotification {
  _id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  auctionId?: {
    _id: string;
    title: string;
    startingPrice: number;
    currentLeadingBid: number;
    status: string;
    imageUrls?: string[];
  } | null;
  transactionId?: string | null;
  actorId?: {
    _id: string;
    fullName: string;
    department?: string;
  } | null;
  readAt?: string | null;
  deduplicationKey?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantItem {
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

export interface AssistantChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  results?: AssistantItem[];
  bidRecommendation?: BidRecommendation | null;
  followUpSuggestions?: string[];
  timestamp: Date;
}

export interface QuestionAuthor {
  _id: string;
  fullName: string;
  department?: string;
  year?: number;
}

export interface AuctionAnswer {
  _id: string;
  authorId: QuestionAuthor;
  text: string;
  isSeller: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuctionQuestion {
  _id: string;
  auctionId: string;
  authorId: QuestionAuthor;
  text: string;
  answers: AuctionAnswer[];
  isAuthor: boolean;
  canEditDelete: boolean;
  isSeller: boolean;
  createdAt: string;
  updatedAt: string;
}

export type WantStatus = 'ACTIVE' | 'PAUSED' | 'FULFILLED' | 'EXPIRED';

export interface Want {
  _id: string;
  student: string | User;
  keywords: string;
  category?: AuctionCategory;
  maxPrice?: number;
  condition?: ItemCondition;
  status: WantStatus;
  matchCount: number;
  expiresAt: string;
  fulfilledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WantMatch {
  _id: string;
  want: string | Want;
  listing: Auction;
  student: string | User;
  matchReason: string;
  matchedAt: string;
}


