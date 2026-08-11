/**
 * NexCard Sentinel - Analytics & crash-monitoring engine.
 * Uses the public Supabase `events` table as the app-owned monitoring sink.
 */

import { supabase } from '../services/supabaseClient';

const MAX_MESSAGE_LENGTH = 240;
const MAX_STACK_LENGTH = 1200;
const SENSITIVE_PATTERN = /(apikey|authorization|bearer|token|password|secret|anon[_-]?key|service[_-]?role)/gi;

const safeNavigator = () => (typeof navigator === 'undefined' ? null : navigator);

const detectDevice = () => (/Mobi|Android|iPhone|iPad/i.test(safeNavigator()?.userAgent || '') ? 'mobile' : 'desktop');

const truncate = (value, maxLength) => {
  const text = String(value || '');
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
};

export const sanitizeMonitoringText = (value, maxLength = MAX_MESSAGE_LENGTH) => {
  if (!value) return '';
  return truncate(String(value).replace(SENSITIVE_PATTERN, '[redacted]'), maxLength);
};

export const normalizeError = (error) => {
  if (!error) return { name: 'UnknownError', message: '' };
  if (typeof error === 'string') return { name: 'Error', message: sanitizeMonitoringText(error) };

  return {
    name: sanitizeMonitoringText(error.name || 'Error', 80),
    message: sanitizeMonitoringText(error.message || String(error), MAX_MESSAGE_LENGTH),
    stack: sanitizeMonitoringText(error.stack || '', MAX_STACK_LENGTH),
  };
};

const getLocationMetadata = () => {
  if (typeof window === 'undefined') return {};
  return {
    path: window.location?.pathname || '/',
    href: window.location?.origin ? `${window.location.origin}${window.location.pathname}` : undefined,
  };
};

export const trackEvent = async (eventType, { profileSlug = null, metadata = {} } = {}, client = supabase) => {
  if (!client?.from) {
    return { ok: false, skipped: true, reason: 'supabase_unavailable' };
  }

  try {
    const payload = {
      profile_slug: profileSlug,
      event_type: eventType,
      metadata: {
        device: detectDevice(),
        source: 'nexcard-web',
        ...metadata,
      },
    };

    const query = client.from('events').insert(payload);
    const result = typeof query.select === 'function'
      ? await query.select('id, created_at').maybeSingle()
      : await query;

    if (result?.error) throw result.error;
    return { ok: true, data: result?.data || null };
  } catch (error) {
    console.error('[SENTINEL ANALYTICS] Error enviando evento:', error);
    return { ok: false, error };
  }
};

export const trackClick = async (slug, buttonType, client = supabase) => trackEvent(buttonType, {
  profileSlug: slug,
  metadata: { interaction: 'profile_cta_click' },
}, client);

export const reportCrash = async (error, context = {}, client = supabase) => {
  const normalized = normalizeError(error);
  return trackEvent('client_crash', {
    profileSlug: context.profileSlug || null,
    metadata: {
      monitor: 'app-owned-events',
      error: normalized,
      context: {
        component: sanitizeMonitoringText(context.component || 'global', 120),
        reason: sanitizeMonitoringText(context.reason || '', 120),
      },
      ...getLocationMetadata(),
    },
  }, client);
};

export const installCrashMonitoring = (client = supabase) => {
  if (typeof window === 'undefined') return { installed: false, reason: 'not_browser' };
  if (window.__nexcardCrashMonitoringInstalled) return { installed: false, reason: 'already_installed' };

  window.__nexcardCrashMonitoringInstalled = true;

  window.addEventListener('error', (event) => {
    reportCrash(event.error || event.message, { component: 'window.error' }, client);
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportCrash(event.reason || 'Unhandled rejection', { component: 'window.unhandledrejection' }, client);
  });

  return { installed: true };
};
