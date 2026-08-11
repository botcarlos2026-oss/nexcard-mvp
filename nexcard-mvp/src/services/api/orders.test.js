import { createOrdersApi } from './orders';

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

describe('createOrdersApi.getOrders', () => {
  it('envía identificadores de idempotencia requeridos por el RPC live', async () => {
    const createdOrder = { id: 'order-1', customer_email: 'cliente@nexcard.cl' };
    const single = jest.fn(() => Promise.resolve({ data: createdOrder, error: null }));
    const eq = jest.fn(() => ({ single }));
    const select = jest.fn(() => ({ eq }));
    const supabase = {
      rpc: jest.fn(() => Promise.resolve({ data: 'order-1', error: null })),
      from: jest.fn(() => ({ select })),
    };

    const api = createOrdersApi({
      supabase,
      hasSupabase: true,
      getClerkUserId: () => null,
    });

    await api.createOrder({
      client_checkout_attempt_id: 'attempt-123',
      client_checkout_fingerprint: 'fingerprint-abc',
      customer_name: 'Cliente QA',
      customer_email: 'CLIENTE@NEXCARD.CL',
      customer_phone: '+56912345678',
      customer_address: 'Av Siempre Viva 123, Santiago',
      payment_method: 'mercado-pago',
      amount_cents: 1000,
      desired_profile_slug: 'cliente-qa',
      currency: 'CLP',
      items: [{ product_id: 'product-1', quantity: 1 }],
    });

    expect(supabase.rpc).toHaveBeenCalledWith('create_order_with_items', expect.objectContaining({
      p_order: expect.objectContaining({
        client_checkout_attempt_id: 'attempt-123',
        client_checkout_fingerprint: 'fingerprint-abc',
        customer_email: 'cliente@nexcard.cl',
      }),
    }));
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
});
