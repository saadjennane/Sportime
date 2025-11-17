import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { LeaguesPage } from './pages/LeaguesPage';
import { TeamsPage } from './pages/TeamsPage';
import { PlayersPage } from './pages/PlayersPage';
import { SwipePage } from './pages/SwipePage';
import { ProgressionPage } from './pages/ProgressionPage';
import { DataSyncPage } from './pages/DataSyncPage';
import { CelebrationsPage } from './pages/CelebrationsPage';
import { ConfigPage } from './pages/ConfigPage';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/leagues" element={<LeaguesPage />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/swipe" element={<SwipePage />} />
        <Route path="/progression" element={<ProgressionPage />} />
        <Route path="/data-sync" element={<DataSyncPage />} />
        <Route path="/celebrations" element={<CelebrationsPage />} />
        <Route path="/config" element={<ConfigPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
