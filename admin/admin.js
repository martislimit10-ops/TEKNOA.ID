/* =====================================================================
   LAPTOP MAKASSAR - PANEL ADMIN
   Butuh: supabase-js -> supabase-config.js -> admin.js
   Menu: Dashboard, Hero Desktop/HP, Gambar (Foto Toko), Permintaan, Info & Kontak, Produk.
   Sekali klik "Simpan" -> data masuk Supabase -> halaman depan
   terbarui otomatis (realtime), tanpa mengubah file di GitHub.
   ===================================================================== */

const BATAS_MB = 50;            // batas file Supabase Storage (paket gratis)
let sudahMuat = false;

/* ---------- Pembantu ---------- */
let timerToast;
function toast(teks, tipe) {
  const t = $('#toast'); t.classList.remove('sukses', 'galat'); if (tipe) t.classList.add(tipe);
  t.textContent = teks; t.classList.add('tampil');
  clearTimeout(timerToast); timerToast = setTimeout(() => t.classList.remove('tampil'), tipe === 'galat' ? 4200 : 2600);
}
const pesanGalat = e => {
  const m = (e && (e.message || e.error_description)) || 'Terjadi kesalahan';
  if (e && (e.code === '42501' || /row-level security|permission denied/i.test(m))) return 'Akses ditolak: akun ini tidak punya izin untuk tindakan ini.';
  if (/failed to fetch|networkerror/i.test(m)) return 'Tidak ada koneksi internet.';
  const SQL05 = 'sql/05-perbaikan-katalog-permintaan.sql';
  if (/(produk_unggulan|permintaan_stok|notifications|profiles)/.test(m) && /(does not exist|schema cache|could not find)/i.test(m)) return 'Tabel belum ada di database. Jalankan ' + SQL05 + ' di Supabase.';
  if (/column .*(status|deskripsi|foto_tambahan).* does not exist|(status|deskripsi|foto_tambahan).*column.*schema cache/i.test(m)) return 'Kolom baru belum ada di database. Jalankan ' + SQL05 + ' di Supabase.';
  if (e && e.code === '23514' && /permintaan_stok_status_check/.test(m)) return 'Status "disetujui" belum diizinkan database. Jalankan ' + SQL05 + ' di Supabase.';
  if (e && e.code === '23505' && /permintaan_stok_aktif/.test(m)) return 'Ada peminta yang sudah punya permintaan baru berstatus menunggu untuk laptop ini.';
  if (/mime type|not allowed|payload too large|exceeded/i.test(m)) return 'File ditolak server (jenis/ukuran tidak diizinkan).';
  /* 23514 = pelanggaran CHECK di database: nilai "bagian" ini belum diizinkan oleh tabel banner */
  if (e && (e.code === '23514' || /check constraint/i.test(m))) return m + ' (database belum mengizinkan nilai "bagian" ini; hubungi pengelola Supabase)';
  return m;
};
function setPesan(el, teks, galat = false) {
  el.textContent = teks || ''; el.classList.toggle('galat', !!galat); if (el.hasAttribute('hidden') || el.id.startsWith('pesanProduk')) el.hidden = !teks;
}
const penanda = `/storage/v1/object/public/${BUCKET}/`;
function pathStorage(url) {
  const i = String(url || '').indexOf(penanda);
  return i < 0 ? null : decodeURIComponent(url.slice(i + penanda.length).split('?')[0]);
}
async function hapusFileStorage(url) {
  const p = pathStorage(url);
  if (p) { try { await sb.storage.from(BUCKET).remove([p]); } catch (e) { console.warn('Gagal hapus file lama:', e); } }
}
/* Cek video sebelum diunggah: kalau browser tidak bisa men-decode gambarnya (mis. HEVC/H.265, 10-bit), videoWidth = 0
   dan di website hasilnya layar hitam. Video seperti itu ditolak di sini supaya tidak ikut tersimpan. */
function videoBisaDiputar(file) {
  return new Promise(ok => {
    const v = document.createElement('video'), u = URL.createObjectURL(file);
    let selesai = false;
    const akhir = hasil => { if (selesai) return; selesai = true; clearTimeout(t); v.removeAttribute('src'); v.load(); URL.revokeObjectURL(u); ok(hasil); };
    const t = setTimeout(() => akhir(true), 10000);   /* tidak bisa memastikan -> jangan blokir */
    v.muted = true; v.preload = 'auto';
    v.addEventListener('loadeddata', () => akhir(v.videoWidth > 0 && v.videoHeight > 0));
    v.addEventListener('error', () => akhir(false));
    v.src = u;
  });
}

/* Validasi foto di sisi klien (cadangan). Pembatasan sungguhan ada di bucket Storage (sql/03). SVG sengaja ditolak. */
const BATAS_FOTO_MB = 10, MAKS_GALERI = 6;
function cekFoto(file, gif = false) {
  const ok = ['image/jpeg', 'image/png', 'image/webp'].concat(gif ? ['image/gif'] : []);
  if (!ok.includes(file.type)) throw new Error(`"${file.name}": jenis file tidak didukung. Pakai JPG, PNG, atau WebP.`);
  if (file.size > BATAS_FOTO_MB * 1024 * 1024) throw new Error(`"${file.name}" lebih dari ${BATAS_FOTO_MB} MB.`);
}
function kompres(file, maks = 1920, kualitas = 0.85) {
  return new Promise((ok, gagal) => {
    const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, maks / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => { URL.revokeObjectURL(u); b ? ok(b) : gagal(new Error('Gagal memproses gambar')); }, 'image/jpeg', kualitas);
    };
    img.onerror = () => { URL.revokeObjectURL(u); gagal(new Error('Gambar tidak bisa dibaca')); };
    img.src = u;
  });
}
async function unggah(file, folder) {
  let blob = file, ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  if (file.type.startsWith('image/') && !/gif|svg/.test(file.type)) { blob = await kompres(file); ext = 'jpg'; }
  if (blob.size > BATAS_MB * 1024 * 1024) throw new Error(`"${file.name}" lebih dari ${BATAS_MB} MB`);
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { cacheControl: '31536000', upsert: false, contentType: blob.type || file.type });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/* ---------- Sesi ----------
   Panel TIDAK punya halaman login sendiri. Login hanya lewat website utama (tombol "Log in"); sesinya dipakai bersama.
   Peran diperiksa database (AdminAuth.peran).
   - belum login        -> langsung ke website utama (di sana tombol "Log in")
   - login, bukan admin -> ditolak + diarahkan ke website utama (sesi tidak dihapus, dipakai bersama website)
   - gagal memeriksa    -> pesan koneksi + tombol "Coba periksa lagi" (TIDAK dianggap bukan admin)
   - Keluar             -> langsung ke website utama (tulisan "Admin" kembali jadi "Log in")
   Keamanan sebenarnya ada di RLS database; tampilan ini hanya mengikuti hasilnya. */
