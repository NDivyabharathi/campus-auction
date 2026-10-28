import { api } from './api.js';
import type { Want, WantMatch, AuctionCategory, ItemCondition } from '../types/index.js';

export interface CreateWantData {
  keywords: string;
  category?: AuctionCategory | '';
  maxPrice?: number | null;
  condition?: ItemCondition | '';
}

export interface GetWantsResponse {
  success: boolean;
  count: number;
  activeCount: number;
  wants: Want[];
}

export interface WantMatchesResponse {
  success: boolean;
  want: Want;
  count: number;
  matches: WantMatch[];
}

export const wantService = {
  getWants: async (): Promise<GetWantsResponse> => {
    const res = await api.get<GetWantsResponse>('/wants');
    return res.data;
  },

  getWantById: async (id: string): Promise<{ success: boolean; want: Want }> => {
    const res = await api.get<{ success: boolean; want: Want }>(`/wants/${id}`);
    return res.data;
  },

  createWant: async (
    data: CreateWantData
  ): Promise<{ success: boolean; message: string; want: Want; matchesFound: number }> => {
    const payload: any = {
      keywords: data.keywords.trim(),
    };
    if (data.category) payload.category = data.category;
    if (data.maxPrice !== undefined && data.maxPrice !== null && data.maxPrice > 0) {
      payload.maxPrice = data.maxPrice;
    }
    if (data.condition) payload.condition = data.condition;

    const res = await api.post<{ success: boolean; message: string; want: Want; matchesFound: number }>(
      '/wants',
      payload
    );
    return res.data;
  },

  toggleWantStatus: async (
    id: string,
    status: 'ACTIVE' | 'PAUSED'
  ): Promise<{ success: boolean; message: string; want: Want; matchesFound?: number }> => {
    const res = await api.patch<{ success: boolean; message: string; want: Want; matchesFound?: number }>(
      `/wants/${id}`,
      { status }
    );
    return res.data;
  },

  renewWant: async (
    id: string
  ): Promise<{ success: boolean; message: string; want: Want; matchesFound: number }> => {
    const res = await api.post<{ success: boolean; message: string; want: Want; matchesFound: number }>(
      `/wants/${id}/renew`
    );
    return res.data;
  },

  fulfillWant: async (id: string): Promise<{ success: boolean; message: string; want: Want }> => {
    const res = await api.post<{ success: boolean; message: string; want: Want }>(`/wants/${id}/fulfill`);
    return res.data;
  },

  deleteWant: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete<{ success: boolean; message: string }>(`/wants/${id}`);
    return res.data;
  },

  getWantMatches: async (id: string): Promise<WantMatchesResponse> => {
    const res = await api.get<WantMatchesResponse>(`/wants/${id}/matches`);
    return res.data;
  },
};
