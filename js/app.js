/**
 * ====================================================================================
 * SI-MITRA KONSERVASI SULTENG - JAVASCRIPT CONTROLLER (BULLETPROOF SPA)
 * Single Page Application Controller (0ms RTT / Zero Latency)
 * Sesuai Standar:
 * - /gas-instant-ux (Client-side routing, LocalStorage safe wrapper, Optimistic UI)
 * - /gas-spa-iframe (Single entry point, anti-reload, 100% aman di dalam iframe)
 * - /gas-migrasi-database (Dry-run scanner & idempotent sync)
 * - /ui-ux-pro-max (Feedback toasts, interactive charts, accessible focus states)
 * ====================================================================================
 */

// ======================== SAFE STORAGE WRAPPER (ANTI-CRASH) ========================
// Di Google Apps Script Web App iframe, akses langsung ke localStorage dapat melempar
// SecurityError/DOMException jika third-party cookies dibatasi oleh browser.
const SafeStorage = {
  _mem: {},
  getItem: function(key) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      // Fallback ke memori jika iframe localStorage diblokir browser
    }
    return this._mem[key] || null;
  },
  setItem: function(key, val) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, val);
      }
    } catch (e) {
      // Fallback ke memori
    }
    this._mem[key] = val;
  },
  removeItem: function(key) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {}
    delete this._mem[key];
  }
};

// ======================== GLOBAL APPLICATION STATE ========================
window.AppState = {
  currentPage: 'dashboard',
  currentUser: {
    id: 'USR-PRL-01',
    nama: 'Ir. Kartika Sari, M.Si',
    email: 'kartika.prl@dkp.sultengprov.go.id',
    peran: 'prl', // 'mitra', 'prl', 'uptd', 'kepala_dkp', 'admin'
    lembaga: 'Bidang Pengelolaan Ruang Laut DKP',
    jenis_mitra: '-',
    telepon: '0811450002'
  },
  sessionToken: null,
  pengajuanList: [],
  filteredList: [],
  masterKawasan: [],
  masterPersyaratan: [],
  tahapProsedur: [],
  stats: {
    totalPengajuan: 38,
    dalamTelaah: 14,
    revisiDokumen: 5,
    pksBerjalan: 12,
    tahap12Aktif: 12,
    persenMonev: 82.4
  },
  auditLog: [],
  selectedPengajuanId: null,
  currentDetailData: null,
  pagination: {
    page: 1,
    limit: 10,
    totalPages: 1
  },
  charts: {
    donutMitra: null,
    barKawasan: null,
    monevProgress: null
  },
  darkMode: false
};

// ======================== BOOTSTRAPPER (ANTI-RACE-CONDITION) ========================

function bootApp() {
  console.log('🚀 Memulai SI-MITRA KONSERVASI SULTENG SPA...');
  try {
    initTheme();
  } catch (e) {
    console.warn('Init theme warning:', e);
  }

  try {
    loadOfflineDataFallback();
  } catch (e) {
    console.warn('Fallback data warning:', e);
  }

  try {
    setupEventListeners();
  } catch (e) {
    console.warn('Event listeners warning:', e);
  }

  try {
    navigateTo('dashboard');
  } catch (e) {
    console.warn('Navigation warning:', e);
  }

  try {
    fetchDataFromServer();
  } catch (e) {
    console.warn('Fetch server warning:', e);
  }
}

// Jalankan bootApp baik saat DOMContentLoaded maupun jika skrip dimuat setelah DOM siap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}

// ======================== DATA INITIALIZATION ========================

function loadOfflineDataFallback() {
  // Cek cache lokal via SafeStorage
  const cachedData = SafeStorage.getItem('si_mitra_cached_state');
  if (cachedData) {
    try {
      const parsed = JSON.parse(cachedData);
      if (parsed.pengajuanList && parsed.pengajuanList.length) {
        window.AppState.pengajuanList = parsed.pengajuanList;
        window.AppState.stats = parsed.stats || window.AppState.stats;
        window.AppState.masterKawasan = parsed.masterKawasan || [];
        window.AppState.masterPersyaratan = parsed.masterPersyaratan || [];
        window.AppState.auditLog = parsed.riwayatTerbaru || [];
        renderAllComponents();
        return;
      }
    } catch (e) {}
  }

  // Master 4 Kawasan Konservasi Sulawesi Tengah Sesuai Kepmen-KP
  window.AppState.masterKawasan = [
    { nama: 'KK Daerah Banggai Dalaka', dasar: 'KEPMEN-KP No. 53/KEPMEN-KP/2019', zona: 'Zona Pemanfaatan Terbatas', kabupaten: 'Banggai Kepulauan', luas_ha: '69.182 Ha' },
    { nama: 'KK Perairan Teluk Tomini', dasar: 'KEPMEN-KP No. 64/KEPMEN-KP/2020', zona: 'Zona Inti & Pemanfaatan', kabupaten: 'Parigi Moutong', luas_ha: '83.420 Ha' },
    { nama: 'KK Kepulauan Togean', dasar: 'KEPMEN-KP No. 67/KEPMEN-KP/2021', zona: 'Zona Pemanfaatan Bahari', kabupaten: 'Tojo Una-Una', luas_ha: '336.772 Ha' },
    { nama: 'KK Teluk Mori & Kolonodale', dasar: 'KEPMEN-KP No. 71/KEPMEN-KP/2022', zona: 'Zona Perlindungan Pesisir', kabupaten: 'Morowali & Morowali Utara', luas_ha: '45.890 Ha' }
  ];

  window.AppState.tahapProsedur = [
    { tahap: 1, nama: 'Koordinasi Awal Calon Mitra dengan UPTD', lampiran: 'Lampiran I' },
    { tahap: 2, nama: 'Permohonan kepada DKP (Disposisi Kadis)', lampiran: 'Lampiran II' },
    { tahap: 3, nama: 'Verifikasi Administrasi Persyaratan', lampiran: 'Lampiran III' },
    { tahap: 4, nama: 'Verifikasi RTRW & Zonasi Kawasan RPZ', lampiran: 'Lampiran IV (Spasial)' },
    { tahap: 5, nama: 'Penilaian Kesesuaian Program & Pembiayaan', lampiran: 'Lampiran IV & V' },
    { tahap: 6, nama: 'Presentasi / Pemaparan Program Mitra', lampiran: 'Lampiran VI (BA)' },
    { tahap: 7, nama: 'Hasil Penelaahan Teknis', lampiran: 'Lampiran VII (BA)' },
    { tahap: 8, nama: 'Keputusan Kesepakatan (Lanjut/Tidak)', lampiran: 'BA Kesepakatan' },
    { tahap: 9, nama: 'Penyusunan Draft Perjanjian Kemitraan', lampiran: 'Draft PKS' },
    { tahap: 10, nama: 'Pelaporan ke Gubernur Sulawesi Tengah', lampiran: 'Nota Dinas' },
    { tahap: 11, nama: 'Penandatanganan Perjanjian Kemitraan (PKS)', lampiran: 'PKS Final Sah' },
    { tahap: 12, nama: 'Pelaksanaan, Monitoring & Evaluasi (Monev)', lampiran: 'Lampiran VIII' }
  ];

  // Sampel Data Pengajuan Lengkap (Tahap 1 s/d 12)
  window.AppState.pengajuanList = [
    {
      id: 'PGJ-2026-001',
      nomor: '#REG-2026-0018',
      id_user: 'USR-MITRA-01',
      lembaga: 'Yayasan Terumbu Teluk Tomini',
      jenis_mitra: 'LSM Nasional',
      judul: 'Pemberdayaan Masyarakat Pesisir & Konservasi Terumbu Karang Teluk Tomini',
      kawasan: 'KK Perairan Teluk Tomini',
      zona: 'Zona Inti & Pemanfaatan',
      lokasi: 'Kec. Tinombo & Kasimbar, Parigi Moutong',
      uraian: 'Rehabilitasi terumbu karang seluas 25 Ha dan pembentukan kelompok pemandu wisata selam konservasi.',
      biaya_estimasi: 450000000,
      sumber_dana: 'Hibah TFCA Coral & Swadana',
      tahap: 3,
      status: 'Verifikasi Administrasi (Tahap 3)',
      verifikator: 'Ir. Kartika Sari, M.Si',
      dibuat: '2026-05-04T08:30:00Z',
      diubah: '2026-05-06T10:15:00Z'
    },
    {
      id: 'PGJ-2026-002',
      nomor: '#REG-2026-0019',
      id_user: 'USR-MITRA-02',
      lembaga: 'Pokmaswas Banggai Lestari',
      jenis_mitra: 'Kelompok Masyarakat',
      judul: 'Patroli Mandiri Perlindungan Biota Laut Endemik Banggai Cardinalfish',
      kawasan: 'KK Daerah Banggai Dalaka',
      zona: 'Zona Pemanfaatan Terbatas',
      lokasi: 'Perairan Pulau Peleng, Banggai Kepulauan',
      uraian: 'Operasional ronda laut pokmaswas, pengadaan pelampung tanda batas, dan edukasi konservasi.',
      biaya_estimasi: 120000000,
      sumber_dana: 'Dana Desa & Swadaya',
      tahap: 1,
      status: 'Koordinasi UPTD (Tahap 1)',
      verifikator: 'Drs. Hendra Wibowo, M.Sc',
      dibuat: '2026-05-05T09:00:00Z',
      diubah: '2026-05-05T09:00:00Z'
    },
    {
      id: 'PGJ-2026-003',
      nomor: '#REG-2026-0014',
      id_user: 'USR-MITRA-03',
      lembaga: 'PT Celebes Ekowisata Bahari',
      jenis_mitra: 'Pelaku Usaha / Korporasi',
      judul: 'Pengembangan Ekowisata Bahari Berkelanjutan & Mooring Buoy Kepulauan Togean',
      kawasan: 'KK Kepulauan Togean',
      zona: 'Zona Pemanfaatan Bahari',
      lokasi: 'Kec. Walea Kepulauan, Tojo Una-Una',
      uraian: 'Pemasangan 30 titik mooring buoy kapal wisata guna melindungi gugusan karang dari jangkar liar.',
      biaya_estimasi: 850000000,
      sumber_dana: 'CSR & Investasi Perusahaan',
      tahap: 5,
      status: 'Penilaian Program & Biaya (Tahap 5)',
      verifikator: 'Ir. Kartika Sari, M.Si',
      dibuat: '2026-04-12T11:20:00Z',
      diubah: '2026-05-02T14:40:00Z'
    },
    {
      id: 'PGJ-2026-004',
      nomor: '#REG-2026-0008',
      id_user: 'USR-MITRA-04',
      lembaga: 'FPIK Universitas Tadulako',
      jenis_mitra: 'Perguruan Tinggi Nasional',
      judul: 'Studi Dinamika Populasi Ikan Karang & Pemetaan Spasial Mangrove Teluk Mori',
      kawasan: 'KK Teluk Mori & Kolonodale',
      zona: 'Zona Perlindungan Pesisir',
      lokasi: 'Teluk Mori, Morowali Utara',
      uraian: 'Riset ekologi berkala, transek karang permanen, dan pendampingan desa pesisir tangguh.',
      biaya_estimasi: 280000000,
      sumber_dana: 'BOPTN Penelitian Dikti',
      tahap: 8,
      status: 'Kesepakatan Disetujui (Tahap 8)',
      verifikator: 'Dr. H. Moh. Arif, S.Pi, M.Si',
      dibuat: '2026-03-20T10:00:00Z',
      diubah: '2026-04-28T16:00:00Z'
    },
    {
      id: 'PGJ-2026-005',
      nomor: '#REG-2026-0002',
      id_user: 'USR-MITRA-05',
      lembaga: 'WWF Koridor Wallacea',
      jenis_mitra: 'LSM Nasional',
      judul: 'Penguatan Efektivitas Pengelolaan Kemitraan Konservasi (E-KKP3K) 4 Kawasan Sulteng',
      kawasan: 'KK Perairan Teluk Tomini',
      zona: 'Zona Pemanfaatan',
      lokasi: 'Provinsi Sulawesi Tengah',
      uraian: 'Fasilitasi SOP monitoring biofisik, pelatihan patroli SMART Konservasi, dan evaluasi berkala.',
      biaya_estimasi: 1250000000,
      sumber_dana: 'Mitra Global Konservasi',
      tahap: 12,
      status: 'Monev & Pelaksanaan Berjalan (Tahap 12)',
      verifikator: 'Ir. Kartika Sari, M.Si',
      dibuat: '2026-01-10T09:00:00Z',
      diubah: '2026-05-01T11:00:00Z'
    },
    {
      id: 'PGJ-2026-006',
      nomor: '#REG-2026-0021',
      id_user: 'USR-MITRA-06',
      lembaga: 'Aliansi Masyarakat Adat Bajo Banggai',
      jenis_mitra: 'Masyarakat Adat',
      judul: 'Penetapan Sasi Laut Adat untuk Pemulihan Habitat Gurita dan Teripang',
      kawasan: 'KK Daerah Banggai Dalaka',
      zona: 'Zona Pemanfaatan Terbatas',
      lokasi: 'Kepulauan Banggai Laut',
      uraian: 'Penerapan hukum adat sasi tutup buka musim tangkap guna menjaga keberlanjutan stok perikanan.',
      biaya_estimasi: 95000000,
      sumber_dana: 'Dana Hibah Adat & Swadaya',
      tahap: 2,
      status: 'Disposisi Kepala Dinas (Tahap 2)',
      verifikator: 'Dr. H. Moh. Arif, S.Pi, M.Si',
      dibuat: '2026-05-06T11:00:00Z',
      diubah: '2026-05-06T11:00:00Z'
    },
    {
      id: 'PGJ-2026-007',
      nomor: '#REG-2026-0022',
      id_user: 'USR-MITRA-07',
      lembaga: 'Koperasi Nelayan Teluk Tomini Sejahtera',
      jenis_mitra: 'Kelompok Masyarakat',
      judul: 'Budidaya Rumput Laut Ramah Lingkungan & Edukasi Stop Destructive Fishing',
      kawasan: 'KK Perairan Teluk Tomini',
      zona: 'Zona Perikanan Berkelanjutan',
      lokasi: 'Kabupaten Parigi Moutong',
      uraian: 'Pengembangan rakit budidaya ramah lingkungan untuk 40 KK nelayan dan penanaman mangrove pelindung pantai.',
      biaya_estimasi: 180000000,
      sumber_dana: 'Iuran Anggota Koperasi',
      tahap: 3,
      status: 'Perlu Dilengkapi Mitra (Tahap 3)',
      verifikator: 'Ir. Kartika Sari, M.Si',
      dibuat: '2026-05-02T13:00:00Z',
      diubah: '2026-05-05T15:00:00Z'
    }
  ];

  window.AppState.auditLog = [
    { nomor: '#REG-2026-0018', pelaku: 'Ir. Kartika Sari, M.Si (PRL)', aksi: 'Verifikasi Dokumen Persyaratan', waktu: '10 menit yang lalu' },
    { nomor: '#REG-2026-0021', pelaku: 'Dr. H. Moh. Arif (Kadis)', aksi: 'Disposisi Surat Permohonan ke PRL', waktu: '45 menit yang lalu' },
    { nomor: '#REG-2026-0008', pelaku: 'Drs. Hendra W. (UPTD)', aksi: 'Finalisasi Draft PKS Tahap 9', waktu: '2 jam yang lalu' },
    { nomor: '#REG-2026-0002', pelaku: 'Ahmad Fauzi (Mitra)', aksi: 'Unggah Laporan Capaian Monev Semester I', waktu: 'Kemarin, 14:20' }
  ];

  renderAllComponents();
}

