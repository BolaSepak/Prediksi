// Gerbang kode harian: kode = ID dokumen pred_codes/{KODE}. Rules hanya mengizinkan "get" (tidak bisa daftar/list),
// dan hanya bila expiresAt belum lewat. Kode berganti tiap 00:00 WIB (dibuat dari halaman /admin).
import { db, doc, getDoc } from './firebase.js';
import { COL } from './config.js';
const KEY = 'bolasepak.session';
export const norm = s => String(s || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6);

export async function verify(code) {
  code = norm(code);
  if (code.length !== 6) return { ok: false, reason: 'Kode harus 6 huruf.' };
  try {
    const s = await getDoc(doc(db, COL.codes, code));
    if (!s.exists()) return { ok: false, reason: 'Kode salah atau sudah berganti.' };
    const exp = s.data().expiresAt && s.data().expiresAt.toMillis ? s.data().expiresAt.toMillis() : 0;
    if (exp <= Date.now()) return { ok: false, reason: 'Kode sudah kedaluwarsa.' };
    return { ok: true, code, exp };
  } catch (e) {
    // permission-denied = dokumen tidak ada / sudah kedaluwarsa menurut rules
    if (e && (e.code === 'permission-denied')) return { ok: false, reason: 'Kode salah atau sudah berganti.' };
    return { ok: false, reason: 'Tidak bisa memeriksa kode (koneksi/Firebase). Coba lagi.', net: true };
  }
}
export function save(v) { try { localStorage.setItem(KEY, JSON.stringify({ code: v.code, exp: v.exp })); } catch {} }
export function clear() { try { localStorage.removeItem(KEY); } catch {} }
/** Sesi tersimpan yang masih berlaku (dicek ulang ke server). null = harus masukkan kode lagi. */
export async function restore() {
  let s; try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch {}
  if (!s || !s.code || s.exp <= Date.now()) { clear(); return null; }
  const v = await verify(s.code);
  if (v.ok) { save(v); return v; }
  if (v.net) return s;   // offline: percaya sesi lokal sampai waktunya habis
  clear(); return null;
}