const SITUS_PUB = (typeof SITUS_PUBLIK === 'string' && SITUS_PUBLIK) || '../';
$('#lnkSitus').href = SITUS_PUB;
const keWebsite = () => location.replace(SITUS_PUB);
function tampilCek(pesan, bisaUlang = false) {
  $('#viewPanel').hidden = true; $('#viewCek').hidden = false;
  $('#cekPesan').textContent = pesan || 'Memeriksa akun...';
  $('#btnCobaLagi').hidden = !bisaUlang;
  sudahMuat = false;
}
let sedangCek = false;
async function tampilkan(session) {
  if (!session) { if (!sedangCek) keWebsite(); return; }
  if (sudahMuat || sedangCek) return;
  sedangCek = true; tampilCek('');
  const peran = await AdminAuth.peran();
  sedangCek = false;
  if (peran === null) return tampilCek('Belum bisa memeriksa akun karena koneksi bermasalah. Coba lagi.', true);
  if (peran !== 'admin' && peran !== 'owner') {
    const email = (session.user && session.user.email) || 'ini';
    /* Satu situs = satu sesi dengan website utama. Jangan signOut di sini, nanti user biasa ikut keluar dari website.
       Data tetap aman: RLS database menolak semua tulis/ubah dari non-admin. */
    tampilCek(`Akses ditolak. Akun ${email} belum terdaftar sebagai admin. Owner perlu menambahkan email ini ke tabel admin_emails di Supabase (lihat PANDUAN-DEPLOY.md).`);
    /* bukan admin -> arahkan ke website utama (kecuali uji lokal) */
    if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) setTimeout(keWebsite, 3000);
    return;
  }
  $('#viewCek').hidden = true; $('#viewPanel').hidden = false;
  $('#tab-admin').hidden = peran !== 'owner'; $('#pintasAdmin').hidden = peran !== 'owner';
  sudahMuat = true; muatSemuaTab(); if (peran === 'owner') muatAdmin(); toast('Berhasil masuk', 'sukses');
}
$('#btnCobaLagi').addEventListener('click', async () => { const { data } = await sb.auth.getSession(); tampilkan(data.session); });
$$('[data-keluar]').forEach(b => b.addEventListener('click', async () => { $$('[data-keluar]').forEach(x => { x.disabled = true; }); await AdminAuth.keluar(); keWebsite(); }));

/* ---------- Grup menu sidebar (buka-tutup) ----------
   Selalu tertutup saat admin dibuka. */
function setGrup(w, buka) {
  w.classList.toggle('tutup', !buka);
  $('.grup-btn', w).setAttribute('aria-expanded', String(buka));
}
function bukaGrupDari(tab) { const w = tab.closest('.grup-wrap'); if (w && w.classList.contains('tutup')) setGrup(w, true); }
$$('.grup-wrap').forEach(w => {
  setGrup(w, false);   /* selalu tertutup saat admin dibuka; tidak disimpan */
  $('.grup-btn', w).addEventListener('click', () => setGrup(w, w.classList.contains('tutup')));
});

