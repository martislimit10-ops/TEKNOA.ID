-- TEKNOA.ID - 06: VERIFIKASI HASIL 05 (aman: hanya membaca, uji tulis dibatalkan dengan ROLLBACK)
-- Jalankan di Supabase SQL Editor SETELAH 05-perbaikan-katalog-permintaan.sql. Lihat tab "Messages/Notices":
-- setiap baris berawal LULUS atau GAGAL. Bila ada GAGAL, kirim hasilnya.

begin;

do $$
declare n int;
begin
  -- struktur
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'produk' and column_name in ('deskripsi','status','foto_tambahan');
  raise notice '%', case when n = 3 then 'LULUS: produk punya kolom deskripsi, status, foto_tambahan' else 'GAGAL: kolom produk kurang (ada '||n||' dari 3)' end;

  select count(*) into n from pg_constraint
   where conrelid = 'public.permintaan_stok'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%disetujui%';
  raise notice '%', case when n = 1 then 'LULUS: permintaan_stok menerima status disetujui' else 'GAGAL: constraint status permintaan_stok belum benar ('||n||')' end;

  select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relname in ('notifications','profiles','produk_unggulan') and c.relrowsecurity;
  raise notice '%', case when n = 3 then 'LULUS: notifications, profiles, produk_unggulan ada dan RLS aktif' else 'GAGAL: tabel baru/RLS kurang ('||n||' dari 3)' end;

  select count(*) into n from pg_trigger where tgrelid = 'public.permintaan_stok'::regclass and tgname = 'trg_permintaan_stok_notif' and not tgisinternal;
  raise notice '%', case when n = 1 then 'LULUS: trigger notifikasi persetujuan terpasang' else 'GAGAL: trigger notifikasi belum ada' end;

  select count(*) into n from public.produk_unggulan;
  raise notice 'INFO produk_unggulan berisi % baris (9 = isi awal dari index.html)', n;

  select count(*) into n from pg_publication_tables
   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename in ('produk','permintaan_stok','notifications','produk_unggulan');
  raise notice '%', case when n = 4 then 'LULUS: realtime aktif untuk produk, permintaan_stok, notifications, produk_unggulan' else 'GAGAL: realtime kurang ('||n||' dari 4)' end;
end $$;

-- ===== meniru USER BIASA (bukan admin) =====
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-0000000000aa','email','bukan-admin@example.com','role','authenticated')::text, true);

do $$
declare n int;
begin
  raise notice '%', case when public.is_admin() then 'GAGAL: user acak dianggap admin' else 'LULUS: user acak bukan admin' end;

  begin insert into public.produk_unggulan (judul, foto_url) values ('TES','https://example.com/x.jpg'); raise notice 'GAGAL: user biasa bisa INSERT produk_unggulan';
  exception when others then raise notice 'LULUS: INSERT produk_unggulan ditolak (%)', sqlerrm; end;
  update public.produk_unggulan set judul = judul; get diagnostics n = row_count;
  raise notice '%', case when n = 0 then 'LULUS: user biasa tidak bisa UPDATE produk_unggulan' else 'GAGAL: user biasa bisa UPDATE produk_unggulan ('||n||' baris)' end;
  delete from public.produk_unggulan; get diagnostics n = row_count;
  raise notice '%', case when n = 0 then 'LULUS: user biasa tidak bisa DELETE produk_unggulan' else 'GAGAL: user biasa bisa DELETE produk_unggulan ('||n||' baris)' end;
  select count(*) into n from public.produk_unggulan where not aktif;
  raise notice '%', case when n = 0 then 'LULUS: kartu nonaktif tidak terlihat user biasa' else 'GAGAL: kartu nonaktif terlihat user biasa' end;

  begin insert into public.notifications (user_id, judul) values ('00000000-0000-0000-0000-0000000000aa','palsu'); raise notice 'GAGAL: user biasa bisa membuat notifikasi';
  exception when others then raise notice 'LULUS: user biasa tidak bisa membuat notifikasi (%)', sqlerrm; end;

  update public.permintaan_stok set status = 'disetujui'; get diagnostics n = row_count;
  raise notice '%', case when n = 0 then 'LULUS: user biasa tidak bisa menyetujui permintaan' else 'GAGAL: user biasa bisa menyetujui permintaan ('||n||' baris)' end;
  select count(*) into n from public.permintaan_stok;
  raise notice '%', case when n = 0 then 'LULUS: user biasa tidak melihat permintaan orang lain' else 'GAGAL: user biasa melihat permintaan orang lain ('||n||' baris)' end;
  select count(*) into n from public.notifications;
  raise notice '%', case when n = 0 then 'LULUS: user biasa tidak melihat notifikasi orang lain' else 'GAGAL: notifikasi orang lain terlihat ('||n||' baris)' end;
  select count(*) into n from public.profiles;
  raise notice '%', case when n = 0 then 'LULUS: user biasa tidak melihat profil orang lain' else 'GAGAL: profil orang lain terlihat ('||n||' baris)' end;

  update public.produk set status = 'tidak_tersedia'; get diagnostics n = row_count;
  raise notice '%', case when n = 0 then 'LULUS: user biasa tidak bisa mengubah stok produk' else 'GAGAL: user biasa bisa mengubah stok produk ('||n||' baris)' end;
end $$;

rollback;
