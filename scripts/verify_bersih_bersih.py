#!/usr/bin/env python3
"""
Verifikasi pasca bersih-bersih pra-launch (kunci fail-closed + /test-* dihapus).
Semua read-only, UA browser (Cloudflare menolak UA python). Jalankan SETELAH
deploy Cloudflare selesai: python3 scripts/verify_bersih_bersih.py [BASE_URL]
"""
import concurrent.futures as cf
import sys
import time
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://www.kangenin.web.id"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
P = F = 0


def req(path, timeout=45):
    r = urllib.request.Request(BASE + path)
    r.add_header("User-Agent", UA)
    r.add_header("Accept", "application/json,text/html,*/*")
    t0 = time.time()
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, resp.read(), int((time.time() - t0) * 1000)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), int((time.time() - t0) * 1000)
    except Exception as e:  # noqa: BLE001
        return -1, str(e).encode(), int((time.time() - t0) * 1000)


def check(name, ok, detail=""):
    global P, F
    if ok:
        P += 1
    else:
        F += 1
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


print(f"BASE = {BASE}\n")

print("── 1. Halaman test-* harus 404 permanen (file sudah dihapus dari build) ──")
for p in ("/test-confess", "/test-bouquet", "/test-candle", "/test-coupon", "/test-timeline"):
    st, body, ms = req(p)
    check(f"GET {p} → tidak ter-serve", st != 200 or len(body) <= 1000, f"HTTP {st}, {len(body)}B, {ms}ms")

print("\n── 2. Kunci bawaan versi lama HARUS ditolak (fail-closed) ──")
st, body, ms = req("/api/feedback?key=kangenin-insight-2026")
check("GET /api/feedback?key=<kunci lama> → 404", st == 404, f"HTTP {st}, {ms}ms")
st, body, ms = req("/api/feedback")
check("GET /api/feedback (tanpa key) → 404", st == 404, f"HTTP {st}")
st, body, ms = req("/api/admin/overview?key=kangenin-admin-2026")
check("GET /api/admin/overview?key=<kunci lama> → 404", st == 404, f"HTTP {st}")
st, body, ms = req("/api/admin/overview")
check("GET /api/admin/overview (tanpa key) → 404", st == 404, f"HTTP {st}")
st, body, ms = req("/api/admin/keamanan")
check("GET /api/admin/keamanan (tanpa key) → ditolak", st in (401, 403, 404), f"HTTP {st}")

print("\n── 3. Halaman & API publik tetap hidup ──")
for p in ("/", "/dinding", "/masukan", "/insight", "/admin", "/bantuan"):
    st, body, ms = req(p)
    ok = st == 200 and len(body) > 500 and b"error 1102" not in body.lower()
    check(f"GET {p}", ok, f"HTTP {st}, {len(body)}B, {ms}ms")
for p in ("/api", "/api/stats", "/api/wall", "/api/papan"):
    st, body, ms = req(p)
    check(f"GET {p}", st == 200, f"HTTP {st}, {ms}ms")

print("\n── 4. Burst 15× paralel (5 landing + 5 wall + 5 stats) — nol 5xx ──")
paths = ["/"] * 5 + ["/api/wall"] * 5 + ["/api/stats"] * 5


def hit(p):
    st, _, ms = req(p, timeout=45)
    return p, st, ms


t0 = time.time()
with cf.ThreadPoolExecutor(max_workers=15) as ex:
    hasil = list(ex.map(hit, paths))
dur = int((time.time() - t0) * 1000)
gagal = [(p, st) for p, st, _ in hasil if st >= 500 or st == -1]
check("burst 15×: nol 5xx / koneksi gagal", not gagal, f"total {dur}ms, gagal={gagal}")
lambat = [(p, ms) for p, _, ms in hasil if ms > 15000]
check("burst 15×: nol request > 15 dtk", not lambat, f"lambat={lambat}")

print(f"\nHASIL: {P} PASS, {F} FAIL")
sys.exit(1 if F else 0)
