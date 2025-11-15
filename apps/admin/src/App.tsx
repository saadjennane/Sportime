import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { SwipePage } from './pages/SwipePage';
import { ProgressionPage } from './pages/ProgressionPage';
import { DataSyncPage } from './pages/DataSyncPage';
import { CelebrationsPage } from './pages/CelebrationsPage';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/swipe" element={<SwipePage />} />
        <Route path="/progression" element={<ProgressionPage />} />
        <Route path="/data-sync" element={<DataSyncPage />} />
        <Route path="/celebrations" element={<CelebrationsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
