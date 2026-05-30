# 🤖 دليل تنفيذ كامل للوكيل (Agent Runbook)
# نشر بوت واتساب على Ubuntu مع Evolution API (Docker)

> **الجمهور المستهدف:** وكيل آلي (AI agent) أو منفّذ بشري يملك وصول طرفية (terminal)
> إلى خادم **Ubuntu** يعمل عليه **Evolution API داخل Docker**.
>
> **الهدف:** ربط رقم واتساب وتشغيل بوت خدمة العملاء بحيث يرد تلقائياً على الرسائل.
>
> **مدة التنفيذ المتوقعة:** 5–10 دقائق.
>
> نفّذ المراحل **بالترتيب**. لا تنتقل لمرحلة قبل نجاح التي قبلها. كل مرحلة بها
> **أمر التحقق** و**المعيار المتوقّع** و**معالجة الأخطاء**.

---

## ⚙️ المتطلبات المسبقة (تحقق منها أولاً)

نفّذ هذه الأوامر وتأكد من النتائج قبل البدء:

```bash
# 1) Docker مثبّت ويعمل
docker --version && docker compose version
# المتوقع: إصدار Docker و Docker Compose يظهران بلا أخطاء

# 2) حاوية Evolution API تعمل
docker ps --format '{{.Names}}  {{.Image}}  {{.Ports}}'
# المتوقع: سطر يحتوي على evolution وميناء 8080 (أو ما شابه)

# 3) Node.js و npm مثبّتان (مطلوب فقط لوضع المضيف؛ اختياري لوضع Docker)
node --version && npm --version
# المتوقع: Node v18+ (يُفضّل v20+)
```

**إذا لم تكن حاوية Evolution تعمل:** أوقف التنفيذ وأبلغ المستخدم أن عليه تشغيل
Evolution API أولاً. لا تحاول تثبيته.

---

## 📍 المرحلة 0: جمع المعلومات الأساسية

استخرج القيم التالية واحفظها في متغيرات بيئة لاستخدامها لاحقاً.

```bash
# اكتشاف اسم حاوية Evolution تلقائياً
export EVO_CONTAINER=$(docker ps --format '{{.Names}}' | grep -iE 'evolution|evo-api|evoapi' | head -1)
echo "حاوية Evolution: $EVO_CONTAINER"

# اكتشاف اسم شبكة Docker الخاصة بها
export EVO_NETWORK=$(docker inspect "$EVO_CONTAINER" -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' | awk '{print $1}')
echo "شبكة Evolution: $EVO_NETWORK"

# اكتشاف المنفذ المنشور لـ Evolution على المضيف
export EVO_PORT=$(docker port "$EVO_CONTAINER" 2>/dev/null | grep -oP '0.0.0.0:\K[0-9]+' | head -1)
export EVO_PORT=${EVO_PORT:-8080}
echo "منفذ Evolution: $EVO_PORT"

# اكتشاف الـ API Key من بيئة الحاوية
export EVO_KEY=$(docker exec "$EVO_CONTAINER" env 2>/dev/null | grep -oP 'AUTHENTICATION_API_KEY=\K.*' | head -1)
echo "API Key: ${EVO_KEY:0:8}*** (مخفي جزئياً)"

# اسم الجلسة (instance) — ثابت
export INSTANCE="mybot"
echo "اسم الجلسة: $INSTANCE"
```

**التحقق — المعيار المتوقّع:**
- `EVO_CONTAINER` غير فارغ.
- `EVO_NETWORK` غير فارغ (مثال: `evolution-api_default`).
- `EVO_KEY` غير فارغ (نص طويل).

**معالجة الأخطاء:**
- إذا كان `EVO_CONTAINER` فارغاً: نفّذ `docker ps` واطلب من المستخدم تحديد اسم
  حاوية Evolution يدوياً، ثم: `export EVO_CONTAINER=<الاسم>`.
- إذا كان `EVO_KEY` فارغاً: اقرأه من ملف `.env` الخاص بـ Evolution أو
  `docker-compose.yaml` الخاص به، أو اطلبه من المستخدم: `export EVO_KEY=<المفتاح>`.

---

