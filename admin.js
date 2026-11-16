import { auth, db, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, onSnapshot, query, orderBy, writeBatch, serverTimestamp, Timestamp, signInWithEmailAndPassword, signOut, onAuthStateChanged } from './firebase.js';
import { COL, FIREBASE_CONFIG, ADMIN_EMAILS, DEFAULT_PRICE, TELEGRAM_LINK } from './config.js';
import * as Shell from './shell.js';
import { $, $$, esc, rupiah, fmtDateTime, digits, toast, copyText, nextMidnightWIB, lightbox, cldThumb } from './util.js';

const curRef = doc(db, COL.settings, 'current'), priceRef = doc(db, COL.settings, 'price');
const NAV = [{ g: 'dasbor' }, { id: 'kode', ic: '🔑', lb: 'kode' }, { id: 'bukti', ic: '🧾', lb: 'cek bukti', n: 0 }, { id: 'harga', ic: '💰', lb: 'harga' }, { g: 'lainnya' }, { id: 'site', ic: '⚽', lb: 'lihat situs', href: './' }, { id: 'out', ic: '🚪', lb: 'keluar' }];
Shell.onNav(id => { if (id === 'out') signOut(auth); else { const b = $(`#tabs [data-t="${id}"]`); if (b) b.click(); window.scrollTo(0, 0); } });
let curCode = null, curExp = 0, generating = false, unsubReg = null, regs = [], stFilter = 'pending', timer = null;

// permission-denied = rules Firestore belum dipasang / email tidak ada di isAdmin() pada rules yang aktif
function denied(e) {
  if (!e || e.code !== 'permission-denied') return false;
  const w = $('#rulesWarn'), em = auth.currentUser ? auth.currentUser.email : '';
  w.innerHTML = `<b>Firebase menolak akses (permission-denied).</b> Rules Firestore di project <b>${esc(FIREBASE_CONFIG.projectId)}</b> belum berisi koleksi <b>pred_codes</b>, <b>pred_settings</b>, <b>pred_daftar</b> (atau email <b>${esc(em)}</b> tidak ada di <code>isAdmin()</code>).<br>Perbaiki: Firebase Console → Firestore Database → Rules → tempel isi file <b>firestore-tambahan.rules</b> di dalam <code>match /databases/{database}/documents</code> → <b>Publish</b> → muat ulang halaman ini.`;
  w.classList.remove('hidden'); return true;
}

// ---------- login ----------
onAuthStateChanged(auth, async u => {
  if (!u) return showLogin();
  if (!ADMIN_EMAILS.includes(String(u.email || '').toLowerCase())) { await signOut(auth); return showLogin('Akun ini bukan admin.'); }
  showPanel(u);
});
function showLogin(msg) {
  Shell.set([{ g: 'menu' }, { id: 'site', ic: '⚽', lb: 'lihat situs', href: './' }]);
  $('#panel').classList.add('hidden'); $('#out').classList.add('hidden'); $('#who').classList.add('hidden'); $('#login').classList.remove('hidden');
  $('#loginErr').textContent = msg || ''; if (unsubReg) { unsubReg(); unsubReg = null; } clearInterval(timer);
}
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault(); const b = $('#loginBtn'); b.disabled = true; $('#loginErr').textContent = '';
  try { await signInWithEmailAndPassword(auth, $('#em').value.trim(), $('#pw').value); }
  catch (ex) { $('#loginErr').textContent = ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(ex.code) ? 'Email atau password salah.' : 'Login gagal: ' + (ex.code || ex.message); }
  b.disabled = false;
});
$('#out').addEventListener('click', () => signOut(auth));

let panelReady = false;
function showPanel(u) {
  Shell.set(NAV, 'kode');
  $('#login').classList.add('hidden'); $('#panel').classList.remove('hidden'); $('#out').classList.remove('hidden');
  $('#who').textContent = u.email; $('#who').classList.remove('hidden');
  if (panelReady) { listenRegs(); return; } panelReady = true;
  bindUI(); initCode(); listenRegs(); loadPrice();
}
function bindUI() {
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; Shell.active(b.dataset.t); $$('#tabs button').forEach(x => x.classList.toggle('on', x === b)); for (const t of ['kode', 'bukti', 'harga']) $('#t-' + t).classList.toggle('hidden', t !== b.dataset.t); });
  $('#copyCode').addEventListener('click', async () => toast((await copyText(curCode || '')) ? 'Kode disalin' : 'Gagal menyalin', false));
  $('#copyMsg').addEventListener('click', async () => toast((await copyText(shareMsg())) ? 'Pesan disalin' : 'Gagal menyalin', false));
  $('#reroll').addEventListener('click', async () => { if (!confirm('Acak ulang kode? Kode lama langsung mati, member yang sedang masuk akan diminta kode baru.')) return; await generate(); });
  $('#qReg').addEventListener('input', renderRegs);
  $('#stFilter').addEventListener('click', e => { const b = e.target.closest('[data-st]'); if (!b) return; stFilter = b.dataset.st; renderRegs(); });
  $('#regList').addEventListener('click', onRegClick);
  $('#priceIn').addEventListener('input', e => { const d = digits(e.target.value); e.target.value = d ? Number(d).toLocaleString('id-ID') : ''; });
  $('#priceSave').addEventListener('click', savePrice);
}

