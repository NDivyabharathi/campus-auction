import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock, ArrowUpRight, Flame, ShieldCheck } from 'lucide-react';
import type { Auction } from '../types/index.js';
import { formatPrice, formatTimeRemaining } from '../utils/formatters.js';

interface AuctionCardProps {
  auction: Auction;
}

export const AuctionCard: React.FC<AuctionCardProps> = ({ auction }) => {
  const [time, setTime] = useState(() => formatTimeRemaining(auction.closingAt));
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(formatTimeRemaining(auction.closingAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [auction.closingAt]);

  const hasLeadingBid = auction.bidCount > 0 && auction.currentLeadingBid > 0;
  const isClosed = auction.status !== 'active' || time.isEnded;

  const fallbackImage =
    'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=800&q=80';
  const displayImage =
    !imgError && auction.imageUrls && auction.imageUrls.length > 0
      ? auction.imageUrls[0]
      : fallbackImage;

  return (
    <div className="group bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-300 transition-all duration-300 flex flex-col overflow-hidden">
      {/* Image and badges */}
      <div className="relative aspect-4/3 w-full bg-slate-100 overflow-hidden">
        <img
          src={displayImage}
          alt={auction.title}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        {/* Category Pill */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <span className="px-2.5 py-1 text-xs font-semibold bg-white/90 backdrop-blur-md text-slate-800 rounded-lg shadow-xs border border-white/60">
            {auction.category}
          </span>
        </div>

        {/* Condition Badge */}
        <div className="absolute top-3 right-3">
          <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-slate-900/80 backdrop-blur-md text-white rounded-lg shadow-xs">
            {auction.condition}
          </span>
        </div>

        {/* Time Remaining Bar */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5">
          <div
            className={`px-3 py-1.5 rounded-xl backdrop-blur-md text-xs font-semibold flex items-center justify-between shadow-sm border ${
              isClosed
                ? 'bg-slate-900/85 text-slate-200 border-slate-700'
                : time.isUrgent
                ? 'bg-rose-600/90 text-white border-rose-400 animate-pulse'
                : 'bg-white/95 text-slate-800 border-white/80'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>{isClosed ? 'Closed' : time.text}</span>
            </div>
            {auction.bidCount > 0 && !isClosed && (
              <div className="flex items-center gap-1 text-amber-500">
                <Flame className="w-3.5 h-3.5 fill-amber-500" />
                <span className="text-[11px] font-bold">{auction.bidCount} bids</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-1 group-hover:text-indigo-600 transition-colors">
            {auction.title}
          </h3>
          <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {auction.description}
          </p>
        </div>

        <div className="mt-4 pt-3.5 border-t border-slate-100">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">
                {hasLeadingBid ? 'Leading Bid' : 'Starting Price'}
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-extrabold text-slate-900 tracking-tight">
                  {formatPrice(hasLeadingBid ? auction.currentLeadingBid : auction.startingPrice)}
                </span>
                {!hasLeadingBid && (
                  <span className="text-[11px] text-slate-400 font-medium">(No bids yet)</span>
                )}
              </div>
            </div>

            <Link
              to={`/auctions/${auction._id}`}
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 transition-all shadow-xs group/btn"
            >
              <span>{isClosed ? 'Outcome' : 'Bid Now'}</span>
              <ArrowUpRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
            </Link>
          </div>

          {/* Seller dept tag */}
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
              <span>Kongu Student</span>
            </span>
            <span>Min +₹{auction.minimumBidIncrement}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
