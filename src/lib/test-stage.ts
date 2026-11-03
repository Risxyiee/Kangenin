import { notFound } from "next/navigation"

/**
 * Gerbang halaman uji internal (/test-*).
 *
 * Panggung uji (data palsu, tanpa DB) hanya hidup di `next dev` lokal —
 * tempat skrip screenshot Playwright (scripts/shot_*.mjs) bekerja.
 *
 * Di build produksi NODE_ENV=production: notFound() dipanggil saat prerender
 * → rute terbit sebagai 404 → halaman uji TIDAK bisa dibuka siapa pun dari
 * internet. Metadata noindex di tiap layout tetap terpasang sebagai lapis
 * kedua.
 */
export function guardTestStage(): void {
  if (process.env.NODE_ENV === "production") notFound()
}
