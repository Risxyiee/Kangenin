import { NextRequest, NextResponse } from "next/server";
import { getPgPool, withDbRetry } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { isAdmin } from "@/lib/admin-key";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

export const runtime = "nodejs";

// ── Admin modul 5: KUNJUNGAN — halaman paling sering dikunjungi user ─────────
// GET /api/admin/kunjungan (header x-admin-key atau ?key=)
//
// Membaca agregat harian "PageVisitDaily" (diisi otomatis src/middleware.ts,
// satu baris per path per tanggal WIB). Wawasan buat founder: halaman mana
// yang jadi magnet pengunjung — nyala merah kalau ada halaman sepi tak terduga.
//
// Tabel belum dibuat (belum dijalankan SQL setup) → tersedia: false, UI
// menampilkan petunjuk — bukan 500 (prinsip modul lain).

type BarisSql = { path: string; hariIni: number; mingguIni: number; total: number };

function tanggalWib(offsetHari = 0): string {
  return new Date(Date.now() + 7 * 3_600_000 - offsetHari * 86_400_000).toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json({ error: "nggak ada apa-apa di sini" }, { status: 404 });
    }

    const rl = await rateLimit(req, "admin-kunjungan", 60, 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan. Coba lagi nanti ya." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const hariIni = tanggalWib();
    const awalMinggu = tanggalWib(6); // 7 hari terakhir (hari ini + 6 hari mundur)

    const hasil = await withDbRetry(() =>
      getPgPool().query<BarisSql>(
        `select "path",
                coalesce(sum(case when "day" = $1 then "count" end), 0)::int as "hariIni",
                coalesce(sum(case when "day" >= $2 then "count" end), 0)::int as "mingguIni",
                coalesce(sum("count"), 0)::int as total
         from "PageVisitDaily"
         group by "path"
         order by "mingguIni" desc, total desc
         limit 12`,
        [hariIni, awalMinggu]
      )
    );

    const top = hasil.rows.map((r) => ({
      path: r.path,
      hariIni: Number(r.hariIni),
      mingguIni: Number(r.mingguIni),
      total: Number(r.total),
    }));

    return NextResponse.json(
      {
        tersedia: true,
        hariIni: top.reduce((a, b) => a + b.hariIni, 0),
        mingguIni: top.reduce((a, b) => a + b.mingguIni, 0),
        total: top.reduce((a, b) => a + b.total, 0),
        top,
      },
      { headers: { "Cache-Control": "no-store, max-age=0", "CDN-Cache-Control": "no-store" } }
    );
  } catch (err) {
    // 42P01 = tabel belum ada → jawab sopan supaya UI bisa menampilkan setup
    const code = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (code === "42P01" || /does not exist/i.test(msg)) {
      return NextResponse.json({ tersedia: false, hariIni: 0, mingguIni: 0, total: 0, top: [] });
    }
    console.error("GET /api/admin/kunjungan error:", describeError(err), err);
    reportError(err, { route: "GET /api/admin/kunjungan" });
    return NextResponse.json(
      { error: "Gagal memuat kunjungan. Coba lagi ya." },
      { status: 503 }
    );
  }
}
