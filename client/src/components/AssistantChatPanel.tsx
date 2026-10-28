import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Sparkles,
  X,
  RotateCcw,
  Send,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { AssistantChatMessage, AssistantItem } from '../types/index.js';
import { askAssistant, type AssistantRequestContext } from '../services/assistantService.js';
import { AssistantAuctionCard } from './AssistantAuctionCard.js';
import { AssistantBidCard } from './AssistantBidCard.js';
import { AssistantSuggestionChips } from './AssistantSuggestionChips.js';

interface AssistantChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_PROMPTS = [
  'Find a cycle under ₹2,000',
  'Show calculators below ₹400',
  'Find items ending soon',
  'Show good-condition books',
  'Find hostel essentials under ₹500',
];

export const AssistantChatPanel: React.FC<AssistantChatPanelProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // In-memory conversation context
  const [context, setContext] = useState<AssistantRequestContext>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if current route is an auction details page
  const currentAuctionId = location.pathname.startsWith('/auctions/')
    ? location.pathname.split('/')[2]
    : undefined;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || loading) return;

    setError(null);
    setInputText('');

    // Append user message
    const userMsg: AssistantChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const activeContext: AssistantRequestContext = {
        ...context,
        currentAuctionId: currentAuctionId || context.currentAuctionId,
      };

      const res = await askAssistant(query, activeContext);

      if (res.success) {
        const assistantMsg: AssistantChatMessage = {
          id: `bot-${Date.now()}`,
          sender: 'assistant',
          text: res.reply,
          results: res.results,
          bidRecommendation: res.bidRecommendation,
          followUpSuggestions: res.followUpSuggestions,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMsg]);

        // Update in-memory conversation context
        const newResultIds = res.results && res.results.length > 0
          ? res.results.map((r: AssistantItem) => r.id)
          : context.previousResultIds;

        setContext({
          previousSearch: res.criteria || context.previousSearch,
          previousResultIds: newResultIds,
          currentAuctionId: res.bidRecommendation?.auctionId || currentAuctionId,
        });
      } else {
        setError(res.message || 'Could not process query.');
      }
    } catch (err: any) {
      console.error('[Assistant Chat Error]', err);
      setError(err.response?.data?.message || 'Failed to connect to the assistant service.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setContext({});
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-4 bottom-20 sm:inset-auto sm:bottom-24 sm:right-6 w-auto sm:w-[420px] h-[580px] max-h-[82vh] bg-white rounded-3xl shadow-2xl border border-[#E7E0D8] flex flex-col z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      {/* Panel Header */}
      <div className="px-4 py-3.5 bg-gradient-to-r from-[#FFF5EA] via-[#FFFBF5] to-white border-b border-[#E7E0D8] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#FFEDD5] border border-[#FED7AA] flex items-center justify-center text-[#C2410C] shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-extrabold text-[#292524] text-sm">Campus Assistant</h3>
              <span className="w-2 h-2 rounded-full bg-[#15803D]" title="Active" />
            </div>
            <p className="text-[11px] text-[#78716C] leading-none mt-0.5">
              Find the right item across campus
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              title="Clear conversation"
              className="p-1.5 text-[#78716C] hover:text-[#C2410C] hover:bg-[#FFEDD5]/50 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            title="Close assistant"
            className="p-1.5 text-[#78716C] hover:text-[#292524] hover:bg-[#FFFBF5] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FFFBF5]/40 scrollbar-thin">
        {messages.length === 0 ? (
          /* Empty / Welcome Greeting */
          <div className="space-y-4 pt-2">
            <div className="bg-white rounded-2xl border border-[#E7E0D8] p-4 shadow-xs">
              <div className="w-10 h-10 rounded-2xl bg-[#FFEDD5] text-[#C2410C] flex items-center justify-center mb-3">
                <Sparkles className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-[#292524] text-sm">
                Hi! 👋 What are you looking for today?
              </h4>
              <p className="text-xs text-[#78716C] mt-1.5 leading-relaxed">
                Tell me what you need, your budget, or when you want an auction to end. I will help you find matching items across Kongu Engineering College.
              </p>
            </div>

            {/* Suggested Prompts */}
            <div>
              <span className="text-[11px] font-bold text-[#78716C] uppercase tracking-wider block mb-2 px-1">
                Suggested questions
              </span>
              <div className="flex flex-col gap-1.5">
                {DEFAULT_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(prompt)}
                    className="text-left px-3.5 py-2.5 rounded-xl bg-white hover:bg-[#FFEDD5] border border-[#E7E0D8] hover:border-[#FED7AA] text-xs font-medium text-[#292524] hover:text-[#C2410C] transition-all flex items-center justify-between group shadow-2xs cursor-pointer"
                  >
                    <span>{prompt}</span>
                    <Sparkles className="w-3.5 h-3.5 text-[#FED7AA] group-hover:text-[#C2410C] transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Conversation Messages */
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              {msg.sender === 'user' ? (
                /* User Bubble */
                <div className="max-w-[85%] bg-[#C2410C] text-white px-4 py-2.5 rounded-2xl rounded-tr-xs text-xs font-medium shadow-xs leading-relaxed">
                  {msg.text}
                </div>
              ) : (
                /* Assistant Bubble */
                <div className="max-w-[95%] space-y-3">
                  <div className="bg-white text-[#292524] border border-[#E7E0D8] p-3.5 rounded-2xl rounded-tl-xs text-xs shadow-xs leading-relaxed">
                    <p>{msg.text}</p>

                    {/* Results Item Cards */}
                    {msg.results && msg.results.length > 0 && (
                      <div className="mt-3 space-y-2.5">
                        {msg.results.map((item) => (
                          <AssistantAuctionCard
                            key={item.id}
                            item={item}
                            onNavigate={onClose}
                          />
                        ))}
                      </div>
                    )}

                    {/* Bid Recommendation Card */}
                    {msg.bidRecommendation && (
                      <div className="mt-3">
                        <AssistantBidCard
                          recommendation={msg.bidRecommendation}
                          onNavigate={onClose}
                        />
                      </div>
                    )}
                  </div>

                  {/* Dynamic Follow-up Suggestion Chips */}
                  {msg.followUpSuggestions && msg.followUpSuggestions.length > 0 && (
                    <AssistantSuggestionChips
                      suggestions={msg.followUpSuggestions}
                      onSelect={(chip) => handleSendMessage(chip)}
                      disabled={loading}
                    />
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-[#78716C] bg-white border border-[#E7E0D8] p-3 rounded-2xl rounded-tl-xs w-max shadow-xs">
            <Loader2 className="w-4 h-4 text-[#C2410C] animate-spin" />
            <span>Searching live campus listings...</span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{error}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-3 bg-white border-t border-[#E7E0D8] shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative flex items-center"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask about items, budget, or bids..."
            disabled={loading}
            className="w-full pl-3.5 pr-11 py-2.5 bg-[#FFFBF5] text-[#292524] rounded-xl border border-[#E7E0D8] focus:outline-none focus:ring-2 focus:ring-[#C2410C] text-xs font-medium placeholder-[#78716C]/70 transition-all disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || loading}
            className="absolute right-1.5 p-2 rounded-lg bg-[#C2410C] hover:bg-[#9A3412] text-white disabled:opacity-40 disabled:hover:bg-[#C2410C] transition-colors cursor-pointer"
            title="Send query"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
        <div className="flex items-center justify-between text-[10px] text-[#78716C] mt-1.5 px-1">
          <span>Rule-based search across live MongoDB auctions</span>
          <span>Press Enter to send</span>
        </div>
      </div>
    </div>
  );
};
