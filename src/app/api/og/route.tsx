// ─────────────────────────────────────────────────────────────────────────────
// GET /api/og?k=<slug> — kartu OG buat link confess/letters yang di-share.
//
// PERBAIKAN Error 1102 (2026-11-02, keputusan arsitektur): dulu rute ini
// MERENDER PNG satori+resvg per cache-miss. Render itu makan memori puluhan
// MB (WASM + font) di isolate berkapasitas 128MB — saat bareng request user
// lain di isolate yang sama, isolate kena OOM dan SEMUA request yang sedang
// jalan mati `error code: 1102`. Ini akar Error 1102 di produksi.
//
// Solusi: nol render di Worker.
//   - Kartu generik: aset statis public/og-generic.png (dilayani edge CDN).
//   - Kartu personal: kalau kebetulan sudah ada di Cache-API PoP → dilayani;
//     kalau tidak → 302 ke aset generik. Judul link tetap personal lewat
//     og:title di generateMetadata (page.tsx).
// Hasil: rute ini nol CPU, nol WASM, nol risiko OOM — dan bundle Worker
// kehilangan satori+resvg sama sekali (cold start lebih ringan).
// Kalau suatu saat naik ke Workers Paid (30 dtk CPU, 128MB+ headroom),
// render personal bisa dihidupkan ulang dari riwayat git.
// ─────────────────────────────────────────────────────────────────────────────

const ogCache = (): Cache | null => {
  try {
    return (globalThis as { caches?: { default: Cache } }).caches?.default ?? null;
  } catch {
    return null;
  }
};

export async function GET(req: Request) {
  // kartu personal: dilayani dari Cache-API PoP kalau kebetulan terisi
  // (masa lalu render runtime); sisanya fallback ke kartu generik statis.
  const cache = ogCache();
  if (cache) {
    try {
      const hit = await cache.match(req.url);
      if (hit) return hit;
    } catch {
      /* cache gagal → fallback */
    }
  }
  return new Response(null, {
    status: 302,
    headers: { Location: "/og-generic.png" },
  });
}
