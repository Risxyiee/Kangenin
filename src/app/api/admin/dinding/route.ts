import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, withDbRetry, dbNonce } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { isAdmin } from "@/lib/admin-key";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

export const runtime = "nodejs";

// ── Admin modul 3: MODERASI DINDING KANGENIN ─────────────────────────────────
// GET   /api/admin/dinding — semua confess yang tampil di dinding ATAU pernah
//                          dilaporkan (reportCount > 0), terbaru dulu.
// PATCH /api/admin/dinding — aksi moderasi:
//   hide   → isPublic = false + showMessage = false (surat keluar dari dinding
//            DAN Papan Pengakuan, datanya utuh)
//   unhide → isPublic = true + reportCount di-reset (sudah direview owner);
//            showMessage tidak disentuh — kalau sebelumnya ikut papan,
//            otomatis muncul lagi di papan
//   delete → hapus permanen (reaksi ikut terhapus lewat cascade)
//
// Catatan privasi: isi surat hanya kelihatan di sini (gerbang admin), dan UI
// menyimpannya tersembunyi sampai owner menekan "lihat isi" — keputusan
// moderasi butuh isi, dinding publik tetap cuma nama + tema.

const patchSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["hide", "unhide", "delete"]),
});

export async function GET(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json({ error: "nggak ada apa-apa di sini" }, { status: 404 });
    }

    const rl = await rateLimit(req, "admin-dinding", 60, 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan. Coba lagi nanti ya." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const nonce = dbNonce();
    // ?semua=1 → sertakan surat privat/tersembunyi 30 hari terakhir.
    // Entri tersembunyi tanpa laporan tidak masuk daftar default, jadi
    // salah-klik "Sembunyikan" tidak bisa dibatalkan dari panel (bukti
    // produksi 2026-11-04) — mode ini jadi jalan pemulihannya. Mode ini
    // tetap gerbang admin: isi surat di UI tetap tersembunyi sampai owner
    // menekan "lihat isi".
    const semua = req.nextUrl.searchParams.get("semua") === "1";
    const sejak = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await withDbRetry(() =>
      db.confession.findMany({
        where: semua
          ? { createdAt: { gte: sejak } }
          : { OR: [{ isPublic: true }, { reportCount: { gt: 0 } }] },
        orderBy: { createdAt: "desc" },
        take: semua ? 120 : 80,
        select: {
          id: true,
          fromName: true,
          toName: true,
          theme: true,
          message: true,
          isPublic: true,
          showMessage: true,
          showAs: true,
          reportCount: true,
          views: true,
          response: true,
          createdAt: true,
          reactions: { select: { heart: true, laugh: true, cry: true, bloom: true } },
        },
      })
    );

    return NextResponse.json(
      {
        items: rows.map((r) => ({
          id: r.id,
          from: r.fromName.trim() || "Seseorang",
          to: r.toName,
          theme: r.theme,
          message: r.message,
          isPublic: r.isPublic,
          showMessage: r.showMessage,
          showAs: r.showAs,
          reportCount: r.reportCount,
          views: r.views,
          answered: r.response !== null && r.response !== undefined,
          createdAt: r.createdAt.toISOString(),
          reactions: r.reactions ?? { heart: 0, laugh: 0, cry: 0, bloom: 0 },
        })),
        nonce,
      },
      { headers: { "Cache-Control": "no-store, max-age=0", "CDN-Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("GET /api/admin/dinding error:", describeError(err), err);
    reportError(err, { route: "GET /api/admin/dinding" });
    return NextResponse.json({ error: "Gagal memuat dinding. Coba lagi ya." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json({ error: "nggak ada apa-apa di sini" }, { status: 404 });
    }

    const rl = await rateLimit(req, "admin-dinding-write", 60, 60 * 1000);
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
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Aksi moderasi tidak valid" }, { status: 400 });
    }

    const { id, action } = parsed.data;

    if (action === "delete") {
      // ReactionCount punya onDelete: Cascade → reaksi ikut terhapus.
      const del = await withDbRetry(() =>
        db.confession.delete({ where: { id }, select: { id: true } })
      );
      if (!del) {
        return NextResponse.json({ error: "Suratnya tidak ditemukan" }, { status: 404 });
      }
      return NextResponse.json(
        { success: true, action },
        { headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    const data =
      action === "hide"
        ? { isPublic: false, showMessage: false } // keluar dari dinding + papan sekaligus
        : { isPublic: true, reportCount: 0 }; // unhide: laporan sudah direview

    const upd = await withDbRetry(() =>
      db.confession.update({ where: { id }, data, select: { id: true, isPublic: true } })
    );
    if (!upd) {
      return NextResponse.json({ error: "Suratnya tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(
      { success: true, action, isPublic: upd.isPublic },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    console.error("PATCH /api/admin/dinding error:", describeError(err), err);
    reportError(err, { route: "PATCH /api/admin/dinding" });
    return NextResponse.json({ error: "Gagal memoderasi surat. Coba lagi ya." }, { status: 500 });
  }
}