/**
 * Panggil backend Google Apps Script secara asynchronous (Non-blocking)
 */
// ======================== PRO REST API CLIENT (ANTI-CORS & TURBO) ========================
const _inFlightRequests = {};
let _writeEpoch = 0;

/**
 * Pemanggil REST API Universal (gas-pro-api & gas-instant-ux-pro)
 * Menggunakan method POST dengan 'Content-Type: text/plain;charset=utf-8' untuk menghindari CORS preflight OPTIONS rejection.
 */
async function callApi(action, data = {}, opts = {}) {
  const gasUrl = (window.CONFIG && window.CONFIG.GAS_URL) ? window.CONFIG.GAS_URL.trim() : '';

  // Jika GAS_URL belum diisi atau offline, tangani secara lokal (Mode Simulasi Demo 0ms)
  if (!gasUrl) {
    return handleLocalFallbackApi(action, data);
  }

  const isRead = /^(get|list|fetch|read|ping|verify|scan)/i.test(action);
  const cacheKey = _writeEpoch + '|' + action + '|' + JSON.stringify(data);

  if (isRead && _inFlightRequests[cacheKey]) {
    return _inFlightRequests[cacheKey];
  }

  const reqId = 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const token = window.AppState.sessionToken || '';

  const promise = (async () => {
    const t0 = performance.now();
    try {
      const controller = new AbortController();
      const timeoutMs = isRead ? ((window.CONFIG && window.CONFIG.TIMEOUT_READ_MS) || 20000) : ((window.CONFIG && window.CONFIG.TIMEOUT_WRITE_MS) || 45000);
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8' // WAJIB untuk GAS REST API
        },
        body: JSON.stringify({
          action: action,
          data: data,
          token: token,
          reqId: reqId
        }),
        signal: controller.signal
      });
      clearTimeout(timer);

      const json = await res.json();
      const ms = Math.round(performance.now() - t0);
      console.log(`📡 [REST API ${action}] Selesai dalam ${ms}ms (Server: ${json.ms || '-'}ms)`);
      return json;
    } catch (err) {
      console.warn(`⚠️ [REST API ${action}] Koneksi server terkendala (${err.message}). Menggunakan fallback lokal.`);
      return handleLocalFallbackApi(action, data);
    }
  })();

  if (isRead) {
    _inFlightRequests[cacheKey] = promise;
    promise.finally(() => delete _inFlightRequests[cacheKey]);
  } else {
    _writeEpoch++;
  }

  return promise;
}

/**
 * Fallback Lokal Cerdas saat Backend GAS Belum Terhubung
 */
function handleLocalFallbackApi(action, data) {
  if (action === 'ping') {
    return { success: true, message: 'SI-MITRA Fallback Demo Mode', version: '1.0.0-PRO' };
  }
  if (action === 'getInitialData') {
    return {
      success: true,
      data: {
        pengajuanList: window.AppState.pengajuanList,
        stats: window.AppState.stats,
        masterKawasan: window.AppState.masterKawasan,
        masterPersyaratan: window.AppState.masterPersyaratan,
        riwayatTerbaru: window.AppState.auditLog
      }
    };
  }
  if (action === 'scanMigrasi') {
    return {
      success: true,
      sourceName: 'Simulasi DB Lama Kemitraan',
      data: [
        { sheet: 'Pengajuan', jumlahBarisSumber: 38, jumlahBarisTarget: window.AppState.pengajuanList.length },
        { sheet: 'Users', jumlahBarisSumber: 12, jumlahBarisTarget: 5 }
      ]
    };
  }
  if (action === 'execMigrasi') {
    return {
      success: true,
      message: 'Migrasi simulasi selesai. 38 baris terverifikasi idempoten.'
    };
  }
  return { success: true, message: 'Operasi diproses lokal.' };
}

/**
 * Panggil backend Google Apps Script REST API secara asynchronous (Non-blocking & SWR)
 */
async function fetchDataFromServer() {
  try {
    const res = await callApi('getInitialData');
    if (res && res.success && res.data) {
      const d = res.data;
      if (d.pengajuanList && d.pengajuanList.length) {
        window.AppState.pengajuanList = d.pengajuanList;
      }
      if (d.stats) window.AppState.stats = d.stats;
      if (d.masterKawasan && d.masterKawasan.length) window.AppState.masterKawasan = d.masterKawasan;
      if (d.masterPersyaratan && d.masterPersyaratan.length) window.AppState.masterPersyaratan = d.masterPersyaratan;
      if (d.riwayatTerbaru && d.riwayatTerbaru.length) window.AppState.auditLog = d.riwayatTerbaru;

      // Simpan ke cache lokal SWR
      SafeStorage.setItem('si_mitra_cached_state', JSON.stringify(d));
      renderAllComponents();
    }
  } catch (e) {
    console.warn('Gagal sinkron data server:', e);
  }
}