/* ---------- Tab ---------- */
const tabs = $$('[role="tab"]');
function pilihTab(nama, fokus = false) {
  tabs.forEach(t => {
    const aktif = t.dataset.tab === nama;
    t.setAttribute('aria-selected', String(aktif)); t.tabIndex = aktif ? 0 : -1;
    $('#' + t.getAttribute('aria-controls')).hidden = !aktif;
    if (aktif && fokus) t.focus();
    if (aktif) { $('#judulHalaman').textContent = t.dataset.judul || t.firstChild.textContent.trim(); bukaGrupDari(t); }
  });
  $('#btnKembaliDash').hidden = nama === 'dashboard';
  $('#aksiDashboard').hidden = nama !== 'dashboard';   /* "Lihat Website" hanya di Dashboard */
  if (sudahMuat && nama === 'permintaan') muatPermintaan();
  if (sudahMuat && nama === 'dashboard') muatDashboard();
  try { history.replaceState(null, '', '#' + nama); } catch (e) {}
}
/* HP: ketuk logo "T" -> muncul tombol Keluar. Pindah halaman lewat kotak di Dashboard, dan tombol "Dashboard" untuk kembali. */
const btnBrand = $('#btnBrand'), popAkun = $('#popAkun');
function setPopAkun(buka) { popAkun.hidden = !buka; btnBrand.setAttribute('aria-expanded', String(buka)); }
btnBrand.addEventListener('click', e => { e.stopPropagation(); setPopAkun(popAkun.hidden); });
document.addEventListener('click', e => { if (!popAkun.hidden && !popAkun.contains(e.target)) setPopAkun(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') setPopAkun(false); });
$('#btnKembaliDash').addEventListener('click', () => pilihTab('dashboard'));

tabs.forEach((t, i) => {
  t.addEventListener('click', () => pilihTab(t.dataset.tab));
  t.addEventListener('keydown', e => {
    const k = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 1, ArrowUp: -1 }[e.key]; if (!k) return;
    e.preventDefault(); const v = tabs.filter(x => !x.hidden && !x.closest('.grup-wrap.tutup')), j = v.indexOf(t); pilihTab(v[(j + k + v.length) % v.length].dataset.tab, true);
  });
});

/* =====================================================================
   MANAJER MEDIA (dipakai 3 tab: hero_desktop, hero_hp, toko)
   Perubahan ditampung dulu, baru dikirim saat klik "Simpan".
   ===================================================================== */
const KONFIG_MEDIA = {
  hero_desktop: { judul: 'Media Hero Desktop', maks: 8, video: true, rasio: '',
    info: 'Tampil di laptop/PC. Gunakan foto/video LANDSCAPE 16:9 (contoh 1920×1080).' },
  hero_hp: { judul: 'Media Hero HP', maks: 8, video: true, rasio: 'r-hp',
    info: 'Tampil di HP. Gunakan foto/video POTRET 9:16 (contoh 1080×1920).' },
  toko: { judul: 'Foto "Kunjungi Toko Kami"', maks: 4, video: false, rasio: '',
    info: 'Khusus foto, maksimal 4. Tampil turun ke bawah di HP (lebar penuh) dan 2 kolom di laptop. Foto tampil utuh, tidak dipotong. Pakai foto beresolusi tinggi (min. lebar 1600 px).' },
};

function buatManajerMedia(root, bagian) {
  const cfg = KONFIG_MEDIA[bagian];
  if (!cfg) return;                 /* bagian tanpa konfigurasi dilewati (tidak boleh mematikan seluruh panel) */
  let items = [];
  let sibuk = false;

  root.innerHTML = `
    <div class="daftar" data-daftar></div>
    <div class="unggah">
      <label for="u-${bagian}">Tambah ${cfg.video ? 'foto atau video' : 'foto'}</label>
      <input id="u-${bagian}" type="file" multiple accept="${cfg.video ? 'image/*,video/mp4,video/webm,video/quicktime' : 'image/*'}">
      <small>File baru baru dikirim setelah kamu menekan Simpan.</small>
    </div>
    <div class="bar-simpan"><button type="button" class="btn" data-simpan>Simpan</button><span class="pesan" data-pesan role="status"></span></div>`;
  const elDaftar = $('[data-daftar]', root), elPesan = $('[data-pesan]', root), btnSimpan = $('[data-simpan]', root), inputFile = $('input[type=file]', root);

  const aktifJumlah = () => items.filter(x => !x.hapus).length;

  function gambar() {
    if (!items.length) { elDaftar.innerHTML = '<div class="kosong">Belum ada media. Tambahkan lewat kotak di bawah.</div>'; return; }
    elDaftar.innerHTML = items.map((x, i) => `
      <div class="media ${x.file ? 'baru' : ''} ${x.hapus ? 'hapus' : ''}" data-k="${i}">
        <div class="thumb ${cfg.rasio}">${x.jenis === 'video' ? `<video src="${esc(x.url)}" muted preload="metadata"></video>` : `<img src="${esc(x.url)}" alt="" onerror="this.onerror=null;this.src=window.FOTO_KOSONG">`}</div>
        <div class="media-form">
          <div class="media-baris">
            <span class="tag">${x.jenis === 'video' ? 'Video' : 'Foto'}</span>
            ${x.file ? '<span class="tag tag-baru">Baru, belum disimpan</span>' : ''}
            ${x.hapus ? '<span class="tag tag-baru">Akan dihapus</span>' : ''}
            <span class="muted grow">${esc(x.file ? x.file.name : '')}</span>
          </div>
          <div class="media-baris">
            <input class="grow" data-f="judul" maxlength="120" placeholder="Teks keterangan (opsional)" value="${esc(x.judul)}" aria-label="Teks keterangan">
            <label class="sw"><input type="checkbox" data-f="aktif" ${x.aktif ? 'checked' : ''}> Tampilkan</label>
          </div>
          <div class="media-baris">
            <button type="button" class="btn btn-garis btn-kecil" data-aksi="naik" ${i === 0 ? 'disabled' : ''} aria-label="Naikkan">&uarr; Naik</button>
            <button type="button" class="btn btn-garis btn-kecil" data-aksi="turun" ${i === items.length - 1 ? 'disabled' : ''} aria-label="Turunkan">&darr; Turun</button>
            <button type="button" class="btn btn-bahaya btn-kecil" data-aksi="hapus">${x.hapus ? 'Batalkan hapus' : 'Hapus'}</button>
          </div>
        </div>
      </div>`).join('');
  }

  elDaftar.addEventListener('input', e => {
    const k = e.target.closest('[data-k]'); const f = e.target.dataset.f; if (!k || !f) return;
    const it = items[+k.dataset.k];
    it[f] = f === 'aktif' ? e.target.checked : e.target.value;
  });
  elDaftar.addEventListener('click', e => {
    const b = e.target.closest('[data-aksi]'), k = e.target.closest('[data-k]'); if (!b || !k) return;
    const i = +k.dataset.k, it = items[i];
    if (b.dataset.aksi === 'naik' && i > 0) [items[i - 1], items[i]] = [items[i], items[i - 1]];
    else if (b.dataset.aksi === 'turun' && i < items.length - 1) [items[i + 1], items[i]] = [items[i], items[i + 1]];
    else if (b.dataset.aksi === 'hapus') {
      if (it.file) { URL.revokeObjectURL(it.url); items.splice(i, 1); }   // belum tersimpan: langsung buang
      else {
        if (it.hapus) { it.hapus = false; if (aktifJumlah() > cfg.maks) { it.hapus = true; return toast(`Maksimal ${cfg.maks} slide`); } }
        else it.hapus = true;
      }
    }
    gambar();
  });

  inputFile.addEventListener('change', async () => {
    setPesan(elPesan, '');
    const daftarFile = [...inputFile.files];
    inputFile.value = '';
    for (const f of daftarFile) {
      const video = f.type.startsWith('video/'), foto = f.type.startsWith('image/');
      if (!foto && !(video && cfg.video)) { toast(`"${f.name}" dilewati: jenis file tidak didukung`); continue; }
      if (aktifJumlah() >= cfg.maks) { toast(`Maksimal ${cfg.maks} slide. Hapus salah satu dulu.`); break; }
      if (foto) { try { cekFoto(f, true); } catch (err) { toast(err.message, 'galat'); continue; } }
      if (f.size > BATAS_MB * 1024 * 1024) { toast(`"${f.name}" lebih dari ${BATAS_MB} MB`); continue; }
      if (video && !(await videoBisaDiputar(f))) {
        toast(`"${f.name}" tidak bisa diputar browser (biasanya codec H.265/HEVC atau 10-bit). Convert dulu ke MP4 H.264, lalu unggah lagi.`, 'galat');
        continue;
      }
      items.push({ id: null, file: f, jenis: video ? 'video' : 'foto', url: URL.createObjectURL(f), judul: '', aktif: true, hapus: false });
    }
    gambar();
  });

  async function muat() {
    const { data, error } = await sb.from('banner').select('*').eq('bagian', bagian).order('urutan', { ascending: true }).order('id', { ascending: true });
    if (error) { elDaftar.innerHTML = `<div class="kosong">Gagal memuat: ${esc(pesanGalat(error))}. Pastikan schema.sql sudah dijalankan.</div>`; return; }
    items = (data || []).map(b => ({ id: b.id, file: null, jenis: b.jenis, url: b.url, judul: b.judul || '', aktif: b.aktif, hapus: false }));
    gambar();
  }

  btnSimpan.addEventListener('click', async () => {
    if (sibuk) return;
    if (aktifJumlah() > cfg.maks) return setPesan(elPesan, `Maksimal ${cfg.maks} slide.`, true);
    sibuk = true; btnSimpan.disabled = true; setPesan(elPesan, 'Menyimpan...');
    try {
      /* 1) hapus  2) ubah yang lama  3) unggah + tambah yang baru (urutan ini menjaga batas 4 foto toko) */
      for (const x of items.filter(x => x.hapus && x.id)) {
        const { error } = await sb.from('banner').delete().eq('id', x.id); if (error) throw error;
        await hapusFileStorage(x.url);
      }
      const sisa = items.filter(x => !x.hapus);
      for (const [i, x] of sisa.entries()) {
        if (x.id) {
          const { error } = await sb.from('banner').update({ judul: x.judul.trim() || null, urutan: i + 1, aktif: x.aktif }).eq('id', x.id);
          if (error) throw error;
        }
      }
      for (const [i, x] of sisa.entries()) {
        if (!x.file) continue;
        setPesan(elPesan, `Mengunggah ${x.file.name}...`);
        const url = await unggah(x.file, bagian);
        const { error } = await sb.from('banner').insert({ bagian, jenis: x.jenis, url, judul: x.judul.trim() || null, urutan: i + 1, aktif: x.aktif });
        if (error) { await hapusFileStorage(url); throw error; }
      }
      await muat();
      setPesan(elPesan, 'Tersimpan. Tampilan website terbarui otomatis.'); toast('Tersimpan');
    } catch (e) {
      console.error(e); setPesan(elPesan, 'Gagal menyimpan: ' + pesanGalat(e), true);
      await muat();
    } finally { sibuk = false; btnSimpan.disabled = false; }
  });

  return { muat };
}

/* =====================================================================
   INFO & KONTAK TOKO (tabel config, satu baris)
   ===================================================================== */
const formInfo = $('#formInfo');
let idConfig = null;
async function muatInfo() {
  const { data, error } = await sb.from('config').select('*').order('id', { ascending: true }).limit(1);
  if (error) { setPesan($('#pesanInfo'), 'Gagal memuat: ' + pesanGalat(error), true); return; }
  const c = (data && data[0]) || null; idConfig = c ? c.id : null;
  [...formInfo.elements].forEach(el => {
    if (!el.name) return;
    el.value = (c && c[el.name]) ?? CONFIG_AWAL[el.name] ?? '';
  });
}
formInfo.addEventListener('submit', async e => {
  e.preventDefault();
  const b = $('#btnSimpanInfo'), p = $('#pesanInfo'); b.disabled = true; setPesan(p, 'Menyimpan...');
  const isi = {};
  [...formInfo.elements].forEach(el => { if (el.name) isi[el.name] = el.value.trim(); });
  isi.wa = isi.wa.replace(/\D/g, '').replace(/^0/, '62');
  isi.instagram = isi.instagram.replace(/^@/, ''); isi.tiktok = isi.tiktok.replace(/^@/, '');
  if (!isi.wa) { b.disabled = false; return setPesan(p, 'Nomor WhatsApp wajib diisi.', true); }
  const q = idConfig ? sb.from('config').update(isi).eq('id', idConfig) : sb.from('config').insert(isi);
  const { error } = await q;
  b.disabled = false;
  if (error) { setPesan(p, 'Gagal menyimpan: ' + pesanGalat(error), true); return; }
  setPesan(p, 'Tersimpan. Sidebar, footer, dan tombol Contact terbarui otomatis.'); toast('Tersimpan');
  if (!idConfig) muatInfo();
});

/* =====================================================================
   PRODUK (tabel produk di Supabase) + galeri foto di Supabase Storage
   Kolom: kategori, kondisi, merek, seri, harga, harganormal, tags, spek, foto (utama),
          foto_tambahan (text[]), deskripsi, status ('tersedia' | 'tidak_tersedia')
   ===================================================================== */
let produkList = [];
const dlgProduk = $('#dlgProduk'), formProduk = $('#formProduk');
let editId = null, galeri = [], galeriAsli = [], gantiIdx = null;
$('#p-kategori').innerHTML = KATEGORI.map(k => `<option value="${k.id}">${esc(k.label)}</option>`).join('');
$('#p-tags').innerHTML = Object.entries(LABEL_TAG).map(([id, t]) => `<label><input type="checkbox" value="${id}"> ${esc(t)}</label>`).join('');
dlgProduk.addEventListener('click', e => { if (e.target === dlgProduk) dlgProduk.close(); });
$$('[data-tutup]', dlgProduk).forEach(b => b.addEventListener('click', () => dlgProduk.close()));
const urlFoto = p => [p.foto, ...(Array.isArray(p.foto_tambahan) ? p.foto_tambahan : [])].filter(Boolean);
const lepasPreview = () => galeri.forEach(g => { if (g.file) URL.revokeObjectURL(g.url); });

async function muatProduk() {
  let r = await sb.from('produk').select('*').order('created_at', { ascending: false });
  if (r.error) r = await sb.from('produk').select('*').order('id', { ascending: false });
  const el = $('#daftarProduk');
  if (r.error) { el.innerHTML = `<div class="kosong">Gagal memuat produk: ${esc(pesanGalat(r.error))}</div>`; return; }
  produkList = r.data || [];
  el.innerHTML = produkList.length ? produkList.map(p => {
    const tags = Array.isArray(p.tags) ? p.tags : [];
    const habis = p.status === 'tidak_tersedia';
    return `<div class="prod" data-id="${esc(p.id)}">
      <img src="${esc(p.foto || window.FOTO_KOSONG)}" alt="" onerror="this.onerror=null;this.src=window.FOTO_KOSONG">
      <div><b>${esc(namaLengkap(p))}</b><span class="muted">${rupiah(p.harga)} &middot; ${esc((KATEGORI.find(k => k.id === p.kategori) || {}).label || p.kategori || '-')} &middot; ${urlFoto(p).length} foto${tags.length ? ' &middot; ' + tags.map(t => esc(LABEL_TAG[t] || t)).join(', ') : ''}</span></div>
      <div class="prod-aksi"><button type="button" class="btn btn-kecil btn-stok ${habis ? 'habis' : 'ada'}" data-aksi="stok" aria-pressed="${!habis}" title="Klik untuk mengubah status stok">${habis ? 'Stok Habis' : 'Stok Ada'}</button><button type="button" class="btn btn-garis btn-kecil" data-aksi="edit">Ubah</button></div>
    </div>`;
  }).join('') : '<div class="kosong">Belum ada produk.</div>';
}

function gambarGaleri() {
  $('#p-galeri').innerHTML = galeri.length ? galeri.map((g, i) => `
    <div class="g-item ${i === 0 ? 'utama' : ''}" data-g="${i}">
      <img src="${esc(g.url)}" alt="Foto ${i + 1}" onerror="this.onerror=null;this.src=window.FOTO_KOSONG">
      ${i === 0 ? '<span class="g-tag">Utama</span>' : ''}${g.file ? '<span class="g-tag baru">Baru</span>' : ''}
      <div class="g-aksi">${i > 0 ? '<button type="button" data-ga="utama">Jadikan utama</button>' : ''}<button type="button" data-ga="ganti">Ganti</button><button type="button" data-ga="hapus">Hapus</button></div>
    </div>`).join('') : '<div class="kosong">Belum ada foto.</div>';
}
$('#p-galeri').addEventListener('click', e => {
  const b = e.target.closest('[data-ga]'), k = e.target.closest('[data-g]'); if (!b || !k) return;
  const i = +k.dataset.g, aksi = b.dataset.ga;
  if (aksi === 'utama') galeri.unshift(galeri.splice(i, 1)[0]);
  else if (aksi === 'ganti') { gantiIdx = i; $('#p-ganti').click(); return; }
  else if (aksi === 'hapus') { if (galeri[i].file) URL.revokeObjectURL(galeri[i].url); galeri.splice(i, 1); }
  gambarGaleri();
});
$('#p-foto').addEventListener('change', e => {
  for (const f of e.target.files) {
    try { cekFoto(f); } catch (err) { toast(err.message, 'galat'); continue; }
    if (galeri.length >= MAKS_GALERI) { toast(`Maksimal ${MAKS_GALERI} foto per produk`, 'galat'); break; }
    galeri.push({ url: URL.createObjectURL(f), file: f });
  }
  e.target.value = ''; gambarGaleri();
});
$('#p-ganti').addEventListener('change', e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f || gantiIdx === null || !galeri[gantiIdx]) return;
  try { cekFoto(f); } catch (err) { return toast(err.message, 'galat'); }
  if (galeri[gantiIdx].file) URL.revokeObjectURL(galeri[gantiIdx].url);
  galeri[gantiIdx] = { url: URL.createObjectURL(f), file: f }; gantiIdx = null; gambarGaleri();
});

