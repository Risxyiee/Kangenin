import { NextRequest, NextResponse } from "next/server";
import { db, withDbRetry } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

export const runtime = "nodejs";

// Dinding Kangenin: feed publik confess yang pengirimnya ikut opt-in.
// ATASAN PENTING: isi surat TIDAK PERNAH ikut — cuma nama, tema, waktu,
// status jawaban (bukan isinya), dan reaksi. Intrigasi = mesin FOMO,
// privasi = kepercayaan.

/**
 * Salinan respons sukses terakhir (stale-while-error, per-isolate).
 *
 * Feed sosial TIDAK BOLEH 500 (filosofi /api/papan). Bukti audit pralaunch
 * 2026-11-03: burst 15× pada isolate dingin — dial Hyperdrive→Supabase yang
 * lama membuat 3/15 attempt kehabisan anggaran 15 dtk. Dengan salinan ini,
 * 12 request yang sukses menyimpan jawabannya dan 3 yang gagal menyajikan
 * salinan berusia 1–2 dtk — pengunjung tidak melihat error apa pun. Isolate
 * segar yang belum pernah sukses pun tetap 200 dengan items kosong (bukan
 * 500), menyusul filosofi papan.
 */
let lastGoodWall: string | null = null;

// S-07 single-flight per nilai limit: request paralel ber-limit sama menunggu
// SATU query bersama. Tanpa ini, burst di isolate dingin membuat belasan query
// serentak merebut pool (maks 12) — pengantri menghabiskan anggaran retry
// 15 dtk (tercatat: 1 request wall 15,1 dtk di burst pasca-deploy S-07).
const wallInflight = new Map<number, Promise<string>>();

async function muatWall(limit: number): Promise<string> {
  const rows = await withDbRetry(() =>
    db.confession.findMany({
      where: { isPublic: true, reportCount: { lt: 3 } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        fromName: true,
        toName: true,
        theme: true,
        createdAt: true,
        response: true,
        reactions: {
          select: { heart: true, laugh: true, cry: true, bloom: true },
        },
      },
    })
  );
  lastGoodWall = JSON.stringify({
    items: rows.map((r) => ({
      id: r.id,
      from: r.fromName.trim() || "Seseorang",
      to: r.toName,
      theme: r.theme,
      createdAt: r.createdAt.toISOString(),
      answered: r.response !== null && r.response !== undefined,
      reactions: r.reactions ?? { heart: 0, laugh: 0, cry: 0, bloom: 0 },
    })),
  });
  return lastGoodWall;
}

export async function GET(req: NextRequest) {
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? 48);
  const limit = Math.min(Math.max(limitRaw, 1), 96);

  // single-flight: gabungkan cache-miss paralel ber-limit sama jadi satu query
  let berjalan = wallInflight.get(limit);
  if (!berjalan) {
    berjalan = muatWall(limit).finally(() => {
      wallInflight.delete(limit);
    });
    wallInflight.set(limit, berjalan);
  }

  try {
    const payload = await berjalan;
    return new NextResponse(payload, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (err) {
    console.error("GET /api/wall error:", describeError(err), err);
    reportError(err, { route: "GET /api/wall" });

    // stale-while-error: salinan sukses terakhir di isolate ini (usia detik–
    // menit) jauh lebih baik daripada error untuk feed publik.
    if (lastGoodWall) {
      return new NextResponse(lastGoodWall, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "X-Feed-Source": "stale",
        },
      });
    }

    // isolate belum pernah sukses (sangat langka) — tetap 200, bukan 500:
    // dinding kosong sesaat lebih lembut daripada halaman error.
    return NextResponse.json(
      { items: [] },
      { headers: { "X-Feed-Source": "fallback-empty" } }
    );
  }
}

// Reaksi emoji pengunjung dinding — dibatasi rate biar nggak di-spam.
export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(req, "wall-react", 40, 5 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Kebanyakan reaksi — tarik napas dulu 😌" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const body = (await req.json().catch(() => null)) as {
      id?: string;
      type?: string;
    } | null;
    const id = body?.id;
    const type = body?.type;
    if (!id || !["heart", "laugh", "cry", "bloom"].includes(type ?? "")) {
      return NextResponse.json(
        { error: "Reaksi tidak valid" },
        { status: 400 }
      );
    }

    // pastikan confess-nya memang publik & tidak di-hide
    const target = await withDbRetry(() =>
      db.confession.findUnique({
        where: { id },
        select: { isPublic: true, reportCount: true },
      })
    );
    if (!target || !target.isPublic || target.reportCount >= 3) {
      return NextResponse.json(
        { error: "Suratnya tidak ada di dinding" },
        { status: 404 }
      );
    }

    const heart = type === "heart";
    const laugh = type === "laugh";
    const cry = type === "cry";
    const bloom = type === "bloom";

    const updated = await withDbRetry(() =>
      db.reactionCount.upsert({
        where: { confessionId: id },
        update: {
          ...(heart ? { heart: { increment: 1 } } : {}),
          ...(laugh ? { laugh: { increment: 1 } } : {}),
          ...(cry ? { cry: { increment: 1 } } : {}),
          ...(bloom ? { bloom: { increment: 1 } } : {}),
        },
        create: {
          confessionId: id,
          heart: heart ? 1 : 0,
          laugh: laugh ? 1 : 0,
          cry: cry ? 1 : 0,
          bloom: bloom ? 1 : 0,
        },
        select: { heart: true, laugh: true, cry: true, bloom: true },
      })
    );

    return NextResponse.json({ reactions: updated });
  } catch (err) {
    console.error("POST /api/wall error:", describeError(err), err);
    reportError(err, { route: "POST /api/wall" });
    return NextResponse.json(
      { error: "Gagal kirim reaksi. Coba lagi." },
      { status: 500 }
    );
  }
}
