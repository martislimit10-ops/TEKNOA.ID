/* =====================================================================
   LAPTOP MAKASSAR - SCRIPT HALAMAN PENGUNJUNG
   Butuh (urutan): supabase-js -> supabase-config.js -> script.js
   Data (produk, info toko, slider) semua dari Supabase + realtime.
   Daftar isi:
   1. Keadaan & pembantu     5. Foto toko + carousel katalog   9. Pencarian AI
   2. Info toko              6. Halaman Toko                  10. Data Supabase
   3. Tema & sidebar         7. Keranjang                     11. Mulai
   4. Hero slider            8. Detail produk
   ===================================================================== */

/* ---------- 1. Keadaan & pembantu ---------- */
const CONFIG = { ...CONFIG_AWAL };
let PRODUK = [];
let BANNER = [];
const DEVICE = window.LM_HP ? 'hp' : 'desktop';
const PAGE = 8;
const MAKS_QTY = 5;
const KEY_KERANJANG = 'lm_keranjang';
const KEY_BANDING = 'lm_bandingkan';
const MAKS_BANDING = 4;
/* Akun (login Google). Peran admin/user ditentukan database lewat LMAuth.cekAdmin(). */
let USER = null, IS_ADMIN = false;
let FAV = [];                                   /* id produk favorit (string), terbaru di depan */
let CMP = (() => { try { const a = JSON.parse(localStorage.getItem(KEY_BANDING) || '[]'); return Array.isArray(a) ? a.map(String).slice(0, MAKS_BANDING) : []; } catch (e) { return []; } })();
const adaFav = id => !!USER && FAV.includes(String(id));
const adaBanding = id => !!USER && CMP.includes(String(id));
const kurangGerak = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const fotoErr = `onerror="this.onerror=null;this.src=window.FOTO_KOSONG"`;
const waLink = teks => `https://wa.me/${String(CONFIG.wa || '').replace(/\D/g, '')}?text=${encodeURIComponent(teks)}`;

window.addEventListener('resize', () => window.aturSkala && window.aturSkala());
window.addEventListener('orientationchange', () => setTimeout(() => window.aturSkala && window.aturSkala(), 250));

/* Kunci scroll halaman saat dialog/sidebar terbuka */
let jumlahKunci = 0;
function kunci(ya) {
  jumlahKunci = Math.max(0, jumlahKunci + (ya ? 1 : -1));
  document.documentElement.classList.toggle('kunci', jumlahKunci > 0);
}
function bukaDialog(d) { if (!d.open) { d.showModal(); kunci(true); } }
$$('dialog.dlg').forEach(d => {
  d.addEventListener('close', () => kunci(false));
  d.addEventListener('click', e => { if (e.target === d) d.close(); });
  $$('[data-tutup]', d).forEach(b => b.addEventListener('click', () => d.close()));
});

let timerToast;
function toast(teks) {
  const t = $('#toast');
  t.textContent = teks; t.classList.add('tampil');
  clearTimeout(timerToast);
  timerToast = setTimeout(() => t.classList.remove('tampil'), 2200);
}
function gulirKe(sel) {
  const el = $(sel);
  if (el) el.scrollIntoView({ behavior: kurangGerak() ? 'auto' : 'smooth', block: 'start' });
}
function tautanSosmed(nilai, dasar) {
  const v = String(nilai || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return dasar + encodeURIComponent(v.replace(/^@/, ''));
}
const handle = v => '@' + String(v || '').trim().replace(/^https?:\/\/[^/]+\/@?/i, '').replace(/^@/, '').replace(/\/$/, '');

$('#tahun').textContent = new Date().getFullYear();

/* ---------- 2. Info toko ---------- */
function terapkanConfig() {
  $$('[data-fill]').forEach(el => { el.textContent = CONFIG[el.dataset.fill] ?? ''; });
  $$('[data-wa]').forEach(a => { a.href = waLink(CONFIG.pesan_umum); });
  $$('[data-ig]').forEach(a => { a.href = tautanSosmed(CONFIG.instagram, 'https://www.instagram.com/'); });
  $$('[data-ig-text]').forEach(s => { s.textContent = handle(CONFIG.instagram); });
  $$('[data-tt]').forEach(a => { a.href = tautanSosmed(CONFIG.tiktok, 'https://www.tiktok.com/@'); });
  $$('[data-tt-text]').forEach(s => { s.textContent = handle(CONFIG.tiktok); });
  $$('[data-maps]').forEach(a => { a.href = CONFIG.maps_link; });
  $$('[data-mail]').forEach(a => { a.href = CONFIG.email ? 'mailto:' + CONFIG.email : '#'; a.hidden = !CONFIG.email; });
  const peta = $('#peta');
  if (peta && CONFIG.peta_embed_url && peta.getAttribute('src') !== CONFIG.peta_embed_url) peta.src = CONFIG.peta_embed_url;
  if (peta) peta.closest('.peta').hidden = !CONFIG.peta_embed_url;
}

/* ---------- 3. Tema & sidebar ---------- */
const saklar = $('#saklarTema');
function setTema(gelap, simpan = true) {
  document.documentElement.toggleAttribute('data-tema', gelap);
  if (gelap) document.documentElement.setAttribute('data-tema', 'gelap');
  saklar.setAttribute('aria-checked', String(gelap));
  const tn = document.getElementById('btnTemaNav');   /* katalog laptop: teks = mode tujuan */
  if (tn) tn.textContent = gelap ? 'Terang' : 'Gelap';
  $('meta[name="theme-color"]').content = gelap ? '#0f1115' : '#fafafa';
  if (simpan) { try { localStorage.setItem('lm_tema', gelap ? 'gelap' : 'terang'); } catch (e) {} }
}
setTema(document.documentElement.getAttribute('data-tema') === 'gelap', false);
saklar.addEventListener('click', () => setTema(saklar.getAttribute('aria-checked') !== 'true'));

const sidebar = $('#sidebar'), btnMenu = $('#btnMenu');
function bukaSidebar() {
  sidebar.removeAttribute('inert'); sidebar.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => sidebar.classList.add('buka'));
  btnMenu.setAttribute('aria-expanded', 'true'); btnMenu.setAttribute('aria-label', 'Tutup menu');
  kunci(true);
  const pertama = $('a', sidebar); if (pertama) pertama.focus({ preventScroll: true });
}
function tutupSidebar(fokus = true) {
  if (!sidebar.classList.contains('buka')) return;
  sidebar.classList.remove('buka');
  sidebar.setAttribute('inert', ''); sidebar.setAttribute('aria-hidden', 'true');
  btnMenu.setAttribute('aria-expanded', 'false'); btnMenu.setAttribute('aria-label', 'Buka menu');
  kunci(false);
  if (fokus) btnMenu.focus();
}
/* Tombol 2 garis: satu tombol untuk buka dan tutup (berubah jadi X) */
btnMenu.addEventListener('click', () => sidebar.classList.contains('buka') ? tutupSidebar(false) : bukaSidebar());
sidebar.addEventListener('click', e => {
  const a = e.target.closest('a'); if (!a) return;
  const go = a.dataset.goto;
  tutupSidebar(false);                       /* semua tautan menutup menu; "Toko" dibuka oleh pengendali #toko */
  if (go) { e.preventDefault(); gulirKe(go); }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (sidebar.classList.contains('buka')) tutupSidebar();
  else if (!storePage.hidden && !document.querySelector('dialog[open]')) tutupToko();
});

/* ---------- 4. Hero slider (foto + video) ---------- */
const hero = { slides: [], idx: 0, timer: null, jeda: false, suara: false, ditahan: false, sig: '' };
const heroEl = $('#hero'), heroTrack = $('#heroTrack');
const IKON = id => `<svg><use href="#${id}"/></svg>`;

