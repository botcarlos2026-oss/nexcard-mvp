import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const reactAppEnv = loadEnv(mode, process.cwd(), 'REACT_APP_');
  return {
    plugins: [react()],
    define: {
      'process.env': JSON.stringify(reactAppEnv),
    },
    server: {
      host: '127.0.0.1',
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setupVitest.js',
      include: ['src/**/*.test.{js,jsx}'],
      environmentOptions: {
        jsdom: {
          url: 'http://localhost/',
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('recharts')) return 'vendor-charts';
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'vendor-react';
            return undefined;
          },
        },
      },
    },
  };
});
