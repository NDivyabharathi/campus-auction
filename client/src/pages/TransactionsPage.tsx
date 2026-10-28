import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Handshake,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ArrowRight,
  UserCheck,
  Send,
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import type { Transaction } from '../types/index.js';
import { formatPrice, formatDate } from '../utils/formatters.js';

export const TransactionsPage: React.FC = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Meeting coordination form states
  const [activeSchedulingId, setActiveSchedulingId] = useState<string | null>(null);
  const [meetingLocation, setMeetingLocation] = useState<string>('');
  const [meetingDateTime, setMeetingDateTime] = useState<string>('');
  const [meetingNotes, setMeetingNotes] = useState<string>('');
  const [updatingDetails, setUpdatingDetails] = useState<boolean>(false);

  // Action status message
  const [actionFeedback, setActionFeedback] = useState<{ id: string; type: 'success' | 'error'; message: string } | null>(null);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/transactions');
      if (res.data.success) {
        setTransactions(res.data.transactions || []);
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch your transactions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleOpenSchedule = (t: Transaction) => {
    setActiveSchedulingId(t._id);
    setMeetingLocation(t.handoverLocation || 'Kongu Central Library Entrance');
    if (t.handoverDateTime) {
      const d = new Date(t.handoverDateTime);
      const pad = (n: number) => n.toString().padStart(2, '0');
      setMeetingDateTime(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    } else {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const pad = (n: number) => n.toString().padStart(2, '0');
      setMeetingDateTime(`${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T16:30`);
    }
    setMeetingNotes(t.handoverNotes || '');
  };

  const handleSaveSchedule = async (id: string) => {
    if (!meetingLocation.trim()) {
      alert('Please specify a campus meeting location.');
      return;
    }
    setUpdatingDetails(true);
    setActionFeedback(null);
    try {
      const res = await api.patch(`/transactions/${id}/handover`, {
        handoverLocation: meetingLocation.trim(),
        handoverDateTime: meetingDateTime ? new Date(meetingDateTime).toISOString() : undefined,
        handoverNotes: meetingNotes.trim(),
      });
      if (res.data.success) {
        setActionFeedback({
          id,
          type: 'success',
          message: 'Campus meeting details saved and shared with your peer!',
        });
        setActiveSchedulingId(null);
        fetchTransactions();
      }
    } catch (err: any) {
      setActionFeedback({
        id,
        type: 'error',
        message: err.response?.data?.message || 'Failed to update meeting details.',
      });
    } finally {
      setUpdatingDetails(false);
    }
  };

  const handleConfirmHandover = async (id: string) => {
    setActionFeedback(null);
    try {
      const res = await api.post(`/transactions/${id}/confirm`);
      if (res.data.success) {
        setActionFeedback({
          id,
          type: 'success',
          message: res.data.message,
        });
        fetchTransactions();
      }
    } catch (err: any) {
      setActionFeedback({
        id,
        type: 'error',
        message: err.response?.data?.message || 'Failed to record confirmation.',
      });
    }
  };

  const handleFailAndReassign = async (id: string) => {
    const confirmReassign = window.confirm(
      'Are you sure you want to mark this pickup as failed? The item will be offered to the next highest eligible bidder.'
    );
    if (!confirmReassign) return;

    setActionFeedback(null);
    try {
      const res = await api.post(`/transactions/${id}/fail-and-reassign`, {
        reason: 'Buyer did not meet or complete physical exchange within deadline.',
      });
      if (res.data.success) {
        setActionFeedback({
          id,
          type: 'success',
          message: res.data.message,
        });
        fetchTransactions();
      }
    } catch (err: any) {
      setActionFeedback({
        id,
        type: 'error',
        message: err.response?.data?.message || 'Failed to process reassignment.',
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFEDD5] border border-[#FED7AA] text-xs font-bold text-[#C2410C] mb-2">
          <Handshake className="w-3.5 h-3.5" />
          <span>Campus Physical Exchange Portal</span>
        </div>
        <h1 className="text-3xl font-extrabold text-[#292524] tracking-tight">
          Campus Handovers & Transactions
        </h1>
        <p className="mt-1 text-sm text-[#78716C]">
          Coordinate meeting spots, view deadlines, and complete 2-party confirmations for campus exchanges.
        </p>
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
          <p className="text-xs font-semibold text-[#78716C]">Retrieving campus transactions...</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#E7E0D8] p-12 text-center max-w-lg mx-auto space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-[#FFEDD5] text-[#C2410C] flex items-center justify-center mx-auto">
            <Handshake className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-[#292524]">No Active Handovers</h3>
          <p className="text-xs text-[#78716C] leading-relaxed">
            When you win an auction or when an auction you listed concludes with a winning bidder, 
            reservation and meeting details will appear here.
          </p>
          <div className="pt-2">
            <Link
              to="/auctions"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#C2410C] hover:bg-[#9A3412] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <span>Explore Active Auctions</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {transactions.map((t) => {
            const isSeller = Boolean(user && (user._id === (t.sellerId as any)._id || user._id === (t.sellerId as any)));
            const peer = isSeller ? t.buyerId : t.sellerId;
            const auctionObj: any = t.auctionId;

            const myConfirmed = isSeller ? !!t.sellerConfirmedAt : !!t.buyerConfirmedAt;

            return (
              <div
                key={t._id}
                className="bg-white rounded-3xl border border-[#E7E0D8] shadow-sm overflow-hidden transition-all"
              >
                {/* Header status bar */}
                <div className="px-6 py-4 bg-[#FFFBF5] border-b border-[#E7E0D8] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        t.status === 'completed'
                          ? 'bg-emerald-100 text-[#15803D]'
                          : t.status === 'failed'
                          ? 'bg-rose-100 text-rose-800'
                          : t.status === 'handover_scheduled'
                          ? 'bg-[#FFEDD5] text-[#C2410C] border border-[#FED7AA]'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {t.status === 'awaiting_handover'
                        ? 'Awaiting Meeting Setup'
                        : t.status === 'handover_scheduled'
                        ? 'Handover Scheduled'
                        : t.status === 'completed'
                        ? 'Handover Completed'
                        : 'Failed / Missed'}
                    </span>

                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-white border border-[#E7E0D8] text-[#292524]">
                      {isSeller ? 'You are the Seller' : 'You are the Buyer'}
                    </span>

                    {t.attemptNumber > 1 && (
                      <span className="text-[11px] font-semibold text-[#C2410C] bg-[#FFEDD5] px-2 py-0.5 rounded-md border border-[#FED7AA]">
                        Reassigned Round #{t.attemptNumber}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-[#78716C] font-mono">
                    Reserved: {formatDate(t.createdAt)}
                  </div>
                </div>

                {/* Main Card Body */}
                <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* Left: Item & Peer Info (5 cols) */}
                  <div className="md:col-span-5 space-y-4">
                    <div className="flex items-start gap-4">
                      {auctionObj?.imageUrls && auctionObj.imageUrls[0] ? (
                        <img
                          src={auctionObj.imageUrls[0]}
                          alt={auctionObj.title}
                          className="w-20 h-20 rounded-2xl object-cover border border-[#E7E0D8] shrink-0"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-2xl bg-[#FFEDD5] flex items-center justify-center text-[#C2410C] shrink-0 font-bold text-xs">
                          Item Photo
                        </div>
                      )}

                      <div className="min-w-0">
                        <Link
                          to={`/auctions/${auctionObj?._id || ''}`}
                          className="text-base font-bold text-[#292524] hover:text-[#C2410C] transition-colors line-clamp-1 block"
                        >
                          {auctionObj?.title || 'Auction Item'}
                        </Link>
                        <div className="text-xs text-[#78716C] mt-0.5">
                          Agreed Winning Bid:
                        </div>
                        <div className="text-xl font-black text-[#292524] mt-0.5">
                          {formatPrice(t.amount)}
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#FFFBF5] border border-[#E7E0D8] text-xs space-y-1.5">
                      <div className="font-bold text-[#292524] flex items-center justify-between">
                        <span>{isSeller ? 'Winning Buyer:' : 'Seller:'}</span>
                        <span className="text-[#C2410C] font-mono">
                          {peer?.department ? `${peer.department} Dept` : 'Kongu Student'}
                        </span>
                      </div>
                      <div className="text-[#292524] font-semibold">{peer?.fullName}</div>
                      <div className="text-[11px] text-[#78716C]">
                        Official In-Campus exchange contact
                      </div>
                    </div>

                    {t.status === 'failed' && t.failureReason && (
                      <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <XCircle className="w-4 h-4 text-rose-600" />
                          <span>Handover Missed Reason</span>
                        </div>
                        <p>{t.failureReason}</p>
                      </div>
                    )}
                  </div>

                  {/* Right: Meeting Location, Deadlines & Confirmation (7 cols) */}
                  <div className="md:col-span-7 space-y-5 border-t md:border-t-0 md:border-l border-[#E7E0D8] md:pl-6">
                    {/* Feedback message */}
                    {actionFeedback && actionFeedback.id === t._id && (
                      <div
                        className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                          actionFeedback.type === 'success'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {actionFeedback.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <span>{actionFeedback.message}</span>
                      </div>
                    )}

                    {/* Meeting arrangement details */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#78716C]">
                          Campus Handover Details
                        </span>
                        {t.status !== 'completed' && t.status !== 'failed' && (
                          <button
                            onClick={() => handleOpenSchedule(t)}
                            className="text-xs font-bold text-[#C2410C] hover:text-[#9A3412] hover:underline cursor-pointer"
                          >
                            {t.handoverLocation ? 'Edit Meeting Details' : '+ Propose Meeting Spot'}
                          </button>
                        )}
                      </div>

                      {activeSchedulingId === t._id ? (
                        /* Edit Meeting Spot Form */
                        <div className="p-4 bg-[#FFFBF5] border border-[#E7E0D8] rounded-2xl space-y-3 text-xs">
                          <div>
                            <label className="block font-semibold text-[#292524] mb-1">
                              Campus Meeting Spot *
                            </label>
                            <input
                              type="text"
                              value={meetingLocation}
                              onChange={(e) => setMeetingLocation(e.target.value)}
                              placeholder="e.g., Library Entrance, IT Block Lobby, Convention Center"
                              className="w-full p-2.5 bg-white border border-[#E7E0D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C2410C] font-medium text-[#292524]"
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-[#292524] mb-1">
                              Proposed Meeting Date & Time
                            </label>
                            <input
                              type="datetime-local"
                              value={meetingDateTime}
                              onChange={(e) => setMeetingDateTime(e.target.value)}
                              className="w-full p-2.5 bg-white border border-[#E7E0D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C2410C] font-medium text-[#292524]"
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-[#292524] mb-1">
                              Handover Notes (Optional)
                            </label>
                            <input
                              type="text"
                              value={meetingNotes}
                              onChange={(e) => setMeetingNotes(e.target.value)}
                              placeholder="e.g., I will be wearing a blue jacket / Call near gate"
                              className="w-full p-2.5 bg-white border border-[#E7E0D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C2410C] text-[#292524]"
                            />
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setActiveSchedulingId(null)}
                              className="px-3 py-1.5 text-[#78716C] hover:text-[#292524]"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={updatingDetails}
                              onClick={() => handleSaveSchedule(t._id)}
                              className="px-4 py-1.5 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-xl font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Save Details</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Read-only meeting display */
                        <div className="p-4 rounded-2xl bg-[#FFFBF5] border border-[#E7E0D8] space-y-2 text-xs">
                          <div className="flex items-start gap-2.5">
                            <MapPin className="w-4 h-4 text-[#C2410C] shrink-0 mt-0.5" />
                            <div>
                              <span className="text-[#78716C] block font-medium">Location:</span>
                              <span className="font-bold text-[#292524]">
                                {t.handoverLocation || 'Not scheduled yet. Please propose a meeting spot.'}
                              </span>
                            </div>
                          </div>

                          {t.handoverDateTime && (
                            <div className="flex items-start gap-2.5">
                              <Calendar className="w-4 h-4 text-[#C2410C] shrink-0 mt-0.5" />
                              <div>
                                <span className="text-[#78716C] block font-medium">Date & Time:</span>
                                <span className="font-bold text-[#292524]">
                                  {formatDate(t.handoverDateTime)}
                                </span>
                              </div>
                            </div>
                          )}

                          {t.handoverNotes && (
                            <div className="text-[#78716C] pt-1 border-t border-[#E7E0D8] text-[11px]">
                              Note: {t.handoverNotes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Two-Party Physical Handover Confirmation Status */}
                    <div className="pt-2 space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#78716C]">
                        <span>Handover Verification (Both Parties Required)</span>
                        {t.status === 'completed' && (
                          <span className="text-[#15803D] font-extrabold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Verified</span>
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {/* Seller confirmation indicator */}
                        <div
                          className={`p-3 rounded-2xl border flex items-center gap-2.5 ${
                            t.sellerConfirmedAt
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                              : 'bg-[#FFFBF5] border-[#E7E0D8] text-[#78716C]'
                          }`}
                        >
                          <UserCheck
                            className={`w-4 h-4 shrink-0 ${
                              t.sellerConfirmedAt ? 'text-[#15803D]' : 'text-[#78716C]'
                            }`}
                          />
                          <div>
                            <div className="font-bold text-[#292524]">Seller Confirmed</div>
                            <div className="text-[10px] text-[#78716C]">
                              {t.sellerConfirmedAt
                                ? formatDate(t.sellerConfirmedAt)
                                : 'Awaiting confirmation'}
                            </div>
                          </div>
                        </div>

                        {/* Buyer confirmation indicator */}
                        <div
                          className={`p-3 rounded-2xl border flex items-center gap-2.5 ${
                            t.buyerConfirmedAt
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                              : 'bg-[#FFFBF5] border-[#E7E0D8] text-[#78716C]'
                          }`}
                        >
                          <UserCheck
                            className={`w-4 h-4 shrink-0 ${
                              t.buyerConfirmedAt ? 'text-[#15803D]' : 'text-[#78716C]'
                            }`}
                          />
                          <div>
                            <div className="font-bold text-[#292524]">Buyer Confirmed</div>
                            <div className="text-[10px] text-[#78716C]">
                              {t.buyerConfirmedAt
                                ? formatDate(t.buyerConfirmedAt)
                                : 'Awaiting confirmation'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Interactive Confirmation Button */}
                      {t.status !== 'completed' && t.status !== 'failed' && (
                        <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                          {myConfirmed ? (
                            <div className="text-xs text-emerald-800 font-bold flex items-center gap-1.5 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                              <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
                              <span>
                                You confirmed handover. Waiting for {peer?.fullName} to confirm.
                              </span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleConfirmHandover(t._id)}
                              className="px-5 py-2.5 rounded-xl bg-[#15803D] hover:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-700/20 transition-all flex items-center gap-2 cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Confirm Handover Completed</span>
                            </button>
                          )}

                          {/* Fallback button if buyer didn't show up (Seller only) */}
                          {isSeller && (
                            <button
                              type="button"
                              onClick={() => handleFailAndReassign(t._id)}
                              className="text-xs font-semibold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                            >
                              Report Failed Pickup & Next Bidder
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
