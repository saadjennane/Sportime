import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthGate } from './components/AuthGate';
import { TournamentPage } from './pages/TournamentPage';
import { Dashboard } from './pages/Dashboard';
import { LeaguesPage } from './pages/LeaguesPage';
import { TeamsPage } from './pages/TeamsPage';
import { PlayersPage } from './pages/PlayersPage';
import { FixturesPage } from './pages/FixturesPage';
import { SwipePage } from './pages/SwipePage';
import { FantasyPage } from './pages/FantasyPage';
import { ProgressionPage } from './pages/ProgressionPage';
import { SpinwheelPage } from './pages/SpinwheelPage';
import { MatchRoyalePage } from './pages/MatchRoyalePage';
import { DataSyncPage } from './pages/DataSyncPage';
import { CelebrationsPage } from './pages/CelebrationsPage';
import { ConfigPage } from './pages/ConfigPage';
import { BookmakerPage } from './pages/BookmakerPage';
import { LiveGameConfigPage } from './pages/LiveGameConfigPage';
import { LiveGamesPage } from './pages/LiveGamesPage';

function App() {
  return (
    <AuthGate>
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tournament" element={<TournamentPage />} />
        <Route path="/leagues" element={<LeaguesPage />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/fixtures" element={<FixturesPage />} />
        <Route path="/swipe" element={<SwipePage />} />
        <Route path="/fantasy" element={<FantasyPage />} />
        <Route path="/progression" element={<ProgressionPage />} />
        <Route path="/spinwheel" element={<SpinwheelPage />} />
        <Route path="/match-royale" element={<MatchRoyalePage />} />
        <Route path="/data-sync" element={<DataSyncPage />} />
        <Route path="/bookmaker" element={<BookmakerPage />} />
        <Route path="/celebrations" element={<CelebrationsPage />} />
        <Route path="/config" element={<ConfigPage />} />
        <Route path="/live-game" element={<LiveGameConfigPage />} />
        <Route path="/live-games" element={<LiveGamesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
    </AuthGate>
  );
}

export default App;
