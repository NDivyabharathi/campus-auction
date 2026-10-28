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
  Calendar,
} from 'lucide-react';
import { api } from '../services/api.js';
import { CATEGORIES, CONDITIONS, formatISTDateTime } from '../utils/formatters.js';

export const CreateListingPage: React.FC = () => {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [condition, setCondition] = useState<string>(CONDITIONS[2]); // default Good
  const [description, setDescription] = useState('');
  const [startingPrice, setStartingPrice] = useState<number | ''>(100);
  const [minimumBidIncrement, setMinimumBidIncrement] = useState<number | ''>(20);

  // Duration option: '1d' | '3d' | '7d' | 'custom'
  const [durationType, setDurationType] = useState<'1d' | '3d' | '7d' | 'custom'>('3d');

  // Format Date for HTML date input: YYYY-MM-DD
  const formatDateForInput = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  // Format Date for HTML time input: HH:MM
  const formatTimeForInput = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const defaultOpen = new Date(Date.now() + 15 * 60 * 1000); // 15 mins in future for custom schedule default
  const defaultClose = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const [openingDate, setOpeningDate] = useState(() => formatDateForInput(defaultOpen));
  const [openingTime, setOpeningTime] = useState(() => formatTimeForInput(defaultOpen));
  const [closingDate, setClosingDate] = useState(() => formatDateForInput(defaultClose));
  const [closingTime, setClosingTime] = useState(() => formatTimeForInput(defaultClose));

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

    let computedStartTime: Date;
    let computedClosingAt: Date;

    if (durationType === '1d') {
      computedStartTime = new Date();
      computedClosingAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    } else if (durationType === '3d') {
      computedStartTime = new Date();
      computedClosingAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    } else if (durationType === '7d') {
      computedStartTime = new Date();
      computedClosingAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    } else {
      // Custom schedule
      if (!openingDate || !openingTime) {
        setError('Please specify both the auction opening date and opening time.');
        return;
      }
      if (!closingDate || !closingTime) {
        setError('Please specify both the auction closing date and closing time.');
        return;
      }
      computedStartTime = new Date(`${openingDate}T${openingTime}`);
      computedClosingAt = new Date(`${closingDate}T${closingTime}`);

      if (isNaN(computedStartTime.getTime())) {
        setError('Invalid auction opening date or time.');
        return;
      }
      if (isNaN(computedClosingAt.getTime())) {
        setError('Invalid auction closing date or time.');
        return;
      }
      if (computedStartTime.getTime() < Date.now() - 60_000) {
        setError('Auction opening date and time cannot be set in the past.');
        return;
      }
      if (computedClosingAt.getTime() <= computedStartTime.getTime()) {
        setError('Auction closing time must be later than opening time.');
        return;
      }
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
        startTime: computedStartTime.toISOString(),
        closingAt: computedClosingAt.toISOString(),
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
        <h1 className="text-3xl font-extrabold text-[#292524] tracking-tight">
          Publish an Auction Item
        </h1>
        <p className="mt-1 text-sm text-[#78716C]">
          List your pre-loved textbooks, electronics, cycles, or hostel essentials for fair campus bidding.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8 bg-white p-6 sm:p-8 rounded-3xl border border-[#E7E0D8] shadow-sm">
        {/* Section 1: Basic Info */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-[#292524] flex items-center gap-2 border-b border-[#E7E0D8] pb-2">
            <span>1. Item Information</span>
          </h2>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-1.5">
              Item Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Casio fx-991EX ClassWiz Scientific Calculator"
              maxLength={100}
              className="w-full px-3.5 py-2.5 text-sm bg-[#FFFBF5] border border-[#E7E0D8] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C2410C] text-[#292524]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-1.5">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-[#FFFBF5] border border-[#E7E0D8] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C2410C] text-[#292524]"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-1.5">
                Condition *
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-[#FFFBF5] border border-[#E7E0D8] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C2410C] text-[#292524]"
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-1.5">
              Detailed Description *
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the usage duration, condition, what accessories are included, and any minor flaws..."
              maxLength={2000}
              className="w-full px-3.5 py-2.5 text-sm bg-[#FFFBF5] border border-[#E7E0D8] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C2410C] text-[#292524] leading-relaxed"
            />
            <div className="text-right text-[11px] text-[#78716C]">
              {description.length}/2000 characters
            </div>
          </div>
        </div>

        {/* Section 2: Photos */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-[#292524] flex items-center gap-2 border-b border-[#E7E0D8] pb-2">
            <span>2. Photos (Up to 5 images)</span>
          </h2>
          <p className="text-xs text-[#78716C]">
            Upload clear photos taken in good lighting. Stored securely in campus MongoDB GridFS.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 pt-2">
            {imagePreviews.map((preview, idx) => (
              <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-[#E7E0D8] group">
                <img src={preview} alt="Upload preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-1.5 right-1.5 p-1 bg-[#1C1917]/80 text-white rounded-full hover:bg-rose-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {imagePreviews.length < 5 && (
              <label className="aspect-square rounded-xl border-2 border-dashed border-[#E7E0D8] hover:border-[#C2410C] hover:bg-[#FFEDD5]/30 flex flex-col items-center justify-center cursor-pointer transition-colors p-2 text-center">
                <UploadCloud className="w-6 h-6 text-[#78716C]" />
                <span className="mt-1 text-[11px] font-semibold text-[#292524]">Add Photo</span>
                <span className="text-[9px] text-[#78716C]">Max 5MB</span>
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
          <h2 className="text-base font-bold text-[#292524] flex items-center gap-2 border-b border-[#E7E0D8] pb-2">
            <span>3. Auction Pricing & Deadline</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-1.5">
                Starting Price (₹) *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#78716C]">
                  <IndianRupee className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  required
                  min={1}
                  value={startingPrice}
                  onChange={(e) => setStartingPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="250"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-[#FFFBF5] border border-[#E7E0D8] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C2410C] font-semibold text-[#292524]"
                />
              </div>
              <p className="mt-1 text-[11px] text-[#78716C]">The lowest acceptable initial bid amount.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-1.5">
                Minimum Bid Increment (₹) *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#78716C]">
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
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-[#FFFBF5] border border-[#E7E0D8] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C2410C] font-semibold text-[#292524]"
                />
              </div>
              <p className="mt-1 text-[11px] text-[#78716C]">Every next bid must increase by at least this amount.</p>
            </div>
          </div>

          {/* Auction Duration & Scheduling Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-2">
              Auction Schedule & Duration *
            </label>

            {/* 4 Duration Options */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
              <button
                type="button"
                onClick={() => setDurationType('1d')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                  durationType === '1d'
                    ? 'bg-[#C2410C] text-white border-[#C2410C] shadow-sm'
                    : 'bg-[#FFFBF5] text-[#292524] border-[#E7E0D8] hover:border-[#FED7AA] hover:bg-[#FFEDD5]/40'
                }`}
              >
                1 Day (24 hrs)
              </button>

              <button
                type="button"
                onClick={() => setDurationType('3d')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                  durationType === '3d'
                    ? 'bg-[#C2410C] text-white border-[#C2410C] shadow-sm'
                    : 'bg-[#FFFBF5] text-[#292524] border-[#E7E0D8] hover:border-[#FED7AA] hover:bg-[#FFEDD5]/40'
                }`}
              >
                3 Days (Default)
              </button>

              <button
                type="button"
                onClick={() => setDurationType('7d')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                  durationType === '7d'
                    ? 'bg-[#C2410C] text-white border-[#C2410C] shadow-sm'
                    : 'bg-[#FFFBF5] text-[#292524] border-[#E7E0D8] hover:border-[#FED7AA] hover:bg-[#FFEDD5]/40'
                }`}
              >
                1 Week (7 Days)
              </button>

              <button
                type="button"
                onClick={() => setDurationType('custom')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                  durationType === 'custom'
                    ? 'bg-[#C2410C] text-white border-[#C2410C] shadow-sm'
                    : 'bg-[#FFFBF5] text-[#292524] border-[#E7E0D8] hover:border-[#FED7AA] hover:bg-[#FFEDD5]/40'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Custom Schedule</span>
              </button>
            </div>

            {/* Fixed Presets Summary */}
            {durationType !== 'custom' ? (
              <div className="p-4 rounded-2xl bg-[#FFFBF5] border border-[#E7E0D8] text-xs space-y-1.5">
                <div className="flex items-center gap-2 text-[#292524] font-bold">
                  <Clock className="w-4 h-4 text-[#C2410C]" />
                  <span>
                    Opens Immediately • Closes in{' '}
                    {durationType === '1d' ? '24 Hours' : durationType === '3d' ? '3 Days' : '7 Days'}
                  </span>
                </div>
                <p className="text-[#78716C]">
                  Projected Closing Time:{' '}
                  <strong className="text-[#292524]">
                    {formatISTDateTime(
                      new Date(
                        Date.now() +
                          (durationType === '1d' ? 1 : durationType === '3d' ? 3 : 7) *
                            24 *
                            60 *
                            60 *
                            1000
                      )
                    )}
                  </strong>
                </p>
              </div>
            ) : (
              /* Custom Schedule Detailed Date/Time Inputs */
              <div className="space-y-4 p-5 rounded-2xl bg-[#FFFBF5] border border-[#FED7AA] shadow-2xs">
                <div className="flex items-center gap-2 text-xs font-bold text-[#C2410C]">
                  <Calendar className="w-4 h-4" />
                  <span>Custom Schedule Settings (Asia/Kolkata - IST)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Opening Date & Time */}
                  <div className="space-y-3 bg-white p-3.5 rounded-xl border border-[#E7E0D8]">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#292524] block">
                      Auction Opening (IST)
                    </span>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#78716C] mb-1">
                        Opening Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={openingDate}
                        min={formatDateForInput(new Date())}
                        onChange={(e) => setOpeningDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-[#FFFBF5] border border-[#E7E0D8] rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C2410C] text-[#292524] font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#78716C] mb-1">
                        Opening Time *
                      </label>
                      <input
                        type="time"
                        required
                        value={openingTime}
                        onChange={(e) => setOpeningTime(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-[#FFFBF5] border border-[#E7E0D8] rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C2410C] text-[#292524] font-medium"
                      />
                    </div>
                  </div>

                  {/* Closing Date & Time */}
                  <div className="space-y-3 bg-white p-3.5 rounded-xl border border-[#E7E0D8]">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#292524] block">
                      Auction Closing (IST)
                    </span>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#78716C] mb-1">
                        Closing Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={closingDate}
                        min={openingDate || formatDateForInput(new Date())}
                        onChange={(e) => setClosingDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-[#FFFBF5] border border-[#E7E0D8] rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C2410C] text-[#292524] font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#78716C] mb-1">
                        Closing Time *
                      </label>
                      <input
                        type="time"
                        required
                        value={closingTime}
                        onChange={(e) => setClosingTime(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-[#FFFBF5] border border-[#E7E0D8] rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C2410C] text-[#292524] font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Schedule Summary Preview */}
                <div className="pt-2 text-[11px] text-[#78716C] flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-t border-[#FED7AA]/60">
                  <span>
                    Status:{' '}
                    <strong className="text-[#C2410C]">
                      {new Date(`${openingDate}T${openingTime}`).getTime() > Date.now()
                        ? 'Scheduled (Opens in future)'
                        : 'Opens immediately'}
                    </strong>
                  </span>
                  <span>
                    Closing: <strong className="text-[#292524]">{closingDate} at {closingTime} IST</strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fairness policy reminder */}
        <div className="p-4 bg-[#FFEDD5]/60 border border-[#FED7AA] rounded-2xl flex items-start gap-3 text-xs text-[#9A3412]">
          <Info className="w-4 h-4 shrink-0 text-[#C2410C] mt-0.5" />
          <p className="leading-relaxed">
            <span className="font-bold">Campus Fairness Rule:</span> Once your listing receives its first valid bid, 
            the starting price, bid increment, and closing time cannot be altered or cancelled.
          </p>
        </div>

        <div className="pt-2 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/auctions')}
            className="px-5 py-2.5 text-sm font-semibold text-[#78716C] hover:text-[#292524] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-[#C2410C] hover:bg-[#9A3412] shadow-md shadow-[#C2410C]/20 disabled:opacity-70 transition-all cursor-pointer"
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
