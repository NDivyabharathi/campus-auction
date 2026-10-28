import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Gavel,
  PlusCircle,
  Package,
  History,
  Handshake,
  LogOut,
  Menu,
  X,
  Compass,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navLinks = [
    { name: 'Explore', path: '/auctions', icon: Compass },
    { name: 'Sell an Item', path: '/create-listing', icon: PlusCircle, highlight: true },
    { name: 'My Listings', path: '/my-listings', icon: Package, protected: true },
    { name: 'My Bids', path: '/my-bids', icon: History, protected: true },
    { name: 'Transactions', path: '/transactions', icon: Handshake, protected: true },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#E7E0D8] shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-[#C2410C] flex items-center justify-center text-white shadow-md shadow-[#C2410C]/20 group-hover:bg-[#9A3412] transition-colors duration-200">
              <Gavel className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-[#292524] group-hover:text-[#C2410C] transition-colors">
                Campus<span className="text-[#C2410C]">Auction</span>
              </span>
              <span className="hidden sm:inline-block ml-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#FFEDD5] text-[#C2410C] rounded-md border border-[#FED7AA]">
                Kongu Only
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1.5">
            {navLinks.map((item) => {
              if (item.protected && !user) return null;
              const Icon = item.icon;
              const active = isActive(item.path);

              if (item.highlight) {
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="ml-2 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-[#C2410C] text-white hover:bg-[#9A3412] shadow-xs shadow-[#C2410C]/25 transition-all hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              }

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                    active
                      ? 'text-[#C2410C] bg-[#FFEDD5]/70 font-semibold'
                      : 'text-[#78716C] hover:text-[#292524] hover:bg-[#FFFBF5]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Section: Auth & Profile */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3 pl-3 border-l border-[#E7E0D8]">
                <div className="text-right">
                  <div className="text-xs font-bold text-[#292524] leading-tight">
                    {user.fullName}
                  </div>
                  <div className="text-[11px] text-[#78716C] font-mono">
                    {user.department ? `${user.department} • ` : ''}Kongu
                  </div>
                </div>
                <div className="w-9 h-9 rounded-full bg-[#FFEDD5] border border-[#FED7AA] flex items-center justify-center text-[#C2410C] font-bold text-sm">
                  {user.fullName.charAt(0).toUpperCase()}
                </div>
                <button
                  onClick={handleLogout}
                  title="Log out"
                  className="p-2 text-[#78716C] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3.5 py-2 rounded-xl text-sm font-medium text-[#78716C] hover:text-[#292524] hover:bg-[#FFFBF5] transition-colors"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#292524] text-white hover:bg-[#1C1917] transition-colors shadow-xs"
                >
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-[#78716C] hover:text-[#292524] hover:bg-[#FFFBF5]"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#E7E0D8] bg-white px-4 pt-3 pb-5 space-y-2">
          {user && (
            <div className="flex items-center gap-3 p-3 bg-[#FFFBF5] rounded-xl mb-3 border border-[#E7E0D8]">
              <div className="w-10 h-10 rounded-full bg-[#FFEDD5] text-[#C2410C] font-bold flex items-center justify-center text-base">
                {user.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-[#292524] truncate">{user.fullName}</div>
                <div className="text-xs text-[#78716C] font-mono truncate">{user.email}</div>
              </div>
            </div>
          )}

          {navLinks.map((item) => {
            if (item.protected && !user) return null;
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${
                  item.highlight
                    ? 'bg-[#C2410C] text-white font-semibold'
                    : active
                    ? 'text-[#C2410C] bg-[#FFEDD5]/70 font-semibold'
                    : 'text-[#78716C] hover:bg-[#FFFBF5]'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}

          <div className="pt-3 border-t border-[#E7E0D8]">
            {user ? (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Sign Out</span>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 text-center text-sm font-medium border border-[#E7E0D8] rounded-xl text-[#292524] hover:bg-[#FFFBF5]"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 text-center text-sm font-semibold bg-[#C2410C] text-white rounded-xl hover:bg-[#9A3412]"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
