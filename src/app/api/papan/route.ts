// ─────────────────────────────────────────────────────────────────────────────
// GET /api/papan — feed publik Papan Pengakuan (dipanggil client-side oleh
// ShowcaseSection di beranda).
//
// KENAPA ENDPOINT INI ADA (perbaikan Error 1102 "Worker exceeded resource
// limits"): dulu feed papan dijalankan di SSR beranda — query + mask kontak +
// render 28 kartu marquee di SETIAP request halaman depan. Beranda = halaman
// terpanas situs, jadi CPU Worker (budget ketat di plan free) kepangkas terus.
// Sekarang SSR beranda nol query DB; papan nyusul setelah hidrasi.
//
// Garis keamanan (sama dengan sebelumnya):
//   - Hanya confess opt-in ganda: showMessage && isPublic, reportCount < 3
//   - Isi lewat maskKontak (email/URL/no HP → [disembunyikan])
//   - Nama lengkap TIDAK pernah keluar — cuma nama depan / "Seseorang"
//   - Tanpa slug/id/link — papan cuma tampilan, gak bisa diintip lebih
//   - DB gagal → { items: [] } 200, JANGAN pernah 500-kan feed sosial
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { db, withDbRetry } from "@/lib/db";
import { toShowcaseItem, type ShowcaseItem } from "@/lib/papan";

// Halaman depan memanggil ini tiap kunjungan — jangan di-cache Next di server.
export const dynamic = "force-dynamic";

export async function GET() {
  let items: ShowcaseItem[] = [];
  try {
    const rows = await withDbRetry(() =>
      db.confession.findMany({
        where: { showMessage: true, isPublic: true, reportCount: { lt: 3 } },
        orderBy: { createdAt: "desc" },
        take: 14,
        select: {
          id: true,
          fromName: true,
          showAs: true,
          toName: true,
          theme: true,
          message: true,
          createdAt: true,
          response: true,
        },
      })
    );
    items = rows.map(toShowcaseItem);
  } catch (err) {
    console.error("GET /api/papan error:", err);
  }

  return NextResponse.json(
    { items },
    // browser: 20 dtk cukup buat navigasi balik-ke-beranda; Hyperdrive yang
    // mendedup query origin (cache query 60 dtk aktif di sisi DB)
    {
      headers: {
        "Cache-Control": "public, max-age=20, stale-while-revalidate=40",
      },
    }
  );
}
