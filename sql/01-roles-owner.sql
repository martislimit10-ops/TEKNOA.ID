-- TEKNOA.ID - PERAN OWNER / ADMIN (ADITIF, tidak menghapus data)
-- JALANKAN 00-audit-readonly.sql DULU. Skrip ini MENGASUMSIKAN public.admin_emails punya kolom "email"
-- (disimpulkan dari kode; belum bisa diverifikasi karena schema.sql/migrasi.sql tidak ada di ZIP).
-- Bila kolomnya berbeda, ubah "email" di bawah sebelum menjalankan.

alter table public.admin_emails add column if not exists role text not null default 'admin';
do $$ begin
  alter table public.admin_emails add constraint admin_emails_role_chk check (role in ('owner','admin'));
exception when duplicate_object then null; end $$;

-- Tetapkan owner sebelum migrasi lain. Migrasi berhenti jika email owner tidak ada tepat satu baris.
DO $$
DECLARE jumlah integer;
BEGIN
  UPDATE public.admin_emails
     SET role = 'owner'
   WHERE lower(email) = lower('laptopmakassar1@gmail.com');
  GET DIAGNOSTICS jumlah = ROW_COUNT;
  IF jumlah <> 1 THEN
    RAISE EXCEPTION 'Email owner harus sudah ada tepat satu kali di public.admin_emails; jumlah baris cocok: %', jumlah;
  END IF;
END $$;

-- Peran dari JWT yang sudah diverifikasi Supabase. Admin wajib punya identitas Google
-- (email dari Facebook/Apple/Microsoft tidak selalu terverifikasi -> risiko menyamar sebagai admin).
create or replace function public.get_my_role() returns text
language sql stable security definer set search_path = public, auth as $$
  select coalesce((
    select a.role from public.admin_emails a
     where lower(a.email) = lower(auth.jwt() ->> 'email')
       and exists (select 1 from auth.identities i where i.user_id = auth.uid() and i.provider = 'google')
     limit 1), 'user');
$$;
revoke all on function public.get_my_role() from public, anon;
grant execute on function public.get_my_role() to authenticated;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$ select public.get_my_role() = 'owner'; $$;
revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

-- Hanya owner yang boleh mengubah daftar admin. (Aktifkan setelah owner ditetapkan di atas.)
-- alter table public.admin_emails enable row level security;
-- drop policy if exists "owner kelola admin" on public.admin_emails;
-- create policy "owner kelola admin" on public.admin_emails for all to authenticated
--   using (public.is_owner()) with check (public.is_owner());

-- Cegah owner terakhir terhapus / diturunkan (anti terkunci).
create or replace function public.jaga_owner_terakhir() returns trigger language plpgsql as $$
begin
  if (tg_op='DELETE' and old.role='owner') or (tg_op='UPDATE' and old.role='owner' and new.role<>'owner') then
    if (select count(*) from public.admin_emails where role='owner' and ctid<>old.ctid) = 0 then
      raise exception 'Tidak boleh menghapus/menurunkan owner terakhir';
    end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
drop trigger if exists trg_jaga_owner on public.admin_emails;
create trigger trg_jaga_owner before update or delete on public.admin_emails for each row execute function public.jaga_owner_terakhir();

-- Semua keputusan admin harus mengikuti role DB dan identitas Google terverifikasi.
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_my_role() IN ('owner', 'admin');
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
-- Semua policy katalog/storage yang memanggil is_admin() otomatis mengikuti aturan ini.
