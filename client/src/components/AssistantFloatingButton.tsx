import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { AssistantChatPanel } from './AssistantChatPanel.js';

export const AssistantFloatingButton: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  // Only show for authenticated students, hide on login/register pages
  if (!user) return null;
  if (['/login', '/register'].includes(location.pathname)) return null;

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label="Open shopping assistant"
          title="Open shopping assistant"
          className="group relative flex items-center gap-2 px-4 py-3 sm:px-4 sm:py-3.5 rounded-full bg-[#C2410C] hover:bg-[#9A3412] text-white shadow-xl shadow-[#C2410C]/25 hover:shadow-2xl hover:shadow-[#C2410C]/35 transition-all duration-300 transform active:scale-95 cursor-pointer border-2 border-white/20"
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#FFEDD5] border-2 border-[#C2410C]" />
          </div>
          <span className="hidden sm:inline-block font-extrabold text-xs tracking-wide">
            Campus Assistant
          </span>
        </button>
      </div>

      <AssistantChatPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};
