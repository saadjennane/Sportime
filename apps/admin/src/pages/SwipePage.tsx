import { SwipeGameAdmin } from '../components/admin/SwipeGameAdmin';
import { PageHeader } from '../components/ui/PageHeader';
import { toast } from '../components/ui/Toast';

export function SwipePage() {
  return (
    <div>
      <PageHeader title="Swipe Prediction" subtitle="Manage swipe prediction games and leaderboards." />
      <SwipeGameAdmin addToast={toast} />
    </div>
  );
}
