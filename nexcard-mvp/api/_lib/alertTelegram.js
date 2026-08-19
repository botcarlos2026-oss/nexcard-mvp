// Alerta best-effort al mismo bot de Telegram ("NexCard watchdog") que ya usa
// el cron operativo. No lanza si falla el envío — nunca debe tapar el error original.
export async function alertTelegram(context, error) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const message = error instanceof Error ? error.message : String(error);

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🔥 *NexCard — error backend*\n\n*${context}*\n${message.slice(0, 500)}`,
        parse_mode: 'Markdown',
      }),
    });
  } catch {
    // sin escalamiento adicional
  }
}
