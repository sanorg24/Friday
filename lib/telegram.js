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

let lastUpdateId = 0;

/**
 * Polls Telegram for new messages sent to the bot since the last check.
 * Uses long-ish polling (short timeout) so it can run on a fast interval
 * without hammering Telegram's API. Advances lastUpdateId so already-seen
 * messages aren't reprocessed. Note: this offset resets on a redeploy/
 * restart, since it's only kept in memory - acceptable for v1, but means
 * a message sent in the few seconds around a restart could theoretically
 * be missed or (rarely) reprocessed.
 */
async function getNewMessages() {
  const res = await fetch(
    apiUrl('getUpdates') + `?offset=${lastUpdateId + 1}&timeout=5`
  );

  if (!res.ok) {
    throw new Error(`Telegram getUpdates failed: ${res.status}`);
  }

  const data = await res.json();
  const messages = [];

  for (const update of data.result || []) {
    lastUpdateId = Math.max(lastUpdateId, update.update_id);
    if (update.message && update.message.text) {
      messages.push(update.message.text);
    }
  }

  return messages;
}

module.exports = { sendMessage, getNewMessages };
