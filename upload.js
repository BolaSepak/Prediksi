import { CLOUDINARY } from './config.js';

/** Kecilkan gambar di browser (maks sisi 1280px, JPEG), seperti unggahan Google Form yang diperkecil dulu. */
export async function shrink(file, { maxEdge = 1280, targetKB = 400 } = {}) {
  if (!file || !/^image\//.test(file.type)) throw new Error('File harus berupa gambar (JPG/PNG).');
  if (file.size > 25 * 1048576) throw new Error('Gambar terlalu besar (maks 25 MB).');
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { bmp = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('Gambar tidak bisa dibaca.')); i.src = URL.createObjectURL(file); }); }
  const w0 = bmp.width || bmp.naturalWidth, h0 = bmp.height || bmp.naturalHeight;
  let edge = Math.min(maxEdge, Math.max(w0, h0)), blob = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const k = edge / Math.max(w0, h0), cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w0 * k)); cv.height = Math.max(1, Math.round(h0 * k));
    const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(bmp, 0, 0, cv.width, cv.height);
    for (const q of [0.82, 0.68, 0.55]) {
      blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', q));
      if (blob && blob.size <= targetKB * 1024) break;
    }
    if (blob && blob.size <= targetKB * 1024) break;
    edge = Math.round(edge * 0.8);
  }
  if (!blob) throw new Error('Gagal memproses gambar.');
  if (blob.size >= file.size && /jpe?g/.test(file.type)) blob = file;   // sudah kecil, pakai aslinya
  return { blob, name: (file.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg', before: file.size, after: blob.size };
}

/** Unggah ke Cloudinary (unsigned preset). onProgress(0..1). Mengembalikan secure_url. */
export function uploadImage(blob, name, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData(); fd.append('file', blob, name); fd.append('upload_preset', CLOUDINARY.preset);
    const x = new XMLHttpRequest();
    x.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloud}/image/upload`);
    x.upload.onprogress = e => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    x.onload = () => {
      try { const j = JSON.parse(x.responseText); if (x.status >= 200 && x.status < 300 && j.secure_url) return resolve(j.secure_url); reject(new Error((j.error && j.error.message) || 'Upload gagal')); }
      catch { reject(new Error('Upload gagal')); }
    };
    x.onerror = () => reject(new Error('Koneksi terputus saat upload.'));
    x.send(fd);
  });
}
