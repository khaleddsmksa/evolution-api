import axios from 'axios';
import config from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * خدمة الذكاء الاصطناعي للرد على الأسئلة الحرة.
 * تستخدم OpenAI (أو أي خادم متوافق عبر OPENAI_BASE_URL).
 */
class AIService {
  constructor() {
    this.enabled = config.openai.enabled;
    this.http = axios.create({
      baseURL: config.openai.baseUrl,
      timeout: 45000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.openai.apiKey}`,
      },
    });
  }

  get systemPrompt() {
    return [
      `أنت مساعد خدمة عملاء ذكي ولطيف لـ "${config.businessName}".`,
      'أجب بإيجاز ووضوح وباللغة العربية ما لم يكتب العميل بلغة أخرى.',
      'كن مهذباً ومتعاوناً. إذا لم تعرف إجابة سؤال، اقترح على العميل التواصل مع الدعم البشري.',
      'لا تختلق معلومات عن أسعار أو منتجات لا تعرفها.',
      'حافظ على ردود قصيرة مناسبة للرسائل الفورية (واتساب).',
    ].join(' ');
  }

  /**
   * توليد رد بناءً على سجل المحادثة.
   * @param {Array<{role:string,content:string}>} history
   * @returns {Promise<string>}
   */
  async reply(history = []) {
    if (!this.enabled) {
      return 'عذراً، خدمة الردود الذكية غير مفعّلة حالياً. اكتب "0" للعودة إلى القائمة الرئيسية.';
    }

    const messages = [
      { role: 'system', content: this.systemPrompt },
      ...history
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content })),
    ];

    try {
      const { data } = await this.http.post('/chat/completions', {
        model: config.openai.model,
        messages,
        temperature: 0.6,
        max_tokens: 500,
      });
      const text = data?.choices?.[0]?.message?.content?.trim();
      return text || 'لم أتمكن من توليد رد. حاول مرة أخرى.';
    } catch (err) {
      logger.error('خطأ في خدمة الـ AI:', err.response?.data?.error?.message || err.message);
      return 'حدث خطأ أثناء معالجة طلبك. يمكنك المحاولة لاحقاً أو كتابة "0" للعودة للقائمة.';
    }
  }
}

export const aiService = new AIService();
export default aiService;
