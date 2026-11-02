#!/usr/bin/env python3
"""
Burst test produksi — simulasi 50+ user online bersamaan (permintaan founder).

Skenario (volume sengaja moderat — ini probe kesehatan, bukan serangan):
  A. 50 concurrent  GET /                (beranda, semua orang buka bareng)
  B. 30 concurrent  GET /?k=<slug>       (link kado dibuka ramai-ramai — viral)
  C. 20 concurrent  GET /api/papan       (feed papan dipukul semua pengunjung)
  D. 15 concurrent  GET /api/og?k=<slug> (crawler WA/TW ambil gambar share)

Output: status tiap request + p50/p95 latency + jumlah non-200 / 1102.
Pakai: python3 scripts/burst_test.py [BASE_URL] [slug_kado]
"""
import sys
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://kangenin.risyxieee123.workers.dev"
SLUG = sys.argv[2] if len(sys.argv) > 2 else "t6xsbbez"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)


def hit(path):
    t0 = time.time()
    try:
        r = urllib.request.Request(BASE + path, headers={"User-Agent": UA})
        with urllib.request.urlopen(r, timeout=45) as resp:
            resp.read()
            return path, resp.status, (time.time() - t0) * 1000
    except urllib.error.HTTPError as e:
        e.read()
        return path, e.code, (time.time() - t0) * 1000
    except Exception:
        return path, 0, (time.time() - t0) * 1000  # 0 = exception jaringan


def pct(xs, p):
    xs = sorted(xs)
    if not xs:
        return 0
    return xs[min(len(xs) - 1, int(len(xs) * p / 100))]


def run(label, path, n):
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=n) as ex:
        res = list(ex.map(lambda _: hit(path), range(n)))
    dur = time.time() - t0
    codes = [c for _, c, _ in res]
    lat = [l for _, _, l in res]
    ok = sum(1 for c in codes if 200 <= c < 300)
    e1102 = sum(1 for c in codes if c == 1102 or c == 403)
    non200 = n - ok
    print(
        f"{label}\n"
        f"  {n} request serentak dalam {dur:.1f} dtk — {ok}/{n} OK (2xx)\n"
        f"  latency p50={pct(lat,50):.0f}ms p95={pct(lat,95):.0f}ms max={max(lat):.0f}ms\n"
        f"  non-200={non200}  1102/403={e1102}"
    )
    bad = [(c, f"{l:.0f}ms") for _, c, l in res if not (200 <= c < 300)]
    if bad:
        print(f"  detail gagal: {bad[:10]}")
    return non200


def main():
    print(f"Target: {BASE}\n")
    fails = 0
    fails += run("A. BERANDA (50 user buka bareng)", "/", 50)
    time.sleep(2)
    fails += run("B. LINK KADO VIRAL (30 buka bareng)", f"/?k={SLUG}", 30)
    time.sleep(2)
    fails += run("C. FEED PAPAN (20 pukul bareng)", "/api/papan", 20)
    time.sleep(2)
    fails += run("D. OG IMAGE (15 crawler bareng)", f"/api/og?k={SLUG}", 15)

    print(f"\n{'BERSIH ✅' if fails == 0 else f'ADA {fails} GAGAL ❌'} — total 115 request burst")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