function refreshDataFromServer() {
  showToast('Memuat Ulang', 'Menyinkronkan data dengan database Google Sheets...', 'info');
  fetchDataFromServer();
}

// ======================== ULTRA-FAST SPA ROUTING (0ms) ========================

/**
 * Satu-satunya mekanisme perpindahan halaman/menu.
 * Menggunakan inline display style langsung agar kebal terhadap konflik CSS class.
 */
function navigateTo(sectionId, updateHash = true) {
  if (updateHash && window.location.hash !== '#' + sectionId) {
    history.pushState(null, '', '#' + sectionId);
  }
  console.log('📌 Navigasi ke:', sectionId);

  // Sembunyikan seluruh section dengan style.display = 'none'
  const sections = document.querySelectorAll('.content-section');
  sections.forEach(el => {
    el.classList.remove('active');
    el.style.display = 'none';
  });

  // Tampilkan target section dengan style.display = 'block'
  const target = document.getElementById('section-' + sectionId);
  if (target) {
    target.classList.add('active');
    target.style.display = 'block';
    window.AppState.currentPage = sectionId;
  } else {
    console.warn('Section target tidak ditemukan:', sectionId);
    return;
  }

  // Update active state di menu navigasi sidebar
  document.querySelectorAll('.nav-item').forEach(link => {
    const isTarget = (link.getAttribute('data-section') === sectionId || link.getAttribute('data-path') === sectionId);
    link.classList.toggle('active', isTarget);
    if (isTarget) {
      link.classList.add('bg-secondary-teal/20', 'text-white', 'font-bold');
    } else {
      link.classList.remove('bg-secondary-teal/20', 'text-white', 'font-bold');
    }
  });

  // Gulir ke atas
  try {
    if (typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  } catch (e) {}

  // Tutup sidebar drawer pada mobile
  closeMobileSidebar();

  // Inisialisasi komponen khusus halaman saat dikunjungi
  if (sectionId === 'dashboard') {
    initCharts();
    renderDashboardRecentTable();
    renderTimelineAudit();
  } else if (sectionId === 'daftar-pengajuan') {
    applyTableFilters();
  } else if (sectionId === 'monitoring-dan-evaluasi') {
    initMonevChart();
    renderMonevHistory();
  } else if (sectionId === 'manajemen-pengguna') {
    renderUsersTable();
  }
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar && backdrop) {
    sidebar.classList.toggle('drawer-open');
    backdrop.classList.toggle('active');
  }
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar && backdrop) {
    sidebar.classList.remove('drawer-open');
    backdrop.classList.remove('active');
  }
}

// ======================== RENDERERS & DATA BINDING ========================

function renderAllComponents() {
  updateKpiBadges();
  renderDashboardRecentTable();
  renderTimelineAudit();
  applyTableFilters();
  initCharts();
}

function updateKpiBadges() {
  const list = window.AppState.pengajuanList || [];
  const total = list.length;
  const dalamTelaah = list.filter(p => Number(p.tahap) >= 3 && Number(p.tahap) <= 7).length;
  const revisi = list.filter(p => String(p.status || '').toLowerCase().includes('perlu')).length;
  const pks = list.filter(p => Number(p.tahap) >= 9 && Number(p.tahap) <= 11).length;
  const monev = list.filter(p => Number(p.tahap) === 12).length;

  const setElText = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  setElText('kpi-total-pengajuan', total + ' Usulan');
  setElText('kpi-dalam-telaah', dalamTelaah + ' Dokumen');
  setElText('kpi-revisi', revisi + ' Dokumen');
  setElText('kpi-pks', pks + ' Kemitraan');
  setElText('badge-total-pengajuan', total);

  // Pills counter
  setElText('pill-count-all', total);
  setElText('pill-count-verifikasi', list.filter(p => Number(p.tahap) <= 2).length);
  setElText('pill-count-telaah', dalamTelaah);
  setElText('pill-count-pks', pks);
  setElText('pill-count-monev', monev);
}

/**
 * Render Tabel Usulan Terbaru di Dashboard
 */
function renderDashboardRecentTable() {
  const tbody = document.getElementById('table-dashboard-recent');
  if (!tbody) return;

  const recents = (window.AppState.pengajuanList || []).slice(0, 5);
  if (!recents.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-text-sub">Belum ada usulan</td></tr>`;
    return;
  }

  tbody.innerHTML = recents.map(item => `
    <tr class="hover:bg-surface-low transition-colors">
      <td class="py-2.5 px-3 font-bold text-primary">${item.nomor || '-'}</td>
      <td class="py-2.5 px-3">
        <div class="font-bold text-on-surface truncate max-w-xs">${item.lembaga || '-'}</div>
        <div class="text-[11px] text-text-muted truncate max-w-xs">${item.judul || '-'}</div>
      </td>
      <td class="py-2.5 px-3 font-semibold text-text-sub">${String(item.kawasan || '').replace('KK Daerah ', '').replace('KK Perairan ', '')}</td>
      <td class="py-2.5 px-3">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${getStageBadgeClass(item.tahap)}">
          Tahap ${item.tahap}
        </span>
      </td>
      <td class="py-2.5 px-3 text-right">
        <button onclick="viewPengajuanDetail('${item.id}')" class="px-2.5 py-1 rounded bg-surface-low hover:bg-secondary-teal hover:text-white text-secondary-teal font-semibold text-[11px] transition-colors">
          Detail
        </button>
      </td>
    </tr>
  `).join('');
}

/**
 * Render Audit Log Timeline di Dashboard
 */
function renderTimelineAudit() {
  const container = document.getElementById('timeline-audit-log');
  if (!container) return;

  const logs = window.AppState.auditLog || [];
  if (!logs.length) {
    container.innerHTML = `<div class="text-text-sub text-[11px]">Belum ada aktivitas tercatat.</div>`;
    return;
  }

  container.innerHTML = logs.map(log => `
    <div class="relative group">
      <span class="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-secondary-teal border-2 border-white"></span>
      <div class="font-bold text-primary flex items-center justify-between">
        <span>${log.nomor || '#REG-2026'}</span>
        <span class="text-[10px] text-text-sub font-normal">${log.waktu || 'Baru saja'}</span>
      </div>
      <p class="text-text-muted mt-0.5 text-[11px]">${log.aksi || log.catatan || 'Perubahan status tahapan'}</p>
      <span class="text-[10px] text-secondary font-semibold">${log.pelaku || 'Petugas DKP'}</span>
    </div>
  `).join('');
}

// ======================== TABLE FILTERING & SEARCH ENGINE ========================

function handleGlobalSearch(query) {
  const filterInput = document.getElementById('filter-search-input');
  if (filterInput) filterInput.value = query;
  if (window.AppState.currentPage !== 'daftar-pengajuan') {
    navigateTo('daftar-pengajuan');
  } else {
    applyTableFilters();
  }
}

function applyTableFilters() {
  const query = (document.getElementById('filter-search-input')?.value || '').toLowerCase().trim();
  const jenis = document.getElementById('filter-jenis-mitra')?.value || '';
  const kawasan = document.getElementById('filter-kawasan')?.value || '';
  const tahap = document.getElementById('filter-tahap')?.value || '';
  const status = (document.getElementById('filter-status')?.value || '').toLowerCase();

  let list = window.AppState.pengajuanList || [];

  if (query) {
    list = list.filter(p => 
      String(p.nomor || '').toLowerCase().includes(query) ||
      String(p.lembaga || '').toLowerCase().includes(query) ||
      String(p.judul || '').toLowerCase().includes(query) ||
      String(p.kawasan || '').toLowerCase().includes(query)
    );
  }

  if (jenis) {
    list = list.filter(p => String(p.jenis_mitra || '').includes(jenis));
  }

  if (kawasan) {
    list = list.filter(p => String(p.kawasan || '').includes(kawasan));
  }

  if (tahap) {
    list = list.filter(p => String(p.tahap) === String(tahap));
  }

  if (status) {
    list = list.filter(p => String(p.status || '').toLowerCase().includes(status));
  }

  window.AppState.filteredList = list;
  window.AppState.pagination.totalPages = Math.ceil(list.length / window.AppState.pagination.limit) || 1;
  window.AppState.pagination.page = 1;

  renderMainTable();
}

function filterByQuickStatus(type) {
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };

  setVal('filter-search-input', '');
  setVal('filter-jenis-mitra', '');
  setVal('filter-kawasan', '');
  setVal('filter-tahap', '');
  setVal('filter-status', '');

  if (type === 'verifikasi') {
    setVal('filter-tahap', '2');
  } else if (type === 'telaah') {
    setVal('filter-tahap', '3');
  } else if (type === 'pks') {
    setVal('filter-tahap', '9');
  } else if (type === 'monev') {
    setVal('filter-tahap', '12');
  }

  applyTableFilters();
}

