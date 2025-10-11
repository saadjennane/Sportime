import React, { useState } from 'react';
import { Profile } from '../types';
import { UserInfoStep } from './onboarding/UserInfoStep';
import { PreferencesStep } from './onboarding/PreferencesStep';
import { mockUsers } from '../data/mockUsers';

interface OnboardingPageProps {
  profile: Profile;
  onComplete: (updatedProfile: Profile) => void;
}

export const OnboardingPage: React.FC<OnboardingPageProps> = ({ profile, onComplete }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState<{ username: string, profilePicUrl: string | null }>({ username: '', profilePicUrl: null });

  const handleUserInfoContinue = (username: string, profilePic: File | null) => {
    setLoading(true);
    // In mock mode, we'll just create a blob URL. In real mode, this would upload.
    const profilePicUrl = profilePic ? URL.createObjectURL(profilePic) : null;
    setUserInfo({ username, profilePicUrl });
    setLoading(false);
    setStep(2);
  };

  const handlePreferencesSave = (clubId: string | null, nationalTeam: string | null) => {
    setLoading(true);
    const updatedProfile: Profile = {
      ...profile,
      username: userInfo.username,
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
    const updatedProfile: Profile = {
      ...profile,
      username: userInfo.username,
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
      {step === 1 && <UserInfoStep profile={profile} onContinue={handleUserInfoContinue} loading={loading} mockUsers={mockUsers} />}
      {step === 2 && <PreferencesStep onSave={handlePreferencesSave} onSkip={handleSkipPreferences} loading={loading} />}
    </div>
  );
};
