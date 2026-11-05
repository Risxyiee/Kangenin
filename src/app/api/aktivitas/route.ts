import { NextResponse } from "next/server";
import { db, withDbRetry } from "@/lib/db";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";
import { toFomoInitials } from "@/utils/fomoLogic";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────────
// Ticker aktivitas landing page — "R***A baru saja menampilkan pesan di dinding".
//
// SUMBER DATA (semua opt-in publik, NAMA SELALU DISAMARKAN di sini di server):
//   dinding → Confession isPublic=true (pengirim sadar memajang di dinding)
//   papan   → Confession showMessage=true (membagikan pengakuan; showAs 'nama'
//             baru memakai nama — kalau 'anonim' → "Seseorang")
//   kado    → Gift.openedAt (penerima membuka kadonya; TANPA nama siapa pun)
//
// ISI SURAT / PESAN TIDAK PERNAH IKUT. Yang lewat kabel cuma: jenis, nama
// bertopeng (toFomoInitials, mis. "Rifka" → "R***A"), dan waktu. Masking
// dilakukan DI SERVER — klien tidak pernah menerima nama asli.
//
// Satu statement UNION (aturan Hyperdrive: 1 query per panggilan) + cache
// isolate 45 dtk + stale-while-error + fallback kosong — filosofi /api/wall:
// feed sosial TIDAK BOLEH 500, landing page tidak boleh makin berat.
// ─────────────────────────────────────────────────────────────────────────────

type Row = { jenis: string; nama: string | null; waktu: Date };

// Jendela "terbaru": dinding & papan 7 hari (agar terasa hidup, tetap jujur —
// waktu ditampilkan), kado dibuka sampai 30 hari (kado dibuka jarang, tapi
// tetap sinyal bagus bahwa ada yang memakai situs ini).
const JENDELA_HARI = 7;
const JENDELA_KADO_HARI = 30;

let cache: { at: number; payload: string } | null = null;
let lastGood: string | null = null;
let inflight: Promise<string> | null = null;

const TTL_MS = 45_000;

function maskNama(raw: string | null): string | null {
  const nama = (raw ?? "").trim();
  if (!nama) return null; // klien menampilkan "Seseorang"
  return toFomoInitials(nama); // "Rifka" → "R***A", "Putri Ayu" → "P***U"
}

async function muatAktivitas(): Promise<string> {
  const rows = await withDbRetry(() =>
    db.$queryRawUnsafe<Row[]>(
      `SELECT * FROM (
         SELECT 'dinding' AS jenis, "fromName" AS nama, "createdAt" AS waktu
           FROM "Confession"
          WHERE "isPublic" = TRUE AND "reportCount" < 3 AND "showMessage" = FALSE
            AND "createdAt" >= now() - interval '${JENDELA_HARI} days'
         UNION ALL
         SELECT 'papan', CASE WHEN "showAs" = 'nama' THEN "fromName" ELSE '' END, "createdAt"
           FROM "Confession"
          WHERE "isPublic" = TRUE AND "reportCount" < 3 AND "showMessage" = TRUE
            AND "createdAt" >= now() - interval '${JENDELA_HARI} days'
         UNION ALL
         SELECT 'kado', NULL, "openedAt"
           FROM "Gift"
          WHERE "openedAt" IS NOT NULL
            AND "openedAt" >= now() - interval '${JENDELA_KADO_HARI} days'
       ) t
       ORDER BY waktu DESC
       LIMIT 24`
    )
  );

  const payload = JSON.stringify({
    items: rows.map((r) => ({
      jenis: r.jenis,
      nama: maskNama(r.nama),
      waktu: new Date(r.waktu).toISOString(),
    })),
  });
  return payload;
}

function jsonHeaders(sumber: "fresh" | "stale"): HeadersInit {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120",
    ...(sumber === "stale" ? { "X-Feed-Source": "stale" } : {}),
  };
}

export async function GET() {
  // 1. cache isolate masih panas → nol biaya DB
  if (cache && Date.now() - cache.at < TTL_MS) {
    return new NextResponse(cache.payload, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120",
        "X-Feed-Source": "cache",
      },
    });
  }

  // 2. single-flight: burst bersamaan = SATU query, sisanya menumpang
  if (!inflight) {
    inflight = muatAktivitas()
      .then((payload) => {
        cache = { at: Date.now(), payload };
        lastGood = payload;
        return payload;
      })
      .finally(() => {
        inflight = null;
      });
  }

  try {
    const payload = await inflight;
    return new NextResponse(payload, { headers: jsonHeaders("fresh") });
  } catch (err) {
    console.error("GET /api/aktivitas error:", describeError(err), err);
    reportError(err, { route: "GET /api/aktivitas" });

    // stale-while-error: salinan sukses terakhir di isolate ini
    if (lastGood) {
      return new NextResponse(lastGood, { headers: jsonHeaders("stale") });
    }

    // isolate segar yang belum pernah sukses — tetap 200 kosong, ticker-nya
    // saja yang tidak muncul; landing page tidak boleh kena efek error.
    return NextResponse.json({ items: [] }, { headers: { "X-Feed-Source": "fallback-empty" } });
  }
}
