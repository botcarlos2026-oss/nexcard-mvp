import React from 'react';
import { reportCrash } from '../utils/analyticsEngine';
import { captureSentryException } from '../utils/sentry';

export default class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    reportCrash(error, { component: 'ErrorBoundary', reason: 'render_error' }).catch(() => {});
    captureSentryException(error, { component: 'ErrorBoundary' });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        margin: 0, background: '#09090B', color: '#fff', fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
        display: 'grid', minHeight: '100vh', placeItems: 'center', textAlign: 'center', padding: 24,
      }}
      >
        <main>
          <p style={{ color: '#10B981', textTransform: 'uppercase', letterSpacing: '.18em', fontSize: 12 }}>NexCard</p>
          <h1 style={{ margin: '8px 0' }}>Estamos teniendo problemas técnicos</h1>
          <p style={{ color: '#d4d4d8', maxWidth: 420, margin: '0 auto 20px' }}>
            Algo salió mal al cargar esta página. Ya quedó registrado — podés intentar de nuevo.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              background: '#10B981', color: '#09090B', border: 'none', borderRadius: 8,
              padding: '10px 20px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        </main>
      </div>
    );
  }
}
