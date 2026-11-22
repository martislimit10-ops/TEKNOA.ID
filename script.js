const CONFIG = { ...CONFIG_AWAL };
let PRODUK = [];
let BANNER = [];
const DEVICE = window.LM_HP ? 'hp' : 'desktop';
const PAGE = 12;   /* jumlah produk per halaman; sisanya lewat tombol "Lainnya" */
const MAKS_QTY = 5;
const KEY_KERANJANG = 'lm_keranjang';
/* Akun user. Admin yang baru login diarahkan ke /admin/ (peran dari database); keamanan data tetap di RLS. */
let USER = null, IS_ADMIN = false, PERAN_PASTI = false;   /* PERAN_PASTI: peran (admin/user) sudah diketahui -> baru tampilkan fitur user */
const modeUser = () => !!USER && !IS_ADMIN && PERAN_PASTI;  /* fitur user (Akun saya, Permintaan) HANYA untuk user biasa, tidak untuk admin */
function bukaPanelAdmin() { location.assign((typeof SITUS_ADMIN === 'string' && SITUS_ADMIN) || 'admin/'); }
let MINTA = [];                                  /* permintaan ketersediaan milik user (tabel permintaan_stok) */
let NOTIF = [];                                  /* notifikasi milik user (tabel notifications), terbaru di depan */
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
function toast(teks, tipe) {            /* tipe: 'sukses' | 'galat' | 'info' (opsional) */
  const t = $('#toast');
  t.classList.remove('sukses', 'galat', 'info'); if (tipe) t.classList.add(tipe);
  t.textContent = teks; t.classList.add('tampil');
  clearTimeout(timerToast);
  timerToast = setTimeout(() => t.classList.remove('tampil'), tipe === 'galat' ? 4200 : 2600);
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

$('#tahun').textContent = new Date().getFullYear();

/* ---------- 2. Info toko ---------- */
function terapkanConfig() {
  $$('[data-fill]').forEach(el => { el.textContent = CONFIG[el.dataset.fill] ?? ''; });
  $$('[data-wa]').forEach(a => { a.href = waLink(CONFIG.pesan_umum); });
  $$('[data-ig]').forEach(a => { a.href = tautanSosmed(CONFIG.instagram, 'https://www.instagram.com/'); });
  $$('[data-tt]').forEach(a => { a.href = tautanSosmed(CONFIG.tiktok, 'https://www.tiktok.com/@'); });
  $$('[data-maps]').forEach(a => { a.href = CONFIG.maps_link; });
  $$('[data-mail]').forEach(a => { a.href = CONFIG.email ? 'mailto:' + CONFIG.email : '#'; a.hidden = !CONFIG.email; });
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
const hero = { slides: [], idx: 0, timer: null, ditahan: false, sig: '' };
const heroEl = $('#hero'), heroTrack = $('#heroTrack');

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
  hero.sig = sig; hero.slides = l; hero.idx = 0;
  clearTimeout(hero.timer);

  if (!l.length) {
    heroTrack.innerHTML = `<div class="hero-slide"><div class="hero-kosong"><b>Laptop Makassar</b><span>Laptop baru dan bekas berkualitas</span></div></div>`;
    $('#heroNav').hidden = true; $('#heroCap').textContent = '';
    return;
  }
  heroTrack.innerHTML = l.map((b, i) => `<div class="hero-slide" aria-hidden="${i !== 0}">` + (b.jenis === 'video'
    ? `<video src="${esc(b.url)}" muted playsinline webkit-playsinline disablepictureinpicture disableremoteplayback preload="${i === 0 ? 'auto' : 'metadata'}" ${l.length === 1 ? 'loop' : ''}></video>`
    : `<img src="${esc(b.url)}" alt="${esc(b.judul || 'Promo Laptop Makassar')}" ${i === 0 ? '' : 'loading="lazy"'} ${fotoErr}>`) + `</div>`).join('');
  $$('video', heroTrack).forEach((v, i) => {
    v.addEventListener('ended', () => { if (hero.slides.length > 1) heroKe(hero.idx + 1); });
    v.muted = true; v.defaultMuted = true;   /* video hero selalu tanpa suara (autoplay tidak diblokir browser) */
    v.addEventListener('error', () => videoRusak(v));
    /* codec tidak didukung (mis. HEVC/H.265, 10-bit): metadata terbaca tapi gambar tidak ada (lebar 0) -> layar hitam */
    const cek = () => { if (!v.videoWidth) videoRusak(v); };
    v.addEventListener('loadedmetadata', cek);
    v.addEventListener('loadeddata', cek);
  });
  $('#heroBars').innerHTML = l.map((_, i) => `<button type="button" aria-label="Slide ${i + 1}" data-i="${i}"></button>`).join('');
  $('#heroNav').hidden = l.length < 2;
  heroKe(0, true);
}
/* video yang tidak bisa ditampilkan: ganti dengan slide kosong bermerek (bukan layar hitam) dan lanjut ke slide berikutnya */
function videoRusak(v) {
  const slide = v.closest('.hero-slide'); if (!slide || slide.dataset.rusak) return;
  slide.dataset.rusak = '1';
  const aktif = heroTrack.children[hero.idx] === slide;
  slide.innerHTML = `<div class="hero-kosong"><b>Laptop Makassar</b><span>Laptop baru dan bekas berkualitas</span></div>`;
  if (aktif) jadwalkanHero(3000);
}
function slideAktif() { return hero.slides[hero.idx]; }
function videoAktif() { return heroTrack.children[hero.idx]?.querySelector('video') || null; }
function jadwalkanHero(ms) {
  clearTimeout(hero.timer);
  if (hero.slides.length < 2 || hero.ditahan) return;
  hero.timer = setTimeout(() => heroKe(hero.idx + 1), ms);
}
function heroKe(i, awal = false) {
  const n = hero.slides.length; if (!n) return;
  hero.idx = ((i % n) + n) % n;
  heroTrack.style.transform = `translateX(-${hero.idx * 100}%)`;
  $$('.hero-slide', heroTrack).forEach((s, k) => s.setAttribute('aria-hidden', String(k !== hero.idx)));
  $$('#heroBars button').forEach((b, k) => b.setAttribute('aria-current', String(k === hero.idx)));
  const s = slideAktif();
  $('#heroCap').textContent = s.judul || '';
  $$('video', heroTrack).forEach(v => { v.pause(); v.currentTime = 0; v.muted = true; });
  clearTimeout(hero.timer);
  if (s.jenis === 'video') {
    const v = videoAktif();
    if (v && v.closest('.hero-slide')?.dataset.rusak) jadwalkanHero(3000);
    else if (v && !hero.ditahan) v.play().catch(() => jadwalkanHero(6000));
  } else jadwalkanHero(5500);
}
function heroTahan(ya) {
  hero.ditahan = ya;
  const v = videoAktif();
  if (ya) { clearTimeout(hero.timer); if (v) v.pause(); }
  else if (slideAktif()) {
    if (v) v.play().catch(() => {});
    else if (slideAktif().jenis !== 'video') jadwalkanHero(5500);
  }
}
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
   Strip ikon (images/tekno/) dan seksi lain masih STATIS. Kartu "Jelajahi jajarannya" (produk unggulan) kini dari
   database (lihat 5c, tabel produk_unggulan, diatur di panel admin); kartu statis di index.html hanya cadangan.
   Tombol "Beli" membuka halaman Toko + keranjang, langsung terfilter ke kategori kartu. */

/* Pembantu carousel horizontal: tombol panah kiri/kanan di keyboard menggeser daftar satu kartu */
function pasangCarousel(list) {
  if (!list) return;
  const geser = arah => {
    const k = [...list.children].find(c => c.offsetParent !== null);
    const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
    const langkah = k ? k.getBoundingClientRect().width + gap : list.clientWidth * .8;
    list.scrollBy({ left: arah * langkah, behavior: kurangGerak() ? 'auto' : 'smooth' });
  };
  list.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); geser(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); geser(-1); }
  });
}
const katalogList = $('#katalogList');
pasangCarousel(katalogList);
pasangCarousel($('#esensialList'));

