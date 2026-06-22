import React, { useState, useEffect, useCallback } from 'react';
import { User, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { USERNAME_REGEX } from '../../utils/validation';
import { isUsernameTaken } from '../../services/profileService';

interface UsernameInputProps {
  value: string;
  onChange: (value: string) => void;
  currentUserId?: string;
  setExternalError: (error: string | null) => void;
}

type Availability = 'checking' | 'available' | 'taken' | 'invalid' | null;

export const UsernameInput: React.FC<UsernameInputProps> = ({ value, onChange, currentUserId, setExternalError }) => {
  const [availability, setAvailability] = useState<Availability>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const getValidationState = useCallback(async (username: string) => {
    setRequestError(null);
    if (!username) {
      setAvailability(null);
      setExternalError(null);
      return;
    }
    if (!USERNAME_REGEX.test(username)) {
      setAvailability('invalid');
      setExternalError('Invalid format.');
      return;
    }

    setAvailability('checking');
    try {
      const taken = await isUsernameTaken(username, currentUserId);
      if (taken) {
        setAvailability('taken');
        setExternalError('This username is already taken.');
      } else {
        setAvailability('available');
        setExternalError(null);
      }
    } catch (error) {
      console.error('[UsernameInput] Failed to validate username', error);
      setAvailability(null);
      setRequestError('Unable to validate username right now. Try again in a moment.');
      setExternalError('Unable to validate username.');
    }
  }, [currentUserId, setExternalError]);

  useEffect(() => {
    let isCancelled = false;
    const handler = setTimeout(() => {
      if (!isCancelled) {
        getValidationState(value);
      }
    }, 500);

    return () => {
      clearTimeout(handler);
      isCancelled = true;
    };
  }, [value, getValidationState]);

  const getStatusIcon = () => {
    switch (availability) {
      case 'checking': return <Loader2 className="animate-spin text-text-disabled" />;
      case 'available': return <CheckCircle className="text-lime-glow" />;
      case 'taken':
      case 'invalid': return <XCircle className="text-hot-red" />;
      default: return null;
    }
  };
  
  const getMessage = () => {
    switch (availability) {
        case 'invalid': return "3-20 chars, lowercase, numbers, '.', '_'";
        case 'taken': return "This username is already taken.";
        case 'available': return "This username is available.";
        default: return requestError;
    }
  }

  return (
    <div>
      <label htmlFor="username" className="block text-sm font-medium text-text-secondary mb-1">Username</label>
      <div className="relative">
        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-disabled" />
        <input
          id="username"
          type="text"
          value={value}
          onChange={e => onChange(e.target.value.toLowerCase().trim())}
          placeholder="Choose a unique username"
          className={`w-full p-3 pl-10 pr-10 bg-navy-accent border-2 rounded-xl ${
            availability === 'invalid' || availability === 'taken' ? 'border-hot-red' : 'border-disabled focus:border-electric-blue'
          }`}
          required
          maxLength={20}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">{getStatusIcon()}</div>
      </div>
      {getMessage() && (
        <p className={`text-xs mt-1 ${availability === 'available' ? 'text-lime-glow' : 'text-hot-red'}`}>
          {getMessage()}
        </p>
      )}
    </div>
  );
};
