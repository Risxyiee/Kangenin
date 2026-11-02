import { NextRequest, NextResponse } from "next/server";
import { db, withDbRetry, dbNonce, getPgPool } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { isAdmin } from "@/lib/admin-key";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

export const runtime = "nodejs";

// ── Admin modul 1: RINGKASAN — statistik seluruh platform ────────────────────
// GET /api/admin/overview (header x-admin-key atau ?key=)
//
// Satu gambaran penuh buat founder: confess, kado, kado klasik (Gift),
// surat beruntun (LetterSet), reaksi dinding, dan masukan — termasuk tren
// 7 hari terakhir per produk.
//
// Prinsip anti-rapuh: setiap blok statistik dijalankan TERPISAH dan kegagalan
// satu blok (mis. tabel belum pernah dibuat) TIDAK menjatuhkan keseluruhan —
// blok itu dilaporkan null dan UI menampilkan "—". Owner tetap dapat gambaran
// walau satu fitur belum pernah dipakai.

type GRow = { _count: { _all: number } } & Record<string, unknown>;

function groupToMap(rows: GRow[], key: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = String((r as Record<string, unknown>)[key] ?? "?");
    out[k] = Number(r._count._all);
  }
  return out;
}

/** Bungkus query jadi hasil nullable — gagal apa pun (42P01, Hyperdrive) → null. */
async function soft<T>(q: () => Promise<T>): Promise<T | null> {
  try {
    return await withDbRetry(q);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json({ error: "nggak ada apa-apa di sini" }, { status: 404 });
    }

    const rl = await rateLimit(req, "admin-overview", 60, 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan. Coba lagi nanti ya." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Semua blok jalan paralel, masing-masing aman gagal sendiri.
    const [confAgg, confOpened, confResponded, confPublic, confReported, confLast7] =
      await Promise.all([
        soft(() => db.confession.aggregate({ _count: { _all: true }, _sum: { views: true } })),
        soft(() => db.confession.count({ where: { openedAt: { not: null } } })),
        soft(() => db.confession.count({ where: { response: { not: null } } })),
        soft(() => db.confession.count({ where: { isPublic: true } })),
        soft(() => db.confession.count({ where: { reportCount: { gt: 0 } } })),
        soft(() => db.confession.count({ where: { createdAt: { gt: since7 } } })),
      ]);

    const [kadoByStatus, kadoByType, kadoLast7] = await Promise.all([
      soft(() => db.kado.groupBy({ by: ["status"], _count: { _all: true } })),
      soft(() => db.kado.groupBy({ by: ["kadoType"], _count: { _all: true } })),
      soft(() => db.kado.count({ where: { createdAt: { gt: since7 } } })),
    ]);

    const [giftByType, giftAgg, giftLast7] = await Promise.all([
      soft(() => db.gift.groupBy({ by: ["type"], _count: { _all: true } })),
      soft(() => db.gift.aggregate({ _count: { _all: true }, _sum: { views: true } })),
      soft(() => db.gift.count({ where: { createdAt: { gt: since7 } } })),
    ]);

    const [letterAgg, letterCount] = await Promise.all([
      soft(() => db.letterSet.aggregate({ _count: { _all: true }, _sum: { views: true } })),
      soft(() => db.letter.count()),
    ]);

    const reactions = await soft(() =>
      db.reactionCount.aggregate({
        _sum: { heart: true, laugh: true, cry: true, bloom: true },
      })
    );

    // Tren 7 hari — raw SQL dengan identifier berkut (tabel Prisma: "Confession",
    // kolom "createdAt" — PERSIS seperti DDL debug-db, bukan snake_case).
    const nonce = dbNonce();
    const trend = await soft(async () => {
      const res = await db.$queryRawUnsafe<
        { day: string; conf: number; kado: number; gift: number; letter: number }[]
      >(
        `/* ${nonce} */
         with days as (
           select generate_series(current_date - 6, current_date, interval '1 day')::date as d
         )
         select to_char(d, 'YYYY-MM-DD') as day,
                (select count(*) from "Confession" c where c."createdAt"::date = d)::int as conf,
                (select count(*) from "Kado" k where k."createdAt"::date = d)::int as kado,
                (select count(*) from "Gift" g where g."createdAt"::date = d)::int as gift,
                (select count(*) from "LetterSet" l where l."createdAt"::date = d)::int as letter
         from days order by d`
      );
      return res;
    });

    // Masukan (tabel raw feedback, snake_case — belum ada = 0).
    const fb = await soft(async () => {
      const res = await getPgPool().query<{ total: number; last7: number }>(
        `/* ${nonce} */
         select count(*)::int as total,
                count(*) filter (where created_at > now() - interval '7 days')::int as last7
         from feedback`
      );
      return res.rows[0] ?? { total: 0, last7: 0 };
    });

    const sumViews =
      Number(confAgg?._sum.views ?? 0) +
      Number(giftAgg?._sum.views ?? 0) +
      Number(letterAgg?._sum.views ?? 0);

    return NextResponse.json(
      {
        confess: {
          total: Number(confAgg?._count._all ?? 0),
          opened: Number(confOpened ?? 0),
          responded: Number(confResponded ?? 0),
          publicCount: Number(confPublic ?? 0),
          reported: Number(confReported ?? 0),
          last7: Number(confLast7 ?? 0),
        },
        kado: {
          total: Object.values(groupToMap(kadoByType ?? [], "kadoType")).reduce((a, b) => a + b, 0),
          last7: Number(kadoLast7 ?? 0),
          byStatus: groupToMap(kadoByStatus ?? [], "status"),
          byType: groupToMap(kadoByType ?? [], "kadoType"),
        },
        gift: {
          total: Number(giftAgg?._count._all ?? 0),
          views: Number(giftAgg?._sum.views ?? 0),
          last7: Number(giftLast7 ?? 0),
          byType: groupToMap(giftByType ?? [], "type"),
        },
        letter: {
          sets: Number(letterAgg?._count._all ?? 0),
          letters: Number(letterCount ?? 0),
          views: Number(letterAgg?._sum.views ?? 0),
        },
        reactions: {
          heart: Number(reactions?._sum.heart ?? 0),
          laugh: Number(reactions?._sum.laugh ?? 0),
          cry: Number(reactions?._sum.cry ?? 0),
          bloom: Number(reactions?._sum.bloom ?? 0),
        },
        feedback: { total: Number(fb?.total ?? 0), last7: Number(fb?.last7 ?? 0) },
        viewsTotal: sumViews,
        trend: trend ?? null,
      },
      { headers: { "Cache-Control": "no-store, max-age=0", "CDN-Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("GET /api/admin/overview error:", describeError(err), err);
    reportError(err, { route: "GET /api/admin/overview" });
    return NextResponse.json({ error: "Gagal memuat ringkasan. Coba lagi ya." }, { status: 500 });
  }
}
