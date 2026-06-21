import { CelebrationFeed } from '../components/admin/CelebrationFeed';
import { PageHeader } from '../components/ui/PageHeader';

export function CelebrationsPage() {
  return (
    <div>
      <PageHeader title="Winner Celebrations" subtitle="View and manage winner celebrations and seasonal rewards." />
      <CelebrationFeed />
    </div>
  );
}