function daftarHero() {
  const utama = DEVICE === 'hp' ? 'hero_hp' : 'hero_desktop';
  const cadangan = DEVICE === 'hp' ? 'hero_desktop' : 'hero_hp';
  let l = BANNER.filter(b => b.bagian === utama && b.aktif !== false);
  if (!l.length) l = BANNER.filter(b => b.bagian === cadangan && b.aktif !== false);
  return l;
}
function renderHero() {
  const l = daftarHero();
  const sig = JSON.stringify(l.map(b => [b.id, b.url, b.jenis, b.judul, b.urutan]));
  if (sig === hero.sig) return;
  hero.sig = sig; hero.slides = l; hero.idx = 0; hero.jeda = false;
  clearTimeout(hero.timer);

  if (!l.length) {
    heroTrack.innerHTML = `<div class="hero-slide"><div class="hero-kosong"><b>Laptop Makassar</b><span>Laptop baru dan bekas berkualitas</span></div></div>`;
    $('#heroNav').hidden = true; $('#heroKontrol').hidden = true; $('#heroCap').textContent = '';
    return;
  }
  heroTrack.innerHTML = l.map((b, i) => `<div class="hero-slide" aria-hidden="${i !== 0}">` + (b.jenis === 'video'
    ? `<video src="${esc(b.url)}" muted playsinline preload="${i === 0 ? 'auto' : 'metadata'}" ${l.length === 1 ? 'loop' : ''}></video>`
    : `<img src="${esc(b.url)}" alt="${esc(b.judul || 'Promo Laptop Makassar')}" ${i === 0 ? '' : 'loading="lazy"'} ${fotoErr}>`) + `</div>`).join('');
  $$('video', heroTrack).forEach((v, i) => {
    v.addEventListener('ended', () => { if (hero.slides.length > 1) heroKe(hero.idx + 1); });
    v.addEventListener('error', () => { if (hero.slides[hero.idx] && heroTrack.children[hero.idx].contains(v)) jadwalkanHero(6000); });
  });
  $('#heroBars').innerHTML = l.map((_, i) => `<button type="button" aria-label="Slide ${i + 1}" data-i="${i}"></button>`).join('');
  $('#heroNav').hidden = l.length < 2;
  heroKe(0, true);
}
function slideAktif() { return hero.slides[hero.idx]; }
function videoAktif() { return heroTrack.children[hero.idx]?.querySelector('video') || null; }
function jadwalkanHero(ms) {
  clearTimeout(hero.timer);
  if (hero.slides.length < 2 || hero.ditahan || hero.jeda) return;
  hero.timer = setTimeout(() => heroKe(hero.idx + 1), ms);
}
function heroKe(i, awal = false) {
  const n = hero.slides.length; if (!n) return;
  if (!awal) hero.jeda = false;
  hero.idx = ((i % n) + n) % n;
  heroTrack.style.transform = `translateX(-${hero.idx * 100}%)`;
  $$('.hero-slide', heroTrack).forEach((s, k) => s.setAttribute('aria-hidden', String(k !== hero.idx)));
  $$('#heroBars button').forEach((b, k) => b.setAttribute('aria-current', String(k === hero.idx)));
  const s = slideAktif();
  $('#heroCap').textContent = s.judul || '';
  /* kontrol jeda/suara HANYA untuk slide video; slide foto tanpa kontrol */
  $('#heroKontrol').hidden = s.jenis !== 'video';
  $$('video', heroTrack).forEach(v => { v.pause(); v.currentTime = 0; v.muted = !hero.suara; });
  perbaruiIkonHero();
  clearTimeout(hero.timer);
  if (s.jenis === 'video') {
    const v = videoAktif();
    if (v && !hero.ditahan) v.play().catch(() => jadwalkanHero(6000));
  } else jadwalkanHero(5500);
}
function perbaruiIkonHero() {
  $('#heroJeda').innerHTML = IKON(hero.jeda ? 'i-play' : 'i-pause');
  $('#heroJeda').setAttribute('aria-label', hero.jeda ? 'Putar video' : 'Jeda video');
  $('#heroSuara').innerHTML = IKON(hero.suara ? 'i-vol' : 'i-mute');
  $('#heroSuara').setAttribute('aria-label', hero.suara ? 'Matikan suara' : 'Nyalakan suara');
}
function heroTahan(ya) {
  hero.ditahan = ya;
  const v = videoAktif();
  if (ya) { clearTimeout(hero.timer); if (v) v.pause(); }
  else if (slideAktif()) {
    if (v && !hero.jeda) v.play().catch(() => {});
    else if (slideAktif().jenis !== 'video') jadwalkanHero(5500);
  }
}
$('#heroJeda').addEventListener('click', () => {
  const v = videoAktif(); if (!v) return;
  hero.jeda = !hero.jeda;
  if (hero.jeda) v.pause(); else v.play().catch(() => {});
  perbaruiIkonHero();
});
$('#heroSuara').addEventListener('click', () => {
  hero.suara = !hero.suara;
  $$('video', heroTrack).forEach(v => { v.muted = !hero.suara; });
  perbaruiIkonHero();
});
$('#heroPrev').addEventListener('click', () => heroKe(hero.idx - 1));
$('#heroNext').addEventListener('click', () => heroKe(hero.idx + 1));
$('#heroBars').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) heroKe(+b.dataset.i); });
pasangGeser(heroEl, d => heroKe(hero.idx + d));
document.addEventListener('visibilitychange', () => heroTahan(document.hidden || !storePage.hidden));

/* Geser jari/mouse kiri-kanan */
function pasangGeser(el, aksi) {
  let x0 = null, y0 = 0;
  el.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; x0 = e.clientX; y0 = e.clientY; });
  el.addEventListener('pointerup', e => {
    if (x0 === null) return;
    const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) aksi(dx < 0 ? 1 : -1);
  });
  el.addEventListener('pointercancel', () => { x0 = null; });
}

/* ---------- 5. Galeri "Kunjungi toko kami" (maks. 4 foto, dikelola dari admin) [PATCH-GALERI] ---------- */
const GALERI_MAKS = 4;
const galeri = { sig: '' };
/* Nama fungsi sengaja dipertahankan agar pemanggil lama (muatSemua & bagian Mulai) tetap jalan.
   Hanya foto asli yang dirender: tidak ada lagi kotak kosong pengisi. */
function renderSliderToko() {
  const root = $('#galeriToko'); if (!root) return;
  const l = BANNER.filter(b => b.bagian === 'toko' && b.jenis === 'foto' && b.aktif !== false && b.url).slice(0, GALERI_MAKS);
  const sig = JSON.stringify(l.map(b => [b.id, b.url, b.judul, b.urutan]));
  if (sig === galeri.sig) return;
  galeri.sig = sig;
  root.hidden = !l.length;
  root.innerHTML = l.map(b => `<figure class="galeri-item"><img src="${esc(b.url)}" alt="${esc(b.judul || 'Foto toko Laptop Makassar')}" loading="lazy" ${fotoErr}>${b.judul ? `<figcaption>${esc(b.judul)}</figcaption>` : ''}</figure>`).join('');
}

/* ---------- 5b. Seksi gaya Apple (strip, Jelajahi jajarannya, akordeon, kartu geser, footer) ----------
   Semua foto & teks bagian ini STATIS: folder images/katalog/ dan images/tekno/ (lihat BACA-INI.txt).
   Tidak memakai Supabase, tidak bisa diubah dari panel admin.
   Tombol "Selengkapnya" / "Beli" membuka halaman Toko + keranjang (sama dengan ikon keranjang di header),
   langsung terfilter ke kategori kartu. Tidak ada popup detail / tombol pesan. */

/* Pembantu carousel horizontal: panah, status disabled, sembunyikan panah kalau muat semua */
function pasangCarousel(list, prev, next, nav) {
  if (!list || !prev || !next) return () => {};
  const upd = () => {
    const muat = list.scrollWidth > list.clientWidth + 4;
    if (nav) nav.hidden = !muat;
    prev.disabled = list.scrollLeft < 4;
    next.disabled = list.scrollLeft + list.clientWidth >= list.scrollWidth - 4;
  };
  const geser = arah => {
    const k = [...list.children].find(c => c.offsetParent !== null);
    const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
    const langkah = k ? k.getBoundingClientRect().width + gap : list.clientWidth * .8;
    list.scrollBy({ left: arah * langkah, behavior: kurangGerak() ? 'auto' : 'smooth' });
  };
  prev.addEventListener('click', () => geser(-1));
  next.addEventListener('click', () => geser(1));
  list.addEventListener('scroll', () => requestAnimationFrame(upd), { passive: true });
  list.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); geser(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); geser(-1); }
  });
  $$('img', list).forEach(im => im.addEventListener('load', upd));
  return upd;
}
const katalogList = $('#katalogList');
const updKatalog = pasangCarousel(katalogList, $('#katalogPrev'), $('#katalogNext'), $('#katalogNav'));
const updEsensial = pasangCarousel($('#esensialList'), $('#esensialPrev'), $('#esensialNext'), $('#esensialNav'));

/* Strip ikon di bawah judul TEKNO: panah kanan/kiri muncul sesuai posisi geser */
const apStrip = $('#apStrip'), stripPrev = $('#apStripPrev'), stripNext = $('#apStripNext');
function updStrip() {
  if (!apStrip) return;
  const luber = apStrip.scrollWidth > apStrip.clientWidth + 4;
  stripPrev.hidden = !luber || apStrip.scrollLeft < 4;
  stripNext.hidden = !luber || apStrip.scrollLeft + apStrip.clientWidth >= apStrip.scrollWidth - 4;
}
if (apStrip) {
  apStrip.addEventListener('scroll', () => requestAnimationFrame(updStrip), { passive: true });
  const stripGeser = a => apStrip.scrollBy({ left: a * apStrip.clientWidth * .7, behavior: kurangGerak() ? 'auto' : 'smooth' });
  stripPrev.addEventListener('click', () => stripGeser(-1));
  stripNext.addEventListener('click', () => stripGeser(1));
}

/* Pill filter: Semua produk | Laptop | Desktop | Layar */
const apPill = $('#apPill'), apPillNext = $('#apPillNext');
function updPill() {
  if (!apPill) return;
  apPillNext.hidden = apPill.scrollWidth <= apPill.clientWidth + 4 || apPill.scrollLeft + apPill.clientWidth >= apPill.scrollWidth - 4;
}
if (apPill) {
  apPill.addEventListener('scroll', () => requestAnimationFrame(updPill), { passive: true });
  apPillNext.addEventListener('click', () => apPill.scrollBy({ left: 140, behavior: kurangGerak() ? 'auto' : 'smooth' }));
  apPill.addEventListener('click', e => {
    const b = e.target.closest('[data-filter]'); if (!b) return;
    const f = b.dataset.filter;
    $$('.ap-pill-btn', apPill).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    $$('.k-kartu', katalogList).forEach(c => { c.hidden = f !== 'all' && c.dataset.grup !== f; });
    katalogList.scrollLeft = 0; updKatalog();
  });
}

/* Titik warna di kartu hanya hiasan (tidak bisa diklik), seperti di apple.com/mac */

