/* =====================================================================
   NAVBAR LAPTOP GAYA apple.com - panel popup katalog
   Klik item katalog (tombol bertanda data-mega) -> panel turun dari bar.
   Tutup: klik item yang sama, klik area gelap, tombol Esc, gulir jauh, atau klik tautan di panel.
   Hanya aktif di layar laptop (>= 900px, bukan HP). HP memakai menu 2 garis seperti sebelumnya.
   ===================================================================== */
(function () {
  'use strict';
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => Array.from(r.querySelectorAll(s));

  const hdr = q('.hdr'), mega = q('#mega'), tirai = q('#megaTirai');
  if (!hdr || !mega || !tirai) return;

  const tombol = qa('[data-mega]');
  const panel = qa('.mega-panel', mega);
  const mq = window.matchMedia('(min-width:900px)');
  const lebar = () => mq.matches && document.documentElement.getAttribute('data-device') !== 'hp';
  const kurangGerak = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let aktif = null;     /* nama panel yang terbuka */
  let yBuka = 0;        /* posisi gulir saat dibuka */

  function buka(nama) {
    if (!lebar()) return;
    panel.forEach(p => { p.hidden = p.dataset.panel !== nama; });
    tombol.forEach(b => b.setAttribute('aria-expanded', String(b.dataset.mega === nama)));
    mega.style.maxHeight = mega.scrollHeight + 'px';      /* turun tepat setinggi isi panel */
    mega.classList.add('buka'); tirai.classList.add('buka'); hdr.classList.add('mega-buka');
    mega.setAttribute('aria-hidden', 'false'); tirai.setAttribute('aria-hidden', 'false');
    aktif = nama; yBuka = window.scrollY;
  }
  function tutup(kembaliFokus) {
    if (aktif === null) return;
    const b = tombol.find(x => x.dataset.mega === aktif);
    aktif = null;
    mega.classList.remove('buka'); tirai.classList.remove('buka'); hdr.classList.remove('mega-buka');
    mega.style.maxHeight = '';
    mega.setAttribute('aria-hidden', 'true'); tirai.setAttribute('aria-hidden', 'true');
    tombol.forEach(x => x.setAttribute('aria-expanded', 'false'));
    if (kembaliFokus && b) b.focus({ preventScroll: true });
  }

  tombol.forEach(b => b.addEventListener('click', e => {
    e.preventDefault();
    if (aktif === b.dataset.mega) tutup(false); else buka(b.dataset.mega);
  }));

  /* item katalog lain (Merek, Tema, Sign up, ...) dan ikon kanan: tutup panel dulu */
  hdr.addEventListener('click', e => {
    if (e.target.closest('[data-mega]')) return;
    if (e.target.closest('.hdr-nav .nav-i, .hdr-kanan .ikon, .brand')) tutup(false);
  });

  /* tautan di dalam panel: tutup panel; tautan gulir (data-goto) digulirkan di sini */
  mega.addEventListener('click', e => {
    const a = e.target.closest('a'); if (!a) return;
    const go = a.dataset.goto;
    tutup(false);
    if (go) {
      e.preventDefault();
      const el = q(go);
      if (el) el.scrollIntoView({ behavior: kurangGerak() ? 'auto' : 'smooth', block: 'start' });
    }
  });

  tirai.addEventListener('click', () => tutup(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && aktif !== null) tutup(true); });
  window.addEventListener('scroll', () => { if (aktif !== null && Math.abs(window.scrollY - yBuka) > 80) tutup(false); }, { passive: true });
  window.addEventListener('hashchange', () => tutup(false));
  const saatUkuranBerubah = () => { if (!lebar()) tutup(false); };
  if (mq.addEventListener) mq.addEventListener('change', saatUkuranBerubah); else mq.addListener(saatUkuranBerubah);
  window.addEventListener('resize', saatUkuranBerubah);
})();
