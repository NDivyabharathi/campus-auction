import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Plus,
  BellRing,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { wantService } from '../services/wantService.js';
import { CreateWantModal } from '../components/CreateWantModal.js';
import { WantCard } from '../components/WantCard.js';
import { WantMatchesModal } from '../components/WantMatchesModal.js';
import type { Want } from '../types/index.js';

type TabType = 'ALL' | 'ACTIVE' | 'PAUSED' | 'FULFILLED' | 'EXPIRED';

export const MyWantsPage: React.FC = () => {
  const [wants, setWants] = useState<Want[]>([]);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<TabType>('ALL');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [selectedWantForMatches, setSelectedWantForMatches] = useState<Want | null>(null);

  // Success message banner
  const [notificationBanner, setNotificationBanner] = useState<{
    type: 'success' | 'info';
    message: string;
  } | null>(null);

  const fetchWants = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await wantService.getWants();
      if (res.success) {
        setWants(res.wants);
        setActiveCount(res.activeCount);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to load your saved wants.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWants();
  }, []);

  // Handler: after creation
  const handleWantCreated = (newWant: Want, matchesFound: number) => {
    fetchWants();
    if (matchesFound > 0) {
      setNotificationBanner({
        type: 'success',
        message: `Saved want created! We found ${matchesFound} active matching ${
          matchesFound === 1 ? 'listing' : 'listings'
        } right now. Check your notifications or click View Matches.`,
      });
      // Automatically open matches modal to delight the user
      setSelectedWantForMatches(newWant);
    } else {
      setNotificationBanner({
        type: 'info',
        message: `Saved want created! We are monitoring future listings 24/7 and will send you an in-app alert when a student posts a match.`,
      });
    }

    setTimeout(() => {
      setNotificationBanner(null);
    }, 7000);
  };

  // Handler: Toggle pause/resume
  const handleToggleStatus = async (want: Want) => {
    const nextStatus = want.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      const res = await wantService.toggleWantStatus(want._id, nextStatus);
      if (res.success) {
        fetchWants();
        if (nextStatus === 'ACTIVE' && (res.matchesFound ?? 0) > 0) {
          setNotificationBanner({
            type: 'success',
            message: `Want resumed! Found ${res.matchesFound} matching listings.`,
          });
          setTimeout(() => setNotificationBanner(null), 5000);
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update want status.');
    }
  };

  // Handler: Renew for 30 days
  const handleRenew = async (want: Want) => {
    try {
      const res = await wantService.renewWant(want._id);
      if (res.success) {
        fetchWants();
        setNotificationBanner({
          type: 'success',
          message: `Want renewed for 30 days! ${
            res.matchesFound > 0 ? `Found ${res.matchesFound} matching listings.` : ''
          }`,
        });
        setTimeout(() => setNotificationBanner(null), 5000);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to renew want.');
    }
  };

  // Handler: Fulfill want
  const handleFulfill = async (want: Want) => {
    try {
      const res = await wantService.fulfillWant(want._id);
      if (res.success) {
        fetchWants();
        setNotificationBanner({
          type: 'success',
          message: `Congratulations! Want marked as fulfilled.`,
        });
        setTimeout(() => setNotificationBanner(null), 5000);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to mark want as fulfilled.');
    }
  };

  // Handler: Delete want
  const handleDelete = async (want: Want) => {
    try {
      const res = await wantService.deleteWant(want._id);
      if (res.success) {
        fetchWants();
        setNotificationBanner({
          type: 'info',
          message: `Saved want deleted.`,
        });
        setTimeout(() => setNotificationBanner(null), 4000);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete want.');
    }
  };

  // Filtering
  const filteredWants = wants.filter((w) => {
    if (currentTab === 'ALL') return true;
    return w.status === currentTab;
  });

  const tabCounts = {
    ALL: wants.length,
    ACTIVE: wants.filter((w) => w.status === 'ACTIVE').length,
    PAUSED: wants.filter((w) => w.status === 'PAUSED').length,
    FULFILLED: wants.filter((w) => w.status === 'FULFILLED').length,
    EXPIRED: wants.filter((w) => w.status === 'EXPIRED').length,
  };

  return (
    <div className="min-h-screen bg-[#FFFBF5] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border-warm">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-orange-100 text-primary-600">
                <BellRing className="w-6 h-6 text-[#C2410C]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-heading text-primary-text">
                  Saved Wants & Smart Alerts
                </h1>
                <p className="text-sm text-secondary-text mt-0.5">
                  Save what you need. We monitor future campus listings 24/7 and alert you when matches appear.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Active limit counter badge */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-border-warm shadow-2xs">
              <span className="text-xs text-secondary-text font-medium">Active Limit:</span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  activeCount >= 10
                    ? 'bg-red-100 text-red-700'
                    : 'bg-orange-100 text-[#C2410C]'
                }`}
              >
                {activeCount}/10
              </span>
            </div>

            {/* Create Want button */}
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C2410C] hover:bg-[#9A3412] text-white text-sm font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create a Want</span>
            </button>
          </div>
        </div>

        {/* Notification Banner */}
        {notificationBanner && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm animate-in fade-in slide-in-from-top-2 duration-200 ${
              notificationBanner.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-orange-50 border-orange-200 text-[#C2410C]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <p className="font-medium">{notificationBanner.message}</p>
            </div>
            <button
              onClick={() => setNotificationBanner(null)}
              className="text-xs font-semibold opacity-70 hover:opacity-100 transition-opacity"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(['ALL', 'ACTIVE', 'PAUSED', 'FULFILLED', 'EXPIRED'] as TabType[]).map((tab) => {
            const count = tabCounts[tab];
            const isActive = currentTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setCurrentTab(tab)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[#C2410C] text-white shadow-2xs'
                    : 'bg-white border border-border-warm text-secondary-text hover:text-primary-text hover:bg-stone-50'
                }`}
              >
                <span>{tab.charAt(0) + tab.slice(1).toLowerCase()}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Error message */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Wants Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-48 rounded-2xl bg-white border border-border-warm animate-pulse p-5 space-y-4"
              >
                <div className="h-5 bg-stone-200 rounded-md w-2/3" />
                <div className="h-4 bg-stone-100 rounded-md w-1/3" />
                <div className="h-10 bg-stone-50 rounded-lg" />
              </div>
            ))}
          </div>
        ) : filteredWants.length === 0 ? (
          /* Empty state */
          <div className="py-16 text-center bg-white rounded-2xl border border-border-warm flex flex-col items-center justify-center p-6">
            <div className="w-16 h-16 rounded-full bg-orange-100 text-[#C2410C] flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-primary-text mb-1">
              {currentTab === 'ALL'
                ? 'No saved wants yet'
                : `No ${currentTab.toLowerCase()} wants found`}
            </h3>
            <p className="text-xs text-secondary-text max-w-md mb-5">
              {currentTab === 'ALL'
                ? 'Looking for a cycle, calculator, drafter, or textbook? Save a want and get notified the second a student lists it!'
                : `You currently have no wants categorized under "${currentTab.toLowerCase()}".`}
            </p>
            {currentTab === 'ALL' && (
              <button
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C2410C] hover:bg-[#9A3412] text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Create Your First Want</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredWants.map((want) => (
              <WantCard
                key={want._id}
                want={want}
                onViewMatches={(w) => setSelectedWantForMatches(w)}
                onToggleStatus={handleToggleStatus}
                onRenew={handleRenew}
                onFulfill={handleFulfill}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateWantModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        activeCount={activeCount}
        onWantCreated={handleWantCreated}
      />

      <WantMatchesModal
        isOpen={!!selectedWantForMatches}
        onClose={() => setSelectedWantForMatches(null)}
        want={selectedWantForMatches}
      />
    </div>
  );
};
