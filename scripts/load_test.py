"""
load_test.py — tes beban terukur untuk produksi Kangenin.

Pertanyaan yang dijawab: berapa banyak user bersamaan yang situs tahan
sebelum mulai error/lelet?

Desain yang bertanggung jawab:
  - Tahap bertingkat: 1 → 5 → 10 → 25 → 50 virtual user (VU), tiap VU
    mengerjakan 15 request SEQUENTIAL (bukan loop tanpa batas) — total
    ±1.365 request, jauh di bawah kuota harian Workers free (100rb/hr).
  - Campuran realistis halaman + API baca publik: 40% landing `/`,
    25% `/api/wall`, 20% `/api/stats`, 15% halaman kado `/kado/<id>`.
    Endpoint ber-limit ketat (kado-status 12/10mnt, reply 100/10mnt)
    SENGAJA tidak dites — 429 mereka itu fitur anti-spam, bukan kapasitas.
  - Kegagalan >20% pada satu tahap → ramp dihentikan (jangan kambing
    situs sendiri).
  - User-Agent jujur: Kangenin-LoadTest/1.0.

Output: tabel per tahap (RPS, p50/p90/p95/max, rasio error) + kesimpulan
kapasitas aman.
"""

import concurrent.futures
import random
import statistics
import sys
import threading
import time

import requests

BASE = "https://kangenin.risyxieee123.workers.dev"
KADO_ID = ""  # diisi via env TEST_KADO_ID — kado tes yang nanti dihapus
HDRS = {"User-Agent": "Kangenin-LoadTest/1.0 (uji kapasitas milik sendiri)"}

STAGES = [1, 5, 10, 25, 50]
REQS_PER_VU = 15
TIMEOUT = 15
ERROR_ABORT = 0.20  # >20% gagal → berhenti

MIX = [
    ("/", 0.40),
    ("/api/wall?limit=24", 0.25),
    ("/api/stats", 0.20),
    ("kado", 0.15),  # placeholder → f"/kado/{KADO_ID}"
]


def pick_url(rng: random.Random) -> str:
    r = rng.random()
    acc = 0.0
    for path, w in MIX:
        acc += w
        if r <= acc:
            return f"/kado/{KADO_ID}" if path == "kado" else path
    return "/"


def vu_worker(vu_id: int, barrier: threading.Barrier, results: list, seed: int):
    rng = random.Random(seed)
    sess = requests.Session()
    sess.headers.update(HDRS)
    barrier.wait()  # semua VU start bareng = beban serentak sungguhan
    for _ in range(REQS_PER_VU):
        url = BASE + pick_url(rng)
        t0 = time.perf_counter()
        try:
            r = sess.get(url, timeout=TIMEOUT)
            ms = (time.perf_counter() - t0) * 1000
            results.append((url, r.status_code, ms))
        except Exception:
            ms = (time.perf_counter() - t0) * 1000
            results.append((url, 0, ms))  # 0 = timeout / koneksi gagal


def pct(sorted_lat: list, p: float) -> float:
    if not sorted_lat:
        return 0.0
    idx = min(len(sorted_lat) - 1, int(round(p / 100 * (len(sorted_lat) - 1))))
    return sorted_lat[idx]


def run_stage(vus: int, stage_idx: int) -> tuple[bool, dict]:
    results: list = []
    barrier = threading.Barrier(vus)
    threads = [
        threading.Thread(target=vu_worker, args=(i, barrier, results, stage_idx * 1000 + i))
        for i in range(vus)
    ]
    t0 = time.perf_counter()
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    dur = time.perf_counter() - t0

    lat = sorted(ms for _, _, ms in results)
    ok = sum(1 for _, s, _ in results if 200 <= s < 400)
    throt = sum(1 for _, s, _ in results if s == 429)
    client_err = sum(1 for _, s, _ in results if 400 <= s < 500 and s != 429)
    server_err = sum(1 for _, s, _ in results if s >= 500)
    dead = sum(1 for _, s, _ in results if s == 0)
    total = len(results)
    hard_fail = server_err + dead

    stats = {
        "vus": vus,
        "total": total,
        "ok": ok,
        "throt": throt,
        "client_err": client_err,
        "server_err": server_err,
        "dead": dead,
        "rps": round(total / dur, 1),
        "p50": round(pct(lat, 50)),
        "p90": round(pct(lat, 90)),
        "p95": round(pct(lat, 95)),
        "max": round(lat[-1]) if lat else 0,
    }
    print(
        f"{vus:>4} VU | req {total:>4} | ok {ok:>4} | 429 {throt:>3} | "
        f"4xx {client_err:>2} | 5xx {server_err:>2} | mati {dead:>2} | "
        f"RPS {stats['rps']:>6} | p50 {stats['p50']:>5}ms | p90 {stats['p90']:>5}ms | "
        f"p95 {stats['p95']:>5}ms | max {stats['max']:>6}ms",
        flush=True,
    )
    # per-endpoint ringkas kalau ada masalah
    if hard_fail:
        by_url: dict = {}
        for u, s, _ in results:
            if s >= 500 or s == 0:
                by_url[u] = by_url.get(u, 0) + 1
        for u, c in sorted(by_url.items(), key=lambda kv: -kv[1]):
            print(f"      gagal {c}x di {u}", flush=True)

    return hard_fail / total <= ERROR_ABORT, stats


def main():
    global KADO_ID
    KADO_ID = sys.argv[1] if len(sys.argv) > 1 else ""
    if not KADO_ID:
        print("Pemakaian: python3 load_test.py <UUID-kado-tes>")
        sys.exit(2)

    print(f"TARGET {BASE}")
    print(f"Tahap: {STAGES} VU × {REQS_PER_VU} request — campuran 40% / , 25% /api/wall, 20% /api/stats, 15% /kado/<id>")
    print()
    header = f"{'VU':>6} | {'req':>4} | {'ok':>4} | {'429':>3} | {'4xx':>2} | {'5xx':>2} | {'mati':>4} | {'RPS':>6} | {'p50':>8} | {'p90':>8} | {'p95':>8} | {'max':>8}"
    print(header)
    print("-" * len(header))

    all_stats = []
    safe_until = None
    for i, vus in enumerate(STAGES):
        alive, stats = run_stage(vus, i)
        all_stats.append(stats)
        if alive and stats["server_err"] == 0 and stats["dead"] == 0:
            safe_until = vus
        if not alive:
            print(f"\n⛔ Tahap {vus} VU gagal >{int(ERROR_ABORT*100)}% — ramp dihentikan demi kesehatan situs.")
            break
        time.sleep(6)  # napas antar tahap

    print()
    print("=== KESIMPULAN ===")
    if safe_until:
        p95 = next(s["p95"] for s in all_stats if s["vus"] == safe_until)
        print(f"Aman terukur sampai {safe_until} user bersamaan (0 error server, p95 {p95} ms).")
    else:
        print("Tahap paling rendah pun sudah menunjukkan error — perlu investigasi.")
    print("Catatan: ini beban dari 1 IP egress — realistis untuk pola akses, bukan DDoS.")
    print("Batas mutlak platform: Workers free ±100rb req/hari; DB Supabase free-tier "
          "±koneksi terbatas (app sudah di-pool lewat Hyperdrive, max 3/isolate).")


if __name__ == "__main__":
    main()
