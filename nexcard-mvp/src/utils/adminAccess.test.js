describe('adminAccess fail-closed authorization', () => {
  beforeEach(() => {
    jest.resetModules();
    window.localStorage.clear();
  });

  const loadAccess = async ({ hasSupabase = true, sessionResult, rpcResult } = {}) => {
    jest.doMock('../services/supabaseClient', () => ({
      hasSupabase,
      supabase: hasSupabase ? {
        auth: {
          getSession: jest.fn(() => Promise.resolve(sessionResult || { data: { session: null }, error: null })),
        },
        rpc: jest.fn(() => Promise.resolve(rpcResult || { data: false, error: null })),
      } : null,
    }));

    const mod = await import('./adminAccess');
    return mod.getCurrentAdminAccess();
  };

  it('niega admin aunque localStorage declare role admin si no hay sesión Supabase', async () => {
    window.localStorage.setItem('nexcard_auth', JSON.stringify({
      user: { id: 'spoofed-user', email: 'admin@nexcard.cl', role: 'admin' },
    }));

    const access = await loadAccess();

    expect(access.isAdmin).toBe(false);
    expect(access.source).toBe('anonymous');
  });

  it('niega admin cuando has_role falla aunque el email esté en allowlist', async () => {
    const access = await loadAccess({
      sessionResult: {
        data: { session: { user: { id: 'user-1', email: 'admin@nexcard.cl' } } },
        error: null,
      },
      rpcResult: { data: null, error: new Error('rpc down') },
    });

    expect(access.isAdmin).toBe(false);
    expect(access.source).toBe('has_role_error');
  });

  it('permite admin local solo cuando Supabase no está configurado (modo local)', async () => {
    window.localStorage.setItem('nexcard_auth', JSON.stringify({
      user: { id: 'local-admin', email: 'admin@nexcard.local', role: 'admin' },
    }));

    const access = await loadAccess({ hasSupabase: false });

    expect(access.isAdmin).toBe(true);
    expect(access.source).toBe('local_only_role');
  });

  it('permite admin solo con sesión real y has_role true', async () => {
    const access = await loadAccess({
      sessionResult: {
        data: { session: { user: { id: 'admin-1', email: 'admin@nexcard.cl' } } },
        error: null,
      },
      rpcResult: { data: true, error: null },
    });

    expect(access.isAdmin).toBe(true);
    expect(access.source).toBe('memberships');
  });
});
