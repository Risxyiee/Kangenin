import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getPgPool, withDbRetry } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { describeError } from "@/lib/log-error";

export const runtime = "nodejs";

// ── Realtime: beacon kunjungan publik ────────────────────────────────────────
// POST /api/track/visit  { sid, path, kind: "view" | "ping" }
//
// Dipanggil dari VisitBeacon (client, src/components/tracker): sekali "view"
// saat halaman dibuka/ganti route + "ping" tiap 30 dtk selama tab terbuka.
// Server meng-upsert baris sesi di "VisitLive" (sid → lastSeen) — dasar
// hitungan "online sekarang" (lastSeen < 60 dtk) di Panel Admin + WA bot.
//
// Privasi: sid acak dari localStorage, di-hash server (SHA-256 + salt) sebelum
// disimpan; tidak ada IP, UA, atau identitas apa pun yang direkam.
// Gagal apa pun (tabel belum dibuat, Hyperdrive rewel) senyap — tracking
// opsional, jangan pernah mengganggu halaman.

const SALT = process.env.TRACK_SALT ?? "kangenin-live-v1";

function tanggalSesi(sid: string): string {
  // sid acak dari klien di-hash (SHA-256 + salt) sebelum disimpan
  return createHash("sha256").update(`${SALT}:${sid}`).digest("hex").slice(0, 40);
}

export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(req, "track-visit", 30, 60 * 1000);
    if (!rl.ok) return NextResponse.json({ ok: false }, { status: 429 });

    type PingBody = { sid?: unknown; path?: unknown; kind?: unknown };
    let body: PingBody | null = null;
    try {
      body = (await req.json()) as PingBody;
    } catch {
      body = null;
    }
    const sid = typeof body?.sid === "string" ? body.sid : "";
    const path = typeof body?.path === "string" ? body.path : "/";
    const kind = body?.kind === "view" ? "view" : "ping";
    if (!/^[a-zA-Z0-9-]{8,64}$/.test(sid)) {
      return NextResponse.json({ error: "sid tidak valid" }, { status: 400 });
    }
    if (path.length > 200 || path.includes("..") || !path.startsWith("/")) {
      return NextResponse.json({ error: "path tidak valid" }, { status: 400 });
    }

    const views = kind === "view" ? 1 : 0;
    await withDbRetry(
      () =>
        getPgPool().query(
          `insert into "VisitLive" ("sid", "path", "views", "firstSeen", "lastSeen")
           values ($1, $2, $3, now(), now())
           on conflict ("sid") do update
             set "lastSeen" = now(),
                 "path"    = $2,
                 "views"   = "VisitLive"."views" + $3`,
          [tanggalSesi(sid), path, views]
        ),
      { budgetMs: 8_000 }
    );

    // 4% panggilan ikut membuang sesi >3 jam tak aktif — meja tetap kecil
    // tanpa cron tambahan.
    if (Math.random() < 0.04) {
      await getPgPool()
        .query(`delete from "VisitLive" where "lastSeen" < now() - interval '3 hours'`)
        .catch(() => {});
    }

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store", "CDN-Cache-Control": "no-store" } }
    );
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42P01") {
      // tabel belum dibuat → senyap (prinsip track-kunjungan)
      return NextResponse.json({ ok: false, tersedia: false });
    }
    console.error("POST /api/track/visit error:", describeError(err), err);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
