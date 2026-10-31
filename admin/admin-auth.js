/* =====================================================================
   TEKNOA.ID - LOGIN PANEL ADMIN (situs terpisah: admin.teknoa.id)
   Muat SETELAH supabase-js dan supabase-config.js, SEBELUM admin.js.
   Masuk HANYA lewat Google (redirect). Peran diperiksa DATABASE (RPC is_admin / get_my_role),
   bukan frontend. Frontend hanya menampilkan hasilnya; data tetap dijaga RLS.
   ===================================================================== */
const AdminAuth = (() => {
  const api = { keluarSengaja: false };
  const alamatKembali = () => location.origin + location.pathname.replace(/index\.html$/, '');
  api.dalamAplikasi = () => /(Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|BytedanceWebview|Line\/|Snapchat|Twitter|MicroMessenger)/i.test(navigator.userAgent || '');

  api.ramahGalat = e => {
    const m = String((e && (e.message || e.error_description)) || e || '');
    if (/failed to fetch|networkerror|load failed/i.test(m)) return 'Tidak ada koneksi internet. Periksa jaringan lalu coba lagi.';
    if (/provider is not enabled|unsupported provider/i.test(m)) return 'Login Google belum diaktifkan di Supabase. Lihat PANDUAN-DEPLOY.md.';
    if (/nonce|audience|origin|client id/i.test(m)) return 'Pengaturan Google belum cocok dengan alamat halaman ini (' + location.origin + '). Tambahkan alamat itu di Google Cloud > Authorized JavaScript origins.';
    if (/access_denied|cancell?ed/i.test(m)) return 'Login dibatalkan.';
    if (/row-level security|permission denied|42501|jwt/i.test(m)) return 'Akses ditolak. Akun ini tidak punya izin untuk tindakan tersebut.';
    return 'Terjadi kendala. Coba lagi sebentar lagi.';
  };

  /* Login TANPA redirect: tombol resmi Google -> token -> signInWithIdToken. Sesi dibuat di halaman ini juga,
     jadi tidak bergantung pada daftar "Redirect URLs" Supabase (penyebab admin 'terlempar' ke situs publik). */
  let nonceAsli = '', gsiSiap = false;
  const acak = () => { const b = new Uint8Array(32); crypto.getRandomValues(b); return btoa(String.fromCharCode(...b)); };
  const sha256hex = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(x => x.toString(16).padStart(2, '0')).join('');
  const tungguGsi = (ms = 6000) => new Promise(ok => { const t0 = Date.now(); (function c() { if (window.google && google.accounts && google.accounts.id) return ok(true); if (Date.now() - t0 > ms) return ok(false); setTimeout(c, 100); })(); });
  api.tidakDidukung = () => location.protocol === 'file:'
    ? 'Halaman ini dibuka sebagai file (file://). Login Google tidak bisa jalan. Jalankan lewat alamat http(s), mis. "npx serve admin" lalu buka http://localhost:3000, atau deploy ke admin.teknoa.id.' : '';
  api.renderGoogle = async (el, saatGalat, saatMulai) => {
    if (!el || typeof GOOGLE_CLIENT_ID === 'undefined' || !GOOGLE_CLIENT_ID) return false;
    if (!(await tungguGsi())) return false;
    if (!gsiSiap) {
      nonceAsli = acak();
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID, nonce: await sha256hex(nonceAsli), use_fedcm_for_prompt: true, auto_select: false,
        callback: async res => {
          saatMulai && saatMulai();
          const { error } = await sb.auth.signInWithIdToken({ provider: 'google', token: res.credential, nonce: nonceAsli });
          if (error) saatGalat(api.ramahGalat(error));
        }
      });
      gsiSiap = true;
    }
    el.innerHTML = '';
    google.accounts.id.renderButton(el, { type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'id', width: 280 });
    return true;
  };

  api.masukGoogle = async () => {
    if (api.dalamAplikasi()) throw new Error('Buka halaman ini di Chrome/Safari. Google memblokir login di browser dalam aplikasi.');
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: alamatKembali(), queryParams: { prompt: 'select_account' } } });
    if (error) throw new Error(api.ramahGalat(error));
  };

  /* Peran dari database. 'owner' | 'admin' | 'user' | null (gagal diperiksa: jaringan/server).
     Memakai get_my_role() bila migrasi sudah dijalankan; jika belum ada, memakai is_admin(). */
  api.peran = async () => {
    for (let i = 0; i < 3; i++) {
      try {
        const r = await sb.rpc('get_my_role');
        if (!r.error && typeof r.data === 'string') return r.data;
        const a = await sb.rpc('is_admin');
        if (!a.error) return a.data === true ? 'admin' : 'user';
      } catch (e) { /* coba lagi */ }
      await new Promise(ok => setTimeout(ok, 400 * (i + 1)));
    }
    return null;
  };

  api.keluar = async () => { api.keluarSengaja = true; return sb.auth.signOut(); };
  return api;
})();
