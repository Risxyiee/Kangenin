import { NextRequest, NextResponse } from "next/server";
import { getPgPool, withDbRetry } from "@/lib/db";
import { isAdmin } from "@/lib/admin-key";
import { describeError } from "@/lib/log-error";

export const runtime = "nodejs";

// ── S-08: pencatat kunjungan halaman (INTERNAL) ──────────────────────────────
// DIPANGGIL DARI worker-entry.js secara internal (bukan dari browser!): tiap
// GET halaman publik memicu panggilan internal di sini via ctx.waitUntil —
// fire-and-forget, nol biaya subrequest jaringan, tak bisa dipanggil pihak
// luar karena gerbang isAdmin (tanpa ADMIN_KEY terpasang, tracking mati
// total — fail-closed, konsisten dengan gerbang admin lain).
//
// Payload { path }: upsert ke agregat harian "PageVisitDaily" (path × tanggal
// WIB) — bahan modul "Kunjungan" di Panel Admin. Gagal apa pun (tabel belum
// dibuat, Hyperdrive rewel) TIDAK PERNAH memengaruhi halaman: cukup log.

function tanggalWib(): string {
  return new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json({ error: "nggak ada apa-apa di sini" }, { status: 404 });
    }

    let body: { path?: unknown } | null = null;
    try {
      body = (await req.json()) as { path?: unknown };
    } catch {
      body = null;
    }
    const path = typeof body?.path === "string" ? body.path : "";
    if (!path || path.length > 200 || path.includes("..") || !path.startsWith("/")) {
      return NextResponse.json({ error: "path tidak valid" }, { status: 400 });
    }

    await withDbRetry(
      () =>
        getPgPool().query(
          `insert into "PageVisitDaily" ("path", "day", "count") values ($1, $2, 1)
           on conflict ("path", "day") do update set "count" = "PageVisitDaily"."count" + 1`,
          [path, tanggalWib()]
        ),
      { budgetMs: 8_000 }
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Tabel belum dibuat (42P01) → senyap total: tracking opsional, jangan
    // menggenangi error_log sebelum user menjalankan SQL setup.
    const code = (err as { code?: string })?.code;
    if (code === "42P01") {
      return NextResponse.json({ ok: false, tersedia: false });
    }
    console.error("POST /api/track-kunjungan error:", describeError(err), err);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