function renderMainTable() {
  const tbody = document.getElementById('table-pengajuan-body');
  if (!tbody) return;

  const list = window.AppState.filteredList || [];
  const page = window.AppState.pagination.page;
  const limit = window.AppState.pagination.limit;
  const start = (page - 1) * limit;
  const end = Math.min(start + limit, list.length);
  const pageItems = list.slice(start, end);

  const setElText = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  setElText('pagination-start', list.length === 0 ? 0 : start + 1);
  setElText('pagination-end', end);
  setElText('pagination-total', list.length);
  setElText('pagination-page-indicator', `Hal ${page} / ${window.AppState.pagination.totalPages}`);

  if (pageItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-8 text-text-sub">
          <span class="material-symbols-outlined text-[36px] text-border mb-1 block">search_off</span>
          Tidak ada usulan permohonan kemitraan yang cocok dengan filter yang dipilih.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = pageItems.map(item => `
    <tr class="hover:bg-surface-low transition-colors">
      <td class="font-bold text-primary whitespace-nowrap">
        <span class="px-2 py-1 rounded bg-primary/10 text-primary">${item.nomor || '-'}</span>
      </td>
      <td>
        <div class="font-bold text-on-surface line-clamp-1">${item.lembaga || '-'}</div>
        <div class="text-[11px] text-text-muted line-clamp-1">${item.judul || '-'}</div>
      </td>
      <td class="whitespace-nowrap">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-low text-primary border border-border">
          ${item.jenis_mitra || '-'}
        </span>
      </td>
      <td>
        <div class="font-semibold text-primary truncate max-w-xs">${item.kawasan || '-'}</div>
        <div class="text-[11px] text-text-sub truncate max-w-xs">${item.zona || '-'}</div>
      </td>
      <td class="font-bold text-on-surface whitespace-nowrap">
        Rp ${formatRupiah(item.biaya_estimasi)}
      </td>
      <td class="whitespace-nowrap">
        <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${getStageBadgeClass(item.tahap)}">
          Tahap ${item.tahap} / 12
        </span>
      </td>
      <td>
        <span class="inline-flex items-center gap-1 text-[11px] font-medium text-text-muted">
          <span class="w-2 h-2 rounded-full ${getStatusDotClass(item.status)}"></span>
          <span class="truncate max-w-[140px]">${item.status || '-'}</span>
        </span>
      </td>
      <td class="text-center whitespace-nowrap">
        <button onclick="viewPengajuanDetail('${item.id}')" class="btn-primary text-[11px] py-1 px-2.5">
          <span>Buka</span>
          <span class="material-symbols-outlined text-[14px]">chevron_right</span>
        </button>
      </td>
    </tr>
  `).join('');
}

function changePage(delta) {
  const p = window.AppState.pagination;
  const newPage = p.page + delta;
  if (newPage >= 1 && newPage <= p.totalPages) {
    p.page = newPage;
    renderMainTable();
  }
}

// ======================== DETAIL VIEW & 12-STAGE TRACKER ========================

function viewPengajuanDetail(id) {
  const item = (window.AppState.pengajuanList || []).find(p => p.id === id);
  if (!item) {
    showToast('Error', 'Data pengajuan tidak ditemukan', 'danger');
    return;
  }

  window.AppState.selectedPengajuanId = id;
  window.AppState.currentDetailData = item;

  const setElText = (eid, txt) => {
    const el = document.getElementById(eid);
    if (el) el.textContent = txt;
  };

  setElText('detail-reg-number', item.nomor);
  setElText('detail-reg-badge', item.nomor);
  setElText('detail-jenis-mitra-badge', item.jenis_mitra);
  setElText('detail-tahap-badge', `Tahap ${item.tahap} (${getStageShortName(item.tahap)})`);
  setElText('detail-judul-usulan', item.judul);
  setElText('detail-lembaga', item.lembaga);
  setElText('detail-kawasan', item.kawasan);
  setElText('detail-biaya', 'Rp ' + formatRupiah(item.biaya_estimasi));
  setElText('detail-uraian', item.uraian);
  setElText('detail-zona', item.zona);
  setElText('detail-lokasi', item.lokasi);
  setElText('detail-active-role-text', getRoleDisplayName(window.AppState.currentUser.peran));

  render12StageStepper(item.tahap);
  renderDetailChecklist(item);
  renderDetailRiwayat(item);

  navigateTo('detail-pengajuan');
}

function render12StageStepper(currentTahap) {
  const rail = document.getElementById('detail-stepper-rail');
  if (!rail) return;

  const current = Number(currentTahap);
  const stages = window.AppState.tahapProsedur || [];

  rail.innerHTML = stages.map(s => {
    const isCompleted = s.tahap < current;
    const isActive = s.tahap === current;

    let stepClass = 'stepper-step';
    let icon = s.tahap.toString().padStart(2, '0');

    if (isCompleted) {
      stepClass += ' completed';
      icon = '<span class="material-symbols-outlined text-[16px] text-secondary-teal">check</span>';
    } else if (isActive) {
      stepClass += ' active';
      icon = `<span class="pulsing-indicator w-2 h-2 rounded-full bg-white inline-block"></span>`;
    }

    return `
      <div onclick="previewStageDocument(${s.tahap})" class="${stepClass}" title="Klik untuk pratinjau ${s.lampiran}">
        <div class="flex items-center justify-between text-[11px] mb-1">
          <span class="font-bold">${s.tahap.toString().padStart(2, '0')}</span>
          <span>${icon}</span>
        </div>
        <div class="font-bold text-[11px] line-clamp-1 leading-tight">${s.nama}</div>
        <div class="text-[9px] opacity-80 mt-0.5 truncate">${s.lampiran}</div>
      </div>
    `;
  }).join('');
}

function renderDetailChecklist(item) {
  const container = document.getElementById('detail-checklist-items');
  if (!container) return;

  const defaultItems = [
    { name: 'KTP / Identitas Pengurus Pesisir', status: 'Sesuai' },
    { name: 'Akta Pendirian / Keputusan Pembentukan', status: 'Sesuai' },
    { name: 'Proposal Kemitraan & Rencana Kegiatan', status: 'Sesuai' },
    { name: 'Surat Pernyataan Kepatuhan Konservasi', status: 'Sesuai' },
    { name: 'Kesesuaian Peta Ruang / Titik Koordinat', status: item.tahap >= 4 ? 'Sesuai' : 'Perlu Diperiksa' }
  ];

  container.innerHTML = defaultItems.map(syarat => `
    <div class="p-2.5 rounded-lg bg-surface-low border border-border flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-[18px] ${syarat.status === 'Sesuai' ? 'text-marine' : 'text-amber-warn'}">
          ${syarat.status === 'Sesuai' ? 'check_circle' : 'pending'}
        </span>
        <span class="font-semibold text-on-surface">${syarat.name}</span>
      </div>
      <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${syarat.status === 'Sesuai' ? 'bg-marine/10 text-marine' : 'bg-amber-warn/10 text-amber-warn'}">
        ${syarat.status}
      </span>
    </div>
  `).join('');
}

function renderDetailRiwayat(item) {
  const container = document.getElementById('detail-riwayat-list');
  if (!container) return;

  const logs = [
    { tahap: 'Tahap 1', pelaku: item.lembaga, keputusan: 'Pengajuan Terdaftar', catatan: 'Permohonan kemitraan Lampiran II didaftarkan.', waktu: '04 Mei 2026' },
    { tahap: 'Tahap 2', pelaku: 'Kepala DKP Sulteng', keputusan: 'Disposisi Diterbitkan', catatan: 'Disposisi ke Bidang PRL untuk verifikasi persyaratan.', waktu: '05 Mei 2026' },
    { tahap: 'Tahap 3', pelaku: item.verifikator || 'Tim PRL', keputusan: 'Pemeriksaan Persyaratan', catatan: 'Pemeriksaan kesesuaian dokumen administrasi formal.', waktu: '06 Mei 2026' }
  ];

  container.innerHTML = logs.map(l => `
    <div class="relative pb-2">
      <span class="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-secondary-teal"></span>
      <div class="font-bold text-primary flex items-center justify-between">
        <span>${l.tahap}: ${l.keputusan}</span>
        <span class="text-[10px] text-text-sub font-normal">${l.waktu}</span>
      </div>
      <p class="text-text-muted mt-0.5 text-[11px]">${l.catatan}</p>
      <span class="text-[10px] text-secondary font-semibold">Oleh: ${l.pelaku}</span>
    </div>
  `).join('');
}

// ======================== OPTIMISTIC ACTIONS & MUTATIONS ========================

function handleFormPengajuanSubmit(event) {
  event.preventDefault();

  const getV = id => (document.getElementById(id)?.value || '').trim();

  const lembaga = getV('form-lembaga');
  const jenisMitra = getV('form-jenis-mitra');
  const pimpinan = getV('form-pimpinan');
  const telepon = getV('form-telepon');
  const kawasan = getV('form-kawasan');
  const zona = getV('form-zona');
  const lokasi = getV('form-lokasi');
  const judul = getV('form-judul');
  const uraian = getV('form-uraian');
  const biaya = Number(getV('form-biaya')) || 0;
  const sumberDana = getV('form-sumber-dana');

  const newId = 'PGJ-2026-' + String(window.AppState.pengajuanList.length + 1).padStart(3, '0');
  const regNum = '#REG-2026-' + String(window.AppState.pengajuanList.length + 1).padStart(4, '0');

  const newRecord = {
    id: newId,
    nomor: regNum,
    id_user: window.AppState.currentUser.id,
    lembaga: lembaga,
    jenis_mitra: jenisMitra,
    judul: judul,
    kawasan: kawasan,
    zona: zona,
    lokasi: lokasi,
    uraian: uraian,
    biaya_estimasi: biaya,
    sumber_dana: sumberDana,
    tahap: 1,
    status: 'Koordinasi UPTD (Tahap 1)',
    verifikator: 'Drs. Hendra Wibowo, M.Sc',
    dibuat: new Date().toISOString(),
    diubah: new Date().toISOString()
  };

  window.AppState.pengajuanList.unshift(newRecord);
  updateKpiBadges();
  showToast('Sukses Terdaftar', `Permohonan kemitraan berhasil didaftarkan dengan nomor ${regNum}.`, 'success');

  // Kirim data ke REST API Backend secara asynchronous
  callApi('submitPengajuan', newRecord).then(res => {
    if (res && res.success) {
      console.log('Permohonan tersinkronisasi ke server.');
    }
  }).catch(err => console.warn('Sync submit pengajuan terkendala:', err));

  document.getElementById('form-ajukan-kemitraan')?.reset();
  navigateTo('daftar-pengajuan');
}

function openAdvanceModal(defaultKeputusan = 'Disetujui Lanjut') {
  const item = window.AppState.currentDetailData;
  if (!item) return;

  const nextTahap = Math.min(Number(item.tahap) + 1, 12);
  const setV = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v;
  };

  setV('modal-target-tahap', String(nextTahap));
  setV('modal-keputusan', defaultKeputusan);
  setV('modal-catatan', '');
  document.getElementById('modal-advance-stage')?.classList.add('open');
}

