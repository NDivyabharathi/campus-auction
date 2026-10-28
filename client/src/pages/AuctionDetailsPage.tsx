import React, { useState, useEffect, useRef } from 'react';
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
  Zap,
  Bot,
  Calendar,
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import type { Auction, Bid } from '../types/index.js';
import {
  formatPrice,
  formatTimeRemaining,
  formatTimeUntil,
  formatDate,
  formatISTDateTime,
} from '../utils/formatters.js';
import { AuctionQuestionsSection } from '../components/AuctionQuestionsSection.js';
import { AutoBidCard } from '../components/AutoBidCard.js';

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
  const [timeUntilOpen, setTimeUntilOpen] = useState({ text: '', isStarted: true });
  const [extensionAlert, setExtensionAlert] = useState<string | null>(null);
  const extensionTimerRef = useRef<any>(null);

  const isScheduled =
    auction?.status === 'scheduled' ||
    (Boolean(auction?.startTime) && new Date(auction!.startTime!).getTime() > Date.now());

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
        if (auc.startTime) {
          setTimeUntilOpen(formatTimeUntil(auc.startTime));
        }
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

  // 2. Countdown timer intervals (opening and closing)
  useEffect(() => {
    if (!auction) return;
    const interval = setInterval(() => {
      if (auction.startTime) {
        const until = formatTimeUntil(auction.startTime);
        setTimeUntilOpen(until);
        if (until.isStarted && auction.status === 'scheduled') {
          loadAuctionData();
        }
      }
      const remaining = formatTimeRemaining(auction.closingAt);
      setTimeRemaining(remaining);
      if (remaining.isEnded && auction.status === 'active') {
        loadAuctionData();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [auction?.startTime, auction?.closingAt, auction?.status]);

  // 3. Socket.IO Real-time updates
  useEffect(() => {
    if (!id) return;
    let socket: Socket | null = null;
    try {
      socket = io(window.location.origin, {
        withCredentials: true,
      });

      socket.emit('join_auction', id);

      const handleAuctionOpened = (data: any) => {
        if (data.auctionId === id) {
          setAuction((prev) => (prev ? { ...prev, status: 'active' } : null));
          loadAuctionData();
        }
      };

      socket.on('auction_opened', handleAuctionOpened);
      socket.on('auction:activated', handleAuctionOpened);

      const handleAuctionExtended = (data: any) => {
        if (data.auctionId === id && data.newClosingTime) {
          setAuction((prev) => (prev ? { ...prev, closingAt: data.newClosingTime } : null));
          setTimeRemaining(formatTimeRemaining(data.newClosingTime));
          setExtensionAlert('Last-minute bid! Auction extended by 60 seconds.');
          if (extensionTimerRef.current) clearTimeout(extensionTimerRef.current);
          extensionTimerRef.current = setTimeout(() => {
            setExtensionAlert(null);
          }, 8000);
        }
      };

      socket.on('auction:extended', handleAuctionExtended);
      socket.on('auction_extended', handleAuctionExtended);

      socket.on('new_bid', (data: any) => {
        if (data.auctionId === id) {
          setAuction((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              currentLeadingBid: data.currentLeadingBid,
              bidCount: data.bidCount,
              currentLeadingBidderId: data.bid?.bidderId,
              ...(data.closingAt ? { closingAt: data.closingAt } : {}),
            };
          });
          if (data.closingAt) {
            setTimeRemaining(formatTimeRemaining(data.closingAt));
          }
          if (data.isExtended) {
            setExtensionAlert('Last-minute bid! Auction extended by 60 seconds.');
            if (extensionTimerRef.current) clearTimeout(extensionTimerRef.current);
            extensionTimerRef.current = setTimeout(() => {
              setExtensionAlert(null);
            }, 8000);
          }
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
      if (extensionTimerRef.current) {
        clearTimeout(extensionTimerRef.current);
      }
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

        if (res.data.auction) {
          setMinAcceptableBid(res.data.auction.minAcceptableBid);
          setBidInput(res.data.auction.minAcceptableBid);
        }
        if (res.data.bid) {
          setBids((prev) => [res.data.bid, ...prev.filter((b) => b._id !== res.data.bid._id)]);
        }
        if (auction && res.data.auction) {
          const updatedClosing = res.data.auction.closingAt || auction.closingAt;
          setAuction({
            ...auction,
            currentLeadingBid: res.data.auction.currentLeadingBid,
            bidCount: res.data.auction.bidCount,
            currentLeadingBidderId: user,
            closingAt: updatedClosing,
          });
          if (res.data.auction.closingAt) {
            setTimeRemaining(formatTimeRemaining(res.data.auction.closingAt));
          }
          if (res.data.auction.isExtended) {
            setExtensionAlert('Last-minute bid! Auction extended by 60 seconds.');
            if (extensionTimerRef.current) clearTimeout(extensionTimerRef.current);
            extensionTimerRef.current = setTimeout(() => {
              setExtensionAlert(null);
            }, 8000);
          }
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
        <div className="w-12 h-12 border-4 border-[#C2410C] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-semibold text-[#78716C]">Loading auction listing details...</p>
      </div>
    );
  }

  if (error || !auction) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-[#292524]">Auction Listing Unavailable</h2>
        <p className="text-sm text-[#78716C]">{error || 'The requested auction listing does not exist.'}</p>
        <Link
          to="/auctions"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C2410C] text-white text-xs font-bold hover:bg-[#9A3412] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Marketplace</span>
        </Link>
      </div>
    );
  }

  const sellerObj: any = auction.sellerId;
  const isSeller = user && (user._id === sellerObj?._id || user._id === sellerObj);
  const isClosed = !isScheduled && (auction.status !== 'active' || timeRemaining.isEnded);
  const hasLeadingBid = auction.bidCount > 0 && auction.currentLeadingBid > 0;
  const remainingSeconds = auction?.closingAt
    ? (new Date(auction.closingAt).getTime() - Date.now()) / 1000
    : 0;
  const isUnder30Seconds =
    !isClosed && !isScheduled && auction.status === 'active' && remainingSeconds > 0 && remainingSeconds <= 30;

  const fallbackImage =
    'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=800&q=80';
  const images = auction.imageUrls && auction.imageUrls.length > 0 ? auction.imageUrls : [fallbackImage];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 bg-[#FFFBF5]">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/auctions"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#78716C] hover:text-[#C2410C] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Marketplace</span>
        </Link>
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="px-2.5 py-1 rounded-lg bg-[#FFEDD5] text-[#C2410C] border border-[#FED7AA] font-bold">
            {auction.category}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white text-[#292524] border border-[#E7E0D8]">
            {auction.condition}
          </span>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Image Gallery & Details (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Main Photo */}
          <div className="bg-white rounded-3xl border border-[#E7E0D8] overflow-hidden shadow-xs">
            <div className="relative aspect-4/3 w-full bg-[#FFFBF5] overflow-hidden flex items-center justify-center">
              <img
                src={images[selectedImageIndex] || fallbackImage}
                alt={auction.title}
                className="w-full h-full object-cover object-center"
              />
              {/* Status Badge Overlay */}
              <div className="absolute top-4 left-4">
                <span
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wider backdrop-blur-md shadow-md ${
                    isScheduled
                      ? 'bg-amber-600/95 text-white'
                      : auction.status === 'active' && !timeRemaining.isEnded
                      ? 'bg-[#15803D]/95 text-white'
                      : auction.status === 'reserved'
                      ? 'bg-[#C2410C]/95 text-white'
                      : auction.status === 'sold'
                      ? 'bg-[#1C1917]/95 text-white'
                      : 'bg-[#78716C]/95 text-white'
                  }`}
                >
                  {isScheduled
                    ? 'Scheduled'
                    : auction.status === 'active' && !timeRemaining.isEnded
                    ? 'Active Auction'
                    : auction.status}
                </span>
              </div>
            </div>

            {/* Gallery Thumbnails */}
            {images.length > 1 && (
              <div className="p-3 border-t border-[#E7E0D8] flex items-center gap-2 overflow-x-auto">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                      selectedImageIndex === idx ? 'border-[#C2410C] scale-105' : 'border-[#E7E0D8] opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Description Card */}
          <div className="bg-white rounded-3xl border border-[#E7E0D8] p-6 sm:p-8 space-y-4 shadow-xs">
            <h2 className="text-lg font-bold text-[#292524] border-b border-[#E7E0D8] pb-3">
              Item Details & Condition
            </h2>
            <div className="text-sm text-[#292524] leading-relaxed whitespace-pre-line">
              {auction.description}
            </div>

            {/* Verification & Handover Guarantee Box */}
            <div className="mt-6 p-4 rounded-2xl bg-[#FFFBF5] border border-[#E7E0D8] flex items-start gap-3.5">
              <ShieldCheck className="w-6 h-6 text-[#15803D] shrink-0 mt-0.5" />
              <div className="text-xs text-[#78716C] space-y-1">
                <div className="font-bold text-[#292524] text-sm">Campus Handover Policy</div>
                <p>
                  No online payment transfers are processed. Once the auction concludes, the highest bidder and 
                  seller arrange physical handover on Kongu Engineering College campus. Both parties confirm completion in-app.
                </p>
              </div>
            </div>
          </div>

          {/* Seller Profile Card */}
          <div className="bg-white rounded-3xl border border-[#E7E0D8] p-6 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#FFEDD5] border border-[#FED7AA] text-[#C2410C] font-extrabold flex items-center justify-center text-lg">
                {sellerObj?.fullName?.charAt(0)?.toUpperCase() || 'S'}
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-[#78716C]">Listed By</div>
                <div className="text-base font-bold text-[#292524]">{sellerObj?.fullName || 'Kongu Student'}</div>
                <div className="text-xs text-[#78716C] font-medium">
                  {sellerObj?.department ? `${sellerObj.department} Department` : 'Kongu Engineering College'}
                  {sellerObj?.year ? ` • Year ${sellerObj.year}` : ''}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-semibold text-[#78716C] block">Member Since</span>
              <span className="text-xs font-bold text-[#292524]">
                {sellerObj?.createdAt ? new Date(sellerObj.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '2026'}
              </span>
            </div>
          </div>

          {/* Public Questions & Answers Section */}
          <AuctionQuestionsSection
            auctionId={auction._id}
            isClosed={auction.status !== 'active' || timeRemaining.isEnded}
            sellerId={typeof auction.sellerId === 'string' ? auction.sellerId : auction.sellerId._id}
          />
        </div>

        {/* Right Column: Pricing, Live Countdown & Bid Form (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl border border-[#E7E0D8] p-6 sm:p-8 shadow-md shadow-stone-200/50 space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold text-[#292524] leading-tight">
                {auction.title}
              </h1>
              <div className="mt-2 flex items-center gap-3 text-xs text-[#78716C]">
                <span>Listed {formatDate(auction.createdAt)}</span>
                <span>•</span>
                <span className="font-semibold text-[#C2410C]">ID: {auction._id.slice(-6)}</span>
              </div>
            </div>

            {/* Price Box */}
            <div className="p-5 rounded-2xl bg-[#FFFBF5] border border-[#E7E0D8] space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#78716C] block">
                    {hasLeadingBid ? 'Current Leading Bid' : 'Starting Price'}
                  </span>
                  <div className="text-3xl font-black text-[#292524] tracking-tight mt-0.5">
                    {formatPrice(hasLeadingBid ? auction.currentLeadingBid : auction.startingPrice)}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#78716C] block">
                    Total Bids
                  </span>
                  <div className="flex items-center justify-end gap-1 text-base font-extrabold text-[#C2410C] mt-0.5">
                    <Flame className="w-4 h-4 fill-[#C2410C]" />
                    <span>{auction.bidCount}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E7E0D8] flex items-center justify-between text-xs text-[#78716C]">
                <span>Min Bid Increment: <strong className="text-[#292524]">+₹{auction.minimumBidIncrement}</strong></span>
                <span>Starting: <strong className="text-[#292524]">{formatPrice(auction.startingPrice)}</strong></span>
              </div>
            </div>

            {/* Countdown / Opening Timer */}
            <div
              className={`p-4 rounded-2xl border text-center transition-all ${
                isScheduled
                  ? 'bg-amber-500/10 border-amber-300 text-amber-900'
                  : isClosed
                  ? 'bg-[#1C1917] text-white border-stone-800'
                  : timeRemaining.isUrgent
                  ? 'bg-[#C2410C] text-white border-[#C2410C]'
                  : 'bg-[#FFEDD5]/60 border-[#FED7AA] text-[#9A3412]'
              }`}
            >
              <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider">
                {isScheduled ? <Calendar className="w-4 h-4 text-amber-700" /> : <Clock className="w-4 h-4" />}
                <span>
                  {isScheduled
                    ? 'Bidding Opens In'
                    : isClosed
                    ? 'Auction Closed'
                    : 'Auction Closes In'}
                </span>
              </div>
              <div className="text-2xl font-black tracking-tight mt-1">
                {isScheduled ? timeUntilOpen.text : timeRemaining.text}
              </div>
              <div className="text-[11px] opacity-80 mt-0.5">
                {isScheduled && auction.startTime
                  ? `Opening: ${formatISTDateTime(auction.startTime)}`
                  : `Closing: ${formatISTDateTime(auction.closingAt)}`}
              </div>
            </div>

            {/* Anti-Sniping Alert Banner: Extension Occurred */}
            {extensionAlert && (
              <div className="p-3.5 rounded-2xl bg-orange-50 border-2 border-[#C2410C] text-[#C2410C] shadow-xs text-xs font-bold flex items-center justify-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                <Clock className="w-4 h-4 shrink-0 animate-spin" />
                <span>⏱️ Last-minute bid! Auction extended by 60 seconds.</span>
              </div>
            )}

            {/* Anti-Sniping Warning Banner: Ending in <= 30 seconds */}
            {!isClosed && !isScheduled && isUnder30Seconds && !extensionAlert && (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold flex items-center justify-center gap-2 animate-pulse shadow-2xs">
                <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                <span>⚡ Ending soon — valid bids may extend this auction.</span>
              </div>
            )}

            {/* Outcome Display: Scheduled / Closed / Seller / Student Bid Form */}
            {isScheduled ? (
              <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-2.5">
                <Calendar className="w-8 h-8 text-amber-600 mx-auto" />
                <div className="text-sm font-extrabold text-[#292524]">
                  Bidding Opens on {auction.startTime ? formatISTDateTime(auction.startTime) : 'Scheduled Date'}
                </div>
                <p className="text-xs text-[#78716C] max-w-sm mx-auto">
                  This auction is currently scheduled. Bids and automatic bidding will unlock once the opening time arrives.
                </p>
                <div className="pt-2 text-xs font-bold text-[#C2410C]">
                  Starting Price: {formatPrice(auction.startingPrice)}
                </div>
              </div>
            ) : isClosed ? (
              <div className="p-5 rounded-2xl bg-[#FFFBF5] border border-[#E7E0D8] text-center space-y-2">
                <Trophy className="w-8 h-8 text-[#C2410C] mx-auto" />
                <div className="text-sm font-extrabold text-[#292524]">
                  {auction.status === 'reserved' || auction.status === 'sold'
                    ? `Item Won for ${formatPrice(auction.currentLeadingBid)}`
                    : 'Auction Closed Unsold'}
                </div>
                <p className="text-xs text-[#78716C]">
                  {auction.status === 'reserved' || auction.status === 'sold'
                    ? 'The item is reserved for the winning student to complete campus handover.'
                    : 'No valid bids were submitted before the closing deadline.'}
                </p>
                {user && (
                  <Link
                    to="/transactions"
                    className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    <span>View Handover Status</span>
                  </Link>
                )}
              </div>
            ) : isSeller ? (
              /* Seller Disabled View */
              <div className="p-4 rounded-2xl bg-[#FFEDD5]/60 border border-[#FED7AA] text-[#9A3412] text-xs flex items-start gap-3">
                <Lock className="w-4 h-4 shrink-0 mt-0.5 text-[#C2410C]" />
                <div>
                  <div className="font-bold">You are the seller of this auction</div>
                  <p className="mt-0.5 text-[#9A3412]">
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
                        ? 'bg-emerald-50 border border-emerald-200 text-[#15803D]'
                        : 'bg-rose-50 border border-rose-200 text-rose-800'
                    }`}
                  >
                    {bidFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span>{bidFeedback.message}</span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#78716C]">
                      Your Bid Amount (₹)
                    </label>
                    <span className="text-xs text-[#C2410C] font-bold">
                      Min Valid: ₹{minAcceptableBid}
                    </span>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#78716C] font-bold">
                      <IndianRupee className="w-5 h-5 text-[#292524]" />
                    </div>
                    <input
                      type="number"
                      required
                      min={minAcceptableBid}
                      value={bidInput}
                      onChange={(e) =>
                        setBidInput(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      className="w-full pl-11 pr-4 py-3 bg-[#FFFBF5] border border-[#E7E0D8] rounded-2xl text-xl font-black text-[#292524] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C2410C]"
                    />
                  </div>

                  {/* Preset increment buttons */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="text-[11px] text-[#78716C] font-medium">Quick Add:</span>
                    <button
                      type="button"
                      onClick={() => addPreset(20)}
                      className="px-2.5 py-1 text-xs font-bold bg-[#FFFBF5] border border-[#E7E0D8] hover:bg-[#FFEDD5] hover:text-[#C2410C] rounded-lg text-[#292524] transition-colors"
                    >
                      +₹20
                    </button>
                    <button
                      type="button"
                      onClick={() => addPreset(50)}
                      className="px-2.5 py-1 text-xs font-bold bg-[#FFFBF5] border border-[#E7E0D8] hover:bg-[#FFEDD5] hover:text-[#C2410C] rounded-lg text-[#292524] transition-colors"
                    >
                      +₹50
                    </button>
                    <button
                      type="button"
                      onClick={() => addPreset(100)}
                      className="px-2.5 py-1 text-xs font-bold bg-[#FFFBF5] border border-[#E7E0D8] hover:bg-[#FFEDD5] hover:text-[#C2410C] rounded-lg text-[#292524] transition-colors"
                    >
                      +₹100
                    </button>
                  </div>
                </div>

                {user ? (
                  <button
                    type="submit"
                    disabled={placingBid}
                    className="w-full py-4 px-6 rounded-2xl bg-[#C2410C] hover:bg-[#9A3412] text-white text-base font-extrabold shadow-lg shadow-[#C2410C]/25 disabled:opacity-70 transition-all flex items-center justify-center gap-2"
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
                    className="w-full py-4 px-6 rounded-2xl bg-[#292524] hover:bg-[#1C1917] text-white text-sm font-extrabold text-center block transition-all shadow-md"
                  >
                    Log In to Bid with @kongu.edu
                  </Link>
                )}
              </form>
            )}
          </div>

          {/* Automatic Bidding (Proxy Bidding) Card */}
          {auction && !isScheduled && (
            <AutoBidCard
              auction={auction}
              isSeller={Boolean(isSeller)}
              currentUser={user}
              onBidUpdated={loadAuctionData}
            />
          )}
        </div>
      </div>

      {/* Public Bid History Section */}
      <div className="bg-white rounded-3xl border border-[#E7E0D8] p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-[#E7E0D8] pb-4">
          <div>
            <h2 className="text-lg font-bold text-[#292524] flex items-center gap-2">
              <span>Public Bid History</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FFEDD5] text-[#C2410C]">
                {bids.length}
              </span>
            </h2>
            <p className="text-xs text-[#78716C] mt-0.5">
              Transparent live history. Private emails and passwords are never exposed.
            </p>
          </div>
        </div>

        {bids.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <Sparkles className="w-8 h-8 text-[#78716C]/40 mx-auto" />
            <div className="text-sm font-bold text-[#292524]">No bids yet on this auction</div>
            <p className="text-xs text-[#78716C] max-w-sm mx-auto">
              Be the first Kongu student to place a bid starting at {formatPrice(auction.startingPrice)}!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E7E0D8]">
            {bids.map((bid, index) => {
              const bidder: any = bid.bidderId;
              const isLeading = index === 0;

              return (
                <div
                  key={bid._id}
                  className={`py-3.5 px-3 rounded-xl flex items-center justify-between transition-colors ${
                    isLeading ? 'bg-[#FFEDD5]/35 font-medium' : 'hover:bg-[#FFFBF5]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                        isLeading
                          ? 'bg-[#C2410C] text-white shadow-xs'
                          : 'bg-[#FFFBF5] text-[#78716C] border border-[#E7E0D8]'
                      }`}
                    >
                      {bidder?.fullName?.charAt(0)?.toUpperCase() || 'K'}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#292524]">
                          {bidder?.fullName || 'Kongu Student'}
                        </span>
                        {isLeading && (
                          <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-[#C2410C] text-white rounded-md shadow-xs">
                            Leading Bid
                          </span>
                        )}
                        {bid.bidSource === 'AUTO' && (
                          <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-orange-50 border border-orange-200 text-[#C2410C] rounded-md shadow-2xs flex items-center gap-1">
                            <Bot className="w-3 h-3" />
                            <span>Auto</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#78716C]">
                        {bidder?.department ? `${bidder.department} Department` : 'Kongu Campus'} • {formatDate(bid.createdAt)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-black text-[#292524] tracking-tight">
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
