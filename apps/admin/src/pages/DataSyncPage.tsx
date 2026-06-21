import { DataSyncAdmin } from '../components/DataSyncAdmin';
import { PageHeader } from '../components/ui/PageHeader';
import { toast } from '../components/ui/Toast';

export function DataSyncPage() {
  return (
    <div>
      <PageHeader
        title="Data Sync"
        subtitle="Manual re-syncs, fixture-schedule refresh and fantasy seeding. Full league imports live on the Leagues page."
      />
      <DataSyncAdmin addToast={toast} />
    </div>
  );
}
