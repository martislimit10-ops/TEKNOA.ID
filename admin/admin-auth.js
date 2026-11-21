/* =====================================================================
   TEKNOA.ID - PERAN & KELUAR PANEL ADMIN (satu situs dengan website utama: teknoa.id/admin/)
   Muat SETELAH supabase-js dan supabase-config.js, SEBELUM admin.js.
   Panel TIDAK punya login sendiri: login hanya lewat website utama (tombol "Log in"), sesinya dipakai bersama.
   Peran diperiksa DATABASE (RPC get_my_role / is_admin), bukan frontend. Data tetap dijaga RLS.
   ===================================================================== */
const AdminAuth = (() => {
  const api = {};

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

  api.keluar = async () => sb.auth.signOut();
  return api;
})();
