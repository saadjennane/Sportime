import React, { useState } from 'react';
import { Mail, Loader2, Gamepad2, ArrowLeft, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';
import { supabase } from '../../services/supabase';

interface SignUpStepProps {
  onMagicLinkSent: (email: string) => Promise<string>;
  /** Verifies the OTP with the correct type (handles guest in-place upgrade). */
  onVerifyOtp: (email: string, token: string) => Promise<void>;
  onBack: () => void;
}

export const SignUpStep: React.FC<SignUpStepProps> = ({ onMagicLinkSent, onVerifyOtp, onBack }) => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const message = await onMagicLinkSent(email);
      setSuccessMessage(message || 'Check your inbox for the OTP code to continue your registration.');
      setOtpSent(true);
    } catch (err: any) {
      const message = err?.message || err?.error_description || 'Unable to send OTP. Please retry.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !otp) return;
    setLoading(true);
    setError(null);
    try {
      // Verifies with the correct OTP type (email_change for a guest upgrade → keeps data).
      await onVerifyOtp(email, otp);
      setSuccessMessage('Verified! Setting up your profile...');
    } catch (err: any) {
      const message = err?.message || err?.error_description || 'Invalid OTP code. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen-safe w-full bg-deep-navy flex items-center justify-center">
        <div className="w-full max-w-md mx-auto p-8 bg-navy-accent rounded-2xl shadow-2xl border border-white/10 space-y-6 animate-scale-in relative">
            <button onClick={onBack} className="absolute top-4 left-4 p-2 text-text-secondary hover:bg-white/10 rounded-full transition-colors">
                <ArrowLeft size={24} />
            </button>
            <div className="text-center">
                <div className="inline-block bg-electric-blue/15 p-3 rounded-full mb-3">
                    <Gamepad2 className="w-8 h-8 text-electric-blue" />
                </div>
                <h2 className="text-2xl font-bold text-text-primary">Sign in to Sportime</h2>
                <p className="text-sm text-text-secondary mt-1">
                    {otpSent ? 'Enter the code sent to your email' : 'Enter your email — we will send you a code'}
                </p>
            </div>

            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2" htmlFor="magic-email">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-disabled" />
                    <input
                      id="magic-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-3 py-3 bg-deep-navy border border-disabled text-text-primary rounded-lg placeholder-text-disabled focus:outline-none focus:border-electric-blue"
                      required
                      placeholder="you@example.com"
                      disabled={loading}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center py-3 px-4 rounded-xl font-bold text-white bg-electric-blue hover:brightness-110 focus:outline-none disabled:opacity-50 transition"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : 'Send Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2" htmlFor="otp-code">
                    OTP Code
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-disabled" />
                    <input
                      id="otp-code"
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="w-full pl-10 pr-3 py-3 bg-deep-navy border border-disabled text-text-primary rounded-lg placeholder-text-disabled focus:outline-none focus:border-electric-blue tracking-widest text-center text-lg font-mono"
                      required
                      placeholder="000000"
                      maxLength={6}
                      disabled={loading}
                      autoComplete="one-time-code"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full flex justify-center items-center py-3 px-4 rounded-xl font-bold text-white bg-electric-blue hover:brightness-110 focus:outline-none disabled:opacity-50 transition"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : 'Verify & Continue'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setOtp('');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="w-full py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                >
                  Use a different email
                </button>
              </form>
            )}

            {successMessage && (
              <div className="flex items-center gap-2 text-sm text-lime-glow bg-lime-glow/10 border border-lime-glow/20 rounded-lg p-3">
                <CheckCircle2 className="w-5 h-5" />
                <span>{successMessage}</span>
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 text-sm text-hot-red bg-hot-red/10 border border-hot-red/20 rounded-lg p-3">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            )}
        </div>
    </div>
  );
};
