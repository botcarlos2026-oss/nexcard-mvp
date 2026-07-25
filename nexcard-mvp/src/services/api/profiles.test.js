import { vi } from 'vitest';
import { createProfilesApi } from './profiles';

const AUTH_MESSAGE = 'Sesión inválida o expirada. Inicia sesión nuevamente para activar tu NexCard.';

const createApi = ({ session = null, invokeResult = { data: { success: true }, error: null } } = {}) => {
  const supabase = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue(invokeResult),
    },
  };

  return {
    supabase,
    api: createProfilesApi({
      supabase,
      hasSupabase: true,
      getClerkUserId: () => 'user-1',
      getCurrentUserEmail: () => 'buyer@nexcard.cl',
      request: vi.fn(),
    }),
  };
};

describe('createProfilesApi activation claim auth', () => {
  it('redirige a auth sin invocar claim-profile cuando no hay sesión real de Supabase', async () => {
    const { api, supabase } = createApi();

    await expect(api.claimProfile('claim-token')).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
      message: AUTH_MESSAGE,
    });

    expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('traduce 401 de Edge Function a mensaje seguro para el comprador', async () => {
    const { api } = createApi({
      session: { access_token: 'valid-jwt' },
      invokeResult: {
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: { status: 401 },
        },
      },
    });

    await expect(api.claimProfile('claim-token')).rejects.toThrow(AUTH_MESSAGE);
  });

  it('envía el JWT vigente al claim-profile cuando hay sesión válida', async () => {
    const { api, supabase } = createApi({
      session: { access_token: 'valid-jwt' },
      invokeResult: { data: { success: true, claim: { status: 'claimed' } }, error: null },
    });

    await expect(api.claimProfile('claim-token')).resolves.toEqual({
      success: true,
      claim: { status: 'claimed' },
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('claim-profile', {
      body: JSON.stringify({ action: 'claim', token: 'claim-token' }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-jwt',
      },
    });
  });
});
