import { PrismaPg } from '@prisma/adapter-pg'
import { Prisma, PrismaClient } from '@prisma/client'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { Pool } from 'pg'
import type { Pool as PgPool } from 'pg'

// ── Arsitektur database (aturan mutlak project Kangenin) ─────────────────────
//
// 1. WAJIB lewat binding Hyperdrive. Library pg melakukan upgrade TLS dengan
//    cara yang TIDAK didukung runtime Cloudflare Workers — koneksi langsung ke
//    Supabase dari Worker selalu gagal. Worker konek plaintext ke proxy lokal
//    Hyperdrive (di dalam jaringan Cloudflare), Hyperdrive yang mengurus
//    TLS + connection pooling global ke origin.
// 2. Origin Hyperdrive = DIRECT CONNECTION Supabase port 5432
//    (db.<ref>.supabase.co). DILARANG memakai pooler Supabase (port 6543 /
//    5432 pooler host) — Hyperdrive sudah bertindak sebagai pooler global;
//    double-pooling (Hyperdrive + Supavisor) menyebabkan koneksi zombie dan
//    query menggantung belasan detik.
// 3. Kode TIDAK membaca process.env.DATABASE_URL di produksi — hanya sebagai
//    fallback dev lokal. Urutan resolusi koneksi:
//      env.HYPERDRIVE_DB.connectionString  →  env.HYPERDRIVE.connectionString
//      →  process.env.DATABASE_URL (lokal / fallback dev)
// 4. Prisma Driver Adapter (@prisma/adapter-pg) dipakai agar Prisma jalan
//    mulus di Edge Runtime Cloudflare.
// 5. Higiene koneksi: pg.Pool me-release otomatis client-nya setelah setiap
//    query selesai (per-query release), ditambah batas ketat di bawah supaya
//    koneksi bermasalah cepat dibuang dan tidak menggantung sampai Worker
//    timeout: statement_timeout (server), query_timeout (client), maxUses
//    (daur ulang koneksi), dan handler 'error' untuk koneksi idle yang mati.

type CloudflareEnv = {
  /** Binding Hyperdrive utama (aturan arsitektur: direct connection 5432). */
  HYPERDRIVE_DB?: { connectionString?: string }
  /** Binding lama — dipertahankan sementara sebagai fallback migrasi. */
  HYPERDRIVE?: { connectionString?: string }
}

function hyperdriveConnectionString(): string | undefined {
  try {
    const { env } = getCloudflareContext() as unknown as { env?: CloudflareEnv }
    const cs = env?.HYPERDRIVE_DB?.connectionString ?? env?.HYPERDRIVE?.connectionString
    if (cs) {
      const which = env?.HYPERDRIVE_DB ? 'HYPERDRIVE_DB' : 'HYPERDRIVE'
      console.log(`[db] memakai binding Hyperdrive (${which}) — pooling + TLS via Cloudflare`)
    }
    return cs
  } catch {
    return undefined // bukan runtime Cloudflare (mis. next dev lokal)
  }
}

function envDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) return undefined
  if (url.includes('[YOUR-PASSWORD]') || url.includes('[PASSWORD]')) {
    console.warn(
      '[db] DATABASE_URL masih memuat placeholder password — ganti dengan password database asli.'
    )
  }
  return url
}

// Supabase mewajibkan TLS. Kalau URL lupa membawa ?sslmode=require,
// aktifkan SSL otomatis untuk host supabase (hanya relevan di Node lokal,
// karena di Workers jalannya selalu via Hyperdrive).
function isSupabaseHostWithoutSsl(url: string): boolean {
  try {
    const u = new URL(url)
    const supabase = /(^|\.)supabase\.(co|com)$/.test(u.hostname)
    return supabase && !u.searchParams.has('sslmode')
  } catch {
    return false
  }
}

