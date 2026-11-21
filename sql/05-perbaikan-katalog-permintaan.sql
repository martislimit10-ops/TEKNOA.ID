-- TEKNOA.ID - 05: PERBAIKAN KATALOG, STOK, PERMINTAAN, NOTIFIKASI, PROFIL, PRODUK UNGGULAN
-- ADITIF dan AMAN DIULANG (idempotent). Hasil audit database live (18 Nov 2026):
--   * produk belum punya kolom deskripsi / status / foto_tambahan  -> penyebab error "Kolom baru belum ada di database"
--   * permintaan_stok hanya mengenal status menunggu/ditangani     -> belum ada "disetujui"
--   * tabel notifications dan profiles belum ada                    -> akun jatuh ke penyimpanan lokal
--   * tidak ada tabel untuk kartu "Jelajahi jajarannya" di beranda -> masih statis di index.html
-- Skrip ini TIDAK: menghapus data, menghapus kolom, menghapus/mengganti policy tabel lain, menyentuh
-- is_admin(), admin_emails, bucket Storage, atau tabel banner/config/video/home_banners.
-- JANGAN jalankan 01-roles-owner.sql dan 03-katalog-admin.sql di database ini: keduanya menghapus semua policy
-- lama (termasuk policy baca banner dan Storage) dan mengganti is_admin() dengan versi yang lebih longgar.
-- Cara pakai: Supabase > SQL Editor > tempel seluruh isi file ini > Run. Lalu jalankan 06-verifikasi-05.sql.

begin;

-- ============================================================
-- 1) KATALOG: kolom baru pada produk (data lama aman; produk lama otomatis "tersedia")
-- ============================================================
alter table public.produk add column if not exists deskripsi text;
alter table public.produk add column if not exists status text not null default 'tersedia';
alter table public.produk add column if not exists foto_tambahan text[] not null default '{}';

do $$ begin
  alter table public.produk add constraint produk_deskripsi_chk check (deskripsi is null or char_length(deskripsi) <= 2000);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.produk add constraint produk_status_chk check (status in ('tersedia','tidak_tersedia'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.produk add constraint produk_foto_tambahan_chk check (cardinality(foto_tambahan) <= 5);
exception when duplicate_object then null; end $$;

-- ============================================================
-- 2) PERMINTAAN STOK: tambah status "disetujui" + notifikasi otomatis saat disetujui
-- ============================================================
do $$
declare c text;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.permintaan_stok'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ilike '%status%' loop
    execute format('alter table public.permintaan_stok drop constraint %I', c);
  end loop;
  alter table public.permintaan_stok
    add constraint permintaan_stok_status_check check (status in ('menunggu','ditangani','disetujui'));
end $$;

-- Pengisi otomatis (versi lama + dukungan "disetujui"). User biasa tidak punya hak UPDATE (policy "admin ubah").
create or replace function public.permintaan_stok_isi() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then raise exception 'Harus login'; end if;
    new.user_id := auth.uid(); new.status := 'menunggu'; new.handled_at := null; new.created_at := now();
    new.email := lower(coalesce(auth.jwt() ->> 'email', ''));
    select trim(coalesce(merek,'') || ' ' || coalesce(seri,'')) into new.nama_produk from public.produk where id = new.product_id;
  else
    new.user_id := old.user_id; new.product_id := old.product_id; new.email := old.email;
    new.nama_produk := old.nama_produk; new.created_at := old.created_at;
    new.handled_at := case when new.status in ('ditangani','disetujui') then coalesce(old.handled_at, now()) else null end;
  end if;
  return new;
end $$;

-- ============================================================
-- 3) NOTIFIKASI USER (dibuat HANYA oleh trigger server; user cuma baca / tandai dibaca / hapus)
-- ============================================================
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tipe text not null default 'info',
  judul text not null check (char_length(judul) <= 120),
  isi text check (isi is null or char_length(isi) <= 400),
  dibaca boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user on public.notifications (user_id, dibaca, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "notif: lihat sendiri" on public.notifications;
drop policy if exists "notif: ubah sendiri" on public.notifications;
drop policy if exists "notif: hapus sendiri" on public.notifications;
create policy "notif: lihat sendiri" on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy "notif: ubah sendiri"  on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notif: hapus sendiri" on public.notifications for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (dibaca) on public.notifications to authenticated;

-- Saat admin mengubah status permintaan menjadi "disetujui" -> satu notifikasi untuk pemintanya.
create or replace function public.permintaan_stok_notif() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'disetujui' and old.status is distinct from 'disetujui' then
    insert into public.notifications (user_id, tipe, judul, isi)
    values (new.user_id, 'permintaan', 'Permintaan disetujui',
            left('Permintaan stok untuk ' || coalesce(nullif(new.nama_produk, ''), 'laptop') ||
                 ' sudah disetujui. Silakan hubungi toko lewat WhatsApp.', 400));
  end if;
  return new;
end $$;
revoke all on function public.permintaan_stok_notif() from public, anon, authenticated;
drop trigger if exists trg_permintaan_stok_notif on public.permintaan_stok;
create trigger trg_permintaan_stok_notif after update of status on public.permintaan_stok
  for each row execute function public.permintaan_stok_notif();

-- ============================================================
-- 4) PROFIL USER (nama tampilan + foto link https)
-- ============================================================
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 60),
  avatar_url text check (avatar_url is null or (avatar_url ~ '^https://' and char_length(avatar_url) <= 500)),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profil: lihat sendiri" on public.profiles;
