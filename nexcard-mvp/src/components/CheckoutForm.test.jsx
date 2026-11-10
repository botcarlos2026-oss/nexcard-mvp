import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useCart } from '../store/cartStore';

const mocks = vi.hoisted(() => ({
  createOrder: vi.fn(),
  checkProfileSlugAvailability: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock('../services/supabaseClient', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
  hasSupabase: false,
  getClerkUserId: () => null,
  getCurrentUserEmail: () => null,
}));

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    api: {
      ...actual.api,
      createOrder: mocks.createOrder,
      checkProfileSlugAvailability: mocks.checkProfileSlugAvailability,
    },
  };
});

import CheckoutForm from './CheckoutForm';

const PROOF_KEY = 'nexcard_last_order_proof';

function render(ui) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(ui);
  });

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

async function submitCheckout(container) {
  const terms = container.querySelector('#acceptTerms');

  await act(async () => {
    terms.click();
  });

  await act(async () => {
    container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(window.location.hash).toBe('#mercado-pago'));
  });
}

function prepareCheckout() {
  sessionStorage.setItem('nx_checkout_form', JSON.stringify({
    customerName: 'Cliente Prueba',
    customerEmail: 'cliente@example.com',
    customerPhone: '+56 9 1234 5678',
    customerAddress: 'Avenida Siempre Viva 123, Santiago',
  }));
  sessionStorage.setItem('nx_checkout_desired_slug', 'cliente-prueba');
  localStorage.setItem('nexcard_checkout_fingerprint', 'fingerprint-checkout-1');
  useCart.setState({
    items: [{
      product_id: 'product-1',
      product_name: 'NexCard',
      unit_price_cents: 19990,
      quantity: 1,
    }],
  });

  mocks.checkProfileSlugAvailability.mockResolvedValue({
    available: true,
    slug: 'cliente-prueba',
  });
  mocks.createOrder.mockResolvedValue({ id: 'order-receipt-1' });
  mocks.invoke.mockResolvedValue({ data: { init_point: '#mercado-pago' }, error: null });
}

describe('CheckoutForm Mercado Pago proof persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '';
    window.scrollTo = vi.fn();
    prepareCheckout();
  });

  afterEach(() => {
    useCart.setState({ items: [], checkoutData: null });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('persists the valid receipt proof before invoking Mercado Pago with the same identifiers', async () => {
    const events = [];
    const nativeStorage = sessionStorage;
    vi.stubGlobal('sessionStorage', {
      getItem: nativeStorage.getItem.bind(nativeStorage),
      setItem: (key, value) => {
        if (key === PROOF_KEY) events.push({ type: 'proof', proof: JSON.parse(value) });
        return nativeStorage.setItem(key, value);
      },
      removeItem: nativeStorage.removeItem.bind(nativeStorage),
      clear: nativeStorage.clear.bind(nativeStorage),
    });
    mocks.invoke.mockImplementation(async (name, { body }) => {
      events.push({ type: 'invoke', name, payload: JSON.parse(body) });
      return { data: { init_point: '#mercado-pago' }, error: null };
    });

    const { container, unmount } = render(<CheckoutForm onOrderSuccess={vi.fn()} onBack={vi.fn()} />);
    await submitCheckout(container);

    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    const proof = JSON.parse(sessionStorage.getItem(PROOF_KEY));
    const invokePayload = JSON.parse(mocks.invoke.mock.calls[0][1].body);

    expect(proof).toEqual({
      orderId: 'order-receipt-1',
      clientCheckoutAttemptId: expect.any(String),
      clientCheckoutFingerprint: 'fingerprint-checkout-1',
    });
    expect(invokePayload).toEqual(proof);
    expect(mocks.createOrder).toHaveBeenCalledWith(expect.objectContaining({
      client_checkout_attempt_id: proof.clientCheckoutAttemptId,
      client_checkout_fingerprint: proof.clientCheckoutFingerprint,
    }));
    expect(events).toEqual([
      { type: 'proof', proof },
      { type: 'invoke', name: 'create-mp-preference', payload: proof },
    ]);
    expect(window.location.hash).toBe('#mercado-pago');

    unmount();
  });

  it('continues to Mercado Pago when proof storage is unavailable', async () => {
    const nativeStorage = sessionStorage;
    vi.stubGlobal('sessionStorage', {
      getItem: nativeStorage.getItem.bind(nativeStorage),
      setItem: (key, value) => {
        if (key === PROOF_KEY) throw new Error('sessionStorage unavailable');
        return nativeStorage.setItem(key, value);
      },
      removeItem: nativeStorage.removeItem.bind(nativeStorage),
      clear: nativeStorage.clear.bind(nativeStorage),
    });

    const { container, unmount } = render(<CheckoutForm onOrderSuccess={vi.fn()} onBack={vi.fn()} />);
    await submitCheckout(container);

    expect(sessionStorage.getItem(PROOF_KEY)).toBeNull();
    const invokePayload = JSON.parse(mocks.invoke.mock.calls[0][1].body);
    expect(invokePayload).toEqual({
      orderId: 'order-receipt-1',
      clientCheckoutAttemptId: expect.any(String),
      clientCheckoutFingerprint: 'fingerprint-checkout-1',
    });
    expect(window.location.hash).toBe('#mercado-pago');

    unmount();
  });
});
