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
  // SATU query UNION (dulu 3 findUnique paralel): hemat slot pool (1 bukan 3)
  // dan 1 round-trip — jalur /?k= adalah yang terpanas saat link viral.
  // Burst test 2026-11-02: 30 concurrent /?k= → 3×500 (budget withDbRetry
  // habis karena kontensi pool); UNION menekan tekanan pool 3× lipat.
  const rows = await withDbRetry(() =>
    db.$queryRawUnsafe<
      Array<{ kind: string; to_name: string | null; letters: number | null; type: string | null }>
    >(
      `SELECT * FROM (
         SELECT 'confession' AS kind, "toName" AS to_name, NULL::integer AS letters, NULL::text AS type
           FROM "Confession" WHERE "slug" = $1
         UNION ALL
         SELECT 'letterSet', "toName",
                (SELECT COUNT(*)::integer FROM "Letter" WHERE "setId" = "LetterSet"."id"),
                NULL
           FROM "LetterSet" WHERE "slug" = $1
         UNION ALL
         SELECT 'gift', "toName", NULL, "type"
           FROM "Gift" WHERE "slug" = $1
       ) t
       LIMIT 1`,
      slug
    )
  );
  const r = rows[0];
  if (!r) return { confession: null, letterSet: null, gift: null };
  if (r.kind === "confession") {
    return { confession: { toName: r.to_name ?? "" }, letterSet: null, gift: null };
  }
  if (r.kind === "letterSet") {
    return {
      confession: null,
      letterSet: { toName: r.to_name ?? "", _count: { letters: r.letters ?? 0 } },
      gift: null,
    };
  }
  return {
    confession: null,
    letterSet: null,
    gift: { toName: r.to_name ?? "", type: r.type ?? "" },
  };
}

/**
 * Satu pemanggilan = SATU query UNION (confession/letterSet/gift sekaligus).
 * Dua lapis dedup:
 *   1. cache() React — generateMetadata & Page dalam request yang sama
 *      cuma menyebabkan query SEKALI.
 *   2. singleFlight isolat — request berbeda untuk slug sama dalam jendela
 *      3 dtk menumpang satu rangkaian query yang sama.
 */
export const detectKind = cache((slug: string): Promise<KadoKind> =>
  singleFlight(inflight, slug, () => detectKindDb(slug))
);