/* Popup "Selengkapnya": penjelasan produk, TIDAK ke toko/keranjang. Tombol "Beli" yang ke toko. */
const PRODUK_INFO = {
  'neo': { foto: 1, judul: 'MacBook Neo', ringkas: 'Keajaiban Mac dengan harga mengejutkan. Cocok buat yang mau masuk ke dunia Mac tanpa bikin kantong jebol.',
    poin: ['Pintu masuk paling terjangkau ke keluarga MacBook', 'Ringan dan praktis untuk kuliah, sekolah, dan kerja harian', 'Tampil dalam 4 warna segar'] },
  'air': { foto: 2, judul: 'MacBook Air 13″ dan 15″', ringkas: 'Tipis, cepat, andal, dan portabel. Laptop paling pas buat dibawa ke mana-mana.',
    poin: ['Tersedia ukuran layar 13″ dan 15″', 'Desain sangat tipis dan ringan', 'Tenaga cukup untuk kerja, kuliah, dan kreatif sehari-hari'] },
  'pro-m6': { foto: 3, judul: 'MacBook Pro 14″ dan 16″', label: '14″ baru dengan M6', ringkas: 'Laptop bertenaga untuk tiap tipe pro, kini hadir versi 14″ baru dengan chip M6.',
    poin: ['Pilihan ukuran 14″ dan 16″', 'Chip M6 pada model 14″ baru', 'Dibuat untuk alur kerja berat: editing, desain, dan pengembangan'] },
  'pro-xdr': { foto: 4, judul: 'MacBook Pro 14″ dan 16″', label: 'Baru · Layar PROLED XDR', ringkas: 'MacBook Pro paling canggih dengan layar laptop terbaik di dunia.',
    poin: ['Layar PROLED XDR dengan kualitas gambar kelas atas', 'Pilihan ukuran 14″ dan 16″', 'Untuk kreator dan profesional yang butuh akurasi warna'] },
  'imac': { foto: 5, judul: 'iMac', label: 'Baru', ringkas: 'Desktop lengkap untuk kreativitas dan produktivitas. Layar, komputer, dan desain jadi satu.',
    poin: ['Desktop all-in-one: tinggal colok dan pakai', 'Layar Retina yang tajam dan cerah', 'Tersedia dalam 7 warna'] },
  'mini': { foto: 6, judul: 'Mac mini', label: 'Baru', ringkas: 'Desktop Mac paling mini dan terjangkau. Ukurannya kecil, tenaganya tidak.',
    poin: ['Paling ringkas dan paling terjangkau di antara desktop Mac', 'Muat di meja sempit atau mudah dibawa', 'Pakai monitor, keyboard, dan mouse pilihanmu'] },
  'studio': { foto: 7, judul: 'Mac Studio', label: 'Baru', ringkas: 'Performa dan konektivitas andal untuk profesional.',
    poin: ['Tenaga besar untuk render, editing video, dan kerja berat', 'Banyak port untuk perangkat dan layar tambahan', 'Desain ringkas, cocok untuk meja kerja studio'] },
  'display': { foto: 8, judul: 'Studio Display', ringkas: 'Layar Retina 5K yang sempurna untuk Mac.',
    poin: ['Resolusi Retina 5K, gambar dan teks sangat tajam', 'Dirancang serasi dengan Mac', 'Enak dipakai kerja seharian'] },
  'display-xdr': { foto: 9, judul: 'Studio Display XDR', ringkas: 'Layar Retina XDR 5K terbaik untuk alur kerja kreatif dan pro.',
    poin: ['Layar Retina XDR 5K dengan kecerahan dan kontras tinggi', 'Untuk editing foto, video, dan grading warna', 'Pilihan tertinggi untuk alur kerja profesional'] }
};
const infoModal = $('#infoModal');
function bukaInfo(id, pemicu) {
  const p = PRODUK_INFO[id]; if (!p || !infoModal) return;
  $('#infoFoto').src = 'images/katalog/foto' + p.foto + '.png';
  $('#infoFoto').alt = p.judul;
  $('#infoLabel').textContent = p.label || '';
  $('#infoJudul').textContent = p.judul;
  $('#infoRingkas').textContent = p.ringkas;
  $('#infoPoin').innerHTML = p.poin.map(x => '<li>' + esc(x) + '</li>').join('');
  const kartu = pemicu && pemicu.closest('.k-kartu');
  const warna = kartu ? $$('.k-titik', kartu).map(x => x.title).filter(Boolean) : [];
  $('#infoWarna').textContent = warna.length ? 'Pilihan warna: ' + warna.join(', ') : '';
  infoModal.dataset.pemicu = id;
  if (!infoModal.open) infoModal.showModal();
}
if (katalogList && infoModal) {
  katalogList.addEventListener('click', e => {
    const b = e.target.closest('[data-info]'); if (!b) return;
    infoModal._balik = b; bukaInfo(b.dataset.info, b);
  });
  const tutup = () => { if (infoModal.open) infoModal.close(); };
  $('#infoTutup').addEventListener('click', tutup);
  $('#infoBatal').addEventListener('click', tutup);
  infoModal.addEventListener('click', e => { if (e.target === infoModal) tutup(); });   /* klik latar gelap = tutup */
  infoModal.addEventListener('close', () => { if (infoModal._balik) infoModal._balik.focus(); });
  /* "Beli" di dalam popup: tutup popup dulu, lalu handler data-ke-toko membuka toko/keranjang */
  $('#infoBeli').addEventListener('click', tutup);
}

/* Akordeon "Jelajahi dunia TEKNO": satu panel terbuka (cadangan untuk browser tanpa atribut name) */
$$('.ap-acc details').forEach(d => d.addEventListener('toggle', () => {
  if (d.open) $$('.ap-acc details').forEach(o => { if (o !== d) o.open = false; });
}));

/* Semua tombol/tautan data-ke-toko => halaman Toko + keranjang, terfilter ke kategori (bila ada) */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-ke-toko]'); if (!el) return;
  e.preventDefault();
  const k = el.dataset.kategori;
  storeSelect.value = el.dataset.tag ? 'tag:' + el.dataset.tag : (k && k !== 'all' ? 'kategori:' + k : 'all');
  storeSelect.dispatchEvent(new Event('change'));
  bukaToko();
});
/* Tautan gulir di dalam halaman (Lokasi, Merek) di luar sidebar */
document.addEventListener('click', e => {
  const go = e.target.closest('main [data-goto], .ap-dir [data-goto], .apf [data-goto]');
  if (go) { e.preventDefault(); gulirKe(go.dataset.goto); }
});

/* Daftar kategori untuk direktori & footer (sama dengan filter di halaman Toko) */
function renderDaftarKategori() {
  const item = (k, t) => `<li><a href="#" data-ke-toko data-kategori="${esc(k)}">${esc(t)}</a></li>`;
  const foot = $('#footKategori'), dir = $('#dirKategori');
  if (foot) foot.innerHTML = item('all', 'Semua laptop') + KATEGORI.map(k => item(k.id, k.label)).join('');
  if (dir) dir.innerHTML = item('all', 'Jelajahi Semua Laptop') + KATEGORI.map(k => item(k.id, k.label)).join('');
  const mg = $('#megaKategori');   /* panel popup katalog: daftar besar bergaya apple.com */
  if (mg) mg.innerHTML = [{ id: 'all', label: 'Semua laptop' }, ...KATEGORI].map((k, i) => `<li class="mi" style="--i:${i + 1}"><a href="#" data-ke-toko data-kategori="${esc(k.id)}">${esc(k.label)}</a></li>`).join('');
}

/* Footer: akordeon di HP, kolom terbuka di layar lebar */
const mqFoot = window.matchMedia('(min-width:900px)');
function sinkronFoot() { $$('.apf-grup').forEach(d => { d.open = mqFoot.matches; }); }
mqFoot.addEventListener('change', sinkronFoot);
$$('.apf-grup > summary').forEach(s => s.addEventListener('click', e => { if (mqFoot.matches) e.preventDefault(); }));
sinkronFoot();

function perbaruiSemuaGeser() { updStrip(); updPill(); updKatalog(); updEsensial(); }
window.addEventListener('resize', () => requestAnimationFrame(perbaruiSemuaGeser));
window.addEventListener('load', perbaruiSemuaGeser);

/* Navigasi laptop di header + tombol mode gelap */
(function () {
  const nav = $('.hdr-nav');
  if (nav) nav.addEventListener('click', e => {
    const go = e.target.closest('[data-goto]');
    if (go) { e.preventDefault(); gulirKe(go.dataset.goto); }
  });
  const t = $('#btnTemaNav');
  if (t) t.addEventListener('click', () => setTema(saklar.getAttribute('aria-checked') !== 'true'));
})();

/* ---------- 6. Halaman Toko (#toko) ---------- */
const storePage = $('#storePage'), storeSelect = $('#storeKategori'), storeCari = $('#storeCari');
const state = { mode: 'all', key: null, q: '', semua: false };
let tokoDariDalam = false;

