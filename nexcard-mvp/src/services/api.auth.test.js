import { afterEach, describe, expect, it, vi } from 'vitest';

const loadApiWithSupabaseAuth = async (authOverrides = {}) => {
  vi.resetModules();
  const auth = {
    signUp: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' }, session: null }, error: null }),
    resend: vi.fn().mockResolvedValue({ error: null }),
    ...authOverrides,
  };

  vi.doMock('./supabaseClient', () => ({
    supabase: { auth },
    hasSupabase: true,
    getClerkUserId: vi.fn(),
    getCurrentUserEmail: vi.fn(),
  }));

  const { api } = await import('./api');
  return { api, auth };
};

afterEach(() => {
  vi.doUnmock('./supabaseClient');
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('Supabase auth API redirects', () => {
  it('honors contextual signup redirectTo when creating a first-access account', async () => {
    const { api, auth } = await loadApiWithSupabaseAuth();

    await expect(api.register({
      email: 'cliente@nexcard.cl',
      password: 'password-segura',
      redirectTo: 'https://www.nexcard.cl/login?mode=login&claim=1',
    })).resolves.toMatchObject({ needsEmailConfirmation: true });

    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'cliente@nexcard.cl',
      password: 'password-segura',
      options: { emailRedirectTo: 'https://www.nexcard.cl/login?mode=login&claim=1' },
    });
  });

  it('passes the requested signup confirmation redirect when resending confirmation', async () => {
    const { api, auth } = await loadApiWithSupabaseAuth();

    await expect(api.resendSignupConfirmation({
      email: 'cliente@nexcard.cl',
      redirectTo: 'https://www.nexcard.cl/login?mode=login&claim=1',
    })).resolves.toEqual({ ok: true });

    expect(auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'cliente@nexcard.cl',
      options: { emailRedirectTo: 'https://www.nexcard.cl/login?mode=login&claim=1' },
    });
  });
});