/* Strip ikon di bawah judul TEKNO: panah kanan muncul bila masih ada ikon di sebelah kanan */
const apStrip = $('#apStrip'), stripNext = $('#apStripNext');
function updStrip() {
  if (!apStrip) return;
  const luber = apStrip.scrollWidth > apStrip.clientWidth + 4;
  stripNext.hidden = !luber || apStrip.scrollLeft + apStrip.clientWidth >= apStrip.scrollWidth - 4;
}
if (apStrip) {
  apStrip.addEventListener('scroll', () => requestAnimationFrame(updStrip), { passive: true });
  stripNext.addEventListener('click', () => apStrip.scrollBy({ left: apStrip.clientWidth * .7, behavior: kurangGerak() ? 'auto' : 'smooth' }));
}


/* Popup "Selengkapnya": penjelasan produk, TIDAK ke toko/keranjang. Tombol "Beli" yang ke toko. */
const infoModal = $('#infoModal');
/* Data popup "Selengkapnya": diambil dari kartu produk unggulan (database), id kartu berbentuk "u<angka>" */
function dataInfo(id) {
  if (!/^u\d+$/.test(id)) return null;
  const r = (UNGGULAN || []).find(x => 'u' + x.id === id); if (!r) return null;
  return { foto: fotoUnggulan(r.foto_url), judul: r.judul, label: r.label || '', ringkas: r.penjelasan || r.deskripsi || '', poin: Array.isArray(r.poin) ? r.poin : [], kategori: r.kategori_toko || 'macbook' };
}
function bukaInfo(id, pemicu) {
  const p = dataInfo(id); if (!p || !infoModal) return;
  $('#infoFoto').src = p.foto;
  $('#infoFoto').alt = p.judul;
  $('#infoLabel').textContent = p.label || '';
  $('#infoJudul').textContent = p.judul;
  $('#infoRingkas').textContent = p.ringkas;
  $('#infoPoin').innerHTML = p.poin.map(x => '<li>' + esc(x) + '</li>').join('');
  $('#infoBeli').dataset.kategori = p.kategori;
  infoModal.dataset.pemicu = id;
  if (!infoModal.open) infoModal.showModal();
}

/* ---------- 5c. Produk unggulan ("Jelajahi jajarannya") dari database ----------
   Info (nama, deskripsi, label, grup, poin) ada di tabel produk_unggulan; foto di Supabase Storage (bucket media).
   Diatur admin lewat panel > Produk Unggulan; perubahan tampil otomatis (realtime).
   UNGGULAN === null  : tabel belum ada / gagal dimuat -> daftar dibiarkan kosong.
   UNGGULAN === []    : admin menyembunyikan semua kartu -> seksi disembunyikan. */
