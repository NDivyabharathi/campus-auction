import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  X,
  ExternalLink,
  Tag,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { wantService } from '../services/wantService.js';
import { formatPrice, formatTimeRemaining } from '../utils/formatters.js';
import type { Want, WantMatch } from '../types/index.js';

interface WantMatchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  want: Want | null;
}

export const WantMatchesModal: React.FC<WantMatchesModalProps> = ({
  isOpen,
  onClose,
  want,
}) => {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<WantMatch[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !want) return;

    const fetchMatches = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await wantService.getWantMatches(want._id);
        if (res.success) {
          setMatches(res.matches);
        }
      } catch (err: any) {
        console.error(err);
        setError(err.response?.data?.message || 'Failed to fetch matching listings.');
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, [isOpen, want]);

  if (!isOpen || !want) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="relative w-full max-w-2xl bg-card-bg rounded-2xl border border-border-warm shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-warm bg-[#FFFBF5] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-orange-100 text-primary-600">
              <Sparkles className="w-5 h-5 text-[#C2410C]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-primary-text">
                  Matches for &ldquo;{want.keywords}&rdquo;
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-[#C2410C]">
                  {matches.length} {matches.length === 1 ? 'match' : 'matches'}
                </span>
              </div>
              <p className="text-xs text-secondary-text">
                Live listings meeting your saved criteria
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-secondary-text hover:text-primary-text hover:bg-stone-200/50 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-secondary-text">
              <div className="w-8 h-8 border-3 border-orange-200 border-t-[#C2410C] rounded-full animate-spin" />
              <p className="text-xs">Finding matching campus listings...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 text-center">
              {error}
            </div>
          ) : matches.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center mb-3">
                <Tag className="w-6 h-6 text-orange-400" />
              </div>
              <h3 className="text-sm font-bold text-primary-text mb-1">No Matching Listings Right Now</h3>
              <p className="text-xs text-secondary-text max-w-sm">
                No active listings currently match these keywords and filters. We monitor new listings 24/7 and will send you an in-app alert as soon as a student publishes one!
              </p>
            </div>
          ) : (
            matches.map((m) => {
              const listing = m.listing;
              if (!listing) return null;
              const timeRem = formatTimeRemaining(listing.closingAt);

              return (
                <div
                  key={m._id}
                  className="p-4 rounded-xl border border-border-warm bg-white hover:border-orange-300 hover:shadow-xs transition-all flex flex-col sm:flex-row gap-4"
                >
                  {/* Thumbnail */}
                  <div className="w-full sm:w-28 h-28 rounded-lg overflow-hidden bg-stone-100 shrink-0 border border-stone-200">
                    {listing.imageUrls && listing.imageUrls[0] ? (
                      <img
                        src={listing.imageUrls[0]}
                        alt={listing.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-400">
                        <Tag className="w-8 h-8 opacity-40" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to={`/auctions/${listing._id}`}
                          onClick={onClose}
                          className="font-semibold text-sm text-primary-text hover:text-[#C2410C] transition-colors line-clamp-1"
                        >
                          {listing.title}
                        </Link>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                            timeRem.isEnded
                              ? 'bg-stone-100 text-stone-600'
                              : timeRem.isUrgent
                              ? 'bg-red-50 text-red-600 border border-red-200'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {timeRem.text}
                        </span>
                      </div>

                      {/* Criteria verification pill */}
                      <div className="mt-1.5 flex items-start gap-1.5 p-2 rounded-lg bg-orange-50/70 border border-orange-100 text-[11px] text-stone-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#C2410C] shrink-0 mt-0.5" />
                        <span className="font-medium">{m.matchReason}</span>
                      </div>
                    </div>

                    {/* Metadata & Actions */}
                    <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs">
                        <div>
                          <span className="text-[10px] text-secondary-text block">Starting Price</span>
                          <span className="font-bold text-primary-text">
                            {formatPrice(listing.startingPrice)}
                          </span>
                        </div>
                        {listing.currentLeadingBid ? (
                          <div className="pl-3 border-l border-stone-200">
                            <span className="text-[10px] text-secondary-text block">Current Bid</span>
                            <span className="font-bold text-[#C2410C]">
                              {formatPrice(listing.currentLeadingBid)}
                            </span>
                          </div>
                        ) : null}
                      </div>

                      <Link
                        to={`/auctions/${listing._id}`}
                        onClick={onClose}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C2410C] hover:bg-[#9A3412] text-white text-xs font-semibold shadow-2xs transition-colors"
                      >
                        <span>View Auction</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border-warm bg-[#FFFBF5] shrink-0 flex items-center justify-between text-xs text-secondary-text">
          <span>Alerts are automatically triggered when matching listings are published</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-border-warm bg-white text-primary-text hover:bg-stone-50 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
