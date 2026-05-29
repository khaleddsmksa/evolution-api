#!/usr/bin/env bash
# ============================================================
#  سكربت تشغيل تلقائي لبوت واتساب على Ubuntu/Linux
#  يكتشف حاوية Evolution وشبكتها ومفتاحها تلقائياً،
#  ثم يشغّل البوت ويسجّل الـ webhook.
#
#  الاستخدام:
#     chmod +x start-ubuntu.sh
#     ./start-ubuntu.sh                 # تشغيل داخل Docker (الأنظف)
#     ./start-ubuntu.sh --host          # تشغيل على المضيف مباشرة (بدون Docker)
# ============================================================
set -e

INSTANCE="${EVOLUTION_INSTANCE:-mybot}"
MODE="docker"
[ "$1" = "--host" ] && MODE="host"

echo "🔍 البحث عن حاوية Evolution API..."

# اكتشاف حاوية Evolution (بالاسم الشائع)
EVO_CONTAINER=$(docker ps --format '{{.Names}}' | grep -iE 'evolution|evo' | head -1 || true)
if [ -z "$EVO_CONTAINER" ]; then
  echo "❌ لم أجد حاوية Evolution. الحاويات العاملة:"
  docker ps --format '   - {{.Names}} ({{.Ports}})'
  echo "أعد التشغيل بعد ضبط: export EVO_CONTAINER=<اسم_الحاوية>"
  [ -z "$EVO_CONTAINER" ] && exit 1
fi
echo "   ✅ الحاوية: $EVO_CONTAINER"

# اكتشاف الشبكة
EVO_NETWORK=$(docker inspect "$EVO_CONTAINER" -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' | head -1)
echo "   ✅ الشبكة: $EVO_NETWORK"

# اكتشاف المفتاح
EVO_KEY="${EVOLUTION_API_KEY:-$(docker exec "$EVO_CONTAINER" env 2>/dev/null | grep -oP 'AUTHENTICATION_API_KEY=\K.*' | head -1)}"
if [ -z "$EVO_KEY" ]; then
  echo "⚠️ لم أتمكن من قراءة المفتاح تلقائياً."
  read -rp "أدخل EVOLUTION_API_KEY: " EVO_KEY
fi
echo "   ✅ المفتاح: ${EVO_KEY:0:6}***"

# اسم خدمة Evolution داخل الشبكة (للوصول من البوت)
EVO_SERVICE="$EVO_CONTAINER"

if [ "$MODE" = "docker" ]; then
  echo ""
  echo "🐳 تشغيل البوت داخل Docker على شبكة: $EVO_NETWORK"
  EVOLUTION_NETWORK="$EVO_NETWORK" \
  EVOLUTION_API_URL="http://${EVO_SERVICE}:8080" \
  EVOLUTION_API_KEY="$EVO_KEY" \
  EVOLUTION_INSTANCE="$INSTANCE" \
  OPENAI_API_KEY="${OPENAI_API_KEY:-}" \
  docker compose up -d --build

  echo "⏳ انتظار إقلاع البوت..."
  sleep 6
  echo "🔗 تسجيل الـ webhook..."
  docker exec whatsapp-bot npm run setup-webhook -- "http://whatsapp-bot:3001/webhook"
else
  echo ""
  echo "💻 تشغيل البوت على المضيف مباشرة"
  # IP جسر Docker للوصول من الحاوية إلى المضيف
  BRIDGE_IP=$(ip -4 addr show docker0 2>/dev/null | grep -oP 'inet \K[\d.]+' || echo "172.17.0.1")
  echo "   IP الجسر: $BRIDGE_IP"

  cat > .env <<EOF
PORT=3001
WEBHOOK_PATH=/webhook
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=$EVO_KEY
EVOLUTION_INSTANCE=$INSTANCE
OPENAI_API_KEY=${OPENAI_API_KEY:-}
OPENAI_MODEL=${OPENAI_MODEL:-gpt-4o-mini}
SIMULATION_MODE=false
EOF
  echo "   ✅ تم إنشاء .env"

  npm install
  echo "🚀 تشغيل البوت في الخلفية..."
  (npm start > bot.log 2>&1 &) 
  sleep 5
  echo "🔗 تسجيل الـ webhook عبر جسر Docker..."
  npm run setup-webhook -- "http://${BRIDGE_IP}:3001/webhook"
  echo "📋 سجلات البوت في: bot.log  (tail -f bot.log)"
fi

echo ""
echo "✅ تم! أرسل رسالة واتساب للرقم المتصل لاختبار البوت 🎉"
echo "   التحقق من الـ webhook:"
echo "   curl http://localhost:8080/webhook/find/$INSTANCE -H \"apikey: $EVO_KEY\""
