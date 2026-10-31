# Panduan Deploy TEKNOA.ID (situs publik + panel admin terpisah)

Hosting belum ditentukan di proyek ini, jadi panduan ini generik untuk hosting statis (Netlify, Cloudflare Pages, Vercel, GitHub Pages, dll). Tidak ada environment variable build: ini situs statis.

## Dua situs, satu Supabase
| Situs | Folder yang di-deploy | Alamat (rencana) |
|---|---|---|
| Publik | root proyek (`index.html`, `script.js`, `auth.js`, `style.css`, `images/`, ...) — **tanpa** folder `admin/` dan `sql/` | teknoa.id |
| Admin | isi folder `admin/` saja (publish directory = `admin`) | admin.teknoa.id |

1. Buat 2 project di hosting yang sama dari repo yang sama: satu root, satu dengan folder `admin`.
2. Domain: tambahkan `teknoa.id` ke project publik dan `admin.teknoa.id` ke project admin; buat record DNS sesuai petunjuk hosting (CNAME/A).
3. Nilai konfigurasi ada di `supabase-config.js` (publik) dan `admin/supabase-config.js` (salinan). Keduanya harus punya URL & anon key yang sama. Anon key aman publik; **service_role key tidak boleh ada di sini**. Satu-satunya secret server: `GEMINI_API_KEY` (Edge Function `cari-ai`, diisi di Supabase > Edge Functions > Secrets).
4. Ubah `SITUS_PUBLIK` / `SITUS_ADMIN` di kedua config bila domain final berbeda.

## Supabase > Authentication > URL Configuration
- **Site URL**: `https://teknoa.id`
- **Redirect URLs** (tepat seperti ini, dengan garis miring akhir):
  `https://teknoa.id/`, `https://admin.teknoa.id/` (tambah `http://localhost:xxxx/` hanya untuk uji lokal).
- Penyebab login "kadang gagal": alamat kembali tidak ada di daftar ini, sehingga Supabase memakai Site URL.

## Google Cloud Console > Credentials (OAuth Client)
- Authorized JavaScript origins: `https://teknoa.id`, `https://admin.teknoa.id`
- Authorized redirect URI: `https://yoafuzhmyhchochqkrpu.supabase.co/auth/v1/callback`
- Provider Google harus aktif di Supabase (Client ID + Secret di dashboard Supabase, bukan di kode).

## Database
1. Jalankan `sql/00-audit-readonly.sql`, kirim hasilnya untuk audit RLS.
2. Ganti email owner di `sql/01-roles-owner.sql`, lalu jalankan. Panel admin otomatis membaca peran (owner/admin) dari `get_my_role()`; bila belum dijalankan, memakai `is_admin()` yang lama.

## Menguji akses admin
1. Buka `admin.teknoa.id` > "Masuk dengan Google" memakai akun admin: panel terbuka, tampil label peran.
2. Masuk dengan akun Google biasa (bukan admin): harus muncul "Akses ditolak" dan otomatis keluar.
3. Di situs publik, login akun biasa lalu buka Console browser: `await sb.from('produk').insert({merek:'x',seri:'x',harga:1,kategori:'gaming'})` harus **ditolak** (RLS). Ulangi untuk `update`/`delete` pada `produk`, `banner`, `config`, dan upload ke bucket `media`. Bila ada yang berhasil, RLS terlalu terbuka (kirim hasil audit SQL).
4. Pastikan situs publik tidak menampilkan tautan/tombol admin.

---
## Revisi 7: login admin & area akun

**Menjalankan panel admin secara lokal (jangan klik dua kali `admin/index.html`).** Buka lewat server: `npx serve admin` lalu `http://localhost:3000`. Dengan `file://`, login Google tidak bisa jalan (halaman akan menampilkan pesan).

**Mengapa dulu admin "kembali ke situs publik".** Login lama memakai redirect: setelah memilih akun Google, Supabase hanya mengembalikan ke alamat yang ada di *Redirect URLs*. Alamat admin/localhost belum terdaftar, jadi Supabase memakai *Site URL* (situs publik). Sekarang tombol Google di halaman admin tidak memakai redirect (token Google langsung dipakai di halaman itu), sehingga tidak bergantung pada daftar tersebut. Syaratnya satu: alamat halaman admin (mis. `http://localhost:3000` dan `https://admin.teknoa.id`) harus ada di Google Cloud > *Authorized JavaScript origins*. Alamat yang dipakai tertulis di halaman login.

**Mendaftarkan admin/owner dengan aman.** Peran dibaca dari database, bukan dari kode. Di Supabase SQL Editor (tanpa menaruh email di frontend):
```sql
insert into public.admin_emails (email) values (lower('email-admin@gmail.com')) on conflict do nothing;
-- setelah sql/01-roles-owner.sql dijalankan:
update public.admin_emails set role='owner' where lower(email)=lower('email-owner@gmail.com');
```
Bila login berhasil tapi muncul "belum terdaftar sebagai admin", artinya email akun Google itu belum ada di `admin_emails` (atau login bukan lewat Google).

**Urutan SQL:** `00-audit-readonly.sql` (baca) → `01-roles-owner.sql` → `02-fitur-user.sql`. Tanpa 02, area akun menampilkan pesan "belum diaktifkan di database" (favorit & keranjang lama tetap jalan).

---
## Revisi 8: katalog, foto, role

**Urutan SQL (Supabase > SQL Editor):** `00-audit-readonly` → `01-roles-owner` (ganti email owner, jalankan baris `update ... role='owner'`) → `02-fitur-user` → `03-katalog-admin` → `04-verifikasi-rls`.
Hasil 04 berupa baris LULUS/GAGAL di tab *Messages*. Bila ada GAGAL, ada policy lama yang terlalu longgar (lihat hasil 00 bagian 2–3 dan hapus policy itu).

**Storage:** bucket `media` (publik) dibuat/diatur oleh `03`: batas 50 MB dan hanya JPG/PNG/WebP/GIF/MP4/WebM/MOV (SVG ditolak server). Policy: hanya `is_admin()` yang upload/ubah/hapus; semua orang bisa melihat foto lewat URL publik. Tidak ada service role key di frontend.

**Role.** Siapa pun bisa login dengan akun Google apa saja. Panel admin memanggil `get_my_role()` di database: `owner`/`admin` → dashboard; selain itu → ditolak dan diarahkan ke website utama (pengalihan dimatikan saat uji di localhost). Owner mengelola admin dari tab **Admin & Role** (tabel `admin_emails`, dilindungi RLS: user biasa tidak bisa membaca atau mengubahnya; owner terakhir tidak bisa dihapus).

**Menguji panel admin.** `npx serve admin` → `http://localhost:3000` (tambahkan ke Google Cloud *Authorized JavaScript origins*).
1. Login admin → Produk → *Tambah produk*: isi data, tambah 2–3 foto, atur foto utama, Simpan. Buka situs publik: produk muncul (realtime), detail menampilkan galeri.
2. *Ubah* → ganti foto utama → Simpan; muat ulang situs publik: foto baru tampil. Di Supabase > Storage > media, file lama hilang.
3. Ubah status ke *Tidak tersedia*: kartu menampilkan lencana dan tombol keranjang nonaktif.
4. Hapus produk: konfirmasi muncul, baris dan foto terhapus.
5. Login dengan akun Google non-admin di panel: ditolak. Jalankan `04-verifikasi-rls.sql`.
Catatan: Edge Function `cari-ai` (chatbot) belum menyaring produk "tidak tersedia".
