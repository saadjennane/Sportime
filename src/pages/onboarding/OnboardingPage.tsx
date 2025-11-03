import React, { useState } from 'react';
import { Profile } from '../../types';
import { UserInfoStep } from './UserInfoStep';
import { PreferencesStep } from './PreferencesStep';

interface OnboardingPageProps {
  profile: Profile;
  onComplete: (updatedProfile: Partial<Profile>) => void;
}

export const OnboardingPage: React.FC<OnboardingPageProps> = ({ profile, onComplete }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState<{ username: string; displayName: string; profilePicUrl: string | null }>({ username: '', displayName: '', profilePicUrl: null });

  const handleUserInfoContinue = (username: string, displayName: string, profilePic: File | null) => {
    setLoading(true);
    // In mock mode, we'll just create a blob URL. In real mode, this would upload.
    const profilePicUrl = profilePic ? URL.createObjectURL(profilePic) : null;
    setUserInfo({ username, displayName, profilePicUrl });
    setLoading(false);
    setStep(2);
  };

  const handlePreferencesSave = (clubId: string | null, nationalTeam: string | null) => {
    setLoading(true);
    const updatedProfile: Partial<Profile> = {
      ...profile,
      username: userInfo.username,
      display_name: userInfo.displayName,
      profile_picture_url: userInfo.profilePicUrl,
      favorite_club: clubId || undefined,
      favorite_national_team: nationalTeam || undefined,
      sports_preferences: {
        ...profile.sports_preferences,
        football: {
          club: clubId || undefined,
          national_team: nationalTeam || undefined,
        }
      },
    };
    // Simulate API call
    setTimeout(() => {
      onComplete(updatedProfile);
      setLoading(false);
    }, 500);
  };
  
  const handleSkipPreferences = () => {
    setLoading(true);
    const updatedProfile: Partial<Profile> = {
      ...profile,
      username: userInfo.username,
      display_name: userInfo.displayName,
      profile_picture_url: userInfo.profilePicUrl,
      // preferences are left undefined
    };
     // Simulate API call
    setTimeout(() => {
      onComplete(updatedProfile);
      setLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-purple-100 via-blue-50 to-pink-100 flex items-center justify-center p-4">
      {step === 1 && <UserInfoStep profile={profile} onContinue={handleUserInfoContinue} loading={loading} />}
      {step === 2 && <PreferencesStep onSave={handlePreferencesSave} onSkip={handleSkipPreferences} loading={loading} />}
    </div>
  );
};
