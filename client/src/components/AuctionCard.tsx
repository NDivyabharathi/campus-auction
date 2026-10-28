import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock, ArrowUpRight, Flame, ShieldCheck, Calendar } from 'lucide-react';
import type { Auction } from '../types/index.js';
import { formatPrice, formatTimeRemaining, formatTimeUntil } from '../utils/formatters.js';

interface AuctionCardProps {
  auction: Auction;
}

export const AuctionCard: React.FC<AuctionCardProps> = ({ auction }) => {
  const [time, setTime] = useState(() => formatTimeRemaining(auction.closingAt));
  const [imgError, setImgError] = useState(false);

  const isScheduled =
    auction.status === 'scheduled' ||
    (Boolean(auction.startTime) && new Date(auction.startTime!).getTime() > Date.now());

  const [openTime, setOpenTime] = useState(() =>
    auction.startTime ? formatTimeUntil(auction.startTime) : { text: '', isStarted: true }
  );

  useEffect(() => {
    if (!isScheduled || !auction.startTime) return;
    const timer = setInterval(() => {
      setOpenTime(formatTimeUntil(auction.startTime!));
    }, 1000);
    return () => clearInterval(timer);
  }, [isScheduled, auction.startTime]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(formatTimeRemaining(auction.closingAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [auction.closingAt]);

  const hasLeadingBid = auction.bidCount > 0 && auction.currentLeadingBid > 0;
  const isClosed = !isScheduled && (auction.status !== 'active' || time.isEnded);

  const fallbackImage =
    'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=800&q=80';
  const displayImage =
    !imgError && auction.imageUrls && auction.imageUrls.length > 0
      ? auction.imageUrls[0]
      : fallbackImage;

  return (
    <div className="group bg-white rounded-2xl border border-[#E7E0D8] shadow-xs hover:shadow-xl hover:shadow-[#C2410C]/8 hover:border-[#FED7AA] transition-all duration-300 flex flex-col overflow-hidden">
      {/* Image and badges */}
      <div className="relative aspect-4/3 w-full bg-[#FFFBF5] overflow-hidden">
        <img
          src={displayImage}
          alt={auction.title}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        {/* Category Pill (Pale Peach Accent) */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <span className="px-2.5 py-1 text-xs font-bold bg-white/95 backdrop-blur-md text-[#C2410C] rounded-lg shadow-xs border border-[#E7E0D8]">
            {auction.category}
          </span>
        </div>

        {/* Condition Badge (Dark Surface) */}
        <div className="absolute top-3 right-3">
          <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-[#1C1917]/85 backdrop-blur-md text-white rounded-lg shadow-xs">
            {auction.condition}
          </span>
        </div>

        {/* Time Remaining / Scheduled Bar */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5">
          <div
            className={`px-3 py-1.5 rounded-xl backdrop-blur-md text-xs font-semibold flex items-center justify-between shadow-sm border ${
              isScheduled
                ? 'bg-stone-900/90 text-amber-200 border-amber-600/40'
                : isClosed
                ? 'bg-[#1C1917]/90 text-stone-200 border-stone-800'
                : time.isUrgent
                ? 'bg-[#C2410C]/95 text-white border-[#C2410C] animate-pulse'
                : 'bg-white/95 text-[#292524] border-[#E7E0D8]'
            }`}
          >
            <div className="flex items-center gap-1.5">
              {isScheduled ? <Calendar className="w-3.5 h-3.5 text-amber-400" /> : <Clock className="w-3.5 h-3.5" />}
              <span>{isScheduled ? openTime.text : isClosed ? 'Closed' : time.text}</span>
            </div>
            {isScheduled ? (
              <span className="text-[10px] uppercase font-extrabold text-amber-400 tracking-wider">
                Scheduled
              </span>
            ) : auction.bidCount > 0 && !isClosed ? (
              <div className="flex items-center gap-1 text-[#C2410C]">
                <Flame className="w-3.5 h-3.5 fill-[#C2410C]" />
                <span className="text-[11px] font-bold">{auction.bidCount} bids</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-[#292524] text-base leading-snug line-clamp-1 group-hover:text-[#C2410C] transition-colors">
            {auction.title}
          </h3>
          <p className="mt-1 text-xs text-[#78716C] line-clamp-2 leading-relaxed">
            {auction.description}
          </p>
        </div>

        <div className="mt-4 pt-3.5 border-t border-[#E7E0D8]">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-[#78716C] block">
                {hasLeadingBid ? 'Leading Bid' : 'Starting Price'}
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-extrabold text-[#292524] tracking-tight">
                  {formatPrice(hasLeadingBid ? auction.currentLeadingBid : auction.startingPrice)}
                </span>
                {!hasLeadingBid && (
                  <span className="text-[11px] text-[#78716C] font-medium">(No bids yet)</span>
                )}
              </div>
            </div>

            <Link
              to={`/auctions/${auction._id}`}
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#FFEDD5] hover:bg-[#C2410C] text-[#C2410C] hover:text-white transition-all shadow-xs group/btn"
            >
              <span>{isClosed ? 'Outcome' : 'Bid Now'}</span>
              <ArrowUpRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
            </Link>
          </div>

          {/* Seller dept tag */}
          <div className="mt-3 flex items-center justify-between text-[11px] text-[#78716C] font-medium">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#15803D]" />
              <span>Kongu Student</span>
            </span>
            <span>Min +₹{auction.minimumBidIncrement}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
