/* =====================================================================
   LAPTOP MAKASSAR - LOGIN GOOGLE (dipakai index.html & admin.html)
   Muat SETELAH supabase-config.js dan SEBELUM script.js / admin.js.

   Satu pintu login untuk semua orang. Peran ditentukan database:
   email yang ada di tabel admin_emails = admin, selain itu = user biasa.
   (lihat migrasi.sql: fungsi public.is_admin()).
   Pilihan login: Google (One Tap), Facebook, Email (kode), Apple, Microsoft, ChatGPT.
   Admin HANYA bisa masuk lewat Google -- dijaga di database, bukan di sini.

   Cara kerja:
   1. Popup pilih akun Google (Google One Tap) -> token dikirim ke Supabase
      lewat signInWithIdToken.
   2. Cadangan bila popup tidak muncul / GOOGLE_CLIENT_ID kosong:
      tombol resmi Google, atau login lewat halaman Google (OAuth redirect).
   ===================================================================== */
const LMAuth = (() => {
  const KEY_TANDA = 'lm_login_baru';
  let gsiSiap = false, noncePolos = '';
  const api = { onGalat: () => {}, keluarSengaja: false };

  /* Alamat kembali setelah login. Dinormalkan (tanpa "index.html") supaya SAMA PERSIS dengan satu entri
     "Redirect URLs" di Supabase. Bila tidak cocok, Supabase mengalihkan ke Site URL -> login "gagal". */
  const alamatKembali = () => location.origin + location.pathname.replace(/index\.html$/, '');
  /* Browser dalam aplikasi (Instagram, TikTok, Facebook, dll.): Google MEMBLOKIR login di sana. */
  api.dalamAplikasi = () => /(Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|BytedanceWebview|Line\/|Snapchat|Twitter|MicroMessenger)/i.test(navigator.userAgent || '');
  const PESAN_APLIKASI = 'Login Google tidak bisa dibuka di browser dalam aplikasi (Instagram/TikTok/Facebook). Ketuk menu ⋯ lalu pilih "Buka di Chrome/Safari", atau masuk dengan email.';

  const acak = () => { const b = new Uint8Array(32); crypto.getRandomValues(b); return btoa(String.fromCharCode(...b)); };
  const sha256hex = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))]
    .map(x => x.toString(16).padStart(2, '0')).join('');
  const gsiAda = () => !!(window.google && google.accounts && google.accounts.id);
  const tungguGsi = (ms = 5000) => new Promise(ok => {
    const t0 = Date.now();
    (function cek() { if (gsiAda()) return ok(true); if (Date.now() - t0 > ms) return ok(false); setTimeout(cek, 100); })();
  });

  /* Penanda "login baru": dipakai agar admin otomatis diarahkan ke panel
     HANYA tepat setelah login (bukan setiap kali membuka katalog). */
  api.tandai = () => { try { sessionStorage.setItem(KEY_TANDA, String(Date.now())); } catch (e) {} };
  api.tandaAktif = () => { try { const t = +sessionStorage.getItem(KEY_TANDA); return !!t && Date.now() - t < 10 * 60 * 1000; } catch (e) { return false; } };
  api.hapusTanda = () => { try { sessionStorage.removeItem(KEY_TANDA); } catch (e) {} };

  async function onCredential(res) {
    api.sedangProses = true;
    try {
      const { error } = await sb.auth.signInWithIdToken({ provider: 'google', token: res.credential, nonce: noncePolos });
      if (error) throw error;
    } catch (e) { console.error('Login Google gagal:', e); api.sedangProses = false; api.hapusTanda(); api.onGalat(api.ramahGalat(e, 'google')); }
  }

  /* Menyiapkan Google Identity Services. false = tidak bisa dipakai (Client ID kosong / skrip Google diblokir). */
  api.siapkan = async () => {
    if (typeof GOOGLE_CLIENT_ID === 'undefined' || !GOOGLE_CLIENT_ID) return false;
    if (!(await tungguGsi())) return false;
    if (!gsiSiap) {
      noncePolos = acak();
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: onCredential,
        nonce: await sha256hex(noncePolos),   /* Google menerima nonce ter-hash; Supabase menerima yang asli */
        use_fedcm_for_prompt: true,
        auto_select: false,
        cancel_on_tap_outside: true,
        itp_support: true
      });
      gsiSiap = true;
    }
    return true;
  };

  /* Popup pilih akun. tidakTampil() dipanggil bila Google menolak menampilkannya. */
  api.prompt = tidakTampil => {
    api.sedangProses = false;
    if (api.dalamAplikasi()) { api.onGalat(new Error(PESAN_APLIKASI)); return; }
    /* Mode FedCM tidak memanggil isNotDisplayed(); popup juga bisa ditahan Google (cooldown) tanpa kabar.
       Jadi: bila 3,5 detik tidak ada respons dan tidak sedang memproses, buka lembar pilihan login. */
    setTimeout(() => { if (!api.sedangProses && document.visibilityState === 'visible') tidakTampil(); }, 3500);
    try {
      google.accounts.id.prompt(n => {
        try {
          if (n.isNotDisplayed() || (n.isSkippedMoment() && n.getSkippedReason && n.getSkippedReason() !== 'user_cancel')) tidakTampil();
        } catch (e) { /* mode FedCM: tidak semua status tersedia */ }
      });
    } catch (e) { tidakTampil(); }
  };

  /* Tombol resmi Google (cadangan yang selalu bisa diklik). */
  api.renderTombol = async el => {
    if (!el) return false;
    if (!(await api.siapkan())) return false;
    el.innerHTML = '';
    google.accounts.id.renderButton(el, { type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale: 'id', logo_alignment: 'left', width: 280 });
    return true;
  };

  const NAMA_TAMPIL = { google: 'Google', facebook: 'Facebook', apple: 'Apple', microsoft: 'Microsoft', chatgpt: 'ChatGPT' };

  /* Pesan galat yang ramah. Provider yang belum diaktifkan di Supabase paling sering jadi penyebab. */
  api.ramahGalat = (e, nama) => {
    const m = String((e && e.message) || e || '');
    if (/provider is not enabled|unsupported provider|not enabled/i.test(m))
      return new Error('Login ' + (NAMA_TAMPIL[nama] || 'ini') + ' belum diaktifkan di toko ini. Pakai pilihan lain dulu ya.');
    if (/failed to fetch|networkerror|network request|load failed/i.test(m))
      return new Error('Tidak ada koneksi internet. Periksa jaringan lalu coba lagi.');
    if (/popup_closed|access_denied|user_cancel|cancell?ed/i.test(m))
      return new Error('Login dibatalkan. Coba lagi bila ingin melanjutkan.');
    if (/nonce|audience|client id|origin_mismatch|redirect_uri_mismatch/i.test(m))
      return new Error('Pengaturan login Google belum cocok dengan alamat situs ini. Hubungi pengelola toko.');
    if (/rate limit|too many|over_email_send_rate_limit|security purposes/i.test(m))
      return new Error('Terlalu sering meminta kode. Tunggu sebentar lalu coba lagi.');
    if (/expired|invalid/i.test(m) && /token|otp|code/i.test(m))
      return new Error('Kode salah atau sudah kedaluwarsa. Minta kode baru lalu coba lagi.');
    return new Error('Login belum berhasil. Coba lagi sebentar lagi.');   /* pesan teknis mentah tidak ditampilkan ke user */
  };

  /* Pindah ke halaman login penyedia (Google/Facebook/Apple/Microsoft/ChatGPT) lalu kembali ke halaman ini. */
  api.masukProvider = async nama => {
    const provider = (typeof NAMA_PROVIDER_SB !== 'undefined' && NAMA_PROVIDER_SB[nama]) || nama;
    api.tandai();
    if (nama === 'google' && api.dalamAplikasi()) { api.onGalat(new Error(PESAN_APLIKASI)); return; }
    const options = { redirectTo: alamatKembali() };
    if (nama === 'google') options.queryParams = { prompt: 'select_account' };
    if (nama === 'microsoft' || nama === 'facebook') options.scopes = 'email';   /* Microsoft (azure) wajib meminta scope email */
    const { error } = await sb.auth.signInWithOAuth({ provider, options });
    if (error) { api.hapusTanda(); api.onGalat(api.ramahGalat(error, nama)); }
  };

  /* Cadangan terakhir untuk Google (dipakai juga oleh admin.html). */
  api.masukOauth = () => api.masukProvider('google');

  /* Email tanpa kata sandi: Supabase mengirim kode (dan/atau tautan) ke email. */
  api.kirimKode = async email => {
    const { error } = await sb.auth.signInWithOtp({
      email, options: { shouldCreateUser: true, emailRedirectTo: alamatKembali() }
    });
    if (error) throw api.ramahGalat(error, 'email');
  };
  api.verifikasiKode = async (email, kode) => {
    api.tandai();
    const { error } = await sb.auth.verifyOtp({ email, token: kode, type: 'email' });
    if (error) { api.hapusTanda(); throw api.ramahGalat(error, 'email'); }
  };

  /* Admin atau bukan, ditentukan database (fungsi is_admin). Email admin TIDAK ada di kode. */
  api.cekAdmin = async () => {
    for (let i = 0; i < 3; i++) {
      try { const { data, error } = await sb.rpc('is_admin'); if (!error) return data === true; }
      catch (e) { /* coba lagi */ }
      await new Promise(r => setTimeout(r, 400 * (i + 1)));
    }
    return null;   /* gagal diperiksa (jaringan/server) -- BEDA dengan false (memang bukan admin) */
  };

  api.keluar = async () => {
    try { if (gsiAda()) google.accounts.id.disableAutoSelect(); } catch (e) {}
    api.hapusTanda();
    api.keluarSengaja = true;
    return sb.auth.signOut();
  };

  return api;
})();
