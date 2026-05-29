import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// تحميل ملف البيئة من جذر مشروع البوت (لا يطغى على متغيرات النظام الموجودة)
dotenv.config({ path: join(__dirname, '../../.env') });

// إذا كنا نستخدم بروكسي GenSpark LLM، فالنموذج الافتراضي gpt-4o-mini غير مدعوم.
// نستبدله تلقائياً بنموذج مدعوم ما لم يحدد المستخدم نموذجاً صراحةً عبر .env.
const usingGensparkProxy = (process.env.OPENAI_BASE_URL || '').includes('genspark.ai');
const userSetModel = process.env.OPENAI_MODEL && process.env.OPENAI_MODEL !== 'gpt-4o-mini';
const resolvedModel = userSetModel
  ? process.env.OPENAI_MODEL
  : usingGensparkProxy
    ? 'gpt-5-mini'
    : process.env.OPENAI_MODEL || 'gpt-4o-mini';

/**
 * إعدادات البوت المركزية.
 * تُقرأ من متغيرات البيئة مع قيم افتراضية آمنة.
 */
export const config = {
  // خادم البوت
  port: parseInt(process.env.PORT || '3001', 10),
  webhookPath: process.env.WEBHOOK_PATH || '/webhook',

  // الاتصال بـ Evolution API
  evolution: {
    url: (process.env.EVOLUTION_API_URL || 'http://localhost:8080').replace(/\/$/, ''),
    apiKey: process.env.EVOLUTION_API_KEY || '',
    instance: process.env.EVOLUTION_INSTANCE || 'mybot',
  },

  // الذكاء الاصطناعي
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: resolvedModel,
    baseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    get enabled() {
      return Boolean(this.apiKey);
    },
  },

  // إعدادات عامة
  businessName: process.env.BUSINESS_NAME || 'متجر إيفُليوشن',
  defaultLang: process.env.DEFAULT_LANG || 'ar',
  simulationMode: String(process.env.SIMULATION_MODE).toLowerCase() === 'true',
};

export default config;
