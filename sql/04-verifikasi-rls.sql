-- TEKNOA.ID - VERIFIKASI HAK AKSES (jalankan di Supabase SQL Editor SETELAH 01-03)
-- Meniru user biasa (email acak, bukan admin) lalu mencoba menulis. Semua DIBATALKAN (rollback), data tidak berubah.
-- Jalankan hanya setelah 01-03 sukses. Periksa Notices, bukan hanya status query. Jika struktur kolom berbeda, tes yang menyebut kolom itu bisa gagal karena skema.
-- Hasil ada di tab "Messages/Notices": setiap baris berawal LULUS atau GAGAL. Bila ada GAGAL, RLS terlalu longgar.
-- (Pengujian admin sungguhan tetap dilakukan lewat panel admin dengan login Google.)
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-0000000000aa','email','bukan-admin@example.com','role','authenticated')::text, true);

do $$
declare n int;
begin
  raise notice '%', case when public.is_admin() then 'GAGAL: user acak dianggap admin' else 'LULUS: user acak bukan admin' end;
  raise notice 'INFO get_my_role = %', public.get_my_role();

  -- tulis katalog
  begin insert into public.produk (kategori, merek, seri, harga) values ('gaming','TES','TES',1); raise notice 'GAGAL: user biasa bisa INSERT produk';
  exception when others then raise notice 'LULUS: INSERT produk ditolak (%)', sqlerrm; end;
  update public.produk set harga = harga; get diagnostics n = row_count;
  raise notice '%', case when n = 0 then 'LULUS: UPDATE produk tidak mengubah baris' else 'GAGAL: user biasa bisa UPDATE produk ('||n||' baris)' end;
  delete from public.produk; get diagnostics n = row_count;
  raise notice '%', case when n = 0 then 'LULUS: DELETE produk tidak menghapus baris' else 'GAGAL: user biasa bisa DELETE produk ('||n||' baris)' end;
  update public.config set wa = wa; get diagnostics n = row_count;
  raise notice '%', case when n = 0 then 'LULUS: config tidak bisa diubah' else 'GAGAL: user biasa bisa ubah config' end;
  update public.banner set aktif = aktif; get diagnostics n = row_count;
  raise notice '%', case when n = 0 then 'LULUS: banner tidak bisa diubah' else 'GAGAL: user biasa bisa ubah banner' end;

  -- jadi admin sendiri?
  begin insert into public.admin_emails (email) values ('bukan-admin@example.com'); raise notice 'GAGAL: user biasa bisa mendaftarkan dirinya admin';
  exception when others then raise notice 'LULUS: INSERT admin_emails ditolak (%)', sqlerrm; end;
  update public.admin_emails set role = 'owner'; get diagnostics n = row_count;
  raise notice '%', case when n = 0 then 'LULUS: role tidak bisa diubah user biasa' else 'GAGAL: user biasa bisa ubah role' end;
  select count(*) into n from public.admin_emails;
  raise notice '%', case when n = 0 then 'LULUS: user biasa tidak bisa membaca daftar admin' else 'GAGAL: daftar admin terbaca user biasa ('||n||' baris)' end;

  -- Storage
  begin insert into storage.objects (bucket_id, name) values ('media','uji/tes.jpg'); raise notice 'GAGAL: user biasa bisa upload ke bucket media';
  exception when others then raise notice 'LULUS: upload bucket media ditolak (%)', sqlerrm; end;
  delete from storage.objects where bucket_id = 'media'; get diagnostics n = row_count;
  raise notice '%', case when n = 0 then 'LULUS: user biasa tidak bisa menghapus file media' else 'GAGAL: user biasa bisa menghapus file media' end;
end $$;
rollback;

-- Sebagai pembanding, setelah rollback jalankan 00-audit-readonly.sql bagian 2-3 dan periksa tidak ada policy
-- dengan "using (true)" / "with check (true)" untuk INSERT/UPDATE/DELETE pada produk, banner, config, admin_emails, storage.objects.
