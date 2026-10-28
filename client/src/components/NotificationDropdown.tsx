import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
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
import type { AppNotification } from '../types/index.js';

export const NotificationDropdown: React.FC = () => {
  const {
    notifications,
    unreadCount,
    browserPermission,
    requestBrowserPermission,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.readAt) {
      await markAsRead(notif._id);
    }
    setIsOpen(false);

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
        return <TrendingUp className="w-4 h-4 text-[#C2410C]" />;
      case 'outbid':
        return <Flame className="w-4 h-4 text-[#C2410C]" />;
      case 'auction_won':
      case 'auction_sold':
        return <Trophy className="w-4 h-4 text-[#15803D]" />;
      case 'auction_ending_soon':
        return <Clock className="w-4 h-4 text-amber-600" />;
      case 'handover_scheduled':
      case 'handover_confirmed_by_peer':
        return <Handshake className="w-4 h-4 text-[#C2410C]" />;
      case 'transaction_completed':
        return <CheckCircle2 className="w-4 h-4 text-[#15803D]" />;
      case 'transaction_failed':
      case 'auction_unsold':
        return <XCircle className="w-4 h-4 text-rose-600" />;
      case 'handover_reassigned':
        return <Sparkles className="w-4 h-4 text-[#C2410C]" />;
      default:
        return <AlertCircle className="w-4 h-4 text-[#78716C]" />;
    }
  };

  // Helper for relative time (e.g., 2m ago, 1h ago, 2d ago)
  const formatRelativeTime = (dateStr: string) => {
    try {
      const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
      if (diff < 60) return 'Just now';
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return `${Math.floor(diff / 86400)}d ago`;
    } catch {
      return '';
    }
  };

  const filteredNotifications = filterUnreadOnly
    ? notifications.filter((n) => !n.readAt)
    : notifications;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
        className="relative p-2 rounded-xl text-[#78716C] hover:text-[#292524] hover:bg-[#FFFBF5] transition-colors cursor-pointer"
        aria-label="Open notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-4.5 h-4.5 px-1 rounded-full bg-[#C2410C] text-white text-[10px] font-bold leading-none shadow-xs animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-[#E7E0D8] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-4 border-b border-[#E7E0D8] bg-[#FFFBF5] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#292524]">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#FFEDD5] text-[#C2410C] border border-[#FED7AA]">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-xs font-semibold text-[#C2410C] hover:text-[#9A3412] flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>
          </div>

          {/* Browser Permission Callout Banner */}
          {browserPermission === 'default' && (
            <div className="p-3 bg-[#FFEDD5]/60 border-b border-[#FED7AA] flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-[#9A3412]">
                <Volume2 className="w-4 h-4 shrink-0 text-[#C2410C]" />
                <span className="leading-tight font-medium text-[11px]">
                  Enable browser alerts when outbid or winning an item.
                </span>
              </div>
              <button
                type="button"
                onClick={requestBrowserPermission}
                className="shrink-0 px-2.5 py-1 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              >
                Enable
              </button>
            </div>
          )}

          {browserPermission === 'denied' && (
            <div className="px-3 py-2 bg-stone-50 border-b border-[#E7E0D8] text-[11px] text-[#78716C] flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
              <span>Browser alerts blocked. You can unblock them in site settings.</span>
            </div>
          )}

          {/* Filter Bar (All / Unread) */}
          <div className="px-4 py-2 bg-white border-b border-[#E7E0D8] flex items-center gap-2 text-xs">
            <button
              onClick={() => setFilterUnreadOnly(false)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                !filterUnreadOnly
                  ? 'bg-[#FFEDD5] text-[#C2410C]'
                  : 'text-[#78716C] hover:text-[#292524]'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilterUnreadOnly(true)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                filterUnreadOnly
                  ? 'bg-[#FFEDD5] text-[#C2410C]'
                  : 'text-[#78716C] hover:text-[#292524]'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notifications Scroll List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-[#E7E0D8]">
            {filteredNotifications.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-[#FFEDD5] text-[#C2410C] flex items-center justify-center mx-auto">
                  <Bell className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-[#292524]">No notifications</div>
                <p className="text-[11px] text-[#78716C] max-w-xs mx-auto">
                  {filterUnreadOnly
                    ? "You've read all your recent notifications."
                    : 'You will receive updates here when bids, auction closures, and handovers happen.'}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const isUnread = !notif.readAt;

                return (
                  <div
                    key={notif._id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer group ${
                      isUnread
                        ? 'bg-[#FFFBF5] hover:bg-[#FFEDD5]/30'
                        : 'bg-white hover:bg-stone-50'
                    }`}
                  >
                    {/* Notification Type Icon */}
                    <div className="w-8 h-8 rounded-xl bg-white border border-[#E7E0D8] shadow-2xs flex items-center justify-center shrink-0 mt-0.5">
                      {getNotificationIcon(notif.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-[#292524] truncate">
                          {notif.title}
                        </span>
                        <span className="text-[10px] text-[#78716C] shrink-0 font-medium">
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-[#78716C] line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>

                      {/* Action cue */}
                      {(notif.auctionId || notif.transactionId) && (
                        <div className="pt-1 flex items-center gap-1 text-[11px] font-semibold text-[#C2410C] group-hover:underline">
                          <span>{notif.transactionId ? 'View Handover' : 'View Auction'}</span>
                          <ExternalLink className="w-3 h-3" />
                        </div>
                      )}
                    </div>

                    {/* Unread dot or quick mark read */}
                    <div className="flex items-center gap-1 shrink-0 pt-1">
                      {isUnread ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notif._id);
                          }}
                          title="Mark as read"
                          className="w-2.5 h-2.5 rounded-full bg-[#C2410C] hover:ring-2 hover:ring-[#C2410C]/30 transition-all"
                        />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-stone-300" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-[#FFFBF5] border-t border-[#E7E0D8] text-center">
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-[#C2410C] hover:text-[#9A3412] transition-colors"
            >
              View All Notifications ({notifications.length}) →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
