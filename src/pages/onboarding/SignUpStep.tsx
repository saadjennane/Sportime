import React, { useState } from 'react';
import { Mail, Loader2, Gamepad2, ArrowLeft } from 'lucide-react';

interface SignUpStepProps {
  onMagicLinkSent: (email: string) => void;
  onBack: () => void;
}

export const SignUpStep: React.FC<SignUpStepProps> = ({ onMagicLinkSent, onBack }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    onMagicLinkSent(email);
    // The parent component will handle navigation or showing a message,
    // so this component will likely unmount. No need to setLoading(false).
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-purple-100 via-blue-50 to-pink-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto p-8 bg-white rounded-3xl shadow-2xl space-y-6 animate-scale-in relative">
            <button onClick={onBack} className="absolute top-4 left-4 p-2 text-gray-500 hover:bg-gray-100 rounded-full">
                <ArrowLeft size={24} />
            </button>
            <div className="text-center">
                <div className="inline-block bg-purple-100 p-3 rounded-full mb-3">
                    <Gamepad2 className="w-8 h-8 text-purple-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Create your Sportime account ⚡</h2>
                <p className="text-sm text-gray-500 mt-1">
                    Enter your email to get started.
                </p>
            </div>

            <form onSubmit={handleMagicLink} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="magic-email">
                Email Address
                </label>
                <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    id="magic-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                    required
                    placeholder="you@example.com"
                />
                </div>
            </div>
            <div>
                <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-60"
                >
                {loading ? <Loader2 className="animate-spin" /> : 'Send Magic Link'}
                </button>
            </div>
            </form>
        </div>
    </div>
  );
};
