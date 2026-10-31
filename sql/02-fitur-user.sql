-- TEKNOA.ID - FITUR USER (profil, riwayat dilihat, perbandingan tersimpan, notifikasi)
-- ADITIF & aman diulang: hanya membuat tabel/fungsi baru. Tidak menyentuh tabel lama.
-- Isolasi data: RLS di setiap tabel, user hanya boleh baris dengan user_id = auth.uid().
-- Favorit memakai tabel lama public.wishlist (sudah ada); keranjang memakai cart_items.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 60),
  avatar_url text check (avatar_url is null or (avatar_url ~ '^https://' and char_length(avatar_url) <= 500)),
  updated_at timestamptz not null default now()
);
create table if not exists public.view_history (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id bigint not null,
  viewed_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index if not exists view_history_user_waktu on public.view_history (user_id, viewed_at desc);
create table if not exists public.saved_comparisons (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nama text not null check (char_length(nama) between 1 and 80),
  product_ids bigint[] not null check (cardinality(product_ids) between 2 and 4),
  created_at timestamptz not null default now()
);
create index if not exists saved_comparisons_user on public.saved_comparisons (user_id, created_at desc);
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tipe text not null default 'info',
  judul text not null check (char_length(judul) <= 120),
  isi text check (isi is null or char_length(isi) <= 400),
  dibaca boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user on public.notifications (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.view_history enable row level security;
alter table public.saved_comparisons enable row level security;
alter table public.notifications enable row level security;

do $$ begin
  -- profiles
  drop policy if exists "profil: lihat sendiri" on public.profiles;
  drop policy if exists "profil: buat sendiri" on public.profiles;
  drop policy if exists "profil: ubah sendiri" on public.profiles;
  create policy "profil: lihat sendiri" on public.profiles for select to authenticated using (user_id = (select auth.uid()));
  create policy "profil: buat sendiri"  on public.profiles for insert to authenticated with check (user_id = (select auth.uid()));
  create policy "profil: ubah sendiri"  on public.profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  -- view_history
  drop policy if exists "riwayat: lihat sendiri" on public.view_history;
  drop policy if exists "riwayat: tulis sendiri" on public.view_history;
  drop policy if exists "riwayat: ubah sendiri" on public.view_history;
  drop policy if exists "riwayat: hapus sendiri" on public.view_history;
  create policy "riwayat: lihat sendiri" on public.view_history for select to authenticated using (user_id = (select auth.uid()));
  create policy "riwayat: tulis sendiri" on public.view_history for insert to authenticated with check (user_id = (select auth.uid()));
  create policy "riwayat: ubah sendiri"  on public.view_history for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  create policy "riwayat: hapus sendiri" on public.view_history for delete to authenticated using (user_id = (select auth.uid()));
  -- saved_comparisons
  drop policy if exists "banding: lihat sendiri" on public.saved_comparisons;
  drop policy if exists "banding: tulis sendiri" on public.saved_comparisons;
  drop policy if exists "banding: hapus sendiri" on public.saved_comparisons;
  create policy "banding: lihat sendiri" on public.saved_comparisons for select to authenticated using (user_id = (select auth.uid()));
  create policy "banding: tulis sendiri" on public.saved_comparisons for insert to authenticated with check (user_id = (select auth.uid()));
  create policy "banding: hapus sendiri" on public.saved_comparisons for delete to authenticated using (user_id = (select auth.uid()));
  -- notifications: user hanya BACA + tandai dibaca + hapus. Pembuatan hanya lewat fungsi/trigger server.
  drop policy if exists "notif: lihat sendiri" on public.notifications;
  drop policy if exists "notif: ubah sendiri" on public.notifications;
  drop policy if exists "notif: hapus sendiri" on public.notifications;
  create policy "notif: lihat sendiri" on public.notifications for select to authenticated using (user_id = (select auth.uid()));
  create policy "notif: ubah sendiri"  on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  create policy "notif: hapus sendiri" on public.notifications for delete to authenticated using (user_id = (select auth.uid()));
end $$;

-- Hak tabel: anon tidak punya akses; user hanya kolom yang perlu (notif: hanya kolom "dibaca" yang bisa diubah).
revoke all on public.profiles, public.view_history, public.saved_comparisons, public.notifications from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.view_history to authenticated;
grant select, insert, delete on public.saved_comparisons to authenticated;
grant select, delete on public.notifications to authenticated;
grant update (dibaca) on public.notifications to authenticated;

-- Notifikasi sambutan (sekali per user), dipanggil situs setelah login pertama.
create or replace function public.notif_selamat_datang() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if not exists (select 1 from public.notifications where user_id = auth.uid() and tipe = 'welcome') then
    insert into public.notifications (user_id, tipe, judul, isi)
    values (auth.uid(), 'welcome', 'Selamat datang!', 'Simpan laptop favorit, bandingkan, dan kami kabari saat harganya turun.');
  end if;
end $$;
revoke all on function public.notif_selamat_datang() from public, anon;
grant execute on function public.notif_selamat_datang() to authenticated;

-- Notifikasi otomatis: harga produk turun -> kabari user yang memfavoritkannya.
create or replace function public.notif_harga_turun() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, tipe, judul, isi)
  select w.user_id, 'harga', 'Harga turun: ' || left(trim(coalesce(new.merek,'') || ' ' || coalesce(new.seri,'')), 80),
         'Dari Rp ' || to_char(old.harga, 'FM999G999G999') || ' menjadi Rp ' || to_char(new.harga, 'FM999G999G999')
    from public.wishlist w where w.product_id = new.id;
  return new;
end $$;
drop trigger if exists trg_notif_harga_turun on public.produk;
create trigger trg_notif_harga_turun after update of harga on public.produk
  for each row when (new.harga < old.harga) execute function public.notif_harga_turun();
