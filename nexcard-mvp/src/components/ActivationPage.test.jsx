import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { vi } from 'vitest';
import ActivationPage from './ActivationPage';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    previewProfileClaim: vi.fn(),
    claimProfile: vi.fn(),
  },
}));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function renderActivation(props = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <ActivationPage
        token="claim-token"
        user={null}
        onAuthRequired={vi.fn()}
        onContinueSetup={vi.fn()}
        {...props}
      />
    );
    await flush();
  });

  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('ActivationPage privacy-safe preview', () => {
  it('renders only masked preview data and applies no-referrer', async () => {
    api.previewProfileClaim.mockResolvedValue({
      claim: {
        status: 'pending',
        quantity: 2,
        masked_customer_email: 'c***@example.com',
        customer_email: 'carlos.secret@example.com',
      },
      order: {
        id: 'private-order-id',
        folio: 'NX-PRIVATE-123',
        amount_cents: 999999,
        card_customization: { desired_slug: 'private-slug' },
      },
      reserved_slug: 'private-slug',
    });

    const view = await renderActivation();
    const text = view.container.textContent;

    expect(text).toContain('c***@example.com');
    expect(text).toContain('Tarjetas incluidas');
    expect(text).not.toContain('carlos.secret@example.com');
    expect(text).not.toContain('NX-PRIVATE-123');
    expect(text).not.toContain('private-order-id');
    expect(text).not.toContain('private-slug');
    expect(document.querySelector('meta[name="referrer"]')?.getAttribute('content')).toBe('no-referrer');

    view.unmount();
    expect(document.querySelector('meta[name="referrer"]')).toBeNull();
  });

  it('does not pass a full buyer email into the unauthenticated auth handoff', async () => {
    const onAuthRequired = vi.fn();
    api.previewProfileClaim.mockResolvedValue({
      claim: {
        status: 'pending',
        quantity: 1,
        masked_customer_email: 'b***@example.com',
      },
    });

    const view = await renderActivation({ onAuthRequired });
    const button = Array.from(view.container.querySelectorAll('button')).find((item) => item.textContent.includes('Crear acceso'));
    act(() => button.click());

    expect(onAuthRequired).toHaveBeenCalledWith('claim-token');
    view.unmount();
  });
});
