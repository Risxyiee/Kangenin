import { NextResponse } from "next/server";
import { db, withDbRetry } from "@/lib/db";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

export const runtime = "nodejs";

// Penghitung sosial buat FOMO: "X surat rahasia udah terkirim lewat sini".
// Cache in-memory 60 detik — cukup akurat, hemat query, dan aman buat
// isolate Cloudflare Workers (cache per-isolate, reset saat isolate tidur).
let cache: { data: StatsPayload; at: number } | null = null;
const TTL_MS = 60_000;

// S-07 single-flight: saat cache basi, HANYA SATU request yang menghitung ulang;
// request paralel lain menunggu janji yang sama. Tanpa ini, burst di isolate
// dingin membuat 15 request serentak lolos cek cache lalu 15 hitungan DB
// serentak menabrak pool (maks 12) — bukti produksi 2026-11-03: 2×503 di
// burst 15× karena budget retry 15 dtk habis oleh rebutan dial.
let inflight: Promise<StatsPayload> | null = null;

async function hitungStats(): Promise<StatsPayload> {
  const [confessions, letters, gifts, kados] = await withDbRetry(() =>
    Promise.all([
      db.confession.count(),
      db.letterSet.count(),
      db.gift.count(),
      db.kado.count(),
    ])
  );
  return {
    confessions,
    letters,
    gifts,
    kados,
    total: confessions + letters + gifts + kados,
    generatedAt: new Date().toISOString(),
  };
}

type StatsPayload = {
  confessions: number;
  letters: number;
  gifts: number;
  kados: number;
  total: number;
  // penanda waktu supaya UI bisa memformat ulang tanpa hydration mismatch
  generatedAt: string;
};

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.data, {
      headers: { "Cache-Control": "public, max-age=30" },
    });
  }

  // single-flight: gabungkan semua cache-miss paralel jadi satu perhitungan
  if (!inflight) {
    inflight = hitungStats()
      .then((data) => {
        cache = { data, at: Date.now() };
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }

  try {
    const data = await inflight;
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=30" },
    });
  } catch (err) {
    console.error("GET /api/stats error:", describeError(err), err);
    reportError(err, { route: "GET /api/stats" });
    // stale-while-error (sama dengan filosofi wall/papan): angka hitungan
    // terakhir yang sukses — walau basi melewati TTL — jauh lebih jujur dan
    // berguna daripada 503; generatedAt tetap menandai usianya. 503 hanya
    // untuk isolate yang BELUM PERNAH sukses sama sekali.
    if (cache) {
      return NextResponse.json(cache.data, {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "X-Stats-Source": "stale",
        },
      });
    }
    // DB gagal & belum ada salinan → biarkan UI pakai fallback
    return NextResponse.json(
      { error: "statistik tidak tersedia" },
      { status: 503 }
    );
  }
}
