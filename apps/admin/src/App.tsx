import { Routes, Route, Navigate } from 'react-router-dom';

function App() {
  return (
    <div className="min-h-screen bg-background-dark text-text-primary">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/data-sync" element={<DataSyncPlaceholder />} />
        <Route path="/users" element={<UsersPlaceholder />} />
        <Route path="/games" element={<GamesPlaceholder />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

// Placeholder components
function Dashboard() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold mb-4">Sportime Admin Dashboard</h1>
      <p className="text-lg text-text-secondary">Welcome to the admin panel. This is a monorepo setup.</p>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <DashboardCard title="Data Sync" description="Manage league and match data synchronization" link="/data-sync" />
        <DashboardCard title="Users" description="View and manage user accounts" link="/users" />
        <DashboardCard title="Games" description="Manage fantasy games and challenges" link="/games" />
      </div>
    </div>
  );
}

function DashboardCard({ title, description, link }: { title: string; description: string; link: string }) {
  return (
    <a href={link} className="block p-6 bg-surface rounded-lg border border-border-subtle hover:border-electric-blue transition-colors">
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-text-secondary">{description}</p>
    </a>
  );
}

function DataSyncPlaceholder() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Data Sync</h1>
      <p>Admin features will be migrated here in Phase 3.</p>
    </div>
  );
}

function UsersPlaceholder() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Users</h1>
      <p>User management will be available soon.</p>
    </div>
  );
}

function GamesPlaceholder() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Games</h1>
      <p>Game management will be available soon.</p>
    </div>
  );
}

export default App;