## 📍 المرحلة 1: التأكد من عمل خادم Evolution

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:$EVO_PORT
```

**المعيار المتوقّع:** `HTTP 200` (قد يكون 200 مع رسالة ترحيب JSON).

**معالجة الأخطاء:**
- `Connection refused`: المنفذ خاطئ. جرّب `docker port "$EVO_CONTAINER"` لمعرفة المنفذ الصحيح وحدّث `EVO_PORT`.
- `HTTP 401/403`: طبيعي على بعض المسارات؛ يعني الخادم يعمل. تابع.

---

## 📍 المرحلة 2: إنشاء جلسة واتساب وربط الرقم (QR)

### 2.1 إنشاء الجلسة

```bash
curl -s -X POST http://localhost:$EVO_PORT/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: $EVO_KEY" \
  -d "{\"instanceName\":\"$INSTANCE\",\"integration\":\"WHATSAPP-BAILEYS\",\"qrcode\":true}"
```

**المعيار المتوقّع:** استجابة JSON تحتوي على `instance` و`qrcode` (به `base64` أو `code`).

**معالجة الأخطاء:**
- إذا احتوت الاستجابة على "already in use" أو HTTP 403: الجلسة موجودة مسبقاً —
  هذا مقبول، تابع للخطوة 2.2.
- HTTP 401: المفتاح خاطئ — راجع المرحلة 0.

### 2.2 عرض رمز QR للمستخدم لمسحه

رمز الـ QR يحتاج تفاعلاً بشرياً (مسح من الهاتف). الوكيل لا يستطيع المسح، لذا:

**الخيار الأفضل (واجهة بصرية):** أبلغ المستخدم بفتح المتصفح على:
```
http://<عنوان-الخادم>:<EVO_PORT>/manager
```
ثم: إدخال الـ API Key → اختيار الجلسة `mybot` → الضغط على Connect → مسح QR من:
**واتساب ← الإعدادات ⚙️ ← الأجهزة المرتبطة ← ربط جهاز**.

**الخيار البديل (طرفية):** لإعادة جلب QR كنص:
```bash
curl -s http://localhost:$EVO_PORT/instance/connect/$INSTANCE -H "apikey: $EVO_KEY"
```
استخرج حقل `code` واعرضه. إن توفرت أداة `qrencode`:
```bash
QR=$(curl -s http://localhost:$EVO_PORT/instance/connect/$INSTANCE -H "apikey: $EVO_KEY" | grep -oP '"code":"\K[^"]+')
command -v qrencode >/dev/null && echo "$QR" | qrencode -t ANSIUTF8 || echo "QR code: $QR"
```

### 2.3 انتظار اكتمال الربط (حلقة فحص)

```bash
echo "في انتظار مسح المستخدم لرمز QR..."
for i in $(seq 1 40); do
  STATE=$(curl -s http://localhost:$EVO_PORT/instance/connectionState/$INSTANCE -H "apikey: $EVO_KEY" | grep -oP '"state":"\K[^"]+')
  echo "[$i/40] الحالة: $STATE"
  [ "$STATE" = "open" ] && echo "✅ تم ربط الرقم بنجاح!" && break
  sleep 3
done
```

**المعيار المتوقّع:** `"state":"open"` ✅

**معالجة الأخطاء:**
- بقيت `connecting`: لم يُمسح الـ QR بعد. أعد عرض الـ QR (2.2) واطلب من المستخدم المسح.
- `close`: انقطع الاتصال. أعد المحاولة من 2.1.

---

## 📍 المرحلة 3: تشغيل البوت + ربط الـ Webhook

> اختر **الطريق (أ)** افتراضياً (الأنظف على Ubuntu). استخدم (ب) فقط إذا طلب المستخدم تشغيل البوت خارج Docker.

افترض أن دليل البوت موجود في `whatsapp-bot/`. انتقل إليه:
```bash
cd whatsapp-bot   # عدّل المسار إن لزم
```

---

### 🟢 الطريق (أ): البوت داخل Docker (موصى به)

```bash
# تشغيل البوت داخل نفس شبكة Evolution
EVOLUTION_NETWORK="$EVO_NETWORK" \
EVOLUTION_API_URL="http://${EVO_CONTAINER}:8080" \
EVOLUTION_API_KEY="$EVO_KEY" \
EVOLUTION_INSTANCE="$INSTANCE" \
OPENAI_API_KEY="${OPENAI_API_KEY:-}" \
docker compose up -d --build
```

> ملاحظة: داخل شبكة Docker، البوت يصل لـ Evolution عبر اسم الحاوية على المنفذ الداخلي 8080.
> إذا كان Evolution يستمع على منفذ داخلي مختلف، عدّل `:8080` في `EVOLUTION_API_URL`.

**انتظار الإقلاع والتحقق:**
```bash
sleep 6
docker logs whatsapp-bot --tail 20
docker exec whatsapp-bot node -e "require('http').get('http://localhost:3001/health',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>console.log(d))})"
```
**المعيار المتوقّع:** سجلات تُظهر "🚀 بوت واتساب يعمل" و`/health` يرجع `"status":"ok"`.

**تسجيل الـ Webhook (باسم خدمة البوت داخل الشبكة):**
```bash
docker exec whatsapp-bot npm run setup-webhook -- http://whatsapp-bot:3001/webhook
```
**المعيار المتوقّع:** "تم تسجيل الـ webhook بنجاح ✅".

**معالجة الأخطاء:**
- `network ... not found`: قيمة `EVO_NETWORK` خاطئة. نفّذ `docker network ls` واختر شبكة Evolution الصحيحة، ثم أعد التشغيل.
- البوت لا يصل لـ Evolution (خطأ في setup-webhook): تأكد أن `EVOLUTION_API_URL` يستخدم **اسم حاوية Evolution** الصحيح وأنهما على نفس الشبكة:
  `docker inspect whatsapp-bot -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'`

---

### 🟡 الطريق (ب): البوت على المضيف مباشرة (بدون Docker)

```bash
# إنشاء ملف الإعدادات
cat > .env <<EOF
PORT=3001
WEBHOOK_PATH=/webhook
EVOLUTION_API_URL=http://localhost:$EVO_PORT
EVOLUTION_API_KEY=$EVO_KEY
EVOLUTION_INSTANCE=$INSTANCE
OPENAI_API_KEY=${OPENAI_API_KEY:-}
OPENAI_MODEL=gpt-4o-mini
SIMULATION_MODE=false
EOF

# تثبيت وتشغيل في الخلفية
npm install
nohup npm start > bot.log 2>&1 &
sleep 5
cat bot.log | tail -15
curl -s http://localhost:3001/health
```
**المعيار المتوقّع:** `/health` يرجع `"status":"ok"`.

**تسجيل الـ Webhook عبر جسر Docker:**
```bash
# اكتشاف IP الجسر للوصول من حاوية Evolution إلى المضيف
BRIDGE_IP=$(ip -4 addr show docker0 2>/dev/null | grep -oP 'inet \K[\d.]+' || echo "172.17.0.1")
echo "IP الجسر: $BRIDGE_IP"
npm run setup-webhook -- "http://${BRIDGE_IP}:3001/webhook"
```
**المعيار المتوقّع:** "تم تسجيل الـ webhook بنجاح ✅".

**معالجة الأخطاء:**
- إذا لم يستقبل البوت رسائل لاحقاً رغم نجاح التسجيل: حاوية Evolution قد لا تكون على
  الجسر الافتراضي `docker0`. الحل الأضمن: استخدم **الطريق (أ)**.
- بديل: إضافة `host.docker.internal` لحاوية Evolution وإعادة تسجيل الـ webhook بـ
  `http://host.docker.internal:3001/webhook` (يتطلب إعادة تشغيل حاوية Evolution مع
  `--add-host=host.docker.internal:host-gateway`).

---

## 📍 المرحلة 4: التحقق النهائي (End-to-End)

### 4.1 تأكيد تسجيل الـ Webhook
```bash
curl -s http://localhost:$EVO_PORT/webhook/find/$INSTANCE -H "apikey: $EVO_KEY"
```
**المعيار المتوقّع:** JSON يُظهر `"enabled":true` والـ `url` الذي سجّلته.

### 4.2 اختبار حقيقي
أبلغ المستخدم: **أرسل رسالة واتساب (مثل "مرحبا") إلى الرقم المرتبط من هاتف آخر.**

راقب سجلات البوت لتأكيد الاستقبال والرد:
```bash
# وضع Docker:
docker logs whatsapp-bot --tail 20 -f
# وضع المضيف:
tail -f bot.log
```
**المعيار المتوقّع:** يظهر سطر `📩 رسالة من ...` ثم يرد البوت بالقائمة، ويستلم المرسل
رسالة الترحيب والقائمة على واتساب. ✅

---

## 📋 ملخص الأوامر النهائي (نسخة سريعة — الطريق أ)

```bash
# 0) جمع المعلومات
export EVO_CONTAINER=$(docker ps --format '{{.Names}}' | grep -iE 'evolution|evo' | head -1)
export EVO_NETWORK=$(docker inspect "$EVO_CONTAINER" -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' | awk '{print $1}')
export EVO_PORT=$(docker port "$EVO_CONTAINER" | grep -oP '0.0.0.0:\K[0-9]+' | head -1); export EVO_PORT=${EVO_PORT:-8080}
export EVO_KEY=$(docker exec "$EVO_CONTAINER" env | grep -oP 'AUTHENTICATION_API_KEY=\K.*' | head -1)
export INSTANCE="mybot"

# 1) إنشاء الجلسة
curl -s -X POST http://localhost:$EVO_PORT/instance/create -H "Content-Type: application/json" -H "apikey: $EVO_KEY" -d "{\"instanceName\":\"$INSTANCE\",\"integration\":\"WHATSAPP-BAILEYS\",\"qrcode\":true}"

# 2) المستخدم يمسح QR من http://<server>:$EVO_PORT/manager  ← انتظر state=open
for i in $(seq 1 40); do S=$(curl -s http://localhost:$EVO_PORT/instance/connectionState/$INSTANCE -H "apikey: $EVO_KEY" | grep -oP '"state":"\K[^"]+'); echo "$i: $S"; [ "$S" = "open" ] && break; sleep 3; done

# 3) تشغيل البوت داخل Docker + ربط webhook
cd whatsapp-bot
EVOLUTION_NETWORK="$EVO_NETWORK" EVOLUTION_API_URL="http://${EVO_CONTAINER}:8080" EVOLUTION_API_KEY="$EVO_KEY" EVOLUTION_INSTANCE="$INSTANCE" docker compose up -d --build
sleep 6
docker exec whatsapp-bot npm run setup-webhook -- http://whatsapp-bot:3001/webhook

# 4) تحقق
curl -s http://localhost:$EVO_PORT/webhook/find/$INSTANCE -H "apikey: $EVO_KEY"
docker logs whatsapp-bot --tail 20
```

---

## 🧯 جدول الأخطاء الشائعة وحلولها

| العَرَض | السبب المحتمل | الحل |
|--------|---------------|------|
| `EVO_CONTAINER` فارغ | اسم الحاوية غير قياسي | `docker ps` ثم `export EVO_CONTAINER=<الاسم>` |
| `EVO_KEY` فارغ | المتغير باسم مختلف | اقرأ من docker-compose الخاص بـ Evolution أو اطلبه من المستخدم |
| `HTTP 401` على الطلبات | مفتاح خاطئ | راجع `AUTHENTICATION_API_KEY` |
| `state` يبقى `connecting` | لم يُمسح QR | أعد عرض QR واطلب المسح |
| `network not found` | اسم الشبكة خاطئ | `docker network ls` وصحّح `EVO_NETWORK` |
| البوت يعمل لكن لا يرد | الـ webhook URL غير قابل للوصول | استخدم الطريق (أ) داخل Docker |
| setup-webhook يفشل بـ `ECONNREFUSED` | `EVOLUTION_API_URL` خطأ | داخل Docker استخدم اسم حاوية Evolution لا localhost |
| `SIMULATION_MODE` يمنع الإرسال | الوضع مفعّل | تأكد أنه `false` ثم أعد تشغيل البوت |

---

## 🔧 أوامر إدارية مفيدة

```bash
# إعادة تشغيل البوت (Docker)
docker restart whatsapp-bot

# إيقاف البوت (Docker)
docker compose down

# عرض سجلات حية
docker logs whatsapp-bot -f

# فصل الرقم الحالي لربط رقم آخر
curl -X DELETE http://localhost:$EVO_PORT/instance/logout/$INSTANCE -H "apikey: $EVO_KEY"

# حذف الجلسة نهائياً
curl -X DELETE http://localhost:$EVO_PORT/instance/delete/$INSTANCE -H "apikey: $EVO_KEY"

# اختبار منطق البوت بدون واتساب (وضع المحاكاة)
# اضبط SIMULATION_MODE=true وافتح http://localhost:3001
```

---

## ✅ تعريف "النجاح" (للوكيل)

اعتبر المهمة **مكتملة بنجاح** فقط عند تحقق كل ما يلي:
1. `connectionState` يرجع `"state":"open"`.
2. `webhook/find` يرجع `"enabled":true` بالعنوان الصحيح.
3. سجلات البوت تُظهر استقبال رسالة اختبار حقيقية ورداً عليها.
4. وصول رسالة الرد فعلياً إلى هاتف المُرسِل.

إذا لم تتحقق النقطة 3 أو 4، المشكلة شبه مؤكدة في **عنوان الـ webhook** (راجع الطريق أ).
