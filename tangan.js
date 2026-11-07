
(function () {
  'use strict';
  const strip = document.getElementById('apStrip');
  const bungkus = strip && strip.closest('.ap-strip-bungkus');
  if (!strip || !bungkus || !strip.animate) return;

  const root = document.documentElement;
  const kurangGerak = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const modeHP = () => root.getAttribute('data-device') === 'hp' || window.innerWidth < 900;
  const semuaItem = () => Array.from(strip.querySelectorAll('.ap-strip-item'));
  const berTag = () => semuaItem().filter(a => a.querySelector('.ap-baru'));
  if (!berTag().length) return;

  /* ---------- gambar tangan ---------- */
  const TX = 51, TY = 2;                          /* posisi ujung jari telunjuk di dalam gambar (px) */
  const hand = document.createElement('div');
  hand.className = 'tangan';
  hand.setAttribute('aria-hidden', 'true');
  hand.innerHTML = `
    <img src="images/tangan.png?v=20261106c" alt="" width="88" height="146" draggable="false">
    <span class="tangan-riak"></span>`;
  const klip = document.createElement('div');          /* "jendela" tangan: apa pun di luar area strip terpotong */
  klip.className = 'tangan-klip';
  klip.appendChild(hand);
  bungkus.appendChild(klip);
  if (!kurangGerak()) bungkus.classList.add('ap-ruang-tangan');   /* sediakan ruang kosong di bawah tulisan "Baru" */
  const riak = hand.querySelector('.tangan-riak');

  /* ---------- mesin gerak ---------- */
  const ABORT = 'batal';
  const EASE = 'cubic-bezier(.45,.05,.25,1)';
  const TF = p => `translate(${p.x}px,${p.y}px) rotate(${p.r}deg) scale(${p.s})`;
  const S0 = .6;          /* ukuran dasar tangan (lebih kecil) */
  const pos = { x: 0, y: 0, r: 0, s: S0, o: 0 };
  let token = 0;          /* naik setiap kali urutan lama harus dibatalkan */
  let cur = null;         /* animasi WAAPI yang sedang jalan */

  function terapkan() { hand.style.transform = TF(pos); hand.style.opacity = String(pos.o); }
  function hentikan() {   /* hentikan animasi berjalan, simpan posisi terakhir yang terlihat */
    if (!cur) return;
    try {
      const cs = getComputedStyle(hand);
      const m = new DOMMatrixReadOnly(cs.transform);
      pos.x = m.m41; pos.y = m.m42; pos.o = parseFloat(cs.opacity) || 0;
    } catch (e) { /* abaikan */ }
    const a = cur; cur = null; a.cancel(); terapkan();
  }
  function gerak(ke, dur, ease) {
    const t = token;
    return new Promise((res, rej) => {
      if (t !== token) return rej(ABORT);
      const dari = Object.assign({}, pos), tujuan = Object.assign({}, pos, ke);
      const a = hand.animate(
        [{ transform: TF(dari), opacity: dari.o }, { transform: TF(tujuan), opacity: tujuan.o }],
        { duration: dur, easing: ease || EASE, fill: 'both' });
      cur = a;
      a.onfinish = () => {
        if (t !== token) return rej(ABORT);
        Object.assign(pos, tujuan); terapkan(); cur = null; a.cancel(); res();
      };
      a.oncancel = () => rej(ABORT);
    });
  }
  function tunggu(ms) {
    const t = token;
    return new Promise((res, rej) => setTimeout(() => (t === token ? res() : rej(ABORT)), ms));
  }

  /* ---------- tag "Baru" ---------- */
  const tagDari = item => item.querySelector('.ap-baru');
  function sembunyikanTag(item) { const b = tagDari(item); if (b) { b.classList.remove('tulis'); b.classList.add('tunggu'); } }
  function tulisTag(item) {
    const b = tagDari(item); if (!b) return;
    b.classList.remove('tunggu', 'tulis'); void b.offsetWidth; b.classList.add('tulis');
  }
  function pulihkanSemua() { berTag().forEach(it => { const b = tagDari(it); b.classList.remove('tunggu'); }); }

  /* ---------- bantuan posisi ---------- */
  const bawah = () => bungkus.getBoundingClientRect().height + 6;   /* tangan bersembunyi tepat di bawah tepi klip */
  function ujungJari(item, fx, fy) {
    const img = item.querySelector('img') || item;
    const r = img.getBoundingClientRect(), b = bungkus.getBoundingClientRect();
    return { x: r.left - b.left + r.width * (fx ?? .5) - TX, y: r.top - b.top + r.height * (fy ?? .62) - TY };
  }
  function ujungTag(item) {                   /* ujung jari tepat di tulisan "Baru" (bukan di ikon laptop) */
    const t = tagDari(item) || item, r = t.getBoundingClientRect(), b = bungkus.getBoundingClientRect();
    return { x: r.left - b.left + r.width * .5 - TX, y: r.top - b.top + r.height * .62 - TY };
  }
  async function ketuk(item, saatTekan) {
    item.classList.add('tekan');
    riak.animate([{ opacity: .75, transform: 'scale(.25)' }, { opacity: 0, transform: 'scale(1.7)' }], { duration: 560, easing: 'ease-out' });
    try {
      await gerak({ s: S0 * .86 }, 110, 'ease-out');
      if (saatTekan) saatTekan();                 /* tulisan "Baru" langsung muncul saat jari menekan */
      await gerak({ s: S0 }, 170, 'ease-in-out');
    } finally { item.classList.remove('tekan'); }
  }
  async function bawaKeLayar(item) {          /* strip meluber: geser dulu sampai item terlihat */
    const s = strip.getBoundingClientRect(), r = item.getBoundingClientRect(), pad = 48;
    let d = 0;
    if (r.right > s.right - pad) d = r.right - (s.right - pad);
    else if (r.left < s.left + pad) d = r.left - (s.left + pad);
    if (Math.abs(d) < 2) return;
    const maks = strip.scrollWidth - strip.clientWidth;
    strip.scrollTo({ left: Math.max(0, Math.min(maks, strip.scrollLeft + d)), behavior: 'smooth' });
    await tunggu(520);
  }

  /* =================== LAPTOP: jalan tiap refresh =================== */
  let desktopSelesai = false;
  async function jalankanLaptop() {
    if (modeHP() || kurangGerak()) { pulihkanSemua(); return; }
    const t = ++token;
    const items = berTag();
    hand.classList.remove('ikut');
    items.forEach(sembunyikanTag);
    const awal = ujungTag(items[0]);        /* muncul dari bawah tulisan "Baru" (dari dalam kartu), bukan dari luar */
    Object.assign(pos, { x: awal.x, y: bawah(), r: 0, s: S0, o: 1 }); terapkan();
    try {
      await tunggu(300);
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await bawaKeLayar(it);
        const p = ujungTag(it);
        await gerak({ x: p.x, y: p.y, r: -4, s: S0, o: 1 }, i === 0 ? 800 : 620);
        await ketuk(it, () => tulisTag(it));
        await gerak({ x: p.x, y: bawah(), r: 0 }, 380, 'ease-in');   /* tangan turun lagi ke dalam */
      }
      await tunggu(300);
      desktopSelesai = true;
    } catch (e) { if (e !== ABORT) console.error(e); pulihkanSemua(); pos.o = 0; terapkan(); }
  }

  /* Mulai begitu strip terlihat (halaman bisa dibuka di posisi atas, strip ada di bawah hero) dan layar muat sudah hilang */
  function setelahSplash(fn) {
    let n = 0;
    const iv = setInterval(() => {
      if (!document.getElementById('splash') || n++ > 60) { clearInterval(iv); fn(); }
    }, 120);
  }
  if (!modeHP() && !kurangGerak()) {
    berTag().forEach(sembunyikanTag);           /* sembunyikan sejak awal agar tidak berkedip */
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => {
        if (es.some(e => e.isIntersecting)) { io.disconnect(); setelahSplash(jalankanLaptop); }
      }, { threshold: .7 });
      io.observe(bungkus);
    } else setelahSplash(jalankanLaptop);
  }
  window.addEventListener('resize', () => { if (modeHP() && !desktopSelesai && token === 0) pulihkanSemua(); });

  /* =================== HP: jalan saat digeser =================== */
  let hpSelesai = false;   /* HP: animasi hanya SATU KALI per muat halaman. Setelah selesai tidak pernah hidup lagi sampai di-refresh */
  let gestur = 0, menyentuh = false, mode = 'diam', timerAkhir = 0, kiriTerakhir = strip.scrollLeft;
  const cap = () => { gestur = Date.now(); };
  strip.addEventListener('touchstart', () => { menyentuh = true; cap(); }, { passive: true });
  strip.addEventListener('touchmove', cap, { passive: true });
  strip.addEventListener('touchend', () => { menyentuh = false; cap(); }, { passive: true });
  strip.addEventListener('touchcancel', () => { menyentuh = false; }, { passive: true });
  strip.addEventListener('wheel', e => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) cap(); }, { passive: true });

  const jepit = (v, a, b) => Math.max(a, Math.min(b, v));
  function itemTengah() {
    const s = strip.getBoundingClientRect(), c = (s.left + s.right) / 2;
    let terbaik = null, jarak = 1e9;
    semuaItem().forEach(it => { const r = it.getBoundingClientRect(), d = Math.abs((r.left + r.right) / 2 - c); if (d < jarak) { jarak = d; terbaik = it; } });
    return terbaik;
  }

  async function selesaiGeser() {
    if (menyentuh) { timerAkhir = setTimeout(selesaiGeser, 120); return; }   /* jari masih menempel: tunggu */
    mode = 'ketuk'; const t = ++token;
    hand.classList.remove('ikut');
    const s = strip.getBoundingClientRect();
    const terlihat = semuaItem().filter(a => { const r = a.getBoundingClientRect(), c = (r.left + r.right) / 2; return c > s.left + s.width * .14 && c < s.right - s.width * .14; });   /* hanya yang terlihat utuh */
    let target = terlihat.filter(a => tagDari(a)).slice(0, 1);   /* SATU target saja */
    target.forEach(sembunyikanTag);
    if (target.length) {                                          /* tangan muncul dekat target, bukan dari posisi jari */
      const a0 = ujungTag(target[0]);
      Object.assign(pos, { x: a0.x, y: bawah(), r: 0, s: S0, o: 1 }); terapkan();
    }
    let jatahTerpakai = target.length > 0;   /* item ke-3 belum terlihat: tangan pergi, animasi menunggu geseran berikutnya */
    try {
      for (let i = 0; i < target.length; i++) {
        const it = target[i], p = ujungTag(it);
        await gerak({ x: p.x, y: p.y, r: -4, s: S0, o: 1 }, 520);
        await ketuk(it, () => tulisTag(it));
        await gerak({ x: p.x, y: bawah(), r: 0 }, 340, 'ease-in');
      }
      await tunggu(200);
    } catch (e) { if (e !== ABORT) console.error(e); }
    finally {                       /* selesai (atau gagal): matikan animasi HP selamanya, tulisan "Baru" tetap tampil */
      hpSelesai = jatahTerpakai; mode = 'diam';
      clearTimeout(timerAkhir); hentikan(); pulihkanSemua();
      if (hpSelesai) hand.remove(); else { pos.o = 0; terapkan(); }
    }
  }

  strip.addEventListener('scroll', () => {
    const dx = strip.scrollLeft - kiriTerakhir; kiriTerakhir = strip.scrollLeft;
    if (hpSelesai || mode === 'ketuk') return;     /* sudah pernah / sedang mengetuk: geseran berikutnya tidak memicu apa pun */
    if (!dx || !modeHP() || kurangGerak()) return;
    if (Date.now() - gestur > 1800) return;      /* bukan geseran jari (mis. panah / posisi dipulihkan): abaikan */
    if (mode !== 'geser') {          /* saat digeser tangan TIDAK ikut jari: disembunyikan, muncul lagi di titik target setelah berhenti */
      token++; hentikan(); mode = 'geser';
      hand.classList.remove('ikut'); pos.o = 0; terapkan();
    }
    clearTimeout(timerAkhir); timerAkhir = setTimeout(selesaiGeser, 170);
  }, { passive: true });
})();
