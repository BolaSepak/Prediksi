import { db, doc, getDoc, collection, addDoc, serverTimestamp } from './firebase.js';
import { COL, DEFAULT_PRICE, WORKER_URL } from './config.js';
import { $, esc, rupiah, digits, fmtBytes, toast, lightbox } from './util.js';
import { shrink, uploadImage } from './upload.js';
import * as Shell from './shell.js';
Shell.set([{ g: 'menu' }, { id: 'masuk', ic: '🔑', lb: 'masuk dengan kode', href: './' }, { id: 'daftar', ic: '📝', lb: 'daftar member', href: 'daftar.html' }], 'daftar');

let price = DEFAULT_PRICE;
const files = { f1: null, f2: null };   // {state:'shrink'|'up'|'done', blob,name,before,after,preview,p,url}
const seq = { f1: 0, f2: 0 };
const KEY = 'bolasepak.reg';

$('#price').textContent = rupiah(price);
$('#qris').addEventListener('click', () => lightbox($('#qris').src));
getDoc(doc(db, COL.settings, 'price')).then(s => { const a = s.exists() && Number(s.data().amount); if (a > 0) { price = a; $('#price').textContent = rupiah(price); } }).catch(() => {});

// ---------- nomor HP ----------
export function normPhone(v) {
  let d = digits(v);
  if (d.startsWith('0')) d = '62' + d.slice(1); else if (d.startsWith('8')) d = '62' + d;
  return d;
}
const validPhone = p => /^628\d{8,11}$/.test(p);
$('#phone').addEventListener('input', e => { e.target.value = e.target.value.replace(/[^\d+\s-]/g, ''); $('#phoneErr').textContent = ''; check(); });
$('#phone').addEventListener('blur', e => { const p = normPhone(e.target.value); $('#phoneErr').textContent = e.target.value && !validPhone(p) ? 'Nomor tidak valid. Contoh: 081234567890' : ''; });

// ---------- upload otomatis begitu file dipilih: perkecil -> unggah -> centang ----------
let sending = false;
function fileField(id, label) {
  const root = $('#' + id);
  root.innerHTML = `<label class="drop"><b>＋ Tambahkan file</b><small>${esc(label)} · JPG/PNG</small><input type="file" accept="image/*"></label><div class="slot"></div>`;
  const inp = root.querySelector('input'), slot = root.querySelector('.slot'), drop = root.querySelector('.drop');
  function render() {
    const f = files[id];
    drop.classList.toggle('hidden', !!f);
    if (!f) { slot.innerHTML = ''; return check(); }
    const rm = '<button type="button" aria-label="Hapus">✕</button>';
    if (f.state === 'shrink') slot.innerHTML = `<div class="filechip"><div class="spin"></div><div class="nm"><b>${esc(f.name)}</b><small>Memperkecil gambar…</small><div class="prog ind"><i></i></div></div></div>`;
    else slot.innerHTML = `<div class="filechip${f.state === 'done' ? ' done' : ''}"><img src="${f.preview}" alt=""><div class="nm"><b>${esc(f.name)}</b><small class="st">${stText(f)}</small><div class="prog${f.state === 'done' ? ' done' : ''}"><i style="width:${Math.round((f.p || 0) * 100)}%"></i></div></div>${f.state === 'done' ? '<span class="ck">✅</span>' : ''}${rm}</div>`;
    const img = slot.querySelector('img'); if (img) img.addEventListener('click', () => lightbox(f.preview));
    const b = slot.querySelector('button'); if (b) b.addEventListener('click', () => { seq[id]++; if (f.preview) URL.revokeObjectURL(f.preview); files[id] = null; inp.value = ''; render(); });
    check();
  }
  const stText = f => f.state === 'done' ? `Terunggah · ${fmtBytes(f.before)} → ${fmtBytes(f.after)}` : `Mengunggah ${Math.round((f.p || 0) * 100)}% · ${fmtBytes(f.before)} → ${fmtBytes(f.after)}`;
  function paint() { const f = files[id]; if (!f) return; const i = slot.querySelector('.prog i'), s = slot.querySelector('.st'); if (i) i.style.width = Math.round((f.p || 0) * 100) + '%'; if (s) s.textContent = stText(f); }
  inp.addEventListener('change', async () => {
    const file = inp.files[0]; if (!file) return;
    const t = ++seq[id];
    files[id] = { state: 'shrink', name: file.name }; render();
    try {
      const r = await shrink(file); if (t !== seq[id]) return;
      files[id] = { ...r, preview: URL.createObjectURL(r.blob), state: 'up', p: 0 }; render();
      const url = await uploadImage(r.blob, r.name, p => { if (t === seq[id] && files[id]) { files[id].p = p; paint(); } });
      if (t !== seq[id]) return;
      files[id].url = url; files[id].p = 1; files[id].state = 'done'; render();
    } catch (e) {
      if (t !== seq[id]) return;
      files[id] = null; inp.value = ''; toast(e.message || 'Upload gagal', true); render();
    }
  });
}
fileField('f1', 'Screenshot profil Telegram'); fileField('f2', 'Bukti pembayaran');