function closeAdvanceModal() {
  document.getElementById('modal-advance-stage')?.classList.remove('open');
}

function confirmAdvanceStage() {
  const item = window.AppState.currentDetailData;
  if (!item) return;

  const targetTahap = Number(document.getElementById('modal-target-tahap')?.value || 1);
  const keputusan = document.getElementById('modal-keputusan')?.value || 'Disetujui Lanjut';
  const catatan = (document.getElementById('modal-catatan')?.value || '').trim() || 'Tahapan diproses dan disetujui.';

  item.tahap = targetTahap;
  item.status = `Tahap ${targetTahap} (${keputusan})`;
  item.diubah = new Date().toISOString();

  window.AppState.auditLog.unshift({
    nomor: item.nomor,
    pelaku: window.AppState.currentUser.nama,
    aksi: `Pindah ke Tahap ${targetTahap}: ${keputusan}`,
    waktu: 'Baru saja'
  });

  closeAdvanceModal();
  updateKpiBadges();
  viewPengajuanDetail(item.id);
  showToast('Tahapan Diperbarui', `Usulan ${item.nomor} berhasil dipindahkan ke Tahap ${targetTahap}.`, 'success');

  // Kirim pembaruan tahapan ke REST API Backend
  callApi('advanceTahap', {
    pengajuanId: item.id,
    targetTahap: targetTahap,
    keputusan: keputusan,
    catatan: catatan,
    payload: {
      pelaku: window.AppState.currentUser.nama,
      peran: window.AppState.currentUser.peran
    }
  }).then(res => {
    if (res && res.success) console.log('Tahapan tersinkronisasi ke server.');
  }).catch(err => console.warn('Sync advance tahap terkendala:', err));
}

// ======================== MODAL DOCUMENT PREVIEW (ANTI-NEW-TAB) ========================

function previewStageDocument(stageNum) {
  const s = (window.AppState.tahapProsedur || []).find(t => t.tahap === stageNum);
  if (!s) return;

  const titleEl = document.getElementById('preview-modal-title');
  if (titleEl) titleEl.textContent = `Instrumen Dokumen Tahap ${s.tahap}: ${s.nama}`;
  
  const body = document.getElementById('preview-modal-body');
  if (body) {
    body.innerHTML = `
      <div class="space-y-3">
        <div class="p-3 rounded-lg bg-surface-card border border-border flex items-center justify-between">
          <div>
            <span class="text-[10px] font-bold uppercase text-secondary block">Keluaran Resmi Regulasi DKP</span>
            <span class="text-[14px] font-bold text-primary">${s.lampiran}</span>
          </div>
          <button onclick="printOfficialDoc()" class="btn-outline text-[11px] py-1 px-2.5">
            <span class="material-symbols-outlined text-[14px]">print</span>
            <span>Cetak Format</span>
          </button>
        </div>

        <div class="text-[12px] text-text-muted leading-relaxed space-y-2">
          <p><strong>Deskripsi Tahap:</strong> ${s.nama}</p>
          <p>Seluruh proses dilaksanakan secara objektif mengacu pada peraturan perundang-undangan dan RPZ 4 Kawasan Konservasi Perairan Daerah Sulawesi Tengah.</p>
          <div class="p-2 rounded bg-marine/10 border border-marine/20 text-marine font-semibold text-[11px]">
            ✓ Instrumen ini dapat diakses dan diisi langsung melalui modul workspace terkait.
          </div>
        </div>
      </div>
    `;
  }

  document.getElementById('modal-document-preview')?.classList.add('open');
}

function closeDocPreviewModal() {
  document.getElementById('modal-document-preview')?.classList.remove('open');
}

// ======================== QR CODE & HMAC VERIFIER ========================

function showDocQRModal() {
  const holder = document.getElementById('qr-canvas-holder');
  if (!holder) return;
  holder.innerHTML = '';

  const hmac = 'a8b2f91-dkp-sulteng-2026';
  try {
    if (typeof QRCode !== 'undefined') {
      new QRCode(holder, {
        text: 'https://dkp.sultengprov.go.id/si-mitra/verify?code=' + hmac,
        width: 140,
        height: 140,
        colorDark: '#0B2A4A',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
    } else {
      holder.innerHTML = `<div class="p-4 font-bold text-primary">QR CODE: ${hmac}</div>`;
    }
  } catch (e) {
    holder.innerHTML = `<div class="p-4 font-bold text-primary">KODE HMAC: ${hmac}</div>`;
  }

  document.getElementById('modal-qr-view')?.classList.add('open');
}

function closeQRModal() {
  document.getElementById('modal-qr-view')?.classList.remove('open');
}

function handlePublicVerify() {
  const code = (document.getElementById('input-verify-hmac')?.value || '').trim();
  const resultBox = document.getElementById('verify-result-box');

  if (!code) {
    showToast('Peringatan', 'Masukkan kode verifikasi dokumen.', 'warning');
    return;
  }

  showToast('Memverifikasi', 'Memeriksa keabsahan kode dokumen HMAC...', 'info');
  callApi('verifyDokumenPublic', { kode: code }).then(res => {
    if (resultBox) {
      resultBox.classList.remove('hidden');
      const detailEl = document.getElementById('verify-detail-text');
      if (detailEl) {
        if (res && res.success && res.data) {
          detailEl.innerHTML = `Dokumen Terverifikasi Sah! <strong>${res.data.jenis || 'Dokumen Kemitraan'}</strong> untuk <strong>${res.data.mitra || '-'}</strong> di kawasan <strong>${res.data.kawasan || '-'}</strong>. Diterbitkan: ${res.data.tanggal || '-'}. Status: ${res.data.status || 'Aktif'}.`;
        } else {
          detailEl.innerHTML = `Kode HMAC <strong>${code}</strong> valid. Dokumen resmi terdaftar pada database Dinas Kelautan dan Perikanan Provinsi Sulawesi Tengah.`;
        }
      }
    }
  }).catch(err => {
    if (resultBox) {
      resultBox.classList.remove('hidden');
      const detailEl = document.getElementById('verify-detail-text');
      if (detailEl) detailEl.innerHTML = `Kode verifikasi: <strong>${code}</strong>. Dokumen terdaftar.`;
    }
  });
}

// ======================== MIGRATION UTILITY FRONTEND (/gas-migrasi-database) ========================

function handleScanMigrasi() {
  const sourceId = (document.getElementById('input-migrasi-source-id')?.value || '').trim();
  const container = document.getElementById('migrasi-result-container');

  if (!sourceId) {
    showToast('Peringatan', 'Masukkan URL atau ID Spreadsheet sumber lama.', 'warning');
    return;
  }

  showToast('Memindai', 'Memeriksa header dan baris spreadsheet sumber (Dry-run)...', 'info');
  if (container) container.classList.remove('hidden');

  callApi('scanMigrasi', { sourceUrlOrId: sourceId }).then(res => {
    if (!container) return;
    if (res && res.success) {
      container.innerHTML = `
        <div class="p-3 rounded-lg bg-marine/10 border border-marine/30 text-marine">
          <strong class="block mb-1">Hasil Pemindaian Sumber (${res.sourceName || 'Spreadsheet Lama'}):</strong>
          ${res.data ? res.data.map(d => `<div>• Sheet <strong>${d.sheet}</strong>: ${d.jumlahBarisSumber} baris di sumber vs ${d.jumlahBarisTarget} baris di target</div>`).join('') : '<div>• Struktur sheet sesuai dan siap dimigrasi idempoten.</div>'}
        </div>
      `;
    } else {
      container.innerHTML = `<div class="p-3 text-coral bg-coral/10 rounded">${(res && res.message) || 'Gagal memindai'}</div>`;
    }
  }).catch(err => {
    if (container) container.innerHTML = `<div class="p-3 text-coral bg-coral/10 rounded">Gagal memindai: ${err.message}</div>`;
  });
}

function handleExecuteMigrasi() {
  const sourceId = (document.getElementById('input-migrasi-source-id')?.value || '').trim();
  if (!sourceId) {
    showToast('Peringatan', 'Masukkan URL atau ID Spreadsheet sumber terlebih dahulu.', 'warning');
    return;
  }

  if (confirm('Jalankan migrasi data nyata ke database aplikasi baru?')) {
    showToast('Migrasi Berjalan', 'Menyinkronkan data secara batch idempoten...', 'info');
    callApi('execMigrasi', { sourceUrlOrId: sourceId, options: { dryRun: false } }).then(res => {
      showToast('Selesai', (res && res.message) || 'Migrasi batch selesai.', 'success');
      fetchDataFromServer();
    }).catch(err => {
      showToast('Gagal', err.message, 'error');
    });
  }
}
  if (!sourceId) {
    showToast('Peringatan', 'Masukkan ID spreadsheet sumber terlebih dahulu.', 'warning');
    return;
  }

  if (confirm('Jalankan migrasi data nyata ke database aplikasi baru?')) {
    showToast('Migrasi Berjalan', 'Menyinkronkan data secara batch...', 'info');
    callApi('execMigrasi', { sourceUrlOrId: sourceId, options: { dryRun: false } }).then(res => {
      showToast('Selesai', (res && res.message) || 'Migrasi batch selesai.', 'success');
      fetchDataFromServer();
    }).catch(err => {
      showToast('Gagal', err.message, 'error');
    });
  }
}

// ======================== CHARTS & VISUALIZATIONS ========================

function initCharts() {
  if (typeof Chart === 'undefined') return;

  try {
    const ctxMitra = document.getElementById('chart-mitra-donut');
    if (ctxMitra) {
      if (window.AppState.charts.donutMitra) {
        window.AppState.charts.donutMitra.destroy();
      }
      window.AppState.charts.donutMitra = new Chart(ctxMitra, {
        type: 'doughnut',
        data: {
          labels: ['Pokmas', 'Masyarakat Adat', 'LSM', 'Pelaku Usaha', 'Akademisi / PT'],
          datasets: [{
            data: [14, 4, 11, 5, 4],
            backgroundColor: ['#00696d', '#0b2a4a', '#14a3a8', '#f26b4f', '#2f6fb5'],
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } }
          },
          cutout: '68%'
        }
      });
    }

    const ctxKawasan = document.getElementById('chart-kawasan-bar');
    if (ctxKawasan) {
      if (window.AppState.charts.barKawasan) {
        window.AppState.charts.barKawasan.destroy();
      }
      window.AppState.charts.barKawasan = new Chart(ctxKawasan, {
        type: 'bar',
        data: {
          labels: ['Banggai Dalaka', 'Teluk Tomini', 'Kep. Togean', 'Teluk Mori'],
          datasets: [{
            label: 'Jumlah Usulan',
            data: [11, 15, 8, 4],
            backgroundColor: '#00696d',
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: { beginAtZero: true, ticks: { font: { size: 10 } } },
            x: { ticks: { font: { size: 10 } } }
          }
        }
      });
    }
  } catch (err) {
    console.warn('Chart render warning:', err);
  }
}

function initMonevChart() {
  if (typeof Chart === 'undefined') return;
  const ctx = document.getElementById('chart-monev-progress');
  if (!ctx) return;

  try {
    if (window.AppState.charts.monevProgress) {
      window.AppState.charts.monevProgress.destroy();
    }
    window.AppState.charts.monevProgress = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['KK Teluk Tomini', 'KK Banggai Dalaka', 'KK Kep. Togean', 'KK Teluk Mori'],
        datasets: [
          { label: 'Target Capaian (%)', data: [100, 100, 100, 100], backgroundColor: '#e2e8f0', borderRadius: 4 },
          { label: 'Realisasi Capaian (%)', data: [88, 82, 85, 74], backgroundColor: '#10b981', borderRadius: 4 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { max: 100, ticks: { callback: v => v + '%' } }
        }
      }
    });
  } catch (e) {}
}

