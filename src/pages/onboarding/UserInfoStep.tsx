import React, { useState, useRef, useEffect } from 'react';
import { Profile } from '../../types';
import { Camera, Loader2, User } from 'lucide-react';
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
  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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
    if (!usernameError && username.length >= 3) {
      onContinue(username, displayName, profilePicFile);
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

        <UsernameInput value={username} onChange={setUsername} currentUserId={profile.id} setExternalError={setUsernameError} />

        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">Display Name (Optional)</label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="How your name will appear"
            className="w-full p-3 bg-gray-100 border-2 border-gray-200 rounded-xl"
            maxLength={30}
          />
        </div>
        
        <DisplayNamePreview displayName={displayName} username={username} />

        <button type="submit" disabled={isContinueDisabled} className="w-full py-3.5 bg-purple-600 text-white font-bold rounded-xl shadow-lg shadow-purple-500/30 hover:bg-purple-700 disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed transition-all">
          {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Continue'}
        </button>
      </form>
    </div>
  );
};
