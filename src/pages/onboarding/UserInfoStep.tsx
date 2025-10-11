import React, { useState, useRef, useEffect } from 'react';
import { Profile } from '../../types';
import { User, Camera, Loader2 } from 'lucide-react';

interface UserInfoStepProps {
  profile: Profile;
  onContinue: (username: string, profilePic: File | null) => void;
  loading: boolean;
  // mockUsers is needed for unique username validation
  mockUsers: Profile[];
}

export const UserInfoStep: React.FC<UserInfoStepProps> = ({ profile, onContinue, loading, mockUsers }) => {
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (username.length > 2) {
      const isTaken = mockUsers.some(u => u.username?.toLowerCase() === username.toLowerCase() && u.id !== profile.id);
      if (isTaken) {
        setUsernameError('This username is already taken.');
      } else {
        setUsernameError(null);
      }
    } else if (username.length > 0) {
        setUsernameError('Username must be at least 3 characters.');
    } else {
        setUsernameError(null);
    }
  }, [username, mockUsers, profile.id]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setProfilePicFile(file);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.length > 2 && !usernameError) {
      onContinue(username, profilePicFile);
    }
  };

  const isContinueDisabled = loading || username.length < 3 || !!usernameError;

  return (
    <div className="w-full max-w-md mx-auto p-8 bg-white rounded-3xl shadow-2xl space-y-6 animate-scale-in">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Welcome!</h1>
        <p className="text-gray-500">Let's set up your profile.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-col items-center">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="relative w-28 h-28 rounded-full group bg-gray-100">
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="w-full h-full rounded-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center rounded-full border-2 border-dashed border-gray-300">
                <User className="w-12 h-12 text-gray-400" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="text-white" size={32} />
            </div>
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <p className="w-full p-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-500">{profile.email}</p>
        </div>

        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <div className="relative">
            <input
              id="username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Choose a unique username"
              className={`w-full p-3 bg-gray-100 border-2 rounded-xl ${usernameError ? 'border-red-400' : 'border-gray-200 focus:border-purple-500'}`}
              required
            />
          </div>
          {usernameError && <p className="text-red-500 text-xs mt-1">{usernameError}</p>}
        </div>

        <button type="submit" disabled={isContinueDisabled} className="w-full py-3.5 bg-purple-600 text-white font-bold rounded-xl shadow-lg shadow-purple-500/30 hover:bg-purple-700 disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed transition-all">
          {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Continue'}
        </button>
      </form>
    </div>
  );
};
