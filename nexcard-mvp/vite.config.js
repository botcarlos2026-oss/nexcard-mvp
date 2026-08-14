import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const CLIENT_ENV_WHITELIST = [
  'REACT_APP_API_URL',
  'REACT_APP_PUBLIC_APP_URL',
  'REACT_APP_SUPABASE_URL',
  'REACT_APP_SUPABASE_ANON_KEY',
  'REACT_APP_DISABLE_SUPABASE',
];

export default defineConfig(({ mode }) => {
  const reactAppEnv = loadEnv(mode, process.cwd(), 'REACT_APP_');
  const defineEnv = Object.fromEntries(
    CLIENT_ENV_WHITELIST.map((key) => [
      `process.env.${key}`,
      JSON.stringify(reactAppEnv[key] || ''),
    ])
  );

  return {
    plugins: [react()],
    define: defineEnv,
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
