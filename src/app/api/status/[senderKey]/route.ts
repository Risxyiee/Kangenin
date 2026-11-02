import { NextRequest, NextResponse } from "next/server";
import { db, withDbRetry } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

// Halaman status pengirim: GET /api/status/<senderKey>
// Mendukung dua jenis kado: confess & open-when letters.
// Tidak menambah counter buka (aman untuk dicek berkali-kali).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ senderKey: string }> }
) {
  try {
    const { senderKey } = await params;

    const confession = await withDbRetry(() =>
      db.confession.findUnique({
        where: { senderKey },
      select: {
        slug: true,
        fromName: true,
        toName: true,
        theme: true,
        response: true,
        reply: true,
        repliedAt: true,
        views: true,
        reportCount: true,
        createdAt: true,
        openedAt: true,
        respondedAt: true,
        isPublic: true,
      },
    }));

    if (confession) {
      const { reportCount, ...c } = confession;
      return NextResponse.json({
        type: "confess",
        hidden: reportCount >= 3,
        ...c,
      });
    }

    const set = await withDbRetry(() =>
      db.letterSet.findUnique({
        where: { senderKey },
        include: { letters: { orderBy: { order: "asc" } } },
      })
    );

    if (set) {
      return NextResponse.json({
        type: "letters",
        hidden: set.reportCount >= 3,
        slug: set.slug,
        fromName: set.fromName,
        toName: set.toName,
        theme: set.theme,
        views: set.views,
        createdAt: set.createdAt,
        openedAt: set.openedAt,
        startedAt: set.startedAt,
        total: set.letters.length,
        letters: set.letters.map((l) => ({
          order: l.order,
          title: l.title,
          unlockDays: l.unlockDays,
          views: l.views,
          openedAt: l.openedAt,
          reply: l.reply,
          repliedAt: l.repliedAt,
        })),
      });
    }

    const gift = await withDbRetry(() =>
      db.gift.findUnique({ where: { senderKey } })
    );

    if (gift) {
      const base = {
        type: "gift" as const,
        giftType: gift.type,
        hidden: gift.reportCount >= 3,
        slug: gift.slug,
        fromName: gift.fromName,
        toName: gift.toName,
        theme: gift.theme,
        views: gift.views,
        createdAt: gift.createdAt,
        openedAt: gift.openedAt,
      };

      // kupon: sertakan daftar + status pemakaian biar pengirim lihat progres
      if (gift.type === "coupons") {
        try {
          const data = JSON.parse(gift.data) as { coupons?: { title: string; desc?: string }[] };
          const progress = JSON.parse(gift.progress) as { redeemed?: Record<string, string> };
          return NextResponse.json({
            ...base,
            coupons: data.coupons ?? [],
            redeemed: progress.redeemed ?? {},
          });
        } catch {
          return NextResponse.json({ ...base, coupons: [], redeemed: {} });
        }
      }

      // playlist: sertakan judul + jumlah lagu buat halaman pantauan
      if (gift.type === "playlist") {
        try {
          const data = JSON.parse(gift.data) as { title?: string; songs?: unknown[] };
          return NextResponse.json({
            ...base,
            plTitle: data.title ?? "",
            plSongs: Array.isArray(data.songs) ? data.songs.length : 0,
          });
        } catch {
          return NextResponse.json({ ...base, plTitle: "", plSongs: 0 });
        }
      }

      return NextResponse.json(base);
    }

    return NextResponse.json(
      { error: "Status tidak ditemukan. Buka lewat link yang kamu simpan ya." },
      { status: 404 }
    );
  } catch (err) {
    console.error("GET /api/status/[senderKey] error:", describeError(err), err);
    reportError(err, { route: "GET /api/status/[senderKey]" });
    return NextResponse.json(
      { error: "Gagal memuat status." },
      { status: 500 }
    );
  }
}

// PATCH /api/status/<senderKey> — pengirim mengubah setelan suratnya sendiri.
// Sekarang: opt-in/out Dinding Kangenin (isPublic). senderKey = kunci
// kepemilikan (cuma pengirim yang punya link halaman ini). Cuma confess yang
// punya dinding — letters & gift tidak tersentuh (updateMany 0 baris → 404).
// Isi surat TIDAK PERNAH ikut ke dinding; yang tampil cuma nama & tema.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ senderKey: string }> }
) {
  try {
    const { senderKey } = await params;

    const rl = await rateLimit(req, "wall-toggle", 15, 10 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Terlalu sering mengganti setelan. Tarik napas dulu 😌" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const body = (await req.json().catch(() => null)) as {
      isPublic?: unknown;
    } | null;
    if (typeof body?.isPublic !== "boolean") {
      return NextResponse.json({ error: "Setelan tidak valid" }, { status: 400 });
    }
    const isPublic = body.isPublic;

    // updateMany (bukan update): tidak melempar P2025 kalau senderKey nggak
    // ketemu — cukup cek count. Sekalian jadi guard untuk letters/gift.
    const updated = await withDbRetry(() =>
      db.confession.updateMany({
        where: { senderKey },
        data: { isPublic },
      })
    );
    if (updated.count === 0) {
      return NextResponse.json(
        { error: "Status tidak ditemukan. Buka lewat link yang kamu simpan ya." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, isPublic });
  } catch (err) {
    console.error("PATCH /api/status/[senderKey] error:", describeError(err), err);
    reportError(err, { route: "PATCH /api/status/[senderKey]" });
    return NextResponse.json(
      { error: "Gagal menyimpan setelan. Coba lagi ya." },
      { status: 500 }
    );
  }
}
