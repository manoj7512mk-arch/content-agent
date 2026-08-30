/**
 * telegram.js
 *
 * Tiny shared helper for sending messages via the Telegram Bot API.
 * Uses plain text (no parse_mode) deliberately — AI-generated content can
 * contain characters that break Telegram's HTML/Markdown parsing, and a
 * failed send is worse than slightly-less-pretty formatting.
 */

async function sendTelegramMessage({ botToken, chatId, text }) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  // Telegram's hard limit is 4096 chars per message.
  const safeText = text.length > 4000 ? text.slice(0, 3980) + '\n\n...(truncated)' : text;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: safeText,
      disable_web_page_preview: true,
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API error: ${JSON.stringify(data)}`);
  }
  return data;
}

module.exports = { sendTelegramMessage };
