// Shared timeout wrapper for outbound HTTP calls from edge functions (couriers, Resend,
// internal function-to-function calls). Without this, a slow/hanging external service
// can stall a function until the platform's own duration limit — this bounds it
// explicitly and always releases the timer, following the same AbortController pattern
// already used correctly in alertTelegram.ts.
export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}
