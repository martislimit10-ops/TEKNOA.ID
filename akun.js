(function () {
  'use strict';
  /* Akun pengguna (disederhanakan): hanya foto, nama, email, dan tombol Logout (data profil dibaca dari tabel profiles bila ada).
     Permintaan, riwayat, banding, dan notifikasi TIDAK lagi ada di dalam akun:
     permintaan + notifikasi ada di halaman "Permintaan" (script.js, tombol di navbar utama). */
  const S = { profil: null, lokal: false, terakhir: 0 };
  const api = { S };

  /* ---------- penyimpanan lokal (cadangan bila tabel profiles belum ada di database) ---------- */
  const kunciLs = k => 'lm_akun_' + (USER ? USER.id : 'x') + '_' + k;
  const bacaLs = (k, d) => { try { const v = JSON.parse(localStorage.getItem(kunciLs(k))); return v == null ? d : v; } catch (e) { return d; } };

  api.namaTampil = () => (S.profil && S.profil.display_name) || '';
  api.fotoTampil = () => (S.profil && S.profil.avatar_url) || '';
  api.bersih = () => { Object.assign(S, { profil: null, lokal: false, terakhir: 0 }); };

  /* ---------- data ---------- */
  api.muat = async () => {
    if (!USER || IS_ADMIN) return;                              /* admin bukan akun user */
    const uid = USER.id;
    let hasil = null;
    try {
      hasil = await sb.from('profiles').select('display_name,avatar_url').eq('user_id', uid).maybeSingle();
    } catch (err) { console.warn('Profil: tidak bisa terhubung, memakai penyimpanan lokal.', err); }
    if (!USER || USER.id !== uid) return;                       /* user berganti/keluar saat memuat */
    S.terakhir = Date.now();
    if (!hasil || hasil.error) {
      if (hasil && hasil.error) console.warn('Profil: tabel profiles belum siap (jalankan sql/05), memakai penyimpanan lokal.', hasil.error.message || hasil.error);
      S.lokal = true; S.profil = bacaLs('profil', null);
    } else {
      S.lokal = false; S.profil = hasil.data || null;
    }
    renderAkun();
  };

  /* ---------- tampilan ---------- */
  api.html = () => {
    const nama = namaUser(USER);
    const kepala = `<div class="akun-kepala"><span class="avatar avatar-besar">${avatarHtml(USER)}</span>
      <div><p class="akun-nama">${esc(nama)}</p><p class="akun-email">${esc(USER.email || '')}</p></div></div>`;
    const form = `<button type="button" class="btn btn-garis btn-blok" data-akun="keluar" style="margin-top:16px">Logout</button>`;
    return kepala + form;
  };

  api.render = () => {
    const el = $('#akunIsi'); if (!USER) { el.innerHTML = ''; return; }
    el.innerHTML = api.html();
  };

  /* ---------- interaksi ---------- */
  /* Segarkan profil saat tab kembali aktif (maks. sekali per 30 detik) */
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && USER && Date.now() - S.terakhir > 30000) api.muat().catch(() => {}); });
  window.AkunUser = api;
  if (typeof USER !== 'undefined' && USER) api.muat().catch(() => {});    /* sesi sudah terbaca sebelum file ini dimuat */
})();
