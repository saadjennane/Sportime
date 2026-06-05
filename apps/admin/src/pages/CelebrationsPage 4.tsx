import { CelebrationFeed } from '../components/admin/CelebrationFeed';

export function CelebrationsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Winner Celebrations</h1>
        <p className="text-text-secondary">
          View and manage winner celebrations and seasonal rewards
        </p>
      </div>

      <CelebrationFeed />
    </div>
  );
}
