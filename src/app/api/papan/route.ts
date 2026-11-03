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

/**
 * Salinan sukses terakhir (stale-while-error, per-isolate) — pelengkap
 * filosofi "JANGAN pernah 500-kan feed sosial" di atas. Bukti audit pralaunch
 * 2026-11-03: burst di isolate dingin bisa membuat sebagian attempt kehabisan
 * anggaran retry; daripada menyajikan papan kosong palsu (terlihat seperti
 * tidak ada pengakuan sama sekali), sajikan salinan terakhir yang sukses.
 */
let lastGoodPapan: ShowcaseItem[] | null = null;

// S-07: cache mikro 20 dtk + single-flight. Papan dipanggil SETIAP kunjungan
// beranda (endpoint DB terpanas); burst pengunjung serentak kini berbagi SATU
// query DB, dan kunjungan ulang dalam 20 dtk tak menyentuh DB sama sekali —
// selaras Cache-Control browser max-age=20 yang memang sudah dipakai di bawah.
const PAPAN_TTL_MS = 20_000;
let papanCache: { items: ShowcaseItem[]; at: number } | null = null;
let papanInflight: Promise<ShowcaseItem[]> | null = null;

async function muatPapan(): Promise<ShowcaseItem[]> {
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
  return rows.map(toShowcaseItem);
}

export async function GET() {
  if (papanCache && Date.now() - papanCache.at < PAPAN_TTL_MS) {
    return NextResponse.json(
      { items: papanCache.items },
      {
        headers: {
          "Cache-Control": "public, max-age=20, stale-while-revalidate=40",
          "X-Feed-Source": "cache",
        },
      }
    );
  }

  // single-flight: gabungkan semua cache-miss paralel jadi satu query
  if (!papanInflight) {
    papanInflight = muatPapan()
      .then((items) => {
        papanCache = { items, at: Date.now() };
        lastGoodPapan = items;
        return items;
      })
      .finally(() => {
        papanInflight = null;
      });
  }

  let items: ShowcaseItem[] = [];
  try {
    items = await papanInflight;
  } catch (err) {
    console.error("GET /api/papan error:", err);
    // stale-while-error: salinan terakhir lebih jujur daripada papan kosong
    if (lastGoodPapan) items = lastGoodPapan;
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
