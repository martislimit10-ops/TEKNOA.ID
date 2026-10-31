/* =====================================================================
   LAPTOP MAKASSAR - KONFIGURASI BERSAMA (dipakai index.html & admin.html)
   Muat SETELAH library supabase-js dan SEBELUM script.js / admin.js.

   >>> ISI 2 NILAI DI BAWAH dari Supabase > Project Settings > API <<<
   - SUPABASE_URL      : "Project URL"
   - SUPABASE_ANON_KEY : kunci "anon public" (AMAN dipublikasikan).
   JANGAN PERNAH menaruh "service_role" atau kunci Gemini di file ini.
   ===================================================================== */
const SUPABASE_URL      = 'https://yoafuzhmyhchochqkrpu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvYWZ1emhteWhjaG9jaHFrcnB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjI5MjQsImV4cCI6MjEwNjIzODkyNH0.-oT62ybhKl04uBMIgc2EFD4p_bvdsC3aUB7sp0KWboc';

/* Alamat situs (RENCANA domain; ubah bila domain final berbeda). Dipakai tautan antar-situs.
   Kosongkan saat uji lokal. Panel admin sekarang di folder admin/ (situs terpisah). */
const SITUS_PUBLIK = 'https://teknoa.id';
const SITUS_ADMIN  = 'https://admin.teknoa.id';

const BUCKET = 'media'; // bucket Storage publik untuk semua foto & video

/* Login Google (popup pilih akun). Isi dengan "Client ID" dari Google Cloud Console
   (bentuk: 123456-abcdef.apps.googleusercontent.com). AMAN dipublikasikan.
   JANGAN taruh "Client secret" di sini; secret hanya diisi di dashboard Supabase.
   Jika dikosongkan, login tetap jalan lewat halaman login Google (OAuth redirect).
   Lihat PANDUAN-LOGIN-GOOGLE.md. */
const GOOGLE_CLIENT_ID = '455706883223-1c5mjtibil0dib1fhqa0a06o4evkdmdp.apps.googleusercontent.com';

/* Pilihan login yang TAMPIL di lembar "Log in". true = tampil, false = disembunyikan.
   - google, facebook, email : tampil di layar awal.
   - apple, microsoft, chatgpt : tampil setelah menekan "Lanjutkan dengan cara lain".
   Facebook, Apple, dan Microsoft baru berfungsi setelah diaktifkan di Supabase
   (Authentication > Sign In / Providers) -- lihat PANDUAN-LOGIN-GOOGLE.md bagian 8.
   chatgpt dimatikan: "Sign in with ChatGPT" saat ini hanya untuk mitra komersial OpenAI,
   jadi belum bisa dipakai situs biasa. Nyalakan hanya bila sudah punya akses. */
const LOGIN_PROVIDER = {
  google: true, facebook: true, email: true,
  apple: true, microsoft: true,
  chatgpt: false
};
/* Penghubung ke nama provider di Supabase. ChatGPT memakai "custom OIDC" -> beri nama
   pengenal yang sama persis dengan yang dibuat di Supabase (harus diawali custom:). */
const NAMA_PROVIDER_SB = { google: 'google', facebook: 'facebook', apple: 'apple', microsoft: 'azure', chatgpt: 'custom:chatgpt' };

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* Gambar pengganti jika foto gagal dimuat */
window.FOTO_KOSONG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#eceef1"/>' +
  '<g fill="none" stroke="#9aa1ab" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">' +
  '<rect x="130" y="95" width="140" height="95" rx="8"/><path d="M110 210h180"/></g></svg>');

/* Nilai awal info toko (dipakai bila tabel config masih kosong) */
const CONFIG_AWAL = {
  wa: '6285117822767',
  alamat: 'Jl. Sepakat, Tamarunang, Kec. Somba Opu, Kabupaten Gowa, Sulawesi Selatan 92112',
  jam: 'Senin - Minggu: 09.00 - 11.00 WITA',
  instagram: 'laptop_makassar',
  tiktok: 'laptop_makassar',
  email: 'ibnrfy01@gmail.com',
  maps_link: 'https://maps.app.goo.gl/CrUqGD1NqXt19Kpy9',
  peta_embed_url: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3973.8058219468516!2d119.4925!3d-5.1353!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNsKwMDgnMQuMSJTIDExOWKwDI5JzMzLjAiRQ!5e0!3m2!1sid!2sid!4v1650000000000!5m2!1sid!2sid',
  pesan_umum: 'Assalamualaikum, Laptop Makassar',
  deskripsi: 'Toko laptop baru dan bekas berkualitas di Makassar dan Gowa. Semua unit sudah dicek, bergaransi, dan harganya jujur.'
};

/* Kategori, label, dan kondisi produk (id harus sama dengan isi kolom produk.kategori) */
const KATEGORI = [
  { id: 'gaming',   label: 'Laptop Gaming' },
  { id: 'macbook',  label: 'MacBook' },
  { id: 'vivobook', label: 'Asus Vivobook' },
  { id: 'celeron',  label: 'Celeron / Daily' },
  { id: 'lenovo',   label: 'Lenovo' },
  { id: 'hpdell',   label: 'HP & Dell' }
];
const LABEL_TAG = { promo: 'Promo', baru: 'Baru masuk', terlaris: 'Terlaris' };
const KONDISI = {
  bekas: { label: 'Bekas, mulus', detail: 'Sudah dicek semua fungsi: layar, keyboard, port, baterai, dan wifi. Tidak ada minus yang mengganggu pemakaian.', kelengkapan: 'Charger dan dus laptop', garansi: 'Garansi toko 1 bulan' },
  baru:  { label: 'Baru, segel',  detail: 'Unit baru dari distributor dan belum pernah dipakai.', kelengkapan: 'Charger original, dus, dan buku panduan', garansi: 'Garansi toko 1 tahun' }
};

/* Pembantu umum */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rupiah = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(Number(n) || 0);
const namaLengkap = p => `${p.merek || ''} ${p.seri || ''}`.trim();
