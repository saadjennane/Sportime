import React, { useState } from 'react';
import { Mail, Loader2, Gamepad2, ArrowLeft, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';
import { supabase } from '../../services/supabase';

interface SignUpStepProps {
  onMagicLinkSent: (email: string) => Promise<string>;
  onBack: () => void;
}

export const SignUpStep: React.FC<SignUpStepProps> = ({ onMagicLinkSent, onBack }) => {
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
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });

      if (verifyError) {
        throw verifyError;
      }

      if (data.session) {
        // OTP verified successfully, user is now authenticated
        // The AuthContext will handle the session update automatically
        setSuccessMessage('Account verified! Setting up your profile...');
      }
    } catch (err: any) {
      const message = err?.message || err?.error_description || 'Invalid OTP code. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto p-8 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl shadow-2xl border border-purple-500/20 space-y-6 animate-scale-in relative">
            <button onClick={onBack} className="absolute top-4 left-4 p-2 text-gray-400 hover:bg-gray-700/50 rounded-full transition-colors">
                <ArrowLeft size={24} />
            </button>
            <div className="text-center">
                <div className="inline-block bg-gradient-to-br from-purple-600 to-blue-600 p-3 rounded-full mb-3">
                    <Gamepad2 className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">Create your Sportime account</h2>
                <p className="text-sm text-gray-300 mt-1">
                    {otpSent ? 'Enter the OTP code sent to your email' : 'Enter your email to get started'}
                </p>
            </div>

            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="magic-email">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="magic-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-3 py-3 bg-gray-800/50 border border-gray-700 text-white rounded-lg shadow-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                      placeholder="you@example.com"
                      disabled={loading}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-60 transition-all"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : 'Send OTP Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="otp-code">
                    OTP Code
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="otp-code"
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="w-full pl-10 pr-3 py-3 bg-gray-800/50 border border-gray-700 text-white rounded-lg shadow-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent tracking-widest text-center text-lg font-mono"
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
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-60 transition-all"
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
                  className="w-full py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                >
                  Use a different email
                </button>
              </form>
            )}

            {successMessage && (
              <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <CheckCircle2 className="w-5 h-5" />
                <span>{successMessage}</span>
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            )}
        </div>
    </div>
  );
};