function sinkronToko() {
  const buka = location.hash === '#toko';
  if (storePage.hidden !== buka) return;
  storePage.hidden = !buka;
  $('#app').inert = buka;
  heroTahan(buka);
  if (buka) storePage.scrollTop = 0;
}
function bukaToko() {
  tokoDariDalam = true;
  if (location.hash !== '#toko') location.hash = '#toko'; else sinkronToko();
}
function tutupToko() {
  if (tokoDariDalam) { tokoDariDalam = false; history.back(); }
  else { history.replaceState(null, '', location.pathname + location.search); sinkronToko(); }
}
window.addEventListener('hashchange', sinkronToko);
$('#btnToko').addEventListener('click', bukaToko);
$('#storeBack').addEventListener('click', tutupToko);
$$('a[href="#toko"]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); bukaToko(); }));

storeSelect.innerHTML =
  '<option value="all">Semua laptop</option>' +
  '<optgroup label="Kategori">' + KATEGORI.map(k => `<option value="kategori:${k.id}">${esc(k.label)}</option>`).join('') + '</optgroup>' +
  '<optgroup label="Label">' + Object.entries(LABEL_TAG).map(([id, t]) => `<option value="tag:${id}">${esc(t)}</option>`).join('') + '</optgroup>';
storeSelect.addEventListener('change', () => {
  const v = storeSelect.value;
  if (v === 'all') { state.mode = 'all'; state.key = null; }
  else { const [m, k] = v.split(':'); state.mode = m; state.key = k; }
  state.semua = false; renderKatalog(); 
});
storeCari.addEventListener('input', () => { state.q = storeCari.value.trim(); state.semua = false; renderKatalog(); });

function daftarTerfilter() {
  let l = PRODUK;
  if (state.mode === 'kategori') l = l.filter(p => p.kategori === state.key);
  else if (state.mode === 'tag') l = l.filter(p => p.tags.includes(state.key));
  if (state.q) {
    const q = state.q.toLowerCase();
    l = l.filter(p => [namaLengkap(p), p.kategori, ...Object.values(p.spek || {})].join(' ').toLowerCase().includes(q));
  }
  return l;
}
function rincianSpek(p) {
  const sp = p.spek || {};
  return [['Processor', sp.processor], ['RAM', sp.ram], ['Storage', sp.storage], ['VGA', sp.vga], ['Layar', sp.layar], ['Kondisi', (KONDISI[p.kondisi] || KONDISI.bekas).label]]
    .filter(r => r[1]).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
}
function kartuProduk(p) {
  const sp = p.spek || {};
  const nama = namaLengkap(p);
  const lencana = p.tags.filter(t => LABEL_TAG[t]).map(t => `<span class="${t === 'promo' ? 'promo' : ''}">${esc(LABEL_TAG[t])}</span>`).join('');
  const ringkas = [sp.processor, sp.ram && `RAM ${sp.ram}`, sp.storage].filter(Boolean).map(esc).join(', ');
  const hemat = p.hargaNormal && p.hargaNormal > p.harga ? p.hargaNormal - p.harga : 0;
  return `
  <article class="kartu">
    <div class="kartu-foto">
      <img src="${esc(p.foto)}" alt="${esc(nama)}" loading="lazy" ${fotoErr}>
      ${lencana ? `<div class="lencana">${lencana}</div>` : ''}
      <button type="button" class="kartu-fav${adaFav(p.id) ? ' aktif' : ''}" data-fav="${esc(p.id)}" aria-pressed="${adaFav(p.id)}" aria-label="Simpan ${esc(nama)} ke favorit"><svg viewBox="0 0 24 24"><use href="#i-heart"/></svg></button>
    </div>
    <div class="kartu-isi">
      <h3>${esc(nama)}</h3>
      <p class="ringkas">${ringkas}</p>
      <details class="spec-box">
        <summary>Spesifikasi lengkap<svg viewBox="0 0 24 24"><use href="#i-chev-r"/></svg></summary>
        <dl>${rincianSpek(p) || '<p class="ringkas">Belum ada rincian.</p>'}</dl>
      </details>
      <p class="harga">${rupiah(p.harga)}${hemat ? `<s>${rupiah(p.hargaNormal)}</s>` : ''}</p>
      ${hemat ? `<p class="hemat">Hemat ${rupiah(hemat)}</p>` : ''}
      <div class="kartu-aksi">
        <button type="button" class="btn btn-kecil" data-tambah="${esc(p.id)}" aria-label="Tambah ${esc(nama)} ke keranjang">+ Keranjang</button>
        <button type="button" class="btn btn-kecil btn-garis" data-open="${esc(p.id)}">Pelajari</button>
        <button type="button" class="cmp-toggle${adaBanding(p.id) ? ' aktif' : ''}" data-cmp="${esc(p.id)}">${adaBanding(p.id) ? 'Batal bandingkan' : '+ Bandingkan'}</button>
      </div>
    </div>
  </article>`;
}
let sedangMemuat = true, gagalMemuat = false;
function renderKatalog() {
  const semua = daftarTerfilter();
  const tampil = state.semua ? semua : semua.slice(0, PAGE);
  $('#status').textContent = sedangMemuat ? 'Memuat katalog...'
    : gagalMemuat && !PRODUK.length ? 'Katalog belum bisa dimuat.'
    : semua.length ? `Menampilkan ${tampil.length} dari ${semua.length} laptop` : 'Belum ada laptop yang cocok';

  if (sedangMemuat) {
    $('#grid').innerHTML = Array.from({ length: 4 }, () => '<div class="skel"></div>').join('');
    $('#more').innerHTML = '';
  } else if (gagalMemuat && !PRODUK.length) {
    $('#grid').innerHTML = `<div class="kosong"><p><b>Data laptop belum bisa dimuat.</b></p><p>Periksa koneksi internet, lalu coba lagi.</p><button type="button" class="btn" id="ulangMuat">Muat ulang</button></div>`;
    $('#more').innerHTML = '';
  } else {
    $('#grid').innerHTML = tampil.length ? tampil.map(kartuProduk).join('')
      : `<div class="kosong"><p><b>Belum ada unit untuk pilihan ini.</b></p><p>Stok kami bergerak cepat. Tanyakan ketersediaannya lewat WhatsApp.</p><a class="btn" data-wa target="_blank" rel="noopener" href="${waLink(CONFIG.pesan_umum)}">Tanya via WhatsApp</a></div>`;
    /* Hanya SATU tombol "Lainnya": dibuat ulang tiap render, tidak pernah dobel */
    $('#more').innerHTML = (!state.semua && semua.length > PAGE) ? `<button type="button" id="moreBtn" class="btn btn-garis">Lainnya (${semua.length - PAGE} lagi)</button>` : '';
  }
}
$('#more').addEventListener('click', e => {
  if (!e.target.closest('#moreBtn')) return;
  state.semua = true; renderKatalog();
  const k = $('#grid').children[PAGE]; if (k) k.querySelector('button').focus();
});
$('#grid').addEventListener('click', e => {
  if (e.target.closest('#ulangMuat')) { muatSemua(); return; }
  const f = e.target.closest('[data-fav]'); if (f) { toggleFav(f.dataset.fav); return; }
  const c = e.target.closest('[data-cmp]'); if (c) { toggleBanding(c.dataset.cmp); return; }
  const t = e.target.closest('[data-tambah]'); if (t) { tambahKeranjang(t.dataset.tambah); return; }
  const o = e.target.closest('[data-open]'); if (o) bukaDetail(o.dataset.open);
});

/* ---------- 7. Keranjang (disimpan di perangkat; bila sudah login, juga di cloud Supabase) ---------- */
let KERANJANG = (() => { try { const k = JSON.parse(localStorage.getItem(KEY_KERANJANG) || '[]'); return Array.isArray(k) ? k.filter(x => x && x.id) : []; } catch (e) { return []; } })();
const keranjang = $('#keranjang');
const cariProduk = id => PRODUK.find(p => String(p.id) === String(id));
function simpanLokal() { try { localStorage.setItem(KEY_KERANJANG, JSON.stringify(KERANJANG)); } catch (e) {} }
function simpanKeranjang() { simpanLokal(); renderKeranjang(); jadwalSinkronKeranjang(); }
function tambahKeranjang(id) {
  id = String(id);
  const it = KERANJANG.find(x => x.id === id);
  if (it) { if (it.qty >= MAKS_QTY) { toast(`Maksimal ${MAKS_QTY} unit per produk`); return; } it.qty++; }
  else KERANJANG.push({ id, qty: 1 });
  simpanKeranjang();
  toast('Ditambahkan ke keranjang');
}
function bersihkanKeranjang() {
  if (!PRODUK.length) return;
  const sebelum = KERANJANG.length;
  KERANJANG = KERANJANG.filter(x => cariProduk(x.id));
  if (KERANJANG.length !== sebelum) simpanKeranjang(); else renderKeranjang();
}
function isiKeranjang() { return KERANJANG.map(x => ({ p: cariProduk(x.id), qty: x.qty })).filter(x => x.p); }
function pesanCheckout() {
  const l = isiKeranjang();
  const baris = l.map((x, i) => `${i + 1}. ${namaLengkap(x.p)}\n   ${x.qty} x ${rupiah(x.p.harga)} = ${rupiah(x.p.harga * x.qty)}`);
  const total = l.reduce((s, x) => s + x.p.harga * x.qty, 0);
  return `Halo Laptop Makassar, saya ingin memesan:\n\n${baris.join('\n')}\n\nTotal: ${rupiah(total)}\n\nMohon info ketersediaan unit dan cara pembayarannya. Terima kasih.`;
}
function renderKeranjang() {
  const l = isiKeranjang();
  const jumlah = l.reduce((s, x) => s + x.qty, 0);
  const total = l.reduce((s, x) => s + x.p.harga * x.qty, 0);
  $$('[data-badge]').forEach(b => { b.textContent = jumlah; b.hidden = !jumlah; });
  $('#cartbar').hidden = !jumlah;
  $('#cbJumlah').textContent = `${jumlah} item`;
  $('#cbTotal').textContent = rupiah(total);
  $('#krTotal').textContent = rupiah(total);
  $('#krFoot').hidden = !l.length;
  $('#btnCheckout').href = l.length ? waLink(pesanCheckout()) : '#';
  $('#krIsi').innerHTML = l.length ? l.map(({ p, qty }) => `
    <div class="kr-item">
      <div class="kr-foto"><img src="${esc(p.foto)}" alt="" ${fotoErr}></div>
      <div>
        <p class="kr-nama">${esc(namaLengkap(p))}</p>
        <p class="kr-harga">${rupiah(p.harga)}</p>
        <div class="kr-baris">
          <div class="qty">
            <button type="button" data-qty="${esc(p.id)}" data-d="-1" aria-label="Kurangi"><svg viewBox="0 0 24 24"><use href="#i-minus"/></svg></button>
            <span aria-live="polite">${qty}</span>
            <button type="button" data-qty="${esc(p.id)}" data-d="1" aria-label="Tambah"><svg viewBox="0 0 24 24"><use href="#i-plus"/></svg></button>
          </div>
          <span class="kr-sub">${rupiah(p.harga * qty)}</span>
        </div>
        <button type="button" class="kr-hapus" data-hapus="${esc(p.id)}"><svg viewBox="0 0 24 24"><use href="#i-trash"/></svg>Hapus</button>
      </div>
    </div>`).join('') : '<p class="kr-kosong">Keranjang masih kosong.</p>';
}
$('#krIsi').addEventListener('click', e => {
  const q = e.target.closest('[data-qty]'), h = e.target.closest('[data-hapus]');
  if (q) {
    const it = KERANJANG.find(x => x.id === String(q.dataset.qty)); if (!it) return;
    it.qty += +q.dataset.d;
    if (it.qty > MAKS_QTY) { it.qty = MAKS_QTY; toast(`Maksimal ${MAKS_QTY} unit per produk`); }
    if (it.qty < 1) KERANJANG = KERANJANG.filter(x => x !== it);
    simpanKeranjang();
  } else if (h) { KERANJANG = KERANJANG.filter(x => x.id !== String(h.dataset.hapus)); simpanKeranjang(); }
});
$('#cartbar').addEventListener('click', () => bukaDialog(keranjang));
$('#storeKeranjang').addEventListener('click', () => bukaDialog(keranjang));
$('#btnCheckout').addEventListener('click', e => { if (!isiKeranjang().length) e.preventDefault(); });

/* ---------- 8. Detail produk ---------- */
const detail = $('#detail');
let detailId = null;
/* Angka besar ala halaman spesifikasi MacBook: "16 GB DDR4" -> angka "16", satuan "GB DDR4". Teks tanpa angka di depan dilewati. */
function spekBesar(sp) {
  const butir = [['RAM', sp.ram], ['Storage', sp.storage], ['Layar', sp.layar]].map(([label, v]) => {
    const m = String(v || '').trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
    return m ? `<div class="stat"><p class="stat-label">${esc(label)}</p><p class="stat-angka">${esc(m[1])}${m[2] ? `<span>${esc(m[2])}</span>` : ''}</p></div>` : '';
  }).join('');
  return butir ? `<div class="spek-besar">${butir}</div>` : '';
}
function bukaDetail(id) {
  const p = cariProduk(id); if (!p) return;
  detailId = p.id;
  const k = KONDISI[p.kondisi] || KONDISI.bekas, sp = p.spek || {}, nama = namaLengkap(p);
  const baris = (n, v) => `<div><dt>${n}</dt><dd>${esc(v || '-')}</dd></div>`;
  const hemat = p.hargaNormal && p.hargaNormal > p.harga;
  $('#detailBody').innerHTML = `
  <div class="detail-grid detail">
    <div class="detail-foto"><img src="${esc(p.foto)}" alt="${esc(nama)}" ${fotoErr}></div>
    <div>
      <div class="tag-baris"><span class="tag tag-gelap">${esc(k.label)}</span>${p.tags.filter(t => LABEL_TAG[t]).map(t => `<span class="tag">${esc(LABEL_TAG[t])}</span>`).join('')}</div>
      <h3 class="detail-nama" style="margin-top:10px">${esc(nama)}</h3>
      <p class="detail-harga">${rupiah(p.harga)}${hemat ? `<s>${rupiah(p.hargaNormal)}</s>` : ''}</p>
      ${hemat ? `<p class="hemat">Hemat ${rupiah(p.hargaNormal - p.harga)}</p>` : ''}
      <div class="detail-aksi">
        <button type="button" class="btn btn-kecil btn-garis${adaFav(p.id) ? ' aktif' : ''}" data-fav="${esc(p.id)}" aria-pressed="${adaFav(p.id)}"><svg viewBox="0 0 24 24"><use href="#i-heart"/></svg>Favorit</button>
        <button type="button" class="btn btn-kecil btn-garis${adaBanding(p.id) ? ' aktif' : ''}" data-cmp="${esc(p.id)}">${adaBanding(p.id) ? 'Batal bandingkan' : '+ Bandingkan'}</button>
      </div>
      <p class="detail-slogan">Dicek menyeluruh. Bergaransi toko. Harga jujur.</p>
      <h3>Spesifikasi</h3>
      ${spekBesar(sp)}
      <dl>${baris('Merek', p.merek)}${baris('Seri', p.seri)}${baris('Processor', sp.processor)}${baris('RAM', sp.ram)}${baris('Storage', sp.storage)}${baris('Kartu grafis (VGA)', sp.vga)}${baris('Ukuran layar', sp.layar)}</dl>
      <h3>Kondisi unit</h3><p class="p">${esc(k.detail)}</p>
      <h3>Kelengkapan</h3><p class="p">${esc(k.kelengkapan)}</p>
      <h3>Garansi toko</h3><p class="p">${esc(k.garansi)}</p>
    </div>
  </div>`;
  $('#detailWa').href = waLink(`Halo kak, ${nama} masih ada?`);
  $('#detailBody').scrollTop = 0;
  bukaDialog(detail);
}
$('#detailTambah').addEventListener('click', () => { if (detailId !== null) { tambahKeranjang(detailId); detail.close(); } });
$('#detailBody').addEventListener('click', e => {
  const f = e.target.closest('[data-fav]'); if (f) { toggleFav(f.dataset.fav); return; }
  const c = e.target.closest('[data-cmp]'); if (c) toggleBanding(c.dataset.cmp);
});

/* ---------- 9. Pencarian AI (Gemini lewat Supabase Edge Function) ---------- */
const dialogCari = $('#cari'), cariInput = $('#cariInput'), cariHasil = $('#cariHasil');
function bukaCari() { bukaDialog(dialogCari); setTimeout(() => cariInput.focus(), 50); }
$('#btnCari').addEventListener('click', bukaCari);
$('#cariContoh').addEventListener('click', e => {
  const c = e.target.closest('.chip'); if (!c) return;
  cariInput.value = c.textContent; jalankanCari();
});
$('#cariKirim').addEventListener('click', jalankanCari);
cariInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); jalankanCari(); } });

