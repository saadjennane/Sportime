import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { SportProvider } from './contexts/SportContext';
import { initNative } from './native/initNative';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <SportProvider>
        <App />
      </SportProvider>
    </AuthProvider>
  </StrictMode>,
);

// Native (Capacitor) bootstrap — no-op on the web build.
initNative();
