import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  PlusCircle,
  Clock,
  Flame,
  ArrowRight,
  Edit3,
  Trash2,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  X,
  Save,
} from 'lucide-react';
import { api } from '../services/api.js';
import type { Auction } from '../types/index.js';
import { formatPrice, formatTimeRemaining, formatDate, CONDITIONS } from '../utils/formatters.js';

export const MyListingsPage: React.FC = () => {
  const [listings, setListings] = useState<Auction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Editing state
  const [editingAuction, setEditingAuction] = useState<Auction | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCondition, setEditCondition] = useState('');
  const [editPrice, setEditPrice] = useState<number>(0);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editMessage, setEditMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchMyListings = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/auctions/my-listings');
      if (res.data.success) {
        setListings(res.data.listings || []);
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch your auction listings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyListings();
  }, []);

  const handleOpenEdit = (auc: Auction) => {
    setEditingAuction(auc);
    setEditTitle(auc.title);
    setEditDescription(auc.description);
    setEditCondition(auc.condition);
    setEditPrice(auc.startingPrice);
    setEditMessage(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAuction) return;

    setSavingEdit(true);
    setEditMessage(null);
    try {
      const payload: any = {
        title: editTitle.trim(),
        description: editDescription.trim(),
        condition: editCondition,
      };

      if (editingAuction.bidCount === 0) {
        payload.startingPrice = Number(editPrice);
      }

      const res = await api.patch(`/auctions/${editingAuction._id}`, payload);
      if (res.data.success) {
        setEditMessage({ type: 'success', text: 'Listing updated successfully!' });
        setTimeout(() => {
          setEditingAuction(null);
          fetchMyListings();
        }, 800);
      }
    } catch (err: any) {
      setEditMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update listing.',
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCancelAuction = async (id: string, title: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to cancel the auction for "${title}"? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const res = await api.delete(`/auctions/${id}`);
      if (res.data.success) {
        alert('Auction listing cancelled successfully.');
        fetchMyListings();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Cannot cancel this auction.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFEDD5] border border-[#FED7AA] text-xs font-bold text-[#C2410C] mb-2">
            <Package className="w-3.5 h-3.5" />
            <span>Seller Hub</span>
          </div>
          <h1 className="text-3xl font-extrabold text-[#292524] tracking-tight">
            My Auction Listings
          </h1>
          <p className="mt-1 text-sm text-[#78716C]">
            Track your published items, manage bids, and complete handovers with peer students.
          </p>
        </div>

        <Link
          to="/create-listing"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-xl text-xs font-bold shadow-md shadow-[#C2410C]/20 transition-all self-start sm:self-auto cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Publish New Item</span>
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#C2410C] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-semibold text-[#78716C]">Loading your listings...</p>
        </div>
      ) : listings.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#E7E0D8] p-12 text-center max-w-lg mx-auto space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-[#FFEDD5] text-[#C2410C] flex items-center justify-center mx-auto">
            <Package className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-[#292524]">No Listings Yet</h3>
          <p className="text-xs text-[#78716C] leading-relaxed">
            You haven't listed any items for campus auction yet. Got a used calculator, bicycle, or engineering textbook?
          </p>
          <div className="pt-2">
            <Link
              to="/create-listing"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#C2410C] hover:bg-[#9A3412] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Your First Listing</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {listings.map((auc) => {
            const time = formatTimeRemaining(auc.closingAt);
            const hasBids = auc.bidCount > 0;
            const fallbackImage =
              'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=800&q=80';
            const img = auc.imageUrls && auc.imageUrls[0] ? auc.imageUrls[0] : fallbackImage;

            return (
              <div
                key={auc._id}
                className="bg-white rounded-2xl border border-[#E7E0D8] shadow-sm hover:shadow-md transition-shadow p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5"
              >
                {/* Item Details */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <img
                    src={img}
                    alt={auc.title}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-[#E7E0D8] shrink-0 bg-[#FFFBF5]"
                  />

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                          auc.status === 'active' && !time.isEnded
                            ? 'bg-emerald-100 text-[#15803D]'
                            : auc.status === 'sold'
                            ? 'bg-[#1C1917] text-white'
                            : auc.status === 'reserved'
                            ? 'bg-[#FFEDD5] text-[#C2410C] border border-[#FED7AA]'
                            : auc.status === 'cancelled'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-[#FFFBF5] text-[#78716C] border border-[#E7E0D8]'
                        }`}
                      >
                        {auc.status === 'active' && !time.isEnded ? 'Active' : auc.status}
                      </span>
                      <span className="text-[11px] font-semibold text-[#78716C]">
                        {auc.category} • {auc.condition}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-[#292524] truncate">
                      {auc.title}
                    </h3>

                    <div className="flex items-center gap-4 text-xs pt-1">
                      <div>
                        <span className="text-[#78716C] font-medium">
                          {hasBids ? 'Leading Bid: ' : 'Starting: '}
                        </span>
                        <strong className="text-[#292524]">
                          {formatPrice(hasBids ? auc.currentLeadingBid : auc.startingPrice)}
                        </strong>
                      </div>

                      <div className="flex items-center gap-1 text-[#292524] font-semibold">
                        <Flame className="w-3.5 h-3.5 text-[#C2410C] fill-[#C2410C]" />
                        <span>{auc.bidCount} bids</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-[#78716C] flex items-center gap-1.5 pt-0.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{time.isEnded ? 'Closed' : `Closes: ${formatDate(auc.closingAt)}`}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-[#E7E0D8]">
                  <Link
                    to={`/auctions/${auc._id}`}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#FFFBF5] hover:bg-[#FFEDD5] hover:text-[#C2410C] text-[#292524] border border-[#E7E0D8] transition-colors flex items-center gap-1"
                  >
                    <span>View Auction</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  {/* Allow edit/cancel only if no bids placed and active */}
                  {auc.status === 'active' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(auc)}
                        title="Edit Listing"
                        className="p-2 rounded-xl text-[#78716C] hover:text-[#C2410C] hover:bg-[#FFEDD5]/50 border border-[#E7E0D8] transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {!hasBids ? (
                        <button
                          type="button"
                          onClick={() => handleCancelAuction(auc._id, auc.title)}
                          title="Cancel Listing"
                          className="p-2 rounded-xl text-[#78716C] hover:text-rose-600 hover:bg-rose-50 border border-[#E7E0D8] transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <div
                          title="Pricing and details locked after first bid for campus fairness"
                          className="p-2 text-[#78716C]/40 cursor-not-allowed"
                        >
                          <ShieldAlert className="w-4 h-4 text-[#C2410C]" />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingAuction && (
        <div className="fixed inset-0 z-50 bg-[#1C1917]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 border border-[#E7E0D8] shadow-2xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-[#E7E0D8] pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#292524]">Edit Listing</h3>
                <p className="text-xs text-[#78716C]">
                  {editingAuction.bidCount > 0
                    ? 'Bids placed: Pricing is protected by fairness rules.'
                    : 'Modify item details before the first bid is accepted.'}
                </p>
              </div>
              <button
                onClick={() => setEditingAuction(null)}
                className="p-1 rounded-lg text-[#78716C] hover:text-[#292524] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editMessage && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  editMessage.type === 'success'
                    ? 'bg-emerald-50 text-[#15803D] border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {editMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                )}
                <span>{editMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#78716C] uppercase text-[11px] mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full p-2.5 bg-[#FFFBF5] border border-[#E7E0D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C2410C] font-medium text-[#292524]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#78716C] uppercase text-[11px] mb-1">Condition</label>
                <select
                  value={editCondition}
                  onChange={(e) => setEditCondition(e.target.value)}
                  className="w-full p-2.5 bg-[#FFFBF5] border border-[#E7E0D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C2410C] text-[#292524]"
                >
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {editingAuction.bidCount === 0 && (
                <div>
                  <label className="block font-semibold text-[#78716C] uppercase text-[11px] mb-1">
                    Starting Price (₹)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editPrice}
                    onChange={(e) => setEditPrice(Number(e.target.value))}
                    className="w-full p-2.5 bg-[#FFFBF5] border border-[#E7E0D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C2410C] font-bold text-[#292524]"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-[#78716C] uppercase text-[11px] mb-1">Description</label>
                <textarea
                  rows={4}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full p-2.5 bg-[#FFFBF5] border border-[#E7E0D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C2410C] text-[#292524]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAuction(null)}
                  className="px-4 py-2 text-[#78716C] hover:text-[#292524] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingEdit ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