function check() { $('#send').disabled = sending || !(validPhone(normPhone($('#phone').value)) && files.f1 && files.f1.state === 'done' && files.f2 && files.f2.state === 'done'); }

// ---------- kirim: langsung dapat link unik dari bot ----------
$('#form').addEventListener('submit', async e => {
  e.preventDefault();
  const phone = normPhone($('#phone').value), btn = $('#send'), err = $('#sendErr'); err.textContent = '';
  if (!validPhone(phone)) { $('#phoneErr').textContent = 'Nomor tidak valid.'; return; }
  if (!(files.f1 && files.f1.url && files.f2 && files.f2.url)) return;
  sending = true; btn.disabled = true; btn.classList.add('busy'); btn.textContent = 'Mengirim…';
  try {
    if (!WORKER_URL) throw new Error('server link belum disiapkan');
    const r = await fetch(WORKER_URL + '/link', { method: 'POST' }), j = await r.json().catch(() => ({}));
    if (!r.ok || !j.link) throw new Error(j.error || 'Gagal membuat link grup');
    await addDoc(collection(db, COL.daftar), { phone, telegramShotUrl: files.f1.url, proofUrl: files.f2.url, price, status: 'pending', createdAt: serverTimestamp(), inviteLink: j.link });
    try { localStorage.setItem(KEY, j.link); } catch {}
    showDone(j.link);
  } catch (ex) {
    console.error(ex);
    err.textContent = 'Gagal mengirim: ' + (ex && ex.message ? ex.message : 'coba lagi') + '. Data kamu belum terkirim.';
    sending = false; btn.classList.remove('busy'); btn.textContent = 'Kirim pendaftaran'; check();
  }
});

// ---------- layar "terkirim" + status otomatis (menunggu -> diterima) ----------
let pollT = null;
function showDone(link) {
  $('#form').classList.add('hidden'); $('.sub').classList.add('hidden'); $('#done').classList.remove('hidden'); window.scrollTo(0, 0);
  $('#tg').href = link; setStatus('pending', link); poll(link);
}
function setStatus(st, link) {
  const el = $('#stat'); if (link) $('#tg').href = link;
  if (st === 'approved') { el.className = 'stat ok'; el.textContent = '✅ Diterima! Pembayaran sudah disetujui admin.'; $('#tgHelp').textContent = 'Tekan tombol di bawah untuk masuk ke grup.'; clearInterval(pollT); }
  else if (st === 'rejected') { el.className = 'stat bad'; el.textContent = '❌ Pendaftaran ditolak admin. Hubungi admin bila ada kesalahan.'; $('#tg').classList.add('hidden'); clearInterval(pollT); }
  else { el.className = 'stat wait'; el.textContent = '⏳ Menunggu persetujuan admin'; }
}
function poll(link) {
  clearInterval(pollT);
  const go = async () => { try { const r = await fetch(WORKER_URL + '/status', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ link }) }); const j = await r.json(); if (j.status) setStatus(j.status, j.link || link); } catch {} };
  go(); pollT = setInterval(go, 5000);
}
$('#again').addEventListener('click', e => { e.preventDefault(); try { localStorage.removeItem(KEY); } catch {} location.reload(); });
try { const l = localStorage.getItem(KEY); if (l && WORKER_URL) showDone(l); } catch {}
