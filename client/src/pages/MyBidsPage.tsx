import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  History,
  Trophy,
  Flame,
  Clock,
  ArrowRight,
  AlertCircle,
  TrendingUp,
  XCircle,
  Handshake,
} from 'lucide-react';
import { api } from '../services/api.js';
import { formatPrice, formatDate, formatTimeRemaining } from '../utils/formatters.js';

interface MyBidItem {
  auction: any;
  myLatestBid: number;
  myHighestBid: number;
  isLeading: boolean;
  isWon: boolean;
  isLost: boolean;
  transaction: any;
}

export const MyBidsPage: React.FC = () => {
  const [bids, setBids] = useState<MyBidItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const fetchMyBids = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/bids/my-bids');
      if (res.data.success) {
        setBids(res.data.myBids || []);
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to retrieve your bid history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyBids();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-xs font-bold text-indigo-700 mb-2">
          <History className="w-3.5 h-3.5" />
          <span>Student Bid Activity</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          My Auction Bids
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Track all your active bids, leading positions, and won campus auctions.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-semibold text-slate-500">Loading your bidding history...</p>
        </div>
      ) : bids.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <History className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">No Bids Placed Yet</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            You haven't participated in any campus auctions yet. Explore available listings and place your first fair bid!
          </p>
          <div className="pt-2">
            <Link
              to="/auctions"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs"
            >
              <span>Explore Active Auctions</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {bids.map((item) => {
            const auc = item.auction;
            const time = formatTimeRemaining(auc.closingAt);
            const isAuctionActive = auc.status === 'active' && !time.isEnded;

            const fallbackImage =
              'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=800&q=80';
            const img = auc.imageUrls && auc.imageUrls[0] ? auc.imageUrls[0] : fallbackImage;

            return (
              <div
                key={auc._id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5"
              >
                {/* Left: Item Photo and Info */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <img
                    src={img}
                    alt={auc.title}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-slate-200 shrink-0 bg-slate-100"
                  />

                  <div className="min-w-0 space-y-1">
                    {/* Status badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {isAuctionActive ? (
                        item.isLeading ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            <span>Currently Leading</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-800 flex items-center gap-1">
                            <span>Outbid</span>
                          </span>
                        )
                      ) : item.isWon ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-600 text-white flex items-center gap-1 shadow-xs">
                          <Trophy className="w-3 h-3" />
                          <span>Auction Won</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-700 flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          <span>Ended</span>
                        </span>
                      )}

                      <span className="text-[11px] font-semibold text-slate-400">
                        {auc.category}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 truncate">
                      {auc.title}
                    </h3>

                    {/* Pricing Comparison */}
                    <div className="flex items-center gap-4 text-xs pt-1">
                      <div>
                        <span className="text-slate-400 font-medium">Your Highest Bid: </span>
                        <strong className="text-indigo-600">
                          {formatPrice(item.myHighestBid)}
                        </strong>
                      </div>

                      <div>
                        <span className="text-slate-400 font-medium">Current Leading: </span>
                        <strong className="text-slate-900">
                          {formatPrice(auc.currentLeadingBid)}
                        </strong>
                      </div>

                      <div className="hidden sm:flex items-center gap-1 text-slate-500 font-medium">
                        <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        <span>{auc.bidCount} bids</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-0.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{isAuctionActive ? time.text : `Closed: ${formatDate(auc.closingAt)}`}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                  <Link
                    to={`/auctions/${auc._id}`}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    View Listing
                  </Link>

                  {item.isWon && item.transaction && (
                    <Link
                      to="/transactions"
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      <Handshake className="w-3.5 h-3.5" />
                      <span>Handover Details</span>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