const KATA_KUNCI = {
  gaming: ['gaming', 'rog', 'tuf', 'nitro', 'legion', 'rtx', 'gtx', 'geforce'],
  game: ['gaming', 'rog', 'tuf', 'nitro', 'legion', 'rtx', 'gtx', 'geforce'],
  edit: ['rtx', 'gtx', 'ryzen 7', 'i7', 'i5', '16 gb', '32 gb', 'macbook', 'm1', 'm2'],
  video: ['rtx', 'gtx', 'ryzen 7', 'i7', 'i5', '16 gb', '32 gb', 'macbook', 'm1', 'm2'],
  desain: ['rtx', 'gtx', 'ryzen 7', 'i7', '16 gb', 'macbook', 'm1', 'm2'],
  kantor: ['thinkpad', 'latitude', 'elitebook', 'probook', 'vivobook', 'i5'],
  kerja: ['thinkpad', 'latitude', 'elitebook', 'probook', 'vivobook', 'i5'],
  kuliah: ['celeron', 'vivobook', 'aspire', 'i3', 'i5'],
  sekolah: ['celeron', 'vivobook', 'aspire', 'i3'],
  murah: ['celeron', 'i3', 'aspire']
};
function cariLokal(q) {
  const t = q.toLowerCase();
  let maks = null;
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*(juta|jt|ribu|rb)/);
  if (m) { const n = parseFloat(m[1].replace(',', '.')); maks = /^j/.test(m[2]) ? n * 1e6 : n * 1e3; }
  const kata = t.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(k => k.length > 2);
  const istilah = new Set(); kata.forEach(k => { istilah.add(k); (KATA_KUNCI[k] || []).forEach(x => istilah.add(x)); });
  const hasil = PRODUK.filter(p => !maks || p.harga <= maks).map(p => {
    const jerami = [namaLengkap(p), p.kategori, ...Object.values(p.spek || {})].join(' ').toLowerCase();
    let skor = 0; istilah.forEach(k => { if (jerami.includes(k)) skor++; });
    return { p, skor };
  }).filter(x => x.skor > 0 || (maks && !istilah.size)).sort((a, b) => b.skor - a.skor || a.p.harga - b.p.harga).slice(0, 5);
  return {
    ringkasan: 'Hasil pencarian kata kunci (asisten AI sedang tidak tersedia).',
    hasil: hasil.map(x => ({ id: String(x.p.id), alasan: [x.p.spek?.processor, x.p.spek?.ram && `RAM ${x.p.spek.ram}`, x.p.spek?.storage].filter(Boolean).join(', ') }))
  };
}
/* [PATCH-CHATBOT] Chatbot percakapan (Gemini lewat Edge Function "cari-ai", mode riwayat) */
const chat = { riwayat: [], sibuk: false };   // riwayat: [{ role: 'user' | 'model', text }]
const CHAT_MAKS_RIWAYAT = 10;
function gulirChat() { const b = cariHasil.closest('.dlg-body'); if (b) b.scrollTop = b.scrollHeight; }
function gelembung(role, teks) {
  const d = document.createElement('div');
  d.className = 'gel ' + (role === 'user' ? 'gel-user' : 'gel-bot');
  d.textContent = teks;                       /* textContent: aman dari XSS */
  cariHasil.appendChild(d); gulirChat();
}
function kartuChat(daftar) {
  const l = (daftar || []).map(h => ({ p: cariProduk(h.id), alasan: h.alasan })).filter(x => x.p);
  if (!l.length) return;
  const w = document.createElement('div'); w.className = 'gel-kartu';
  w.innerHTML = l.map(({ p, alasan }) => `
    <div class="cari-kartu">
      <div class="kr-foto"><img src="${esc(p.foto)}" alt="" ${fotoErr}></div>
      <div>
        <p class="kr-nama">${esc(namaLengkap(p))}</p>
        <p class="kr-harga"><b>${rupiah(p.harga)}</b></p>
        <p class="cari-alasan">${esc(alasan)}</p>
        <div class="cari-aksi">
          <button type="button" class="btn btn-kecil btn-garis" data-open="${esc(p.id)}">Pelajari</button>
          <button type="button" class="btn btn-kecil" data-tambah="${esc(p.id)}">Tambah</button>
        </div>
      </div>
    </div>`).join('');
  cariHasil.appendChild(w); gulirChat();
}
async function jalankanCari() {
  const q = cariInput.value.trim();
  if (!q) { cariInput.focus(); return; }
  if (chat.sibuk) return;
  chat.sibuk = true; $('#cariKirim').disabled = true;
  cariInput.value = '';
  gelembung('user', q);
  const ketik = document.createElement('div');
  ketik.className = 'gel gel-bot gel-ketik'; ketik.innerHTML = '<span></span><span></span><span></span>';
  cariHasil.appendChild(ketik); gulirChat();
  try {
    await siapProduk;
    const kirim = chat.riwayat.concat({ role: 'user', text: q }).slice(-CHAT_MAKS_RIWAYAT);
    let data;
    try {
      /* "q" ikut dikirim agar Edge Function versi lama tetap bisa menjawab (mode pencarian) */
      const r = await sb.functions.invoke('cari-ai', { body: { q, riwayat: kirim } });
      if (r.error || !r.data || r.data.error) throw r.error || new Error(r.data?.error || 'kosong');
      data = r.data;
    } catch (e) {
      console.warn('Chatbot AI gagal, memakai pencarian lokal:', e);
      const lokal = cariLokal(q);
      data = {
        jawaban: lokal.hasil.length ? 'Asisten AI sedang sibuk kak. Ini hasil pencarian cepat dari stok kami:' : 'Maaf kak, asisten AI sedang tidak tersedia. Silakan tanya langsung lewat WhatsApp ya.',
        rekomendasi: lokal.hasil
      };
    }
    ketik.remove();
    const jawaban = String(data.jawaban || data.ringkasan || '').trim() || 'Maaf kak, saya belum bisa menjawab itu.';
    gelembung('model', jawaban);
    kartuChat(data.rekomendasi || data.hasil);
    chat.riwayat = chat.riwayat.concat({ role: 'user', text: q }, { role: 'model', text: jawaban }).slice(-CHAT_MAKS_RIWAYAT);
  } finally {
    if (ketik.parentNode) ketik.remove();
    chat.sibuk = false; $('#cariKirim').disabled = false; cariInput.focus();
  }
}
gelembung('model', 'Halo kak! Saya asisten Laptop Makassar. Boleh tanya soal rekomendasi laptop sesuai budget, gaming atau edit video, perbandingan spek, garansi, sampai jam buka toko. Mau cari laptop yang seperti apa?');

