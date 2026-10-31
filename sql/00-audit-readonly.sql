-- TEKNOA.ID - AUDIT DATABASE (HANYA MEMBACA, aman dijalankan)
-- Supabase > SQL Editor. Jalankan satu per satu, lalu kirim hasilnya agar RLS bisa diaudit sungguhan.
-- 1) Tabel & status RLS
select c.relname as tabel, c.relrowsecurity as rls_aktif from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' order by 1;
-- 2) Semua policy tabel
select tablename, policyname, cmd, roles, qual, with_check from pg_policies where schemaname='public' order by 1,2;
-- 3) Policy Storage (bucket media)
select policyname, cmd, roles, qual, with_check from pg_policies where schemaname='storage' and tablename='objects';
-- 4) Fungsi (lihat isi is_admin & apakah SECURITY DEFINER)
select p.proname, p.prosecdef as security_definer, pg_get_functiondef(p.oid) as definisi
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1;
-- 5) Daftar admin (cek tidak ada email asing) & struktur tabelnya
select column_name, data_type from information_schema.columns where table_schema='public' and table_name='admin_emails';
select * from public.admin_emails;
-- 6) Provider login yang dipakai akun (admin seharusnya hanya 'google')
select u.email, i.provider from auth.identities i join auth.users u on u.id=i.user_id
 where lower(u.email) in (select lower(email) from public.admin_emails);
