import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  installCrashMonitoring,
  normalizeError,
  reportCrash,
  sanitizeMonitoringText,
  trackClick,
  trackEvent,
} from './analyticsEngine';

const createClientStub = () => {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'evt-test', created_at: '2026-08-11T00:00:00Z' }, error: null });
  const select = vi.fn(() => ({ maybeSingle }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ insert }));
  return { client: { from }, from, insert, select, maybeSingle };
};

describe('analyticsEngine', () => {
  beforeEach(() => {
    delete window.__nexcardCrashMonitoringInstalled;
  });

  it('sanitiza textos sensibles antes de reportar errores', () => {
    const sanitized = sanitizeMonitoringText('Bearer abc token=secret password=123');
    expect(sanitized).not.toMatch(/Bearer|token|password|secret/i);
    expect(sanitized).toContain('[redacted]');
  });

  it('normaliza errores sin exponer stack completo ni secretos', () => {
    const error = new Error('falló con apikey=abc');
    error.stack = `Error: apikey=abc\n${'x'.repeat(2000)}`;
    const normalized = normalizeError(error);
    expect(normalized.message).toContain('[redacted]');
    expect(normalized.stack.length).toBeLessThanOrEqual(1201);
  });

  it('trackEvent inserta eventos en Supabase y devuelve id', async () => {
    const { client, from, insert, select, maybeSingle } = createClientStub();
    const result = await trackEvent('qa_unit_event', { profileSlug: 'qa-smoke-profile', metadata: { source: 'unit' } }, client);

    expect(result.ok).toBe(true);
    expect(result.data.id).toBe('evt-test');
    expect(from).toHaveBeenCalledWith('events');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      profile_slug: 'qa-smoke-profile',
      event_type: 'qa_unit_event',
      metadata: expect.objectContaining({ source: 'unit', device: expect.any(String) }),
    }));
    expect(select).toHaveBeenCalledWith('id, created_at');
    expect(maybeSingle).toHaveBeenCalled();
  });

  it('trackClick conserva compatibilidad con eventos CTA de perfil', async () => {
    const { client, insert } = createClientStub();
    await trackClick('qa-smoke-profile', 'whatsapp', client);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      profile_slug: 'qa-smoke-profile',
      event_type: 'whatsapp',
      metadata: expect.objectContaining({ interaction: 'profile_cta_click' }),
    }));
  });

  it('reportCrash registra client_crash sanitizado', async () => {
    const { client, insert } = createClientStub();
    await reportCrash(new Error('boom token=abc'), { component: 'test-suite' }, client);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'client_crash',
      metadata: expect.objectContaining({
        monitor: 'app-owned-events',
        error: expect.objectContaining({ message: expect.stringContaining('[redacted]') }),
        context: expect.objectContaining({ component: 'test-suite' }),
      }),
    }));
  });

  it('installCrashMonitoring instala listeners una sola vez', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener');
    expect(installCrashMonitoring().installed).toBe(true);
    expect(installCrashMonitoring()).toEqual({ installed: false, reason: 'already_installed' });
    expect(addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    expect(addEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
  });

  it('trackEvent es no-op seguro sin Supabase', async () => {
    const result = await trackEvent('qa_noop', {}, null);
    expect(result).toEqual({ ok: false, skipped: true, reason: 'supabase_unavailable' });
  });
});
