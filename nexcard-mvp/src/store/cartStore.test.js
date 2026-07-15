import { useCart } from './cartStore';

describe('cart store checkout sessions', () => {
  beforeEach(() => {
    useCart.setState({ items: [], checkoutData: null });
  });

  it('reinicia el carrito al comenzar una nueva compra desde landing', () => {
    useCart.getState().addItem({
      id: 'old-product',
      name: '1 Tarjeta',
      sku: 'NEXCARD-1',
      price_cents: 19990,
    });
    useCart.getState().setCheckoutData({ customerEmail: 'cliente@nexcard.cl' });

    useCart.getState().startNewCheckout();

    expect(useCart.getState().items).toEqual([]);
    expect(useCart.getState().checkoutData).toBeNull();
  });
});
