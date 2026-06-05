import { ProgressionAdmin } from '../components/ProgressionAdmin';

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

const mockAddToast = (message: string, type: 'success' | 'error' | 'info') => {
  console.log(`[${type.toUpperCase()}]`, message);
};

export function ProgressionPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Progression System</h1>
        <p className="text-text-secondary">
          Configure levels, badges, and user progression
        </p>
      </div>

      <ProgressionAdmin
        profile={mockAdminProfile as any}
        addToast={mockAddToast}
      />
    </div>
  );
}
