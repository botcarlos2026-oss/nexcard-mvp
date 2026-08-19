import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { installCrashMonitoring } from './utils/analyticsEngine';
import { installGa4 } from './utils/ga4';
import { installSentry } from './utils/sentry';

installSentry();
installCrashMonitoring();
installGa4();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
