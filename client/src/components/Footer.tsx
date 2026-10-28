import React from 'react';
import { Gavel, ShieldCheck, HeartHandshake, MapPin } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                <Gavel className="w-4 h-4" />
              </div>
              <span className="text-lg font-bold text-slate-900">
                Campus<span className="text-indigo-600">Auction</span>
              </span>
            </div>
            <p className="text-sm text-slate-500 max-w-md leading-relaxed">
              A fair, campus-only auction marketplace built exclusively for Kongu Engineering College. 
              Giving pre-loved books, electronics, calculators, cycles, and lab tools a second round.
            </p>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <MapPin className="w-4 h-4 text-indigo-500" />
              <span>Perundurai, Erode, Tamil Nadu 638060</span>
            </div>
          </div>

          {/* Pillars */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Campus Guarantees
            </h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>@kongu.edu Verified</span>
              </li>
              <li className="flex items-center gap-2">
                <HeartHandshake className="w-4 h-4 text-indigo-500" />
                <span>Physical In-Campus Handover</span>
              </li>
              <li className="flex items-center gap-2">
                <Gavel className="w-4 h-4 text-blue-500" />
                <span>Transparent Public Bidding</span>
              </li>
            </ul>
          </div>

          {/* Useful categories */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Popular Items
            </h4>
            <ul className="space-y-1.5 text-sm text-slate-600">
              <li>Cycles & Campus Mobility</li>
              <li>Engineering Textbooks</li>
              <li>Scientific Calculators & Tools</li>
              <li>Hostel & Room Essentials</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-3">
          <p>© 2026 Campus Auction. Kongu Engineering College Hackathon Edition.</p>
          <p className="font-mono">Restricted to @kongu.edu students only</p>
        </div>
      </div>
    </footer>
  );
};