function makePool(connectionString: string | undefined): PgPool {
  const pool = new Pool({
    ...(connectionString ? { connectionString } : {}),
    // ── batas higiene koneksi (lihat komentar arsitektur di atas) ──
    max: 5, // per isolate; pooling global dilakukan Hyperdrive. 3→5: tes beban
    // produksi 2026-11-02 (scripts/load_test.py) menangkap 500 burst saat 5
    // user serentak — antrean nunggu client pool melebihi
    // connectionTimeoutMillis → 500 tanpa kesempatan diulang. 5 memberi ruang
    // burst kecil, tetap jauh di bawah pagu koneksi Supabase free-tier.
    connectionTimeoutMillis: 5_000, // gagal cepat, jangan biarkan user nunggu lama
    // 4,5 dtk: audit produksi 2026-11-01 (scripts/audit_all_flows.sh) menemukan
    // hampir semua request menggenangi 3 dtk pas — polanya: query PERTAMA pada
    // koneksi segar menunggu Hyperdrive dial origin dingin (TLS + auth ke
    // Supabase), yang terhitung di dalam query_timeout. 3 dtk memotong dial
    // sehat itu → withDbRetry mengulang di koneksi lain → 3,3–6,8 dtk per
    // request (12 dari 25 panggilan audit > 3 dtk). 4,5 dtk menyerap dial
    // dingin (tipikal 2–3 dtk) tanpa retry; koneksi basi tetap dipotong, dan
    // anggaran keras withDbRetry (8,5 dtk) tetap membatasi worst-case user.
    query_timeout: 4_500,
    statement_timeout: 8_000, // server-side: potong query nangkring
    // PENTING: di node-postgres, 0 = DISABLED. Semula 1 dtk (anti-zombie
    // episode 2026-11-01) — tapi itu mematikan koneksi SEHAT juga: hampir
    // tiap request membayar dial dingin Hyperdrive→origin dari nol, dan
    // koneksi yang kena basi di baris pertama mendominasi (audit produksi:
    // 11/25 panggilan > 3 dtk). Sekarang 30 dtk: koneksi tetap hangat lintas
    // request dalam hidup isolate. Risiko zombie ditangani lapis lain —
    // query_timeout 4,5 dtk memotong + MENGHANCURKAN klien yang menggantung,
    // 'error' handler membuang klien idle yang mati, maxUses 250 mendaur
    // ulang, dan withDbRetry mengulang di koneksi baru kalau lolos semua.
    idleTimeoutMillis: 30_000,
    maxUses: 250, // daur ulang koneksi sebelum menua/jadi zombie
    // catatan: keepAlive TIDAK dipakai — di runtime Workers socket yang menempel
    // (keepalive) berisiko menggleding limit koneksi simultan per isolate dan
    // membuat isolate crash instan. Hidigiene cukup lewat idleTimeout + maxUses.
    ...(connectionString && isSupabaseHostWithoutSsl(connectionString)
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
  })
  // Koneksi idle yang mati mendadak (mis. Supabase restart) memicu event
  // 'error' pada pool. Tanpa handler ini isolate bisa crash unhandled.
  pool.on('error', (err) => {
    console.error('[db] pool error (koneksi idle mati, akan dibuka lagi):', err.message)
  })
  return pool
}

// Pool pg BERSAMA: dipakai Prisma (via adapter) SEKALIGUS query manual
// (mis. rate limiter S-04). Satu isolate = satu pool. Karena rate limiter
// jalan SEBELUM query utama dalam request yang sama, client yang barusan
// dibuka limiter langsung di-reuse oleh query Prisma berikutnya — tidak ada
// biaya koneksi ekstra per request.
let sharedPool: PgPool | undefined

export function getPgPool(): PgPool {
  if (!sharedPool) {
    const cs = hyperdriveConnectionString() ?? envDatabaseUrl()
    if (!cs) {
      console.warn(
        '[db] Tidak ada binding Hyperdrive maupun DATABASE_URL — query database akan gagal. ' +
          'Set binding HYPERDRIVE_DB di wrangler.jsonc, atau .env untuk lokal.'
      )
    }
    sharedPool = makePool(cs)
  }
  return sharedPool
}

function makeClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg(getPgPool()),
    ...(process.env.NODE_ENV === 'production' ? {} : { log: ['query'] as const }),
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? makeClient()

// Warm-up: buka koneksi pertama di background begitu isolate nyala, jadi
// query request pengguna nanti tinggal memakai koneksi yang sudah siap.
// Kegagalan diabaikan — query request berikutnya akan mencoba lagi sendiri.
if (!globalForPrisma.prisma) {
  void db.$queryRaw`SELECT 1`.catch(() => {})
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// ── Perisai anti-zombie ──────────────────────────────────────────────────────
// Hyperdrive sesekali menyerahkan koneksi "mati diam" (query terkirim, jawaban
// tak kunjung datang) walau origin-nya direct & config baru. Timeout memotong
// koneksi itu, lalu helper ini mengulang di koneksi baru. Kesalahan
// validasi/bisnis TIDAK pernah diulang.
//
// ANGGARAN WAKTU KERAS (budgetMs, bawaan 8,5 dtk) — dua lapis:
//   1. Sebelum memulai attempt, cek sisa anggaran (lapis lama; kurang —
//      insiden produksi 2026-11-01 POST /api/gifts wall 18,5 dtk: attempt-2
//      DIMULAI saat anggaran masih sisa lalu menggantung sampai query_timeout
//      penuh tanpa ada yang memotongnya).
//   2. Setiap attempt di-race dengan sisa anggaran (lapis baru): attempt yang
//      menggantung DIPOTONG tepat saat anggaran habis, jadi total waktu blok
//      DB DIJAMIN ≤ budgetMs + jeda, apa pun yang terjadi di bawahnya. Query
//      yang tertinggal tetap diawasi query_timeout (3 dtk) — klien basi
//      dibunuh lalu dibuang pool; tidak menumpuk di max=5.
// Peluang ketiga attempt semuanya kena zombie sangat kecil; kalau anggaran
// habis, error naik cepat dengan pesan rapi + tombol coba lagi — BUKAN
// 18–24 dtk hening seperti episode lama.
const RETRYABLE = /query read timeout|connection terminated|timeout exceeded|took longer than|statement timeout|ECONNRESET|socket hang up|anggaran db/i
// "took longer than"      = antre nunggu client pool (connectionTimeoutMillis)
// "statement timeout"     = server memotong query nangkring (57014) — koneksi
//                           SEHAT, cuma kecepetan potongnya → wajib diulang
//                           (tes beban 2026-11-02: 14/18 wall request gagal
//                           padahal satu-satunya dosa adalah burst kecil)

/**
 * Deteksi tabrakan unique constraint (P2002) — antar varian error adapter
 * (engine klasik vs driver adapter bisa membungkus pesan berbeda).
 * Dipakai pola create-and-catch: TIDAK ada pre-check findUnique(slug) sebelum
 * create — query pre-check yang menghasilkan NULL bisa di-cache Hyperdrive
 * (automatic query caching) tepat sebelum baris dibuat, lalu GET sesaat
 * setelahnya membaca cache NULL → 404 "tidak ditemukan" padahal datanya ada
 * (insiden null-read produksi 2026-11-01: respond/letters/gifts 404 usai
 * create). Satu-satunya query yang menyentuh slug baru adalah INSERT-nya.
 */
export function isUniqueViolation(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) return err.code === 'P2002'
  const msg = err instanceof Error ? err.message : String(err)
  return /P2002|unique constraint|duplicate key/i.test(msg)
}

/**
 * Deteksi "record tidak ditemukan" (P2025) — antar varian error adapter
 * (sama seperti isUniqueViolation: driver adapter bisa membungkus error
 * berbeda dari engine klasik, jadi kode error DAN pesan keduanya dicek).
 * Dipakai DELETE idempoten (mis. hapus kado): baris yang memang sudah tidak
 * ada TIDAK boleh dilempar sebagai 500 ke user.
 */
export function isRecordNotFound(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) return err.code === 'P2025'
  const code = (err as { code?: string })?.code
  if (code === 'P2025') return true
  const msg = err instanceof Error ? err.message : String(err)
  // sengaja TIDAK memakai pola umum semacam "no result" — terlalu gampang
  // menyamarkan error asli jadi "sudah terhapus"
  return /P2025|record to delete does not exist|record not found/i.test(msg)
}

