import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import config from './config/index.js';
import logger from './utils/logger.js';
import webhookHandler, { normalizeEvent } from './handlers/webhookHandler.js';
import botEngine from './core/botEngine.js';
import sessionStore from './core/sessionStore.js';
import evolutionClient from './services/evolutionClient.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ملفات لوحة التحكم الثابتة
app.use(express.static(join(__dirname, '../public')));

// ── نقطة استقبال الـ Webhook من Evolution API ──
app.post(config.webhookPath, webhookHandler);
// Evolution قد يضيف اسم الحدث للمسار (مثل /webhook/messages-upsert)
app.post(`${config.webhookPath}/*`, webhookHandler);

// ── فحص الصحة ──
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    simulation: config.simulationMode,
    aiEnabled: config.openai.enabled,
    instance: config.evolution.instance,
    uptime: process.uptime(),
  });
});

// ── حالة الاتصال بـ Evolution ──
app.get('/api/connection', async (req, res) => {
  const state = await evolutionClient.getConnectionState();
  res.json(state);
});

// ── إحصائيات الجلسات (للوحة التحكم) ──
app.get('/api/stats', (req, res) => {
  res.json({
    sessions: sessionStore.stats(),
    sentMessages: evolutionClient.sentLog.slice(0, 50),
  });
});

// ── نقطة اختبار: محاكاة رسالة واردة دون واتساب حقيقي ──
// POST /api/test  { "from": "966500000000", "text": "مرحبا", "pushName": "أحمد" }
app.post('/api/test', async (req, res) => {
  const { from, text, pushName } = req.body || {};
  if (!from || !text) {
    return res.status(400).json({ error: 'الحقول from و text مطلوبة' });
  }
  await botEngine.handle({ from, text, pushName });
  res.json({
    ok: true,
    repliesSent: evolutionClient.sentLog.filter((m) => m.to === String(from)).slice(0, 5),
  });
});

// ── إرسال رسالة يدوياً (للاختبار/الدعم) ──
app.post('/api/send', async (req, res) => {
  const { number, text } = req.body || {};
  if (!number || !text) {
    return res.status(400).json({ error: 'الحقول number و text مطلوبة' });
  }
  try {
    const result = await evolutionClient.sendText(number, text);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── بدء التشغيل ──
const server = app.listen(config.port, '0.0.0.0', () => {
  logger.success(`🚀 بوت واتساب يعمل على المنفذ ${config.port}`);
  logger.info(`   • Webhook:  POST  ${config.webhookPath}`);
  logger.info(`   • الصحة:    GET   /health`);
  logger.info(`   • لوحة التحكم: GET /`);
  logger.info(`   • وضع المحاكاة: ${config.simulationMode ? 'مُفعّل ✅' : 'معطّل'}`);
  logger.info(`   • الذكاء الاصطناعي: ${config.openai.enabled ? 'مُفعّل ✅' : 'معطّل'}`);
  logger.info(`   • Evolution Instance: ${config.evolution.instance}`);
});

// معالجة أخطاء الخادم (مثل المنفذ المشغول)
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`المنفذ ${config.port} مستخدم بالفعل. غيّر PORT في .env أو أوقف العملية الأخرى.`);
  } else {
    logger.error('خطأ في الخادم:', err.message);
  }
  process.exit(1);
});

// منع تعطّل العملية بسبب استثناءات غير معالجة
process.on('unhandledRejection', (reason) => {
  logger.error('وعد مرفوض غير معالج:', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  logger.error('استثناء غير ملتقط:', err.message);
});

// إغلاق نظيف
process.on('SIGINT', () => {
  logger.info('إيقاف البوت...');
  server.close(() => process.exit(0));
});

export default app;
