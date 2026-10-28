import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  X,
  IndianRupee,
  Clock,
  CheckCircle2,
  AlertCircle,
  Info,
} from 'lucide-react';
import { api } from '../services/api.js';
import { CATEGORIES, CONDITIONS } from '../utils/formatters.js';

export const CreateListingPage: React.FC = () => {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [condition, setCondition] = useState<string>(CONDITIONS[2]); // default Good
  const [description, setDescription] = useState('');
  const [startingPrice, setStartingPrice] = useState<number | ''>(100);
  const [minimumBidIncrement, setMinimumBidIncrement] = useState<number | ''>(20);
  
  // Set default closing date 3 days in future
  const defaultClosing = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  // Format for datetime-local input: YYYY-MM-DDTHH:MM
  const formatForInput = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [closingAt, setClosingAt] = useState(formatForInput(defaultClosing));
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);

    if (imageFiles.length + files.length > 5) {
      setError('You can upload a maximum of 5 images per listing.');
      return;
    }

    const validFiles: File[] = [];
    const validPreviews: string[] = [];

    for (const file of files) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setError('Only JPEG, PNG, and WebP image formats are supported.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError(`Image ${file.name} exceeds 5MB limit.`);
        return;
      }
      validFiles.push(file);
      validPreviews.push(URL.createObjectURL(file));
    }

    setError('');
    setImageFiles((prev) => [...prev, ...validFiles]);
    setImagePreviews((prev) => [...prev, ...validPreviews]);
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const setDurationPreset = (days: number) => {
    const target = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    setClosingAt(formatForInput(target));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim() || title.trim().length < 3) {
      setError('Title must be at least 3 characters long.');
      return;
    }

    if (!description.trim() || description.trim().length < 10) {
      setError('Description must be at least 10 characters long.');
      return;
    }

    if (!startingPrice || Number(startingPrice) <= 0) {
      setError('Starting price must be greater than zero.');
      return;
    }

    if (!minimumBidIncrement || Number(minimumBidIncrement) <= 0) {
      setError('Minimum bid increment must be greater than zero.');
      return;
    }

    const selectedClosing = new Date(closingAt);
    if (isNaN(selectedClosing.getTime()) || selectedClosing <= new Date()) {
      setError('Closing date and time must be in the future.');
      return;
    }

    setSubmitting(true);

    try {
      let uploadedUrls: string[] = [];

      // 1. Upload images to GridFS if any selected
      if (imageFiles.length > 0) {
        setUploading(true);
        const formData = new FormData();
        imageFiles.forEach((f) => formData.append('images', f));

        const uploadRes = await api.post('/images/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (uploadRes.data.success && uploadRes.data.urls) {
          uploadedUrls = uploadRes.data.urls;
        }
        setUploading(false);
      }

      // 2. Publish listing to backend
      const res = await api.post('/auctions', {
        title: title.trim(),
        description: description.trim(),
        category,
        condition,
        startingPrice: Number(startingPrice),
        minimumBidIncrement: Number(minimumBidIncrement),
        closingAt: selectedClosing.toISOString(),
        imageUrls: uploadedUrls,
      });

      if (res.data.success && res.data.auction) {
        navigate(`/auctions/${res.data.auction._id}`);
      } else {
        setError(res.data.message || 'Failed to publish auction.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Server error creating listing.');
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Publish an Auction Item
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          List your pre-loved textbooks, electronics, cycles, or hostel essentials for fair bidding.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8 bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
        {/* Section 1: Basic Info */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
            <span>1. Item Information</span>
          </h2>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Item Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Casio fx-991EX ClassWiz Scientific Calculator"
              maxLength={100}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Condition *
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {CONDITIONS.map((cond) => (
                  <option key={cond} value={cond}>
                    {cond}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Detailed Description *
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the usage duration, condition, what accessories are included, and any minor flaws..."
              maxLength={2000}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
            />
            <div className="text-right text-[11px] text-slate-400">
              {description.length}/2000 characters
            </div>
          </div>
        </div>

        {/* Section 2: Photos */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
            <span>2. Photos (Up to 5 images)</span>
          </h2>
          <p className="text-xs text-slate-500">
            Upload clear photos taken in good lighting. Stored securely in campus MongoDB.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 pt-2">
            {imagePreviews.map((preview, idx) => (
              <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group">
                <img src={preview} alt="Upload preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-1.5 right-1.5 p-1 bg-slate-900/80 text-white rounded-full hover:bg-rose-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {imagePreviews.length < 5 && (
              <label className="aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/30 flex flex-col items-center justify-center cursor-pointer transition-colors p-2 text-center">
                <UploadCloud className="w-6 h-6 text-slate-400" />
                <span className="mt-1 text-[11px] font-semibold text-slate-600">Add Photo</span>
                <span className="text-[9px] text-slate-400">Max 5MB</span>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Section 3: Bidding & Auction Timing */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
            <span>3. Auction Pricing & Deadline</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Starting Price (₹) *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <IndianRupee className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  required
                  min={1}
                  value={startingPrice}
                  onChange={(e) => setStartingPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="250"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-400">The lowest acceptable initial bid amount.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Minimum Bid Increment (₹) *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <IndianRupee className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  required
                  min={1}
                  value={minimumBidIncrement}
                  onChange={(e) =>
                    setMinimumBidIncrement(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  placeholder="20"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Every next bid must increase by at least this amount.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Auction Closing Date & Time *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Clock className="w-4 h-4" />
              </div>
              <input
                type="datetime-local"
                required
                value={closingAt}
                onChange={(e) => setClosingAt(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Quick preset buttons */}
            <div className="mt-2.5 flex items-center gap-2">
              <span className="text-xs text-slate-400">Quick Presets:</span>
              <button
                type="button"
                onClick={() => setDurationPreset(1)}
                className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-600 transition-colors"
              >
                +1 Day
              </button>
              <button
                type="button"
                onClick={() => setDurationPreset(3)}
                className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-600 transition-colors"
              >
                +3 Days
              </button>
              <button
                type="button"
                onClick={() => setDurationPreset(7)}
                className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-600 transition-colors"
              >
                +7 Days (1 Week)
              </button>
            </div>
          </div>
        </div>

        {/* Fairness policy reminder */}
        <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-start gap-3 text-xs text-indigo-900">
          <Info className="w-4 h-4 shrink-0 text-indigo-600 mt-0.5" />
          <p className="leading-relaxed">
            <span className="font-bold">Campus Fairness Rule:</span> Once your listing receives its first valid bid, 
            the starting price, bid increment, and closing time cannot be altered or cancelled.
          </p>
        </div>

        <div className="pt-2 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/auctions')}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100 disabled:opacity-70 transition-all"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>{uploading ? 'Uploading Images...' : 'Publishing Auction...'}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Publish Listing</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
