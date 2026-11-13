import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-key";
import { rateLimit } from "@/lib/rate-limit";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

export const runtime = "nodejs";

// ── Admin modul 6: KONTEN — distribusi aset konten (video TikTok) ────────────
// GET /api/admin/video (header x-admin-key atau ?key=)
//
// Proxy video promo Kangenin (sumber: repo GitHub, kangenin-video/out/) supaya
// owner bisa pratinjau + unduh langsung dari Panel Admin — TANPA menaruh file
// berat di folder public/ (situs publik tetap ramping, aset tidak ter-expose).
// Dipanggil sebagai blob dari AdminBoard supaya admin key tidak pernah muncul
// di URL/video element.

// Katalog video konten (sumber: repo GitHub, kangenin-video/out/).
// ?v= memilih video; default tetap video pertama supaya pemakaian lama aman.
const VIDEOS: Record<string, string> = {
  tiktok:
    "https://raw.githubusercontent.com/Risxyiee/Kangenin/main/kangenin-video/out/kangenin-tiktok.mp4",
  confess:
    "https://raw.githubusercontent.com/Risxyiee/Kangenin/main/kangenin-video/out/kangenin-confess-demo.mp4",
};

export async function GET(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json({ error: "nggak ada apa-apa di sini" }, { status: 404 });
    }

    const rl = await rateLimit(req, "admin-video", 20, 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan. Coba lagi nanti ya." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const videoUrl = VIDEOS[req.nextUrl.searchParams.get("v") ?? "tiktok"] ?? VIDEOS.tiktok;
    const up = await fetch(videoUrl, { cache: "no-store" });
    if (!up.ok || !up.body) {
      return NextResponse.json(
        { error: "Video sedang tidak tersedia. Coba lagi sebentar lagi ya." },
        { status: 502 }
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "video/mp4",
      "Cache-Control": "private, no-store",
      "CDN-Cache-Control": "no-store",
    };
    const len = up.headers.get("content-length");
    if (len) headers["Content-Length"] = len;

    return new Response(up.body, { status: 200, headers });
  } catch (err) {
    console.error("GET /api/admin/video error:", describeError(err), err);
    reportError(err, { route: "GET /api/admin/video" });
    return NextResponse.json({ error: "Gagal memuat video. Coba lagi ya." }, { status: 500 });
  }
}
