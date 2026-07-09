const logger = require('./logger');

async function sendTelegramMessage(text) {
  const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: 'HTML'
      })
    });
    
    if (!response.ok) {
      const data = await response.text();
      logger.error('telegram', `Lỗi gửi tin nhắn: ${response.status} ${data}`);
    }
  } catch (error) {
    logger.error('telegram', 'Lỗi kết nối Telegram API', error);
  }
}

module.exports = sendTelegramMessage;
