import React from 'react';
import { Link } from 'react-router-dom';
import { Gavel, ArrowUpRight, ShieldCheck } from 'lucide-react';
import type { BidRecommendation } from '../types/index.js';
import { formatPrice } from '../utils/formatters.js';

interface AssistantBidCardProps {
  recommendation: BidRecommendation;
  onNavigate?: () => void;
}

export const AssistantBidCard: React.FC<AssistantBidCardProps> = ({ recommendation, onNavigate }) => {
  const hasBids = recommendation.bidCount > 0;

  return (
    <div className="bg-white rounded-xl border border-[#FED7AA] p-3.5 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[#FFEDD5] text-[#C2410C] flex items-center justify-center shrink-0">
          <Gavel className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#C2410C] block">
            Bid Recommendation
          </span>
          <h4 className="text-xs font-bold text-[#292524] truncate" title={recommendation.title}>
            {recommendation.title}
          </h4>
        </div>
      </div>

      {/* Current Bid Breakdown */}
      <div className="grid grid-cols-2 gap-2 text-xs bg-[#FFFBF5] p-2.5 rounded-lg border border-[#E7E0D8]/80">
        <div>
          <span className="text-[10px] text-[#78716C] block">
            {hasBids ? `Current Bid (${recommendation.bidCount} bids)` : 'Starting Price'}
          </span>
          <span className="font-bold text-[#292524]">
            {formatPrice(hasBids ? recommendation.currentLeadingBid : recommendation.startingPrice)}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-[#78716C] block">Min Increment</span>
          <span className="font-bold text-[#78716C]">+{formatPrice(recommendation.minimumBidIncrement)}</span>
        </div>
      </div>

      {/* Suggested Minimum Next Bid Box */}
      <div className="bg-[#FFEDD5]/60 border border-[#FED7AA] rounded-xl p-3 text-center">
        <span className="text-[11px] font-bold text-[#9A3412] uppercase tracking-wide block">
          Minimum Valid Next Bid
        </span>
        <div className="text-xl font-extrabold text-[#C2410C] mt-0.5">
          {formatPrice(recommendation.minimumNextBid)}
        </div>
      </div>

      {/* Explanation text */}
      <div className="flex items-start gap-2 text-[11px] text-[#78716C] bg-stone-50 p-2 rounded-lg border border-[#E7E0D8]">
        <ShieldCheck className="w-3.5 h-3.5 text-[#15803D] shrink-0 mt-0.5" />
        <p className="leading-relaxed">{recommendation.explanation}</p>
      </div>

      {/* Navigation CTA: Explicit Manual Confirmation Only */}
      <div className="pt-1">
        <Link
          to={`/auctions/${recommendation.auctionId}`}
          onClick={onNavigate}
          className="w-full py-2.5 px-3 rounded-lg bg-[#C2410C] hover:bg-[#9A3412] text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
        >
          <span>Open Auction to Place Bid</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
        <span className="text-[10px] text-center block text-[#78716C] mt-1.5">
          Campus safety rule: Bids must be reviewed and confirmed manually by you.
        </span>
      </div>
    </div>
  );
};