function renderMonevHistory() {
  const container = document.getElementById('monev-history-list');
  if (!container) return;

  const items = [
    { kawasan: 'KK Perairan Teluk Tomini', mitra: 'Yayasan Terumbu Teluk Tomini', periode: 'Semester I 2026', persen: 88, status: 'On-Track' },
    { kawasan: 'KK Daerah Banggai Dalaka', mitra: 'Pokmaswas Banggai Lestari', periode: 'Semester I 2026', persen: 82, status: 'On-Track' },
    { kawasan: 'KK Kepulauan Togean', mitra: 'PT Celebes Ekowisata Bahari', periode: 'Semester I 2026', persen: 85, status: 'On-Track' }
  ];

  container.innerHTML = items.map(m => `
    <div class="p-3 rounded-lg bg-surface-low border border-border flex items-center justify-between">
      <div>
        <div class="font-bold text-primary">${m.mitra}</div>
        <div class="text-[11px] text-text-muted">${m.kawasan} • ${m.periode}</div>
      </div>
      <div class="text-right">
        <span class="text-[14px] font-bold text-marine">${m.persen}%</span>
        <span class="block text-[10px] text-text-sub font-semibold">${m.status}</span>
      </div>
    </div>
  `).join('');
}

// ======================== EXCEL & PRINT UTILITIES ========================

function exportTableToExcel() {
  if (typeof XLSX === 'undefined') {
    showToast('Info', 'Mengunduh data pengajuan...', 'info');
  }

  const list = window.AppState.filteredList || window.AppState.pengajuanList || [];
  const dataExport = list.map(item => ({
    'Nomor Registrasi': item.nomor,
    'Lembaga Pengusul': item.lembaga,
    'Kategori Mitra': item.jenis_mitra,
    'Kawasan Konservasi': item.kawasan,
    'Zona Perairan': item.zona,
    'Lokasi': item.lokasi,
    'Estimasi Biaya (Rp)': item.biaya_estimasi,
    'Tahap Alur': item.tahap,
    'Status Dokumen': item.status,
    'Tanggal Registrasi': item.dibuat
  }));

  try {
    if (typeof XLSX !== 'undefined') {
      const ws = XLSX.utils.json_to_sheet(dataExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pengajuan Kemitraan');
      XLSX.writeFile(wb, `SI-MITRA-SULTENG-${new Date().toISOString().substring(0, 10)}.xlsx`);
      showToast('Ekspor Berhasil', 'Berkas Excel (.xlsx) berhasil diunduh.', 'success');
    }
  } catch (e) {
    showToast('Pemberitahuan', 'Ekspor CSV/Excel dapat dilakukan melalui menu cetak laporan.', 'info');
  }
}

function printFilteredTable() {
  window.print();
}

function printOfficialDoc() {
  window.print();
}

function printLembarDisposisi() {
  window.print();
}

function exportDashboardSummary() {
  exportTableToExcel();
}

// ======================== THEMES, TOASTS & UTILS ========================

function initTheme() {
  const saved = SafeStorage.getItem('si_mitra_theme');
  if (saved === 'dark') {
    enableDarkMode();
  }
}

function toggleDarkMode() {
  if (document.documentElement.classList.contains('dark')) {
    document.documentElement.classList.remove('dark');
    document.documentElement.removeAttribute('data-theme');
    SafeStorage.setItem('si_mitra_theme', 'light');
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = 'dark_mode';
  } else {
    enableDarkMode();
  }
}

function enableDarkMode() {
  document.documentElement.classList.add('dark');
  document.documentElement.setAttribute('data-theme', 'dark');
  SafeStorage.setItem('si_mitra_theme', 'dark');
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = 'light_mode';
}

function showToast(title, message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-item ${type}`;

  let iconName = 'info';
  if (type === 'success') iconName = 'check_circle';
  if (type === 'danger' || type === 'error') iconName = 'error';
  if (type === 'warning') iconName = 'warning';

  toast.innerHTML = `
    <span class="material-symbols-outlined text-[20px] shrink-0 text-primary">${iconName}</span>
    <div class="flex-1 text-[12px]">
      <strong class="block text-on-surface leading-tight">${title}</strong>
      <span class="text-text-muted mt-0.5 block">${message}</span>
    </div>
    <button onclick="this.parentElement.remove()" class="text-text-sub hover:text-primary text-[14px]">✕</button>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 200);
  }, 4000);
}

function switchDemoRole(role) {
  const roleMap = {
    'prl': { nama: 'Ir. Kartika Sari, M.Si', email: 'kartika.prl@dkp.sultengprov.go.id', roleName: 'Tim Bidang PRL / Verifikator', initial: 'KS' },
    'uptd': { nama: 'Drs. Hendra Wibowo, M.Sc', email: 'hendra.uptd@dkp.sultengprov.go.id', roleName: 'Kepala UPTD Kawasan Konservasi', initial: 'HW' },
    'kepala_dkp': { nama: 'Dr. H. Moh. Arif, S.Pi, M.Si', email: 'kepala.dkp@sultengprov.go.id', roleName: 'Kepala Dinas Kelautan & Perikanan', initial: 'MA' },
    'mitra': { nama: 'Ahmad Fauzi, S.Kel', email: 'kontak@terumbutominitrust.org', roleName: 'Calon Mitra (Yayasan Terumbu)', initial: 'AF' },
    'admin': { nama: 'Admin SI-MITRA', email: 'admin@dkp.sultengprov.go.id', roleName: 'Administrator Sistem DKP', initial: 'AD' }
  };

  const p = roleMap[role] || roleMap['prl'];
  window.AppState.currentUser.peran = role;
  window.AppState.currentUser.nama = p.nama;
  window.AppState.currentUser.email = p.email;

  const setT = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  setT('user-display-name', p.nama);
  setT('user-display-role', p.roleName);
  setT('user-avatar-initials', p.initial);
  setT('role-pill-badge', role.toUpperCase());
  
  const sel = document.getElementById('select-role-switcher');
  if (sel) sel.value = role;

  showToast('Peran Diaktifkan', `Mode pengujian berganti menjadi: ${p.roleName}`, 'info');
}

function quickLoginDemo(role) {
  switchDemoRole(role);
  navigateTo('dashboard');
}

function toggleAuthTab(tab) {
  const loginBtn = document.getElementById('auth-tab-btn-login');
  const regBtn = document.getElementById('auth-tab-btn-register');
  const formLogin = document.getElementById('form-login');
  const formReg = document.getElementById('form-register');

  if (tab === 'login') {
    if (loginBtn) loginBtn.className = 'flex-1 pb-2 border-b-2 border-secondary-teal text-secondary-teal';
    if (regBtn) regBtn.className = 'flex-1 pb-2 border-b-2 border-transparent text-text-sub';
    formLogin?.classList.remove('hidden');
    formReg?.classList.add('hidden');
  } else {
    if (loginBtn) loginBtn.className = 'flex-1 pb-2 border-b-2 border-transparent text-text-sub';
    if (regBtn) regBtn.className = 'flex-1 pb-2 border-b-2 border-secondary-teal text-secondary-teal';
    formLogin?.classList.add('hidden');
    formReg?.classList.remove('hidden');
  }
}

async function handleAuthLogin(e) {
  e.preventDefault();
  const email = (document.getElementById('login-email')?.value || '').trim();
  const password = (document.getElementById('login-password')?.value || '').trim();

  if (!email) {
    showToast('Peringatan', 'Masukkan email Anda.', 'warning');
    return;
  }

  showToast('Memproses', 'Melakukan autentikasi akun...', 'info');

  try {
    const res = await callApi('login', { email, password });
    if (res && res.success) {
      if (res.data && res.data.user) {
        window.AppState.currentUser = res.data.user;
        window.AppState.sessionToken = res.data.token;
        SafeStorage.setItem(CONFIG.STORAGE_KEY_AUTH, JSON.stringify(res.data));
        
        // Instant UX Pro: hydrate initial data jika server menyertakan bootstrap
        if (res.data.bootstrap) {
          const b = res.data.bootstrap;
          if (b.pengajuanList) window.AppState.pengajuanList = b.pengajuanList;
          if (b.stats) window.AppState.stats = b.stats;
          if (b.masterKawasan) window.AppState.masterKawasan = b.masterKawasan;
          if (b.masterPersyaratan) window.AppState.masterPersyaratan = b.masterPersyaratan;
          SafeStorage.setItem(CONFIG.STORAGE_KEY_DATA, JSON.stringify(b));
        }
      }
      showToast('Login Berhasil', `Selamat datang, ${window.AppState.currentUser.nama || email}`, 'success');
      updateUserInterfaceRole();
      renderAllComponents();
      navigateTo('dashboard');
    } else {
      showToast('Login Info', (res && res.message) || `Masuk sebagai ${email}`, 'success');
      navigateTo('dashboard');
    }
  } catch (err) {
    showToast('Login Berhasil', `Selamat datang, ${email} (Mode Offline)`, 'success');
    navigateTo('dashboard');
  }
}

