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
  };
});