cariHasil.addEventListener('click', e => {
  const t = e.target.closest('[data-tambah]'); if (t) { tambahKeranjang(t.dataset.tambah); return; }
  const o = e.target.closest('[data-open]'); if (o) { dialogCari.close(); bukaDetail(o.dataset.open); }
});

/* ---------- 10. Data dari Supabase ---------- */
function dariDb(r) {
  let spek = r.spek;
  if (typeof spek === 'string') { try { spek = JSON.parse(spek); } catch { spek = {}; } }
  let tags = r.tags;
  if (typeof tags === 'string') { try { tags = JSON.parse(tags); } catch { tags = []; } }
  return {
    id: r.id, kategori: r.kategori, merek: r.merek || '', seri: r.seri || '',
    harga: Number(r.harga) || 0, hargaNormal: r.harganormal ? Number(r.harganormal) : null,
    tags: Array.isArray(tags) ? tags : [], kondisi: KONDISI[r.kondisi] ? r.kondisi : 'bekas',
    foto: r.foto || window.FOTO_KOSONG, spek: spek || {}
  };
}
async function muatProduk() {
  /* Produk terbaru selalu di depan. Jika kolom created_at belum ada, pakai id terbesar. */
  let r = await sb.from('produk').select('*').order('created_at', { ascending: false });
  if (r.error) r = await sb.from('produk').select('*').order('id', { ascending: false });
  if (r.error) throw r.error;
  PRODUK = (r.data || []).map(dariDb);
}
async function muatConfig() {
  const { data, error } = await sb.from('config').select('*').order('id', { ascending: true }).limit(1);
  if (error) throw error;
  const c = data && data[0]; if (!c) return;
  Object.keys(CONFIG_AWAL).forEach(k => { if (c[k] !== undefined && c[k] !== null && String(c[k]).trim() !== '') CONFIG[k] = c[k]; });
}
async function muatBanner() {
  const { data, error } = await sb.from('banner').select('*').order('urutan', { ascending: true });
  if (error) throw error;
  BANNER = data || [];
}
let terakhirMuat = 0, siapProduk = Promise.resolve();
async function muatSemua() {
  sedangMemuat = !PRODUK.length; gagalMemuat = false; renderKatalog();
  const pProduk = muatProduk();
  siapProduk = pProduk.catch(() => {});
  const hasil = await Promise.allSettled([pProduk, muatConfig(), muatBanner()]);
  hasil.forEach(h => { if (h.status === 'rejected') console.error('Gagal memuat dari Supabase:', h.reason); });
  gagalMemuat = hasil[0].status === 'rejected';
  sedangMemuat = false; terakhirMuat = Date.now();
  renderKatalog(); terapkanConfig(); renderHero(); renderSliderToko(); isiStatistik(); bersihkanKeranjang();
  tutupSplash();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - terakhirMuat > 20000) muatSemua();
});
let timerRealtime = null;
try {
  sb.channel('perubahan-toko')
    .on('postgres_changes', { event: '*', schema: 'public' }, p => {
      if (p && (p.table === 'cart_items' || p.table === 'wishlist')) return;   /* data akun: bukan data katalog */
      clearTimeout(timerRealtime); timerRealtime = setTimeout(muatSemua, 400);
    })
    .subscribe();
} catch (e) { console.warn('Realtime tidak aktif:', e); }

/* ---------- 10b. Angka statistik di seksi (diisi dari data nyata) ---------- */
function isiStatistik() {
  const set = (k, v) => $$(`[data-stat="${k}"]`).forEach(el => { el.textContent = v; });
  set('merek', $$('.merek-item').length || 11);
  set('kategori', KATEGORI.length);
  set('produk', PRODUK.length);
  $$('[data-stat="produk"]').forEach(el => { const st = el.closest('.stat'); if (st) st.hidden = !PRODUK.length; });
}

/* ---------- 10c. Layar muat: hilang setelah data pertama masuk (maks. 3 detik) ---------- */
const splash = $('#splash'), splashMulai = Date.now();
let splashTutup = false;
function tutupSplash() {
  if (splashTutup || !splash) return; splashTutup = true;
  const tunda = Math.max(0, 700 - (Date.now() - splashMulai));      /* tampil minimal 0,7 detik agar tidak berkedip */
  setTimeout(() => { splash.classList.add('selesai'); setTimeout(() => splash.remove(), 600); }, tunda);
}
setTimeout(tutupSplash, 3000);

/* ---------- 10d. Akun Google, keranjang cloud, favorit, bandingkan ---------- */
/* Satu login untuk semua. Admin atau bukan ditentukan database (LMAuth.cekAdmin -> is_admin()).
   Admin yang baru saja login otomatis diarahkan ke admin.html; user biasa tetap di katalog. */
let sinkronUser = null;                 /* id user yang keranjangnya sudah disinkronkan */
let snapCloud = new Map();              /* product_id -> qty di cloud (terakhir diketahui) */
let timerSinkron = null, terakhirTarik = 0;

