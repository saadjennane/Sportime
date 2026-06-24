import React, { useState, useRef, useEffect } from 'react';
import { Profile } from '../../types';
import { X, Mail, LogOut, Trash2, Loader2, Camera, Globe, Flag } from 'lucide-react';
import { DeleteAccountModal } from '../DeleteAccountModal';
import { UsernameInput } from '../auth/UsernameInput';
import { DisplayNamePreview } from '../auth/DisplayNamePreview';
import { canUseNativeCamera, pickProfileImageNative } from '../../native/pickImage';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile;
  onUpdateProfile: (updatedData: { username: string; displayName: string; newProfilePic: File | null; sports?: string[]; }) => void;
  onUpdateEmail: (newEmail: string) => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ isOpen, onClose, profile, onUpdateProfile, onUpdateEmail, onSignOut, onDeleteAccount }) => {
  const [username, setUsername] = useState(profile.username || '');
  const [displayName, setDisplayName] = useState(profile.display_name || '');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newProfilePicFile, setNewProfilePicFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(profile.profile_picture_url || null);
  const [sports, setSports] = useState<string[]>(profile.sports ?? ['football', 'f1']);

  const toggleSport = (sport: string) =>
    setSports(prev => (prev.includes(sport) ? prev.filter(s => s !== sport) : [...prev, sport]));

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!isOpen) return null;

  const handleProfileUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameError) return;
    setLoading('profile');
    onUpdateProfile({ username, displayName, newProfilePic: newProfilePicFile, sports });
    setLoading(null);
    onClose();
  };

  const handleEmailChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newEmail && newEmail !== profile.email) {
      setLoading('email');
      onUpdateEmail(newEmail);
      setLoading(null);
    }
  };
  
  const applyPickedFile = (file: File) => {
    setNewProfilePicFile(file);
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      applyPickedFile(file);
    }
  };

  // On device, open the native camera/gallery picker; on web, fall back to the
  // hidden <input type="file">.
  const handlePickPhoto = async () => {
    if (!canUseNativeCamera()) {
      fileInputRef.current?.click();
      return;
    }
    try {
      const file = await pickProfileImageNative();
      if (file) applyPickedFile(file);
    } catch (err) {
      console.warn('[camera] photo pick failed', err);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-scale-in">
        <div className="bg-deep-navy border border-white/10 rounded-2xl shadow-2xl max-w-sm w-full h-auto max-h-[90vh] flex flex-col">
          <div className="flex justify-between items-center p-5 border-b border-white/10">
            <h2 className="text-xl font-bold text-text-primary">Profile Settings</h2>
            <button onClick={onClose} className="p-2 text-text-secondary hover:text-text-primary rounded-full">
              <X size={22} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-7">
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <h3 className="font-semibold text-text-secondary text-sm uppercase tracking-wide">Edit Profile</h3>

              <div className="flex flex-col items-center">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg" />
                <button type="button" onClick={handlePickPhoto} className="relative w-24 h-24 rounded-full group">
                    <img src={previewUrl || `https://api.dicebear.com/8.x/bottts/svg?seed=${profile.id}`} alt="Profile Preview" className="w-full h-full rounded-full object-cover bg-navy-accent" />
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="text-white" size={32} />
                    </div>
                </button>
              </div>

              <UsernameInput value={username} onChange={setUsername} currentUserId={profile.id} setExternalError={setUsernameError} />

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Display Name</label>
                <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full p-3 bg-navy-accent border border-disabled rounded-xl text-text-primary focus:outline-none focus:border-electric-blue" maxLength={30} />
              </div>

              <DisplayNamePreview displayName={displayName} username={username} />

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Sports you follow</label>
                <p className="text-xs text-text-disabled mb-2">Your Stats will only show the sports you add here.</p>
                <div className="grid grid-cols-2 gap-3">
                  <SportToggle label="Football" icon={<Globe size={18} />} active={sports.includes('football')} onClick={() => toggleSport('football')} />
                  <SportToggle label="Formula 1" icon={<Flag size={18} />} active={sports.includes('f1')} onClick={() => toggleSport('f1')} />
                </div>
              </div>

              <button type="submit" disabled={!!usernameError} className="w-full py-3 bg-electric-blue text-white font-bold rounded-xl hover:brightness-110 disabled:opacity-50">
                {loading === 'profile' ? <Loader2 className="animate-spin mx-auto" /> : 'Save Changes'}
              </button>
            </form>

            <form onSubmit={handleEmailChange} className="space-y-4 border-t border-white/10 pt-6">
              <h3 className="font-semibold text-text-secondary text-sm uppercase tracking-wide">Change Email</h3>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Current Email</label>
                <p className="text-sm text-text-secondary p-2.5 bg-navy-accent rounded-lg">{profile.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">New Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-disabled" />
                  <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="w-full pl-10 pr-3 py-3 bg-navy-accent border border-disabled rounded-lg text-text-primary focus:outline-none focus:border-electric-blue" placeholder="Enter new email" />
                </div>
              </div>
              <button type="submit" disabled={!newEmail || newEmail === profile.email} className="w-full py-3 bg-electric-blue text-white font-bold rounded-xl hover:brightness-110 disabled:opacity-50">
                {loading === 'email' ? <Loader2 className="animate-spin mx-auto" /> : 'Send Verification Email'}
              </button>
            </form>

            <div className="space-y-3 border-t border-white/10 pt-6">
              <h3 className="font-semibold text-text-secondary text-sm uppercase tracking-wide">Account Actions</h3>
              <button onClick={onSignOut} className="w-full flex items-center justify-center gap-2 py-3 bg-navy-accent text-text-primary font-semibold rounded-xl hover:bg-white/10">
                <LogOut size={16} /> Sign Out
              </button>
              <button onClick={() => setIsDeleteModalOpen(true)} className="w-full flex items-center justify-center gap-2 py-3 bg-hot-red/15 text-hot-red font-semibold rounded-xl hover:bg-hot-red/25">
                <Trash2 size={16} /> Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={onDeleteAccount}
      />
    </>
  );
};

const SportToggle: React.FC<{ label: string; icon: React.ReactNode; active: boolean; onClick: () => void }> = ({ label, icon, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-semibold transition ${
      active
        ? 'bg-electric-blue/15 border-electric-blue text-electric-blue'
        : 'bg-navy-accent border-disabled text-text-secondary hover:border-white/30'
    }`}
  >
    {icon} {label}
  </button>
);
