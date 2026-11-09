/**
 * ====================================================================================
 * SI-MITRA KONSERVASI SULTENG - CONFIGURATION
 * Sesuai Standar:
 * - /gas-pro-api (REST API endpoint & decoupled frontend)
 * - /gas-instant-ux-pro (Freshness TTL, timeout, telemetri)
 * - /gas-scale-turbo (Adaptive polling & resilient network)
 * ====================================================================================
 */

const CONFIG = {
  // Masukkan URL Google Apps Script Web App (/exec) hasil deployment di bawah ini:
  // Contoh: 'https://script.google.com/macros/s/AKfycbx.../exec'
  // Jika dikosongkan (''), aplikasi otomatis berjalan dalam MODE DEMO AKTIF (Data Offline Lengkap)
  GAS_URL: 'https://script.google.com/macros/s/AKfycbyRsGRfPgP4GZbmgOJOttqoemMH-RUUobMsVDpatTjGxTB10HAP03Iy66onDh_-bxLdug/exec',

  APP_NAME: 'SI-MITRA KONSERVASI SULTENG',
  APP_LONG_NAME: 'Sistem Informasi Kemitraan Kawasan Konservasi Provinsi Sulawesi Tengah',
  VERSION: '1.0.0-PRO',
  INSTITUTION: 'Dinas Kelautan dan Perikanan (DKP) Provinsi Sulawesi Tengah',

  // Network & Cache Settings (Instant UX PRO)
  TIMEOUT_READ_MS: 20000,   // 20 detik timeout untuk read
  TIMEOUT_WRITE_MS: 45000,  // 45 detik timeout untuk write
  CACHE_FRESHNESS_TTL_MS: 60000, // 60 detik Stale-While-Revalidate (SWR) cache
  MAX_RETRIES: 2,           // Maksimal retry otomatis untuk read
  
  // Storage Keys
  STORAGE_KEY_DATA: 'si_mitra_data_cache_v1',
  STORAGE_KEY_AUTH: 'si_mitra_auth_session_v1',
  STORAGE_KEY_THEME: 'si_mitra_theme_mode'
};

// Pasang di window agar dapat diakses dari modul lain
window.CONFIG = CONFIG;
