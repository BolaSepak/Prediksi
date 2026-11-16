import { db, doc, getDoc, collection, addDoc, serverTimestamp } from './firebase.js';
import { COL, DEFAULT_PRICE, WORKER_URL } from './config.js';
import { $, esc, rupiah, digits, fmtBytes, toast, lightbox } from './util.js';
import { shrink, uploadImage } from './upload.js';
import * as Shell from './shell.js';
Shell.set([{ g: 'menu' }, { id: 'masuk', ic: '🔑', lb: 'masuk dengan kode', href: './' }, { id: 'daftar', ic: '📝', lb: 'daftar member', href: 'daftar.html' }], 'daftar');

let price = DEFAULT_PRICE;
const files = { f1: null, f2: null };   // {blob,name,before,after,preview}

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

// ---------- field upload bergaya Google Form ----------
function fileField(id, label) {
  const root = $('#' + id);
  root.innerHTML = `<label class="drop"><b>＋ Tambahkan file</b><small>${esc(label)} · JPG/PNG</small><input type="file" accept="image/*"></label><div class="slot"></div>`;
  const inp = root.querySelector('input'), slot = root.querySelector('.slot'), drop = root.querySelector('.drop');
  const show = () => {
    const f = files[id];
    drop.classList.toggle('hidden', !!f);
    slot.innerHTML = f ? `<div class="filechip"><img src="${f.preview}" alt=""><div class="nm"><b>${esc(f.name)}</b><small>${fmtBytes(f.before)} → ${fmtBytes(f.after)}</small><div class="prog"><i></i></div></div><button type="button" aria-label="Hapus">✕</button></div>` : '';
    if (f) { slot.querySelector('img').addEventListener('click', () => lightbox(f.preview)); slot.querySelector('button').addEventListener('click', () => { URL.revokeObjectURL(f.preview); files[id] = null; inp.value = ''; show(); check(); }); }
    check();
  };
  inp.addEventListener('change', async () => {
    const file = inp.files[0]; if (!file) return;
    slot.innerHTML = '<div class="sub">Memproses gambar…</div>';
    try { const r = await shrink(file); files[id] = { ...r, preview: URL.createObjectURL(r.blob) }; }
    catch (e) { files[id] = null; toast(e.message, true); inp.value = ''; }
    show();
  });
  return { setProgress: p => { const i = slot.querySelector('.prog i'); if (i) i.style.width = Math.round(p * 100) + '%'; } };
}
const fld = { f1: fileField('f1', 'Screenshot profil Telegram'), f2: fileField('f2', 'Bukti pembayaran') };

function check() { $('#send').disabled = !(validPhone(normPhone($('#phone').value)) && files.f1 && files.f2); }

// ---------- kirim ----------
$('#form').addEventListener('submit', async e => {
  e.preventDefault();
  const phone = normPhone($('#phone').value), btn = $('#send'), err = $('#sendErr'); err.textContent = '';
  if (!validPhone(phone)) { $('#phoneErr').textContent = 'Nomor tidak valid.'; return; }
  if (!files.f1 || !files.f2) return;
  btn.disabled = true; btn.textContent = 'Mengirim…';
  try {
    const [telegramShotUrl, proofUrl] = await Promise.all([
      uploadImage(files.f1.blob, files.f1.name, p => fld.f1.setProgress(p)),
      uploadImage(files.f2.blob, files.f2.name, p => fld.f2.setProgress(p))
    ]);
    let inviteLink = null;
    if (WORKER_URL) {
      const r = await fetch(WORKER_URL + '/link', { method: 'POST' }), j = await r.json().catch(() => ({}));
      if (!r.ok || !j.link) throw new Error(j.error || 'Gagal membuat link grup');
      inviteLink = j.link;
    }
    await addDoc(collection(db, COL.daftar), { phone, telegramShotUrl, proofUrl, price, status: 'pending', createdAt: serverTimestamp(), ...(inviteLink ? { inviteLink } : {}) });
    if (inviteLink) { $('#tg').href = inviteLink; } else { $('#tg').classList.add('hidden'); $('#tgNote').classList.remove('hidden'); }
    $('#form').classList.add('hidden'); $('#done').classList.remove('hidden'); window.scrollTo(0, 0);
  } catch (ex) {
    console.error(ex);
    err.textContent = 'Gagal mengirim: ' + (ex && ex.message ? ex.message : 'coba lagi') + '. Data kamu belum terkirim.';
    btn.disabled = false; btn.textContent = 'Kirim pendaftaran';
  }
});
