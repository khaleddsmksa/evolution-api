import evolutionClient from '../services/evolutionClient.js';
import aiService from '../services/aiService.js';
import sessionStore from './sessionStore.js';
import { messages, mainMenuButtons } from './messages.js';
import logger from '../utils/logger.js';

/**
 * محرّك البوت: يحدد الرد المناسب بناءً على حالة المستخدم ونص رسالته.
 *
 * آلة الحالات (State Machine):
 *   new        → أول رسالة، نرحّب ونعرض القائمة
 *   menu       → ينتظر اختيار رقم من القائمة
 *   ai_chat    → محادثة مفتوحة مع الـ AI
 *   support    → ترك رسالة لموظف الدعم
 */
class BotEngine {
  /**
   * المعالجة الرئيسية للرسالة الواردة.
   * @param {object} msg رسالة موحّدة { from, text, pushName }
   */
  async handle(msg) {
    const { from, text, pushName } = msg;
    if (!from) return;

    const session = sessionStore.get(from);
    if (pushName && !session.name) sessionStore.setName(from, pushName);

    const body = (text || '').trim();
    sessionStore.addMessage(from, 'user', body);

    logger.info(`📩 رسالة من ${session.name || from} [${session.state}]: ${body}`);

    // أمر عام: الرجوع للقائمة في أي حالة
    if (body === '0' || /^(القائمة|menu|رجوع|back)$/i.test(body)) {
      return this._showMenu(from, session.state === 'new');
    }

    // التوجيه حسب الحالة
    switch (session.state) {
      case 'new':
        return this._showMenu(from, true);

      case 'menu':
        return this._handleMenuChoice(from, body);

      case 'ai_chat':
        return this._handleAiChat(from, body);

      case 'support':
        return this._handleSupport(from, body);

      default:
        return this._showMenu(from, false);
    }
  }

  /** عرض القائمة الرئيسية */
  async _showMenu(from, isWelcome) {
    const session = sessionStore.get(from);
    sessionStore.setState(from, 'menu');

    if (isWelcome) {
      const welcome = messages.welcome(session.name);
      await this._reply(from, welcome);
    }

    // محاولة إرسال أزرار، مع رجوع تلقائي للنص داخل العميل
    await evolutionClient.sendButtons(
      from,
      'القائمة الرئيسية',
      messages.mainMenu,
      mainMenuButtons
    );
    sessionStore.addMessage(from, 'assistant', messages.mainMenu);
  }

  /** معالجة اختيار من القائمة */
  async _handleMenuChoice(from, body) {
    const choice = this._extractChoice(body);

    switch (choice) {
      case '1':
        return this._reply(from, messages.about);
      case '2':
        return this._reply(from, messages.products);
      case '3':
        return this._reply(from, messages.hours);
      case '4':
        sessionStore.setState(from, 'ai_chat');
        return this._reply(from, messages.aiStart);
      case '5':
        sessionStore.setState(from, 'support');
        return this._reply(from, messages.supportStart);
      default:
        return this._reply(from, messages.invalidOption);
    }
  }

  /** محادثة الـ AI */
  async _handleAiChat(from, body) {
    const session = sessionStore.get(from);
    await evolutionClient.sendTyping(from, 2000);
    const answer = await aiService.reply(session.history);
    return this._reply(from, answer);
  }

  /** وضع الدعم: نستلم الرسالة ونؤكد */
  async _handleSupport(from, body) {
    logger.warn(`🎫 تذكرة دعم جديدة من ${from}: ${body}`);
    // هنا يمكن لاحقاً: إرسال إشعار لموظف، فتح تذكرة في CRM، إلخ.
    return this._reply(from, messages.supportReceived);
  }

  /**
   * استخراج رقم الخيار من النص (يدعم الأرقام العربية والأزرار).
   */
  _extractChoice(body) {
    // تحويل الأرقام العربية إلى إنجليزية
    const normalized = body.replace(/[٠-٩]/g, (d) =>
      String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    );
    const match = normalized.match(/[1-5]/);
    if (match) return match[0];

    // مطابقة نصية لعناوين الأزرار
    if (/معلومات|عن/i.test(body)) return '1';
    if (/منتج|سعر|أسعار/i.test(body)) return '2';
    if (/ساعات|موقع|عنوان/i.test(body)) return '3';
    if (/ذكي|مساعد|ai/i.test(body)) return '4';
    if (/دعم|موظف|تواصل/i.test(body)) return '5';
    return null;
  }

  /** إرسال رد وتسجيله في السجل */
  async _reply(from, text) {
    sessionStore.addMessage(from, 'assistant', text);
    return evolutionClient.sendText(from, text);
  }
}

export const botEngine = new BotEngine();
export default botEngine;
