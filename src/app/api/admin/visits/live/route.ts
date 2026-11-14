import { NextRequest, NextResponse } from "next/server";
import { getPgPool, withDbRetry } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { isAdmin } from "@/lib/admin-key";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

export const runtime = "nodejs";

// ── Realtime: denyut pengunjung LIVE (modul Kunjungan + WA bot) ──────────────
// GET /api/admin/visits/live (header x-admin-key atau ?key=)
//
// Dibaca Panel Admin (auto-refresh tiap 5 dtk) dan perintah WA bot
// "pengunjung". SATU query agregat + SATU query "sedang membuka" — aman buat
// polling. "Online" = sesi dengan lastSeen < 60 dtk (beacon ping tiap 30 dtk).

type AgregatSql = {
  online1m: number;
  online5m: number;
  unikHariIni: number;
  viewsHariIni: number;
  baru1jam: number;
};

export async function GET(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json({ error: "nggak ada apa-apa di sini" }, { status: 404 });
    }

    const rl = await rateLimit(req, "admin-visits-live", 60, 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan. Coba lagi nanti ya." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const agg = await withDbRetry(() =>
      getPgPool().query<AgregatSql>(
        `select
           count(*) filter (where "lastSeen" > now() - interval '60 seconds')::int as "online1m",
           count(*) filter (where "lastSeen" > now() - interval '5 minutes')::int as "online5m",
           count(*) filter (where ("firstSeen" at time zone 'Asia/Jakarta')::date
                             = (now() at time zone 'Asia/Jakarta')::date)::int as "unikHariIni",
           coalesce(sum("views") filter (
             where ("firstSeen" at time zone 'Asia/Jakarta')::date
                   = (now() at time zone 'Asia/Jakarta')::date), 0)::int as "viewsHariIni",
           count(*) filter (where "firstSeen" > now() - interval '1 hour')::int as "baru1jam"
         from "VisitLive"`
      )
    );

    // halaman yang sedang dibuka (2 menit terakhir) — wawasan live
    const paths = await getPgPool()
      .query<{ path: string; orang: number }>(
        `select "path", count(*)::int as orang
         from "VisitLive"
         where "lastSeen" > now() - interval '2 minutes'
         group by "path" order by orang desc limit 6`
      )
      .catch(() => ({ rows: [] as { path: string; orang: number }[] }));

    const a = agg.rows[0] ?? { online1m: 0, online5m: 0, unikHariIni: 0, viewsHariIni: 0, baru1jam: 0 };
    return NextResponse.json(
      {
        tersedia: true,
        online1m: Number(a.online1m),
        online5m: Number(a.online5m),
        unikHariIni: Number(a.unikHariIni),
        viewsHariIni: Number(a.viewsHariIni),
        baru1jam: Number(a.baru1jam),
        sedangMembuka: paths.rows.map((r) => ({ path: r.path, orang: Number(r.orang) })),
      },
      { headers: { "Cache-Control": "no-store, max-age=0", "CDN-Cache-Control": "no-store" } }
    );
  } catch (err) {
    const code = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (code === "42P01" || /does not exist/i.test(msg)) {
      return NextResponse.json({
        tersedia: false,
        online1m: 0,
        online5m: 0,
        unikHariIni: 0,
        viewsHariIni: 0,
        baru1jam: 0,
        sedangMembuka: [],
      });
    }
    console.error("GET /api/admin/visits/live error:", describeError(err), err);
    reportError(err, { route: "GET /api/admin/visits/live" });
    return NextResponse.json({ error: "Gagal memuat denyut realtime." }, { status: 500 });
  }
}
