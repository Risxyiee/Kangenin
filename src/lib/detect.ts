// ─────────────────────────────────────────────────────────────────────────────
// Deteksi jenis konten dari slug (?k=) — dipakai BERSAMA oleh generateMetadata
// dan Page di src/app/page.tsx.
//
// KENAPA ADA FILE INI (perbaikan Error 1102 "Worker exceeded resource limits"):
// dulu metadata dan Page masing-masing menjalankan 3 findUnique yang IDENTIK →
// 6 query DB per buka link kado, di jalur TERPANAS (link viral WA). React
// cache() mendedup keduanya dalam satu request → 3 query, CPU & beban DB
// turun separuh di jalur paling kritis saat link disebar massal.
// ─────────────────────────────────────────────────────────────────────────────

import { cache } from "react";
import { db, withDbRetry } from "@/lib/db";
import { singleFlight } from "@/lib/singleflight";

export type KadoKind = {
  confession: { toName: string } | null;
  letterSet: { toName: string; _count: { letters: number } } | null;
  gift: { toName: string; type: string } | null;
};

// single-flight lintas request dalam satu isolate: 30 orang buka link yang
// sama bersamaan → cukup 1 rangkaian query, sisanya menumpang hasil
// (burst test 2026-11-02: 3×500 pada /?k= saat 30 concurrent sama-sama kejar
// pool yang cuma 5 slot per isolate)
const inflight = new Map<string, { at: number; p: Promise<KadoKind> }>();

async function detectKindDb(slug: string): Promise<KadoKind> {
  const [confession, letterSet, gift] = await withDbRetry(() =>
    Promise.all([
      db.confession.findUnique({
        where: { slug },
        select: { toName: true },
      }),
      db.letterSet.findUnique({
        where: { slug },
        select: { toName: true, _count: { select: { letters: true } } },
      }),
      db.gift.findUnique({
        where: { slug },
        select: { toName: true, type: true },
      }),
    ])
  );
  return { confession, letterSet, gift };
}

/**
 * Satu pemanggilan = 3 findUnique paralel (confession / letterSet / gift).
 * Dua lapis dedup:
 *   1. cache() React — generateMetadata & Page dalam request yang sama
 *      cuma menyebabkan query SEKALI.
 *   2. singleFlight isolat — request berbeda untuk slug sama dalam jendela
 *      3 dtk menumpang satu rangkaian query yang sama.
 */
export const detectKind = cache((slug: string): Promise<KadoKind> =>
  singleFlight(inflight, slug, () => detectKindDb(slug))
);
