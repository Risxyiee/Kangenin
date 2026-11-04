/**
 * Entry wrapper Cloudflare Worker — Kangenin.
 *
 * Kenapa file ini ada:
 *   Worker bawaan OpenNext (.open-next/worker.js) hanya mengekspor `fetch`.
 *   Wrapper ini menambah dua hal, keduanya PALING GAGAL PUN TIDAK BOLEH
 *   mengganggu halaman utama:
 *
 *   1. S-06 anti "isolate dingin": cron tiap menit (triggers.crons di
 *      wrangler.jsonc) memicu `scheduled()` → panggilan INTERNAL ke /api/stats
 *      (handler.fetch langsung — tanpa subrequest jaringan, kebal challenge
 *      bot) supaya pool Hyperdrive → Supabase tetap hangat. Pengunjung pertama
 *      setelah jeda sepi tidak lagi menunggu dial DB 6–15 detik.
 *
 *   2. S-08 pencatat kunjungan halaman: tiap GET halaman publik memicu satu
 *      panggilan INTERNAL ke /api/track-kunjungan (gerbang isAdmin — kebal
 *      penyalahgunaan publik) yang meng-upsert agregat "PageVisitDaily".
 *      Data ini tampil di /admin → modul "Kunjungan". Filter di bawah
 *      mengeluarkan /api, aset statis, dan halaman internal (admin/insight).
 *
 * Catatan: `export *` meneruskan named export DO class dari worker OpenNext
 * (DOQueueHandler, DOShardedTagCache, BucketCachePurge) supaya tetap tersedia
 * kalau suatu saat caching DO diaktifkan di wrangler.jsonc.
 */
import handler, * as openNextWorker from "./.open-next/worker.js";

export * from "./.open-next/worker.js";

const SKIP_PREFIX = [
  "/api",
  "/_next",
  "/cdn-cgi",
  "/admin",
  "/insight",
  "/favicon",
  "/robots.txt",
  "/sitemap",
];

/** Path halaman publik yang layak dicatat (bukan API/aset/halaman internal). */
function harusCatat(pathname) {
  if (pathname === "/") return true;
  if (SKIP_PREFIX.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p))) {
    return false;
  }
  if (pathname.includes(".")) return false; // berkas (png, txt, ico, dll.)
  return true;
}

export default {
  async fetch(request, env, ctx) {
    try {
      if (request.method === "GET" && env.ADMIN_KEY) {
        const url = new URL(request.url);
        if (harusCatat(url.pathname)) {
          const trackReq = new Request(new URL("/api/track-kunjungan", url.origin), {
            method: "POST",
            headers: { "content-type": "application/json", "x-admin-key": env.ADMIN_KEY },
            body: JSON.stringify({ path: url.pathname }),
          });
          ctx.waitUntil(
            handler
              .fetch(trackReq, env, ctx)
              .then((r) => r.text())
              .catch((e) => console.error(`[kunjungan] gagal: ${e?.message ?? e}`))
          );
        }
      }
    } catch {
      /* tracking tidak boleh pernah mengganggu halaman */
    }
    return handler.fetch(request, env, ctx);
  },

  async scheduled(event, env, ctx) {
    const t0 = Date.now();
    const req = new Request(`https://www.kangenin.web.id/api/stats?warm=${t0}`);
    try {
      ctx.waitUntil(
        handler
          .fetch(req, env, ctx)
          .then((res) => res.text())
          .then((body) => {
            const ms = Date.now() - t0;
            if (ms > 5000) {
              console.error(`[warmer] /api/stats selesai dalam ${ms}ms (${body.length}B) — dial masih lambat`);
            } else {
              console.log(`[warmer] /api/stats → OK ${ms}ms (${body.length}B)`);
            }
          })
          .catch((e) => console.error(`[warmer] gagal: ${e?.message ?? e}`))
      );
    } catch (e) {
      console.error(`[warmer] gagal sinkron: ${e?.message ?? e}`);
    }
  },
};
