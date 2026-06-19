import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      // RevenueCat is an optional native plugin loaded via a guarded dynamic import
      // (premiumPurchaseService). It isn't installed yet, so keep it external — the
      // runtime import fails gracefully (.catch → preview packages) until it's added.
      external: ['@revenuecat/purchases-capacitor'],
      output: {
        // Split large vendor libs into their own chunks so the initial
        // bundle stays small and chunks can be cached/loaded in parallel.
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) {
            return 'react-vendor';
          }
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('framer-motion')) return 'animations';
          if (id.includes('@dnd-kit')) return 'dnd';
          if (id.includes('date-fns')) return 'date';
          if (id.includes('lucide-react')) return 'icons';
          return 'vendor';
        },
      },
    },
  },
});