// ---------- kode harian ----------
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';   // 24 huruf (tanpa I & O supaya tidak tertukar dengan 1/0)
function randCode() { const a = new Uint32Array(6); crypto.getRandomValues(a); return Array.from(a, x => LETTERS[x % LETTERS.length]).join(''); }
const BASE = location.origin + location.pathname.replace(/[^/]*$/, '');
const shareMsg = () => `🔑 Kode BOLASEPAK hari ini: ${curCode || '······'}\nBerlaku sampai 00:00 WIB.\nMasuk: ${BASE}`;
async function initCode() {
  try { const s = await getDoc(curRef); if (s.exists()) { curCode = s.data().code; curExp = s.data().expiresAt.toMillis(); } } catch (e) { console.error(e); if (!denied(e)) toast('Gagal membaca kode: ' + (e.code || e.message), true); }
  if (!curCode || curExp <= Date.now()) await generate(); else paintCode();
  cleanupOld();
  timer = setInterval(tick, 1000);
}
async function generate() {
  if (generating) return; generating = true;
  try {
    const expiresAt = Timestamp.fromMillis(nextMidnightWIB());
    let code = null;
    for (let i = 0; i < 10 && !code; i++) { const c = randCode(); if (!(await getDoc(doc(db, COL.codes, c))).exists()) code = c; }
    if (!code) throw new Error('Gagal membuat kode unik');
    const b = writeBatch(db);
    b.set(doc(db, COL.codes, code), { createdAt: serverTimestamp(), expiresAt });
    b.set(curRef, { code, createdAt: serverTimestamp(), expiresAt });
    if (curCode) b.delete(doc(db, COL.codes, curCode));
    await b.commit();
    curCode = code; curExp = expiresAt.toMillis(); $('#rulesWarn').classList.add('hidden'); paintCode(); toast('Kode baru dibuat');
  } catch (e) { console.error(e); if (!denied(e)) toast('Gagal membuat kode: ' + (e.code || e.message), true); }
  generating = false;
}
async function cleanupOld() {
  try { const s = await getDocs(collection(db, COL.codes)); for (const d of s.docs) { const e = d.data().expiresAt; if (d.id !== curCode && e && e.toMillis() <= Date.now()) await deleteDoc(d.ref); } } catch (e) { console.warn('cleanup', e); }
}
function paintCode() { $('#code').textContent = curCode || '······'; $('#shareTg').href = 'https://t.me/share/url?url=' + encodeURIComponent(BASE) + '&text=' + encodeURIComponent(shareMsg()); tick(); }
function tick() {
  if (!curCode) return;
  const left = curExp - Date.now();
  if (left <= 0) { $('#cd').textContent = 'Kode kedaluwarsa, membuat kode baru…'; generate().then(cleanupOld); return; }
  const s = Math.floor(left / 1000), p = n => String(n).padStart(2, '0');
  $('#cd').textContent = `Berganti otomatis dalam ${p(Math.floor(s / 3600))}:${p(Math.floor(s % 3600 / 60))}:${p(s % 60)} (00:00 WIB)`;
}

