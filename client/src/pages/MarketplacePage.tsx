import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  Search,
  SlidersHorizontal,
  PlusCircle,
  BookOpen,
  Laptop,
  Bike,
  Home,
  Shirt,
  Trophy,
  FlaskConical,
  Package,
  AlertCircle,
} from 'lucide-react';
import { api } from '../services/api.js';
import type { Auction } from '../types/index.js';
import { AuctionCard } from '../components/AuctionCard.js';
import { CATEGORIES, CONDITIONS } from '../utils/formatters.js';

export const MarketplacePage: React.FC = () => {
  const [searchParams] = useSearchParams();

  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter states
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'All');
  const [selectedCondition, setSelectedCondition] = useState('All');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [sortBy, setSortBy] = useState('ending_soon');
  const [showFilters, setShowFilters] = useState(false);

  const fetchAuctions = async () => {
    try {
      setLoading(true);
      setError('');

      const params: any = {
        status: statusFilter,
        sort: sortBy,
      };

      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (selectedCategory && selectedCategory !== 'All') params.category = selectedCategory;
      if (selectedCondition && selectedCondition !== 'All') params.condition = selectedCondition;
      if (minPrice) params.minPrice = minPrice;
      if (maxPrice) params.maxPrice = maxPrice;

      const res = await api.get('/auctions', { params });
      if (res.data.success) {
        setAuctions(res.data.auctions || []);
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch marketplace auctions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuctions();
  }, [selectedCategory, selectedCondition, statusFilter, sortBy]);

  // Real-time updates for marketplace cards (extensions, new bids, closures)
  useEffect(() => {
    const socket = io(window.location.origin, {
      withCredentials: true,
    });

    socket.on('marketplace_update', ({ auctionId, event, data }: any) => {
      if (event === 'auction:extended' || event === 'auction_extended') {
        setAuctions((prev) =>
          prev.map((auc) =>
            auc._id === auctionId ? { ...auc, closingAt: data.newClosingTime } : auc
          )
        );
      } else if (event === 'new_bid') {
        setAuctions((prev) =>
          prev.map((auc) =>
            auc._id === auctionId
              ? {
                  ...auc,
                  currentLeadingBid: data.currentLeadingBid,
                  bidCount: data.bidCount,
                  ...(data.closingAt ? { closingAt: data.closingAt } : {}),
                }
              : auc
          )
        );
      } else if (event === 'auction_ended') {
        setAuctions((prev) =>
          prev.map((auc) => (auc._id === auctionId ? { ...auc, status: data.status } : auc))
        );
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAuctions();
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('All');
    setSelectedCondition('All');
    setMinPrice('');
    setMaxPrice('');
    setStatusFilter('active');
    setSortBy('ending_soon');
  };

  // Category Icon helper
  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'Books and Study Materials':
        return BookOpen;
      case 'Electronics':
        return Laptop;
      case 'Cycles and Transportation':
        return Bike;
      case 'Hostel Essentials':
        return Home;
      case 'Clothing and Accessories':
        return Shirt;
      case 'Sports Equipment':
        return Trophy;
      case 'Laboratory Equipment':
        return FlaskConical;
      default:
        return Package;
    }
  };

  return (
    <div className="min-h-screen pb-16 bg-[#FFFBF5]">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-[#FFF5EA] via-[#FFFBF5] to-[#FFFBF5] border-b border-[#E7E0D8]/80 pt-12 pb-14 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Subtle decorative circles */}
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-[#FFEDD5]/40 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-[#FED7AA]/30 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-5xl mx-auto text-center relative z-10 space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FFEDD5] border border-[#FED7AA] text-xs font-bold text-[#C2410C]">
            <span className="w-2 h-2 rounded-full bg-[#15803D]"></span>
            <span>Live Campus Marketplace • Kongu Engineering College</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[#292524] leading-tight">
            Good Things Deserve a <br className="hidden sm:block" />
            <span className="text-[#C2410C]">
              Second Round.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-[#78716C] max-w-2xl mx-auto leading-relaxed font-normal">
            Discover great deals across campus. Bid fairly, buy smarter, and give pre-loved items a new home.
          </p>

          {/* Search bar inside Hero */}
          <div className="max-w-2xl mx-auto pt-1">
            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#78716C]">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search calculators, cycles, textbooks, drawing boards..."
                className="w-full pl-12 pr-28 py-3.5 sm:py-4 bg-white text-[#292524] rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-[#C2410C] text-sm font-medium border border-[#E7E0D8] transition-all"
              />
              <button
                type="submit"
                className="absolute right-2 px-5 py-2 sm:py-2.5 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
              >
                Search
              </button>
            </form>
          </div>

          {/* Quick Hero CTAs */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#listings-grid"
              className="px-5 py-2.5 rounded-xl bg-white hover:bg-[#FFEDD5] hover:text-[#C2410C] text-[#292524] text-xs font-bold border border-[#E7E0D8] shadow-xs transition-colors"
            >
              Explore Auctions ↓
            </a>
            <Link
              to="/create-listing"
              className="px-5 py-2.5 rounded-xl bg-[#C2410C] hover:bg-[#9A3412] text-white text-xs font-bold shadow-md shadow-[#C2410C]/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Sell an Item</span>
            </Link>
          </div>
        </div>

        {/* 3 Steps: How It Works Banner */}
        <div className="max-w-5xl mx-auto mt-12 pt-8 border-t border-[#E7E0D8] grid grid-cols-1 md:grid-cols-3 gap-5 text-[#292524] text-xs">
          <div className="flex items-start gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-[#E7E0D8] shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-[#FFEDD5] text-[#C2410C] flex items-center justify-center shrink-0 font-bold text-sm">
              1
            </div>
            <div>
              <div className="font-bold text-[#292524] text-sm mb-0.5">Verified Students Only</div>
              <p className="text-[#78716C] leading-relaxed">
                Register with your official @kongu.edu account to ensure trusted peers.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-[#E7E0D8] shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-[#FFEDD5] text-[#C2410C] flex items-center justify-center shrink-0 font-bold text-sm">
              2
            </div>
            <div>
              <div className="font-bold text-[#292524] text-sm mb-0.5">Fair Public Bidding</div>
              <p className="text-[#78716C] leading-relaxed">
                Transparent countdowns and real-time bids. The highest valid bid wins automatically.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-[#E7E0D8] shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-[#FFEDD5] text-[#C2410C] flex items-center justify-center shrink-0 font-bold text-sm">
              3
            </div>
            <div>
              <div className="font-bold text-[#292524] text-sm mb-0.5">Physical Campus Handover</div>
              <p className="text-[#78716C] leading-relaxed">
                Meet at the library, canteen, or campus landmark. 2-party confirmation marks it complete.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Marketplace Area */}
      <div id="listings-grid" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Categories Bar */}
        <div className="bg-white rounded-2xl shadow-xs border border-[#E7E0D8] p-3 mb-8 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-2 min-w-max">
            <button
              onClick={() => setSelectedCategory('All')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                selectedCategory === 'All'
                  ? 'bg-[#C2410C] text-white shadow-xs'
                  : 'bg-[#FFFBF5] text-[#78716C] hover:bg-[#FFEDD5]/40 hover:text-[#292524]'
              }`}
            >
              <span>All Categories</span>
            </button>
            {CATEGORIES.map((cat) => {
              const Icon = getCategoryIcon(cat);
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    isSelected
                      ? 'bg-[#C2410C] text-white shadow-xs'
                      : 'bg-[#FFFBF5] text-[#78716C] hover:bg-[#FFEDD5]/40 hover:text-[#292524]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter and Sort Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                showFilters
                  ? 'bg-[#FFEDD5] border-[#FED7AA] text-[#C2410C]'
                  : 'bg-white border-[#E7E0D8] text-[#292524] hover:bg-[#FFFBF5]'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Filters</span>
              {(selectedCondition !== 'All' || minPrice || maxPrice || statusFilter !== 'active') && (
                <span className="w-2 h-2 rounded-full bg-[#C2410C]"></span>
              )}
            </button>

            <span className="text-xs font-semibold text-[#78716C]">
              {loading ? 'Finding items...' : `${auctions.length} auctions available`}
            </span>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-xs text-[#78716C] font-medium">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold bg-white border border-[#E7E0D8] rounded-xl text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#C2410C]"
            >
              <option value="ending_soon">Ending Soonest</option>
              <option value="recently_listed">Recently Listed</option>
              <option value="price_low">Lowest Price</option>
              <option value="price_high">Highest Price</option>
            </select>
          </div>
        </div>

        {/* Expandable Filter Panel */}
        {showFilters && (
          <div className="bg-white p-5 rounded-2xl border border-[#E7E0D8] shadow-sm mb-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E0D8]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#292524]">
                Filter Listings
              </span>
              <button
                onClick={clearFilters}
                className="text-xs text-[#C2410C] hover:underline font-semibold"
              >
                Reset All Filters
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              {/* Condition */}
              <div>
                <label className="block font-semibold text-[#78716C] mb-1.5">Condition</label>
                <select
                  value={selectedCondition}
                  onChange={(e) => setSelectedCondition(e.target.value)}
                  className="w-full p-2.5 bg-[#FFFBF5] border border-[#E7E0D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C2410C]"
                >
                  <option value="All">All Conditions</option>
                  {CONDITIONS.map((cond) => (
                    <option key={cond} value={cond}>
                      {cond}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block font-semibold text-[#78716C] mb-1.5">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full p-2.5 bg-[#FFFBF5] border border-[#E7E0D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C2410C]"
                >
                  <option value="active">Active Auctions Only</option>
                  <option value="ended">Ended Auctions</option>
                  <option value="all">All Listings (Active & Closed)</option>
                </select>
              </div>

              {/* Price Range */}
              <div className="sm:col-span-2">
                <label className="block font-semibold text-[#78716C] mb-1.5">
                  Price Range (₹ INR)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    placeholder="Min ₹"
                    className="w-full p-2.5 bg-[#FFFBF5] border border-[#E7E0D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C2410C]"
                  />
                  <span className="text-[#78716C]">to</span>
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="Max ₹"
                    className="w-full p-2.5 bg-[#FFFBF5] border border-[#E7E0D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C2410C]"
                  />
                  <button
                    onClick={fetchAuctions}
                    className="px-4 py-2.5 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-xl font-bold transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Listings Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <div
                key={n}
                className="bg-white rounded-2xl border border-[#E7E0D8] p-4 space-y-3 animate-pulse"
              >
                <div className="aspect-4/3 bg-[#FFFBF5] rounded-xl"></div>
                <div className="h-4 bg-[#E7E0D8] rounded w-3/4"></div>
                <div className="h-3 bg-[#E7E0D8]/60 rounded w-1/2"></div>
                <div className="pt-2 flex justify-between">
                  <div className="h-6 bg-[#E7E0D8] rounded w-20"></div>
                  <div className="h-6 bg-[#E7E0D8] rounded w-16"></div>
                </div>
              </div>
            ))}
          </div>
        ) : auctions.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-3xl border border-[#E7E0D8] p-12 text-center max-w-xl mx-auto shadow-xs my-8 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#FFEDD5] text-[#C2410C] flex items-center justify-center mx-auto">
              <Package className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-extrabold text-[#292524]">No Auctions Found</h3>
            <p className="text-sm text-[#78716C] leading-relaxed">
              We couldn't find any listings matching your current search or filter criteria. Try adjusting your keywords or be the first to list an item!
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={clearFilters}
                className="px-4 py-2 border border-[#E7E0D8] text-[#292524] rounded-xl text-xs font-semibold hover:bg-[#FFFBF5]"
              >
                Clear Filters
              </button>
              <Link
                to="/create-listing"
                className="px-4 py-2 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                List Item for Auction
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {auctions.map((auction) => (
              <AuctionCard key={auction._id} auction={auction} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
