import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { NextRequest } from "next/server";

// ── Kunci gerbang admin (/admin) ─────────────────────────────────────────────
// Pola yang sama dengan INSIGHT_KEY (src/app/api/feedback/route.ts): urutan
// resolusi binding/secret ADMIN_KEY di Cloudflare → process.env → bawaan.
// Ganti lewat Cloudflare dashboard (Settings → Variables) kalau mau lebih
// ketat — kode tidak perlu diubah.
//
// Kenapa kunci terpisah dari INSIGHT_KEY? Prinsip least privilege: halaman
// admin bisa MENGUBAH data (moderasi dinding, hapus masukan, sapu rate
// limit) — kalau kunci insight bocor, dampaknya cuma kebocoran bacaan.
export function adminKey(): string {
  try {
    const { env } = getCloudflareContext() as unknown as {
      env?: { ADMIN_KEY?: string }
    }
    if (env?.ADMIN_KEY) return env.ADMIN_KEY
  } catch {
    // bukan runtime Cloudflare (dev lokal) → lanjut ke process.env
  }
  return process.env.ADMIN_KEY ?? "kangenin-admin-2026"
}

/**
 * Cek kunci admin dari header `x-admin-key` ATAU query `?key=`.
 * Header dipakai UI /admin (tidak nangkring di URL/log akses), query param
 * disediakan buat uji cepat lewat browser/curl.
 * Kunci salah TIDAK dijawab 403 — cukup 404 (jangan sempurnakan peta buat
 * pengintip), jadi helper ini cuma mengembalikan boolean.
 */
export function isAdmin(req: NextRequest): boolean {
  const header = req.headers.get("x-admin-key") ?? "";
  const param = req.nextUrl.searchParams.get("key") ?? "";
  const given = header.trim() || param.trim();
  return given !== "" && given === adminKey();
}
