// Friday talks to Troy via a Telegram bot instead of email. Uses the raw
// Telegram Bot API over fetch - no extra SDK dependency needed.

const TELEGRAM_API = 'https://api.telegram.org';

function apiUrl(method) {
  return `${TELEGRAM_API}/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;
}

/**
 * Sends a message to Troy's chat with the bot. Telegram has a ~4096
 * character limit per message, so long updates get split automatically.
 */
async function sendMessage(text) {
  const chunks = splitMessage(text, 4000);

  for (const chunk of chunks) {
    const res = await fetch(apiUrl('sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: chunk,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Telegram sendMessage failed: ${res.status} ${errBody}`);
    }
  }
}

function splitMessage(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    chunks.push(remaining.slice(0, maxLen));
    remaining = remaining.slice(maxLen);
  }
  if (remaining.length) chunks.push(remaining);
  return chunks;
}

module.exports = { sendMessage };
