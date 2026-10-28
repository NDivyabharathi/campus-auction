import React, { useState } from 'react';
import {
  Tag,
  Layers,
  IndianRupee,
  ShieldCheck,
  Clock,
  Pause,
  Play,
  RotateCcw,
  CheckCircle,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import { formatPrice } from '../utils/formatters.js';
import type { Want } from '../types/index.js';

interface WantCardProps {
  want: Want;
  onViewMatches: (want: Want) => void;
  onToggleStatus: (want: Want) => void;
  onRenew: (want: Want) => void;
  onFulfill: (want: Want) => void;
  onDelete: (want: Want) => void;
}

export const WantCard: React.FC<WantCardProps> = ({
  want,
  onViewMatches,
  onToggleStatus,
  onRenew,
  onFulfill,
  onDelete,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Expiration calculation
  const expiresAtDate = new Date(want.expiresAt);
  const now = new Date();
  const diffMs = expiresAtDate.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isExpired = want.status === 'EXPIRED' || (want.status !== 'FULFILLED' && daysLeft <= 0);

  const getStatusBadge = () => {
    switch (want.status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </span>
        );
      case 'PAUSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Pause className="w-3 h-3" />
            Paused
          </span>
        );
      case 'FULFILLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <CheckCircle className="w-3 h-3" />
            Fulfilled
          </span>
        );
      case 'EXPIRED':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-600 border border-stone-200">
            <Clock className="w-3 h-3" />
            Expired
          </span>
        );
    }
  };

  return (
    <div className="bg-card-bg rounded-2xl border border-border-warm hover:border-orange-300 hover:shadow-xs transition-all flex flex-col justify-between overflow-hidden">
      <div className="p-5">
        {/* Header: Keywords and Status */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-orange-100 text-[#C2410C]">
                <Tag className="w-4 h-4" />
              </span>
              <h3 className="font-bold text-base text-primary-text line-clamp-1">
                {want.keywords}
              </h3>
            </div>
          </div>
          <div className="shrink-0">{getStatusBadge()}</div>
        </div>

        {/* Criteria Badges */}
        <div className="flex flex-wrap gap-2 my-3">
          {want.category ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#FFFBF5] border border-border-warm text-stone-700">
              <Layers className="w-3 h-3 text-[#C2410C]" />
              {want.category}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#FFFBF5] border border-border-warm text-stone-500">
              <Layers className="w-3 h-3 text-stone-400" />
              All Categories
            </span>
          )}

          {want.maxPrice ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#FFFBF5] border border-border-warm text-stone-700">
              <IndianRupee className="w-3 h-3 text-[#C2410C]" />
              Max: {formatPrice(want.maxPrice)}
            </span>
          ) : null}

          {want.condition ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#FFFBF5] border border-border-warm text-stone-700">
              <ShieldCheck className="w-3 h-3 text-[#C2410C]" />
              {want.condition}+
            </span>
          ) : null}
        </div>

        {/* Matches & Expiration Info */}
        <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
          <button
            onClick={() => onViewMatches(want)}
            className="group inline-flex items-center gap-1.5 font-semibold text-[#C2410C] hover:text-[#9A3412] transition-colors"
          >
            <span className="px-2 py-0.5 rounded-full bg-orange-100 group-hover:bg-orange-200 transition-colors">
              {want.matchCount} {want.matchCount === 1 ? 'match' : 'matches'}
            </span>
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>

          <span className="text-secondary-text">
            {want.status === 'FULFILLED' ? (
              <span className="text-purple-600 font-medium">Item found</span>
            ) : isExpired ? (
              <span className="text-red-500 font-medium">Expired</span>
            ) : (
              <span>{daysLeft} days left</span>
            )}
          </span>
        </div>
      </div>

      {/* Delete Confirmation prompt */}
      {showDeleteConfirm ? (
        <div className="px-5 py-3 bg-red-50 border-t border-red-100 flex items-center justify-between gap-2 text-xs">
          <span className="text-red-700 font-medium">Delete this saved want?</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-2.5 py-1 rounded-md text-stone-600 hover:bg-stone-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onDelete(want)}
              className="px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      ) : (
        /* Action buttons bar */
        <div className="px-5 py-2.5 bg-[#FFFBF5] border-t border-border-warm flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            {/* Pause / Resume */}
            {want.status === 'ACTIVE' && (
              <button
                onClick={() => onToggleStatus(want)}
                title="Pause active alerts"
                className="p-1.5 rounded-lg text-secondary-text hover:text-amber-700 hover:bg-amber-50 transition-colors"
              >
                <Pause className="w-4 h-4" />
              </button>
            )}
            {want.status === 'PAUSED' && (
              <button
                onClick={() => onToggleStatus(want)}
                title="Resume alerts"
                className="p-1.5 rounded-lg text-secondary-text hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
              >
                <Play className="w-4 h-4" />
              </button>
            )}

            {/* Renew for 30 days if expired */}
            {(isExpired || want.status === 'EXPIRED') && (
              <button
                onClick={() => onRenew(want)}
                title="Renew for 30 days"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-orange-100 hover:bg-orange-200 text-[#C2410C] transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Renew</span>
              </button>
            )}

            {/* Mark Fulfilled */}
            {want.status !== 'FULFILLED' && (
              <button
                onClick={() => onFulfill(want)}
                title="Mark as fulfilled (I found this item)"
                className="p-1.5 rounded-lg text-secondary-text hover:text-purple-700 hover:bg-purple-50 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Delete */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            title="Delete saved want"
            className="p-1.5 rounded-lg text-secondary-text hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
