/* =====================================================================
   oop.js: lapisan OOP untuk katalog TEKNOA.ID
   Dimuat SETELAH supabase-config.js (memakai KONDISI, KATEGORI, rupiah, namaLengkap)
   dan SEBELUM script.js (yang memakai kelas-kelas di sini).

   Enam konsep OOP, dan di mana tiap konsep dipakai oleh fitur website:

   1. OOP (class & object)  : Produk, LaptopBekas, LaptopBaru, KatalogToko.
                               Setiap kartu produk, detail produk, keranjang, dan pesan WhatsApp
                               memakai OBJEK Produk; filter Toko memakai objek KatalogToko.
   2. Inheritance (extends) : LaptopBekas extends Produk, LaptopBaru extends Produk.
   3. Constructor           : Produk.constructor(data) memvalidasi & mengisi data dari Supabase;
                               KatalogToko.constructor(klien, daftarKategori) menyiapkan filter.
   4. Encapsulation (#)     : data produk (#harga, #tersedia, #spek, ...) dan data katalog
                               (#semua, #klien, #urutanPermintaan) bersifat private; hanya bisa
                               diakses lewat getter/method.
   5. Overloading           : KatalogToko.ambil() menerima beberapa bentuk parameter:
                                 ambil()                         -> semua laptop
                                 ambil('gaming')                 -> satu kategori
                                 ambil({ kat:'gaming', tag:'promo' }) -> objek opsi
                                 ambil('gaming', 'promo')        -> kategori + label
                               (JavaScript tidak punya overloading bawaan, jadi disimulasikan
                               dengan memeriksa jumlah & tipe argumen.)
   6. Overriding            : LaptopBekas / LaptopBaru menimpa infoKondisi(), labelKondisi(),
                               dan pesanBeli() milik Produk.
   ===================================================================== */

/* ---------------------------------------------------------------------
   Kelas dasar: satu laptop di katalog
   --------------------------------------------------------------------- */
class Produk {
  /* Encapsulation: semua data disimpan di property private (#). Dari luar kelas hanya terbaca
     lewat getter di bawah; mengubah harga hanya lewat setter yang memvalidasi. */
  #id; #kategori; #merek; #seri; #harga; #hargaNormal; #tersedia;
  #tags; #galeri; #spek; #deskripsi; #kondisi;

  /* Constructor: menerima objek data (hasil dariDb) dan memastikan tiap nilai bertipe benar,
     sehingga bagian lain website tidak perlu memeriksa ulang. */
  constructor(data = {}) {
    this.#id = data.id;
    this.#kategori = String(data.kategori || '');
    this.#merek = String(data.merek || '');
    this.#seri = String(data.seri || '');
    this.#harga = Produk.#angka(data.harga);
    this.#hargaNormal = data.hargaNormal ? Produk.#angka(data.hargaNormal) : null;
    this.#tersedia = data.tersedia !== false;
    this.#tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
    this.#galeri = Array.isArray(data.galeri) && data.galeri.length ? data.galeri.map(String) : [window.FOTO_KOSONG];
    this.#spek = data.spek && typeof data.spek === 'object' ? { ...data.spek } : {};
    this.#deskripsi = String(data.deskripsi || '').trim();
    this.#kondisi = KONDISI[data.kondisi] ? data.kondisi : 'bekas';
  }

  static #angka(v) { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0; }

