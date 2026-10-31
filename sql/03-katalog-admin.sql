-- TEKNOA.ID - KATALOG, STORAGE, DAN HAK AKSES ADMIN (ADITIF)
-- URUTAN: 00 (audit) -> 01 (role owner; WAJIB dulu, fungsi is_owner/get_my_role) -> 02 (fitur user) -> 03 (ini) -> 04 (verifikasi).
-- Asumsi dari kode (schema.sql asli tidak ada di ZIP): tabel produk, banner, config, admin_emails(email) sudah ada,
-- dan fungsi public.is_admin() sudah ada. Jalankan 00-audit dulu; bila beda, sesuaikan.

-- 1) Kolom baru katalog (tidak menghapus data lama)
alter table public.produk add column if not exists deskripsi text check (deskripsi is null or char_length(deskripsi) <= 2000);
alter table public.produk add column if not exists status text not null default 'tersedia';
alter table public.produk add column if not exists foto_tambahan text[] not null default '{}';
do $$ begin
  alter table public.produk add constraint produk_status_chk check (status in ('tersedia','tidak_tersedia'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.produk add constraint produk_foto_tambahan_chk check (cardinality(foto_tambahan) <= 5);
exception when duplicate_object then null; end $$;

-- 2) Bersihkan policy lama pada tabel katalog agar policy permissive lama tidak melewati aturan baru.
-- Publik hanya membaca; admin/owner boleh menulis lewat public.is_admin().
DO $$ DECLARE t text; p record; BEGIN
  FOREACH t IN ARRAY ARRAY['produk','banner','config'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)', t||': publik baca', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t||': admin tulis', t);
  END LOOP;
END $$;

-- 3) Daftar admin: hapus seluruh policy lama untuk mencegah akses lama yang terlalu longgar.
ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_emails FROM anon, authenticated;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='admin_emails' LOOP
    EXECUTE format('DROP POLICY %I ON public.admin_emails', p.policyname);
  END LOOP;
END $$;
CREATE POLICY "owner kelola admin" ON public.admin_emails FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY "admin lihat diri sendiri" ON public.admin_emails FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin' AND lower(email) = lower(auth.jwt() ->> 'email'));
GRANT SELECT ON public.admin_emails TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.admin_emails TO authenticated;

-- 4) Storage bucket "media": publik (baca via URL), batas ukuran & jenis file di SISI SERVER.
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;
update storage.buckets set public = true, file_size_limit = 52428800,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']
 where id = 'media';

-- Bersihkan policy Storage lama supaya tidak ada policy permissive yang memberi hak tulis ke user biasa.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', p.policyname);
  END LOOP;
END $$;
CREATE POLICY "media: admin unggah" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND public.is_admin());
CREATE POLICY "media: admin ubah" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND public.is_admin()) WITH CHECK (bucket_id = 'media' AND public.is_admin());
CREATE POLICY "media: admin hapus" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND public.is_admin());
-- Bucket media bersifat public untuk akses file melalui URL; tidak ada policy SELECT/listing untuk anon.
