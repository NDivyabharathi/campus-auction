import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Check,
  Trash2,
  TrendingUp,
  Flame,
  Trophy,
  AlertCircle,
  Clock,
  Handshake,
  CheckCircle2,
  XCircle,
  Sparkles,
  ExternalLink,
  Volume2,
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext.js';
import { formatDate } from '../utils/formatters.js';
import type { AppNotification } from '../types/index.js';

export const NotificationsPage: React.FC = () => {
  const {
    notifications,
    unreadCount,
    loading,
    browserPermission,
    requestBrowserPermission,
    markAsRead,
    markAllAsRead,
    dismissNotification,
  } = useNotifications();

  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);
  const navigate = useNavigate();

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.readAt) {
      await markAsRead(notif._id);
    }

    if (notif.type === 'want_match' || notif.type === 'want_fulfilled_suggestion') {
      if (notif.auctionId) {
        const aucId = typeof notif.auctionId === 'string' ? notif.auctionId : notif.auctionId._id;
        navigate(`/auctions/${aucId}`);
      } else {
        navigate('/my-wants');
      }
      return;
    }

    if (notif.transactionId) {
      navigate('/transactions');
    } else if (notif.auctionId) {
      const aucId = typeof notif.auctionId === 'string' ? notif.auctionId : notif.auctionId._id;
      navigate(`/auctions/${aucId}`);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'bid_received':
        return <TrendingUp className="w-5 h-5 text-[#C2410C]" />;
      case 'outbid':
        return <Flame className="w-5 h-5 text-[#C2410C]" />;
      case 'auction_won':
      case 'auction_sold':
        return <Trophy className="w-5 h-5 text-[#15803D]" />;
      case 'auction_ending_soon':
        return <Clock className="w-5 h-5 text-amber-600" />;
      case 'handover_scheduled':
      case 'handover_confirmed_by_peer':
        return <Handshake className="w-5 h-5 text-[#C2410C]" />;
      case 'transaction_completed':
        return <CheckCircle2 className="w-5 h-5 text-[#15803D]" />;
      case 'transaction_failed':
      case 'auction_unsold':
        return <XCircle className="w-5 h-5 text-rose-600" />;
      case 'handover_reassigned':
        return <Sparkles className="w-5 h-5 text-[#C2410C]" />;
      case 'want_match':
        return <Sparkles className="w-5 h-5 text-[#C2410C]" />;
      case 'want_fulfilled_suggestion':
        return <CheckCircle2 className="w-5 h-5 text-purple-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-[#78716C]" />;
    }
  };

  const filteredNotifications = filterUnreadOnly
    ? notifications.filter((n) => !n.readAt)
    : notifications;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFEDD5] border border-[#FED7AA] text-xs font-bold text-[#C2410C] mb-2">
            <Bell className="w-3.5 h-3.5" />
            <span>Campus Notification Center</span>
          </div>
          <h1 className="text-3xl font-extrabold text-[#292524] tracking-tight">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-[#78716C]">
            Live alerts for incoming bids, outbid events, auction outcomes, and handover meetings.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllAsRead}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-[#FFEDD5] text-[#C2410C] border border-[#E7E0D8] rounded-xl text-xs font-bold shadow-2xs transition-colors self-start sm:self-auto cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark All as Read ({unreadCount})</span>
          </button>
        )}
      </div>

      {/* Browser Notification Permission Banner */}
      {browserPermission === 'default' && (
        <div className="p-4 bg-white border border-[#E7E0D8] rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FFEDD5] text-[#C2410C] flex items-center justify-center shrink-0">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#292524]">
                Enable Real-Time Browser Notifications
              </div>
              <p className="text-xs text-[#78716C] mt-0.5">
                Get immediate alerts when you're outbid, win an auction, or need to arrange a campus handover.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={requestBrowserPermission}
            className="shrink-0 px-4 py-2 bg-[#C2410C] hover:bg-[#9A3412] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Enable Browser Alerts
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-[#E7E0D8] pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterUnreadOnly(false)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              !filterUnreadOnly
                ? 'bg-[#C2410C] text-white shadow-xs'
                : 'bg-white text-[#78716C] border border-[#E7E0D8] hover:text-[#292524]'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterUnreadOnly(true)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterUnreadOnly
                ? 'bg-[#C2410C] text-white shadow-xs'
                : 'bg-white text-[#78716C] border border-[#E7E0D8] hover:text-[#292524]'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        <span className="text-xs text-[#78716C]">
          {filteredNotifications.length} notification{filteredNotifications.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="py-16 text-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#C2410C] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-semibold text-[#78716C]">Loading your alerts...</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#E7E0D8] p-12 text-center max-w-lg mx-auto space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-[#FFEDD5] text-[#C2410C] flex items-center justify-center mx-auto">
            <Bell className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-[#292524]">
            {filterUnreadOnly ? 'No Unread Notifications' : 'No Notifications Yet'}
          </h3>
          <p className="text-xs text-[#78716C] leading-relaxed">
            {filterUnreadOnly
              ? 'You are all caught up! Switch to All to see past alerts.'
              : 'When you place bids, publish items, or complete campus handovers, your alerts will show up here.'}
          </p>
          <div className="pt-2">
            <Link
              to="/auctions"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#C2410C] hover:bg-[#9A3412] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <span>Explore Marketplace</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notif) => {
            const isUnread = !notif.readAt;

            return (
              <div
                key={notif._id}
                onClick={() => handleNotificationClick(notif)}
                className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex items-start gap-4 ${
                  isUnread
                    ? 'bg-[#FFFBF5] border-[#FED7AA] shadow-xs'
                    : 'bg-white border-[#E7E0D8] hover:shadow-xs'
                }`}
              >
                {/* Notification Icon */}
                <div className="w-10 h-10 rounded-2xl bg-white border border-[#E7E0D8] shadow-2xs flex items-center justify-center shrink-0 mt-0.5">
                  {getNotificationIcon(notif.type)}
                </div>

                {/* Main Body */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-bold text-[#292524]">
                      {notif.title}
                    </h3>
                    <span className="text-[11px] text-[#78716C] shrink-0 font-mono">
                      {formatDate(notif.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs text-[#78716C] leading-relaxed">
                    {notif.message}
                  </p>

                  {/* Related Auction info pill */}
                  {notif.auctionId && (
                    <div className="pt-1 flex items-center gap-2">
                      <span className="text-[11px] font-bold text-[#C2410C] flex items-center gap-1 hover:underline">
                        <span>{notif.transactionId ? 'Go to Handover' : 'Go to Auction'}</span>
                        <ExternalLink className="w-3 h-3" />
                      </span>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 shrink-0 self-center">
                  {isUnread && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notif._id);
                      }}
                      title="Mark as read"
                      className="p-2 rounded-xl text-[#78716C] hover:text-[#C2410C] hover:bg-[#FFEDD5] transition-colors cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      dismissNotification(notif._id);
                    }}
                    title="Dismiss alert"
                    className="p-2 rounded-xl text-[#78716C] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

