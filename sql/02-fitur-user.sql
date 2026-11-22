-- TEKNOA.ID - FITUR USER (profil dan notifikasi)
-- ADITIF & aman diulang: hanya membuat tabel/fungsi baru. Tidak menyentuh tabel lama.
-- Isolasi data: RLS di setiap tabel, user hanya boleh baris dengan user_id = auth.uid().
-- Keranjang memakai tabel cart_items (dibuat terpisah).

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 60),
  avatar_url text check (avatar_url is null or (avatar_url ~ '^https://' and char_length(avatar_url) <= 500)),
  updated_at timestamptz not null default now()
);
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
alter table public.notifications enable row level security;

do $$ begin
  -- profiles
  drop policy if exists "profil: lihat sendiri" on public.profiles;
  drop policy if exists "profil: buat sendiri" on public.profiles;
  drop policy if exists "profil: ubah sendiri" on public.profiles;
  create policy "profil: lihat sendiri" on public.profiles for select to authenticated using (user_id = (select auth.uid()));
  create policy "profil: buat sendiri"  on public.profiles for insert to authenticated with check (user_id = (select auth.uid()));
  create policy "profil: ubah sendiri"  on public.profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  -- notifications: user hanya BACA + tandai dibaca + hapus. Pembuatan hanya lewat fungsi/trigger server.
  drop policy if exists "notif: lihat sendiri" on public.notifications;
  drop policy if exists "notif: ubah sendiri" on public.notifications;
  drop policy if exists "notif: hapus sendiri" on public.notifications;
  create policy "notif: lihat sendiri" on public.notifications for select to authenticated using (user_id = (select auth.uid()));
  create policy "notif: ubah sendiri"  on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  create policy "notif: hapus sendiri" on public.notifications for delete to authenticated using (user_id = (select auth.uid()));
end $$;

-- Hak tabel: anon tidak punya akses; user hanya kolom yang perlu (notif: hanya kolom "dibaca" yang bisa diubah).
revoke all on public.profiles, public.notifications from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, delete on public.notifications to authenticated;
grant update (dibaca) on public.notifications to authenticated;
