import { NextResponse } from "next/server";
import { db, withDbRetry } from "@/lib/db";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";
import { toFomoInitials } from "@/utils/fomoLogic";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────────
// Ticker aktivitas landing page — "R***A baru saja menampilkan pesan di dinding".
//
// JENIS KEJADIAN (semua NYATA dari DB, tidak ada yang direkayasa):
//   dinding    → Confession isPublic=true, NAMA disamarkan (opt-in pajang)
//   papan      → Confession showMessage=true, nama cuma kalau showAs 'nama'
//   kado       → Gift.openedAt (penerima membuka kado; tanpa nama)
//   surat      → Confession.createdAt APA PUN (privat ikut) — tanpa nama:
//                "Seseorang menulis surat rahasia". Kejadian paling sering
//                → inilah yang bikin ticker terasa realtime.
//   bikin-kado → Gift.createdAt — tanpa nama.
//
// ANTI-SISA-AUDIT (temuan 2026-11-06): 7 kejadian "kado dibuka" pertama
// ternyata bekas audit_all_flows.sh / test-gifts-e2e.sh tanggal 1 Nov
// (fromName "Audit", toName "Uji Buket" dst. — 3 open dalam 34 detik = pola
// bot). Semua cabang kini mengkecualikan penanda uji, jadi ticker HANYA
// menampilkan aktivitas manusia sungguhan meski sapu panel belum jalan.
//
// ISI SURAT / PESAN TIDAK PERNAH IKUT. Masking dilakukan DI SERVER.
// Satu statement UNION (aturan Hyperdrive) + cache isolate 45 dtk +
// stale-while-error + fallback kosong — filosofi /api/wall.
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
            AND "fromName" NOT IN ('QA Bot', 'AuditBot', 'Audit', 'TesBot')
            AND "createdAt" >= now() - interval '${JENDELA_HARI} days'
         UNION ALL
         SELECT 'papan', CASE WHEN "showAs" = 'nama' THEN "fromName" ELSE '' END, "createdAt"
           FROM "Confession"
          WHERE "isPublic" = TRUE AND "reportCount" < 3 AND "showMessage" = TRUE
            AND "fromName" NOT IN ('QA Bot', 'AuditBot', 'Audit', 'TesBot')
            AND "createdAt" >= now() - interval '${JENDELA_HARI} days'
         UNION ALL
         SELECT 'surat', NULL, "createdAt"
           FROM "Confession"
          WHERE "fromName" NOT IN ('QA Bot', 'AuditBot', 'Audit', 'TesBot')
            AND "createdAt" >= now() - interval '${JENDELA_HARI} days'
         UNION ALL
         SELECT 'kado', NULL, "openedAt"
           FROM "Gift"
          WHERE "openedAt" IS NOT NULL
            AND "fromName" NOT IN ('QA Bot', 'AuditBot', 'Audit')
            AND "toName" NOT LIKE 'Uji %'
            AND "openedAt" >= now() - interval '${JENDELA_KADO_HARI} days'
         UNION ALL
         SELECT 'bikin-kado', NULL, "createdAt"
           FROM "Gift"
          WHERE "fromName" NOT IN ('QA Bot', 'AuditBot', 'Audit')
            AND "toName" NOT LIKE 'Uji %'
            AND "createdAt" >= now() - interval '${JENDELA_HARI} days'
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
