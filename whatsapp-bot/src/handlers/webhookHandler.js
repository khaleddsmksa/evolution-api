import botEngine from '../core/botEngine.js';
import logger from '../utils/logger.js';

/**
 * معالج الـ Webhook القادم من Evolution API.
 *
 * Evolution API يرسل أحداثاً متعددة (messages.upsert, connection.update ...).
 * نهتم أساساً بحدث "messages.upsert" لاستخراج الرسائل الواردة من المستخدمين.
 */

/**
 * استخراج نص الرسالة من بنية رسالة واتساب (Baileys / Cloud API).
 */
function extractText(message) {
  if (!message) return '';
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.buttonsResponseMessage?.selectedButtonId ||
    message.templateButtonReplyMessage?.selectedId ||
    message.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ''
  );
}

/**
 * تطبيع حدث الـ webhook إلى رسالة موحّدة أو null إن لم يكن رسالة صالحة.
 */
export function normalizeEvent(payload) {
  // Evolution قد يرسل البيانات داخل payload.data أو مباشرة
  const event = payload?.event || payload?.type;
  const data = payload?.data || payload;

  // نتعامل فقط مع أحداث الرسائل الواردة
  const isMessageEvent =
    !event || /messages?[._-]upsert/i.test(event) || data?.key;

  if (!isMessageEvent) return null;

  const key = data?.key || {};
  // تجاهل الرسائل الصادرة منّا نحن (fromMe)
  if (key.fromMe) return null;

  const remoteJid = key.remoteJid || data?.remoteJid;
  if (!remoteJid) return null;

  // تجاهل رسائل المجموعات والقوائم البثية (اختياري)
  if (remoteJid.endsWith('@g.us') || remoteJid.endsWith('@broadcast')) {
    return null;
  }

  const text = extractText(data?.message);
  if (!text) return null; // لا نتعامل مع الوسائط بدون نص حالياً

  return {
    from: remoteJid,
    text,
    pushName: data?.pushName || null,
    messageId: key.id || null,
    raw: data,
  };
}

/**
 * مُعالِج Express للـ webhook.
 */
export async function webhookHandler(req, res) {
  // نرد فوراً بـ 200 حتى لا يعيد Evolution الإرسال
  res.status(200).json({ received: true });

  try {
    const msg = normalizeEvent(req.body);
    if (!msg) {
      logger.debug('تم تجاهل حدث webhook غير ذي صلة.');
      return;
    }
    await botEngine.handle(msg);
  } catch (err) {
    logger.error('خطأ في معالجة الـ webhook:', err.message);
  }
}

export default webhookHandler;
