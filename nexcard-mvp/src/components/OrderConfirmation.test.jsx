import React from 'react';
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import OrderConfirmation from './OrderConfirmation';

function render(order) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<OrderConfirmation order={order} />);
  });

  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('OrderConfirmation privacy-safe receipts', () => {
  it('keeps an unavailable guest receipt generic without placeholders or inferred details', () => {
    const view = render({
      id: 'guest-order-1234',
      payment_status: 'pending',
      guestReceiptUnavailable: true,
      payment_verification_message: 'Revisaremos tu orden y te contactaremos si necesitamos más información.',
    });
    const text = view.container.textContent;

    expect(text).toContain('Orden Recibida');
    expect(text).toContain('#GUEST-OR');
    expect(text).not.toContain('Email');
    expect(text).not.toContain('Método de Pago');
    expect(text).not.toContain('Estado de Entrega');
    expect(text).not.toContain('Total de la orden');
    expect(text).not.toContain('$0');
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('Mercado Pago');
    expect(text).not.toContain('Transbank');
    expect(text).not.toContain('Recibirás un email de confirmación');
    view.unmount();
  });

  it('keeps a pending receipt pending', () => {
    const view = render({
      id: 'guest-order-1234',
      payment_status: 'pending',
      guestReceiptUnavailable: true,
    });

    expect(view.container.textContent).toContain('Pendiente de confirmación');
    expect(view.container.textContent).not.toContain('Pago rechazado');
    view.unmount();
  });

  it.each([
    ['whitespace-only string', '   '],
    ['non-numeric string', 'not-an-amount'],
  ])('keeps details hidden when amount_cents is a %s', (_description, amount_cents) => {
    const view = render({
      id: 'invalid-amount-order',
      customer_email: 'buyer@example.com',
      amount_cents,
      payment_status: 'pending',
      payment_method: 'mercado-pago',
      fulfillment_status: 'in_production',
    });
    const text = view.container.textContent;

    expect(text).not.toContain('Email');
    expect(text).not.toContain('Método de Pago');
    expect(text).not.toContain('Estado de Entrega');
    expect(text).not.toContain('Total de la orden');
    expect(text).not.toContain('$0');
    view.unmount();
  });

  it('shows a rejected label only when the receipt status explicitly says failed', () => {
    const view = render({
      id: 'failed-order-1234',
      customer_email: 'buyer@example.com',
      amount_cents: 29990,
      payment_status: 'failed',
    });

    expect(view.container.textContent).toContain('Pago rechazado');
    view.unmount();
  });

  it('renders receipt details and source-of-truth states when an authorized receipt provides them', () => {
    const view = render({
      id: 'order-1234',
      folio: 'NX-1234',
      customer_email: 'buyer@example.com',
      amount_cents: 29990,
      payment_status: 'pending',
      payment_method: 'mercado-pago',
      fulfillment_status: 'in_production',
    });
    const text = view.container.textContent;

    expect(text).toContain('NX-1234');
    expect(text).toContain('buyer@example.com');
    expect(text).toContain('$29.990');
    expect(text).toContain('Mercado Pago');
    expect(text).toContain('Pendiente de confirmación');
    expect(text).toContain('En producción');
    view.unmount();
  });

  it('keeps the paid confirmation and renders an explicitly present zero amount', () => {
    const view = render({
      id: 'order-zero',
      folio: 'NX-ZERO',
      customer_email: 'buyer@example.com',
      amount_cents: 0,
      payment_status: 'paid',
    });

    expect(view.container.textContent).toContain('¡Orden Confirmada!');
    expect(view.container.textContent).toContain('$0');
    expect(view.container.textContent).toContain('Total Pagado');
    view.unmount();
  });

  it('keeps a numeric string zero as an authorized amount', () => {
    const view = render({
      id: 'order-string-zero',
      customer_email: 'buyer@example.com',
      amount_cents: '0',
      payment_status: 'pending',
    });

    expect(view.container.textContent).toContain('$0');
    expect(view.container.textContent).toContain('Total de la orden');
    view.unmount();
  });

  it('encodes WhatsApp receipt references without injecting query parameters', () => {
    const folio = 'NX&source=evil#frag?discount=100% Ñ';
    const view = render({
      id: 'order-whatsapp',
      folio,
      payment_status: 'pending',
      guestReceiptUnavailable: true,
    });
    const href = view.container.querySelector('a[href*="wa.me"]')?.href;
    const url = new URL(href);

    expect(url.searchParams.get('text')).toBe(`Hola, mi folio es ${folio}`);
    expect([...url.searchParams.entries()]).toEqual([['text', `Hola, mi folio es ${folio}`]]);
    expect(url.hash).toBe('');
    view.unmount();
  });
});