/**
 * Nonce anti-cache Hyperdrive untuk bacaan read-after-write.
 *
 * PENTING (temuan produksi 2026-11-02): Hyperdrive mengunci cache pada TEKS
 * query yang dinormalisasi — komentar biasa TIDAK mengubah cache key, jadi
 * dua query identik dengan komentar beda BERBAGI cache yang sama (docs:
 * "Comments that contain volatile or uncacheable function names ... can
 * cause the query to be treated as uncacheable" — docs Cloudflare Hyperdrive,
 * Query caching → Read-after-write behavior). Karena itu nonce sengaja
 * MEMUAT nama fungsi volatile `random()` di dalam komentarnya: pencocok
 * teks Hyperdrive menandai query itu uncacheable → selalu ke origin →
 * pembaca selalu melihat tulisan terbaru.
 *
 * WAJIB dipakai pada bacaan yang HARUS melihat tulisan terbaru
 * (read-after-write): open sesudah start, reply sesudah open, redeem
 * sesudah redeem lain, daftar admin sesudah aksi moderasi
 * (insiden staleness produksi 2026-11-01: open 400 "belum dimulai" padahal
 * start sukses — cache memegang startedAt=null sampai TTL ±60 dtk;
 * insiden lanjutan 2026-11-02: PATCH status admin masukan sukses tapi GET
 * langsung masih "baru" selama ±60-70 dtk karena komentar tanpa nama
 * fungsi ternyata tidak mem-bypass cache).
 *
 * CATATAN AKHIR 2026-11-02: trik komentar random() & literal unik TETAP kalah
 * — normalisasi cache-key mencoret komentar dan menyeragamkan literal. Solusi
 * finalnya di luar kode: matikan caching di konfigurasi Hyperdrive (dashboard
 * → Storage & Databases → Hyperdrive → Settings → Caching → Disable). Fungsi
 * ini kini hanya jaring pengaman kedua yang murah; biarkan tetap terpasang di
 * semua read-after-write.
 */
