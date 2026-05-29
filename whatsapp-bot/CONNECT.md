# 🔌 دليل الإكمال: ربط البوت بـ Evolution API (Docker)

بما أنك ثبّت Evolution API على Docker، اتبع هذه الخطوات بالترتيب.

---

## 🧭 الخطوة 0: اعرف الـ API Key واسم الجلسة

```bash
# اعرف اسم حاوية Evolution وشبكتها
docker ps
docker network ls

# اعرف الـ API Key
docker exec <اسم_حاوية_evolution> env | grep AUTHENTICATION_API_KEY
```

احفظ قيمة `AUTHENTICATION_API_KEY` — هي مفتاحك (`EVOLUTION_API_KEY`).

---

## 1️⃣ الخطوة 1: إنشاء الجلسة وربط الرقم (QR)

### الأسهل — لوحة Evolution Manager
افتح: **http://localhost:8080/manager** → أدخل المفتاح → Create Instance باسم `mybot` → نوع `Baileys` → امسح الـ QR من:
> واتساب ← الإعدادات ⚙️ ← الأجهزة المرتبطة ← ربط جهاز

### أو عبر الأوامر
```bash
curl -X POST http://localhost:8080/instance/create \
  -H "Content-Type: application/json" -H "apikey: مفتاحك" \
  -d '{"instanceName":"mybot","integration":"WHATSAPP-BAILEYS","qrcode":true}'

# تأكد من الاتصال (المطلوب: "state":"open")
curl http://localhost:8080/instance/connectionState/mybot -H "apikey: مفتاحك"
```

---

## 2️⃣ الخطوة 2: ضبط وتشغيل البوت

```bash
cd whatsapp-bot
cp .env.example .env
```
عدّل `.env`:
```env
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=مفتاحك
EVOLUTION_INSTANCE=mybot
SIMULATION_MODE=false
OPENAI_API_KEY=          # اختياري للردود الذكية
```

شغّل البوت:
```bash
npm install
npm start
```

---

## 3️⃣ الخطوة 3: ربط الـ Webhook ⭐ (أهم خطوة)

⚠️ **المشكلة الشائعة:** Evolution داخل Docker لا يصل إلى `localhost:3001` (لأن localhost داخل الحاوية = الحاوية نفسها). اختر الحل المناسب لحالتك:

---

### 🟢 الحالة (أ): البوت على نفس الجهاز — Mac أو Windows
Docker Desktop يوفّر اسماً خاصاً للوصول للمضيف:
```bash
npm run setup-webhook -- http://host.docker.internal:3001/webhook
```

### 🟢 الحالة (ب): البوت على نفس الجهاز — Linux
استخدم IP جسر Docker (غالباً `172.17.0.1`):
```bash
npm run setup-webhook -- http://172.17.0.1:3001/webhook
```
> إن لم يعمل، أضف للحاوية: `--add-host=host.docker.internal:host-gateway` ثم استخدم `host.docker.internal`.

### 🟢 الحالة (ج): تشغيل البوت داخل Docker (الأنظف ✅)
يضمّ البوت إلى نفس شبكة Evolution فيتخاطبان بأسماء الخدمات:
```bash
# 1) اعرف اسم شبكة Evolution
docker network ls          # مثال: evolution-api_default

# 2) شغّل البوت في نفس الشبكة (عدّل القيم)
EVOLUTION_NETWORK=evolution-api_default \
EVOLUTION_API_URL=http://evolution-api:8080 \
EVOLUTION_API_KEY=مفتاحك \
EVOLUTION_INSTANCE=mybot \
docker compose up -d --build

# 3) سجّل الـ webhook باسم خدمة البوت
docker exec whatsapp-bot npm run setup-webhook -- http://whatsapp-bot:3001/webhook
```
> غيّر `evolution-api` إلى اسم خدمة/حاوية Evolution الفعلي لديك.

### 🟢 الحالة (د): اختبار من الإنترنت / هاتف بعيد — نفق عام
```bash
npx cloudflared tunnel --url http://localhost:3001
# أو: ngrok http 3001
# ثم استخدم الرابط العام الناتج:
npm run setup-webhook -- https://xxxx.trycloudflare.com/webhook
```

---

## ✅ التحقق النهائي

```bash
# تأكد أن الـ webhook مسجّل
curl http://localhost:8080/webhook/find/mybot -H "apikey: مفتاحك"
```

ثم **أرسل رسالة واتساب** للرقم المتصل → يجب أن يرد البوت بالقائمة 🎉
راقب نافذة `npm start` لرؤية: `📩 رسالة من ...`

---

## 🛠️ حل المشاكل

| المشكلة | الحل |
|---------|------|
| البوت لا يستقبل شيئاً | الـ webhook URL خطأ (راجع حالة الشبكة أ/ب/ج/د) |
| `ECONNREFUSED` عند setup-webhook | `EVOLUTION_API_URL` خطأ أو الخادم متوقف |
| `401/403` | `EVOLUTION_API_KEY` خطأ |
| `state` ليس `open` | لم يُمسح الـ QR — أعد `npm run connect` |
| Evolution يصل للبوت لكن لا رد | تأكد `SIMULATION_MODE=false` وأعد تشغيل البوت |

> 💡 لاختبار منطق البوت دون واتساب: اضبط `SIMULATION_MODE=true` وافتح لوحة التحكم على `http://localhost:3001`.
