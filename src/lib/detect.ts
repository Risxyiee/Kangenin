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

export type KadoKind = {
  confession: { toName: string } | null;
  letterSet: { toName: string; _count: { letters: number } } | null;
  gift: { toName: string; type: string } | null;
};

/**
 * Satu pemanggilan = 3 findUnique paralel (confession / letterSet / gift).
 * cache() dari React: kalau generateMetadata dan Page memanggil ini di
 * request yang sama, query cuma jalan SEKALI.
 */
export const detectKind = cache(async (slug: string): Promise<KadoKind> => {
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
});
