import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { NextRequest } from "next/server";

// ── Kunci gerbang admin (/admin) ─────────────────────────────────────────────
// Resolusi kunci: binding/secret ADMIN_KEY di Cloudflare → process.env (dev
// lokal). Ganti lewat Cloudflare dashboard (Settings → Variables) — kode tidak
// perlu diubah.
//
// FAIL-CLOSED (bersih-bersih pra-launch 2026-11-03): dulu ada kunci bawaan
// "kangenin-admin-2026" yang tertulis di kode — repo ini publik, jadi siapa
// pun yang membaca repo otomatis tahu kunci gerbang admin. Kunci bawaan itu
// DIHAPUS: kalau ADMIN_KEY tidak terpasang, SEMUA gerbang admin MENOLAK
// (pemanggil membalas 404) — bukan membuka pintu pakai kunci yang sudah
// terlanjur dikenal publik. Owner sudah memasang ADMIN_KEY sendiri sebagai
// secret Worker, jadi perubahan ini transparan buat pemakaian sehari-hari.
//
// Kenapa kunci terpisah dari INSIGHT_KEY? Prinsip least privilege: halaman
// admin bisa MENGUBAH data (moderasi dinding, hapus masukan, sapu rate
// limit) — kalau kunci insight bocor, dampaknya cuma kebocoran bacaan.
let pernahWarningTanpaKunci = false;

export function adminKey(): string | undefined {
  try {
    const { env } = getCloudflareContext() as unknown as {
      env?: { ADMIN_KEY?: string }
    }
    if (env?.ADMIN_KEY) return env.ADMIN_KEY
  } catch {
    // bukan runtime Cloudflare (dev lokal) → lanjut ke process.env
  }
  const dariEnv = process.env.ADMIN_KEY?.trim()
  if (!dariEnv && !pernahWarningTanpaKunci) {
    pernahWarningTanpaKunci = true
    console.warn(
      "[admin-key] ADMIN_KEY belum terpasang (secret Cloudflare / env lokal) — " +
        "semua gerbang admin MENOLAK akses (fail-closed)."
    )
  }
  return dariEnv || undefined
}

/**
 * Cek kunci admin dari header `x-admin-key` ATAU query `?key=`.
 * Header dipakai UI /admin (tidak nangkring di URL/log akses), query param
 * disediakan buat uji cepat lewat browser/curl.
 * Kunci salah TIDAK dijawab 403 — cukup 404 (jangan sempurnakan peta buat
 * pengintip), jadi helper ini cuma mengembalikan boolean.
 * FAIL-CLOSED: tanpa kunci terkonfigurasi, selalu false apa pun yang dikirim.
 */
export function isAdmin(req: NextRequest): boolean {
  const header = req.headers.get("x-admin-key") ?? "";
  const param = req.nextUrl.searchParams.get("key") ?? "";
  const given = header.trim() || param.trim();
  const expected = adminKey();
  return !!expected && given !== "" && given === expected;
}
