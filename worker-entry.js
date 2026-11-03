/**
 * Entry wrapper Cloudflare Worker — Kangenin.
 *
 * Kenapa file ini ada:
 *   Worker bawaan OpenNext (.open-next/worker.js) hanya mengekspor `fetch`.
 *   Fitur S-06 anti "isolate dingin": cron tiap menit (lihat triggers.crons di
 *   wrangler.jsonc) memicu `scheduled` di bawah, yang memanggil /api/stats
 *   SECARA INTERNAL (handler.fetch langsung — tanpa subrequest jaringan, jadi
 *   kebal challenge bot Cloudflare) supaya pool koneksi Hyperdrive → Supabase
 *   tetap hangat. Pengunjung pertama setelah jeda sepi tidak lagi menunggu
 *   dial DB 6–15 detik.
 *
 * Catatan: `export *` meneruskan named export DO class dari worker OpenNext
 * (DOQueueHandler, DOShardedTagCache, BucketCachePurge) supaya tetap tersedia
 * kalau suatu saat caching DO diaktifkan di wrangler.jsonc.
 */
import handler, * as openNextWorker from "./.open-next/worker.js";

export * from "./.open-next/worker.js";

export default {
  fetch: handler.fetch,

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
