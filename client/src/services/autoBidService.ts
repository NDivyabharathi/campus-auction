import { api } from './api.js';
import type { AutoBid, MyAutoBidResponse } from '../types/index.js';

export const getMyAutoBid = async (auctionId: string): Promise<MyAutoBidResponse> => {
  const res = await api.get<MyAutoBidResponse>(`/auctions/${auctionId}/auto-bid/me`);
  return res.data;
};

export const enableAutoBid = async (
  auctionId: string,
  maxAmount: number
): Promise<{ success: boolean; message: string; autoBid: AutoBid }> => {
  const res = await api.post<{ success: boolean; message: string; autoBid: AutoBid }>(
    `/auctions/${auctionId}/auto-bid`,
    { maxAmount }
  );
  return res.data;
};

export const updateAutoBid = async (
  auctionId: string,
  data: { maxAmount?: number; status?: 'active' | 'paused' }
): Promise<{ success: boolean; message: string; autoBid: AutoBid }> => {
  const res = await api.patch<{ success: boolean; message: string; autoBid: AutoBid }>(
    `/auctions/${auctionId}/auto-bid`,
    data
  );
  return res.data;
};

export const disableAutoBid = async (
  auctionId: string
): Promise<{ success: boolean; message: string; autoBid: Partial<AutoBid> }> => {
  const res = await api.delete<{ success: boolean; message: string; autoBid: Partial<AutoBid> }>(
    `/auctions/${auctionId}/auto-bid`
  );
  return res.data;
};
