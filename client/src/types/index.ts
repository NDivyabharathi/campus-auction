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
  } | string;
  amount: number;
  createdAt: string;
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

