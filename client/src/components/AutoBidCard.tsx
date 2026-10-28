import React, { useState, useEffect, useCallback } from 'react';
import {
  Bot,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Pause,
  Play,
  Trash2,
  IndianRupee,
  Lock,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import type { Auction, AutoBid } from '../types/index.js';
import {
  getMyAutoBid,
  enableAutoBid,
  updateAutoBid,
  disableAutoBid,
} from '../services/autoBidService.js';
import { formatPrice } from '../utils/formatters.js';

interface AutoBidCardProps {
  auction: Auction;
  isSeller: boolean;
  currentUser: any;
  onBidUpdated?: () => void;
}

export const AutoBidCard: React.FC<AutoBidCardProps> = ({
  auction,
  isSeller,
  currentUser,
  onBidUpdated,
}) => {
  const [autoBid, setAutoBid] = useState<AutoBid | null>(null);
  const [isLeading, setIsLeading] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form input state
  const [maxAmountInput, setMaxAmountInput] = useState<string>('');
  const [isEditingMax, setIsEditingMax] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [showDisableModal, setShowDisableModal] = useState<boolean>(false);

  const isAuctionClosed =
    auction.status !== 'active' || new Date(auction.closingAt).getTime() <= Date.now();

  // Determine minimum acceptable max amount:
  // If auction has bids: currentLeadingBid + minimumBidIncrement
  // If no bids yet: startingPrice
  const minValidMax =
    auction.bidCount > 0
      ? auction.currentLeadingBid + auction.minimumBidIncrement
      : auction.startingPrice;

  // Load auto-bid status for current user
  const fetchAutoBid = useCallback(async () => {
    if (!currentUser || isSeller || isAuctionClosed) return;
    try {
      setLoading(true);
      const res = await getMyAutoBid(auction._id);
      if (res.success) {
        setAutoBid(res.autoBid);
        setIsLeading(res.isLeading);
      }
    } catch (err: any) {
      // 404 or other non-critical errors
      console.warn('[AutoBid] Fetch error:', err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [auction._id, currentUser, isSeller, isAuctionClosed]);

  useEffect(() => {
    fetchAutoBid();
  }, [fetchAutoBid, auction.currentLeadingBid, auction.bidCount]);

  if (!currentUser || isSeller || isAuctionClosed) {
    return null;
  }

  // Handle Enable submission
  const handleEnable = async () => {
    const amount = Number(maxAmountInput);
    if (!amount || amount < minValidMax) {
      setError(`Your maximum bid must be at least ₹${minValidMax}.`);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccessMsg(null);
      const res = await enableAutoBid(auction._id, amount);
      if (res.success) {
        setAutoBid(res.autoBid);
        setShowConfirmModal(false);
        setMaxAmountInput('');
        setSuccessMsg(res.message || 'Automatic bidding activated!');
        if (onBidUpdated) onBidUpdated();
        await fetchAutoBid();
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to activate automatic bidding.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Update Max submission
  const handleUpdateMax = async () => {
    const amount = Number(maxAmountInput);
    if (!amount || amount <= 0) {
      setError('Please enter a valid rupee amount.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccessMsg(null);
      const res = await updateAutoBid(auction._id, { maxAmount: amount });
      if (res.success) {
        setAutoBid(res.autoBid);
        setIsEditingMax(false);
        setMaxAmountInput('');
        setSuccessMsg('Your maximum bid amount was updated successfully.');
        if (onBidUpdated) onBidUpdated();
        await fetchAutoBid();
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update maximum bid.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Pause / Resume toggle
  const handleToggleStatus = async () => {
    if (!autoBid) return;
    const newStatus = autoBid.status === 'active' ? 'paused' : 'active';
    try {
      setSubmitting(true);
      setError(null);
      setSuccessMsg(null);
      const res = await updateAutoBid(auction._id, { status: newStatus });
      if (res.success) {
        setAutoBid(res.autoBid);
        setSuccessMsg(
          newStatus === 'active'
            ? 'Automatic bidding resumed.'
            : 'Automatic bidding paused.'
        );
        if (onBidUpdated) onBidUpdated();
        await fetchAutoBid();
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to toggle status.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Disable
  const handleDisable = async () => {
    try {
      setSubmitting(true);
      setError(null);
      setSuccessMsg(null);
      const res = await disableAutoBid(auction._id);
      if (res.success) {
        setAutoBid((prev) => (prev ? { ...prev, status: 'disabled' } : null));
        setShowDisableModal(false);
        setSuccessMsg('Automatic bidding disabled. Existing bids remain in bid history.');
        if (onBidUpdated) onBidUpdated();
        await fetchAutoBid();
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to disable automatic bidding.');
    } finally {
      setSubmitting(false);
    }
  };

  const isActive = autoBid && autoBid.status === 'active';
  const isPaused = autoBid && autoBid.status === 'paused';
  const isMaxExceeded = autoBid && isActive && auction.currentLeadingBid >= autoBid.maxAmount && !isLeading;

  return (
    <div className="bg-white rounded-3xl border border-[#E7E0D8] p-6 sm:p-7 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E7E0D8] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FFEDD5] border border-[#FED7AA] flex items-center justify-center text-[#C2410C]">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-[#292524] flex items-center gap-2">
              <span>Automatic Bidding</span>
              {isActive && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-emerald-100 text-[#15803D]">
                  Active
                </span>
              )}
              {isPaused && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-800">
                  Paused
                </span>
              )}
            </h3>
            <p className="text-xs text-[#78716C] mt-0.5">
              Let the system bid incrementally up to your private ceiling.
            </p>
          </div>
        </div>

        {autoBid && autoBid.status !== 'disabled' && (
          <button
            type="button"
            onClick={fetchAutoBid}
            disabled={loading}
            className="p-2 text-[#78716C] hover:text-[#292524] hover:bg-[#FFFBF5] rounded-xl transition-colors"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-[#15803D] text-xs flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#15803D]" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Case 1: Active or Paused Auto-Bid exists */}
      {autoBid && autoBid.status !== 'disabled' ? (
        <div className="space-y-4">
          {/* Status highlight banner */}
          {isActive && (
            <div
              className={`p-4 rounded-2xl border flex items-start gap-3 ${
                isLeading
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                  : isMaxExceeded
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              {isLeading ? (
                <ShieldCheck className="w-5 h-5 text-[#15803D] shrink-0 mt-0.5" />
              ) : isMaxExceeded ? (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="text-xs space-y-0.5">
                <div className="font-extrabold text-sm">
                  {isLeading
                    ? 'You are currently the leading bidder!'
                    : isMaxExceeded
                    ? 'Your maximum limit has been reached!'
                    : 'Outbid — preparing to counter-bid'}
                </div>
                <p>
                  {isLeading
                    ? `Current price is ${formatPrice(auction.currentLeadingBid)}. Your proxy will defend this lead up to ₹${autoBid.maxAmount}.`
                    : isMaxExceeded
                    ? `Competing bids have surpassed your limit of ₹${autoBid.maxAmount}. Increase your ceiling to regain the lead.`
                    : `Another bidder pushed the price. Your proxy will submit a counter-bid automatically.`}
                </p>
              </div>
            </div>
          )}

          {isPaused && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
              <Pause className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5">
                <div className="font-extrabold text-sm">Automatic Bidding is Paused</div>
                <p>
                  No new automatic bids will be placed on your behalf until you resume.
                </p>
              </div>
            </div>
          )}

          {/* Details Box */}
          <div className="p-4 rounded-2xl bg-[#FFFBF5] border border-[#E7E0D8] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#78716C] block">
                  Your Private Maximum Limit
                </span>
                <div className="text-2xl font-black text-[#292524] tracking-tight mt-0.5 flex items-center gap-1">
                  <span>{formatPrice(autoBid.maxAmount)}</span>
                  <span className="text-xs font-semibold text-[#78716C]">(Strictly Confidential)</span>
                </div>
              </div>

              {!isEditingMax && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingMax(true);
                    setMaxAmountInput(autoBid.maxAmount.toString());
                  }}
                  className="px-3 py-1.5 text-xs font-bold bg-white border border-[#E7E0D8] hover:border-[#C2410C] hover:text-[#C2410C] rounded-xl text-[#292524] transition-colors"
                >
                  Edit Limit
                </button>
              )}
            </div>

            {/* Inline Edit Form */}
            {isEditingMax && (
              <div className="pt-3 border-t border-[#E7E0D8] space-y-2">
                <label className="text-xs font-bold text-[#292524] block">
                  New Maximum Limit (₹)
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#78716C]">
                      <IndianRupee className="w-4 h-4" />
                    </div>
                    <input
                      type="number"
                      value={maxAmountInput}
                      onChange={(e) => setMaxAmountInput(e.target.value)}
                      placeholder="e.g. 1500"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-[#E7E0D8] rounded-xl text-sm font-bold text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#C2410C]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleUpdateMax}
                    disabled={submitting}
                    className="px-4 py-2 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingMax(false);
                      setMaxAmountInput('');
                      setError(null);
                    }}
                    className="px-3 py-2 bg-[#E7E0D8] hover:bg-stone-300 text-[#292524] rounded-xl text-xs font-bold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                <p className="text-[11px] text-[#78716C]">
                  You can increase or decrease your ceiling without affecting previously accepted bids.
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons: Pause/Resume, Disable */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleToggleStatus}
              disabled={submitting}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                isActive
                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
              }`}
            >
              {isActive ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>Pause Auto-Bidding</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Resume Auto-Bidding</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowDisableModal(true)}
              disabled={submitting}
              className="py-2.5 px-4 rounded-xl bg-white border border-[#E7E0D8] hover:border-rose-300 hover:text-rose-600 text-[#78716C] text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>Disable</span>
            </button>
          </div>
        </div>
      ) : (
        /* Case 2: No active auto-bid configured */
        <div className="space-y-4">
          <p className="text-xs text-[#78716C] leading-relaxed">
            Enter the maximum amount you are willing to pay. We will place bids incrementally by{' '}
            <strong className="text-[#292524]">₹{auction.minimumBidIncrement}</strong> only when needed
            to keep you ahead, never exceeding your ceiling.
          </p>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#78716C]">
                Your Maximum Ceiling (₹)
              </label>
              <span className="text-xs text-[#C2410C] font-bold">
                Min: ₹{minValidMax}
              </span>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#78716C]">
                <IndianRupee className="w-5 h-5 text-[#292524]" />
              </div>
              <input
                type="number"
                min={minValidMax}
                value={maxAmountInput}
                onChange={(e) => setMaxAmountInput(e.target.value)}
                placeholder={`e.g. ${minValidMax + 200}`}
                className="w-full pl-11 pr-4 py-3 bg-[#FFFBF5] border border-[#E7E0D8] rounded-2xl text-lg font-bold text-[#292524] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C2410C]"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const amount = Number(maxAmountInput);
              if (!amount || amount < minValidMax) {
                setError(`Your maximum bid must be at least ₹${minValidMax}.`);
                return;
              }
              setError(null);
              setShowConfirmModal(true);
            }}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#292524] hover:bg-[#1C1917] text-white text-sm font-extrabold transition-all shadow-md flex items-center justify-center gap-2"
          >
            <Bot className="w-4 h-4" />
            <span>Setup Auto-Bidding</span>
            <ArrowUpRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      )}

      {/* Privacy & Fairness Note */}
      <div className="pt-3 border-t border-[#E7E0D8] flex items-start gap-2.5 text-[11px] text-[#78716C]">
        <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#15803D]" />
        <span>
          <strong>Confidentiality Guarantee:</strong> Your maximum limit is completely hidden from the
          seller, other students, and public bid history. Only you can view it.
        </span>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#E7E0D8] p-6 sm:p-7 max-w-md w-full space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#FFEDD5] border border-[#FED7AA] flex items-center justify-center text-[#C2410C]">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-black text-[#292524]">Confirm Auto-Bidding</h4>
                <p className="text-xs text-[#78716C]">Review your settings before activating</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#FFFBF5] border border-[#E7E0D8] space-y-2.5 text-xs text-[#292524]">
              <div className="flex justify-between">
                <span className="text-[#78716C]">Auction Item:</span>
                <span className="font-bold text-right truncate max-w-[200px]">{auction.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#78716C]">Current Leading Bid:</span>
                <span className="font-bold">{formatPrice(auction.currentLeadingBid || auction.startingPrice)}</span>
              </div>
              <div className="flex justify-between border-t border-[#E7E0D8] pt-2">
                <span className="text-[#78716C] font-bold">Your Maximum Ceiling:</span>
                <span className="text-base font-black text-[#C2410C]">
                  ₹{Number(maxAmountInput)}
                </span>
              </div>
            </div>

            <p className="text-xs text-[#78716C] leading-relaxed">
              The system will immediately evaluate the auction and place bids on your behalf up to{' '}
              <strong>₹{Number(maxAmountInput)}</strong> only as competing bids arrive. You will never pay
              more than necessary.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={submitting}
                className="flex-1 py-3 px-4 rounded-xl bg-[#E7E0D8] hover:bg-stone-300 text-[#292524] text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEnable}
                disabled={submitting}
                className="flex-1 py-3 px-4 rounded-xl bg-[#C2410C] hover:bg-[#9A3412] text-white text-xs font-extrabold shadow-md transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Activate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disable Confirmation Modal */}
      {showDisableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#E7E0D8] p-6 sm:p-7 max-w-md w-full space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-black text-[#292524]">Disable Auto-Bidding?</h4>
                <p className="text-xs text-[#78716C]">Stop automatic counter-bids</p>
              </div>
            </div>

            <p className="text-xs text-[#78716C] leading-relaxed">
              Disabling automatic bidding stops all future automated bids on your behalf. Any bids already
              accepted into the public bid history remain valid.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDisableModal(false)}
                disabled={submitting}
                className="flex-1 py-3 px-4 rounded-xl bg-[#E7E0D8] hover:bg-stone-300 text-[#292524] text-xs font-bold transition-colors"
              >
                Keep Active
              </button>
              <button
                type="button"
                onClick={handleDisable}
                disabled={submitting}
                className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-md transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span>Disable Now</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