drop policy if exists "profil: buat sendiri" on public.profiles;
drop policy if exists "profil: ubah sendiri" on public.profiles;
create policy "profil: lihat sendiri" on public.profiles for select to authenticated using (user_id = (select auth.uid()));
create policy "profil: buat sendiri"  on public.profiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy "profil: ubah sendiri"  on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.profiles from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;

-- ============================================================
-- 5) PRODUK UNGGULAN (kartu "Jelajahi jajarannya" di beranda; foto di Storage bucket media, info di tabel ini)
-- ============================================================
create table if not exists public.produk_unggulan (
  id bigint generated always as identity primary key,
  urutan integer not null default 0,
  aktif boolean not null default true,
  grup text not null default 'laptop' check (grup in ('laptop','desktop','display')),
  kategori_toko text not null default 'macbook' check (char_length(kategori_toko) <= 40),
  judul text not null check (char_length(judul) between 1 and 120),
  sub_judul text check (sub_judul is null or char_length(sub_judul) <= 80),
  label text check (label is null or char_length(label) <= 40),
  deskripsi text check (deskripsi is null or char_length(deskripsi) <= 300),
  penjelasan text check (penjelasan is null or char_length(penjelasan) <= 1200),
  poin text[] not null default '{}' check (cardinality(poin) <= 8),
  foto_url text not null check (char_length(foto_url) <= 600 and (foto_url ~ '^https://' or foto_url ~ '^images/')),
  warna jsonb not null default '[]'::jsonb check (jsonb_typeof(warna) = 'array'),
  created_at timestamptz not null default now()
);
create index if not exists produk_unggulan_urut on public.produk_unggulan (urutan, id);
alter table public.produk_unggulan enable row level security;
drop policy if exists "unggulan: publik baca" on public.produk_unggulan;
drop policy if exists "unggulan: admin kelola" on public.produk_unggulan;
create policy "unggulan: publik baca" on public.produk_unggulan for select to anon, authenticated using (aktif);
create policy "unggulan: admin kelola" on public.produk_unggulan for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.produk_unggulan from anon, authenticated;
grant select on public.produk_unggulan to anon;
grant select, insert, update, delete on public.produk_unggulan to authenticated;

