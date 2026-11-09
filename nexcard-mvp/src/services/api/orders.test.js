import { createOrdersApi, deriveOrderObservability } from './orders';

const createQuery = (table, data = []) => {
  const query = {
    table,
    filters: [],
    select: jest.fn(() => query),
    is: jest.fn((column, value) => {
      query.filters.push({ type: 'is', column, value });
      return query;
    }),
    order: jest.fn(() => Promise.resolve({ data, error: null })),
  };
  query.then = (resolve, reject) => Promise.resolve({ data, error: null }).then(resolve, reject);
  return query;
};

describe('deriveOrderObservability', () => {
  it('no marca como problema una activación post-compra mientras la orden sigue en producción', () => {
    const result = deriveOrderObservability({
      order: {
        payment_status: 'paid',
        fulfillment_status: 'in_production',
        paid_at: new Date().toISOString(),
        payments: [{ status: 'paid' }],
      },
      claim: { status: 'claimed', updated_at: new Date().toISOString() },
      relatedCards: [{ id: 'card-1', status: 'assigned', activation_status: 'assigned' }],
    });

    expect(result.activation_completed).toBe(true);
    expect(result.observability_alerts).toEqual([]);
    expect(result.observability_anomaly_level).toBe('ok');
  });
});

describe('createOrdersApi', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const createOrderPayload = () => ({
    client_checkout_attempt_id: 'attempt-123',
    client_checkout_fingerprint: 'fingerprint-abc',
    customer_name: 'Cliente QA',
    customer_email: 'CLIENTE@NEXCARD.CL',
    customer_phone: '+569****5678',
    customer_address: 'Av Siempre Viva 123, Santiago',
    payment_method: 'mercado-pago',
    amount_cents: 1000,
    desired_profile_slug: 'cliente-qa',
    currency: 'CLP',
    items: [{ product_id: 'product-1', quantity: 1 }],
  });

  const createGuestReceiptSupabase = ({ receipt = { id: 'order-1', customer_email: 'cliente@nexcard.cl' }, receiptError = null } = {}) => {
    const supabase = {
      rpc: jest.fn((name) => {
        if (name === 'create_order_with_items') {
          return Promise.resolve({ data: 'order-1', error: null });
        }
        if (name === 'get_guest_order_receipt') {
          return Promise.resolve({ data: receipt ? [receipt] : [], error: receiptError });
        }
        throw new Error(`Unexpected RPC: ${name}`);
      }),
      from: jest.fn(() => {
        throw new Error('Guest createOrder must not query orders directly');
      }),
    };

    return supabase;
  };

  it('recupera el recibo guest por RPC con los mismos identificadores idempotentes enviados a create', async () => {
    const createdOrder = { id: 'order-1', customer_email: 'cliente@nexcard.cl' };
    const supabase = createGuestReceiptSupabase({ receipt: createdOrder });

    const api = createOrdersApi({
      supabase,
      hasSupabase: true,
      getClerkUserId: () => null,
    });

    const result = await api.createOrder(createOrderPayload());

    expect(supabase.rpc).toHaveBeenNthCalledWith(1, 'create_order_with_items', expect.objectContaining({
      p_order: expect.objectContaining({
        client_checkout_attempt_id: 'attempt-123',
        client_checkout_fingerprint: 'fingerprint-abc',
        customer_email: 'cliente@nexcard.cl',
      }),
    }));
    expect(supabase.rpc).toHaveBeenNthCalledWith(2, 'get_guest_order_receipt', {
      p_order_id: 'order-1',
      p_checkout_attempt_id: 'attempt-123',
      p_checkout_fingerprint: 'fingerprint-abc',
    });
    expect(supabase.from).not.toHaveBeenCalledWith('orders');
    expect(result).toEqual(createdOrder);
  });

  it('rechaza con un error genérico cuando el receipt RPC no retorna una orden', async () => {
    const supabase = createGuestReceiptSupabase({ receipt: null });
    const api = createOrdersApi({ supabase, hasSupabase: true, getClerkUserId: () => null });

    await expect(api.createOrder(createOrderPayload())).rejects.toThrow('No se pudo recuperar la orden');
    expect(supabase.from).not.toHaveBeenCalledWith('orders');
  });

  it('no filtra errores sensibles del receipt RPC', async () => {
    const sensitiveMessage = 'sensitive database detail';
    const supabase = createGuestReceiptSupabase({ receipt: null, receiptError: { message: sensitiveMessage } });
    const api = createOrdersApi({ supabase, hasSupabase: true, getClerkUserId: () => null });

    await expect(api.createOrder(createOrderPayload())).rejects.toThrow('No se pudo recuperar la orden');
    await expect(api.createOrder(createOrderPayload())).rejects.not.toThrow(sensitiveMessage);
    expect(supabase.from).not.toHaveBeenCalledWith('orders');
  });

  it('mantiene idempotencia: un reintento retorna el mismo receipt acotado', async () => {
    const createdOrder = { id: 'order-1', customer_email: 'cliente@nexcard.cl' };
    const supabase = createGuestReceiptSupabase({ receipt: createdOrder });
    const api = createOrdersApi({ supabase, hasSupabase: true, getClerkUserId: () => null });

    const firstReceipt = await api.createOrder(createOrderPayload());
    const retryReceipt = await api.createOrder(createOrderPayload());

    expect(firstReceipt).toEqual(createdOrder);
    expect(retryReceipt).toEqual(createdOrder);
    expect(supabase.rpc).toHaveBeenNthCalledWith(4, 'get_guest_order_receipt', {
      p_order_id: 'order-1',
      p_checkout_attempt_id: 'attempt-123',
      p_checkout_fingerprint: 'fingerprint-abc',
    });
    expect(supabase.from).not.toHaveBeenCalledWith('orders');
  });

  it('expone getGuestOrderReceipt para el hook posterior', () => {
    const api = createOrdersApi({
      supabase: createGuestReceiptSupabase(),
      hasSupabase: true,
      getClerkUserId: () => null,
    });

    expect(api.getGuestOrderReceipt).toEqual(expect.any(Function));
  });

  it('excluye órdenes soft-deleted desde la consulta base', async () => {
    const queries = {};
    const supabase = {
      from: jest.fn((table) => {
        queries[table] = createQuery(table, table === 'orders' ? [
          {
            id: 'order-real',
            customer_email: 'cliente@nexcard.cl',
            payment_status: 'paid',
            fulfillment_status: 'new',
            payments: [],
            order_items: [],
          },
        ] : []);
        return queries[table];
      }),
    };

    const api = createOrdersApi({
      supabase,
      hasSupabase: true,
      getClerkUserId: () => null,
    });

    const result = await api.getOrders();

    expect(result.orders).toHaveLength(1);
    expect(supabase.from).toHaveBeenCalledWith('orders');
    expect(queries.orders.select).toHaveBeenCalledWith('*, order_items(*), payments(*)');
    expect(queries.orders.is).toHaveBeenCalledWith('deleted_at', null);
    expect(queries.orders.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('no usa fallback admin local aunque localStorage declare role admin', async () => {
    window.localStorage.setItem('nexcard_auth', JSON.stringify({
      user: { id: 'spoofed-user', email: 'admin@nexcard.cl', role: 'admin' },
    }));

    const queries = {};
    const supabase = {
      from: jest.fn((table) => {
        queries[table] = createQuery(table, []);
        return queries[table];
      }),
    };
    const request = jest.fn(() => Promise.resolve({ orders: [{ id: 'local-admin-order' }] }));

    const api = createOrdersApi({
      supabase,
      hasSupabase: true,
      getClerkUserId: () => null,
      request,
    });

    await api.getOrders();

    expect(request).not.toHaveBeenCalledWith('/admin/orders');
    expect(supabase.from).toHaveBeenCalledWith('orders');
  });
});