let UNGGULAN = null, sigUnggulan = '';
const fotoUnggulan = u => /^(https:\/\/|images\/)/.test(String(u || '')) ? u : window.FOTO_KOSONG;
function kartuUnggulan(r) {
  const nama = r.judul || '';
  return `<article class="k-kartu">
    <div class="k-foto"><img src="${esc(fotoUnggulan(r.foto_url))}" alt="${esc(nama)}" width="1200" height="800" loading="lazy" decoding="async" ${fotoErr}></div>
    <div class="k-isi">
      <p class="k-label"${r.label ? '' : ' aria-hidden="true"'}>${r.label ? esc(r.label) : '&nbsp;'}</p>
      <h3 class="k-judul">${esc(nama)}</h3>
      ${r.sub_judul ? `<p class="k-sub">${esc(r.sub_judul)}</p>` : ''}
      <p class="k-desk">${esc(r.deskripsi || '')}</p>
      <div class="k-aksi">
        <button type="button" class="k-btn" data-info="u${esc(r.id)}" aria-haspopup="dialog" aria-label="Selengkapnya: ${esc(nama)}">Selengkapnya</button>
        <a href="#" class="k-beli" data-ke-toko data-kategori="${esc(r.kategori_toko || 'macbook')}" aria-label="Beli ${esc(nama)}">Beli</a>
      </div>
    </div>
  </article>`;
}
function renderUnggulan() {
  if (!katalogList || UNGGULAN === null) return;
  const sig = JSON.stringify(UNGGULAN);
  if (sig === sigUnggulan) return;                     /* tidak ada perubahan: jangan render ulang (posisi geser tetap) */
  sigUnggulan = sig;
  const seksi = katalogList.closest('section'); if (seksi) seksi.hidden = !UNGGULAN.length;
  katalogList.innerHTML = UNGGULAN.map(kartuUnggulan).join('');
}
async function muatUnggulan() {
  const { data, error } = await sb.from('produk_unggulan').select('*').eq('aktif', true).order('urutan', { ascending: true }).order('id', { ascending: true });
  if (error) throw error;
  UNGGULAN = data || [];
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
  aturFilterDari(el.dataset.tag ? { tag: el.dataset.tag } : (k && k !== 'all' ? { kat: k } : {}));
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

function perbaruiSemuaGeser() { updStrip(); }
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
const storePage = $('#storePage');
/* Filter katalog dari tautan menu (data-ke-toko): kat = kategori, tag = label. semua = tampilkan seluruh produk */
const state = { kat: new Set(), tag: new Set(), semua: false };
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

function aturFilterDari({ kat, tag } = {}) {
  state.kat = new Set(kat ? [kat] : []); state.tag = new Set(tag ? [tag] : []);
  state.semua = false; renderKatalog();
}

function daftarTerfilter() {
  return PRODUK.filter(p => {
    if (state.kat.size && !state.kat.has(p.kategori)) return false;
    if (state.tag.size && !p.tags.some(t => state.tag.has(t))) return false;
    return true;
  });   /* urutan = dari database (created_at menurun) */
}
/* Indikator stok: hijau = tersedia, merah = habis (berlaku untuk semua laptop) */
const htmlStok = p => `<span class="stok-ind ${p.tersedia ? 'ada' : 'habis'}"><i aria-hidden="true"></i>${p.tersedia ? 'Stok tersedia' : 'Stok habis'}</span>`;
function kartuProduk(p) {
  const sp = p.spek || {};
  const nama = namaLengkap(p);
  const lencana = p.tags.filter(t => LABEL_TAG[t]).map(t => `<span class="${t === 'promo' ? 'promo' : ''}">${esc(LABEL_TAG[t])}</span>`).join('');
  const ringkas = [sp.processor, sp.ram && `RAM ${sp.ram}`, sp.storage].filter(Boolean).map(esc).join(', ');
  const hemat = p.hargaNormal && p.hargaNormal > p.harga ? p.hargaNormal - p.harga : 0;
  /* Baris tombol: stok ada = "+ Keranjang" | Lihat; stok habis = "Minta stok" | Lihat */
  const tombolUtama = p.tersedia
    ? `<button type="button" class="btn btn-kecil" data-tambah="${esc(p.id)}" aria-label="Tambah ${esc(nama)} ke keranjang">+ Keranjang</button>`
    : htmlMinta(p);
  return `
  <article class="kartu">
    <div class="kartu-foto" data-open="${esc(p.id)}">
      <img src="${esc(p.foto)}" alt="${esc(nama)}" loading="lazy" ${fotoErr}>
    </div>
    <div class="kartu-isi">
      ${lencana ? `<div class="lencana">${lencana}</div>` : ''}
      <h3 data-open="${esc(p.id)}">${esc(nama)}</h3>
      <p class="ringkas">${ringkas}</p>
      <p class="harga">${rupiah(p.harga)}${hemat ? `<s>${rupiah(p.hargaNormal)}</s>` : ''}</p>
      ${hemat ? `<p class="hemat">Hemat ${rupiah(hemat)}</p>` : '<p class="hemat" aria-hidden="true">&nbsp;</p>'}
      <p class="stok-baris">${htmlStok(p)}</p>
      <div class="kartu-aksi">
        ${tombolUtama}
        <button type="button" class="btn btn-kecil" data-open="${esc(p.id)}">Lihat</button>
      </div>
    </div>
  </article>`;
}
let sedangMemuat = true, gagalMemuat = false;
function renderKatalog() {
  const semua = daftarTerfilter();
  const tampil = state.semua ? semua : semua.slice(0, PAGE);

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
  const mt = e.target.closest('[data-minta]'); if (mt) { e.stopPropagation(); mintaStok(mt.dataset.minta); return; }
  const t = e.target.closest('[data-tambah]'); if (t) { tambahKeranjang(t.dataset.tambah); return; }
  const o = e.target.closest('[data-open]'); if (o) bukaDetail(o.dataset.open);
});

