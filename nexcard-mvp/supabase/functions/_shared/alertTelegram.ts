// Alerta best-effort al mismo bot de Telegram ("NexCard watchdog") que ya usa
// el cron operativo. Nunca lanza — un fallo (o bug) acá no debe tumbar al caller.
const escapeHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

export async function alertTelegram(context: string, error: unknown) {
  try {
    const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const chatId = Deno.env.get('TELEGRAM_CHAT_ID');
    if (!token || !chatId) return;

    const err = error instanceof Error ? error : new Error(String(error));
    const errorType = err.name || 'Error';
    const message = err.message || String(error);
    const stackLines = (err.stack || '').split('\n').slice(1, 4).join('\n').trim();
    let timestamp: string;
    try {
      timestamp = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago', dateStyle: 'short', timeStyle: 'medium' });
    } catch {
      timestamp = new Date().toISOString();
    }

    const lines = [
      '🔥 <b>NexCard — error backend</b>',
      '',
      `📍 <b>Dónde:</b> ${escapeHtml(context)}`,
      `🕒 <b>Cuándo:</b> ${timestamp} (Chile)`,
      `⚠️ <b>Tipo:</b> ${escapeHtml(errorType)}`,
      `💬 <b>Mensaje:</b> <code>${escapeHtml(message.slice(0, 400))}</code>`,
    ];
    if (stackLines) {
      lines.push('', `<pre>${escapeHtml(stackLines.slice(0, 500))}</pre>`);
    }

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join('\n'),
        parse_mode: 'HTML',
      }),
    });
  } catch {
    // sin escalamiento adicional — este helper nunca debe propagar
  }
}
