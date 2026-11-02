// ─────────────────────────────────────────────────────────────────────────────
// singleFlight — dedup kerja identik yang menyambar bersamaan dalam SATU
// isolate Worker.
//
// KENAPA ADA FILE INI (perbaikan Error 1102 + burst test 2026-11-02):
// saat link kado viral, 30 orang membuka URL yang sama dalam hitungan detik
// → 30 query DB identik (atau 15 render gambar OG) bersamaan → pool DB (max 5
// per isolate) kehabisan slot → 500; render satori bersamaan makan memori →
// 503. Dengan single-flight: request PERTAMA yang mengerjakan, sisanya
// menunggu promise yang sama dan menumpang hasilnya. React cache() dari
// src/lib/detect.ts hanya dedup dalam satu request — helper ini dedup lintas
// request dalam isolate yang sama.
//
// TTL singkat (default 3 dtk) cukup menutup jendela burst; entri dihapus
// setelah selesai + antiran, jadi error TIDAK di-cache (request berikutnya
// setelah gagal akan mencoba ulang).
// ─────────────────────────────────────────────────────────────────────────────

type Entri<T> = { at: number; p: Promise<T> };

export function singleFlight<T>(
  map: Map<string, Entri<T>>,
  key: string,
  make: () => Promise<T>,
  ttlMs = 3_000
): Promise<T> {
  const now = Date.now();

  // buang entri basi — jaga memori isolate tetap kecil
  if (map.size > 0) {
    for (const [k, v] of map) {
      if (now - v.at > ttlMs) map.delete(k);
    }
  }

  const ada = map.get(key);
  if (ada && now - ada.at <= ttlMs) return ada.p;

  const p = make().finally(() => {
    // selesai → lepas supaya request setelahnya tidak menumpang hasil basi;
    // kegagalan juga terlepas → percobaan berikutnya mencoba ulang sungguhan
    const cur = map.get(key);
    if (cur && cur.p === p) map.delete(key);
  });
  map.set(key, { at: now, p });
  return p;
}