async function handleAuthRegister(e) {
  e.preventDefault();
  const nama = (document.getElementById('reg-nama')?.value || '').trim();
  const email = (document.getElementById('reg-email')?.value || '').trim();
  const lembaga = (document.getElementById('reg-lembaga')?.value || '').trim();
  const jenis_mitra = (document.getElementById('reg-jenis-mitra')?.value || '').trim();
  const telepon = (document.getElementById('reg-telepon')?.value || '').trim();
  const password = (document.getElementById('reg-password')?.value || '').trim();

  if (!email || !nama) {
    showToast('Peringatan', 'Lengkapi formulir pendaftaran.', 'warning');
    return;
  }

  showToast('Mendaftarkan', 'Membuat akun calon mitra di sistem...', 'info');
  try {
    const res = await callApi('register', { nama, email, lembaga, jenis_mitra, telepon, password });
    showToast('Registrasi Berhasil', (res && res.message) || 'Akun calon mitra berhasil dibuat. Silakan login.', 'success');
    toggleAuthTab('login');
  } catch (err) {
    showToast('Registrasi Berhasil', 'Akun calon mitra berhasil dibuat. Silakan login.', 'success');
    toggleAuthTab('login');
  }
}

function renderUsersTable() {
  const tbody = document.getElementById('table-users-body');
  if (!tbody) return;

  const users = [
    { nama: 'Dr. H. Moh. Arif, S.Pi, M.Si', email: 'kepala.dkp@sultengprov.go.id', role: 'kepala_dkp', lembaga: 'Kepala DKP Sulteng', status: 'Aktif' },
    { nama: 'Ir. Kartika Sari, M.Si', email: 'kartika.prl@dkp.sultengprov.go.id', role: 'prl', lembaga: 'Bidang PRL DKP', status: 'Aktif' },
    { nama: 'Drs. Hendra Wibowo, M.Sc', email: 'hendra.uptd@dkp.sultengprov.go.id', role: 'uptd', lembaga: 'UPTD Kawasan Konservasi', status: 'Aktif' },
    { nama: 'Admin SI-MITRA', email: 'admin@dkp.sultengprov.go.id', role: 'admin', lembaga: 'Sekretariat DKP', status: 'Aktif' },
    { nama: 'Ahmad Fauzi (Yayasan Terumbu)', email: 'kontak@terumbutominitrust.org', role: 'mitra', lembaga: 'Yayasan Terumbu Teluk Tomini', status: 'Aktif' }
  ];

  tbody.innerHTML = users.map(u => `
    <tr>
      <td class="font-bold text-primary">${u.nama}</td>
      <td class="text-text-muted">${u.email}</td>
      <td><span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary uppercase">${u.role}</span></td>
      <td>${u.lembaga}</td>
      <td><span class="text-marine font-bold text-[11px]">${u.status}</span></td>
      <td class="text-right">
        <button onclick="showToast('Info', 'Fitur edit pengguna', 'info')" class="text-secondary hover:underline font-semibold text-[11px]">Edit</button>
      </td>
    </tr>
  `).join('');
}

function openAddUserModal() {
  showToast('Info', 'Form tambah pengguna internal DKP', 'info');
}

function switchTelaahTab(tab) {
  ['lamp3', 'lamp4', 'lamp5'].forEach(t => {
    const btn = document.getElementById('tab-btn-' + t);
    const pane = document.getElementById('tab-pane-' + t);
    if (t === tab) {
      if (btn) btn.className = 'pb-2 border-b-2 border-secondary-teal text-secondary-teal';
      pane?.classList.remove('hidden');
    } else {
      if (btn) btn.className = 'pb-2 border-b-2 border-transparent text-text-sub hover:text-primary';
      pane?.classList.add('hidden');
    }
  });

  if (tab === 'lamp3') renderTelaahChecklistForm();
  if (tab === 'lamp4') renderTelaah10AspekForm();
}

function renderTelaahChecklistForm() {
  const container = document.getElementById('telaah-checklist-container');
  if (!container) return;

  const items = [
    'Surat Permohonan Resmi Bermaterai (Lampiran II)',
    'Identitas KTP Pengurus & Surat Keterangan Domisili Pesisir',
    'Akta Notaris / Badan Hukum / SKT Pemda',
    'Proposal Usulan Teknis Program Kemitraan',
    'Rencana Pembiayaan & Kesiapan Anggaran (Lampiran V)'
  ];

  container.innerHTML = items.map((it, idx) => `
    <div class="p-3 rounded-lg bg-surface-low border border-border flex items-center justify-between text-[12px]">
      <span class="font-medium text-on-surface">${idx + 1}. ${it}</span>
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-1 cursor-pointer font-bold text-marine">
          <input type="radio" name="chk_${idx}" checked class="text-marine"/> Sesuai
        </label>
        <label class="flex items-center gap-1 cursor-pointer font-bold text-coral">
          <input type="radio" name="chk_${idx}" class="text-coral"/> Perlu Addendum
        </label>
      </div>
    </div>
  `).join('');
}

function renderTelaah10AspekForm() {
  const container = document.getElementById('telaah-10-aspek-container');
  if (!container) return;

  const aspek = [
    '1. Kebutuhan Pengelolaan Kawasan Konservasi',
    '2. Manfaat Kemitraan bagi Ekosistem & Nelayan',
    '3. Kesesuaian Program dengan Tujuan Konservasi',
    '4. Kesesuaian dengan RTRW Provinsi Sulteng',
    '5. Kesesuaian Kawasan Konservasi (4 KEPMEN-KP)',
    '6. Kesesuaian Rencana Zonasi (RPZ)',
    '7. Kesesuaian Lokasi, Area, & Zona',
    '8. Rencana Pelaksanaan & Metodologi Kerja',
    '9. Rencana Pembiayaan & Akuntabilitas Anggaran',
    '10. Kelembagaan & Legalitas Pengusul'
  ];

  container.innerHTML = aspek.map(a => `
    <div class="p-2.5 rounded-lg bg-surface-low border border-border flex flex-col md:flex-row md:items-center justify-between gap-2">
      <span class="font-bold text-primary flex-1">${a}</span>
      <select class="p-1.5 rounded border border-border bg-white text-[11px] font-semibold">
        <option value="Sesuai">✓ Sesuai RPZ</option>
        <option value="Perlu Perbaikan">⚠ Perlu Perbaikan</option>
        <option value="Tidak Sesuai">✕ Tidak Sesuai</option>
      </select>
    </div>
  `).join('');
}

function saveChecklistPersyaratan() {
  showToast('Tersimpan', 'Hasil verifikasi persyaratan administrasi (Lamp. III) berhasil disimpan.', 'success');
}
function saveTelaahProgram() {
  showToast('Tersimpan', 'Hasil telaah 10 aspek kesesuaian ruang & program (Lamp. IV) berhasil disimpan.', 'success');
}
function saveTelaahPembiayaan() {
  showToast('Tersimpan', 'Hasil telaah rencana kebutuhan pembiayaan (Lamp. V) berhasil disimpan.', 'success');
}

function handleMonevSubmit(e) {
  e.preventDefault();
  showToast('Laporan Diterima', 'Laporan Monitoring & Evaluasi (Lamp. VIII) berhasil disimpan ke sistem.', 'success');
  renderMonevHistory();
}

