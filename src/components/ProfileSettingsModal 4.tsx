import React, { useState, useRef, useEffect } from 'react';
import { Profile } from '../types';
import { X, User, Mail, LogOut, Trash2, Loader2, Camera } from 'lucide-react';
import { DeleteAccountModal } from './DeleteAccountModal';
import { SearchableSelect } from './SearchableSelect';
import { mockTeams } from '../data/mockTeams';
import { mockCountries } from '../data/mockCountries';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile;
  onUpdateProfile: (updatedData: { username: string; newProfilePic: File | null; favoriteClub?: string | null; favoriteNationalTeam?: string | null; }) => void;
  onUpdateEmail: (newEmail: string) => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ isOpen, onClose, profile, onUpdateProfile, onUpdateEmail, onSignOut, onDeleteAccount }) => {
  const [username, setUsername] = useState(profile.username || '');
  const [newEmail, setNewEmail] = useState('');
  const [newProfilePicFile, setNewProfilePicFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(profile.profile_picture_url || null);
  const [favoriteClub, setFavoriteClub] = useState<string | null>(profile.favorite_club || null);
  const [favoriteNationalTeam, setFavoriteNationalTeam] = useState<string | null>(profile.favorite_national_team || null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Revoke the object URL to avoid memory leaks
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!isOpen) return null;

  const handleProfileUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading('profile');
    onUpdateProfile({ username, newProfilePic: newProfilePicFile, favoriteClub, favoriteNationalTeam });
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
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        setNewProfilePicFile(file);
        if (previewUrl && previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const clubOptions = mockTeams.map(team => ({ value: team.id, label: team.name, icon: team.logo }));
  const countryOptions = mockCountries.map(country => ({ value: country.name, label: country.name, icon: country.flag }));

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
        <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full h-auto max-h-[90vh] flex flex-col">
          <div className="flex justify-between items-center p-6 border-b">
            <h2 className="text-xl font-bold">Profile Settings</h2>
            <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Edit Profile Section */}
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <h3 className="font-semibold text-gray-700">Edit Profile</h3>
              
              <div className="flex flex-col items-center">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/png, image/jpeg"
                />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="relative w-24 h-24 rounded-full group"
                >
                    <img
                        src={previewUrl || `https://api.dicebear.com/8.x/bottts/svg?seed=${profile.id}`}
                        alt="Profile Preview"
                        className="w-full h-full rounded-full object-cover bg-gray-200"
                    />
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="text-white" size={32} />
                    </div>
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full pl-10 pr-3 py-2 bg-gray-100 border border-gray-200 rounded-lg" />
                </div>
              </div>

              <SearchableSelect label="Favorite Club" options={clubOptions} value={favoriteClub} onChange={setFavoriteClub} placeholder="Choose a club" />
              <SearchableSelect label="Favorite National Team" options={countryOptions} value={favoriteNationalTeam} onChange={setFavoriteNationalTeam} placeholder="Choose a country" />
              
              <button type="submit" className="w-full py-2.5 bg-purple-600 text-white font-semibold rounded-lg shadow-sm hover:bg-purple-700">
                {loading === 'profile' ? <Loader2 className="animate-spin mx-auto" /> : 'Save Changes'}
              </button>
            </form>

            {/* Change Email Section */}
            <form onSubmit={handleEmailChange} className="space-y-4 border-t pt-6">
              <h3 className="font-semibold text-gray-700">Change Email</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Email</label>
                <p className="text-sm text-gray-500 p-2 bg-gray-100 rounded-lg">{profile.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="w-full pl-10 pr-3 py-2 bg-gray-100 border border-gray-200 rounded-lg" placeholder="Enter new email" />
                </div>
              </div>
              <button type="submit" disabled={!newEmail || newEmail === profile.email} className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-lg shadow-sm hover:bg-blue-700 disabled:bg-gray-300">
                {loading === 'email' ? <Loader2 className="animate-spin mx-auto" /> : 'Send Verification Email'}
              </button>
            </form>

            {/* Account Actions Section */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="font-semibold text-gray-700">Account Actions</h3>
              <button onClick={onSignOut} className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300">
                <LogOut size={16} /> Sign Out
              </button>
              <button onClick={() => setIsDeleteModalOpen(true)} className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-100 text-red-700 font-semibold rounded-lg hover:bg-red-200">
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
