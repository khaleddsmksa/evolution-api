# 🤖 بوت واتساب — Evolution API

بوت واتساب احترافي لخدمة العملاء، يعمل عبر **[Evolution API](https://github.com/evolution-foundation/evolution-api)**.
يوفّر قائمة تفاعلية، ردوداً ذكية بالذكاء الاصطناعي، إدارة جلسات، ولوحة تحكم للمراقبة والاختبار.

---

## ✨ المميزات

- 📩 **استقبال الرسائل** عبر Webhook من Evolution API (Baileys / WhatsApp Cloud API).
- 📋 **قائمة تفاعلية** لخدمة العملاء (معلومات، منتجات، ساعات عمل، دعم).
- 🤖 **ردود ذكية بالـ AI** عبر OpenAI (أو أي خادم متوافق) للأسئلة الحرة.
- 👥 **إدارة الجلسات** وحفظ سجل المحادثة لكل مستخدم (آلة حالات State Machine).
- 🔢 **دعم الأرقام العربية والإنجليزية** والمطابقة النصية لعناوين الأزرار.
- 📊 **لوحة تحكم ويب** للمراقبة الحية ومحاكاة المحادثة دون واتساب حقيقي.
- 🧪 **وضع المحاكاة** (Simulation Mode) لاختبار البوت بالكامل بدون خادم.
- 🛡️ **معالجة أخطاء آمنة** — لا يتعطّل البوت عند فشل أي خدمة خارجية.

---

## 📁 هيكل المشروع

```
whatsapp-bot/
├── src/
│   ├── index.js                  # الخادم الرئيسي (Express) + نقاط النهاية
│   ├── config/index.js           # الإعدادات المركزية (من .env)
│   ├── core/
│   │   ├── botEngine.js          # محرّك البوت (آلة الحالات + التوجيه)
│   │   ├── messages.js           # نصوص الرسائل والقوائم
│   │   └── sessionStore.js       # إدارة جلسات المستخدمين
│   ├── services/
│   │   ├── evolutionClient.js    # عميل إرسال الرسائل لـ Evolution API
│   │   └── aiService.js          # خدمة الذكاء الاصطناعي (OpenAI)
│   ├── handlers/
│   │   └── webhookHandler.js     # استقبال وتطبيع أحداث الـ Webhook
│   └── utils/
│       ├── logger.js             # أداة التسجيل
│       └── setupWebhook.js       # سكربت تسجيل الـ webhook في Evolution
├── public/index.html             # لوحة التحكم
├── test/test.js                  # اختبارات
├── .env.example                  # نموذج الإعدادات
└── package.json
```

---

## 🚀 البدء السريع

### 1) التثبيت

```bash
cd whatsapp-bot
npm install
cp .env.example .env
```

### 2) ضبط الإعدادات في `.env`

```env
PORT=3001
EVOLUTION_API_URL=http://localhost:8080     # عنوان خادم Evolution API
EVOLUTION_API_KEY=your-global-apikey        # مفتاح Evolution API
EVOLUTION_INSTANCE=mybot                     # اسم الـ instance المتصل بواتساب

OPENAI_API_KEY=sk-...                        # (اختياري) لتفعيل الردود الذكية
OPENAI_MODEL=gpt-4o-mini

SIMULATION_MODE=false                        # true للاختبار بدون خادم حقيقي
```

### 3) التشغيل

```bash
npm start        # تشغيل عادي
npm run dev      # تشغيل مع إعادة التحميل التلقائي
```

سيعمل البوت على `http://localhost:3001`.

---

## 🧪 الاختبار بدون واتساب (وضع المحاكاة)

اضبط `SIMULATION_MODE=true` في `.env`، ثم شغّل البوت وافتح لوحة التحكم على
`http://localhost:3001` — ستجد **محاكي محادثة** تكتب فيه وتشاهد ردود البوت مباشرة.

أو عبر الـ API:

```bash
curl -X POST http://localhost:3001/api/test \
  -H "Content-Type: application/json" \
  -d '{"from":"966500000000","text":"مرحبا","pushName":"أحمد"}'
```

تشغيل الاختبارات الآلية:

```bash
npm test
```

---

## 📱 ربط رقم واتساب جديد

الربط يتم على مستوى **Evolution API** (إنشاء جلسة + مسح QR)، ثم نربط البوت بها.

> تأكد أولاً أن خادم Evolution API يعمل (مع PostgreSQL و Redis)، واضبط
> `EVOLUTION_API_URL` و `EVOLUTION_API_KEY` و `EVOLUTION_INSTANCE` في `.env`.

### الطريقة السريعة (سكربت جاهز)

```bash
npm run connect
```

يقوم تلقائياً بـ: إنشاء الجلسة → عرض رمز QR في الطرفية → متابعة الاتصال حتى يكتمل.
ثم في هاتفك: **واتساب ← الإعدادات ← الأجهزة المرتبطة ← ربط جهاز** وامسح الرمز.

### الطريقة اليدوية (عبر الـ API)

```bash
# 1) إنشاء جلسة
curl -X POST http://localhost:8080/instance/create \
  -H "apikey: <EVOLUTION_API_KEY>" -H "Content-Type: application/json" \
  -d '{"instanceName":"mybot","integration":"WHATSAPP-BAILEYS","qrcode":true}'

# 2) جلب رمز QR (أو افتح http://localhost:8080/manager)
curl http://localhost:8080/instance/connect/mybot -H "apikey: <EVOLUTION_API_KEY>"

# 3) التحقق من الاتصال (المطلوب: state = open)
curl http://localhost:8080/instance/connectionState/mybot -H "apikey: <EVOLUTION_API_KEY>"
```

### ربط البوت بالجلسة بعد الاتصال

1. في `.env`: اضبط `EVOLUTION_INSTANCE` على نفس اسم الجلسة، واجعل `SIMULATION_MODE=false`.
2. سجّل عنوان البوت كـ Webhook:

```bash
npm run setup-webhook -- https://your-public-bot-url.com/webhook
```

> 💡 يجب أن يكون عنوان البوت متاحاً علناً ليصل إليه Evolution API
> (استخدم خادماً عاماً أو نفقاً مثل ngrok / cloudflared أثناء التطوير).

3. أعد تشغيل البوت `npm start` وأرسل رسالة للرقم — سيرد البوت تلقائياً! 🎉

### تبديل الرقم لاحقاً

لفصل الرقم الحالي وربط رقم آخر:
```bash
curl -X DELETE http://localhost:8080/instance/logout/mybot -H "apikey: <EVOLUTION_API_KEY>"
npm run connect    # ثم امسح QR بالرقم الجديد
```

---

## 🌐 نقاط النهاية (API Endpoints)

| الطريقة | المسار | الوصف |
|--------|--------|-------|
| `POST` | `/webhook` | استقبال أحداث Evolution API |
| `GET`  | `/health` | فحص صحة البوت |
| `GET`  | `/api/connection` | حالة اتصال الـ instance بواتساب |
| `GET`  | `/api/stats` | إحصائيات الجلسات والرسائل |
| `POST` | `/api/test` | محاكاة رسالة واردة (للاختبار) |
| `POST` | `/api/send` | إرسال رسالة يدوياً |
| `GET`  | `/` | لوحة التحكم |

---

## 🧩 آلة الحالات (تدفّق المحادثة)

```
new ──(أول رسالة)──▶ menu
menu ──[1]──▶ معلومات عنّا       ──▶ menu
menu ──[2]──▶ المنتجات والأسعار  ──▶ menu
menu ──[3]──▶ ساعات العمل        ──▶ menu
menu ──[4]──▶ ai_chat (محادثة AI)
menu ──[5]──▶ support (دعم بشري)
أي حالة ──[0]──▶ menu (العودة للقائمة)
```

---

## ⚙️ التخصيص

- **النصوص والقوائم:** عدّل `src/core/messages.js`.
- **منطق التوجيه:** عدّل `src/core/botEngine.js`.
- **شخصية الـ AI:** عدّل `systemPrompt` في `src/services/aiService.js`.

---

## 📄 الترخيص

MIT — هذا البوت طبقة تطبيقية مستقلة تعمل فوق Evolution API.
