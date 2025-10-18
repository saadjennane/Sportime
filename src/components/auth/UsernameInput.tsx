import React, { useState, useEffect, useCallback } from 'react';
import { User, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { USERNAME_REGEX } from '../../utils/validation';
import { useMockStore } from '../../store/useMockStore';

interface UsernameInputProps {
  value: string;
  onChange: (value: string) => void;
  currentUserId?: string;
  setExternalError: (error: string | null) => void;
}

type Availability = 'checking' | 'available' | 'taken' | 'invalid' | null;

export const UsernameInput: React.FC<UsernameInputProps> = ({ value, onChange, currentUserId, setExternalError }) => {
  const [availability, setAvailability] = useState<Availability>(null);
  const { checkUsernameAvailability } = useMockStore();

  const getValidationState = useCallback(async (username: string) => {
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
    const isTaken = await checkUsernameAvailability(username, currentUserId);
    if (isTaken) {
      setAvailability('taken');
      setExternalError('This username is already taken.');
    } else {
      setAvailability('available');
      setExternalError(null);
    }
  }, [checkUsernameAvailability, currentUserId, setExternalError]);

  useEffect(() => {
    const handler = setTimeout(() => {
      getValidationState(value);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [value, getValidationState]);

  const getStatusIcon = () => {
    switch (availability) {
      case 'checking': return <Loader2 className="animate-spin text-gray-400" />;
      case 'available': return <CheckCircle className="text-green-500" />;
      case 'taken':
      case 'invalid': return <XCircle className="text-red-500" />;
      default: return null;
    }
  };
  
  const getMessage = () => {
    switch (availability) {
        case 'invalid': return "3-20 chars, lowercase, numbers, '.', '_'";
        case 'taken': return "This username is already taken.";
        case 'available': return "This username is available.";
        default: return null;
    }
  }

  return (
    <div>
      <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">Username</label>
      <div className="relative">
        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          id="username"
          type="text"
          value={value}
          onChange={e => onChange(e.target.value.toLowerCase().trim())}
          placeholder="Choose a unique username"
          className={`w-full p-3 pl-10 pr-10 bg-gray-100 border-2 rounded-xl ${
            availability === 'invalid' || availability === 'taken' ? 'border-red-400' : 'border-gray-200 focus:border-purple-500'
          }`}
          required
          maxLength={20}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">{getStatusIcon()}</div>
      </div>
      {getMessage() && <p className={`text-xs mt-1 ${availability === 'available' ? 'text-green-600' : 'text-red-500'}`}>{getMessage()}</p>}
    </div>
  );
};
