import React from 'react';
import { Sparkles } from 'lucide-react';

interface AssistantSuggestionChipsProps {
  suggestions: string[];
  onSelect: (text: string) => void;
  disabled?: boolean;
}

export const AssistantSuggestionChips: React.FC<AssistantSuggestionChipsProps> = ({
  suggestions,
  onSelect,
  disabled = false,
}) => {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {suggestions.map((suggestion, idx) => (
        <button
          key={idx}
          type="button"
          onClick={() => onSelect(suggestion)}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white hover:bg-[#FFEDD5] text-[#292524] hover:text-[#C2410C] border border-[#E7E0D8] hover:border-[#FED7AA] shadow-2xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-3 h-3 text-[#C2410C]" />
          <span>{suggestion}</span>
        </button>
      ))}
    </div>
  );
};

