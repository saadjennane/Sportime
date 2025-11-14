import { useState } from 'react';
import { ChallengesAdmin } from '../components/admin/ChallengesAdmin';

// Temporary mock profile for admin
const mockAdminProfile = {
  id: 'admin-1',
  username: 'admin',
  display_name: 'Admin User',
  avatar_url: null,
  coin_balance: 0,
  level: 7,
  xp: 99999,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Temporary toast function
const mockAddToast = (message: string, type: 'success' | 'error' | 'info') => {
  console.log(`[${type.toUpperCase()}]`, message);
  // TODO: Replace with proper toast implementation
};

export function ChallengesPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Challenges Admin</h1>
        <p className="text-text-secondary">
          Create and manage fantasy challenges, configure rewards and entry requirements
        </p>
      </div>

      <ChallengesAdmin
        profile={mockAdminProfile as any}
        addToast={mockAddToast}
      />
    </div>
  );
}
