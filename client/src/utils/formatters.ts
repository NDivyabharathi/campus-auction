export const formatPrice = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatTimeRemaining = (closingAt: string | Date): { text: string; isEnded: boolean; isUrgent: boolean } => {
  const end = new Date(closingAt).getTime();
  const now = new Date().getTime();
  const diff = end - now;

  if (diff <= 0) {
    return { text: 'Auction Ended', isEnded: true, isUrgent: false };
  }

  const seconds = Math.floor((diff / 1000) % 60);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  const isUrgent = diff < 60 * 60 * 1000; // less than 1 hour

  if (days > 0) {
    return { text: `${days}d ${hours}h left`, isEnded: false, isUrgent: false };
  }
  if (hours > 0) {
    return { text: `${hours}h ${minutes}m left`, isEnded: false, isUrgent };
  }
  if (minutes > 0) {
    return { text: `${minutes}m ${seconds}s left`, isEnded: false, isUrgent: true };
  }
  return { text: `${seconds}s left`, isEnded: false, isUrgent: true };
};

export const formatDate = (dateString: string | Date): string => {
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(dateString));
};

export const CATEGORIES = [
  'Books and Study Materials',
  'Electronics',
  'Cycles and Transportation',
  'Hostel Essentials',
  'Clothing and Accessories',
  'Sports Equipment',
  'Laboratory Equipment',
  'Other',
] as const;

export const CONDITIONS = [
  'New',
  'Like New',
  'Good',
  'Fair',
  'Heavily Used',
] as const;
