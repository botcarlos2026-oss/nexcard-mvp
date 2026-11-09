export const RETURN_POLL_INTERVAL_MS = 3000;
export const RETURN_POLL_TIMEOUT_MS = 30000;

export function resolveReturnProof(orderId, proof) {
  if (!orderId || proof?.orderId !== orderId) return null;

  const { clientCheckoutAttemptId, clientCheckoutFingerprint } = proof;
  if (!clientCheckoutAttemptId || !clientCheckoutFingerprint) return null;

  return {
    orderId,
    clientCheckoutAttemptId,
    clientCheckoutFingerprint,
  };
}

function waitForNextPoll(delay, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(false);
      return;
    }

    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve(true);
    }, delay);

    const onAbort = () => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', onAbort);
      resolve(false);
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function waitForRequestBoundary(delay, signal) {
  let timeout;
  let onAbort;
  let settled = false;

  const finish = (result, resolve) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
    resolve(result);
  };

  let resolveBoundary;
  const promise = new Promise((resolve) => {
    resolveBoundary = resolve;
    onAbort = () => finish({ type: 'aborted' }, resolve);

    if (signal?.aborted) {
      finish({ type: 'aborted' }, resolve);
      return;
    }

    timeout = setTimeout(() => finish({ type: 'deadline' }, resolve), delay);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

  return {
    promise,
    cancel: () => finish({ type: 'cancelled' }, resolveBoundary),
  };
}

async function fetchReceiptBeforeDeadline({ fetchReceipt, proof, signal, deadline }) {
  if (signal?.aborted) return { type: 'aborted' };

  const remaining = deadline - Date.now();
  if (remaining <= 0) return { type: 'deadline' };

  const request = Promise.resolve().then(async () => {
    if (signal?.aborted) return { type: 'aborted' };

    try {
      return { type: 'receipt', receipt: await fetchReceipt(proof, { signal }) };
    } catch {
      return { type: 'error' };
    }
  });
  const boundary = waitForRequestBoundary(remaining, signal);
  const result = await Promise.race([request, boundary.promise]);
  boundary.cancel();
  return result;
}

export async function pollGuestOrderReceipt({ fetchReceipt, proof, signal, onReceipt }) {
  if (!proof || signal?.aborted) return null;

  const deadline = Date.now() + RETURN_POLL_TIMEOUT_MS;
  let latestReceipt = null;
  let firstAttempt = true;

  while (!signal?.aborted) {
    if (!firstAttempt) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) return latestReceipt;

      const shouldContinue = await waitForNextPoll(
        Math.min(RETURN_POLL_INTERVAL_MS, remaining),
        signal,
      );
      if (!shouldContinue || signal?.aborted) return null;
    }
    firstAttempt = false;

    const result = await fetchReceiptBeforeDeadline({ fetchReceipt, proof, signal, deadline });
    if (result.type === 'aborted') return null;
    if (result.type === 'deadline') return latestReceipt;
    if (signal?.aborted) return null;

    if (result.type === 'receipt' && result.receipt) {
      latestReceipt = result.receipt;
      if (signal?.aborted) return null;
      onReceipt?.(result.receipt);
      if (result.receipt.payment_status === 'paid') return result.receipt;
    }
  }

  return null;
}
