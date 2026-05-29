/**
 * اختبارات بسيطة لمحرّك البوت (بدون اعتماديات خارجية).
 * تعمل في وضع المحاكاة لتجنّب الاتصال بخادم حقيقي.
 */
import assert from 'assert';

// ضبط وضع المحاكاة قبل تحميل أي وحدة تعتمد على الإعدادات.
process.env.SIMULATION_MODE = 'true';

// استيراد ديناميكي لضمان قراءة الإعدادات بعد ضبط متغير البيئة أعلاه.
const { normalizeEvent } = await import('../src/handlers/webhookHandler.js');
const { default: botEngine } = await import('../src/core/botEngine.js');
const { default: evolutionClient } = await import('../src/services/evolutionClient.js');
const { default: sessionStore } = await import('../src/core/sessionStore.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`  ✅ ${name}`);
      passed++;
    })
    .catch((err) => {
      console.log(`  ❌ ${name}\n     ${err.message}`);
      failed++;
    });
}

function lastReplyTo(number) {
  return evolutionClient.sentLog.find((m) => m.to === number);
}

(async () => {
  console.log('\n🧪 تشغيل اختبارات البوت...\n');

  // 1) تطبيع حدث الـ webhook
  await test('normalizeEvent يستخرج رسالة نصية واردة', () => {
    const event = {
      event: 'messages.upsert',
      data: {
        key: { remoteJid: '966500000000@s.whatsapp.net', fromMe: false, id: 'X1' },
        pushName: 'أحمد',
        message: { conversation: 'مرحبا' },
      },
    };
    const msg = normalizeEvent(event);
    assert.strictEqual(msg.text, 'مرحبا');
    assert.strictEqual(msg.pushName, 'أحمد');
    assert.ok(msg.from.includes('966500000000'));
  });

  // 2) تجاهل الرسائل الصادرة منّا
  await test('normalizeEvent يتجاهل رسائل fromMe', () => {
    const msg = normalizeEvent({
      data: { key: { remoteJid: 'x@s.whatsapp.net', fromMe: true }, message: { conversation: 'hi' } },
    });
    assert.strictEqual(msg, null);
  });

  // 3) تجاهل رسائل المجموعات
  await test('normalizeEvent يتجاهل المجموعات', () => {
    const msg = normalizeEvent({
      data: { key: { remoteJid: '123@g.us', fromMe: false }, message: { conversation: 'hi' } },
    });
    assert.strictEqual(msg, null);
  });

  // 4) الترحيب عند أول رسالة
  await test('البوت يرحّب ويعرض القائمة عند أول رسالة', async () => {
    const user = '111@s.whatsapp.net';
    await botEngine.handle({ from: user, text: 'السلام عليكم', pushName: 'سارة' });
    const replies = evolutionClient.sentLog.filter((m) => m.to === '111');
    assert.ok(replies.length >= 1, 'يجب إرسال رد واحد على الأقل');
    assert.strictEqual(sessionStore.get(user).state, 'menu');
  });

  // 5) اختيار "معلومات عنّا"
  await test('اختيار 1 يعرض معلومات عنّا', async () => {
    const user = '222@s.whatsapp.net';
    await botEngine.handle({ from: user, text: 'مرحبا' });
    await botEngine.handle({ from: user, text: '1' });
    const reply = lastReplyTo('222');
    assert.ok(reply.text.includes('من نحن'));
  });

  // 6) الدخول لوضع الـ AI
  await test('اختيار 4 يحوّل لوضع المساعد الذكي', async () => {
    const user = '333@s.whatsapp.net';
    await botEngine.handle({ from: user, text: 'مرحبا' });
    await botEngine.handle({ from: user, text: '4' });
    assert.strictEqual(sessionStore.get(user).state, 'ai_chat');
  });

  // 7) الرجوع للقائمة بـ 0
  await test('كتابة 0 ترجع للقائمة الرئيسية', async () => {
    const user = '444@s.whatsapp.net';
    await botEngine.handle({ from: user, text: 'مرحبا' });
    await botEngine.handle({ from: user, text: '4' });
    await botEngine.handle({ from: user, text: '0' });
    assert.strictEqual(sessionStore.get(user).state, 'menu');
  });

  // 8) دعم الأرقام العربية
  await test('يدعم الأرقام العربية (٢ = المنتجات)', async () => {
    const user = '555@s.whatsapp.net';
    await botEngine.handle({ from: user, text: 'مرحبا' });
    await botEngine.handle({ from: user, text: '٢' });
    const reply = lastReplyTo('555');
    assert.ok(reply.text.includes('الأسعار') || reply.text.includes('المنتجات'));
  });

  console.log(`\n📋 النتيجة: ${passed} نجح / ${failed} فشل\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
