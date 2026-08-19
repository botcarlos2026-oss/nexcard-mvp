/**
 * Sentry — captura de errores frontend con stack traces, navegador y
 * agrupación automática. Complementa (no reemplaza) el monitor propio en
 * src/utils/analyticsEngine.js, que sigue escribiendo a la tabla `events`
 * para consumo interno en /admin.
 */
import * as Sentry from '@sentry/react';
import { sanitizeMonitoringText } from './analyticsEngine';

const SENTRY_DSN = process.env.REACT_APP_SENTRY_DSN || '';

const scrubUrl = (url) => {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return sanitizeMonitoringText(url, 300);
  }
};

const scrubException = (exception) => {
  if (!exception?.values) return exception;
  exception.values.forEach((value) => {
    if (value.value) value.value = sanitizeMonitoringText(value.value, 500);
  });
  return exception;
};

let installed = false;

export const installSentry = () => {
  if (typeof window === 'undefined' || !SENTRY_DSN || installed) return;
  installed = true;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE || 'production',
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: (event) => {
      if (event.request?.url) event.request.url = scrubUrl(event.request.url);
      if (event.exception) event.exception = scrubException(event.exception);
      return event;
    },
    beforeBreadcrumb: (breadcrumb) => {
      if (breadcrumb.data?.url) breadcrumb.data.url = scrubUrl(breadcrumb.data.url);
      return breadcrumb;
    },
  });
};

export const captureSentryException = (error, context = {}) => {
  if (!SENTRY_DSN) return;
  Sentry.captureException(error, { tags: context });
};
