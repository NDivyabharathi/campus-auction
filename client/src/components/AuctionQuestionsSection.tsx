import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  HelpCircle,
  MessageCircle,
  Send,
  Pencil,
  Trash2,
  CheckCircle2,
  Lock,
  AlertCircle,
  CornerDownRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import type { AuctionQuestion } from '../types/index.js';
import {
  getAuctionQuestions,
  askQuestion,
  editQuestion,
  deleteQuestion,
  answerQuestion,
} from '../services/questionService.js';
import { formatDate } from '../utils/formatters.js';

interface AuctionQuestionsSectionProps {
  auctionId: string;
  isClosed: boolean;
  sellerId?: string;
}

export const AuctionQuestionsSection: React.FC<AuctionQuestionsSectionProps> = ({
  auctionId,
  isClosed,
}) => {
  const { user } = useAuth();

  const [questions, setQuestions] = useState<AuctionQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Ask Question Form state
  const [newQuestionText, setNewQuestionText] = useState('');
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [questionFeedback, setQuestionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit Question state
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Answer Form state (map of questionId -> answer text)
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [submittingAnswerId, setSubmittingAnswerId] = useState<string | null>(null);
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);

  // Load questions
  const loadQuestions = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getAuctionQuestions(auctionId);
      setQuestions(data);
    } catch (err: any) {
      console.error(err);
      setError('Failed to load questions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (auctionId) {
      loadQuestions();
    }
  }, [auctionId]);

  // Submit new question
  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newQuestionText.trim();
    if (!clean || clean.length < 3 || submittingQuestion) return;

    try {
      setSubmittingQuestion(true);
      setQuestionFeedback(null);
      const created = await askQuestion(auctionId, clean);
      setQuestions((prev) => [created, ...prev]);
      setNewQuestionText('');
      setQuestionFeedback({ type: 'success', message: 'Question posted! The seller has been notified.' });
      setTimeout(() => setQuestionFeedback(null), 4000);
    } catch (err: any) {
      setQuestionFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to submit question.',
      });
    } finally {
      setSubmittingQuestion(false);
    }
  };

  // Save edited question
  const handleSaveEdit = async (questionId: string) => {
    const clean = editText.trim();
    if (!clean || clean.length < 3 || savingEdit) return;

    try {
      setSavingEdit(true);
      const updated = await editQuestion(questionId, clean);
      setQuestions((prev) => prev.map((q) => (q._id === questionId ? updated : q)));
      setEditingQuestionId(null);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update question.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete question
  const handleDeleteQuestion = async (questionId: string) => {
    try {
      setDeletingId(questionId);
      await deleteQuestion(questionId);
      setQuestions((prev) => prev.filter((q) => q._id !== questionId));
      setConfirmDeleteId(null);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete question.');
    } finally {
      setDeletingId(null);
    }
  };

  // Submit answer
  const handlePostAnswer = async (questionId: string) => {
    const text = (replyInputs[questionId] || '').trim();
    if (!text || submittingAnswerId) return;

    try {
      setSubmittingAnswerId(questionId);
      const updatedQuestion = await answerQuestion(questionId, text);
      setQuestions((prev) => prev.map((q) => (q._id === questionId ? updatedQuestion : q)));
      setReplyInputs((prev) => ({ ...prev, [questionId]: '' }));
      setActiveReplyId(null);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to post answer.');
    } finally {
      setSubmittingAnswerId(null);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-[#E7E0D8] p-6 sm:p-8 space-y-6 shadow-xs">
      {/* Section Header */}
      <div className="flex items-start justify-between border-b border-[#E7E0D8] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-[#292524]">Questions & Answers</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-[#FFEDD5] text-[#C2410C]">
              {questions.length}
            </span>
          </div>
          <p className="text-xs text-[#78716C] mt-1">
            Have a question about this item? Ask the campus community before placing your bid.
          </p>
        </div>
      </div>

      {/* Ask Question Box */}
      {isClosed ? (
        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-stone-600 flex items-center gap-3 text-xs">
          <Lock className="w-4 h-4 shrink-0 text-stone-400" />
          <span>
            This auction has ended. Questions and answers are available for reference, but new discussions are closed.
          </span>
        </div>
      ) : !user ? (
        <div className="p-4 rounded-2xl bg-[#FFFBF5] border border-[#FED7AA] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-[#78716C]">
            <HelpCircle className="w-4 h-4 text-[#C2410C]" />
            <span>Have a question about this listing?</span>
          </div>
          <Link
            to="/login"
            className="px-3.5 py-1.5 rounded-xl bg-[#C2410C] hover:bg-[#9A3412] text-white font-bold transition-colors"
          >
            Log In to Ask
          </Link>
        </div>
      ) : (
        <form onSubmit={handleAskQuestion} className="space-y-3">
          <div className="relative">
            <textarea
              value={newQuestionText}
              onChange={(e) => setNewQuestionText(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Ask about physical condition, brake test, battery health, charger, hostel exchange..."
              className="w-full p-3.5 pb-7 text-xs bg-[#FFFBF5] text-[#292524] rounded-2xl border border-[#E7E0D8] focus:outline-none focus:ring-2 focus:ring-[#C2410C] font-medium placeholder-[#78716C]/60 resize-none transition-all"
            />
            <div className="absolute bottom-2 right-3 text-[10px] text-[#78716C] font-medium">
              {newQuestionText.length}/500
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#78716C]">
              Public to all students. The seller will be notified.
            </span>
            <button
              type="submit"
              disabled={newQuestionText.trim().length < 3 || submittingQuestion}
              className="px-4 py-2 rounded-xl bg-[#C2410C] hover:bg-[#9A3412] disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              <Send className="w-3 h-3" />
              <span>{submittingQuestion ? 'Posting...' : 'Ask Question'}</span>
            </button>
          </div>

          {questionFeedback && (
            <div
              className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                questionFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {questionFeedback.type === 'success' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              )}
              <span>{questionFeedback.message}</span>
            </div>
          )}
        </form>
      )}

      {/* Questions List */}
      <div className="space-y-4 pt-2">
        {error ? (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : loading ? (
          <div className="text-center py-8 text-xs text-[#78716C]">
            Loading discussion...
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-8 px-4 rounded-2xl bg-[#FFFBF5] border border-dashed border-[#E7E0D8] space-y-2">
            <MessageCircle className="w-8 h-8 text-[#FED7AA] mx-auto" />
            <h4 className="font-bold text-[#292524] text-xs">No questions yet</h4>
            <p className="text-[11px] text-[#78716C] max-w-sm mx-auto">
              Be the first to ask about this item! Questions help ensure fair, transparent bidding for everyone.
            </p>
          </div>
        ) : (
          questions.map((question) => {
            const isEditing = editingQuestionId === question._id;
            const hasAnswers = question.answers && question.answers.length > 0;
            const canManage = question.canEditDelete && !isClosed;
            const isReplying = activeReplyId === question._id;

            return (
              <div
                key={question._id}
                className="p-4 rounded-2xl border border-[#E7E0D8] bg-[#FFFBF5]/40 space-y-3 hover:border-[#FED7AA] transition-colors"
              >
                {/* Question Author Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#FFEDD5] border border-[#FED7AA] text-[#C2410C] font-bold text-xs flex items-center justify-center shrink-0">
                      {question.authorId?.fullName?.charAt(0)?.toUpperCase() || 'S'}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-[#292524]">
                          {question.authorId?.fullName || 'Student'}
                        </span>
                        {question.isSeller && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-[#FFEDD5] text-[#C2410C]">
                            Seller
                          </span>
                        )}
                        {question.isAuthor && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-stone-100 text-stone-600">
                            You
                          </span>
                        )}
                        {question.authorId?.department && (
                          <span className="text-[10px] text-[#78716C]">
                            • {question.authorId.department}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#78716C] block mt-0.5">
                        {formatDate(question.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Edit/Delete controls for author of unanswered question */}
                  {canManage && !isEditing && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingQuestionId(question._id);
                          setEditText(question.text);
                        }}
                        className="p-1 text-[#78716C] hover:text-[#C2410C] rounded-lg transition-colors cursor-pointer"
                        title="Edit question"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      {confirmDeleteId === question._id ? (
                        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-rose-200">
                          <button
                            type="button"
                            onClick={() => handleDeleteQuestion(question._id)}
                            disabled={deletingId === question._id}
                            className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold"
                          >
                            {deletingId === question._id ? '...' : 'Confirm'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-1.5 py-0.5 text-[10px] text-[#78716C]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(question._id)}
                          className="p-1 text-[#78716C] hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                          title="Delete question"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Question Body or Edit Form */}
                {isEditing ? (
                  <div className="space-y-2 pt-1">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      maxLength={500}
                      rows={2}
                      className="w-full p-2.5 text-xs bg-white text-[#292524] rounded-xl border border-[#C2410C] focus:outline-none"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[#78716C]">{editText.length}/500</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingQuestionId(null)}
                          className="px-2.5 py-1 text-xs text-[#78716C] font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(question._id)}
                          disabled={savingEdit || editText.trim().length < 3}
                          className="px-3 py-1 rounded-lg bg-[#C2410C] text-white text-xs font-bold"
                        >
                          {savingEdit ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#292524] leading-relaxed font-medium pl-0.5">
                    {question.text}
                  </p>
                )}

                {/* Answers List */}
                {hasAnswers && (
                  <div className="space-y-2.5 pl-4 border-l-2 border-[#FED7AA] mt-3">
                    {question.answers.map((answer) => (
                      <div
                        key={answer._id}
                        className={`p-3 rounded-xl text-xs space-y-1 ${
                          answer.isSeller
                            ? 'bg-[#FFF5EA] border border-[#FED7AA]'
                            : 'bg-white border border-[#E7E0D8]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-[#292524]">
                              {answer.authorId?.fullName || 'Student'}
                            </span>
                            {answer.isSeller ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-[#C2410C] text-white shadow-2xs">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                <span>Seller Answer</span>
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-stone-100 text-stone-600">
                                Student Answer
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-[#78716C]">
                            {formatDate(answer.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-[#292524] leading-relaxed pl-0.5">
                          {answer.text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply Button & Reply Form */}
                {!isClosed && user && (
                  <div className="pt-1">
                    {!isReplying ? (
                      <button
                        type="button"
                        onClick={() => setActiveReplyId(question._id)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#C2410C] hover:text-[#9A3412] transition-colors cursor-pointer"
                      >
                        <CornerDownRight className="w-3 h-3" />
                        <span>Reply to this question</span>
                      </button>
                    ) : (
                      <div className="space-y-2 pt-2 bg-white p-3 rounded-xl border border-[#FED7AA]">
                        <div className="flex items-center justify-between text-[11px] text-[#78716C] font-semibold">
                          <span>Post an answer:</span>
                          <button
                            type="button"
                            onClick={() => setActiveReplyId(null)}
                            className="text-[#78716C] hover:text-[#292524]"
                          >
                            Cancel
                          </button>
                        </div>
                        <div className="relative">
                          <textarea
                            value={replyInputs[question._id] || ''}
                            onChange={(e) =>
                              setReplyInputs((prev) => ({ ...prev, [question._id]: e.target.value }))
                            }
                            maxLength={1000}
                            rows={2}
                            placeholder="Type your answer (clarifications, handover details, component check)..."
                            className="w-full p-2.5 pb-6 text-xs bg-[#FFFBF5] text-[#292524] rounded-lg border border-[#E7E0D8] focus:outline-none focus:ring-1 focus:ring-[#C2410C] resize-none"
                          />
                          <div className="absolute bottom-1.5 right-2 text-[10px] text-[#78716C]">
                            {(replyInputs[question._id] || '').length}/1000
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handlePostAnswer(question._id)}
                            disabled={
                              !(replyInputs[question._id] || '').trim() ||
                              submittingAnswerId === question._id
                            }
                            className="px-3 py-1.5 rounded-lg bg-[#C2410C] hover:bg-[#9A3412] disabled:opacity-40 text-white text-xs font-bold transition-colors cursor-pointer"
                          >
                            {submittingAnswerId === question._id ? 'Posting...' : 'Post Answer'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
