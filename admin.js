/* =====================================================================
   LAPTOP MAKASSAR - PANEL ADMIN
   Butuh: supabase-js -> supabase-config.js -> admin.js
   Tab: Hero Desktop, Hero HP, Foto Toko, Promo 1, Promo 2, Info & Kontak, Produk.
   Sekali klik "Simpan" -> data masuk Supabase -> halaman depan
   terbarui otomatis (realtime), tanpa mengubah file di GitHub.
   ===================================================================== */

const BATAS_MB = 50;            // batas file Supabase Storage (paket gratis)
let sudahMuat = false;

/* ---------- Pembantu ---------- */
let timerToast;
function toast(teks) {
  const t = $('#toast'); t.textContent = teks; t.classList.add('tampil');
  clearTimeout(timerToast); timerToast = setTimeout(() => t.classList.remove('tampil'), 2600);
}
const pesanGalat = e => {
  const m = (e && (e.message || e.error_description)) || 'Terjadi kesalahan';
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
   Login TUNGGAL: user dan admin masuk lewat dialog Log in / Sign up di index.html.
   Halaman ini tidak punya login sendiri. Admin dikenali dari email yang dikunci di database
   (tabel admin_emails, fungsi is_admin). Belum login / bukan admin -> kembali ke index.html. */
let sedangCek = false;
async function tampilkan(session) {
  if (!session) { location.replace('index.html'); return; }
  if (sudahMuat || sedangCek) return;
  sedangCek = true;
  $('#viewCek').hidden = false;
  const admin = await LMAuth.cekAdmin();
  sedangCek = false;
  if (!admin) { location.replace('index.html'); return; }          /* user biasa tetap di katalog */
  $('#viewCek').hidden = true; $('#viewPanel').hidden = false;
  sudahMuat = true; muatSemuaTab();
}
$('#btnKeluar').addEventListener('click', async () => { await LMAuth.keluar(); location.replace('index.html'); });

/* ---------- Tab ---------- */
const tabs = $$('[role="tab"]');
function pilihTab(nama, fokus = false) {
  tabs.forEach(t => {
    const aktif = t.dataset.tab === nama;
    t.setAttribute('aria-selected', String(aktif)); t.tabIndex = aktif ? 0 : -1;
    $('#' + t.getAttribute('aria-controls')).hidden = !aktif;
    if (aktif && fokus) t.focus();
  });
  try { history.replaceState(null, '', '#' + nama); } catch (e) {}
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => pilihTab(t.dataset.tab));
  t.addEventListener('keydown', e => {
    const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!k) return;
    e.preventDefault(); pilihTab(tabs[(i + k + tabs.length) % tabs.length].dataset.tab, true);
  });
});

/* =====================================================================
   MANAJER MEDIA (dipakai 5 tab: hero_desktop, hero_hp, toko, promo, promo2)
   Perubahan ditampung dulu, baru dikirim saat klik "Simpan".
   ===================================================================== */
const KONFIG_MEDIA = {
  hero_desktop: { judul: 'Media Hero Desktop', maks: 8, video: true, rasio: '',
    info: 'Tampil di laptop/PC. Gunakan foto/video LANDSCAPE 16:9 (contoh 1920×1080).' },
  hero_hp: { judul: 'Media Hero HP', maks: 8, video: true, rasio: 'r-hp',
    info: 'Tampil di HP. Gunakan foto/video POTRET 9:16 (contoh 1080×1920).' },
  toko: { judul: 'Foto "Kunjungi Toko Kami"', maks: 4, video: false, rasio: '',
    info: 'Khusus foto, maksimal 4. Tampil turun ke bawah di HP (lebar penuh) dan 2 kolom di laptop. Foto tampil utuh, tidak dipotong. Pakai foto beresolusi tinggi (min. lebar 1600 px).' },
  promo: { judul: 'Slide Promo 1 (Promo Saat Ini)', maks: 10, video: false, rasio: '',
    info: 'Khusus foto atau infografis, maksimal 10. Tampil sebagai slide geser dan utuh tidak dipotong. Disarankan POTRET 4:5 (contoh 1080x1350).' },
  promo2: { judul: 'Slide Promo 2 (di bawah Promo 1)', maks: 10, video: false, rasio: '',
    info: 'Khusus foto atau infografis, maksimal 10. Tampil sebagai slide geser kedua tepat di bawah Promo 1. Disarankan POTRET 4:5 (contoh 1080x1350).' },
};

