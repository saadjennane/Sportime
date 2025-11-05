import React, { useState } from 'react';
import type { Profile } from '../types';
import { UserInfoStep } from './onboarding/UserInfoStep';
import { PreferencesStep } from './onboarding/PreferencesStep';
import { AlertCircle } from 'lucide-react';

export interface OnboardingCompletePayload {
  username: string;
  displayName?: string | null;
  favoriteClub?: string | null;
  favoriteNationalTeam?: string | null;
  profilePictureFile?: File | null;
}

interface OnboardingPageProps {
  profile: Profile;
  onComplete: (payload: OnboardingCompletePayload) => Promise<void>;
}

export const OnboardingPage: React.FC<OnboardingPageProps> = ({ profile, onComplete }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<{
    username: string;
    displayName: string;
    profilePic: File | null;
  }>({
    username: '',
    displayName: '',
    profilePic: null,
  });

  const handleUserInfoContinue = (username: string, displayName: string, profilePic: File | null) => {
    setUserInfo({ username, displayName, profilePic });
    setError(null);
    setStep(2);
  };

  const submitOnboarding = async (favoriteClub: string | null, favoriteNationalTeam: string | null) => {
    if (!userInfo.username) {
      setError('Please choose a username before continuing.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onComplete({
        username: userInfo.username,
        displayName: userInfo.displayName || null,
        favoriteClub,
        favoriteNationalTeam,
        profilePictureFile: userInfo.profilePic,
      });
    } catch (err: any) {
      console.error('[OnboardingPage] Failed to complete onboarding', err);
      setError(err?.message || 'Failed to save your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-purple-100 via-blue-50 to-pink-100 flex items-center justify-center p-4">
      {step === 1 && (
        <UserInfoStep profile={profile} onContinue={handleUserInfoContinue} loading={loading} />
      )}
      {step === 2 && (
        <div className="w-full max-w-md space-y-4">
          <PreferencesStep
            onSave={(clubId, nationalTeam) => submitOnboarding(clubId, nationalTeam)}
            onSkip={() => submitOnboarding(null, null)}
            loading={loading}
          />
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