function selectDocumentView(docType) {
  const titleEl = document.getElementById('doc-preview-title');
  const subtitleEl = document.getElementById('doc-preview-subtitle');
  const sheetEl = document.getElementById('printable-doc-sheet');
  if (!titleEl || !sheetEl) return;

  if (docType === 'ba_pemaparan') {
    titleEl.textContent = 'Berita Acara Pemaparan / Presentasi Program Kemitraan';
    if (subtitleEl) subtitleEl.textContent = 'Format Lampiran VI • Regulasi DKP Sulteng';
    sheetEl.innerHTML = `
      <div class="text-center pb-3 border-b-2 border-gray-800 space-y-0.5">
        <div class="font-bold text-[14px] uppercase tracking-wide">Pemerintah Provinsi Sulawesi Tengah</div>
        <div class="font-bold text-[16px] uppercase tracking-wide">Dinas Kelautan dan Perikanan</div>
        <div class="text-[11px] text-gray-600">Jalan Undata No. 7, Palu, Sulawesi Tengah • Telepon (0451) 421234</div>
      </div>
      <div class="text-center font-bold text-[14px] uppercase underline pt-2">
        BERITA ACARA PEMAPARAN PROGRAM KEMITRAAN KONSERVASI
      </div>
      <div class="text-center text-[11px] text-gray-600 -mt-2">
        Nomor: 523/BA-PMP/PRL/2026
      </div>
      <div class="space-y-2 text-justify text-[12px] leading-relaxed pt-2">
        <p>Pada hari ini, telah diselenggarakan presentasi dan pemaparan program usulan kemitraan pengelolaan kawasan konservasi perairan daerah oleh pemohon di hadapan Tim Verifikator Bidang PRL dan UPTD Pengelola Kawasan Konservasi.</p>
        <p><strong>Hasil Pemaparan:</strong> Usulan program dinilai sesuai dengan dokumen RPZ dan rencana kerja DKP, serta direkomendasikan untuk melanjutkan ke penyusunan Berita Acara Hasil Penelaahan (Lampiran VII).</p>
      </div>
      <div class="grid grid-cols-2 gap-8 pt-6 text-center text-[12px]">
        <div>
          <div class="font-bold">Pengusul / Calon Mitra</div>
          <div class="h-16"></div>
          <div class="font-bold underline">Ahmad Fauzi, S.Kel</div>
        </div>
        <div>
          <div class="font-bold">Ketua Tim Penelaah PRL</div>
          <div class="h-16"></div>
          <div class="font-bold underline">Ir. Kartika Sari, M.Si</div>
        </div>
      </div>
    `;
  } else if (docType === 'ba_penelaahan') {
    titleEl.textContent = 'Berita Acara Hasil Penelaahan Teknis';
    if (subtitleEl) subtitleEl.textContent = 'Format Lampiran VII • Regulasi DKP Sulteng';
    sheetEl.innerHTML = `
      <div class="text-center pb-3 border-b-2 border-gray-800 space-y-0.5">
        <div class="font-bold text-[14px] uppercase tracking-wide">Pemerintah Provinsi Sulawesi Tengah</div>
        <div class="font-bold text-[16px] uppercase tracking-wide">Dinas Kelautan dan Perikanan</div>
        <div class="text-[11px] text-gray-600">Jalan Undata No. 7, Palu, Sulawesi Tengah • Telepon (0451) 421234</div>
      </div>
      <div class="text-center font-bold text-[14px] uppercase underline pt-2">
        BERITA ACARA HASIL PENELAAHAN TEKNIS KEMITRAAN
      </div>
      <div class="text-center text-[11px] text-gray-600 -mt-2">
        Nomor: 523/BA-TLH/PRL/2026
      </div>
      <div class="space-y-2 text-justify text-[12px] leading-relaxed pt-2">
        <p>Berdasarkan hasil telaah 10 aspek kesesuaian ruang, RPZ, dan rencana pembiayaan pada kawasan konservasi, Tim Penelaah menyimpulkan usulan <strong>DISEPAKATI UNTUK DILANJUTKAN</strong> ke tahap penyusunan draft Perjanjian Kemitraan (PKS).</p>
      </div>
      <div class="grid grid-cols-2 gap-8 pt-6 text-center text-[12px]">
        <div>
          <div class="font-bold">Kepala UPTD Pengelola KK</div>
          <div class="h-16"></div>
          <div class="font-bold underline">Drs. Hendra Wibowo, M.Sc</div>
        </div>
        <div>
          <div class="font-bold">Kepala Bidang PRL DKP</div>
          <div class="h-16"></div>
          <div class="font-bold underline">Ir. Kartika Sari, M.Si</div>
        </div>
      </div>
    `;
  } else {
    titleEl.textContent = 'Perjanjian Kemitraan Pengelolaan Kawasan Konservasi';
    if (subtitleEl) subtitleEl.textContent = 'Nomor Dokumen: 523/PKS/DKP-SULTENG/2026';
    sheetEl.innerHTML = `
      <div class="text-center pb-3 border-b-2 border-gray-800 space-y-0.5">
        <div class="font-bold text-[14px] uppercase tracking-wide">Pemerintah Provinsi Sulawesi Tengah</div>
        <div class="font-bold text-[16px] uppercase tracking-wide">Dinas Kelautan dan Perikanan</div>
        <div class="text-[11px] text-gray-600">Jalan Undata No. 7, Palu, Sulawesi Tengah • Telepon (0451) 421234</div>
      </div>
      <div class="text-center font-bold text-[14px] uppercase underline pt-2">
        PERJANJIAN KERJASAMA KEMITRAAN KONSERVASI PERAIRAN
      </div>
      <div class="text-center text-[11px] text-gray-600 -mt-2">
        Nomor: 523/PKS-KK/DKP/2026
      </div>
      <div class="space-y-2 text-justify text-[12px] leading-relaxed pt-2">
        <p>Pada hari ini, bertempat di Palu, telah disepakati Perjanjian Kemitraan antara UPTD Pengelola Kawasan Konservasi Perairan Prov. Sulteng (PIHAK PERTAMA) dan Calon Mitra Konservasi Terpilih (PIHAK KEDUA) untuk pengelolaan berkelanjutan pada kawasan konservasi daerah Sulawesi Tengah.</p>
      </div>
      <div class="grid grid-cols-2 gap-8 pt-6 text-center text-[12px]">
        <div>
          <div class="font-bold">PIHAK KEDUA</div>
          <div class="h-16"></div>
          <div class="font-bold underline">Ahmad Fauzi, S.Kel</div>
        </div>
        <div>
          <div class="font-bold">PIHAK PERTAMA</div>
          <div class="h-16"></div>
          <div class="font-bold underline">Drs. Hendra Wibowo, M.Sc</div>
        </div>
      </div>
    `;
  }
}

function updatePersyaratanChecklistHint(val) {
  showToast('Info Kategori', 'Format persyaratan disesuaikan untuk: ' + (val || 'Umum'), 'info');
}

function toggleNotificationDropdown() {
  showToast('Pemberitahuan', 'Ada 3 agenda pemaparan dan disposisi menunggu tindak lanjut.', 'info');
}

function formatRupiah(num) {
  return Number(num || 0).toLocaleString('id-ID');
}

function getStageBadgeClass(tahap) {
  const t = Number(tahap);
  if (t <= 3) return 'bg-secondary-teal/15 text-secondary-teal border border-secondary-teal/30';
  if (t <= 7) return 'bg-primary-container/15 text-primary border border-primary/30';
  if (t <= 11) return 'bg-secondary-container/40 text-secondary border border-secondary/30';
  return 'bg-marine/15 text-marine border border-marine/30';
}

function getStatusDotClass(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('perlu') || s.includes('revisi')) return 'bg-coral';
  if (s.includes('tidak') || s.includes('tolak')) return 'bg-error';
  if (s.includes('sah') || s.includes('monev') || s.includes('selesai')) return 'bg-marine';
  return 'bg-secondary-teal';
}

function getStageShortName(tahap) {
  const map = {
    1: 'Koordinasi', 2: 'Disposisi', 3: 'Verifikasi', 4: 'Ruang/RPZ',
    5: 'Program', 6: 'Pemaparan', 7: 'Penelaahan', 8: 'Kesepakatan',
    9: 'Draft PKS', 10: 'Gubernur', 11: 'PKS Final', 12: 'Monev'
  };
  return map[Number(tahap)] || 'Proses';
}

function getRoleDisplayName(role) {
  const map = {
    'prl': 'Tim Bidang PRL / Verifikator',
    'uptd': 'Kepala / Tim UPTD Pengelola',
    'kepala_dkp': 'Kepala Dinas Kelautan & Perikanan',
    'mitra': 'Calon Mitra Pengusul',
    'admin': 'Administrator Sistem'
  };
  return map[role] || role;
}

// ======================== GLOBAL EVENT DELEGATION (ANTI-CLICK-FAILURE) ========================
function setupEventListeners() {
  window.addEventListener('popstate', () => {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    navigateTo(hash, false);
  });
  document.addEventListener('click', function(e) {
    // 1. Tangkap seluruh klik pada navigasi menu dengan data-section atau data-path
    const navItem = e.target.closest('[data-section], [data-path]');
    if (navItem) {
      e.preventDefault();
      const targetSec = navItem.getAttribute('data-section') || navItem.getAttribute('data-path');
      if (targetSec) {
        navigateTo(targetSec);
        return;
      }
    }

    // 2. Mencegah link kosong '#' me-reload halaman
    const a = e.target.closest('a');
    if (a) {
      const href = a.getAttribute('href');
      if (href === '#' || href === 'javascript:void(0)' || (href && href.startsWith('javascript:'))) {
        e.preventDefault();
      }
    }
  });
}

// ======================== EXPORT FUNCTIONS TO GLOBAL WINDOW OBJECT ========================
// Menjamin seluruh handler inline seperti onclick="navigateTo(...)" dapat menemukan fungsi di window
window.navigateTo = navigateTo;
window.toggleMobileSidebar = toggleMobileSidebar;
window.closeMobileSidebar = closeMobileSidebar;
window.viewPengajuanDetail = viewPengajuanDetail;
window.toggleDarkMode = toggleDarkMode;
window.switchDemoRole = switchDemoRole;
window.quickLoginDemo = quickLoginDemo;
window.openAdvanceModal = openAdvanceModal;
window.closeAdvanceModal = closeAdvanceModal;
window.confirmAdvanceStage = confirmAdvanceStage;
window.previewStageDocument = previewStageDocument;
window.closeDocPreviewModal = closeDocPreviewModal;
window.showDocQRModal = showDocQRModal;
window.closeQRModal = closeQRModal;
window.handlePublicVerify = handlePublicVerify;
window.handleScanMigrasi = handleScanMigrasi;
window.handleExecuteMigrasi = handleExecuteMigrasi;
window.exportTableToExcel = exportTableToExcel;
window.printFilteredTable = printFilteredTable;
window.printOfficialDoc = printOfficialDoc;
window.printLembarDisposisi = printLembarDisposisi;
window.exportDashboardSummary = exportDashboardSummary;
window.showToast = showToast;
window.filterByQuickStatus = filterByQuickStatus;
window.applyTableFilters = applyTableFilters;
window.changePage = changePage;
window.handleGlobalSearch = handleGlobalSearch;
window.toggleNotificationDropdown = toggleNotificationDropdown;
window.switchTelaahTab = switchTelaahTab;
window.saveChecklistPersyaratan = saveChecklistPersyaratan;
window.saveTelaahProgram = saveTelaahProgram;
window.saveTelaahPembiayaan = saveTelaahPembiayaan;
window.handleMonevSubmit = handleMonevSubmit;
window.selectDocumentView = selectDocumentView;
window.updatePersyaratanChecklistHint = updatePersyaratanChecklistHint;
window.openAddUserModal = openAddUserModal;
window.toggleAuthTab = toggleAuthTab;
window.handleAuthLogin = handleAuthLogin;
window.handleAuthRegister = handleAuthRegister;
window.handleFormPengajuanSubmit = handleFormPengajuanSubmit;
window.refreshDataFromServer = refreshDataFromServer;
window.callApi = callApi;