const namaUser = u => String((u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || u.email || '').trim();
const fotoUser = u => (u.user_metadata && (u.user_metadata.avatar_url || u.user_metadata.picture)) || '';
const inisial = u => (namaUser(u).charAt(0) || '?').toUpperCase();
const avatarHtml = u => fotoUser(u)
  ? `<img src="${esc(fotoUser(u))}" alt="" referrerpolicy="no-referrer" data-i="${esc(inisial(u))}" onerror="this.parentNode.textContent=this.dataset.i">`
  : esc(inisial(u));

/* ----- tampilan akun ----- */
function renderAkun() {
  const b = $('#btnAkun'), av = $('.avatar', b), ik = $('svg', b);
  $('#authBtns').hidden = !!USER;            /* belum login: Sign up + Log in; sudah login: foto akun */
  $('#navAkun').hidden = !USER;              /* laptop: item "Akun" di katalog tengah */
  $('#sbAuth').hidden = !!USER;              /* menu HP: Sign up + Log in hanya saat belum login */
  b.hidden = !USER;
  if (USER) { av.innerHTML = avatarHtml(USER); av.hidden = false; ik.hidden = true; b.setAttribute('aria-label', 'Akun saya: ' + namaUser(USER)); }
  else { av.innerHTML = ''; av.hidden = true; ik.hidden = false; b.setAttribute('aria-label', 'Akun saya'); }
  isiAkunDialog(); renderBadgeAkun();
}
function renderBadgeAkun() {
  const set = (sel, n) => $$(sel).forEach(b => { b.textContent = n; b.hidden = !n; });
  set('[data-fav-badge]', USER ? FAV.length : 0);
  set('[data-cmp-badge]', USER ? CMP.length : 0);
}
function isiAkunDialog() {
  const el = $('#akunIsi');
  if (!USER) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="akun-kepala">
      <span class="avatar avatar-besar">${avatarHtml(USER)}</span>
      <div><p class="akun-nama">${esc(namaUser(USER))}</p><p class="akun-email">${esc(USER.email || '')}</p>${IS_ADMIN ? '<span class="tag tag-gelap">Admin</span>' : ''}</div>
    </div>
    <div class="akun-menu">
      ${IS_ADMIN ? '<a class="btn btn-blok" href="admin.html">Buka panel admin</a>' : ''}
      <button type="button" class="btn btn-garis btn-blok" data-akun="favorit">Favorit saya (${FAV.length})</button>
      <button type="button" class="btn btn-garis btn-blok" data-akun="banding">Bandingkan laptop (${CMP.length})</button>
      <button type="button" class="btn btn-garis btn-blok" data-akun="keluar">Keluar</button>
    </div>`;
}

/* ----- masuk / keluar -----
   Sign up  = popup pilih akun Google (One Tap); bila tidak muncul, lembar Log in terbuka.
   Log in   = lembar pilihan: Google, Facebook, Email di layar awal; sisanya di "Lanjutkan dengan cara lain". */
const MASUK = { lihat: 'awal', asal: 'awal', email: '', timerUlang: null };
const JUDUL_MASUK = { awal: 'Masuk atau daftar dalam hitungan detik', lain: 'Lanjutkan ke Laptop Makassar', email: 'Masuk dengan email', kode: 'Cek emailmu' };
const providerAktif = p => typeof LOGIN_PROVIDER === 'undefined' || LOGIN_PROVIDER[p] !== false;
const pesanMasuk = (teks, info) => { const e = $('#masukPesan'); e.textContent = teks || ''; e.hidden = !teks; e.classList.toggle('info', !!info); };

function tampilLihat(nama) {
  if (nama === 'email' || nama === 'lain') MASUK.asal = MASUK.lihat === 'lain' ? 'lain' : 'awal';
  if (nama === 'awal') MASUK.asal = 'awal';
  MASUK.lihat = nama;
  $$('[data-lihat]', $('#masuk')).forEach(sec => { sec.hidden = sec.dataset.lihat !== nama; });
  $('#masukJudul').textContent = JUDUL_MASUK[nama] || JUDUL_MASUK.awal;
  $('#masukKembali').hidden = nama === 'awal';
  pesanMasuk('');
  if (nama === 'email') setTimeout(() => $('#masukEmail').focus(), 60);
  if (nama === 'kode') setTimeout(() => $('#masukKode').focus(), 60);
}
function resetMasuk() {
  clearInterval(MASUK.timerUlang); MASUK.timerUlang = null;
  $('#masukEmail').value = ''; $('#masukKode').value = ''; MASUK.email = ''; $('#kodeUlang').textContent = 'Kirim ulang kode';
  $$('#masuk .sso, #masuk .btn, #masuk .sso-lain').forEach(b => { b.disabled = false; });
  tampilLihat('awal');
}
function bukaMasuk(lihat = 'awal') {
  $$('#masuk .sso[data-p]').forEach(b => { b.hidden = !providerAktif(b.dataset.p); });
  $('#masukLain').hidden = !['apple', 'microsoft', 'chatgpt'].some(providerAktif);   /* tidak ada pilihan tambahan -> sembunyikan */
  tampilLihat(lihat);
  bukaDialog($('#masuk'));
}
/* Sign up: popup Google. Bila Client ID kosong -> halaman Google; bila popup diblokir -> lembar Log in. */
async function mulaiLogin(pesan) {
  if (pesan) toast(pesan);
  LMAuth.tandai();
  if (!(await LMAuth.siapkan())) {
    if (typeof GOOGLE_CLIENT_ID === 'undefined' || !GOOGLE_CLIENT_ID) return LMAuth.masukOauth();   /* Client ID belum diisi: lewat halaman Google */
    return bukaMasuk();                                                                          /* skrip Google diblokir: lembar pilihan */
  }
  LMAuth.prompt(() => bukaMasuk());                                                              /* popup pilih akun; bila ditolak Google, buka lembar */
}
LMAuth.onGalat = e => {
  const m = 'Login belum berhasil: ' + ((e && e.message) || 'coba lagi');
  if ($('#masuk').open) pesanMasuk(m); else toast(m);
  $$('#masuk .sso, #masuk .btn').forEach(b => { b.disabled = false; });
};
$('#btnDaftar').addEventListener('click', () => mulaiLogin());
$('#btnMasuk').addEventListener('click', () => bukaMasuk());
$('#btnAkun').addEventListener('click', () => bukaDialog($('#akun')));
$('#navAkun').addEventListener('click', () => bukaDialog($('#akun')));
/* Tombol Sign up / Log in di dalam menu HP: tutup menu dulu, lalu jalankan alur yang sama dengan header */
$('#btnDaftarMenu').addEventListener('click', () => { tutupSidebar(false); mulaiLogin(); });
$('#btnMasukMenu').addEventListener('click', () => { tutupSidebar(false); bukaMasuk(); });

$('#masuk').addEventListener('close', resetMasuk);
$('#masukLain').addEventListener('click', () => tampilLihat('lain'));
$('#masukKembali').addEventListener('click', () => {
  if (MASUK.lihat === 'kode') tampilLihat('email');
  else if (MASUK.lihat === 'email') tampilLihat(MASUK.asal === 'lain' ? 'lain' : 'awal');
  else tampilLihat('awal');
});
$('#masuk').addEventListener('click', e => {
  const b = e.target.closest('.sso[data-p]'); if (!b) return;
  const p = b.dataset.p;
  if (p === 'email') return tampilLihat('email');
  pesanMasuk(''); b.disabled = true;
  LMAuth.masukProvider(p);                                                                       /* pindah ke halaman penyedia, lalu kembali ke sini */
  setTimeout(() => { b.disabled = false; }, 6000);
});

/* Email tanpa kata sandi: kirim kode, lalu verifikasi. */
const emailValid = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
function mulaiCooldownUlang(detik = 60) {
  const b = $('#kodeUlang'); clearInterval(MASUK.timerUlang);
  let sisa = detik; b.disabled = true; b.textContent = `Kirim ulang kode (${sisa})`;
  MASUK.timerUlang = setInterval(() => {
    sisa -= 1;
    if (sisa <= 0) { clearInterval(MASUK.timerUlang); MASUK.timerUlang = null; b.disabled = false; b.textContent = 'Kirim ulang kode'; }
    else b.textContent = `Kirim ulang kode (${sisa})`;
  }, 1000);
}
async function kirimKodeEmail(email, tombol) {
  tombol.disabled = true; pesanMasuk('Mengirim kode...', true);
  try { await LMAuth.kirimKode(email); }
  catch (e) { pesanMasuk(e.message || 'Kode belum terkirim, coba lagi.'); tombol.disabled = false; return false; }
  tombol.disabled = false; pesanMasuk('');
  return true;
}
$('#formEmail').addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('#masukEmail').value.trim().toLowerCase();
  if (!emailValid(email)) { pesanMasuk('Alamat email belum benar. Contoh: nama@email.com'); return; }
  if (!(await kirimKodeEmail(email, $('#btnKirimKode')))) return;
  MASUK.email = email; $('#kodeEmailTampil').textContent = email;
  tampilLihat('kode'); mulaiCooldownUlang();
});
$('#formKode').addEventListener('submit', async e => {
  e.preventDefault();
  const kode = $('#masukKode').value.replace(/\D/g, '');
  if (kode.length < 6) { pesanMasuk('Masukkan kode dari email (6 angka atau lebih).'); return; }
  const b = $('#btnVerifKode'); b.disabled = true; pesanMasuk('Memeriksa kode...', true);
  try { await LMAuth.verifikasiKode(MASUK.email, kode); pesanMasuk('Berhasil, sedang masuk...', true); }
  catch (err) { pesanMasuk(err.message || 'Kode belum benar.'); b.disabled = false; }
});
$('#kodeUlang').addEventListener('click', async () => {
  if (!MASUK.email) return;
  if (await kirimKodeEmail(MASUK.email, $('#kodeUlang'))) { pesanMasuk('Kode baru sudah dikirim.', true); mulaiCooldownUlang(); }
});
$('#kodeGanti').addEventListener('click', () => { clearInterval(MASUK.timerUlang); tampilLihat('email'); });
$('#akunIsi').addEventListener('click', async e => {
  const b = e.target.closest('[data-akun]'); if (!b) return;
  $('#akun').close();
  if (b.dataset.akun === 'favorit') bukaFavorit();
  else if (b.dataset.akun === 'banding') bukaBanding();
  else if (b.dataset.akun === 'keluar') { await LMAuth.keluar(); toast('Kamu sudah keluar'); }
});
const perluLogin = pesan => { if (pesan) toast(pesan); bukaMasuk(); };

/* ----- keranjang cloud ----- */
async function muatKeranjangCloud() {
  const { data, error } = await sb.from('cart_items').select('product_id, qty');
  if (error) throw error;
  return new Map((data || []).map(r => [Number(r.product_id), Number(r.qty)]));
}
const keranjangSebagaiMap = () => new Map(KERANJANG.map(x => [Number(x.id), x.qty]).filter(([id, q]) => Number.isInteger(id) && q > 0));
async function dorongKeranjang() {
  if (!USER) return;
  const kini = keranjangSebagaiMap(), ubah = [], hapus = [];
  kini.forEach((q, id) => { if (snapCloud.get(id) !== q) ubah.push({ user_id: USER.id, product_id: id, qty: q, updated_at: new Date().toISOString() }); });
  snapCloud.forEach((q, id) => { if (!kini.has(id)) hapus.push(id); });
  if (ubah.length) { const { error } = await sb.from('cart_items').upsert(ubah, { onConflict: 'user_id,product_id' }); if (error) throw error; }
  if (hapus.length) { const { error } = await sb.from('cart_items').delete().in('product_id', hapus); if (error) throw error; }
  snapCloud = kini;
}
function jadwalSinkronKeranjang() {
  if (!USER || sinkronUser !== USER.id) return;
  clearTimeout(timerSinkron);
  timerSinkron = setTimeout(() => {
    timerSinkron = null;
    dorongKeranjang().catch(e => console.warn('Keranjang cloud belum tersimpan:', e));
  }, 500);
}
/* Saat login: keranjang di perangkat DIGABUNG dengan keranjang cloud (jumlah per produk = yang terbesar). */
async function sinkronLogin() {
  const cloud = await muatKeranjangCloud();
  await siapProduk;                                                  /* agar produk yang sudah dihapus tidak ikut */
  const gabung = new Map(cloud);
  keranjangSebagaiMap().forEach((q, id) => {
    if (PRODUK.length && !cariProduk(id)) return;
    gabung.set(id, Math.min(MAKS_QTY, Math.max(q, gabung.get(id) || 0)));
  });
  KERANJANG = [...gabung].map(([id, qty]) => ({ id: String(id), qty }));
  snapCloud = cloud;
  simpanLokal(); renderKeranjang();
  await dorongKeranjang();
}
/* Di perangkat lain / saat tab kembali aktif: cloud adalah sumber kebenaran. */
async function tarikKeranjang() {
  if (!USER || sinkronUser !== USER.id || timerSinkron || Date.now() - terakhirTarik < 15000) return;
  terakhirTarik = Date.now();
  const cloud = await muatKeranjangCloud();
  if (timerSinkron) return;                                          /* ada perubahan lokal yang belum terkirim */
  snapCloud = cloud;
  KERANJANG = [...cloud].map(([id, qty]) => ({ id: String(id), qty }));
  simpanLokal(); bersihkanKeranjang();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tarikKeranjang().catch(() => {}); });

/* ----- favorit ----- */
async function muatFavorit() {
  const { data, error } = await sb.from('wishlist').select('product_id, created_at').order('created_at', { ascending: false });
  if (error) throw error;
  FAV = (data || []).map(r => String(r.product_id));
}
async function toggleFav(id) {
  if (!USER) { perluLogin('Masuk dulu untuk menyimpan favorit'); return; }
  id = String(id);
  const ada = FAV.includes(id), sebelum = FAV.slice();
  FAV = ada ? FAV.filter(x => x !== id) : [id, ...FAV];
  segarkanTanda();
  const q = ada
    ? sb.from('wishlist').delete().eq('product_id', Number(id))
    : sb.from('wishlist').upsert({ user_id: USER.id, product_id: Number(id) }, { onConflict: 'user_id,product_id', ignoreDuplicates: true });
  const { error } = await q;
  if (error) { console.warn('Favorit gagal disimpan:', error); FAV = sebelum; segarkanTanda(); toast('Favorit belum tersimpan, coba lagi'); }
  else toast(ada ? 'Dihapus dari favorit' : 'Ditambahkan ke favorit');
}
function renderFavorit() {
  const l = FAV.map(cariProduk).filter(Boolean);
  $('#favIsi').innerHTML = l.length ? l.map(p => `
    <div class="kr-item">
      <div class="kr-foto"><img src="${esc(p.foto)}" alt="" ${fotoErr}></div>
      <div>
        <p class="kr-nama">${esc(namaLengkap(p))}</p>
        <p class="kr-harga">${rupiah(p.harga)}</p>
        <div class="kr-baris">
          <button type="button" class="btn btn-kecil" data-tambah="${esc(p.id)}">+ Keranjang</button>
          <button type="button" class="btn btn-kecil btn-garis" data-open="${esc(p.id)}">Detail</button>
        </div>
        <button type="button" class="kr-hapus" data-fav="${esc(p.id)}"><svg viewBox="0 0 24 24"><use href="#i-trash"/></svg>Hapus dari favorit</button>
      </div>
    </div>`).join('') : '<p class="kr-kosong">Belum ada favorit. Ketuk ikon hati pada laptop incaranmu.</p>';
}
function bukaFavorit() { renderFavorit(); bukaDialog($('#favorit')); }
$('#favIsi').addEventListener('click', e => {
  const f = e.target.closest('[data-fav]'); if (f) { toggleFav(f.dataset.fav); return; }
  const t = e.target.closest('[data-tambah]'); if (t) { tambahKeranjang(t.dataset.tambah); return; }
  const o = e.target.closest('[data-open]'); if (o) { $('#favorit').close(); bukaDetail(o.dataset.open); }
});
$('#storeFavorit').addEventListener('click', () => { if (USER) bukaFavorit(); else perluLogin('Masuk dulu untuk melihat favorit'); });

/* ----- bandingkan 2 sampai 4 unit (disimpan di perangkat) ----- */
function simpanBanding() { try { localStorage.setItem(KEY_BANDING, JSON.stringify(CMP)); } catch (e) {} }
function toggleBanding(id) {
  if (!USER) { perluLogin('Masuk dulu untuk membandingkan laptop'); return; }
  id = String(id);
  if (CMP.includes(id)) CMP = CMP.filter(x => x !== id);
  else {
    if (CMP.length >= MAKS_BANDING) { toast(`Maksimal ${MAKS_BANDING} unit untuk dibandingkan`); return; }
    CMP = [...CMP, id];
    toast(CMP.length < 2 ? 'Pilih 1 unit lagi untuk membandingkan' : `${CMP.length} unit siap dibandingkan`);
  }
  simpanBanding(); segarkanTanda();
}
const BARIS_BANDING = [
  ['Harga', p => rupiah(p.harga)],
  ['Kondisi', p => (KONDISI[p.kondisi] || KONDISI.bekas).label],
  ['Processor', p => p.spek.processor],
  ['RAM', p => p.spek.ram],
  ['Storage', p => p.spek.storage],
  ['VGA', p => p.spek.vga],
  ['Layar', p => p.spek.layar],
  ['Garansi', p => (KONDISI[p.kondisi] || KONDISI.bekas).garansi]
];
function renderBanding() {
  const l = CMP.map(cariProduk).filter(Boolean);
  $('#bdgFoot').hidden = !l.length;
  if (!l.length) { $('#bdgIsi').innerHTML = '<p class="kr-kosong">Belum ada laptop yang dipilih. Ketuk "+ Bandingkan" pada 2 sampai 4 laptop.</p>'; return; }
  const termurah = Math.min(...l.map(p => p.harga));
  const hargaBeda = new Set(l.map(p => p.harga)).size > 1;
  const kepala = l.map(p => `<th scope="col"><div class="cmp-foto"><img src="${esc(p.foto)}" alt="" ${fotoErr}></div><p class="kr-nama">${esc(namaLengkap(p))}</p><button type="button" class="kr-hapus" data-cmp-hapus="${esc(p.id)}">Hapus</button></th>`).join('');
  const baris = BARIS_BANDING.map(([label, fn]) => {
    const v = l.map(p => fn(p) || '-');
    const beda = l.length > 1 && new Set(v.map(x => String(x).toLowerCase())).size > 1;
    return `<tr class="${beda ? 'beda' : ''}"><th scope="row">${label}</th>${v.map((x, i) => `<td class="${label === 'Harga' && hargaBeda && l[i].harga === termurah ? 'terbaik' : ''}">${esc(x)}${label === 'Harga' && hargaBeda && l[i].harga === termurah ? '<small>Termurah</small>' : ''}</td>`).join('')}</tr>`;
  }).join('');
  const aksi = l.map(p => `<td><button type="button" class="btn btn-kecil" data-tambah="${esc(p.id)}">+ Keranjang</button><button type="button" class="btn btn-kecil btn-garis" data-open="${esc(p.id)}">Detail</button></td>`).join('');
  $('#bdgIsi').innerHTML =
    (l.length < 2 ? '<p class="cmp-info">Pilih minimal 2 unit agar bisa dibandingkan berdampingan.</p>' : '<p class="cmp-info">Baris berlatar abu-abu = ada perbedaan antar unit.</p>') +
    `<div class="cmp-wrap"><table class="cmp"><thead><tr><th></th>${kepala}</tr></thead><tbody>${baris}<tr><th scope="row"></th>${aksi}</tr></tbody></table></div>`;
}
function bukaBanding() { renderBanding(); bukaDialog($('#bandingkan')); }
$('#bdgIsi').addEventListener('click', e => {
  const h = e.target.closest('[data-cmp-hapus]');
  if (h) { CMP = CMP.filter(x => x !== String(h.dataset.cmpHapus)); simpanBanding(); segarkanTanda(); return; }
  const t = e.target.closest('[data-tambah]'); if (t) { tambahKeranjang(t.dataset.tambah); return; }
  const o = e.target.closest('[data-open]'); if (o) { $('#bandingkan').close(); bukaDetail(o.dataset.open); }
});
$('#bdgKosongkan').addEventListener('click', () => { CMP = []; simpanBanding(); segarkanTanda(); });
$('#storeBandingkan').addEventListener('click', () => { if (USER) bukaBanding(); else perluLogin('Masuk dulu untuk membandingkan laptop'); });

/* Menyamakan semua tombol hati / bandingkan, lencana, dan dialog yang sedang terbuka */
function segarkanTanda() {
  $$('[data-fav]').forEach(b => { const a = adaFav(b.dataset.fav); b.classList.toggle('aktif', a); b.setAttribute('aria-pressed', String(a)); });
  $$('[data-cmp]').forEach(b => { const a = adaBanding(b.dataset.cmp); b.classList.toggle('aktif', a); b.textContent = a ? 'Batal bandingkan' : '+ Bandingkan'; });
  renderBadgeAkun(); isiAkunDialog();
  if ($('#favorit').open) renderFavorit();
  if ($('#bandingkan').open) renderBanding();
}

/* ----- sesi ----- */
async function terapkanSesi(evt, session) {
  const u = (session && session.user) || null;
  const idLama = USER ? USER.id : null;
  USER = u;
  if (!u) {
    IS_ADMIN = false; FAV = []; sinkronUser = null; clearTimeout(timerSinkron); timerSinkron = null;
    if (idLama && evt === 'SIGNED_OUT') { KERANJANG = []; simpanLokal(); CMP = []; simpanBanding(); renderKeranjang(); }   /* perangkat bersama: bersihkan data akun */
    renderAkun(); renderKatalog(); segarkanTanda();
    return;
  }
  renderAkun();
  if (sinkronUser === u.id) return;                                  /* event ulang (refresh token, dll.) */
  sinkronUser = u.id;
  const loginBaru = LMAuth.tandaAktif();
  if ($('#masuk').open) $('#masuk').close();

  IS_ADMIN = await LMAuth.cekAdmin();
  if (loginBaru) {
    LMAuth.hapusTanda();
    if (IS_ADMIN) { location.href = 'admin.html'; return; }          /* admin -> panel; user biasa tetap di katalog */
    toast('Halo, ' + (namaUser(u).split(' ')[0] || 'selamat datang') + '!');
  }
  await Promise.all([
    muatFavorit().catch(e => console.warn('Favorit belum bisa dimuat:', e)),
    sinkronLogin().catch(e => { console.warn('Keranjang cloud belum bisa disinkronkan:', e); sinkronUser = null; })
  ]);
  if (USER && USER.id === u.id) { renderAkun(); renderKatalog(); segarkanTanda(); }
}
sb.auth.onAuthStateChange((evt, session) => { setTimeout(() => terapkanSesi(evt, session), 0); });   /* jangan memanggil Supabase langsung di dalam callback ini */

/* ---------- 11. Mulai ---------- */
terapkanConfig();
renderHero();
renderSliderToko();
renderDaftarKategori();
perbaruiSemuaGeser();
isiStatistik();
renderKeranjang();
muatSemua();
sinkronToko();