function bukaFormProduk(p) {
  lepasPreview();
  editId = p ? p.id : null;
  galeriAsli = p ? urlFoto(p) : []; galeri = galeriAsli.map(url => ({ url }));
  let sp = p ? p.spek : {}; if (typeof sp === 'string') { try { sp = JSON.parse(sp); } catch { sp = {}; } } sp = sp || {};
  const tags = p && Array.isArray(p.tags) ? p.tags : [];
  $('#dlgProdukJudul').textContent = p ? 'Ubah produk' : 'Tambah produk';
  $('#btnHapusProduk').hidden = !p;
  $('#p-kategori').value = p ? p.kategori : KATEGORI[0].id;
  $('#p-kondisi').value = p && KONDISI[p.kondisi] ? p.kondisi : 'bekas';
  $('#p-status').value = p && p.status === 'tidak_tersedia' ? 'tidak_tersedia' : 'tersedia';
  $('#p-desk').value = p ? p.deskripsi || '' : '';
  $('#p-merek').value = p ? p.merek || '' : ''; $('#p-seri').value = p ? p.seri || '' : '';
  $('#p-harga').value = p ? p.harga : ''; $('#p-normal').value = p && p.harganormal ? p.harganormal : '';
  $('#p-proc').value = sp.processor || ''; $('#p-ram').value = sp.ram || ''; $('#p-storage').value = sp.storage || '';
  $('#p-vga').value = sp.vga || ''; $('#p-layar').value = sp.layar || '';
  $$('#p-tags input').forEach(c => { c.checked = tags.includes(c.value); });
  gambarGaleri(); setPesan($('#pesanProduk'), ''); $('#pesanProduk').hidden = true;
  dlgProduk.showModal();
}
dlgProduk.addEventListener('close', () => { lepasPreview(); galeri = []; });
$('#btnProdukBaru').addEventListener('click', () => bukaFormProduk(null));
/* Toggle stok: Stok Ada (hijau) <-> Stok Habis (merah). Langsung disimpan ke Supabase; website pengguna ikut berubah (realtime). */
const sedangStok = new Set();
function tampilStok(b, status) {
  const habis = status === 'tidak_tersedia';
  b.classList.toggle('habis', habis); b.classList.toggle('ada', !habis);
  b.textContent = habis ? 'Stok Habis' : 'Stok Ada'; b.setAttribute('aria-pressed', String(!habis));
}
async function ubahStok(p, b) {
  if (sedangStok.has(p.id)) return;
  sedangStok.add(p.id);
  const lama = p.status === 'tidak_tersedia' ? 'tidak_tersedia' : 'tersedia';
  const baru = lama === 'tersedia' ? 'tidak_tersedia' : 'tersedia';
  tampilStok(b, baru); b.disabled = true;
  const { data, error } = await sb.from('produk').update({ status: baru }).eq('id', p.id).select('id,status');
  sedangStok.delete(p.id); b.disabled = false;
  if (error || !data || !data.length) {
    tampilStok(b, lama);                                   /* gagal: kembalikan tampilan, jangan pura-pura berhasil */
    return toast('Stok belum tersimpan: ' + (error ? pesanGalat(error) : 'tidak ada data yang berubah (periksa izin admin)'), 'galat');
  }
  p.status = data[0].status; tampilStok(b, p.status);
  toast(p.status === 'tersedia' ? `${namaLengkap(p)}: Stok Ada` : `${namaLengkap(p)}: Stok Habis`, 'sukses');
}
async function hapusProduk(p) {
  if (!confirm(`Hapus "${namaLengkap(p)}" dari toko? Foto-fotonya dan permintaan stok untuk produk ini ikut dihapus. Tindakan ini tidak bisa dibatalkan.`)) return false;
  const { error } = await sb.from('produk').delete().eq('id', p.id);
  if (error) { toast('Gagal menghapus: ' + pesanGalat(error), 'galat'); return false; }
  for (const u of urlFoto(p)) await hapusFileStorage(u);
  toast('Produk dihapus', 'sukses'); muatProduk(); return true;
}
$('#daftarProduk').addEventListener('click', async e => {
  const b = e.target.closest('[data-aksi]'), row = e.target.closest('[data-id]'); if (!b || !row) return;
  const p = produkList.find(x => String(x.id) === row.dataset.id); if (!p) return;
  if (b.dataset.aksi === 'stok') return ubahStok(p, b);
  if (b.dataset.aksi === 'edit') return bukaFormProduk(p);
});
$('#btnHapusProduk').addEventListener('click', async () => {
  const p = produkList.find(x => String(x.id) === String(editId)); if (!p) return;
  if (await hapusProduk(p)) dlgProduk.close();
});
formProduk.addEventListener('submit', async e => {
  e.preventDefault();
  const b = $('#btnSimpanProduk'), pesan = $('#pesanProduk'); b.disabled = true; pesan.hidden = true;
  const baru = [];                                              /* file yang diunggah pada percobaan ini (dibersihkan bila gagal) */
  try {
    const harga = Number($('#p-harga').value);
    if (!Number.isFinite(harga) || harga < 0) throw new Error('Harga tidak valid');
    const normal = Number($('#p-normal').value) || null;
    const final = [];
    for (const g of galeri) {
      if (g.file) { b.textContent = 'Mengunggah foto...'; const u = await unggah(g.file, 'produk'); baru.push(u); final.push(u); }
      else final.push(g.url);
    }
    const isi = {
      kategori: $('#p-kategori').value, kondisi: $('#p-kondisi').value, status: $('#p-status').value,
      merek: $('#p-merek').value.trim(), seri: $('#p-seri').value.trim(), deskripsi: $('#p-desk').value.trim().slice(0, 2000) || null,
      harga, harganormal: normal && normal > harga ? normal : null,
      tags: $$('#p-tags input:checked').map(c => c.value), foto: final[0] || '', foto_tambahan: final.slice(1),
      spek: { processor: $('#p-proc').value.trim(), ram: $('#p-ram').value.trim(), storage: $('#p-storage').value.trim(), vga: $('#p-vga').value.trim(), layar: $('#p-layar').value.trim() }
    };
    const { error } = editId !== null ? await sb.from('produk').update(isi).eq('id', editId) : await sb.from('produk').insert(isi);
    if (error) { for (const u of baru) await hapusFileStorage(u); throw error; }
    for (const u of galeriAsli.filter(u => !final.includes(u))) await hapusFileStorage(u);   /* foto yang dibuang/diganti */
    dlgProduk.close(); toast('Produk tersimpan. Website utama terbarui otomatis.', 'sukses'); muatProduk();
  } catch (err) { console.error(err); pesan.textContent = 'Gagal menyimpan: ' + pesanGalat(err); pesan.hidden = false; }
  finally { b.disabled = false; b.textContent = 'Simpan produk'; }
});

