// ============================================================
//  KONFIGURASI TUNGGAL — ubah di sini, tidak perlu menyentuh file lain
// ============================================================

// Sumber data prediksi = situs REPO LAMA (mesin prediksi tetap di sana, repo ini hanya menampilkan).
// Harus berakhiran / dan berisi predictions.json, metadata.json, calibration.json. Ganti bila alamat repo lama berubah.
export const DATA_BASE = 'https://fvcktherules3404-sketch.github.io/prediksi/data/';

// Link grup Telegram (muncul setelah pendaftaran terkirim)
export const TELEGRAM_LINK = 'https://t.me/+r_WV35LTdw4yZTFl';

// Harga default halaman /daftar (bisa diubah dari /admin, tab Harga)
export const DEFAULT_PRICE = 20000;

// Email admin (HARUS sama dengan daftar di firestore.rules; rules yang menjaga keamanan, ini hanya untuk tampilan)
export const ADMIN_EMAILS = ['diasadhityap@gmail.com', 'fvcktherules3404@gmail.com'];

// Cloudinary unsigned upload (akun & preset lama FucktheRules untuk bukti pelanggan, sekarang dipakai di sini)
export const CLOUDINARY = { cloud: 'dfbxrouwf', preset: 'underline-bukti' };

// Firebase (project yang sama dengan toko FucktheRules; ganti kalau mau project sendiri)
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCVL_C4opQiKC6fNG_Rw4l-519rQZICH58',
  authDomain: 'fvcktherules-store.firebaseapp.com',
  projectId: 'fvcktherules-store',
  storageBucket: 'fvcktherules-store.firebasestorage.app',
  messagingSenderId: '382347904485',
  appId: '1:382347904485:web:6715a7b395d44ad07a5b0c'
};

// Nama koleksi Firestore (diawali pred_ supaya aman bila project dipakai bersama toko)
export const COL = { codes: 'pred_codes', daftar: 'pred_daftar', settings: 'pred_settings' };
