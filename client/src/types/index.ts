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
