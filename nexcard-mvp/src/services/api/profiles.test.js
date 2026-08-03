import { vi } from 'vitest';
import { createProfilesApi } from './profiles';

const AUTH_MESSAGE = 'Sesión inválida o expirada. Inicia sesión nuevamente para activar tu NexCard.';

const createApi = ({ session = null, invokeResult = { data: { success: true }, error: null }, rpcResult = { data: { available: true, slug: 'qa-smoke-profile', reason: 'available', message: 'Usuario disponible.' }, error: null } } = {}) => {
  const supabase = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue(invokeResult),
    },
    rpc: vi.fn().mockResolvedValue(rpcResult),
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

    await expect(api.claimProfile('claim-token')).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
      status: 401,
      message: AUTH_MESSAGE,
    });
  });

  it('traduce 403 de Edge Function a flujo AUTH_REQUIRED', async () => {
    const { api } = createApi({
      session: { access_token: 'valid-jwt' },
      invokeResult: {
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: { status: 403 },
        },
      },
    });

    await expect(api.claimProfile('claim-token')).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
      status: 403,
      message: AUTH_MESSAGE,
    });
  });

  it('consulta la RPC de disponibilidad de slug con el currentOrderId', async () => {
    const { api, supabase } = createApi();

    await expect(api.checkProfileSlugAvailability('QA Smoke Profile', 'order-123')).resolves.toMatchObject({
      available: true,
      slug: 'qa-smoke-profile',
    });

    expect(supabase.rpc).toHaveBeenCalledWith('check_profile_slug_availability', {
      candidate_slug: 'QA Smoke Profile',
      current_order_id: 'order-123',
    });
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
