/**
 * سكربت مساعد لتسجيل عنوان البوت كـ Webhook داخل Evolution API.
 *
 * الاستخدام:
 *   node src/utils/setupWebhook.js https://my-bot-url.com/webhook
 *
 * يقوم بضبط Evolution API ليُرسل أحداث الرسائل إلى البوت.
 */
import axios from 'axios';
import config from '../config/index.js';
import logger from './logger.js';

async function setupWebhook(webhookUrl) {
  if (!webhookUrl) {
    logger.error('الرجاء تمرير عنوان الـ webhook كوسيط. مثال:');
    logger.error('  node src/utils/setupWebhook.js https://your-bot.com/webhook');
    process.exit(1);
  }

  const http = axios.create({
    baseURL: config.evolution.url,
    headers: { 'Content-Type': 'application/json', apikey: config.evolution.apiKey },
    timeout: 15000,
  });

  const payload = {
    webhook: {
      enabled: true,
      url: webhookUrl,
      byEvents: false,
      base64: false,
      events: ['MESSAGES_UPSERT'],
    },
  };

  try {
    logger.info(`تسجيل الـ webhook للـ instance "${config.evolution.instance}"...`);
    const { data } = await http.post(
      `/webhook/set/${config.evolution.instance}`,
      payload
    );
    logger.success('تم تسجيل الـ webhook بنجاح ✅');
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    logger.error('فشل تسجيل الـ webhook:', err.response?.data || err.message);
    process.exit(1);
  }
}

setupWebhook(process.argv[2]);
