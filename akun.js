/* =====================================================================
   TEKNOA.ID - AREA AKUN USER (dimuat SETELAH script.js)
   Isi dialog "Akun saya": Profil, Favorit, Riwayat, Perbandingan tersimpan, Notifikasi, Pengaturan.
   Data di Supabase (tabel profiles, view_history, saved_comparisons, notifications, wishlist);
   isolasi antar-user dijaga RLS (lihat sql/02-fitur-user.sql), bukan oleh kode ini.
   Memakai global dari script.js: USER, FAV, CMP, esc, rupiah, cariProduk, namaLengkap, toast, dst.
   ===================================================================== */
(function () {
  'use strict';
  const S = { profil: null, riwayat: [], tersimpan: [], notif: [], tab: 'profil', tabelAda: true, galat: '', terakhir: 0 };
  const api = { S };
  const TAB = [['profil', 'Profil'], ['favorit', 'Favorit'], ['riwayat', 'Riwayat'], ['banding', 'Banding'], ['notif', 'Notifikasi'], ['atur', 'Pengaturan']];
  const belumAda = e => !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache|could not find the table/i.test(e.message || ''));
  const waktu = t => { try { return new Date(t).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
  const belumDibaca = () => S.notif.filter(n => !n.dibaca).length;

  api.namaTampil = () => (S.profil && S.profil.display_name) || '';
  api.fotoTampil = () => (S.profil && S.profil.avatar_url) || '';
  api.bersih = () => { Object.assign(S, { profil: null, riwayat: [], tersimpan: [], notif: [], tab: 'profil', tabelAda: true, galat: '', terakhir: 0 }); };

  /* ---------- data ---------- */
  api.muat = async () => {
    if (!USER) return;
    const uid = USER.id;
    const [p, r, t, n] = await Promise.all([
      sb.from('profiles').select('display_name,avatar_url').eq('user_id', uid).maybeSingle(),
      sb.from('view_history').select('product_id,viewed_at').eq('user_id', uid).order('viewed_at', { ascending: false }).limit(30),
      sb.from('saved_comparisons').select('id,nama,product_ids,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(30),
      sb.from('notifications').select('id,judul,isi,dibaca,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(30)
    ]);
    if (!USER || USER.id !== uid) return;                       /* user berganti/keluar saat memuat */
    const e = [p, r, t, n].map(x => x.error).find(Boolean);
    S.terakhir = Date.now();
    if (e) {
      S.tabelAda = !belumAda(e);
      S.galat = S.tabelAda ? 'Data akun belum bisa dimuat. Periksa koneksi lalu coba lagi.' : 'Fitur akun belum diaktifkan di database (admin perlu menjalankan sql/02-fitur-user.sql).';
    } else { S.tabelAda = true; S.galat = ''; }
    S.profil = p.data || null; S.riwayat = r.data || []; S.tersimpan = t.data || []; S.notif = n.data || [];
    if (!e && !S.notif.length) {                                /* sambutan sekali per user (fungsi server, idempotent) */
      const w = await sb.rpc('notif_selamat_datang');
      if (!w.error) { const n2 = await sb.from('notifications').select('id,judul,isi,dibaca,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(30); if (!n2.error) S.notif = n2.data || []; }
    }
    renderAkun();
  };

  api.catatLihat = id => {                                      /* dipanggil bukaDetail(); gagal diam-diam (bukan fitur kritis) */
    if (!USER || !S.tabelAda) return;
    const pid = Number(id); if (!Number.isInteger(pid)) return;
    const sekarang = new Date().toISOString();
    S.riwayat = [{ product_id: pid, viewed_at: sekarang }, ...S.riwayat.filter(r => Number(r.product_id) !== pid)].slice(0, 30);
    sb.from('view_history').upsert({ user_id: USER.id, product_id: pid, viewed_at: sekarang }, { onConflict: 'user_id,product_id' })
      .then(({ error }) => { if (error) console.warn('Riwayat belum tersimpan:', error.message); });
  };

  api.simpanBanding = async nama => {
    if (!USER) return perluLogin('Masuk dulu untuk menyimpan perbandingan');
    if (CMP.length < 2) return toast('Pilih minimal 2 laptop dulu', 'info');
    if (S.tersimpan.length >= 20) return toast('Maksimal 20 perbandingan tersimpan. Hapus yang lama dulu.', 'info');
    const ids = CMP.map(Number).filter(Number.isInteger);
    const nm = (nama || '').trim().slice(0, 80) || ids.map(i => { const p = cariProduk(i); return p ? namaLengkap(p) : ''; }).filter(Boolean).join(' vs ').slice(0, 80) || 'Perbandingan';
    const { data, error } = await sb.from('saved_comparisons').insert({ user_id: USER.id, nama: nm, product_ids: ids }).select('id,nama,product_ids,created_at').single();
    if (error) { console.warn(error); return toast(belumAda(error) ? 'Fitur ini belum aktif di database' : 'Perbandingan belum tersimpan, coba lagi', 'galat'); }
    S.tersimpan.unshift(data); toast('Perbandingan tersimpan', 'sukses'); renderAkun();
  };

  /* ---------- tampilan ---------- */
  const item = (p, extra, sub) => `<div class="kr-item"><div class="kr-foto"><img src="${esc(p.foto)}" alt="" ${fotoErr}></div><div>
      <p class="kr-nama">${esc(namaLengkap(p))}</p><p class="kr-harga">${rupiah(p.harga)}</p>${sub ? `<p class="akun-email">${esc(sub)}</p>` : ''}
      <div class="kr-baris">${extra}</div></div></div>`;
  const tombolProduk = (p, hapusAttr) => `<button type="button" class="btn btn-kecil" data-akun-tambah="${esc(p.id)}">+ Keranjang</button><button type="button" class="btn btn-kecil btn-garis" data-akun-buka="${esc(p.id)}">Detail</button>${hapusAttr || ''}`;
  const kosong = t => `<p class="kr-kosong">${t}</p>`;

  api.isiTab = tab => {
    if (!S.tabelAda && ['profil', 'riwayat', 'banding', 'notif'].includes(tab)) return kosong(esc(S.galat));
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

  api.html = () => {
    const nama = namaUser(USER), kepala = `<div class="akun-kepala"><span class="avatar avatar-besar">${avatarHtml(USER)}</span>
      <div><p class="akun-nama">${esc(nama)}</p><p class="akun-email">${esc(USER.email || '')}</p></div></div>`;
    const tabs = `<div class="akun-tabs" role="tablist" aria-label="Bagian akun">${TAB.map(([id, l]) => {
      const n = id === 'notif' ? belumDibaca() : id === 'favorit' ? FAV.length : 0;
      return `<button type="button" role="tab" class="akun-tab" aria-selected="${S.tab === id}" data-tab-akun="${id}">${l}${n ? ` (${n})` : ''}</button>`;
    }).join('')}</div>`;
    return kepala + (S.galat && S.tabelAda ? `<p class="pesan-akun galat">${esc(S.galat)}</p>` : '') + tabs + `<div class="akun-isi">${api.isiTab(S.tab)}</div>`;
  };
  api.render = () => { const el = $('#akunIsi'); if (!USER) { el.innerHTML = ''; return; } el.innerHTML = api.html(); };

  /* ---------- interaksi ---------- */
  const akunIsi = $('#akunIsi');
  akunIsi.addEventListener('click', async e => {
    const q = a => e.target.closest(a);
    let b;
    if ((b = q('[data-tab-akun]'))) { S.tab = b.dataset.tabAkun; api.render(); return; }
    if ((b = q('[data-akun-tambah]'))) { tambahKeranjang(b.dataset.akunTambah); return; }
    if ((b = q('[data-akun-buka]'))) { $('#akun').close(); bukaDetail(b.dataset.akunBuka); return; }
    if ((b = q('[data-akun-fav]'))) { toggleFav(b.dataset.akunFav); return; }
    if (q('[data-akun-hapusriwayat]')) {
      const { error } = await sb.from('view_history').delete().eq('user_id', USER.id);
      if (error) return toast('Riwayat belum terhapus, coba lagi', 'galat');
      S.riwayat = []; toast('Riwayat dihapus', 'sukses'); api.render(); return;
    }
    if (q('[data-akun-bacasemua]')) {
      const { error } = await sb.from('notifications').update({ dibaca: true }).eq('user_id', USER.id).eq('dibaca', false);
      if (error) return toast('Belum berhasil, coba lagi', 'galat');
      S.notif.forEach(n => { n.dibaca = true; }); api.render(); return;
    }
    if ((b = q('[data-akun-bdghapus]'))) {
      const { error } = await sb.from('saved_comparisons').delete().eq('id', Number(b.dataset.akunBdghapus)).eq('user_id', USER.id);
      if (error) return toast('Belum terhapus, coba lagi', 'galat');
      S.tersimpan = S.tersimpan.filter(t => String(t.id) !== b.dataset.akunBdghapus); api.render(); return;
    }
    if ((b = q('[data-akun-bdgbuka]'))) {
      const t = S.tersimpan.find(x => String(x.id) === b.dataset.akunBdgbuka); if (!t) return;
      const ada = (t.product_ids || []).map(String).filter(id => cariProduk(id)).slice(0, MAKS_BANDING);
      if (ada.length < 2) return toast('Laptop pada perbandingan ini sudah tidak tersedia', 'info');
      CMP = ada; simpanBanding(); segarkanTanda(); $('#akun').close(); bukaBanding();
    }
  });
  akunIsi.addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    if (f.id === 'akunProfilForm') {
      const pesan = $('#apPesan'), tampil = (t, g) => { pesan.textContent = t; pesan.hidden = !t; pesan.classList.toggle('galat', !!g); };
      const nama = f.nama.value.trim().slice(0, 60), foto = f.foto.value.trim();
      if (foto && !/^https:\/\/\S+$/i.test(foto)) return tampil('Link foto harus diawali https://', true);
      const btn = f.querySelector('button[type=submit]'); btn.disabled = true; tampil('Menyimpan...');
      const { error } = await sb.from('profiles').upsert({ user_id: USER.id, display_name: nama || null, avatar_url: foto || null, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      btn.disabled = false;
      if (error) return tampil(belumAda(error) ? 'Fitur profil belum aktif di database.' : 'Profil belum tersimpan. Coba lagi.', true);
      S.profil = { display_name: nama || null, avatar_url: foto || null };
      toast('Profil tersimpan', 'sukses'); renderAkun();
    } else if (f.id === 'akunBdgForm') { await api.simpanBanding(f.nama.value); }
  });

  /* Segarkan notifikasi saat tab kembali aktif (maks. sekali per 30 detik) */
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && USER && Date.now() - S.terakhir > 30000) api.muat().catch(() => {}); });
  window.AkunUser = api;
  if (typeof USER !== 'undefined' && USER) api.muat().catch(() => {});    /* sesi sudah terbaca sebelum file ini dimuat */
})();
