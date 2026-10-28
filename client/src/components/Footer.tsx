import React from 'react';
import { Gavel, ShieldCheck, HeartHandshake, MapPin } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-[#E7E0D8] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#C2410C] flex items-center justify-center text-white shadow-xs">
                <Gavel className="w-4 h-4" />
              </div>
              <span className="text-lg font-bold text-[#292524]">
                Campus<span className="text-[#C2410C]">Auction</span>
              </span>
            </div>
            <p className="text-sm text-[#78716C] max-w-md leading-relaxed">
              A fair, campus-only auction marketplace built exclusively for Kongu Engineering College. 
              Giving pre-loved books, electronics, calculators, cycles, and lab tools a second round.
            </p>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#78716C]">
              <MapPin className="w-4 h-4 text-[#C2410C]" />
              <span>Perundurai, Erode, Tamil Nadu 638060</span>
            </div>
          </div>

          {/* Pillars */}
          <div>
            <h4 className="text-xs font-bold text-[#292524] uppercase tracking-wider mb-3">
              Campus Guarantees
            </h4>
            <ul className="space-y-2.5 text-sm text-[#78716C]">
              <li className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#15803D]" />
                <span>@kongu.edu Verified</span>
              </li>
              <li className="flex items-center gap-2">
                <HeartHandshake className="w-4 h-4 text-[#C2410C]" />
                <span>Physical In-Campus Handover</span>
              </li>
              <li className="flex items-center gap-2">
                <Gavel className="w-4 h-4 text-[#C2410C]" />
                <span>Transparent Public Bidding</span>
              </li>
            </ul>
          </div>

          {/* Useful categories */}
          <div>
            <h4 className="text-xs font-bold text-[#292524] uppercase tracking-wider mb-3">
              Popular Items
            </h4>
            <ul className="space-y-2 text-sm text-[#78716C]">
              <li>Cycles & Campus Mobility</li>
              <li>Engineering Textbooks</li>
              <li>Scientific Calculators & Tools</li>
              <li>Hostel & Room Essentials</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[#E7E0D8] pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-[#78716C] gap-3">
          <p>© 2026 Campus Auction. Kongu Engineering College Hackathon Edition.</p>
          <p className="font-mono text-[#C2410C] font-semibold">Restricted to @kongu.edu students only</p>
        </div>
      </div>
    </footer>
  );
};
