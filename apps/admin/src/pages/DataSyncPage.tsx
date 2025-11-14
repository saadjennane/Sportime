import { DataSyncAdmin } from '../components/DataSyncAdmin';

const mockAddToast = (message: string, type: 'success' | 'error' | 'info') => {
  console.log(`[${type.toUpperCase()}]`, message);
};

export function DataSyncPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Data Sync</h1>
        <p className="text-text-secondary">
          Synchronize leagues, teams, and matches from API-Football
        </p>
      </div>

      <DataSyncAdmin addToast={mockAddToast} />
    </div>
  );
}
