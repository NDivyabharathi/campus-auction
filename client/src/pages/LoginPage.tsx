import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Gavel, Mail, Lock, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/auctions';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.endsWith('@kongu.edu')) {
      setError('Registration and login are restricted to @kongu.edu email addresses.');
      return;
    }

    setSubmitting(true);
    const result = await login(cleanEmail, password);
    setSubmitting(false);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.message || 'Login failed.');
    }
  };

  // Demo accounts helper for hackathon judges
  const fillDemoAccount = (demoEmail: string, pass: string) => {
    setEmail(demoEmail);
    setPassword(pass);
    setError('');
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 sm:p-10 rounded-3xl border border-[#E7E0D8] shadow-xl shadow-stone-200/50">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#C2410C] text-white mb-3 shadow-md shadow-[#C2410C]/20">
            <Gavel className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-extrabold text-[#292524] tracking-tight">
            Welcome back, Kongu Student
          </h2>
          <p className="mt-1.5 text-sm text-[#78716C]">
            Log in with your official <span className="font-bold text-[#C2410C]">@kongu.edu</span> account
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-1.5">
              Kongu Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#78716C]">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rollno.department@kongu.edu"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-[#FFFBF5] border border-[#E7E0D8] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C2410C] focus:border-[#C2410C] transition-all font-mono text-[#292524]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#78716C]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-[#FFFBF5] border border-[#E7E0D8] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C2410C] focus:border-[#C2410C] transition-all text-[#292524]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-[#C2410C] hover:bg-[#9A3412] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#C2410C] shadow-md shadow-[#C2410C]/25 disabled:opacity-70 transition-all cursor-pointer"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <span>Sign In to Marketplace</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Demo shortcuts for hackathon evaluators */}
        <div className="pt-4 border-t border-[#E7E0D8]">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#78716C] mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#C2410C]" />
            <span>Hackathon Quick Login:</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => fillDemoAccount('divya.cse@kongu.edu', 'kongupassword123')}
              className="py-1.5 px-2 bg-[#FFFBF5] hover:bg-[#FFEDD5] hover:text-[#C2410C] border border-[#E7E0D8] text-[#292524] rounded-lg text-left truncate font-mono text-[11px] transition-colors cursor-pointer"
              title="Student 1 (Seller) - Password: kongupassword123"
            >
              divya.cse@kongu.edu
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('rahul.it@kongu.edu', 'kongupassword123')}
              className="py-1.5 px-2 bg-[#FFFBF5] hover:bg-[#FFEDD5] hover:text-[#C2410C] border border-[#E7E0D8] text-[#292524] rounded-lg text-left truncate font-mono text-[11px] transition-colors cursor-pointer"
              title="Student 2 (Bidder) - Password: kongupassword123"
            >
              rahul.it@kongu.edu
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-[#78716C]">
          Don't have an account yet?{' '}
          <Link to="/register" className="font-semibold text-[#C2410C] hover:underline">
            Register with @kongu.edu
          </Link>
        </p>
      </div>
    </div>
  );
};
