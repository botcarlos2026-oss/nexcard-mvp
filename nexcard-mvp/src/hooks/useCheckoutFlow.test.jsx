import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

const mocks = vi.hoisted(() => ({
  getLastOrderProof: vi.fn(),
  getLastOrderSnapshot: vi.fn(),
  getGuestOrderReceipt: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock('../services/api', () => ({
  getLastOrderProof: mocks.getLastOrderProof,
  getLastOrderSnapshot: mocks.getLastOrderSnapshot,
  api: { getGuestOrderReceipt: mocks.getGuestOrderReceipt },
}));

vi.mock('../services/supabaseClient', () => ({
  hasSupabase: false,
  supabase: null,
}));

vi.mock('../utils/ga4', () => ({ trackEvent: mocks.trackEvent }));

import { useCheckoutFlow } from './useCheckoutFlow';

function renderHook() {
  let current;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  function HookHarness() {
    current = useCheckoutFlow();
    return null;
  }

  return {
    get current() {
      return current;
    },
    async render() {
      await act(async () => {
        root.render(<HookHarness />);
        await Promise.resolve();
      });
    },
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function setPaymentReturn(payment, orderId) {
  window.history.replaceState({}, '', `/?payment=${payment}&order=${orderId}`);
}

function setValidProof(orderId = 'order-1') {
  mocks.getLastOrderProof.mockReturnValue({
    orderId,
    clientCheckoutAttemptId: 'attempt-1',
    clientCheckoutFingerprint: 'fingerprint-1',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  window.history.replaceState({}, '', '/');
  mocks.getLastOrderProof.mockReturnValue(null);
  mocks.getLastOrderSnapshot.mockReturnValue(null);
});

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState({}, '', '/');
  document.body.innerHTML = '';
});

describe('useCheckoutFlow secure guest payment return', () => {
  it('keeps a generic pending receipt and skips the RPC without a proof', async () => {
    setPaymentReturn('success', 'order-1');
    const hook = renderHook();
    await hook.render();

    expect(mocks.getGuestOrderReceipt).not.toHaveBeenCalled();
    expect(hook.current.checkoutStep).toBe('confirmation');
    expect(hook.current.currentOrder).toMatchObject({
      id: 'order-1',
      payment_status: 'pending',
      guestReceiptUnavailable: true,
    });
    expect(hook.current.currentOrder).not.toHaveProperty('customer_email');
    expect(window.location.search).toBe('');
    hook.unmount();
  });

  it('does not call the RPC or mix a mismatched snapshot into the return', async () => {
    setPaymentReturn('success', 'order-2');
    setValidProof('order-1');
    mocks.getLastOrderSnapshot.mockReturnValue({
      id: 'order-1',
      customer_email: 'previous-buyer@example.com',
      payment_status: 'paid',
    });
    const hook = renderHook();
    await hook.render();

    expect(mocks.getGuestOrderReceipt).not.toHaveBeenCalled();
    expect(hook.current.currentOrder).toMatchObject({
      id: 'order-2',
      payment_status: 'pending',
      guestReceiptUnavailable: true,
    });
    expect(hook.current.currentOrder).not.toHaveProperty('customer_email');
    hook.unmount();
  });

  it('confirms paid only when the scoped receipt reports paid', async () => {
    setPaymentReturn('success', 'order-1');
    setValidProof();
    mocks.getLastOrderSnapshot.mockReturnValue({ id: 'order-1', folio: 'NX-OLD' });
    mocks.getGuestOrderReceipt.mockResolvedValue({
      id: 'order-1',
      folio: 'NX-100',
      payment_status: 'paid',
    });
    const hook = renderHook();
    await hook.render();

    expect(mocks.getGuestOrderReceipt).toHaveBeenCalledWith({
      orderId: 'order-1',
      clientCheckoutAttemptId: 'attempt-1',
      clientCheckoutFingerprint: 'fingerprint-1',
    }, {
      signal: expect.any(AbortSignal),
    });
    expect(hook.current.currentOrder).toMatchObject({
      id: 'order-1',
      folio: 'NX-100',
      payment_status: 'paid',
      isVerifyingPayment: false,
    });
    expect(mocks.trackEvent).toHaveBeenCalledWith('payment_return_success_seen', { order_id: 'order-1' });
    hook.unmount();
  });

  it('leaves success returns pending with an honest message after the thirty-second deadline', async () => {
    vi.useFakeTimers();
    setPaymentReturn('success', 'order-1');
    setValidProof();
    mocks.getGuestOrderReceipt.mockResolvedValue({ id: 'order-1', payment_status: 'pending' });
    const hook = renderHook();
    await hook.render();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(mocks.getGuestOrderReceipt).toHaveBeenCalledTimes(10);
    expect(hook.current.currentOrder).toMatchObject({
      id: 'order-1',
      payment_status: 'pending',
      isVerifyingPayment: false,
    });
    expect(hook.current.currentOrder.payment_verification_message).toMatch(/aún no aparece confirmado/i);
    hook.unmount();
  });

  it.each([
    ['failure', 'rejected'],
    ['pending', 'authorized'],
  ])('uses the real receipt state after a %s return with one lookup', async (payment, receiptStatus) => {
    setPaymentReturn(payment, 'order-1');
    setValidProof();
    mocks.getGuestOrderReceipt.mockResolvedValue({ id: 'order-1', payment_status: receiptStatus });
    const hook = renderHook();
    await hook.render();

    expect(mocks.getGuestOrderReceipt).toHaveBeenCalledTimes(1);
    expect(hook.current.currentOrder).toMatchObject({
      id: 'order-1',
      payment_status: receiptStatus,
      isVerifyingPayment: false,
    });
    hook.unmount();
  });

  it('never fabricates paid from the success query parameter', async () => {
    vi.useFakeTimers();
    setPaymentReturn('success', 'order-1');
    setValidProof();
    mocks.getGuestOrderReceipt.mockResolvedValue({ id: 'order-1', payment_status: 'pending' });
    const hook = renderHook();
    await hook.render();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(hook.current.currentOrder.payment_status).toBe('pending');
    expect(hook.current.currentOrder.payment_status).not.toBe('paid');
    hook.unmount();
  });

  it('aborts polling on unmount without further receipt requests or state updates', async () => {
    vi.useFakeTimers();
    setPaymentReturn('success', 'order-1');
    setValidProof();
    let resolveReceipt;
    mocks.getGuestOrderReceipt.mockImplementation(() => new Promise((resolve) => {
      resolveReceipt = resolve;
    }));
    const hook = renderHook();
    await hook.render();
    expect(mocks.getGuestOrderReceipt).toHaveBeenCalledTimes(1);
    const currentOrderBeforeUnmount = hook.current.currentOrder;

    hook.unmount();
    resolveReceipt({ id: 'order-1', payment_status: 'pending' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(mocks.getGuestOrderReceipt).toHaveBeenCalledTimes(1);
    expect(hook.current.currentOrder).toBe(currentOrderBeforeUnmount);
  });
});