// ---------- cek bukti ----------
function listenRegs() {
  if (unsubReg) unsubReg();
  unsubReg = onSnapshot(query(collection(db, COL.daftar), orderBy('createdAt', 'desc')), s => { regs = s.docs.map(d => ({ id: d.id, ...d.data() })); renderRegs(); },
    e => { console.error(e); if (!denied(e)) toast('Gagal membaca pendaftar: ' + (e.code || e.message), true); });
}
const ST = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak' };
function renderRegs() {
  const n = k => regs.filter(r => r.status === k).length, pend = n('pending');
  const pb = $('#pend'); pb.textContent = pend; pb.classList.toggle('hidden', !pend); Shell.badge('bukti', pend);
  $('#stFilter').innerHTML = [['pending', 'Menunggu'], ['approved', 'Disetujui'], ['rejected', 'Ditolak'], ['all', 'Semua']].map(([k, l]) => `<button data-st="${k}" class="${stFilter === k ? 'on' : ''}">${l} <em>${k === 'all' ? regs.length : n(k)}</em></button>`).join('');
  const q = digits($('#qReg').value);
  const list = regs.filter(r => (stFilter === 'all' || r.status === stFilter) && (!q || String(r.phone).includes(q)));
  $('#regList').innerHTML = list.map(r => `<article class="card reg" data-id="${esc(r.id)}">
<div class="top"><div><div class="ph">+${esc(r.phone)}</div><small class="sub">${esc(fmtDateTime(r.createdAt && r.createdAt.toMillis ? r.createdAt.toMillis() : null))} · ${rupiah(r.price)}</small></div><span class="st ${esc(r.status)}">${esc(ST[r.status] || r.status)}</span></div>
<div class="shots" style="grid-column:1/-1"><a href="${esc(r.telegramShotUrl)}" data-zoom="${esc(r.telegramShotUrl)}"><img src="${esc(cldThumb(r.telegramShotUrl))}" alt="Profil Telegram" loading="lazy"><small>Profil Telegram</small></a><a href="${esc(r.proofUrl)}" data-zoom="${esc(r.proofUrl)}"><img src="${esc(cldThumb(r.proofUrl))}" alt="Bukti bayar" loading="lazy"><small>Bukti bayar</small></a></div>
<div class="acts"><button class="btn sm mint" data-do="approve"${r.status === 'approved' ? ' disabled' : ''}>✓ Approve</button><button class="btn sm red" data-do="reject"${r.status === 'rejected' ? ' disabled' : ''}>✕ Reject</button><button class="btn sm" data-do="del">🗑 Hapus</button><a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/${esc(r.phone)}">WhatsApp</a>${r.status === 'approved' ? '<button class="btn sm lav" data-do="wa">Kirim kode via WA</button>' : ''}</div></article>`).join('') || '<p class="sub">Tidak ada data.</p>';
}
async function onRegClick(e) {
  const z = e.target.closest('[data-zoom]'); if (z) { e.preventDefault(); return lightbox(z.dataset.zoom); }
  const b = e.target.closest('[data-do]'); if (!b) return;
  const id = b.closest('[data-id]').dataset.id, r = regs.find(x => x.id === id); if (!r) return;
  try {
    if (b.dataset.do === 'approve') { await updateDoc(doc(db, COL.daftar, id), { status: 'approved', decidedAt: serverTimestamp() }); toast('Disetujui'); }
    else if (b.dataset.do === 'reject') { await updateDoc(doc(db, COL.daftar, id), { status: 'rejected', decidedAt: serverTimestamp() }); toast('Ditolak'); }
    else if (b.dataset.do === 'del') { if (confirm(`Hapus pendaftaran +${r.phone}? Tidak bisa dikembalikan.`)) { await deleteDoc(doc(db, COL.daftar, id)); toast('Dihapus'); } }
    else if (b.dataset.do === 'wa') {
      const msg = `Halo, pembayaran BOLASEPAK kamu sudah disetujui ✅\n\n🔑 Kode hari ini: ${curCode || '(buka /admin dulu)'}\n(kode berganti tiap 00:00 WIB, kode terbaru dibagikan di grup)\nMasuk: ${BASE}\nGrup Telegram: ${TELEGRAM_LINK}`;
      window.open(`https://wa.me/${r.phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
    }
  } catch (ex) { console.error(ex); toast('Gagal: ' + (ex.code || ex.message), true); }
}

// ---------- harga ----------
async function loadPrice() {
  let a = DEFAULT_PRICE; try { const s = await getDoc(priceRef); if (s.exists() && Number(s.data().amount) > 0) a = Number(s.data().amount); } catch {}
  $('#priceIn').value = a.toLocaleString('id-ID');
}
async function savePrice() {
  const a = Number(digits($('#priceIn').value));
  if (!(a >= 1000)) return toast('Harga minimal Rp 1.000', true);
  try { await setDoc(priceRef, { amount: Math.round(a), updatedAt: serverTimestamp() }); toast('Harga disimpan: ' + rupiah(a)); } catch (e) { toast('Gagal: ' + (e.code || e.message), true); }
}
