import { api } from './api.js';
import type { AssistantItem, BidRecommendation } from '../types/index.js';

export interface AssistantChatResponse {
  success: boolean;
  reply: string;
  intent: 'search_auctions' | 'refine_search' | 'suggest_bid' | 'greeting' | 'clarification';
  criteria?: any;
  results: AssistantItem[];
  bidRecommendation?: BidRecommendation | null;
  followUpSuggestions: string[];
  message?: string;
}

export interface AssistantRequestContext {
  previousSearch?: any;
  previousResultIds?: string[];
  currentAuctionId?: string;
}

export const askAssistant = async (
  message: string,
  context?: AssistantRequestContext
): Promise<AssistantChatResponse> => {
  const res = await api.post<AssistantChatResponse>('/assistant/chat', {
    message,
    context,
  });
  return res.data;
};
