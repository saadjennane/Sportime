import { SwipeGameAdmin } from '../components/admin/SwipeGameAdmin';

const mockAddToast = (message: string, type: 'success' | 'error' | 'info') => {
  console.log(`[${type.toUpperCase()}]`, message);
};

export function SwipePage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Swipe Games Admin</h1>
        <p className="text-text-secondary">
          Manage swipe prediction games and leaderboards
        </p>
      </div>

      <SwipeGameAdmin addToast={mockAddToast} />
    </div>
  );
}
