import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withDbRetry, dbNonce, getPgPool } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { isAdmin } from "@/lib/admin-key";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

export const runtime = "nodejs";

// ── Admin modul 4: KEAMANAN & KESEHATAN ──────────────────────────────────────
// GET  /api/admin/keamanan — tiga panel:
//   1. Denyut database: latensi ping `select 1` (deteksi dini Hyperdrive rewel)
//   2. Rate limit aktif 24 jam teratas — siapa yang menghajar endpoint
//      (tabel rate_limit, diisi otomatis src/lib/rate-limit.ts)
//   3. Log error terbaru (tabel error_log, diisi reportError() S-05)
// POST /api/admin/keamanan — perawatan:
//   { action: "sapu-rate-limit" }  → hapus entri window > 1 hari (basi, aman:
//                                    limiter memang menyapunya otomatis)
//   { action: "bersihkan-error" }  → kosongkan error_log (setelah dibaca)
//   { action: "sapu-qa" }          → hapus semua confess/kado uji ber-tanda
//                                    "QA Bot"/"AuditBot" (dipakai juga oleh
//                                    cleanup otomatis E2E Playwright)
//
// Tabel infrastruktur belum dibuat (belum ada traffic/error) → panel tampil
// kosong, bukan 500 — prinsip yang sama dengan modul lain.

const postSchema = z.object({
  action: z.enum(["sapu-rate-limit", "bersihkan-error", "sapu-qa"]),
});

type RateRow = { key: string; count: number; window_start: string };
type ErrorRow = { id: string; route: string; message: string; created_at: string };