/* =====================================================================
   ADMIN & ROLE (khusus owner). Data di tabel admin_emails; hak akses dijaga RLS (sql/03).
   Tidak ada email admin di kode: semua dari database.
   ===================================================================== */
async function muatAdmin() {
  const el = $('#daftarAdmin');
  const { data, error } = await sb.from('admin_emails').select('email,role').order('email', { ascending: true });
  if (error) { el.innerHTML = `<div class="kosong">Gagal memuat: ${esc(pesanGalat(error))}</div>`; return; }
  el.innerHTML = (data || []).map(a => `<div class="row-admin" data-email="${esc(a.email)}"><b>${esc(a.email)}</b>
    <select data-aksi="role" aria-label="Role ${esc(a.email)}"><option value="admin" ${a.role === 'admin' ? 'selected' : ''}>Admin</option><option value="owner" ${a.role === 'owner' ? 'selected' : ''}>Owner</option></select>
    <button type="button" class="btn btn-bahaya btn-kecil" data-aksi="hapus">Hapus</button></div>`).join('') || '<div class="kosong">Belum ada admin.</div>';
}
$('#formAdmin').addEventListener('submit', async e => {
  e.preventDefault();
  const p = $('#pesanAdmin'), email = $('#a-email').value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return setPesan(p, 'Email belum benar.', true);
  const { error } = await sb.from('admin_emails').insert({ email, role: $('#a-role').value });
  if (error) return setPesan(p, error.code === '23505' ? 'Email ini sudah terdaftar.' : 'Gagal: ' + pesanGalat(error), true);
  setPesan(p, 'Ditambahkan. Orang itu bisa masuk panel setelah login Google.'); $('#a-email').value = ''; muatAdmin();
});
$('#daftarAdmin').addEventListener('change', async e => {
  const row = e.target.closest('[data-email]'); if (!row || e.target.dataset.aksi !== 'role') return;
  const { error } = await sb.from('admin_emails').update({ role: e.target.value }).eq('email', row.dataset.email);
  if (error) toast('Gagal mengubah role: ' + pesanGalat(error), 'galat'); else toast('Role diubah', 'sukses');
  muatAdmin();
});
$('#daftarAdmin').addEventListener('click', async e => {
  const b = e.target.closest('[data-aksi=hapus]'), row = e.target.closest('[data-email]'); if (!b || !row) return;
  if (!confirm(`Cabut akses admin untuk ${row.dataset.email}?`)) return;
  const { error } = await sb.from('admin_emails').delete().eq('email', row.dataset.email);
  if (error) toast('Gagal: ' + pesanGalat(error), 'galat'); else toast('Akses dicabut', 'sukses');
  muatAdmin();
});

