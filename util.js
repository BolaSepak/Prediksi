export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pct = x => `${Math.round(x * 100)}%`;
export const acc = x => (x === null || x === undefined ? '–' : `${Math.round(x * 100)}%`);
export const fmtLine = l => (l > 0 ? `+${l}` : `${l}`);
export const rupiah = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
export const fmtTime = iso => new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' WIB';
export const fmtDateTime = d => (d ? new Date(d).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB' : '–');
export const fmtBytes = b => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
export const digits = s => String(s || '').replace(/\D/g, '');
export function toast(msg, bad) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.className = 'show' + (bad ? ' bad' : '');
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.className = ''), 2600);
}
export async function copyText(txt) {
  try { await navigator.clipboard.writeText(txt); return true; }
  catch { const a = document.createElement('textarea'); a.value = txt; document.body.appendChild(a); a.select(); const ok = document.execCommand('copy'); a.remove(); return ok; }
}
// Tengah malam WIB berikutnya (UTC+7, tanpa DST) -> milidetik epoch
export function nextMidnightWIB(now = Date.now()) {
  const wib = now + 7 * 3600e3, day = Math.floor(wib / 86400e3);
  return (day + 1) * 86400e3 - 7 * 3600e3;
}
export function lightbox(src) {
  const d = document.createElement('div'); d.className = 'lightbox'; d.innerHTML = `<img src="${esc(src)}" alt="">`;
  d.addEventListener('click', () => d.remove()); document.body.appendChild(d);
}
// Cloudinary: sisipkan transformasi (mis. thumbnail) ke URL upload
export const cldThumb = (url, t = 'w_520,q_auto,f_auto') => String(url || '').replace('/upload/', `/upload/${t}/`);
