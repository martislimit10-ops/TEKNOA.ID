/* =====================================================================
   TEKNOA.ID - AREA AKUN USER (dimuat SETELAH script.js)
   Isi dialog "Akun saya": Profil, Favorit, Riwayat, Perbandingan tersimpan, Notifikasi, Pengaturan.
   Data di Supabase (tabel profiles, view_history, saved_comparisons, notifications, wishlist);
   isolasi antar-user dijaga RLS (lihat sql/02-fitur-user.sql), bukan oleh kode ini.
   Memakai global dari script.js: USER, FAV, CMP, esc, rupiah, cariProduk, namaLengkap, toast, dst.

   [REVISI-7]
   - Enam tab sekarang berupa slider: klik tab -> panel bergeser mulus (CSS: .akun-track).
   - Tidak ada lagi pesan error database. Bila tabel Supabase belum ada / tidak bisa dihubungi,
     akun.js diam-diam memakai penyimpanan lokal perangkat (localStorage) sebagai cadangan.
   ===================================================================== */
(function () {
  'use strict';
  const S = { profil: null, riwayat: [], tersimpan: [], notif: [], tab: 'profil', lokal: false, terakhir: 0 };
  const api = { S };
  const TAB = [['profil', 'Profil'], ['favorit', 'Favorit'], ['riwayat', 'Riwayat'], ['banding', 'Banding'], ['notif', 'Notifikasi'], ['atur', 'Pengaturan']];
  const waktu = t => { try { return new Date(t).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
  const belumDibaca = () => S.notif.filter(n => !n.dibaca).length;

  /* ---------- penyimpanan lokal (cadangan) ---------- */
  const kunciLs = k => 'lm_akun_' + (USER ? USER.id : 'x') + '_' + k;
  const bacaLs = (k, d) => { try { const v = JSON.parse(localStorage.getItem(kunciLs(k))); return v == null ? d : v; } catch (e) { return d; } };
  const tulisLs = (k, v) => { try { localStorage.setItem(kunciLs(k), JSON.stringify(v)); } catch (e) {} };
  function muatLokal() {
    S.profil = bacaLs('profil', null);
    S.riwayat = bacaLs('riwayat', []);
    S.tersimpan = bacaLs('banding', []);
    let n = bacaLs('notif', null);
    if (!Array.isArray(n)) {
      n = [{ id: 'sambutan', judul: 'Selamat datang!', isi: 'Simpan laptop favorit dan bandingkan spesifikasi laptop.', dibaca: false, created_at: new Date().toISOString() }];
      tulisLs('notif', n);
    }
    S.notif = n;
  }

  api.namaTampil = () => (S.profil && S.profil.display_name) || '';
  api.fotoTampil = () => (S.profil && S.profil.avatar_url) || '';
  api.bersih = () => { Object.assign(S, { profil: null, riwayat: [], tersimpan: [], notif: [], tab: 'profil', lokal: false, terakhir: 0 }); };

  /* ---------- data ---------- */
  const KOLOM_NOTIF = 'id,judul,isi,dibaca,created_at';
  api.muat = async () => {
    if (!USER || IS_ADMIN) return;                              /* admin bukan akun user */
    const uid = USER.id;
    let hasil = null;
    try {
      hasil = await Promise.all([
        sb.from('profiles').select('display_name,avatar_url').eq('user_id', uid).maybeSingle(),
        sb.from('view_history').select('product_id,viewed_at').eq('user_id', uid).order('viewed_at', { ascending: false }).limit(30),
        sb.from('saved_comparisons').select('id,nama,product_ids,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(30),
        sb.from('notifications').select(KOLOM_NOTIF).eq('user_id', uid).order('created_at', { ascending: false }).limit(30)
      ]);
    } catch (err) { console.warn('Data akun: tidak bisa terhubung, memakai penyimpanan lokal.', err); }
    if (!USER || USER.id !== uid) return;                       /* user berganti/keluar saat memuat */
    S.terakhir = Date.now();
    const e = hasil ? hasil.map(x => x.error).find(Boolean) : true;
    if (e) {
      if (e !== true) console.warn('Data akun: tabel belum siap, memakai penyimpanan lokal.', e.message || e);
      S.lokal = true; muatLokal();
    } else {
      S.lokal = false;
      S.profil = hasil[0].data || null; S.riwayat = hasil[1].data || []; S.tersimpan = hasil[2].data || []; S.notif = hasil[3].data || [];
      if (!S.notif.length) {                                    /* sambutan sekali per user (fungsi server, idempotent) */
        const w = await sb.rpc('notif_selamat_datang');
        if (!w.error) { const n2 = await sb.from('notifications').select(KOLOM_NOTIF).eq('user_id', uid).order('created_at', { ascending: false }).limit(30); if (!n2.error) S.notif = n2.data || []; }
      }
    }
    renderAkun();
  };

  api.catatLihat = id => {                                      /* dipanggil bukaDetail(); gagal diam-diam (bukan fitur kritis) */
    if (!USER || IS_ADMIN) return;
    const pid = Number(id); if (!Number.isInteger(pid)) return;
    const sekarang = new Date().toISOString();
    S.riwayat = [{ product_id: pid, viewed_at: sekarang }, ...S.riwayat.filter(r => Number(r.product_id) !== pid)].slice(0, 30);
    if (S.lokal) { tulisLs('riwayat', S.riwayat); return; }
    sb.from('view_history').upsert({ user_id: USER.id, product_id: pid, viewed_at: sekarang }, { onConflict: 'user_id,product_id' })
      .then(({ error }) => { if (error) console.warn('Riwayat belum tersimpan:', error.message); });
  };

  api.simpanBanding = async nama => {
    if (!USER) return perluLogin('Masuk dulu untuk menyimpan perbandingan');
    if (CMP.length < 2) return toast('Pilih minimal 2 laptop dulu', 'info');
    if (S.tersimpan.length >= 20) return toast('Maksimal 20 perbandingan tersimpan. Hapus yang lama dulu.', 'info');
    const ids = CMP.map(Number).filter(Number.isInteger);
    const nm = (nama || '').trim().slice(0, 80) || ids.map(i => { const p = cariProduk(i); return p ? namaLengkap(p) : ''; }).filter(Boolean).join(' vs ').slice(0, 80) || 'Perbandingan';
    if (S.lokal) {
      S.tersimpan.unshift({ id: 'l' + Date.now(), nama: nm, product_ids: ids, created_at: new Date().toISOString() });
      tulisLs('banding', S.tersimpan); toast('Perbandingan tersimpan', 'sukses'); renderAkun(); return;
    }
    const { data, error } = await sb.from('saved_comparisons').insert({ user_id: USER.id, nama: nm, product_ids: ids }).select('id,nama,product_ids,created_at').single();
    if (error) { console.warn(error); return toast('Perbandingan belum tersimpan, coba lagi', 'galat'); }
    S.tersimpan.unshift(data); toast('Perbandingan tersimpan', 'sukses'); renderAkun();
  };

  /* ---------- tampilan ---------- */
  const item = (p, extra, sub) => `<div class="kr-item"><div class="kr-foto"><img src="${esc(p.foto)}" alt="" ${fotoErr}></div><div>
      <p class="kr-nama">${esc(namaLengkap(p))}</p><p class="kr-harga">${rupiah(p.harga)}</p>${sub ? `<p class="akun-email">${esc(sub)}</p>` : ''}
      <div class="kr-baris">${extra}</div></div></div>`;
  const tombolProduk = (p, hapusAttr) => `<button type="button" class="btn btn-kecil" data-akun-tambah="${esc(p.id)}">+ Keranjang</button><button type="button" class="btn btn-kecil btn-garis" data-akun-buka="${esc(p.id)}">Detail</button>${hapusAttr || ''}`;
  const kosong = t => `<p class="kr-kosong">${t}</p>`;

  api.isiTab = tab => {
    if (tab === 'profil') return `<form class="akun-form" id="akunProfilForm" novalidate>
        <label class="akun-lbl" for="apNama">Nama tampilan</label>
        <input id="apNama" name="nama" class="field" maxlength="60" autocomplete="name" value="${esc(S.profil && S.profil.display_name || '')}" placeholder="${esc((USER.user_metadata && (USER.user_metadata.full_name || USER.user_metadata.name)) || 'Nama kamu')}">
        <label class="akun-lbl" for="apFoto">Foto profil (link https, opsional)</label>
        <input id="apFoto" name="foto" class="field" type="url" maxlength="500" inputmode="url" value="${esc(S.profil && S.profil.avatar_url || '')}" placeholder="Kosongkan untuk memakai foto akun Google">
        <p class="akun-email">Email: ${esc(USER.email || '-')} (tidak bisa diubah di sini)</p>
        <p class="pesan-akun" id="apPesan" role="status" hidden></p>
        <button type="submit" class="btn btn-blok">Simpan profil</button></form>`;
    if (tab === 'favorit') {
      const l = FAV.map(cariProduk).filter(Boolean);
      return l.length ? l.map(p => item(p, tombolProduk(p, `<button type="button" class="btn btn-kecil btn-garis" data-akun-fav="${esc(p.id)}">Hapus</button>`))).join('') : kosong('Belum ada favorit. Ketuk ikon hati pada laptop incaranmu.');
    }
    if (tab === 'riwayat') {
      const l = S.riwayat.map(r => [cariProduk(r.product_id), r]).filter(x => x[0]);
      return (l.length ? l.map(([p, r]) => item(p, tombolProduk(p), 'Dilihat ' + waktu(r.viewed_at))).join('') + `<button type="button" class="btn btn-garis btn-blok" data-akun-hapusriwayat>Hapus riwayat</button>` : kosong('Belum ada riwayat. Laptop yang kamu buka detailnya akan muncul di sini.'));
    }
    if (tab === 'banding') {
      const simpan = CMP.length >= 2
        ? `<form class="akun-form" id="akunBdgForm"><p class="akun-email">Sedang dibandingkan: ${CMP.length} laptop</p><input class="field" name="nama" maxlength="80" placeholder="Nama perbandingan (opsional)"><button type="submit" class="btn btn-blok">Simpan perbandingan ini</button></form>`
        : kosong('Pilih 2-4 laptop lewat tombol "+ Bandingkan", lalu simpan di sini.');
      const daftar = S.tersimpan.map(t => {
        const nama = (t.product_ids || []).map(i => { const p = cariProduk(i); return p ? namaLengkap(p) : null; }).filter(Boolean);
        return `<div class="kr-item"><div><p class="kr-nama">${esc(t.nama)}</p><p class="akun-email">${nama.length} dari ${(t.product_ids || []).length} laptop masih tersedia &middot; ${esc(waktu(t.created_at))}</p>
          <div class="kr-baris"><button type="button" class="btn btn-kecil" data-akun-bdgbuka="${esc(t.id)}" ${nama.length < 2 ? 'disabled' : ''}>Buka</button><button type="button" class="btn btn-kecil btn-garis" data-akun-bdghapus="${esc(t.id)}">Hapus</button></div></div></div>`;
      }).join('');
      return simpan + (daftar ? `<h3 class="akun-sub">Tersimpan</h3>${daftar}` : '');
    }
    if (tab === 'notif') {
      return (S.notif.length ? (belumDibaca() ? `<button type="button" class="btn btn-garis btn-blok" data-akun-bacasemua>Tandai semua dibaca</button>` : '') + S.notif.map(n => `<div class="kr-item akun-notif ${n.dibaca ? '' : 'baru'}"><div><p class="kr-nama">${n.dibaca ? '' : '&bull; '}${esc(n.judul)}</p>${n.isi ? `<p class="akun-email">${esc(n.isi)}</p>` : ''}<p class="akun-email">${esc(waktu(n.created_at))}</p></div></div>`).join('') : kosong('Belum ada notifikasi.'));
    }
    const prov = (USER.app_metadata && USER.app_metadata.provider) || 'email';
    return `<div class="akun-menu"><p class="akun-email">Email: ${esc(USER.email || '-')}<br>Masuk lewat: ${esc(prov)}</p>
      <button type="button" class="btn btn-garis btn-blok" data-akun-hapusriwayat>Hapus riwayat dilihat</button>
      <button type="button" class="btn btn-blok" data-akun="keluar">Keluar</button></div>`;
  };

  /* Semua panel dirender sekaligus di dalam satu "track"; yang tampil ditentukan translateX (lihat pilihTab). */
  api.html = () => {
    const nama = namaUser(USER), kepala = `<div class="akun-kepala"><span class="avatar avatar-besar">${avatarHtml(USER)}</span>
      <div><p class="akun-nama">${esc(nama)}</p><p class="akun-email">${esc(USER.email || '')}</p></div></div>`;
    const idx = Math.max(0, TAB.findIndex(t => t[0] === S.tab));
    const tabs = `<div class="akun-tabs" role="tablist" aria-label="Bagian akun">${TAB.map(([id, l], i) => {
      const n = id === 'notif' ? belumDibaca() : id === 'favorit' ? FAV.length : 0;
      return `<button type="button" role="tab" id="akunTab-${id}" aria-controls="akunPanel-${id}" class="akun-tab" aria-selected="${i === idx}" tabindex="${i === idx ? 0 : -1}" data-tab-akun="${id}">${l}${n ? ` (${n})` : ''}</button>`;
    }).join('')}</div>`;
    const panel = TAB.map(([id], i) => `<section class="akun-panel" role="tabpanel" id="akunPanel-${id}" aria-labelledby="akunTab-${id}" aria-hidden="${i !== idx}"${i !== idx ? ' inert' : ''}>${api.isiTab(id)}</section>`).join('');
    return kepala + tabs + `<div class="akun-viewport"><div class="akun-track">${panel}</div></div>`;
  };

  /* Tinggi area slider mengikuti panel yang aktif (panel lain bisa lebih tinggi) */
  function aturTinggi() {
    const vp = $('#akunIsi .akun-viewport'); if (!vp) return;
    const p = $('.akun-panel[aria-hidden="false"]', vp);
    vp.style.height = p && p.offsetHeight ? p.offsetHeight + 'px' : '';   /* dialog tertutup (tinggi 0) -> biarkan auto */
  }
  let ro = null;
  function pasangRO(el) {
    if (!('ResizeObserver' in window)) return;
    if (!ro) ro = new ResizeObserver(aturTinggi);
    ro.disconnect();
    $$('.akun-panel', el).forEach(p => ro.observe(p));                    /* juga terpicu saat dialog baru dibuka */
  }

  api.pilihTab = (id, animasi = true) => {
    const i = TAB.findIndex(t => t[0] === id); if (i < 0) return;
    S.tab = id;
    const root = $('#akunIsi'), track = $('.akun-track', root); if (!track) return;
    track.classList.toggle('tanpa-anim', !animasi);
    track.style.transform = 'translateX(-' + (i * 100) + '%)';
    const bar = $('.akun-tabs', root);
    $$('.akun-tab', root).forEach(b => {
      const a = b.dataset.tabAkun === id;
      b.setAttribute('aria-selected', String(a)); b.tabIndex = a ? 0 : -1;
      if (a && bar) bar.scrollTo({ left: b.offsetLeft - (bar.clientWidth - b.offsetWidth) / 2, behavior: animasi ? 'smooth' : 'auto' });
    });
    $$('.akun-panel', root).forEach((p, k) => { p.setAttribute('aria-hidden', String(k !== i)); p.toggleAttribute('inert', k !== i); });
    aturTinggi();
  };

  api.render = () => {
    const el = $('#akunIsi'); if (!USER) { el.innerHTML = ''; return; }
    el.innerHTML = api.html();
    pasangRO(el);
    api.pilihTab(S.tab, false);                                           /* posisi awal tanpa animasi */
  };

  /* ---------- interaksi ---------- */
  const akunIsi = $('#akunIsi');
  akunIsi.addEventListener('click', async e => {
    const q = a => e.target.closest(a);
    let b;
    if ((b = q('[data-tab-akun]'))) { api.pilihTab(b.dataset.tabAkun); return; }
    if ((b = q('[data-akun-tambah]'))) { tambahKeranjang(b.dataset.akunTambah); return; }
    if ((b = q('[data-akun-buka]'))) { $('#akun').close(); bukaDetail(b.dataset.akunBuka); return; }
    if ((b = q('[data-akun-fav]'))) { toggleFav(b.dataset.akunFav); return; }
    if (q('[data-akun-hapusriwayat]')) {
      if (S.lokal) { S.riwayat = []; tulisLs('riwayat', []); toast('Riwayat dihapus', 'sukses'); api.render(); return; }
      const { error } = await sb.from('view_history').delete().eq('user_id', USER.id);
      if (error) return toast('Riwayat belum terhapus, coba lagi', 'galat');
      S.riwayat = []; toast('Riwayat dihapus', 'sukses'); api.render(); return;
    }
    if (q('[data-akun-bacasemua]')) {
      if (S.lokal) { S.notif.forEach(n => { n.dibaca = true; }); tulisLs('notif', S.notif); api.render(); return; }
      const { error } = await sb.from('notifications').update({ dibaca: true }).eq('user_id', USER.id).eq('dibaca', false);
      if (error) return toast('Belum berhasil, coba lagi', 'galat');
      S.notif.forEach(n => { n.dibaca = true; }); api.render(); return;
    }
    if ((b = q('[data-akun-bdghapus]'))) {
      const idb = b.dataset.akunBdghapus;
      if (S.lokal) { S.tersimpan = S.tersimpan.filter(t => String(t.id) !== idb); tulisLs('banding', S.tersimpan); api.render(); return; }
      const { error } = await sb.from('saved_comparisons').delete().eq('id', Number(idb)).eq('user_id', USER.id);
      if (error) return toast('Belum terhapus, coba lagi', 'galat');
      S.tersimpan = S.tersimpan.filter(t => String(t.id) !== idb); api.render(); return;
    }
    if ((b = q('[data-akun-bdgbuka]'))) {
      const t = S.tersimpan.find(x => String(x.id) === b.dataset.akunBdgbuka); if (!t) return;
      const ada = (t.product_ids || []).map(String).filter(id => cariProduk(id)).slice(0, MAKS_BANDING);
      if (ada.length < 2) return toast('Laptop pada perbandingan ini sudah tidak tersedia', 'info');
      CMP = ada; simpanBanding(); segarkanTanda(); $('#akun').close(); bukaBanding();
    }
  });
  /* Panah kiri/kanan berpindah tab (aksesibilitas keyboard) */
  akunIsi.addEventListener('keydown', e => {
    const t = e.target.closest('[data-tab-akun]'); if (!t) return;
    const arah = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!arah) return;
    e.preventDefault();
    const i = (TAB.findIndex(x => x[0] === t.dataset.tabAkun) + arah + TAB.length) % TAB.length;
    api.pilihTab(TAB[i][0]);
    const b = $('[data-tab-akun="' + TAB[i][0] + '"]', akunIsi); if (b) b.focus();
  });
  akunIsi.addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    if (f.id === 'akunProfilForm') {
      const pesan = $('#apPesan'), tampil = (t, g) => { pesan.textContent = t; pesan.hidden = !t; pesan.classList.toggle('galat', !!g); };
      const nama = f.nama.value.trim().slice(0, 60), foto = f.foto.value.trim();
      if (foto && !/^https:\/\/\S+$/i.test(foto)) return tampil('Link foto harus diawali https://', true);
      if (S.lokal) {
        S.profil = { display_name: nama || null, avatar_url: foto || null }; tulisLs('profil', S.profil);
        toast('Profil tersimpan', 'sukses'); renderAkun(); return;
      }
      const btn = f.querySelector('button[type=submit]'); btn.disabled = true; tampil('Menyimpan...');
      const { error } = await sb.from('profiles').upsert({ user_id: USER.id, display_name: nama || null, avatar_url: foto || null, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      btn.disabled = false;
      if (error) return tampil('Profil belum tersimpan. Coba lagi.', true);
      S.profil = { display_name: nama || null, avatar_url: foto || null };
      toast('Profil tersimpan', 'sukses'); renderAkun();
    } else if (f.id === 'akunBdgForm') { await api.simpanBanding(f.nama.value); }
  });

  /* Segarkan notifikasi saat tab kembali aktif (maks. sekali per 30 detik) */
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && USER && Date.now() - S.terakhir > 30000) api.muat().catch(() => {}); });
  window.AkunUser = api;
  if (typeof USER !== 'undefined' && USER) api.muat().catch(() => {});    /* sesi sudah terbaca sebelum file ini dimuat */
})();
