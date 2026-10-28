import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import {
  Clock,
  IndianRupee,
  ShieldCheck,
  Flame,
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowLeft,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import type { Auction, Bid } from '../types/index.js';
import { formatPrice, formatTimeRemaining, formatDate } from '../utils/formatters.js';

export const AuctionDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [auction, setAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [minAcceptableBid, setMinAcceptableBid] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [bidInput, setBidInput] = useState<number | ''>('');
  const [placingBid, setPlacingBid] = useState<boolean>(false);
  const [bidFeedback, setBidFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [timeRemaining, setTimeRemaining] = useState({ text: '', isEnded: false, isUrgent: false });

  // 1. Fetch Auction details and Bid history
  const loadAuctionData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError('');

      const [aucRes, bidsRes] = await Promise.all([
        api.get(`/auctions/${id}`),
        api.get(`/auctions/${id}/bids`),
      ]);

      if (aucRes.data.success) {
        const auc: Auction = aucRes.data.auction;
        setAuction(auc);
        const minBid = aucRes.data.minAcceptableBid;
        setMinAcceptableBid(minBid);
        setBidInput(minBid);
        setTimeRemaining(formatTimeRemaining(auc.closingAt));
      } else {
        setError(aucRes.data.message || 'Auction not found.');
      }

      if (bidsRes.data.success) {
        setBids(bidsRes.data.bids || []);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to load auction listing.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuctionData();
  }, [id]);

  // 2. Countdown timer interval
  useEffect(() => {
    if (!auction) return;
    const interval = setInterval(() => {
      const remaining = formatTimeRemaining(auction.closingAt);
      setTimeRemaining(remaining);
      if (remaining.isEnded && auction.status === 'active') {
        // Refresh to get finalized status
        loadAuctionData();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [auction?.closingAt, auction?.status]);

  // 3. Socket.IO Real-time updates
  useEffect(() => {
    if (!id) return;
    let socket: Socket | null = null;
    try {
      socket = io(window.location.origin, {
        withCredentials: true,
      });

      socket.emit('join_auction', id);

      socket.on('new_bid', (data: any) => {
        if (data.auctionId === id) {
          setAuction((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              currentLeadingBid: data.currentLeadingBid,
              bidCount: data.bidCount,
              currentLeadingBidderId: data.bid?.bidderId,
            };
          });
          setMinAcceptableBid(data.minAcceptableBid);
          setBidInput(data.minAcceptableBid);
          if (data.bid) {
            setBids((prevBids) => [data.bid, ...prevBids.filter((b) => b._id !== data.bid._id)]);
          }
        }
      });

      socket.on('auction_ended', (data: any) => {
        if (data.auctionId === id) {
          setAuction((prev) => (prev ? { ...prev, status: data.status } : null));
        }
      });
    } catch (err) {
      console.warn('Socket connection warning:', err);
    }

    return () => {
      if (socket) {
        socket.emit('leave_auction', id);
        socket.disconnect();
      }
    };
  }, [id]);

  // Handle Bid Submission
  const handlePlaceBid = async (e: React.FormEvent) => {
    e.preventDefault();
    setBidFeedback(null);

    if (!user) {
      setBidFeedback({
        type: 'error',
        message: 'Please log in with your @kongu.edu student account to place a bid.',
      });
      return;
    }

    if (!bidInput || Number(bidInput) < minAcceptableBid) {
      setBidFeedback({
        type: 'error',
        message: `Your bid must be at least the minimum acceptable amount of ₹${minAcceptableBid}.`,
      });
      return;
    }

    setPlacingBid(true);
    try {
      const res = await api.post(`/auctions/${id}/bids`, {
        amount: Math.floor(Number(bidInput)),
      });

      if (res.data.success) {
        setBidFeedback({
          type: 'success',
          message: res.data.message || 'Bid successfully recorded!',
        });

        // Update local state
        if (res.data.auction) {
          setMinAcceptableBid(res.data.auction.minAcceptableBid);
          setBidInput(res.data.auction.minAcceptableBid);
        }
        if (res.data.bid) {
          setBids((prev) => [res.data.bid, ...prev.filter((b) => b._id !== res.data.bid._id)]);
        }
        if (auction) {
          setAuction({
            ...auction,
            currentLeadingBid: res.data.auction.currentLeadingBid,
            bidCount: res.data.auction.bidCount,
            currentLeadingBidderId: user,
          });
        }
      } else {
        setBidFeedback({
          type: 'error',
          message: res.data.message || 'Could not place bid.',
        });
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || 'Failed to place bid. Please try again.';
      setBidFeedback({ type: 'error', message: msg });
      if (err.response?.data?.minAcceptableBid) {
        setMinAcceptableBid(err.response.data.minAcceptableBid);
        setBidInput(err.response.data.minAcceptableBid);
      }
    } finally {
      setPlacingBid(false);
    }
  };

  const addPreset = (increment: number) => {
    setBidInput((prev) => {
      const base = prev === '' ? minAcceptableBid : Number(prev);
      return Math.max(minAcceptableBid, base + increment);
    });
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-semibold text-slate-500">Loading auction listing details...</p>
      </div>
    );
  }

  if (error || !auction) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Auction Listing Unavailable</h2>
        <p className="text-sm text-slate-500">{error || 'The requested auction listing does not exist.'}</p>
        <Link
          to="/auctions"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Marketplace</span>
        </Link>
      </div>
    );
  }

  const sellerObj: any = auction.sellerId;
  const isSeller = user && (user._id === sellerObj?._id || user._id === sellerObj);
  const isClosed = auction.status !== 'active' || timeRemaining.isEnded;
  const hasLeadingBid = auction.bidCount > 0 && auction.currentLeadingBid > 0;

  const fallbackImage =
    'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=800&q=80';
  const images = auction.imageUrls && auction.imageUrls.length > 0 ? auction.imageUrls : [fallbackImage];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/auctions"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Marketplace</span>
        </Link>
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
            {auction.category}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
            {auction.condition}
          </span>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Image Gallery & Details (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Main Photo */}
          <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-sm">
            <div className="relative aspect-4/3 w-full bg-slate-100 overflow-hidden flex items-center justify-center">
              <img
                src={images[selectedImageIndex] || fallbackImage}
                alt={auction.title}
                className="w-full h-full object-cover object-center"
              />
              {/* Status Badge Overlay */}
              <div className="absolute top-4 left-4">
                <span
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wider backdrop-blur-md shadow-md ${
                    auction.status === 'active' && !timeRemaining.isEnded
                      ? 'bg-emerald-600/90 text-white'
                      : auction.status === 'reserved'
                      ? 'bg-amber-600/90 text-white'
                      : auction.status === 'sold'
                      ? 'bg-indigo-600/90 text-white'
                      : 'bg-slate-900/90 text-white'
                  }`}
                >
                  {auction.status === 'active' && !timeRemaining.isEnded ? 'Active Auction' : auction.status}
                </span>
              </div>
            </div>

            {/* Gallery Thumbnails */}
            {images.length > 1 && (
              <div className="p-3 border-t border-slate-100 flex items-center gap-2 overflow-x-auto">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                      selectedImageIndex === idx ? 'border-indigo-600 scale-105' : 'border-slate-200 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Description Card */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 space-y-4 shadow-xs">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">
              Item Details & Condition
            </h2>
            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {auction.description}
            </div>

            {/* Verification & Handover Guarantee Box */}
            <div className="mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3.5">
              <ShieldCheck className="w-6 h-6 text-indigo-600 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-600 space-y-1">
                <div className="font-bold text-slate-800 text-sm">Campus Handover Policy</div>
                <p>
                  No online payment transfers are processed. Once the auction concludes, the highest bidder and 
                  seller arrange physical handover on Kongu Engineering College campus. Both parties confirm completion in-app.
                </p>
              </div>
            </div>
          </div>

          {/* Seller Profile Card */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center text-lg">
                {sellerObj?.fullName?.charAt(0)?.toUpperCase() || 'S'}
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Listed By</div>
                <div className="text-base font-bold text-slate-900">{sellerObj?.fullName || 'Kongu Student'}</div>
                <div className="text-xs text-slate-500 font-medium">
                  {sellerObj?.department ? `${sellerObj.department} Department` : 'Kongu Engineering College'}
                  {sellerObj?.year ? ` • Year ${sellerObj.year}` : ''}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-semibold text-slate-400 block">Member Since</span>
              <span className="text-xs font-bold text-slate-700">
                {sellerObj?.createdAt ? new Date(sellerObj.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '2026'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Pricing, Live Countdown & Bid Form (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-md shadow-slate-200/50 space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 leading-tight">
                {auction.title}
              </h1>
              <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                <span>Listed {formatDate(auction.createdAt)}</span>
                <span>•</span>
                <span className="font-semibold text-indigo-600">ID: {auction._id.slice(-6)}</span>
              </div>
            </div>

            {/* Price Box */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                    {hasLeadingBid ? 'Current Leading Bid' : 'Starting Price'}
                  </span>
                  <div className="text-3xl font-black text-slate-900 tracking-tight mt-0.5">
                    {formatPrice(hasLeadingBid ? auction.currentLeadingBid : auction.startingPrice)}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                    Total Bids
                  </span>
                  <div className="flex items-center justify-end gap-1 text-base font-extrabold text-amber-600 mt-0.5">
                    <Flame className="w-4 h-4 fill-amber-500" />
                    <span>{auction.bidCount}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-600">
                <span>Min Bid Increment: <strong className="text-slate-900">+₹{auction.minimumBidIncrement}</strong></span>
                <span>Starting: <strong className="text-slate-900">{formatPrice(auction.startingPrice)}</strong></span>
              </div>
            </div>

            {/* Countdown Timer */}
            <div
              className={`p-4 rounded-2xl border text-center transition-all ${
                isClosed
                  ? 'bg-slate-900 text-white border-slate-800'
                  : timeRemaining.isUrgent
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-indigo-50/70 border-indigo-100 text-indigo-900'
              }`}
            >
              <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider">
                <Clock className="w-4 h-4" />
                <span>{isClosed ? 'Auction Closed' : 'Auction Closes In'}</span>
              </div>
              <div className="text-2xl font-black tracking-tight mt-1">
                {timeRemaining.text}
              </div>
              <div className="text-[11px] opacity-80 mt-0.5">
                Closing: {formatDate(auction.closingAt)}
              </div>
            </div>

            {/* Outcome Display if Closed */}
            {isClosed ? (
              <div className="p-5 rounded-2xl bg-slate-100 border border-slate-200 text-center space-y-2">
                <Trophy className="w-8 h-8 text-amber-500 mx-auto" />
                <div className="text-sm font-extrabold text-slate-900">
                  {auction.status === 'reserved' || auction.status === 'sold'
                    ? `Item Won for ${formatPrice(auction.currentLeadingBid)}`
                    : 'Auction Closed Unsold'}
                </div>
                <p className="text-xs text-slate-500">
                  {auction.status === 'reserved' || auction.status === 'sold'
                    ? 'The item is reserved for the winning student to complete campus handover.'
                    : 'No valid bids were submitted before the closing deadline.'}
                </p>
                {user && (
                  <Link
                    to="/transactions"
                    className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    <span>View Handover Status</span>
                  </Link>
                )}
              </div>
            ) : isSeller ? (
              /* Seller Disabled View */
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-3">
                <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <div className="font-bold">You are the seller of this auction</div>
                  <p className="mt-0.5 text-amber-700">
                    Kongu fairness policy prevents sellers from bidding on their own listings.
                  </p>
                </div>
              </div>
            ) : (
              /* Student Bid Form */
              <form onSubmit={handlePlaceBid} className="space-y-4">
                {bidFeedback && (
                  <div
                    className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
                      bidFeedback.type === 'success'
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border border-rose-200 text-rose-800'
                    }`}
                  >
                    {bidFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span>{bidFeedback.message}</span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Your Bid Amount (₹)
                    </label>
                    <span className="text-xs text-indigo-600 font-bold">
                      Min Valid: ₹{minAcceptableBid}
                    </span>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold">
                      <IndianRupee className="w-5 h-5 text-slate-600" />
                    </div>
                    <input
                      type="number"
                      required
                      min={minAcceptableBid}
                      value={bidInput}
                      onChange={(e) =>
                        setBidInput(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xl font-black text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Preset increment buttons */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-medium">Quick Add:</span>
                    <button
                      type="button"
                      onClick={() => addPreset(20)}
                      className="px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-700 transition-colors"
                    >
                      +₹20
                    </button>
                    <button
                      type="button"
                      onClick={() => addPreset(50)}
                      className="px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-700 transition-colors"
                    >
                      +₹50
                    </button>
                    <button
                      type="button"
                      onClick={() => addPreset(100)}
                      className="px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-700 transition-colors"
                    >
                      +₹100
                    </button>
                  </div>
                </div>

                {user ? (
                  <button
                    type="submit"
                    disabled={placingBid}
                    className="w-full py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-extrabold shadow-lg shadow-indigo-500/25 disabled:opacity-70 transition-all flex items-center justify-center gap-2"
                  >
                    {placingBid ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Submitting Bid...</span>
                      </>
                    ) : (
                      <>
                        <Flame className="w-4 h-4 fill-white" />
                        <span>Place Valid Bid (₹{bidInput || minAcceptableBid})</span>
                      </>
                    )}
                  </button>
                ) : (
                  <Link
                    to="/login"
                    className="w-full py-3.5 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-extrabold text-center block transition-all shadow-md"
                  >
                    Log In to Bid with @kongu.edu
                  </Link>
                )}
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Public Bid History Section */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>Public Bid History</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700">
                {bids.length}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Transparent live history. Private emails and passwords are never exposed.
            </p>
          </div>
        </div>

        {bids.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <Sparkles className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="text-sm font-bold text-slate-700">No bids yet on this auction</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Be the first Kongu student to place a bid starting at {formatPrice(auction.startingPrice)}!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {bids.map((bid, index) => {
              const bidder: any = bid.bidderId;
              const isLeading = index === 0;

              return (
                <div
                  key={bid._id}
                  className={`py-3.5 px-3 rounded-xl flex items-center justify-between transition-colors ${
                    isLeading ? 'bg-amber-50/60 font-medium' : 'hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                        isLeading
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {bidder?.fullName?.charAt(0)?.toUpperCase() || 'K'}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {bidder?.fullName || 'Kongu Student'}
                        </span>
                        {isLeading && (
                          <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-amber-500 text-white rounded-md shadow-xs">
                            Leading Bid
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {bidder?.department ? `${bidder.department} Department` : 'Kongu Campus'} • {formatDate(bid.createdAt)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-black text-slate-900 tracking-tight">
                      {formatPrice(bid.amount)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
