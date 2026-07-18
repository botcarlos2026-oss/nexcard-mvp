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