function buatManajerMedia(root, bagian) {
  const cfg = KONFIG_MEDIA[bagian];
  let items = [];
  let sibuk = false;

  root.innerHTML = `
    <div class="bagian-kepala"><div><h2>${esc(cfg.judul)}</h2><p class="muted" data-hitung></p></div></div>
    <p class="aturan">${esc(cfg.info)} Urutan slide mengikuti urutan daftar di bawah.${cfg.video ? ' Video maksimal ' + BATAS_MB + ' MB (disarankan MP4/H.264 di bawah 15 MB agar cepat dimuat).' : ''}</p>
    <div class="daftar" data-daftar></div>
    <div class="unggah">
      <label for="u-${bagian}">Tambah ${cfg.video ? 'foto atau video' : 'foto'}</label>
      <input id="u-${bagian}" type="file" multiple accept="${cfg.video ? 'image/*,video/mp4,video/webm,video/quicktime' : 'image/*'}">
      <small>File baru baru dikirim setelah kamu menekan Simpan.</small>
    </div>
    <div class="bar-simpan"><button type="button" class="btn" data-simpan>Simpan</button><span class="pesan" data-pesan role="status"></span></div>`;
  const elDaftar = $('[data-daftar]', root), elHitung = $('[data-hitung]', root), elPesan = $('[data-pesan]', root), btnSimpan = $('[data-simpan]', root), inputFile = $('input[type=file]', root);

  const aktifJumlah = () => items.filter(x => !x.hapus).length;

  function gambar() {
    elHitung.textContent = `${aktifJumlah()} dari maksimal ${cfg.maks} slide`;
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

  inputFile.addEventListener('change', () => {
    setPesan(elPesan, '');
    for (const f of inputFile.files) {
      const video = f.type.startsWith('video/'), foto = f.type.startsWith('image/');
      if (!foto && !(video && cfg.video)) { toast(`"${f.name}" dilewati: jenis file tidak didukung`); continue; }
      if (aktifJumlah() >= cfg.maks) { toast(`Maksimal ${cfg.maks} slide. Hapus salah satu dulu.`); break; }
      if (f.size > BATAS_MB * 1024 * 1024) { toast(`"${f.name}" lebih dari ${BATAS_MB} MB`); continue; }
      items.push({ id: null, file: f, jenis: video ? 'video' : 'foto', url: URL.createObjectURL(f), judul: '', aktif: true, hapus: false });
    }
    inputFile.value = ''; gambar();
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
   PRODUK
   ===================================================================== */
let produkList = [];
const dlgProduk = $('#dlgProduk'), formProduk = $('#formProduk');
let editId = null, fotoLama = '';
$('#p-kategori').innerHTML = KATEGORI.map(k => `<option value="${k.id}">${esc(k.label)}</option>`).join('');
$('#p-tags').innerHTML = Object.entries(LABEL_TAG).map(([id, t]) => `<label><input type="checkbox" value="${id}"> ${esc(t)}</label>`).join('');
dlgProduk.addEventListener('click', e => { if (e.target === dlgProduk) dlgProduk.close(); });
$$('[data-tutup]', dlgProduk).forEach(b => b.addEventListener('click', () => dlgProduk.close()));

async function muatProduk() {
  let r = await sb.from('produk').select('*').order('created_at', { ascending: false });
  if (r.error) r = await sb.from('produk').select('*').order('id', { ascending: false });
  const el = $('#daftarProduk');
  if (r.error) { el.innerHTML = `<div class="kosong">Gagal memuat produk: ${esc(pesanGalat(r.error))}</div>`; return; }
  produkList = r.data || [];
  el.innerHTML = produkList.length ? produkList.map(p => {
    const tags = Array.isArray(p.tags) ? p.tags : [];
    return `<div class="prod" data-id="${esc(p.id)}">
      <img src="${esc(p.foto || window.FOTO_KOSONG)}" alt="" onerror="this.onerror=null;this.src=window.FOTO_KOSONG">
      <div><b>${esc(namaLengkap(p))}</b><span class="muted">${rupiah(p.harga)} &middot; ${esc((KATEGORI.find(k => k.id === p.kategori) || {}).label || p.kategori || '-')}${tags.length ? ' &middot; ' + tags.map(t => esc(LABEL_TAG[t] || t)).join(', ') : ''}</span></div>
      <div class="prod-aksi"><button type="button" class="btn btn-garis btn-kecil" data-aksi="edit">Ubah</button><button type="button" class="btn btn-bahaya btn-kecil" data-aksi="hapus">Hapus</button></div>
    </div>`;
  }).join('') : '<div class="kosong">Belum ada produk.</div>';
}
function bukaFormProduk(p) {
  editId = p ? p.id : null; fotoLama = p ? (p.foto || '') : '';
  let sp = p ? p.spek : {}; if (typeof sp === 'string') { try { sp = JSON.parse(sp); } catch { sp = {}; } } sp = sp || {};
  const tags = p && Array.isArray(p.tags) ? p.tags : [];
  $('#dlgProdukJudul').textContent = p ? 'Ubah produk' : 'Tambah produk';
  $('#p-kategori').value = p ? p.kategori : KATEGORI[0].id;
  $('#p-kondisi').value = p && KONDISI[p.kondisi] ? p.kondisi : 'bekas';
  $('#p-merek').value = p ? p.merek || '' : ''; $('#p-seri').value = p ? p.seri || '' : '';
  $('#p-harga').value = p ? p.harga : ''; $('#p-normal').value = p && p.harganormal ? p.harganormal : '';
  $('#p-proc').value = sp.processor || ''; $('#p-ram').value = sp.ram || ''; $('#p-storage').value = sp.storage || '';
  $('#p-vga').value = sp.vga || ''; $('#p-layar').value = sp.layar || '';
  $$('#p-tags input').forEach(c => { c.checked = tags.includes(c.value); });
  $('#p-foto').value = ''; $('#p-preview').innerHTML = fotoLama ? `<img src="${esc(fotoLama)}" alt="Foto saat ini">` : '';
  setPesan($('#pesanProduk'), ''); $('#pesanProduk').hidden = true;
  dlgProduk.showModal();
}
$('#btnProdukBaru').addEventListener('click', () => bukaFormProduk(null));
$('#p-foto').addEventListener('change', e => {
  const f = e.target.files[0]; $('#p-preview').innerHTML = f ? `<img src="${URL.createObjectURL(f)}" alt="Pratinjau">` : (fotoLama ? `<img src="${esc(fotoLama)}" alt="Foto saat ini">` : '');
});
$('#daftarProduk').addEventListener('click', async e => {
  const b = e.target.closest('[data-aksi]'), row = e.target.closest('[data-id]'); if (!b || !row) return;
  const p = produkList.find(x => String(x.id) === row.dataset.id); if (!p) return;
  if (b.dataset.aksi === 'edit') return bukaFormProduk(p);
  if (!confirm(`Hapus "${namaLengkap(p)}" dari toko? Tindakan ini tidak bisa dibatalkan.`)) return;
  const { error } = await sb.from('produk').delete().eq('id', p.id);
  if (error) return toast('Gagal menghapus: ' + pesanGalat(error));
  await hapusFileStorage(p.foto); toast('Produk dihapus'); muatProduk();
});
formProduk.addEventListener('submit', async e => {
  e.preventDefault();
  const b = $('#btnSimpanProduk'), pesan = $('#pesanProduk'); b.disabled = true; pesan.hidden = true;
  try {
    const file = $('#p-foto').files[0];
    let foto = fotoLama;
    if (file) { if (!file.type.startsWith('image/')) throw new Error('File foto harus berupa gambar'); foto = await unggah(file, 'produk'); }
    const normal = Number($('#p-normal').value) || null;
    const harga = Number($('#p-harga').value) || 0;
    const isi = {
      kategori: $('#p-kategori').value, kondisi: $('#p-kondisi').value,
      merek: $('#p-merek').value.trim(), seri: $('#p-seri').value.trim(),
      harga, harganormal: normal && normal > harga ? normal : null,
      tags: $$('#p-tags input:checked').map(c => c.value), foto,
      spek: { processor: $('#p-proc').value.trim(), ram: $('#p-ram').value.trim(), storage: $('#p-storage').value.trim(), vga: $('#p-vga').value.trim(), layar: $('#p-layar').value.trim() }
    };
    const { error } = editId !== null ? await sb.from('produk').update(isi).eq('id', editId) : await sb.from('produk').insert(isi);
    if (error) { if (file && foto !== fotoLama) await hapusFileStorage(foto); throw error; }
    if (file && fotoLama && fotoLama !== foto) await hapusFileStorage(fotoLama);
    dlgProduk.close(); toast('Produk tersimpan'); muatProduk();
  } catch (err) { console.error(err); pesan.textContent = 'Gagal menyimpan: ' + pesanGalat(err); pesan.hidden = false; }
  finally { b.disabled = false; }
});

/* ---------- Mulai ---------- */
const manajer = {};
$$('[data-media]').forEach(root => { manajer[root.dataset.media] = buatManajerMedia(root, root.dataset.media); });
function muatSemuaTab() { Object.values(manajer).forEach(m => m.muat()); muatInfo(); muatProduk(); }

(async function mulai() {
  const nama = location.hash.slice(1);
  if (tabs.some(t => t.dataset.tab === nama)) pilihTab(nama);
  const { data } = await sb.auth.getSession();
  tampilkan(data.session);
  sb.auth.onAuthStateChange((_e, session) => { setTimeout(() => tampilkan(session), 0); });   /* jangan memanggil Supabase langsung di dalam callback ini */
})();
