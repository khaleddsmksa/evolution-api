/**
 * سكربت مساعد لربط رقم واتساب جديد عبر Evolution API.
 *
 * يقوم بـ:
 *   1) إنشاء الجلسة (instance) إن لم تكن موجودة.
 *   2) جلب رمز QR وعرضه في الطرفية (terminal) لمسحه.
 *   3) متابعة حالة الاتصال حتى يكتمل الربط.
 *
 * الاستخدام:
 *   node src/utils/connectNumber.js
 *   (يستخدم EVOLUTION_INSTANCE من ملف .env)
 *
 * أو بتحديد اسم جلسة مختلف:
 *   node src/utils/connectNumber.js myNewInstance
 */
import axios from 'axios';
import config from '../config/index.js';
import logger from './logger.js';

const instanceName = process.argv[2] || config.evolution.instance;

const http = axios.create({
  baseURL: config.evolution.url,
  headers: { 'Content-Type': 'application/json', apikey: config.evolution.apiKey },
  timeout: 20000,
});

/** طباعة رمز QR كصورة ASCII في الطرفية إن أمكن، وإلا طباعة الرابط/النص. */
async function printQr(qr) {
  // qr قد يكون نصاً خاماً (code) أو data:image/png;base64
  const code = qr?.code || qr?.pairingCode || (typeof qr === 'string' ? qr : null);
  if (code && !code.startsWith('data:image')) {
    try {
      const { default: qrcode } = await import('qrcode-terminal').catch(() => ({}));
      if (qrcode) {
        qrcode.generate(code, { small: true });
        return;
      }
    } catch {
      // المكتبة غير مثبّتة — نطبع النص
    }
    logger.info('امسح رمز QR التالي (نص خام):');
    console.log(code);
  } else if (qr?.base64 || (typeof code === 'string' && code.startsWith('data:image'))) {
    logger.info('تم استلام رمز QR كصورة base64.');
    logger.info('افتح لوحة Evolution Manager لرؤيته بصرياً:');
    logger.info(`  ${config.evolution.url}/manager`);
  } else {
    logger.warn('لم يُستلم رمز QR. قد تكون الجلسة متصلة بالفعل.');
  }
}

async function createInstance() {
  try {
    logger.info(`إنشاء الجلسة "${instanceName}"...`);
    const { data } = await http.post('/instance/create', {
      instanceName,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
    });
    logger.success('تم إنشاء الجلسة.');
    return data;
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    // إذا كانت الجلسة موجودة مسبقاً نكمل بدون توقف
    if (err.response?.status === 403 || /already in use|exists/i.test(JSON.stringify(msg))) {
      logger.warn('الجلسة موجودة مسبقاً، سيتم محاولة الاتصال بها.');
      return null;
    }
    logger.error('فشل إنشاء الجلسة:', msg);
    process.exit(1);
  }
}

async function connect() {
  try {
    const { data } = await http.get(`/instance/connect/${instanceName}`);
    return data;
  } catch (err) {
    logger.error('فشل جلب رمز QR:', err.response?.data || err.message);
    return null;
  }
}

async function checkState() {
  try {
    const { data } = await http.get(`/instance/connectionState/${instanceName}`);
    return data?.instance?.state || data?.state || 'unknown';
  } catch {
    return 'unknown';
  }
}

async function main() {
  logger.info(`خادم Evolution: ${config.evolution.url}`);
  logger.info(`الجلسة المستهدفة: ${instanceName}`);

  // 1) التحقق من الحالة الحالية
  let state = await checkState();
  if (state === 'open') {
    logger.success(`الرقم متصل بالفعل بالجلسة "${instanceName}" ✅`);
    return;
  }

  // 2) إنشاء الجلسة + جلب QR
  const created = await createInstance();
  const qr = created?.qrcode || (await connect())?.qrcode || (await connect())?.base64;
  await printQr(qr || created?.qrcode);

  logger.info('\n📲 افتح واتساب ← الإعدادات ← الأجهزة المرتبطة ← ربط جهاز، ثم امسح الرمز.');
  logger.info('في انتظار الاتصال... (سيتم الفحص كل 3 ثوانٍ)\n');

  // 3) متابعة الاتصال
  const maxTries = 40; // ~ دقيقتان
  for (let i = 0; i < maxTries; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    state = await checkState();
    if (state === 'open') {
      logger.success(`\n🎉 تم ربط الرقم بنجاح بالجلسة "${instanceName}"!`);
      logger.info('لا تنسَ ضبط الـ webhook: node src/utils/setupWebhook.js <عنوان-البوت>/webhook');
      return;
    }
    process.stdout.write(`   الحالة: ${state} (${i + 1}/${maxTries})\r`);
  }
  logger.warn('\nانتهت المهلة دون اكتمال الاتصال. حاول مرة أخرى أو استخدم لوحة Manager.');
}

main().catch((err) => {
  logger.error('خطأ غير متوقع:', err.message);
  process.exit(1);
});
