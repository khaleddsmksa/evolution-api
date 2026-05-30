import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import logger from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');
const SESSIONS_FILE = join(DATA_DIR, 'sessions.json');

/**
 * مخزن جلسات المستخدمين.
 * يحفظ لكل مستخدم: الحالة الحالية (state)، سجل المحادثة، وقت آخر نشاط.
 * يُخزَّن في ملف JSON للبساطة (يمكن استبداله لاحقاً بقاعدة بيانات).
 */
class SessionStore {
  constructor() {
    this.sessions = new Map();
    this._load();
    // حفظ دوري كل 30 ثانية
    this._timer = setInterval(() => this._persist(), 30000);
    if (this._timer.unref) this._timer.unref();
  }

  _load() {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      if (fs.existsSync(SESSIONS_FILE)) {
        const raw = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
        for (const [k, v] of Object.entries(raw)) this.sessions.set(k, v);
        logger.info(`تم تحميل ${this.sessions.size} جلسة محفوظة.`);
      }
    } catch (err) {
      logger.warn('تعذّر تحميل الجلسات المحفوظة:', err.message);
    }
  }

  _persist() {
    try {
      const obj = Object.fromEntries(this.sessions);
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(obj, null, 2));
    } catch (err) {
      logger.warn('تعذّر حفظ الجلسات:', err.message);
    }
  }

  /**
   * الحصول على جلسة مستخدم (أو إنشاؤها).
   */
  get(userId) {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, {
        userId,
        state: 'new', // new | menu | ai_chat | support | ...
        name: null,
        history: [], // [{ role, content, at }]
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        data: {},
      });
    }
    return this.sessions.get(userId);
  }

  /**
   * تحديث الحالة.
   */
  setState(userId, state) {
    const s = this.get(userId);
    s.state = state;
    s.lastActiveAt = new Date().toISOString();
  }

  /**
   * إضافة رسالة إلى سجل المحادثة (لاستخدامها مع الـ AI).
   */
  addMessage(userId, role, content) {
    const s = this.get(userId);
    s.history.push({ role, content, at: new Date().toISOString() });
    // الاحتفاظ بآخر 20 رسالة فقط لتوفير الذاكرة وتكلفة الـ AI
    if (s.history.length > 20) s.history = s.history.slice(-20);
    s.lastActiveAt = new Date().toISOString();
  }

  setName(userId, name) {
    this.get(userId).name = name;
  }

  reset(userId) {
    const s = this.get(userId);
    s.state = 'menu';
    s.history = [];
    s.data = {};
  }

  /**
   * إحصائيات للوحة التحكم.
   */
  stats() {
    const all = [...this.sessions.values()];
    return {
      total: all.length,
      byState: all.reduce((acc, s) => {
        acc[s.state] = (acc[s.state] || 0) + 1;
        return acc;
      }, {}),
      recent: all
        .sort((a, b) => new Date(b.lastActiveAt) - new Date(a.lastActiveAt))
        .slice(0, 20)
        .map((s) => ({
          userId: s.userId,
          name: s.name,
          state: s.state,
          messages: s.history.length,
          lastActiveAt: s.lastActiveAt,
        })),
    };
  }
}

export const sessionStore = new SessionStore();
export default sessionStore;