/* ---------- 7. Keranjang (disimpan di perangkat; bila sudah login, juga di cloud Supabase) ---------- */
let KERANJANG = (() => { try { const k = JSON.parse(localStorage.getItem(KEY_KERANJANG) || '[]'); return Array.isArray(k) ? k.filter(x => x && x.id) : []; } catch (e) { return []; } })();
const keranjang = $('#keranjang');
const cariProduk = id => PRODUK.find(p => String(p.id) === String(id));
function simpanLokal() { try { localStorage.setItem(KEY_KERANJANG, JSON.stringify(KERANJANG)); } catch (e) {} }
function simpanKeranjang() { simpanLokal(); renderKeranjang(); jadwalSinkronKeranjang(); }
/* Tombol hijau "Beli" di dalam jendela detail: chat WhatsApp toko untuk produk yang sedang dilihat */
function beliSekarang(id) {
  const p = cariProduk(id); if (!p) return;
  if (p.tersedia === false) { toast('Maaf, produk ini sedang tidak tersedia', 'info'); return; }
  const teks = `Halo Laptop Makassar, saya ingin membeli:\n\n${namaLengkap(p)}\nHarga: ${rupiah(p.harga)}\n\nMohon info ketersediaan unit dan cara pembayarannya. Terima kasih.`;
  window.open(waLink(teks), '_blank', 'noopener');
}
function tambahKeranjang(id) {
  id = String(id);
  const pr = cariProduk(id); if (pr && pr.tersedia === false) { toast('Maaf, produk ini sedang tidak tersedia', 'info'); return; }
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
const isiTersedia = () => isiKeranjang().filter(x => x.p.tersedia);   /* item stok habis tidak ikut checkout WhatsApp */
function pesanCheckout() {
  const l = isiTersedia();
  const baris = l.map((x, i) => `${i + 1}. ${namaLengkap(x.p)}\n   ${x.qty} x ${rupiah(x.p.harga)} = ${rupiah(x.p.harga * x.qty)}`);
  const total = l.reduce((s, x) => s + x.p.harga * x.qty, 0);
  return `Halo Laptop Makassar, saya ingin memesan:\n\n${baris.join('\n')}\n\nTotal: ${rupiah(total)}\n\nMohon info ketersediaan unit dan cara pembayarannya. Terima kasih.`;
}
function renderKeranjang() {
  const l = isiKeranjang(), ada = l.filter(x => x.p.tersedia);
  const jumlah = ada.reduce((s, x) => s + x.qty, 0);
  const total = ada.reduce((s, x) => s + x.p.harga * x.qty, 0);
  $$('[data-badge]').forEach(b => { b.textContent = jumlah; b.hidden = !jumlah; });
  $('#cartbar').hidden = !jumlah;
  $('#cbJumlah').textContent = `${jumlah} item`;
  $('#cbTotal').textContent = rupiah(total);
  $('#krTotal').textContent = rupiah(total);
  $('#krFoot').hidden = !l.length;
  const co = $('#btnCheckout');                         /* WhatsApp aktif hanya bila ada item yang stoknya tersedia */
  if (ada.length) { co.href = waLink(pesanCheckout()); co.removeAttribute('aria-disabled'); co.classList.remove('nonaktif'); }
  else { co.removeAttribute('href'); co.setAttribute('aria-disabled', 'true'); co.classList.add('nonaktif'); }
  $('#krIsi').innerHTML = l.length ? l.map(({ p, qty }) => `
    <div class="kr-item">
      <div class="kr-foto"><img src="${esc(p.foto)}" alt="" ${fotoErr}></div>
      <div>
        <p class="kr-nama">${esc(namaLengkap(p))}</p>
        <p class="kr-harga">${rupiah(p.harga)}</p>
        ${p.tersedia ? '' : `<p class="stok-baris">${htmlStok(p)}</p>`}
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
$('#btnCheckout').addEventListener('click', e => { if (!isiTersedia().length) e.preventDefault(); });

/* ---------- 8. Detail produk ---------- */
const detail = $('#detail');
let detailId = null, detailSig = '';
const sigDetail = p => JSON.stringify([p.tersedia, p.harga, p.hargaNormal, p.galeri, p.deskripsi, namaLengkap(p)]);
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
  detailId = p.id; detailSig = sigDetail(p);
  const k = KONDISI[p.kondisi] || KONDISI.bekas, sp = p.spek || {}, nama = namaLengkap(p);
  const baris = (n, v) => `<div><dt>${n}</dt><dd>${esc(v || '-')}</dd></div>`;
  const hemat = p.hargaNormal && p.hargaNormal > p.harga;
  $('#detailBody').innerHTML = `
  <div class="detail-grid detail">
    <div><div class="detail-foto"><img id="detailFotoUtama" src="${esc(p.galeri[0])}" alt="${esc(nama)}" ${fotoErr}></div>
      ${p.galeri.length > 1 ? `<div class="detail-thumbs" role="list">${p.galeri.map((u, i) => `<button type="button" role="listitem" class="detail-thumb${i === 0 ? ' aktif' : ''}" data-galeri="${esc(u)}" aria-label="Foto ${i + 1}"><img src="${esc(u)}" alt="" loading="lazy" ${fotoErr}></button>`).join('')}</div>` : ''}</div>
    <div>
      <div class="tag-baris"><span class="tag tag-gelap">${esc(k.label)}</span>${p.tags.filter(t => LABEL_TAG[t]).map(t => `<span class="tag">${esc(LABEL_TAG[t])}</span>`).join('')}</div>
      <h3 class="detail-nama" style="margin-top:10px">${esc(nama)}</h3>
      <p class="detail-harga">${rupiah(p.harga)}${hemat ? `<s>${rupiah(p.hargaNormal)}</s>` : ''}</p>
      ${hemat ? `<p class="hemat">Hemat ${rupiah(p.hargaNormal - p.harga)}</p>` : ''}
      <p class="stok-baris">${htmlStok(p)}</p>
      ${p.tersedia ? '' : `<div class="detail-aksi">${htmlMinta(p, true)}</div>`}
      <p class="detail-slogan">Dicek menyeluruh. Bergaransi toko. Harga jujur.</p>
      <h3>Spesifikasi</h3>
      ${spekBesar(sp)}
      <dl>${baris('Merek', p.merek)}${baris('Seri', p.seri)}${baris('Processor', sp.processor)}${baris('RAM', sp.ram)}${baris('Storage', sp.storage)}${baris('Kartu grafis (VGA)', sp.vga)}${baris('Ukuran layar', sp.layar)}</dl>
      ${p.deskripsi ? `<h3>Deskripsi</h3><p class="p" style="white-space:pre-line">${esc(p.deskripsi)}</p>` : ''}
      <h3>Kondisi unit</h3><p class="p">${esc(k.detail)}</p>
      <h3>Kelengkapan</h3><p class="p">${esc(k.kelengkapan)}</p>
      <h3>Garansi toko</h3><p class="p">${esc(k.garansi)}</p>
    </div>
  </div>`;
  /* WhatsApp: aktif bila stok ada; stok habis -> dinonaktifkan (tanpa tautan), pengguna memakai tombol Minta Stok */
  const wa = $('#detailWa');
  wa.textContent = 'WhatsApp';
  if (p.tersedia) { wa.href = waLink(`Halo kak, ${nama} masih ada?`); wa.removeAttribute('aria-disabled'); wa.removeAttribute('tabindex'); wa.classList.remove('nonaktif'); }
  else { wa.removeAttribute('href'); wa.setAttribute('aria-disabled', 'true'); wa.tabIndex = -1; wa.classList.add('nonaktif'); }
  $('#detailTambah').disabled = !p.tersedia;
  $('#detailBeli').disabled = !p.tersedia;
  $('#detailBody').scrollTop = 0;
  bukaDialog(detail);
}
$('#detailBeli').addEventListener('click', () => { if (detailId !== null) beliSekarang(detailId); });
$('#detailTambah').addEventListener('click', () => { if (detailId !== null) { tambahKeranjang(detailId); detail.close(); } });
$('#detailBody').addEventListener('click', e => {
  const g = e.target.closest('[data-galeri]');
  if (g) { $('#detailFotoUtama').src = g.dataset.galeri; $$('.detail-thumb', $('#detailBody')).forEach(t => t.classList.toggle('aktif', t === g)); return; }
  const mt = e.target.closest('[data-minta]'); if (mt) { e.stopPropagation(); mintaStok(mt.dataset.minta); return; }
});

/* ---------- 10. Data dari Supabase ---------- */
function dariDb(r) {
  let spek = r.spek;
  if (typeof spek === 'string') { try { spek = JSON.parse(spek); } catch { spek = {}; } }
  let tags = r.tags;
  if (typeof tags === 'string') { try { tags = JSON.parse(tags); } catch { tags = []; } }
  let tambahan = r.foto_tambahan;
  if (typeof tambahan === 'string') { try { tambahan = JSON.parse(tambahan); } catch { tambahan = []; } }
  const foto = r.foto || window.FOTO_KOSONG;
  const galeri = [foto, ...(Array.isArray(tambahan) ? tambahan.filter(u => typeof u === 'string' && /^https?:\/\//i.test(u)) : [])];
  return {
    id: r.id, kategori: r.kategori, deskripsi: String(r.deskripsi || '').trim(), tersedia: r.status !== 'tidak_tersedia', galeri, merek: r.merek || '', seri: r.seri || '',
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
  const hasil = await Promise.allSettled([pProduk, muatConfig(), muatBanner(), muatUnggulan()]);
  hasil.forEach(h => { if (h.status === 'rejected') console.error('Gagal memuat dari Supabase:', h.reason); });
  gagalMemuat = hasil[0].status === 'rejected';
  sedangMemuat = false; terakhirMuat = Date.now();
  renderKatalog(); terapkanConfig(); renderHero(); renderSliderToko(); renderUnggulan(); bersihkanKeranjang();
  const pd = detail.open && detailId !== null ? cariProduk(detailId) : null;
  if (pd && sigDetail(pd) !== detailSig) { const atas = $('#detailBody').scrollTop; bukaDetail(detailId); $('#detailBody').scrollTop = atas; }   /* stok/harga berubah saat detail terbuka */
  tutupSplash();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - terakhirMuat > 20000) muatSemua();
});
let timerRealtime = null;
try {
  sb.channel('perubahan-toko')
    .on('postgres_changes', { event: '*', schema: 'public' }, p => {
      if (p && (p.table === 'permintaan_stok' || p.table === 'notifications')) { jadwalMuatAkunMinta(); return; }   /* data akun: bukan data katalog */
      if (p && ['cart_items', 'profiles'].includes(p.table)) return;
      clearTimeout(timerRealtime); timerRealtime = setTimeout(muatSemua, 400);
    })
    .subscribe();
} catch (e) { console.warn('Realtime tidak aktif:', e); }

/* ---------- 10c. Layar muat: hilang setelah data pertama masuk (maks. 3 detik) ---------- */
const splash = $('#splash'), splashMulai = Date.now();
let splashTutup = false;
function tutupSplash() {
  if (splashTutup || !splash) return; splashTutup = true;
  const tunda = Math.max(0, 700 - (Date.now() - splashMulai));      /* tampil minimal 0,7 detik agar tidak berkedip */
  setTimeout(() => { splash.classList.add('selesai'); setTimeout(() => splash.remove(), 600); }, tunda);
}
setTimeout(tutupSplash, 3000);

/* ---------- 10d. Akun Google, keranjang cloud, permintaan stok ---------- */
/* Satu login untuk semua. Admin atau bukan ditentukan database (LMAuth.cekAdmin -> is_admin()).
   Admin yang baru saja login otomatis diarahkan ke /admin/; user biasa tetap di katalog. */
let sinkronUser = null;                 /* id user yang keranjangnya sudah disinkronkan */
let snapCloud = new Map();              /* product_id -> qty di cloud (terakhir diketahui) */
let timerSinkron = null, terakhirTarik = 0;

const namaUser = u => String((window.AkunUser && AkunUser.namaTampil()) || (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || u.email || '').trim();
const fotoUser = u => (window.AkunUser && AkunUser.fotoTampil()) || (u.user_metadata && (u.user_metadata.avatar_url || u.user_metadata.picture)) || '';
const inisial = u => (namaUser(u).charAt(0) || '?').toUpperCase();
const avatarHtml = u => fotoUser(u)
  ? `<img src="${esc(fotoUser(u))}" alt="" referrerpolicy="no-referrer" data-i="${esc(inisial(u))}" onerror="this.parentNode.textContent=this.dataset.i">`
  : esc(inisial(u));

/* ----- tampilan akun ----- */
function renderAkun() {
  const b = $('#btnAkun'), av = $('.avatar', b), ik = $('svg', b), nav = $('#navAkun');
  const adm = !!USER && IS_ADMIN;
  $('#authBtns').hidden = !!USER;            /* belum login: Sign up + Log in; sudah login: foto akun */
  nav.hidden = !USER || !PERAN_PASTI;        /* laptop: item "Akun" (admin: "Admin") di katalog tengah */
  nav.textContent = adm ? 'Admin' : 'Akun';
  $('#sbAuth').hidden = !!USER;              /* menu HP: Sign up + Log in hanya saat belum login */
  b.hidden = false;                          /* ikon orang selalu tampil: belum login = buka Log in */
  document.documentElement.dataset.masuk = USER ? '1' : '0';
  document.documentElement.dataset.peran = adm ? 'admin' : '';
  $('#navPermintaan').hidden = !modeUser(); $('#sbPermintaan').hidden = !modeUser();   /* teks "Permintaan" di navbar utama (antara Gelap dan Akun); hanya user login biasa */
  if (USER) { av.innerHTML = avatarHtml(USER); av.hidden = false; ik.toggleAttribute('hidden', true); b.setAttribute('aria-label', adm ? 'Panel admin' : 'Akun saya: ' + namaUser(USER)); }
  else { av.innerHTML = ''; av.hidden = true; ik.toggleAttribute('hidden', false); b.setAttribute('aria-label', 'Masuk'); }
  isiAkunDialog(); renderBadgeAkun();
}
function renderBadgeAkun() {
  const set = (sel, n) => $$(sel).forEach(b => { b.textContent = n; b.hidden = !n; });
  set('[data-minta-badge]', modeUser() ? belumDibacaJml() : 0);   /* angka = notifikasi yang belum dibaca */
}
function isiAkunDialog() {
  const el = $('#akunIsi');
  if (!modeUser()) { el.innerHTML = ''; return; }
  if (window.AkunUser) AkunUser.render();            /* area akun lengkap: akun.js */
  else el.innerHTML = '<div class="akun-menu"><button type="button" class="btn btn-garis btn-blok" data-akun="keluar">Logout</button></div>';
}

/* ----- masuk / keluar -----
   Sign up  = popup pilih akun Google (One Tap); bila tidak muncul, lembar Log in terbuka.
   Log in   = lembar pilihan: Google, Facebook, Email di layar awal; sisanya di "Lanjutkan dengan cara lain". */
const MASUK = { lihat: 'lain', asal: 'lain', email: '', timerUlang: null };
const JUDUL_MASUK = { awal: 'Masuk atau daftar dalam hitungan detik', lain: 'Log in', email: 'Masuk dengan email', kode: 'Cek emailmu' };
const providerAktif = p => typeof LOGIN_PROVIDER === 'undefined' || LOGIN_PROVIDER[p] !== false;
const pesanMasuk = (teks, info) => { const e = $('#masukPesan'); e.textContent = teks || ''; e.hidden = !teks; e.classList.toggle('info', !!info); };

function tampilLihat(nama) {
  if (nama === 'email' || nama === 'lain') MASUK.asal = MASUK.lihat === 'lain' ? 'lain' : 'awal';
  if (nama === 'awal') MASUK.asal = 'awal';
  MASUK.lihat = nama;
  $$('[data-lihat]', $('#masuk')).forEach(sec => { sec.hidden = sec.dataset.lihat !== nama; });
  $('#masukJudul').textContent = JUDUL_MASUK[nama] || JUDUL_MASUK.awal;
  $('#masukKembali').hidden = nama === 'awal' || nama === 'lain';
  pesanMasuk('');
  if (nama === 'email') setTimeout(() => $('#masukEmail').focus(), 60);
  if (nama === 'kode') setTimeout(() => $('#masukKode').focus(), 60);
}
function resetMasuk() {
  clearInterval(MASUK.timerUlang); MASUK.timerUlang = null;
  $('#masukEmail').value = ''; $('#masukKode').value = ''; MASUK.email = ''; $('#kodeUlang').textContent = 'Kirim ulang kode';
  $$('#masuk .sso, #masuk .btn, #masuk .sso-lain').forEach(b => { b.disabled = false; });
  tampilLihat('lain');
}
function bukaMasuk(lihat = 'lain') {
  $$('#masuk .sso[data-p]').forEach(b => { b.hidden = !providerAktif(b.dataset.p); });
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
  const m = (e && e.message) || 'Login belum berhasil. Coba lagi.';
  if ($('#masuk').open) pesanMasuk(m); else toast(m, 'galat');
  $$('#masuk .sso, #masuk .btn').forEach(b => { b.disabled = false; });
};
$('#btnDaftar').addEventListener('click', () => mulaiLogin());
$('#btnMasuk').addEventListener('click', () => bukaMasuk());
$('#btnAkun').addEventListener('click', () => { if (!USER) bukaMasuk(); else if (IS_ADMIN) bukaPanelAdmin(); else if (PERAN_PASTI) bukaDialog($('#akun')); });
$('#navAkun').addEventListener('click', () => { if (IS_ADMIN) bukaPanelAdmin(); else if (modeUser()) bukaDialog($('#akun')); });
/* Tombol Sign up / Log in di dalam menu HP: tutup menu dulu, lalu jalankan alur yang sama dengan header */
$('#btnDaftarMenu').addEventListener('click', () => { tutupSidebar(false); mulaiLogin(); });
$('#btnMasukMenu').addEventListener('click', () => { tutupSidebar(false); bukaMasuk(); });

$('#masuk').addEventListener('close', resetMasuk);
$('#masukKembali').addEventListener('click', () => {
  if (MASUK.lihat === 'kode') tampilLihat('email'); else tampilLihat('lain');
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
  if (b.dataset.akun === 'keluar') { await LMAuth.keluar(); toast('Kamu berhasil keluar', 'sukses'); }
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

/* ----- permintaan ketersediaan: tombol "Minta stok" HANYA tampil untuk laptop yang stoknya habis ----- */
const labelMinta = st => st === 'menunggu' ? 'Diminta, menunggu' : st === 'ditangani' ? 'Cek unit' : 'Minta stok';
const NAMA_STATUS_MINTA = { menunggu: 'Menunggu', ditangani: 'Cek unit', disetujui: 'Tersedia' };
const statusMinta = id => (MINTA.find(m => String(m.product_id) === String(id)) || {}).status || '';   /* MINTA urut terbaru dulu */
const waktuFmt = t => { try { return new Date(t).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
const belumDibacaJml = () => NOTIF.filter(n => !n.dibaca).length;
function htmlMinta(p, detail) {
  if (p.tersedia) return '';                   /* stok ada: tidak ada tombol Minta stok (WhatsApp yang aktif) */
  if (USER && !modeUser()) return '';          /* admin tidak melihat tombol ini */
  const st = statusMinta(p.id), nama = namaLengkap(p);
  const kelas = st === 'menunggu' || st === 'ditangani' ? ' ' + st : '';
  return `<button type="button" class="btn btn-kecil${detail ? ' btn-garis' : ''} minta${kelas}" data-minta="${esc(p.id)}" aria-label="Minta ketersediaan ${esc(nama)}"><svg viewBox="0 0 24 24"><use href="#i-plus"/></svg><span>${labelMinta(st)}</span></button>`;
}
async function muatMinta() {
  const { data, error } = await sb.from('permintaan_stok').select('id,product_id,nama_produk,status,created_at,handled_at').order('created_at', { ascending: false });
  if (error) { console.warn('Permintaan belum bisa dimuat:', error); MINTA = []; return; }
  MINTA = data || [];
}
async function muatNotif() {
  const { data, error } = await sb.from('notifications').select('id,judul,isi,dibaca,created_at').order('created_at', { ascending: false }).limit(30);
  if (error) { console.warn('Notifikasi belum bisa dimuat (jalankan sql/05-perbaikan-katalog-permintaan.sql):', error.message || error); NOTIF = []; return; }
  NOTIF = data || [];
}
async function mintaStok(id) {
  if (!USER) { perluLogin('Masuk dulu untuk meminta ketersediaan laptop'); return; }
  if (!modeUser()) return;
  const p = cariProduk(id);
  if (p && p.tersedia) { toast('Stok laptop ini sudah tersedia. Hubungi toko lewat WhatsApp.', 'info'); return; }
  const st = statusMinta(id);
  if (st === 'menunggu') { toast('Permintaanmu sudah terkirim. Mohon tunggu kabar dari kami.'); return; }
  if (st === 'ditangani') { toast('Permintaanmu sedang ditangani oleh toko.'); return; }
  const { error } = await sb.from('permintaan_stok').insert({ product_id: Number(id) });
  if (error && error.code !== '23505') { console.warn('Permintaan gagal:', error); toast('Permintaan belum terkirim, coba lagi', 'galat'); return; }
  toast('Permintaan terkirim. Pantau statusnya di menu Permintaan.', 'sukses');
  await muatMinta(); segarkanTanda();
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-minta-batal]'); if (!b) return;
  const { error } = await sb.from('permintaan_stok').delete().eq('id', Number(b.dataset.mintaBatal));
  if (error) { toast('Belum bisa dibatalkan, coba lagi', 'galat'); return; }
  toast('Permintaan dibatalkan'); await muatMinta(); segarkanTanda();
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && USER && modeUser()) Promise.all([muatMinta(), muatNotif()]).then(segarkanTanda).catch(() => {}); });

/* Halaman "Permintaan" milik user dibagi 3 tab (kiri ke kanan): Notifikasi | Tersedia | Cek unit.
   Cek unit = status menunggu + ditangani, Tersedia = disetujui, Notifikasi = pemberitahuan (angka = yang belum dibaca). */
let mintaTab = 'cek';
function renderPermintaan() {
  const nb = belumDibacaJml();
  const cek = MINTA.filter(m => m.status !== 'disetujui'), ada = MINTA.filter(m => m.status === 'disetujui');
  const tab = [['notif', 'Notifikasi', nb], ['tersedia', 'Tersedia', ada.length], ['cek', 'Cek unit', cek.length]];
  $('#mintaTab').innerHTML = tab.map(([k, nama, n]) =>
    `<button type="button" role="tab" id="mintaTab-${k}" data-minta-tab="${k}" aria-selected="${mintaTab === k}">${nama}${n ? `<span class="minta-tab-n">${n}</span>` : ''}</button>`).join('');
  const baris = m => `<div class="minta-baris"><div><b>${esc(m.nama_produk || 'Laptop')}</b><span class="muted">Diminta ${esc(waktuFmt(m.created_at))}</span></div><span class="minta-st ${esc(m.status)}">${esc(NAMA_STATUS_MINTA[m.status] || m.status)}</span>${m.status === 'menunggu' ? `<button type="button" class="btn btn-kecil btn-garis" data-minta-batal="${esc(m.id)}">Batalkan</button>` : ''}</div>`;
  let isi;
  if (mintaTab === 'notif') {
    isi = NOTIF.length
      ? (nb ? '<button type="button" class="btn btn-garis btn-blok" data-notif-baca>Tandai semua dibaca</button>' : '') +
        NOTIF.map(n => `<div class="notif-baris${n.dibaca ? '' : ' baru'}"><b>${n.dibaca ? '' : '&bull; '}${esc(n.judul)}</b>${n.isi ? `<span class="muted">${esc(n.isi)}</span>` : ''}<span class="muted">${esc(waktuFmt(n.created_at))}</span></div>`).join('')
      : '<p class="kr-kosong">Belum ada notifikasi.</p>';
  } else if (mintaTab === 'tersedia') {
    isi = ada.length ? ada.map(baris).join('') : '<p class="kr-kosong">Belum ada unit yang tersedia untukmu.</p>';
  } else {
    isi = cek.length ? cek.map(baris).join('') : '<p class="kr-kosong">Belum ada permintaan. Pada laptop yang stoknya habis, ketuk tombol Minta stok.</p>';
  }
  $('#mintaIsi').setAttribute('aria-labelledby', 'mintaTab-' + mintaTab);
  $('#mintaIsi').innerHTML = isi;
}
function bukaPermintaan() {
  mintaTab = 'cek';
  renderPermintaan(); bukaDialog($('#permintaan'));
  Promise.all([muatMinta(), muatNotif()]).then(() => { if ($('#permintaan').open) renderPermintaan(); renderBadgeAkun(); }).catch(() => {});
}
async function tandaiNotifDibaca() {
  if (!USER || !belumDibacaJml()) return;
  const sebelum = NOTIF.map(n => ({ ...n }));
  NOTIF.forEach(n => { n.dibaca = true; }); renderBadgeAkun();
  const { error } = await sb.from('notifications').update({ dibaca: true }).eq('user_id', USER.id).eq('dibaca', false);
  if (error) { console.warn('Notifikasi belum ditandai dibaca:', error); NOTIF = sebelum; renderBadgeAkun(); if ($('#permintaan').open) renderPermintaan(); toast('Belum berhasil, coba lagi', 'galat'); }
  else if ($('#permintaan').open) renderPermintaan();
}
const klikPermintaan = () => { if (modeUser()) bukaPermintaan(); else if (!USER) perluLogin('Masuk dulu untuk melihat permintaan'); };
$('#navPermintaan').addEventListener('click', klikPermintaan);
$('#sbPermintaanBtn').addEventListener('click', () => { tutupSidebar(false); klikPermintaan(); });
$('#mintaIsi').addEventListener('click', e => { if (e.target.closest('[data-notif-baca]')) tandaiNotifDibaca(); });
$('#mintaTab').addEventListener('click', e => {
  const b = e.target.closest('[data-minta-tab]'); if (!b) return;
  mintaTab = b.dataset.mintaTab; renderPermintaan(); $('#mintaIsi').scrollTop = 0;
});
$('#permintaan').addEventListener('close', () => { tandaiNotifDibaca(); });
/* Perubahan status permintaan / notifikasi baru dari server (realtime): muat ulang data milik user saja */
let timerAkunMinta = null;
function jadwalMuatAkunMinta() {
  if (!USER || !modeUser()) return;
  clearTimeout(timerAkunMinta);
  timerAkunMinta = setTimeout(() => { Promise.all([muatMinta(), muatNotif()]).then(() => { if (USER && modeUser()) segarkanTanda(); }).catch(() => {}); }, 300);
}

/* Menyamakan semua tombol minta stok, lencana, dan dialog yang sedang terbuka */
function segarkanTanda() {
  $$('[data-minta]').forEach(b => { const st = statusMinta(b.dataset.minta); b.classList.remove('menunggu', 'ditangani'); if (st === 'menunggu' || st === 'ditangani') b.classList.add(st); const sp = $('span', b); if (sp) sp.textContent = labelMinta(st); });
  renderBadgeAkun(); isiAkunDialog();
  if ($('#permintaan').open) renderPermintaan();
}

/* ----- sesi ----- */
async function terapkanSesi(evt, session) {
  const u = (session && session.user) || null;
  const idLama = USER ? USER.id : null;
  USER = u;
  if (!u) {
    IS_ADMIN = false; PERAN_PASTI = false; MINTA = []; NOTIF = []; sinkronUser = null; clearTimeout(timerSinkron); timerSinkron = null;
    if (idLama && evt === 'SIGNED_OUT') {
      const sengaja = LMAuth.keluarSengaja; LMAuth.keluarSengaja = false;
      if (!sengaja) toast('Sesi kamu berakhir. Silakan masuk lagi.', 'info');   /* bukan tombol Keluar -> sesi habis / keluar dari tab lain */
      KERANJANG = []; simpanLokal(); renderKeranjang();
      if (window.AkunUser) AkunUser.bersih();
    }   /* perangkat bersama: bersihkan data akun */
    renderAkun(); renderKatalog(); segarkanTanda();
    return;
  }
  /* Peran terakhir yang diketahui (cache, hanya untuk TAMPILAN agar tidak sempat tampil sebagai user lalu berganti).
     Penentu sebenarnya tetap database (get_my_role / is_admin) dan RLS. */
  if (idLama !== u.id) {
    let p = null; try { p = localStorage.getItem('lm_peran_' + u.id); } catch (e) {}
    IS_ADMIN = p === 'admin'; PERAN_PASTI = p === 'admin' || p === 'user';
  }
  renderAkun();
  if (sinkronUser === u.id) return;                                  /* event ulang (refresh token, dll.) */
  sinkronUser = u.id;
  const loginBaru = LMAuth.tandaAktif();
  if ($('#masuk').open) $('#masuk').close();
  if (loginBaru) LMAuth.hapusTanda();
  await tetapkanPeran(u, loginBaru, 0);
}

/* Tentukan peran dari database SETIAP kali sesi dibuka (bukan hanya saat login baru).
   ADMIN  : bukan akun user. Tidak memuat permintaan/notifikasi user, teks "Log in" jadi "Admin"
            yang membuka panel admin saat diklik. Admin TIDAK dilempar otomatis ke panel (baru login atau kembali dari panel),
            jadi bisa bolak-balik website <-> panel dengan klik "Admin" / "Lihat website".
   LAINNYA: user biasa -> fitur user (permintaan stok, notifikasi). */
async function tetapkanPeran(u, loginBaru, percobaan) {
  const admin = await LMAuth.cekAdmin();                             /* true / false / null (gagal diperiksa) */
  if (!USER || USER.id !== u.id) return;                             /* user berganti/keluar saat memeriksa */
  if (admin !== null) {
    IS_ADMIN = admin === true; PERAN_PASTI = true;
    try { localStorage.setItem('lm_peran_' + u.id, IS_ADMIN ? 'admin' : 'user'); } catch (e) {}
  }
  if (IS_ADMIN) {
    renderAkun(); renderKatalog(); segarkanTanda();
    /* Admin yang baru login TIDAK dilempar ke panel: tetap di tampilan awal, tulisan "Log in" berubah jadi "Admin".
       Panel dibuka hanya saat "Admin" diklik. */
    if (loginBaru) toast('Masuk sebagai admin. Klik "Admin" untuk membuka panel.', 'sukses');
    return;
  }
  if (admin === null && percobaan < 2) {                             /* gagal periksa (jaringan): jangan dulu dianggap user, coba lagi */
    setTimeout(() => { if (USER && USER.id === u.id) tetapkanPeran(u, loginBaru, percobaan + 1); }, 4000);
    return;
  }
  PERAN_PASTI = true;
  if (loginBaru && admin === false) toast('Berhasil masuk. Halo, ' + (namaUser(u).split(' ')[0] || 'selamat datang') + '!', 'sukses');
  await Promise.all([
    muatMinta().catch(e => console.warn('Permintaan belum bisa dimuat:', e)),
    muatNotif().catch(e => console.warn('Notifikasi belum bisa dimuat:', e)),
    window.AkunUser ? AkunUser.muat().catch(e => console.warn('Data akun belum bisa dimuat:', e)) : null,
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
renderKeranjang();
muatSemua();
sinkronToko();