-- Isi awal HANYA bila tabel masih kosong: memindahkan 9 kartu yang selama ini tertulis statis di index.html
-- (foto masih di folder images/katalog/; admin bisa menggantinya ke Supabase Storage lewat panel).
insert into public.produk_unggulan (urutan, grup, kategori_toko, judul, sub_judul, label, deskripsi, penjelasan, poin, foto_url, warna)
select * from (values
  (1, 'laptop', 'macbook', 'MacBook Neo', null::text, null::text,
   'Keajaiban Mac dengan harga mengejutkan',
   'Keajaiban Mac dengan harga mengejutkan. Cocok buat yang mau masuk ke dunia Mac tanpa bikin kantong jebol.',
   array['Pintu masuk paling terjangkau ke keluarga MacBook','Ringan dan praktis untuk kuliah, sekolah, dan kerja harian','Tampil dalam 4 warna segar'],
   'images/katalog/foto1.png',
   '[{"c":"#e3e4e6","t":"Perak"},{"c":"#e8d0d0","t":"Pink"},{"c":"#dddc8c","t":"Kuning"},{"c":"#586680","t":"Indigo"}]'::jsonb),
  (2, 'laptop', 'macbook', 'MacBook Air', null, null,
   'Tipis. Cepat. Andal dan portabel',
   'Tipis, cepat, andal, dan portabel. Laptop paling pas buat dibawa ke mana-mana.',
   array['Tersedia ukuran layar 13″ dan 15″','Desain sangat tipis dan ringan','Tenaga cukup untuk kerja, kuliah, dan kreatif sehari-hari'],
   'images/katalog/foto2.png',
   '[{"c":"#c7d8e0","t":"Biru langit"},{"c":"#e3e4e6","t":"Perak"},{"c":"#f0e5d3","t":"Starlight"},{"c":"#2e3641","t":"Midnight"}]'::jsonb),
  (3, 'laptop', 'macbook', 'MacBook Pro', null, '14 baru dengan M6',
   'Laptop bertenaga untuk tiap tipe pro',
   'Laptop bertenaga untuk tiap tipe pro, kini hadir versi 14″ baru dengan chip M6.',
   array['Pilihan ukuran 14″ dan 16″','Chip M6 pada model 14″ baru','Dibuat untuk alur kerja berat: editing, desain, dan pengembangan'],
   'images/katalog/foto3.png',
   '[{"c":"#2e2c2f","t":"Space Black"},{"c":"#e3e4e6","t":"Perak"}]'::jsonb),
  (4, 'laptop', 'macbook', 'MacBook Pro 14', 'Layar PROLED XDR', 'Baru',
   'MacBook Pro paling canggih dengan layar laptop terbaik di dunia',
   'MacBook Pro paling canggih dengan layar laptop terbaik di dunia.',
   array['Layar PROLED XDR dengan kualitas gambar kelas atas','Pilihan ukuran 14″ dan 16″','Untuk kreator dan profesional yang butuh akurasi warna'],
   'images/katalog/foto4.png',
   '[{"c":"#2e2c2f","t":"Space Black"},{"c":"#e3e4e6","t":"Perak"}]'::jsonb),
  (5, 'desktop', 'macbook', 'iMac', null, 'Baru',
   'Desktop lengkap untuk kreativitas dan produktivitas',
   'Desktop lengkap untuk kreativitas dan produktivitas. Layar, komputer, dan desain jadi satu.',
   array['Desktop all-in-one: tinggal colok dan pakai','Layar Retina yang tajam dan cerah','Tersedia dalam 7 warna'],
   'images/katalog/foto5.png',
   '[{"c":"#547eae","c2":"#abc1d8","t":"Biru"},{"c":"#827eb1","c2":"#abb2cf","t":"Ungu"},{"c":"#de5f7d","c2":"#f3b5c4","t":"Pink"},{"c":"#e47049","c2":"#f5c2a7","t":"Oranye"},{"c":"#edd142","c2":"#f5e4ae","t":"Kuning"},{"c":"#3e935c","c2":"#a5c2ae","t":"Hijau"},{"c":"#e3e4e6","t":"Perak"}]'::jsonb),
  (6, 'desktop', 'macbook', 'Mac mini', null, 'Baru',
   'Desktop Mac paling mini dan terjangkau',
   'Desktop Mac paling mini dan terjangkau. Ukurannya kecil, tenaganya tidak.',
   array['Paling ringkas dan paling terjangkau di antara desktop Mac','Muat di meja sempit atau mudah dibawa','Pakai monitor, keyboard, dan mouse pilihanmu'],
   'images/katalog/foto6.png', '[]'::jsonb),
  (7, 'desktop', 'macbook', 'Mac Studio', null, 'Baru',
   'Performa dan konektivitas andal untuk profesional',
   'Performa dan konektivitas andal untuk profesional.',
   array['Tenaga besar untuk render, editing video, dan kerja berat','Banyak port untuk perangkat dan layar tambahan','Desain ringkas, cocok untuk meja kerja studio'],
   'images/katalog/foto7.png', '[]'::jsonb),
  (8, 'display', 'macbook', 'Studio Display', null, null,
   'Layar Retina 5K yang sempurna untuk Mac',
   'Layar Retina 5K yang sempurna untuk Mac.',
   array['Resolusi Retina 5K, gambar dan teks sangat tajam','Dirancang serasi dengan Mac','Enak dipakai kerja seharian'],
   'images/katalog/foto8.png', '[]'::jsonb),
  (9, 'display', 'macbook', 'Studio Display XDR', null, null,
   'Layar Retina XDR 5K terbaik untuk alur kerja kreatif dan pro',
   'Layar Retina XDR 5K terbaik untuk alur kerja kreatif dan pro.',
   array['Layar Retina XDR 5K dengan kecerahan dan kontras tinggi','Untuk editing foto, video, dan grading warna','Pilihan tertinggi untuk alur kerja profesional'],
   'images/katalog/foto9.png', '[]'::jsonb)
) as v(urutan, grup, kategori_toko, judul, sub_judul, label, deskripsi, penjelasan, poin, foto_url, warna)
where not exists (select 1 from public.produk_unggulan);

-- ============================================================
-- 6) REALTIME: perubahan permintaan, notifikasi, dan produk unggulan langsung tampil (menggantikan tombol "Muat ulang")
--    produk sudah ada di publication. Data tetap disaring RLS.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['permintaan_stok','notifications','produk_unggulan'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

commit;
