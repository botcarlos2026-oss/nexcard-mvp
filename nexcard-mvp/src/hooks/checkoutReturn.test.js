import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RETURN_POLL_INTERVAL_MS,
  RETURN_POLL_TIMEOUT_MS,
  pollGuestOrderReceipt,
  resolveReturnProof,
} from './checkoutReturn';

const proofForOrder1 = {
  orderId: 'order-1',
  clientCheckoutAttemptId: 'attempt-1',
  clientCheckoutFingerprint: 'fingerprint-1',
  ignored: 'not-a-proof-field',
};

const pendingReceipt = { id: 'order-1', payment_status: 'pending' };
const paidReceipt = { id: 'order-1', payment_status: 'paid' };

afterEach(() => {
  vi.useRealTimers();
});

describe('resolveReturnProof', () => {
  it('rejects missing or mismatched proofs and normalizes an exact match', () => {
    expect(resolveReturnProof('order-1', null)).toBeNull();
    expect(resolveReturnProof('order-2', proofForOrder1)).toBeNull();
    expect(resolveReturnProof('order-1', proofForOrder1)).toEqual({
      orderId: 'order-1',
      clientCheckoutAttemptId: 'attempt-1',
      clientCheckoutFingerprint: 'fingerprint-1',
    });
  });
});

describe('pollGuestOrderReceipt', () => {
  it('fetches immediately, retries pending every three seconds, and stops when paid', async () => {
    vi.useFakeTimers();
    const fetchReceipt = vi.fn()
      .mockResolvedValueOnce(pendingReceipt)
      .mockResolvedValueOnce(paidReceipt);
    const onReceipt = vi.fn();

    const poll = pollGuestOrderReceipt({ fetchReceipt, proof: proofForOrder1, onReceipt });
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchReceipt).toHaveBeenCalledTimes(1);
    expect(onReceipt).toHaveBeenLastCalledWith(pendingReceipt);

    await vi.advanceTimersByTimeAsync(RETURN_POLL_INTERVAL_MS);
    await expect(poll).resolves.toEqual(paidReceipt);
    expect(fetchReceipt).toHaveBeenCalledTimes(2);
    expect(onReceipt).toHaveBeenLastCalledWith(paidReceipt);

    await vi.advanceTimersByTimeAsync(RETURN_POLL_INTERVAL_MS);
    expect(fetchReceipt).toHaveBeenCalledTimes(2);
  });

  it('returns the latest pending receipt at the thirty-second deadline', async () => {
    vi.useFakeTimers();
    const fetchReceipt = vi.fn().mockResolvedValue(pendingReceipt);
    const poll = pollGuestOrderReceipt({ fetchReceipt, proof: proofForOrder1 });

    await vi.advanceTimersByTimeAsync(RETURN_POLL_TIMEOUT_MS);
    await expect(poll).resolves.toEqual(pendingReceipt);
    expect(fetchReceipt).toHaveBeenCalledTimes(10);
  });

  it('stops without new polls when aborted between attempts', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetchReceipt = vi.fn().mockResolvedValue(pendingReceipt);
    const onReceipt = vi.fn();
    const poll = pollGuestOrderReceipt({
      fetchReceipt,
      proof: proofForOrder1,
      signal: controller.signal,
      onReceipt,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchReceipt).toHaveBeenCalledTimes(1);
    controller.abort();
    await vi.advanceTimersByTimeAsync(RETURN_POLL_TIMEOUT_MS);
    await expect(poll).resolves.toBeNull();
    expect(onReceipt).toHaveBeenCalledTimes(1);
    expect(fetchReceipt).toHaveBeenCalledTimes(1);
  });

  it('settles at the deadline when an in-flight receipt request never resolves', async () => {
    vi.useFakeTimers();
    const fetchReceipt = vi.fn(() => new Promise(() => {}));
    const onReceipt = vi.fn();
    const poll = pollGuestOrderReceipt({ fetchReceipt, proof: proofForOrder1, onReceipt });

    await vi.advanceTimersByTimeAsync(RETURN_POLL_TIMEOUT_MS);

    await expect(poll).resolves.toBeNull();
    expect(fetchReceipt).toHaveBeenCalledTimes(1);
    expect(onReceipt).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('settles immediately on abort during an in-flight request and ignores its late receipt', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    let resolveReceipt;
    const fetchReceipt = vi.fn(() => new Promise((resolve) => {
      resolveReceipt = resolve;
    }));
    const onReceipt = vi.fn();
    const poll = pollGuestOrderReceipt({
      fetchReceipt,
      proof: proofForOrder1,
      signal: controller.signal,
      onReceipt,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchReceipt).toHaveBeenCalledWith(proofForOrder1, { signal: controller.signal });
    controller.abort();

    await expect(poll).resolves.toBeNull();
    expect(onReceipt).not.toHaveBeenCalled();
    expect(fetchReceipt).toHaveBeenCalledTimes(1);

    resolveReceipt(paidReceipt);
    await vi.advanceTimersByTimeAsync(RETURN_POLL_TIMEOUT_MS);
    expect(onReceipt).not.toHaveBeenCalled();
    expect(fetchReceipt).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('hides intermediate errors and returns the last pending receipt at deadline', async () => {
    vi.useFakeTimers();
    const fetchReceipt = vi.fn()
      .mockResolvedValueOnce(pendingReceipt)
      .mockRejectedValueOnce(new Error('sensitive backend detail'))
      .mockResolvedValue(pendingReceipt);
    const onReceipt = vi.fn();
    const poll = pollGuestOrderReceipt({ fetchReceipt, proof: proofForOrder1, onReceipt });

    await vi.advanceTimersByTimeAsync(RETURN_POLL_TIMEOUT_MS);
    await expect(poll).resolves.toEqual(pendingReceipt);
    expect(onReceipt).not.toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('sensitive') }));
  });
});
