import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import type { AssistantItem } from '../types/index.js';
import { formatTimeRemaining, formatPrice } from '../utils/formatters.js';

interface AssistantAuctionCardProps {
  item: AssistantItem;
  onNavigate?: () => void;
}

export const AssistantAuctionCard: React.FC<AssistantAuctionCardProps> = ({ item, onNavigate }) => {
  const [imgError, setImgError] = useState(false);
  const time = formatTimeRemaining(item.closingAt);

  const fallbackImage =
    'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=800&q=80';
  const displayImage = !imgError && item.imageUrl ? item.imageUrl : fallbackImage;

  const hasBids = item.bidCount > 0;

  return (
    <div className="bg-white rounded-xl border border-[#E7E0D8] p-3 shadow-xs hover:border-[#FED7AA] hover:shadow-sm transition-all duration-200 flex flex-col gap-2.5">
      <div className="flex gap-3 items-start">
        {/* Thumbnail */}
        <div className="w-16 h-16 rounded-lg bg-[#FFFBF5] overflow-hidden shrink-0 border border-[#E7E0D8]">
          <img
            src={displayImage}
            alt={item.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>

        {/* Title & Badges */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#FFEDD5] text-[#C2410C] rounded-md">
              {item.category}
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-[#FFFBF5] text-[#78716C] border border-[#E7E0D8] rounded-md">
              {item.condition}
            </span>
          </div>

          <h4 className="text-xs font-bold text-[#292524] truncate" title={item.title}>
            {item.title}
          </h4>

          {/* Time Remaining */}
          <div className="flex items-center gap-1 text-[11px] text-[#78716C] mt-1">
            <Clock className="w-3 h-3 text-[#C2410C]" />
            <span>{time.text}</span>
          </div>
        </div>
      </div>

      {/* Pricing Row */}
      <div className="bg-[#FFFBF5] rounded-lg p-2 border border-[#E7E0D8]/60 flex items-center justify-between text-xs">
        <div>
          <span className="text-[10px] text-[#78716C] block font-medium">
            {hasBids ? `Current Bid (${item.bidCount} bids)` : 'Starting Price'}
          </span>
          <span className="font-extrabold text-[#C2410C]">
            {formatPrice(hasBids ? item.currentLeadingBid : item.startingPrice)}
          </span>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-[#78716C] block font-medium">Min Next Bid</span>
          <span className="font-bold text-[#292524]">{formatPrice(item.minimumNextBid)}</span>
        </div>
      </div>

      {/* Match Reason Pill */}
      {item.matchReason && (
        <div className="flex items-center gap-1.5 text-[11px] text-[#15803D] bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          <span className="truncate">{item.matchReason}</span>
        </div>
      )}

      {/* CTA Button */}
      <Link
        to={`/auctions/${item.id}`}
        onClick={onNavigate}
        className="w-full py-2 px-3 rounded-lg bg-[#C2410C] hover:bg-[#9A3412] text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
      >
        <span>View Auction & Bid</span>
        <ArrowUpRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
};