  /* ----- getter (hanya baca) ----- */
  get id() { return this.#id; }
  get kategori() { return this.#kategori; }
  get merek() { return this.#merek; }
  get seri() { return this.#seri; }
  get nama() { return `${this.#merek} ${this.#seri}`.trim(); }
  get hargaNormal() { return this.#hargaNormal; }
  get tersedia() { return this.#tersedia; }
  get deskripsi() { return this.#deskripsi; }
  get kondisi() { return this.#kondisi; }
  get foto() { return this.#galeri[0]; }
  get tags() { return [...this.#tags]; }          /* salinan: array asli tidak bisa diubah dari luar */
  get galeri() { return [...this.#galeri]; }
  get spek() { return { ...this.#spek }; }

  get harga() { return this.#harga; }
  set harga(nilai) {                               /* setter dengan validasi */
    const n = Number(nilai);
    if (!Number.isFinite(n) || n < 0) throw new RangeError('Harga harus berupa angka 0 atau lebih');
    this.#harga = n;
  }

  /* ----- method ----- */
  punyaTag(tag) { return this.#tags.includes(tag); }
  hemat() { return this.#hargaNormal && this.#hargaNormal > this.#harga ? this.#hargaNormal - this.#harga : 0; }
  /* Ringkasan satu baris di kartu produk: processor, RAM, storage */
  ringkasSpek() {
    const s = this.#spek;
    return [s.processor, s.ram && `RAM ${s.ram}`, s.storage].filter(Boolean).join(', ');
  }

  /* Method di bawah ini DITIMPA (override) oleh LaptopBekas dan LaptopBaru. */
  labelKondisi() { return this.infoKondisi().label; }
  infoKondisi() { return KONDISI.bekas; }
  pesanBeli() {
    return `Halo Laptop Makassar, saya ingin membeli:\n\n${this.nama}\nHarga: ${rupiah(this.#harga)}`
      + `\n\nMohon info ketersediaan unit dan cara pembayarannya. Terima kasih.`;
  }

  /* Pabrik objek: memilih kelas turunan yang tepat dari baris tabel produk di Supabase */
  static dariDb(r) {
    const urai = (v, awal) => {
      if (typeof v !== 'string') return v ?? awal;
      try { return JSON.parse(v); } catch { return awal; }
    };
    const tambahan = urai(r.foto_tambahan, []);
    const data = {
      id: r.id, kategori: r.kategori, merek: r.merek, seri: r.seri,
      harga: r.harga, hargaNormal: r.harganormal, tersedia: r.status !== 'tidak_tersedia',
      tags: urai(r.tags, []), spek: urai(r.spek, {}), deskripsi: r.deskripsi, kondisi: r.kondisi,
      galeri: [r.foto || window.FOTO_KOSONG,
        ...(Array.isArray(tambahan) ? tambahan.filter(u => typeof u === 'string' && /^https?:\/\//i.test(u)) : [])]
    };
    return r.kondisi === 'baru' ? new LaptopBaru(data) : new LaptopBekas(data);
  }
}

/* ---------------------------------------------------------------------
   Inheritance: laptop bekas dan laptop baru mewarisi semua milik Produk
   dan menimpa (override) perilaku yang berbeda.
   --------------------------------------------------------------------- */
class LaptopBekas extends Produk {
  constructor(data) { super({ ...data, kondisi: 'bekas' }); }
  infoKondisi() { return KONDISI.bekas; }                       /* override */
  pesanBeli() {                                                  /* override: tambah info kondisi & garansi */
    return `${super.pesanBeli()}\n\nKondisi: ${this.labelKondisi()} (${this.infoKondisi().garansi})`;
  }
}

class LaptopBaru extends Produk {
  constructor(data) { super({ ...data, kondisi: 'baru' }); }
  infoKondisi() { return KONDISI.baru; }                         /* override */
  pesanBeli() {                                                  /* override */
    return `${super.pesanBeli()}\n\nKondisi: ${this.labelKondisi()} (${this.infoKondisi().garansi})`;
  }
}

/* ---------------------------------------------------------------------
   KatalogToko: mengambil produk dari Supabase, termasuk filter kategori
   di halaman Toko. Semua pembacaan database lewat kelas ini.
   --------------------------------------------------------------------- */
class KatalogToko {
  #klien;                       /* klien Supabase */
  #kategoriSah;                 /* id kategori yang dikenal (dari KATEGORI) */
  #semua = [];                  /* semua produk terakhir yang dimuat */
  #urutanPermintaan = 0;        /* penanda permintaan terbaru: hasil permintaan lama diabaikan */

  /* Constructor: menerima klien Supabase dan daftar kategori yang dipakai filter */
  constructor(klien, daftarKategori = KATEGORI) {
    if (!klien || typeof klien.from !== 'function') throw new TypeError('KatalogToko butuh klien Supabase');
    this.#klien = klien;
    this.#kategoriSah = new Set(daftarKategori.map(k => k.id));
  }

  get semua() { return [...this.#semua]; }
  get kategori() { return [{ id: 'all', label: 'Semua Laptop' }, ...KATEGORI]; }
  labelKategori(id) { return (this.kategori.find(k => k.id === id) || {}).label || ''; }

  /* Method private: satu-satunya tempat yang bertanya ke tabel produk.
     kat = null -> semua laptop; kat = 'gaming' dst -> .eq('kategori', kat) di database. */
  async #tanya(kat) {
    const buat = urut => {
      let q = this.#klien.from('produk').select('*');
      if (kat) q = q.eq('kategori', kat);
      return urut === 'waktu' ? q.order('created_at', { ascending: false }) : q.order('id', { ascending: false });
    };
    /* Produk terbaru di depan. Jika kolom created_at belum ada, pakai id terbesar. */
    let r = await buat('waktu');
    if (r.error) r = await buat('id');
    if (r.error) throw r.error;
    return (r.data || []).map(Produk.dariDb);
  }

  /* Muat semua produk (untuk beranda, keranjang, dan detail produk) */
  async muatSemua() {
    this.#semua = await this.#tanya(null);
    return this.semua;
  }

  /* Overloading (disimulasikan): satu nama method, beberapa bentuk parameter.
       ambil()                              -> semua laptop
       ambil('gaming')                      -> satu kategori
       ambil({ kat: 'gaming', tag: 'promo' }) -> objek opsi (keduanya boleh kosong)
       ambil('gaming', 'promo')             -> kategori + label
     Pilihan 'all' / '' berarti semua laptop. Kategori yang tidak dikenal ditolak. */
  async ambil(...arg) {
    let kat = null, tag = null;
    if (arg.length === 0) { /* bentuk 1 */ }
    else if (arg.length === 1 && (typeof arg[0] === 'string' || arg[0] == null)) kat = arg[0];        /* bentuk 2 */
    else if (arg.length === 1 && typeof arg[0] === 'object') ({ kat = null, tag = null } = arg[0]);    /* bentuk 3 */
    else if (arg.length === 2 && typeof arg[0] === 'string') [kat, tag] = arg;                         /* bentuk 4 */
    else throw new TypeError('ambil(): kombinasi parameter tidak dikenali');

    if (kat === 'all' || kat === '') kat = null;
    if (kat && !this.#kategoriSah.has(kat)) throw new RangeError(`Kategori tidak dikenal: ${kat}`);

    const nomor = ++this.#urutanPermintaan;
    const data = await this.#tanya(kat);
    const hasil = tag ? data.filter(p => p.punyaTag(tag)) : data;
    return { data: hasil, basi: nomor !== this.#urutanPermintaan };   /* basi = sudah ada permintaan yang lebih baru */
  }
}
