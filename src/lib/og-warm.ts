// ─────────────────────────────────────────────────────────────────────────────
// Pemanas kartu OG — dipanggil SETELAH kado/confess/letters berhasil dibuat.
//
// MASALAH (Error 1102): render satori+resvg beratnya pas di batas CPU Worker
// plan free (10ms) — crawler pertama (WhatsApp dkk) yang memfetch /api/og?k=
// kadang kena 1102/503. Kartu generik sudah jadi aset statis, tapi kartu
// personal harus dirender. Solusi: panaskan SEJAK SAAT CREATE — subrequest
// self-fetch punya budget CPU sendiri (invokasi baru), jalan di waitUntil
// (gak menunda respons create), diulang maks 3× sampai PNG masuk Cache-API
// PoP. Saat link di-share, crawler hampir selalu dapat cache = nol CPU.
// ─────────────────────────────────────────────────────────────────────────────

import { getCloudflareContext } from "@opennextjs/cloudflare";

async function warmOg(url: string): Promise<void> {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": "kangenin-og-warmer/1" },
      });
      // habiskan body biar koneksi bersih; PNG-nya masuk Cache-API di rute og
      try {
        await r.arrayBuffer();
      } catch {
        /* body rusak — anggap percobaan ini gagal */
        if (r.ok) return;
      }
      if (r.ok) return; // sukses → kartu ter-cache, tugas selesai
    } catch {
      /* jaringan — coba lagi */
    }
    await new Promise((res) => setTimeout(res, 1_500));
  }
  // 3× gagal → biarkan; crawler berikutnya jalur render biasa (single-flight
  // + Cache-API + retry crawler tetap menutupi)
}

/**
 * Jadwalkan pemanasan di waitUntil — TIDAK pernah menunda atau menggagalkan
 * respons create. Kalau konteks Cloudflare tak tersedia (next dev lokal),
 * pemanasan dilewati diam-diam.
 */
export function scheduleOgWarm(origin: string, slug: string): void {
  try {
    const { ctx } = getCloudflareContext();
    const url = new URL(`/api/og?k=${encodeURIComponent(slug)}`, origin).toString();
    ctx.waitUntil(warmOg(url));
  } catch {
    /* tanpa konteks worker (dev) — lewati */
  }
}
