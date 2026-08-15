import { vi } from 'vitest';
import { createProfilesApi } from './profiles';

const AUTH_MESSAGE = 'Sesión inválida o expirada. Inicia sesión nuevamente para activar tu NexCard.';

const createApi = ({ session = null, invokeResult = { data: { success: true }, error: null }, rpcResult = { data: { available: true, slug: 'qa-smoke-profile', reason: 'available', message: 'Usuario disponible.' }, error: null }, from = vi.fn() } = {}) => {
  const supabase = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue(invokeResult),
    },
    rpc: vi.fn().mockResolvedValue(rpcResult),
    from,
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

  it('traduce 403 de Edge Function a mismatch de correo sin forzar loop de login', async () => {
    const { api } = createApi({
      session: { access_token: 'valid-jwt' },
      invokeResult: {
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: new Response(JSON.stringify({
            error: 'Este link pertenece a otro correo comprador. Cierra sesión e ingresa con el correo de la compra.',
          }), { status: 403 }),
        },
      },
    });

    await expect(api.claimProfile('claim-token')).rejects.toMatchObject({
      code: 'CLAIM_EMAIL_MISMATCH',
      status: 403,
      message: 'Este link pertenece a otro correo comprador. Cierra sesión e ingresa con el correo de la compra.',
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

  it('lee el perfil público desde la view sin seleccionar columnas sensibles', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { slug: 'ana' }, error: null });
    const is = vi.fn(() => ({ maybeSingle }));
    const eqStatus = vi.fn(() => ({ is }));
    const eqSlug = vi.fn(() => ({ eq: eqStatus }));
    const select = vi.fn(() => ({ eq: eqSlug }));
    const from = vi.fn(() => ({ select }));
    const { api } = createApi({ from });

    await expect(api.getPublicProfile('ana')).resolves.toEqual({ slug: 'ana' });

    expect(from).toHaveBeenCalledWith('profiles_public');
    const columns = select.mock.calls[0][0];
    expect(columns).not.toContain('bank_');
    expect(columns).not.toContain('contact_email,');
    expect(columns).not.toContain('contact_phone,');
    expect(columns).not.toBe('*');
  });
});
