# BOLASEPAK — tampilan prediksi (struktur rata, tanpa folder)

Semua file ada di root, jadi bisa di-upload langsung dari HP. Mesin prediksi tetap di repo lama `prediksi`;
repo ini hanya menampilkan data lewat `DATA_BASE` di `config.js`.

| Alamat | File | Isi |
|---|---|---|
| `/` | index.html + script.js | Kode 6 huruf harian → Prediksi (Rumus / AI) dan Riwayat (filter) |
| `/daftar` | daftar.html + daftar.js | Nomor HP, screenshot Telegram, QRIS + harga, upload bukti, link grup Telegram |
| `/admin` | admin.html + admin.js | Tab Kode (acak harian), Cek Bukti (approve/reject/hapus), Harga (default Rp 20.000) |

Tampilan: header + hamburger + laci hitam ala FucktheRules (HP); di desktop jadi sidebar tetap ala Jurnal (klik hamburger untuk melipat jadi rail ikon). Kerangka ada di `shell.js` + bagian bawah `style.css`.

Pengaturan (link Telegram, harga default, admin, Cloudinary, Firebase, sumber data) ada di `config.js`.
Aturan database ada di `firestore.rules` (tambahkan blok pred_* ke rules project, jangan timpa yang lama).
Ganti QRIS dengan menimpa `qris.jpg`, ganti logo dengan menimpa `logo.png`.

## Link Telegram unik otomatis (worker.js)
Pendaftar langsung dapat link grup unik (mode "perlu persetujuan"). Saat admin klik Approve, link yang sama diubah jadi sekali pakai/langsung masuk (kalau sudah sempat minta gabung, bot langsung menyetujuinya). Reject/Hapus mematikan link.
Setup: buat bot di @BotFather → jadikan admin grup (izin undang via link + tambah anggota) → `wrangler kv namespace create LINKS` → isi id di wrangler.toml → `wrangler secret put BOT_TOKEN`, `CHAT_ID`, `WEBHOOK_SECRET` → `wrangler deploy` → setWebhook ke `<worker>/tg` dengan secret_token dan allowed_updates ["chat_join_request"] → isi `WORKER_URL` di config.js → tempel ulang firestore-tambahan.rules → Publish.

**Cara cepat:** jalankan `bash setup.sh` (butuh curl + jq). Skrip meminta Account ID, API Token Cloudflare (template "Edit Cloudflare Workers"), dan token bot, lalu mengerjakan semua langkah di atas sekaligus.
