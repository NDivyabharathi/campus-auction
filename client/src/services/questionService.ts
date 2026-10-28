import { api } from './api.js';
import type { AuctionQuestion } from '../types/index.js';

export const getAuctionQuestions = async (auctionId: string): Promise<AuctionQuestion[]> => {
  const res = await api.get<{ success: boolean; count: number; questions: AuctionQuestion[] }>(
    `/auctions/${auctionId}/questions`
  );
  return res.data.questions || [];
};

export const askQuestion = async (auctionId: string, text: string): Promise<AuctionQuestion> => {
  const res = await api.post<{ success: boolean; question: AuctionQuestion }>(
    `/auctions/${auctionId}/questions`,
    { text }
  );
  return res.data.question;
};

export const editQuestion = async (questionId: string, text: string): Promise<AuctionQuestion> => {
  const res = await api.patch<{ success: boolean; question: AuctionQuestion }>(
    `/questions/${questionId}`,
    { text }
  );
  return res.data.question;
};

export const deleteQuestion = async (questionId: string): Promise<void> => {
  await api.delete(`/questions/${questionId}`);
};

export const answerQuestion = async (
  questionId: string,
  text: string
): Promise<AuctionQuestion> => {
  const res = await api.post<{ success: boolean; question: AuctionQuestion }>(
    `/questions/${questionId}/answers`,
    { text }
  );
  return res.data.question;
};
