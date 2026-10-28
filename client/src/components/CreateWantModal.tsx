import React, { useState } from 'react';
import { X, Sparkles, AlertCircle, HelpCircle, Layers, Tag, IndianRupee, ShieldCheck } from 'lucide-react';
import { wantService, type CreateWantData } from '../services/wantService.js';
import { CATEGORIES, CONDITIONS } from '../utils/formatters.js';
import type { Want, AuctionCategory, ItemCondition } from '../types/index.js';

interface CreateWantModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCount: number;
  onWantCreated: (newWant: Want, matchesFound: number) => void;
}

export const CreateWantModal: React.FC<CreateWantModalProps> = ({
  isOpen,
  onClose,
  activeCount,
  onWantCreated,
}) => {
  const [keywords, setKeywords] = useState('');
  const [category, setCategory] = useState<AuctionCategory | ''>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [condition, setCondition] = useState<ItemCondition | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isLimitReached = activeCount >= 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLimitReached) {
      setError('You have reached the maximum limit of 10 active saved wants. Please pause, fulfill, or delete an existing want first.');
      return;
    }

    const trimmedKeywords = keywords.trim();
    if (!trimmedKeywords || trimmedKeywords.length < 2) {
      setError('Keywords must be at least 2 characters long.');
      return;
    }

    if (trimmedKeywords.length > 100) {
      setError('Keywords cannot exceed 100 characters.');
      return;
    }

    const numPrice = maxPrice.trim() !== '' ? Number(maxPrice) : null;
    if (numPrice !== null && (isNaN(numPrice) || numPrice <= 0)) {
      setError('Maximum starting price must be a positive number.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const wantData: CreateWantData = {
        keywords: trimmedKeywords,
        category: category || undefined,
        maxPrice: numPrice,
        condition: condition || undefined,
      };

      const res = await wantService.createWant(wantData);
      if (res.success) {
        onWantCreated(res.want, res.matchesFound);
        // Reset form
        setKeywords('');
        setCategory('');
        setMaxPrice('');
        setCondition('');
        onClose();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to create saved want. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="relative w-full max-w-lg bg-card-bg rounded-2xl border border-border-warm shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border-warm bg-[#FFFBF5]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-100 text-primary-600">
              <Sparkles className="w-5 h-5 text-[#C2410C]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-primary-text">Create Saved Want</h2>
              <p className="text-xs text-secondary-text">Get instant smart alerts when matching campus listings appear</p>
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

        {/* Active wants counter banner */}
        <div className="px-6 py-2.5 bg-orange-50/70 border-b border-orange-100 flex items-center justify-between text-xs">
          <span className="text-stone-600 font-medium">Active Wants Usage:</span>
          <span
            className={`font-semibold px-2 py-0.5 rounded-full ${
              isLimitReached
                ? 'bg-red-100 text-red-700 font-bold'
                : 'bg-orange-100 text-[#C2410C]'
            }`}
          >
            {activeCount} / 10 active
          </span>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
            <p className="flex-1">{error}</p>
          </div>
        )}

        {isLimitReached && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2 text-xs text-amber-800">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <p>
              You have reached your limit of 10 active saved wants. You can pause or mark an existing want fulfilled before creating a new one.
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Keywords */}
          <div>
            <label className="block text-xs font-semibold text-primary-text mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#C2410C]" />
                Keywords <span className="text-red-500">*</span>
              </span>
              <span className="text-[11px] font-normal text-secondary-text">{keywords.length}/100</span>
            </label>
            <input
              type="text"
              required
              maxLength={100}
              placeholder="e.g. scientific calculator, drafter, cycle, textbook"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border-warm bg-white text-sm text-primary-text placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#C2410C] focus:border-transparent transition-all"
            />
            <p className="mt-1 text-[11px] text-secondary-text">
              We automatically search titles, descriptions, and common synonyms (e.g. cycle & bicycle).
            </p>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-primary-text mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#C2410C]" />
              Category <span className="text-stone-400 font-normal">(Optional)</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as AuctionCategory | '')}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border-warm bg-white text-sm text-primary-text focus:outline-none focus:ring-2 focus:ring-[#C2410C] focus:border-transparent transition-all"
            >
              <option value="">All Categories (Recommended)</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Max Starting Price */}
            <div>
              <label className="block text-xs font-semibold text-primary-text mb-1.5 flex items-center gap-1.5">
                <IndianRupee className="w-3.5 h-3.5 text-[#C2410C]" />
                Max Starting Price <span className="text-stone-400 font-normal">(₹)</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 500"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-warm bg-white text-sm text-primary-text placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#C2410C] focus:border-transparent transition-all"
              />
              <div className="mt-1 flex items-start gap-1 text-[11px] text-stone-500">
                <HelpCircle className="w-3 h-3 text-stone-400 shrink-0 mt-0.5" />
                <span>Filters by initial listing starting price.</span>
              </div>
            </div>

            {/* Preferred Condition */}
            <div>
              <label className="block text-xs font-semibold text-primary-text mb-1.5 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#C2410C]" />
                Preferred Condition <span className="text-stone-400 font-normal">(Optional)</span>
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as ItemCondition | '')}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-warm bg-white text-sm text-primary-text focus:outline-none focus:ring-2 focus:ring-[#C2410C] focus:border-transparent transition-all"
              >
                <option value="">Any Condition</option>
                {CONDITIONS.map((cond) => (
                  <option key={cond} value={cond}>
                    {cond} or better
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-secondary-text">
                Accepts selected condition or higher quality.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-border-warm flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-secondary-text hover:text-primary-text hover:bg-stone-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || isLimitReached}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#C2410C] hover:bg-[#9A3412] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Scanning Listings...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Save Want & Alert Me</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
