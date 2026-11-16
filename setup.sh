#!/usr/bin/env bash
# Pasang Worker BOLASEPAK otomatis lewat API Cloudflare. Jalankan: bash setup.sh
# Butuh: curl dan jq  (Termux: pkg install curl jq)
set -e
for c in curl jq; do command -v $c >/dev/null || { echo "Pasang dulu: pkg install $c"; exit 1; }; done
[ -f worker.js ] || { echo "Jalankan di folder yang berisi worker.js"; exit 1; }

NAME=bolasepak-tg
CHAT=-1004375839998
ORIGIN=https://bolasepak.github.io
FBKEY=AIzaSyCVL_C4opQiKC6fNG_Rw4l-519rQZICH58
ADMINS=diasadhityap@gmail.com,fvcktherules3404@gmail.com

read -rp "Cloudflare Account ID: " ACC
read -rsp "Cloudflare API Token: " CF; echo
read -rsp "Token bot Telegram: " BOT; echo
API=https://api.cloudflare.com/client/v4/accounts/$ACC
H="Authorization: Bearer $CF"
ok() { [ "$(echo "$1" | jq -r '.success')" = "true" ] || { echo "GAGAL: $(echo "$1" | jq -c '.errors')"; exit 1; }; }

echo "• cek bot..."
curl -s "https://api.telegram.org/bot$BOT/getMe" | jq -e '.ok' >/dev/null || { echo "Token bot salah."; exit 1; }

echo "• siapkan KV..."
KV=$(curl -s -H "$H" "$API/storage/kv/namespaces?per_page=100" | jq -r '.result[]? | select(.title=="bolasepak-LINKS") | .id' | head -1)
if [ -z "$KV" ]; then
  R=$(curl -s -X POST -H "$H" -H 'content-type: application/json' -d '{"title":"bolasepak-LINKS"}' "$API/storage/kv/namespaces"); ok "$R"
  KV=$(echo "$R" | jq -r '.result.id')
fi

echo "• unggah Worker..."
WS=$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 40)
META=$(jq -n --arg kv "$KV" --arg bot "$BOT" --arg chat "$CHAT" --arg ws "$WS" --arg fb "$FBKEY" --arg ad "$ADMINS" --arg og "$ORIGIN" '{
  main_module:"worker.js", compatibility_date:"2026-01-01",
  bindings:[
    {type:"kv_namespace",name:"LINKS",namespace_id:$kv},
    {type:"secret_text",name:"BOT_TOKEN",text:$bot},
    {type:"secret_text",name:"CHAT_ID",text:$chat},
    {type:"secret_text",name:"WEBHOOK_SECRET",text:$ws},
    {type:"plain_text",name:"FIREBASE_API_KEY",text:$fb},
    {type:"plain_text",name:"ADMIN_EMAILS",text:$ad},
    {type:"plain_text",name:"ALLOWED_ORIGIN",text:$og}]}')
R=$(curl -s -X PUT -H "$H" -F "metadata=$META;type=application/json" -F "worker.js=@worker.js;type=application/javascript+module;filename=worker.js" "$API/workers/scripts/$NAME"); ok "$R"

echo "• aktifkan alamat workers.dev..."
SUB=$(curl -s -H "$H" "$API/workers/subdomain" | jq -r '.result.subdomain // empty')
if [ -z "$SUB" ]; then
  read -rp "Pilih nama subdomain workers.dev (huruf kecil/angka/-): " SUB
  R=$(curl -s -X PUT -H "$H" -H 'content-type: application/json' -d "{\"subdomain\":\"$SUB\"}" "$API/workers/subdomain"); ok "$R"
fi
R=$(curl -s -X POST -H "$H" -H 'content-type: application/json' -d '{"enabled":true}' "$API/workers/scripts/$NAME/subdomain"); ok "$R"
URL=https://$NAME.$SUB.workers.dev

sed -i "s|export const WORKER_URL = .*|export const WORKER_URL = '$URL';|" config.js
echo "• config.js diisi: $URL"

echo "• pasang webhook Telegram..."
WH=""
for i in 1 2 3 4; do
  R=$(curl -s "https://api.telegram.org/bot$BOT/setWebhook" --data-urlencode "url=$URL/tg" --data-urlencode "secret_token=$WS" --data-urlencode 'allowed_updates=["chat_join_request"]')
  if echo "$R" | jq -e '.ok' >/dev/null; then WH=ok; break; fi
  echo "  belum bisa ($i/4): $(echo "$R" | jq -r '.description')"; sleep 15
done
echo
echo "Alamat Worker: $URL"
if [ "$WH" = ok ]; then echo "Webhook Telegram: TERPASANG."
else echo "Webhook belum terpasang (alamat baru belum dikenal Telegram). Tidak apa-apa untuk sementara; jalankan 'bash setup.sh' lagi 15-60 menit lagi."; fi
echo "Langkah berikut: upload config.js dan file lain yang berubah ke GitHub, tempel firestore-tambahan.rules di Firebase dan Publish."
echo "Setelah semua beres, hapus API Token Cloudflare tadi di dashboard."
