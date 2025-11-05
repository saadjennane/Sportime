import React, { useState } from 'react';
import { Profile } from '../../types';
import { Loader2, User } from 'lucide-react';
import { UsernameInput } from '../../components/auth/UsernameInput';
import { DisplayNamePreview } from '../../components/auth/DisplayNamePreview';

interface UserInfoStepProps {
  profile: Profile;
  onContinue: (username: string, displayName: string, profilePic: File | null) => void;
  loading: boolean;
}

export const UserInfoStep: React.FC<UserInfoStepProps> = ({ profile, onContinue, loading }) => {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameError && username.length >= 3) {
      onContinue(username, displayName, null);
    }
  };

  const isContinueDisabled = loading || username.length < 3 || !!usernameError;

  return (
    <div className="w-full max-w-md mx-auto p-8 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl shadow-2xl border border-purple-500/20 space-y-6 animate-scale-in">
      <div className="text-center">
        <div className="inline-block bg-gradient-to-br from-purple-600 to-blue-600 p-4 rounded-full mb-4">
          <User className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white">Welcome!</h1>
        <p className="text-gray-300 mt-2">Let's set up your profile.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <UsernameInput value={username} onChange={setUsername} currentUserId={profile.id} setExternalError={setUsernameError} />

        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-gray-300 mb-2">Display Name (Optional)</label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="How your name will appear"
            className="w-full p-3 bg-gray-800/50 border border-gray-700 text-white rounded-xl placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            maxLength={30}
          />
        </div>

        <DisplayNamePreview displayName={displayName} username={username} />

        <button type="submit" disabled={isContinueDisabled} className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-purple-500/30 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
          {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Continue'}
        </button>
      </form>
    </div>
  );
};
