# Panduan Deploy TEKNOA.ID (satu repo, satu situs: website + panel admin)

Situs statis, tanpa build. Satu repo GitHub, satu project hosting (Netlify, Cloudflare Pages, Vercel, GitHub Pages, dll).

## Struktur
| Alamat | File |
|---|---|
| `https://teknoa.id/` | `index.html`, `script.js`, `auth.js`, `style.css`, `images/` ... |
| `https://teknoa.id/admin/` | `admin/index.html`, `admin/admin.js`, `admin/admin-auth.js`, `admin/admin.css` |

- Deploy **seluruh repo** (publish directory = root). Tidak ada lagi project/subdomain `admin.teknoa.id` yang terpisah; bila sudah ada, hapus saja.
- `supabase-config.js` dan folder `images/` dipakai bersama (admin memuatnya lewat `../`). Cukup ubah di satu tempat.
- **service_role key tidak boleh ada di repo.** Satu-satunya secret server: `GEMINI_API_KEY` (Edge Function `cari-ai`).
- `_headers` (Netlify/Cloudflare Pages) memberi header keamanan khusus `/admin/*`. `robots.txt` melarang indeks `/admin/` dan `/sql/`. Di GitHub Pages `_headers` tidak berlaku (tidak masalah, halaman admin sudah `noindex` dan data dijaga RLS).
- Folder `sql/` hanya untuk dijalankan di Supabase SQL Editor; boleh dihapus dari hosting bila mau.

## Supabase > Authentication > URL Configuration
- **Site URL**: `https://teknoa.id`
- **Redirect URLs**: `https://teknoa.id/`, `https://teknoa.id/admin/` (tambah `http://localhost:3000/` dan `http://localhost:3000/admin/` untuk uji lokal).

## Google Cloud Console > Credentials (OAuth Client)
- Authorized JavaScript origins: `https://teknoa.id` (cukup satu, `admin.teknoa.id` tidak dipakai lagi; tambah `http://localhost:3000` untuk uji lokal).
- Authorized redirect URI: `https://yoafuzhmyhchochqkrpu.supabase.co/auth/v1/callback`

## Catatan satu situs = satu sesi login
Website dan admin sekarang satu alamat, jadi sesi login Supabase dipakai bersama. Admin yang login di `/admin/` juga tampil login di website. User biasa yang membuka `/admin/` ditolak, diarahkan ke website, dan **tidak** dikeluarkan dari akunnya. Keamanan tetap di database (RLS + `get_my_role()`), bukan di tampilan.

## Menjalankan lokal
`npx serve .` lalu buka `http://localhost:3000/` (website) dan `http://localhost:3000/admin/` (admin). Jangan buka lewat `file://`.

## Database
Urutan SQL: `00-audit-readonly` -> `01-roles-owner` -> `02-fitur-user` -> `03-katalog-admin` -> `04-verifikasi-rls` (rincian di Revisi 7 & 8 di bawah).

---
## Revisi 7: login admin & area akun

**Menjalankan panel admin secara lokal (jangan klik dua kali `admin/index.html`).** Buka lewat server: `npx serve .` lalu `http://localhost:3000/admin/`. Dengan `file://`, login Google tidak bisa jalan (halaman akan menampilkan pesan).

**Mengapa dulu admin "kembali ke situs publik".** Login lama memakai redirect: setelah memilih akun Google, Supabase hanya mengembalikan ke alamat yang ada di *Redirect URLs*. Alamat admin/localhost belum terdaftar, jadi Supabase memakai *Site URL* (situs publik). Sekarang tombol Google di halaman admin tidak memakai redirect (token Google langsung dipakai di halaman itu), sehingga tidak bergantung pada daftar tersebut. Syaratnya satu: alamat halaman admin (mis. `http://localhost:3000` dan `https://teknoa.id/admin/`) harus ada di Google Cloud > *Authorized JavaScript origins*. Alamat yang dipakai tertulis di halaman login.

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

**Menguji panel admin.** `npx serve .` → `http://localhost:3000/admin/` (tambahkan ke Google Cloud *Authorized JavaScript origins*).
1. Login admin → Produk → *Tambah produk*: isi data, tambah 2–3 foto, atur foto utama, Simpan. Buka situs publik: produk muncul (realtime), detail menampilkan galeri.
2. *Ubah* → ganti foto utama → Simpan; muat ulang situs publik: foto baru tampil. Di Supabase > Storage > media, file lama hilang.
3. Ubah status ke *Tidak tersedia*: kartu menampilkan lencana dan tombol keranjang nonaktif.
4. Hapus produk: konfirmasi muncul, baris dan foto terhapus.
5. Login dengan akun Google non-admin di panel: ditolak. Jalankan `04-verifikasi-rls.sql`.
Catatan: Edge Function `cari-ai` (chatbot) belum menyaring produk "tidak tersedia".
