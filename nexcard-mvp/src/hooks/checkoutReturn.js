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

export async function pollGuestOrderReceipt({ fetchReceipt, proof, signal, onReceipt }) {
  if (!proof || signal?.aborted) return null;

  const deadline = Date.now() + RETURN_POLL_TIMEOUT_MS;
  let latestReceipt = null;
  let firstAttempt = true;

  while (!signal?.aborted) {
    if (!firstAttempt) {
      const remaining = deadline - Date.now();
      if (remaining < 0) return latestReceipt;

      const shouldContinue = await waitForNextPoll(
        Math.min(RETURN_POLL_INTERVAL_MS, remaining),
        signal,
      );
      if (!shouldContinue || signal?.aborted) return null;
    }
    firstAttempt = false;

    try {
      const receipt = await fetchReceipt(proof);
      if (signal?.aborted) return null;

      if (receipt) {
        latestReceipt = receipt;
        onReceipt?.(receipt);
        if (receipt.payment_status === 'paid') return receipt;
      }
    } catch {
      // The return path intentionally exposes no backend error details.
    }

    if (Date.now() >= deadline) return latestReceipt;
  }

  return null;
}
