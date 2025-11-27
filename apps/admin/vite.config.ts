import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const buildDate = new Date().toISOString().slice(0, 16).replace('T', ' ');

export default defineConfig({
  plugins: [react()],
  base: '/admin/',
  define: {
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  server: {
    port: 5174,
    open: true,
  },
  build: {
    outDir: 'dist',
  },
});