/* =====================================================================
   DASHBOARD + PERMINTAAN KETERSEDIAAN (tabel permintaan_stok, dijaga RLS: admin baca & ubah status)
   ===================================================================== */
let permintaanData = [], filterMinta = 'menunggu';
const fmtWaktu = t => { try { return new Date(t).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
const LABEL_MINTA = { menunggu: 'Menunggu', ditangani: 'Ditangani', disetujui: 'Disetujui' };
async function ambilPermintaan() {
  const { data, error } = await sb.from('permintaan_stok').select('*').order('created_at', { ascending: false }).limit(1000);
  if (error) throw error;
  permintaanData = data || [];
  const n = kelompokMinta().filter(g => g.status === 'menunggu').length, bd = $('#badgePermintaan');
  bd.hidden = !n; bd.textContent = n;
  const bl = $('#badgeLainnya'); if (bl) { bl.hidden = !n; bl.textContent = n; }
  const bp = $('#badgePintas'); if (bp) { bp.hidden = !n; bp.textContent = n; }
}
/* Satu baris per laptop: jumlah peminta, waktu permintaan terbaru, dan status gabungan
   (menunggu bila masih ada peminta yang belum diproses; lalu ditangani; disetujui bila semuanya disetujui). */
function kelompokMinta() {
  const peta = new Map();
  for (const x of permintaanData) {
    const k = x.product_id != null ? 'p' + x.product_id : 'n' + (x.nama_produk || '');
    let g = peta.get(k);
    if (!g) peta.set(k, g = { kunci: k, nama: x.nama_produk || 'Laptop', baris: [], terbaru: x.created_at });
    g.baris.push(x);
    if (new Date(x.created_at) > new Date(g.terbaru)) g.terbaru = x.created_at;
  }
  const g = [...peta.values()];
  g.forEach(k => {
    const st = k.baris.map(x => x.status);
    k.status = st.includes('menunggu') ? 'menunggu' : st.includes('ditangani') ? 'ditangani' : 'disetujui';
  });
  return g.sort((a, b) => new Date(b.terbaru) - new Date(a.terbaru));
}
function barisMinta(g) {
  const aksi = g.status === 'menunggu'
    ? '<button type="button" class="btn btn-garis btn-kecil" data-aksi="ditangani">Tandai ditangani</button><button type="button" class="btn btn-kecil" data-aksi="disetujui">Setujui</button>'
    : g.status === 'ditangani'
      ? '<button type="button" class="btn btn-kecil" data-aksi="disetujui">Setujui</button>'
      : '';
  return `<div class="req ${g.status === 'disetujui' ? 'selesai' : ''}" data-kunci="${esc(g.kunci)}"><div class="req-isi"><b>${esc(g.nama)}</b>
    <span class="muted">${g.baris.length} peminta &middot; terakhir ${fmtWaktu(g.terbaru)}</span></div>
    <div class="req-aksi"><span class="tag ${g.status === 'disetujui' ? 'tag-ok' : ''}">${LABEL_MINTA[g.status]}</span>${aksi}</div></div>`;
}
function gambarPermintaan() {
  const l = kelompokMinta().filter(g => g.status === filterMinta);
  $('#daftarPermintaan').innerHTML = l.map(barisMinta).join('') || `<div class="kosong">Tidak ada permintaan ${LABEL_MINTA[filterMinta].toLowerCase()}.</div>`;
  $('#dashPermintaan').innerHTML = kelompokMinta().filter(g => g.status === 'menunggu').slice(0, 4).map(barisMinta).join('') || '<div class="kosong">Belum ada permintaan baru.</div>';
}
async function muatPermintaan() {
  const el = $('#daftarPermintaan');
  try { await ambilPermintaan(); } catch (e) { el.innerHTML = `<div class="kosong">Gagal memuat: ${esc(pesanGalat(e))}</div>`; return; }
  gambarPermintaan();
}
$('#filterPermintaan').addEventListener('click', e => {
  const b = e.target.closest('[data-f]'); if (!b) return;
  filterMinta = b.dataset.f;
  $$('#filterPermintaan [aria-pressed]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  gambarPermintaan();
});
async function ubahStatusMinta(e) {
  const b = e.target.closest('[data-aksi]'), row = e.target.closest('[data-kunci]'); if (!b || !row) return;
  const g = kelompokMinta().find(k => k.kunci === row.dataset.kunci); if (!g) return;
  const baru = b.dataset.aksi;
  const ids = g.baris.filter(x => x.status !== baru && !(baru === 'ditangani' && x.status === 'disetujui')).map(x => x.id);
  if (!ids.length) return;
  b.disabled = true;
  const { data, error } = await sb.from('permintaan_stok').update({ status: baru }).in('id', ids).select('id');
  if (error || !data || data.length !== ids.length) {
    b.disabled = false; muatPermintaan();
    return toast('Gagal: ' + (error ? pesanGalat(error) : 'sebagian permintaan tidak berubah (periksa izin admin)'), 'galat');
  }
  if (baru === 'disetujui') {
    /* disetujui = stok kembali: laptop langsung "Stok Ada" (WhatsApp aktif, Minta stok hilang) di website */
    const pid = g.baris.find(x => x.product_id != null)?.product_id;
    let stokOk = true;
    if (pid != null) {
      const r = await sb.from('produk').update({ status: 'tersedia' }).eq('id', pid).select('id');
      stokOk = !r.error && r.data && r.data.length > 0;
    }
    toast(stokOk ? `Disetujui. Stok ${g.nama} kembali tersedia; ${ids.length} peminta mendapat notifikasi.` : 'Permintaan disetujui, tetapi stok belum bisa diubah otomatis. Ubah lewat tombol Stok di tab Produk.', stokOk ? 'sukses' : 'galat');
    muatProduk();
  } else toast('Ditandai ditangani', 'sukses');
  muatPermintaan();
}
$('#daftarPermintaan').addEventListener('click', ubahStatusMinta);
$('#dashPermintaan').addEventListener('click', ubahStatusMinta);
/* Sinkron otomatis (pengganti tombol "Muat ulang"): permintaan baru dari website muncul tanpa refresh. */
try {
  let tm = null;
  sb.channel('admin-permintaan').on('postgres_changes', { event: '*', schema: 'public', table: 'permintaan_stok' }, () => {
    clearTimeout(tm); tm = setTimeout(() => { if (sudahMuat) muatPermintaan(); }, 400);
  }).subscribe();
} catch (e) { console.warn('realtime admin permintaan nonaktif', e); }

async function muatDashboard() {
  try { await ambilPermintaan(); gambarPermintaan(); } catch (e) { $('#dashPermintaan').innerHTML = `<div class="kosong">${esc(pesanGalat(e))}</div>`; }
  const [bn, pr, cf] = await Promise.all([
    sb.from('banner').select('bagian').eq('aktif', true),
    sb.from('produk').select('id', { count: 'exact', head: true }),
    sb.from('config').select('id', { count: 'exact', head: true })]);
  const n = k => (bn.data || []).filter(x => x.bagian === k).length;
  const st = (ok, teks) => `<span class="${ok ? 'ok' : 'belum'}">${ok ? teks || 'Sudah diatur' : 'Belum diatur'}</span>`;
  $('#dashRingkas').innerHTML = [
    ['Hero Desktop', st(n('hero_desktop') > 0)], ['Hero HP', st(n('hero_hp') > 0)], ['Gambar (Foto Toko)', st(n('toko') > 0, n('toko') + ' foto')],
    ['Info & Kontak', st(cf.count > 0)], ['Produk', `<span class="ok">Total ${pr.count ?? '-'}</span>`]
  ].map(([a, b]) => `<div><b>${a}</b>${b}</div>`).join('');
}
$('#pintas').addEventListener('click', e => { const b = e.target.closest('[data-ke]'); if (b) pilihTab(b.dataset.ke); });
$('#pnl-dashboard').addEventListener('click', e => { const b = e.target.closest('.bagian-kepala [data-ke]'); if (b) pilihTab(b.dataset.ke); });

/* ---------- Mulai ---------- */
const manajer = {};
/* =====================================================================
   PRODUK UNGGULAN BERANDA (tabel produk_unggulan; foto di Storage bucket media/unggulan)
   ===================================================================== */
let unggulanData = [], unggulanAktif = null, fotoUnggulanBaru = null, prevUrl = null;
const dlgU = $('#dlgUnggulan'), formU = $('#formUnggulan');
async function muatUnggulanAdmin() {
  const el = $('#daftarUnggulan');
  const { data, error } = await sb.from('produk_unggulan').select('*').order('urutan').order('id');
  if (error) { el.innerHTML = `<div class="kosong">Gagal memuat: ${esc(pesanGalat(error))}</div>`; return; }
  unggulanData = data || [];
  el.innerHTML = unggulanData.map((u, i) => `<div class="req ${u.aktif ? '' : 'selesai'}" data-uid="${u.id}">
    <img class="u-thumb" src="${esc(u.foto_url.startsWith('images/') ? '../' + u.foto_url : u.foto_url)}" alt="" loading="lazy">
    <div class="req-isi"><b>${esc(u.judul)}</b><span class="muted">${esc(u.deskripsi || '')}</span></div>
    <div class="req-aksi"><span class="tag ${u.aktif ? 'tag-ok' : ''}">${u.aktif ? 'Tampil' : 'Disembunyikan'}</span><button type="button" class="btn btn-garis btn-kecil" data-aksi="ubah-u">Ubah</button></div></div>`).join('')
    || '<div class="kosong">Belum ada kartu unggulan.</div>';
}
function lepasPrevU() { if (prevUrl) { URL.revokeObjectURL(prevUrl); prevUrl = null; } }
function bukaFormUnggulan(u) {
  unggulanAktif = u; fotoUnggulanBaru = null; lepasPrevU(); formU.reset();
  $('#dlgUnggulanJudul').textContent = u ? 'Ubah kartu unggulan' : 'Tambah kartu unggulan';
  $('#u-judul').value = u ? u.judul : ''; $('#u-sub').value = u?.sub_judul || ''; $('#u-label').value = u?.label || '';
  $('#u-grup').value = u?.grup || 'laptop'; $('#u-kat').value = u?.kategori_toko || 'macbook';
  $('#u-urut').value = u ? u.urutan : (unggulanData.reduce((m, x) => Math.max(m, x.urutan), 0) + 1);
  $('#u-desk').value = u?.deskripsi || ''; $('#u-peng').value = u?.penjelasan || ''; $('#u-poin').value = (u?.poin || []).join('\n');
  $('#u-aktif').checked = u ? u.aktif : true;
  const im = $('#u-prev'); $('#u-fotorusak').hidden = true; im.hidden = !u; if (u) im.src = u.foto_url.startsWith('images/') ? '../' + u.foto_url : u.foto_url;
  $('#u-fotonama').textContent = 'JPG, PNG, atau WebP. Foto otomatis dipotong dan diperbesar agar pas dengan kotak kartu di website.';
  $('#btnHapusUnggulan').hidden = !u; setPesan($('#pesanUnggulan'), '');
  dlgU.showModal();
}
$('#btnTambahUnggulan').addEventListener('click', () => bukaFormUnggulan(null));
/* Foto yang tidak bisa dimuat (file hilang): beri tahu, jangan diam saja */
$('#u-prev').addEventListener('error', () => { $('#u-prev').hidden = true; $('#u-fotorusak').hidden = false; });
$('#daftarUnggulan').addEventListener('error', e => {
  const im = e.target; if (!im.classList || !im.classList.contains('u-thumb')) return;
  im.classList.add('rusak'); im.removeAttribute('src'); im.alt = 'Foto hilang';
}, true);
$('#daftarUnggulan').addEventListener('click', e => {
  const b = e.target.closest('[data-aksi]'), row = e.target.closest('[data-uid]'); if (!b || !row) return;
  const id = Number(row.dataset.uid);
  if (b.dataset.aksi === 'ubah-u') bukaFormUnggulan(unggulanData.find(x => x.id === id));
});
$$('[data-tutup]', dlgU).forEach(b => b.addEventListener('click', () => dlgU.close()));
dlgU.addEventListener('click', e => { if (e.target === dlgU) dlgU.close(); });
dlgU.addEventListener('close', lepasPrevU);
$('#u-foto').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { e.target.value = ''; return setPesan($('#pesanUnggulan'), 'Foto harus JPG, PNG, atau WebP.', true); }
  fotoUnggulanBaru = f; lepasPrevU(); prevUrl = URL.createObjectURL(f);
  const im = $('#u-prev'); im.src = prevUrl; im.hidden = false; $('#u-fotorusak').hidden = true; $('#u-fotonama').textContent = 'Foto baru dipilih: ' + f.name + '. Tekan Simpan untuk menerapkan.'; setPesan($('#pesanUnggulan'), '');
});
formU.addEventListener('submit', async e => {
  e.preventDefault();
  const pesan = $('#pesanUnggulan'), btn = $('#btnSimpanUnggulan');
  if (!unggulanAktif && !fotoUnggulanBaru) return setPesan(pesan, 'Pilih foto untuk kartu baru.', true);
  btn.disabled = true; setPesan(pesan, 'Menyimpan...');
  let urlBaru = null;
  try {
    if (fotoUnggulanBaru) urlBaru = await unggah(fotoUnggulanBaru, 'unggulan');
    const isi = {
      judul: $('#u-judul').value.trim(), sub_judul: $('#u-sub').value.trim() || null, label: $('#u-label').value.trim() || null,
      grup: $('#u-grup').value, kategori_toko: $('#u-kat').value.trim() || 'macbook', urutan: parseInt($('#u-urut').value, 10) || 0,
      deskripsi: $('#u-desk').value.trim() || null, penjelasan: $('#u-peng').value.trim() || null,
      poin: $('#u-poin').value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 8), aktif: $('#u-aktif').checked
    };
    if (!isi.judul) throw new Error('Nama wajib diisi.');
    if (urlBaru) isi.foto_url = urlBaru;
    const q = unggulanAktif ? sb.from('produk_unggulan').update(isi).eq('id', unggulanAktif.id) : sb.from('produk_unggulan').insert(isi);
    const { data, error } = await q.select('id');
    if (error) throw error;
    if (!data || !data.length) throw new Error('Tidak ada data yang tersimpan (periksa izin admin).');
    if (urlBaru && unggulanAktif && unggulanAktif.foto_url.startsWith('http')) await hapusFileStorage(unggulanAktif.foto_url);
    dlgU.close(); toast('Kartu tersimpan. Website terbarui otomatis.', 'sukses'); muatUnggulanAdmin();
  } catch (err) {
    if (urlBaru) await hapusFileStorage(urlBaru);               /* jangan tinggalkan foto yatim bila simpan gagal */
    console.error(err); setPesan(pesan, 'Gagal menyimpan: ' + pesanGalat(err), true);
  } finally { btn.disabled = false; }
});
$('#btnHapusUnggulan').addEventListener('click', async () => {
  const u = unggulanAktif; if (!u || !confirm(`Hapus kartu "${u.judul}" dari beranda?`)) return;
  const { error } = await sb.from('produk_unggulan').delete().eq('id', u.id);
  if (error) return toast('Gagal menghapus: ' + pesanGalat(error), 'galat');
  if (u.foto_url.startsWith('http')) await hapusFileStorage(u.foto_url);
  dlgU.close(); toast('Kartu dihapus', 'sukses'); muatUnggulanAdmin();
});

$$('[data-media]').forEach(root => { manajer[root.dataset.media] = buatManajerMedia(root, root.dataset.media); });
function muatSemuaTab() { Object.values(manajer).forEach(m => m.muat()); muatInfo(); muatProduk(); muatUnggulanAdmin(); muatDashboard(); }

(async function mulai() {
  const nama = location.hash.slice(1);
  if (tabs.some(t => t.dataset.tab === nama)) { pilihTab(nama); $$('.grup-wrap').forEach(w => setGrup(w, false)); }
  const { data } = await sb.auth.getSession();
  tampilkan(data.session);
  sb.auth.onAuthStateChange((evt, session) => {
    setTimeout(() => {
      if (evt === 'SIGNED_OUT') return keWebsite();       /* keluar (dari panel / tab lain / sesi habis) -> ke website utama */
      tampilkan(session);
    }, 0);
  });   /* jangan memanggil Supabase langsung di dalam callback ini */
})();
