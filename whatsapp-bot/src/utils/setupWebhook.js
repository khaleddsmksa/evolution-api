/**
 * سكربت مساعد لتسجيل عنوان البوت كـ Webhook داخل Evolution API.
 *
 * الاستخدام:
 *   node src/utils/setupWebhook.js http://my-bot-url:3001/webhook
 *   npm run setup-webhook -- http://host.docker.internal:3001/webhook
 *
 * يقوم بضبط Evolution API ليُرسل أحداث الرسائل إلى البوت،
 * مع التحقق من صحة الاتصال وإعطاء تلميحات عند المشاكل.
 */
import axios from 'axios';
import config from '../config/index.js';
import logger from './logger.js';

async function setupWebhook(webhookUrl) {
  if (!webhookUrl) {
    logger.error('الرجاء تمرير عنوان الـ webhook كوسيط. أمثلة:');
    logger.error('  • على نفس الجهاز (Evolution خارج Docker):');
    logger.error('      npm run setup-webhook -- http://localhost:3001/webhook');
    logger.error('  • Evolution داخل Docker والبوت على المضيف (Mac/Windows):');
    logger.error('      npm run setup-webhook -- http://host.docker.internal:3001/webhook');
    logger.error('  • عنوان عام (ngrok/خادم):');
    logger.error('      npm run setup-webhook -- https://your-domain.com/webhook');
    process.exit(1);
  }

  // تحذير من الخطأ الشائع: استخدام localhost بينما Evolution داخل Docker
  if (/localhost|127\.0\.0\.1/.test(webhookUrl) && config.evolution.url.includes('localhost')) {
    logger.warn('⚠️ تنبيه: إذا كان Evolution يعمل داخل Docker، فإن "localhost" داخل الحاوية');
    logger.warn('   يشير إلى الحاوية نفسها وليس البوت! استخدم بدلاً منه:');
    logger.warn('   • Mac/Windows: http://host.docker.internal:3001/webhook');
    logger.warn('   • Linux: http://172.17.0.1:3001/webhook (أو IP المضيف)');
    logger.warn('   • أو شغّل البوت داخل نفس شبكة Docker واستخدم اسم الخدمة.\n');
  }

  const http = axios.create({
    baseURL: config.evolution.url,
    headers: { 'Content-Type': 'application/json', apikey: config.evolution.apiKey },
    timeout: 15000,
  });

  // 1) التحقق من الوصول لخادم Evolution
  try {
    await http.get(`/instance/connectionState/${config.evolution.instance}`);
  } catch (err) {
    const status = err.response?.status;
    if (status === 401 || status === 403) {
      logger.error('❌ فشل المصادقة مع Evolution API. تحقق من EVOLUTION_API_KEY في .env');
    } else if (err.code === 'ECONNREFUSED') {
      logger.error(`❌ تعذّر الاتصال بـ Evolution API على ${config.evolution.url}`);
      logger.error('   تأكد أن الخادم يعمل وأن EVOLUTION_API_URL صحيح في .env');
    } else if (status === 404) {
      logger.error(`❌ الجلسة "${config.evolution.instance}" غير موجودة.`);
      logger.error('   أنشئها أولاً: npm run connect');
    } else {
      logger.error('❌ خطأ في الوصول لـ Evolution:', err.response?.data || err.message);
    }
    process.exit(1);
  }

  // 2) تسجيل الـ webhook (مع دعم اختلاف صيغ الإصدارات)
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
    logger.info(`تسجيل الـ webhook للجلسة "${config.evolution.instance}"...`);
    logger.info(`العنوان: ${webhookUrl}`);
    const { data } = await http.post(
      `/webhook/set/${config.evolution.instance}`,
      payload
    );
    logger.success('تم تسجيل الـ webhook بنجاح ✅');
    console.log(JSON.stringify(data, null, 2));
    logger.info('\nالآن أرسل رسالة واتساب للرقم المتصل — يجب أن يرد البوت.');
    logger.info('راقب سجلات البوت لرؤية الرسائل الواردة.');
  } catch (err) {
    // بعض الإصدارات تستخدم صيغة مسطّحة بدون مفتاح "webhook"
    if (err.response?.status === 400 || err.response?.status === 404) {
      logger.warn('تعذّرت الصيغة القياسية، محاولة الصيغة البديلة...');
      try {
        const { data } = await http.post(
          `/webhook/set/${config.evolution.instance}`,
          { enabled: true, url: webhookUrl, events: ['MESSAGES_UPSERT'] }
        );
        logger.success('تم تسجيل الـ webhook بنجاح (صيغة بديلة) ✅');
        console.log(JSON.stringify(data, null, 2));
        return;
      } catch (err2) {
        logger.error('فشل تسجيل الـ webhook:', err2.response?.data || err2.message);
        process.exit(1);
      }
    }
    logger.error('فشل تسجيل الـ webhook:', err.response?.data || err.message);
    process.exit(1);
  }
}

setupWebhook(process.argv[2]);