export function dbNonce(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)} random()`
}

/** Sisa waktu minimum agar satu retry masih masuk akal (query timeout 3 dtk + jeda). */
const MIN_RETRY_HEADROOM_MS = 1_000

export async function withDbRetry<T>(
  fn: () => Promise<T>,
  opts?: { budgetMs?: number }
): Promise<T> {
  const budgetMs = opts?.budgetMs ?? 8_500
  const deadline = Date.now() + budgetMs
  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      // jeda 150–400 ms — beri Hyperdrive waktu membuang koneksi yang sakit
      // dan pool membuka yang benar-benar baru
      const wait = 150 + Math.random() * 250
      if (Date.now() + wait + MIN_RETRY_HEADROOM_MS > deadline) break // anggaran habis
      await new Promise((r) => setTimeout(r, wait))
    }
    // Lapis 2 — potong attempt yang menggantung pada batas anggaran.
    let budgetTimer: ReturnType<typeof setTimeout> | undefined
    const budgetGuard = new Promise<never>((_, reject) => {
      budgetTimer = setTimeout(() => {
        reject(new Error("anggaran db terlampaui — koneksi di potong agar user tidak menunggu"))
      }, Math.max(250, deadline - Date.now()))
    })
    try {
      return await Promise.race([fn(), budgetGuard])
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      if (!RETRYABLE.test(msg)) throw err
      console.warn(`[db] koneksi macet (attempt ${attempt + 1}/3), ulang:`, msg)
      // episode gangguan penuh: sisa anggaran tak cukup untuk satu percobaan
      // lagi yang sehat → berhenti, biarkan error naik dengan cepat.
      if (Date.now() + MIN_RETRY_HEADROOM_MS > deadline) break
    } finally {
      if (budgetTimer) clearTimeout(budgetTimer)
    }
  }
  throw lastErr
}
