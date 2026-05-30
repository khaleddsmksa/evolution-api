import axios from 'axios';
import config from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * عميل للتواصل مع Evolution API.
 * يغلّف نقاط النهاية (endpoints) الخاصة بإرسال الرسائل وإدارة الـ instance.
 *
 * في وضع المحاكاة (SIMULATION_MODE=true) لا يُرسل أي طلب حقيقي،
 * بل يطبع الرسائل في الـ console لتسهيل الاختبار محلياً بدون خادم.
 */
class EvolutionClient {
  constructor() {
    this.instance = config.evolution.instance;
    this.simulation = config.simulationMode;

    this.http = axios.create({
      baseURL: config.evolution.url,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        apikey: config.evolution.apiKey,
      },
    });

    // سجل بسيط للرسائل المُرسلة (يُستخدم في وضع المحاكاة + لوحة التحكم)
    this.sentLog = [];
  }

  _logSent(entry) {
    const record = { ...entry, at: new Date().toISOString() };
    this.sentLog.unshift(record);
    if (this.sentLog.length > 200) this.sentLog.pop();
    return record;
  }

  /**
   * إرسال رسالة نصية.
   * @param {string} number رقم المستلم بصيغة JID أو رقم دولي (بدون +)
   * @param {string} text نص الرسالة
   * @param {object} [options] خيارات إضافية (delay, quoted ...)
   */
  async sendText(number, text, options = {}) {
    const recipient = this._normalizeNumber(number);
    const payload = {
      number: recipient,
      text,
      delay: options.delay ?? 600,
      ...(options.quoted ? { quoted: options.quoted } : {}),
    };

    if (this.simulation) {
      logger.info(`🤖 [محاكاة] → ${recipient}:`);
      console.log('   ' + text.split('\n').join('\n   '));
      return this._logSent({ type: 'text', to: recipient, text, simulated: true });
    }

    try {
      const { data } = await this.http.post(
        `/message/sendText/${this.instance}`,
        payload
      );
      this._logSent({ type: 'text', to: recipient, text });
      logger.success(`أُرسلت رسالة إلى ${recipient}`);
      return data;
    } catch (err) {
      this._handleError('sendText', err);
      throw err;
    }
  }

  /**
   * إرسال قائمة من الأزرار (button message).
   * @param {string} number الرقم
   * @param {string} title العنوان
   * @param {string} description الوصف
   * @param {Array<{id:string,title:string}>} buttons الأزرار
   */
  async sendButtons(number, title, description, buttons = []) {
    const recipient = this._normalizeNumber(number);
    const payload = {
      number: recipient,
      title,
      description,
      footer: config.businessName,
      buttons: buttons.map((b) => ({
        type: 'reply',
        displayText: b.title,
        id: b.id,
      })),
    };

    if (this.simulation) {
      logger.info(`🤖 [محاكاة - أزرار] → ${recipient}:`);
      console.log(`   ${title}\n   ${description}`);
      buttons.forEach((b) => console.log(`   [${b.id}] ${b.title}`));
      return this._logSent({ type: 'buttons', to: recipient, title, buttons, simulated: true });
    }

    try {
      const { data } = await this.http.post(
        `/message/sendButtons/${this.instance}`,
        payload
      );
      this._logSent({ type: 'buttons', to: recipient, title, buttons });
      return data;
    } catch (err) {
      // إذا فشلت الأزرار (غير مدعومة في بعض الإصدارات) نرجع للنص
      logger.warn('فشل إرسال الأزرار، التحويل إلى رسالة نصية.');
      const fallback = `*${title}*\n${description}\n\n${buttons
        .map((b, i) => `${i + 1}. ${b.title}`)
        .join('\n')}`;
      return this.sendText(number, fallback);
    }
  }

  /**
   * إرسال وسائط (صورة/فيديو/مستند) عبر رابط.
   */
  async sendMedia(number, { mediatype, url, caption, fileName }) {
    const recipient = this._normalizeNumber(number);
    const payload = {
      number: recipient,
      mediatype: mediatype || 'image',
      media: url,
      caption: caption || '',
      ...(fileName ? { fileName } : {}),
    };

    if (this.simulation) {
      logger.info(`🤖 [محاكاة - وسائط] → ${recipient}: ${url}`);
      return this._logSent({ type: 'media', to: recipient, url, simulated: true });
    }

    try {
      const { data } = await this.http.post(
        `/message/sendMedia/${this.instance}`,
        payload
      );
      this._logSent({ type: 'media', to: recipient, url });
      return data;
    } catch (err) {
      this._handleError('sendMedia', err);
      throw err;
    }
  }

  /**
   * إرسال مؤشر "يكتب الآن..." (presence).
   */
  async sendTyping(number, durationMs = 1500) {
    if (this.simulation) return;
    try {
      await this.http.post(`/chat/sendPresence/${this.instance}`, {
        number: this._normalizeNumber(number),
        presence: 'composing',
        delay: durationMs,
      });
    } catch {
      // مؤشر الكتابة ليس حرجاً، نتجاهل أي خطأ
    }
  }

  /**
   * التحقق من حالة الاتصال بالـ instance.
   */
  async getConnectionState() {
    if (this.simulation) {
      return { instance: this.instance, state: 'simulation' };
    }
    try {
      const { data } = await this.http.get(
        `/instance/connectionState/${this.instance}`
      );
      return data;
    } catch (err) {
      this._handleError('connectionState', err);
      return { instance: this.instance, state: 'error', error: err.message };
    }
  }

  /**
   * تطبيع الرقم: يقبل JID كامل أو رقم بسيط.
   */
  _normalizeNumber(number) {
    if (!number) return number;
    // إزالة لاحقة الـ JID للحصول على الرقم النظيف
    return String(number).replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '');
  }

  _handleError(method, err) {
    const status = err.response?.status;
    const body = err.response?.data;
    logger.error(
      `خطأ في ${method}: ${err.message}`,
      status ? `(HTTP ${status})` : '',
      body ? JSON.stringify(body) : ''
    );
  }
}

export const evolutionClient = new EvolutionClient();
export default evolutionClient;