export async function GET(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json({ error: "nggak ada apa-apa di sini" }, { status: 404 });
    }

    const rl = await rateLimit(req, "admin-keamanan", 60, 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan. Coba lagi nanti ya." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    // 1) Denyut database — ukur latensi nyata dari Worker ke origin.
    let dbOk = false;
    let dbLatencyMs: number | null = null;
    try {
      const t0 = Date.now();
      await withDbRetry(() => getPgPool().query("select 1"));
      dbOk = true;
      dbLatencyMs = Date.now() - t0;
    } catch {
      dbOk = false;
    }

    const nonce = dbNonce();
    const pool = getPgPool();

    // 2) Rate limit aktif (42P01 → tabel belum ada → null)
    const rateRows = await pool
      .query<RateRow>(
        `/* ${nonce} */
         select key, count, window_start
         from rate_limit
         where window_start > now() - interval '1 day'
         order by count desc
         limit 25`
      )
      .then((r) => r.rows)
      .catch(() => null);

    const rateTotal = await pool
      .query<{ n: number }>(
        `/* ${nonce} */
         select count(*)::int as n from rate_limit where window_start > now() - interval '1 day'`
      )
      .then((r) => Number(r.rows[0]?.n ?? 0))
      .catch(() => 0);

    // 3) Log error
    const errRows = await pool
      .query<ErrorRow>(
        `/* ${nonce} */
         select id, route, message, created_at
         from error_log
         order by created_at desc
         limit 30`
      )
      .then((r) => r.rows)
      .catch(() => null);

    const errCounts = await pool
      .query<{ h24: number; d7: number; total: number }>(
        `/* ${nonce} */
         select count(*) filter (where created_at > now() - interval '24 hours')::int as h24,
                count(*) filter (where created_at > now() - interval '7 days')::int as d7,
                count(*)::int as total
         from error_log`
      )
      .then((r) => r.rows[0])
      .catch(() => null);

    return NextResponse.json(
      {
        db: { ok: dbOk, latencyMs: dbLatencyMs },
        rateLimit: {
          available: rateRows !== null,
          total24h: rateTotal,
          top: (rateRows ?? []).map((r) => ({
            key: r.key,
            count: Number(r.count),
            windowStart: r.window_start,
          })),
        },
        errors: {
          available: errRows !== null,
          h24: Number(errCounts?.h24 ?? 0),
          d7: Number(errCounts?.d7 ?? 0),
          total: Number(errCounts?.total ?? 0),
          items: (errRows ?? []).map((r) => ({
            id: String(r.id),
            route: r.route,
            message: r.message,
            createdAt: r.created_at,
          })),
        },
      },
      { headers: { "Cache-Control": "no-store, max-age=0", "CDN-Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("GET /api/admin/keamanan error:", describeError(err), err);
    reportError(err, { route: "GET /api/admin/keamanan" });
    return NextResponse.json(
      { error: "Gagal memuat panel keamanan. Coba lagi ya." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json({ error: "nggak ada apa-apa di sini" }, { status: 404 });
    }

    const rl = await rateLimit(req, "admin-keamanan-write", 30, 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan. Coba lagi nanti ya." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Format request tidak valid" }, { status: 400 });
    }
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Aksi tidak valid" }, { status: 400 });
    }

    const nonce = dbNonce();
    if (parsed.data.action === "sapu-qa") {
      // Sapu data uji otomatis (E2E Playwright & audit manual):
      // - Confession dari penanda uji: "QA Bot", "AuditBot", "Audit"
      //   (audit_all_flows.sh), "TesBot" — termasuk yang private, karena
      //   tidak akan muncul di moderasi dinding
      // - Kado model baru dari "QA Bot"/"AuditBot" (penanda uji E2E & audit)
      // - Gift model lama: audit_all_flows.sh (fromName "Audit", toName
      //   "Tes Alur") & test-gifts-e2e.sh (toName "Uji Buket" dst.) —
      //   openedAt-nya sempat bocor ke ticker aktivitas landing 2026-11-06
      // - LetterSet dari penanda uji yang sama
      // Reaksi confess ikut terhapus lewat cascade FK ReactionCount.
      //
      // SETIAP statement = SATU query TERPISAH, bukan satu string "a; b".
      // Bukti produksi 2026-11-04: multi-statement dalam SATU pool.query()
      // lewat Hyperdrive selalu gagal → 500 "Gagal menjalankan perawatan"
      // di panel. Satu statement per query = pola yang sama dengan semua
      // route lain yang terbukti hidup. Bonus: rowCount per tabel akurat.
      const penandaUji = "('QA Bot', 'AuditBot', 'Audit', 'TesBot', 'Tester', 'Tim Kangenin')";
      const hapusConfess = await withDbRetry(() =>
        getPgPool().query(
          `/* ${nonce} */ delete from "Confession" where "fromName" in ${penandaUji} or "toName" like 'Uji %' or "toName" like 'Tujuan %' or "toName" = 'Calon Pengguna'`
        )
      );
      const hapusKado = await withDbRetry(() =>
        getPgPool().query(
          `/* ${nonce} */ delete from "Kado" where "senderName" in ('QA Bot', 'AuditBot')`
        )
      );
      const hapusGift = await withDbRetry(() =>
        getPgPool().query(
          `/* ${nonce} */ delete from "Gift" where "fromName" in ('QA Bot', 'AuditBot', 'Audit', 'Tester', 'Tim Kangenin') or "toName" in ('Tes Alur', 'Uji Buket', 'Uji Foto', 'Uji Kue', 'Uji Kupon', 'Calon Pengguna')`
        )
      );
      const hapusSuratSet = await withDbRetry(() =>
        getPgPool().query(
          `/* ${nonce} */ delete from "LetterSet" where "fromName" in ${penandaUji}`
        )
      );
      return NextResponse.json(
        {
          success: true,
          deleted:
            (hapusConfess.rowCount ?? 0) +
            (hapusKado.rowCount ?? 0) +
            (hapusGift.rowCount ?? 0) +
            (hapusSuratSet.rowCount ?? 0),
        },
        { headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    const sql =
      parsed.data.action === "sapu-rate-limit"
        ? `/* ${nonce} */ delete from rate_limit where window_start < now() - interval '1 day'`
        : `/* ${nonce} */ delete from error_log`;

    const res = await withDbRetry(() => getPgPool().query(sql));

    return NextResponse.json(
      { success: true, deleted: res.rowCount ?? 0 },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    console.error("POST /api/admin/keamanan error:", describeError(err), err);
    reportError(err, { route: "POST /api/admin/keamanan" });
    return NextResponse.json({ error: "Gagal menjalankan perawatan. Coba lagi ya." }, { status: 500 });
  }
}
