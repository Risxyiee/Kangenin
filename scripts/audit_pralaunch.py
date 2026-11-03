#!/usr/bin/env python3
"""
Audit pra-launch Kangenin — cek menyeluruh produksi www.kangenin.web.id.
Pakai: python3 scripts/audit_pralaunch.py [BASE_URL] [--full]

Fase:
  A. Halaman publik (200 + marker)
  B. Halaman test-* (harus tidak bocor / minimal terkendali)
  C. API read publik
  D. Keamanan (endpoint rahasia tanpa key harus ditolak, endpoint debug harus 404)
  E. Alur end-to-end kado: buat → lihat → status → ulasan → hapus
  F. Beban ringan: burst landing + kado + OG — deteksi Error 1102/503
Semua request pakai UA browser (Cloudflare blok UA python → 403/1010).
"""
import concurrent.futures as cf
import json
import sys
import time
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://www.kangenin.web.id"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)

results = []


def req(path, method="GET", body=None, timeout=40):
    """Return (status, headers, bytes, latency_ms)."""
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("User-Agent", UA)
    r.add_header("Accept", "text/html,application/json,*/*")
    if data:
        r.add_header("Content-Type", "application/json")
    t0 = time.time()
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, dict(resp.headers), resp.read(), int((time.time() - t0) * 1000)
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read(), int((time.time() - t0) * 1000)
    except Exception as e:  # noqa: BLE001
        return -1, {}, str(e).encode(), int((time.time() - t0) * 1000)


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def section(title):
    print(f"\n── {title} " + "─" * max(0, 46 - len(title)))


# ════════════════════════ A. HALAMAN PUBLIK ════════════════════════
section("A. HALAMAN PUBLIK")
PAGES = [
    ("/", "Kangenin"),
    ("/create", "create"),  # marker dicek longgar di bawah
    ("/dinding", "dinding"),
    ("/bantuan", "bantuan"),
    ("/tentang", "tentang"),
    ("/privasi", "privasi"),
    ("/history", "history"),
    ("/masukan", "masukan"),
]
for path, marker in PAGES:
    st, _, html, ms = req(path)
    body = html.decode("utf-8", "ignore")
    # marker longgar: string apa pun dari marker dalam HTML (case-insensitive)
    ok = st == 200 and len(body) > 500 and marker.lower() in body.lower()
    check(f"GET {path}", ok, f"HTTP {st}, {len(body)}B, {ms}ms")

# halaman insight & admin: harus ada tapi bukan error 500
for path in ("/insight", "/admin"):
    st, _, html, ms = req(path)
    body = html.decode("utf-8", "ignore")
    ok = st in (200, 401, 403) and "error 1102" not in body.lower()
    check(f"GET {path} (terlindungi)", ok, f"HTTP {st}, {ms}ms")

# ════════════════════════ B. HALAMAN TEST-* ════════════════════════
section("B. HALAMAN TEST-* (harus tidak bocor ke publik)")
for path in ("/test-confess", "/test-bouquet", "/test-candle", "/test-coupon", "/test-timeline"):
    st, _, html, ms = req(path)
    body = html.decode("utf-8", "ignore")
    bocor = st == 200 and len(body) > 1000
    check(
        f"GET {path}",
        not bocor,
        f"HTTP {st}, {len(body)}B — {'LEAK: halaman test hidup di produksi!' if bocor else 'aman (tidak ter-render publik)'}",
    )

# ════════════════════════ C. API READ PUBLIK ════════════════════════
section("C. API READ PUBLIK")
for path in ("/api", "/api/stats", "/api/wall", "/api/papan"):
    st, _, raw, ms = req(path)
    ok_json = st == 200
    try:
        json.loads(raw)
    except Exception:  # noqa: BLE001
        ok_json = False
    check(f"GET {path}", ok_json, f"HTTP {st}, {len(raw)}B, {ms}ms")

# ════════════════════════ D. KEAMANAN ════════════════════════
section("D. KEAMANAN ENDPOINT")
# Pola desain: key salah → 404 (bukan 403) — “jangan sempurnakan peta buat
# pengintip”. Jadi ekspektasi benar = 404 (atau 401/403 kalau berubah).
st, _, _, ms = req("/api/feedback?key=tanpa-kunci-palsu")
check("GET /api/feedback?key=palsu ditolak", st in (401, 403, 404), f"HTTP {st}")
st, _, _, _ = req("/api/admin/overview")
check("GET /api/admin/overview (no key) ditolak", st in (401, 403, 404), f"HTTP {st}")
st, _, _, _ = req("/api/admin/masukan")
check("GET /api/admin/masukan (no key) ditolak", st in (401, 403, 404), f"HTTP {st}")
for dbg in ("/api/db-ping", "/api/debug-db"):
    st, _, _, _ = req(dbg)
    check(f"GET {dbg} tidak ada di produksi", st == 404, f"HTTP {st}")

# ════════════════════════ E. ALUR END-TO-END KADO ════════════════════════
section("E. ALUR KADO END-TO-END (buat → lihat → status → ulasan → hapus)")
UNIQ = f"Audit{int(time.time()) % 100000}"
payload = {
    "targetName": f"Tes {UNIQ}",
    "message": f"Pesan audit pra-launch {UNIQ} — pesan rahasia cek alur.",
    "senderName": "AuditBot",
    "isAnonymous": False,
    "kadoType": "bouquet",
    "kadoData": {"occasion": "audit", "message": "Bunga buat cek alur audit."},
}
st, _, raw, ms = req("/api/kado", "POST", payload)
kadoId = ""
try:
    d = json.loads(raw)
    kadoId = d.get("data", {}).get("id", "")
except Exception:  # noqa: BLE001
    pass
# 201 Created = respons sukses POST /api/kado (bukan 200)
check("POST /api/kado", st == 201 and bool(kadoId), f"HTTP {st}, id={kadoId[:8]}…, {ms}ms")

if kadoId:
    st, _, html, ms = req(f"/kado/{kadoId}")
    body = html.decode("utf-8", "ignore")
    ok = st == 200 and ("html" in body.lower())
    check("GET /kado/[id] (halaman penerima)", ok, f"HTTP {st}, {len(body)}B, {ms}ms")

    st, _, html, ms = req(f"/kado/{kadoId}/share")
    body = html.decode("utf-8", "ignore")
    ok = st == 200 and ("html" in body.lower())
    check("GET /kado/[id]/share (dashboard pengirim)", ok, f"HTTP {st}, {len(body)}B, {ms}ms")

    # OG image — jalur yang dulu bikin 1102 (link viral WA)
    st, _, raw, ms = req(f"/api/og?k={kadoId}")
    check("GET /api/og?k=id", st == 200 and len(raw) > 500, f"HTTP {st}, {len(raw)}B, {ms}ms")

    # 404 link palsu tetap anggun
    st, _, html, ms = req("/?k=slug-palsu-tidak-ada-xyz")
    ok404 = st in (200, 404) and "error 1102" not in html.decode("utf-8", "ignore").lower()
    check("GET /?k=slug-palsu (anggun, tanpa 1102)", ok404, f"HTTP {st}, {ms}ms")

# ulasan: kirim satu masukan bertanda (owner bisa hapus lewat /insight)
st, _, raw, ms = req(
    "/api/feedback",
    "POST",
    {
        "message": f"[AUDIT PRALAUNCH {UNIQ}] tes endpoint ulasan — silakan hapus di /insight.",
        "rating": 5,
        "category": "ulasan",
    },
)
check("POST /api/feedback (ulasan)", st == 200, f"HTTP {st}, {ms}ms")

# validasi input: payload kosong harus ditolak 400
st, _, raw, _ = req("/api/kado", "POST", {"targetName": "", "message": ""})
check("POST /api/kado payload kosong → 400", st == 400, f"HTTP {st}")

# cleanup: hapus kado audit lewat DELETE — model kepercayaan “pemegang
# link = pemilik”, tanpa senderKey; idempoten (sudah hilang tetap sukses)
if kadoId:
    st, _, raw, ms = req(f"/api/kado/{kadoId}", "DELETE")
    check("DELETE /api/kado/[id] (cleanup)", st == 200, f"HTTP {st}, {ms}ms")
    st2, _, raw2, _ = req(f"/api/kado/{kadoId}", "DELETE")
    check("DELETE kedua idempoten", st2 == 200, f"HTTP {st2}")

# ════════════════════════ F. BEBAN RINGAN (1102 SENTINEL) ════════════════════════
section("F. BEBAN RINGAN — deteksi Error 1102")


def burst2(path, n):
    """Paralel nyata: tiap thread satu request."""
    with cf.ThreadPoolExecutor(max_workers=n) as ex:
        futs = [ex.submit(req, path) for _ in range(n)]
        out = [(f.result()[0], f.result()[3]) for f in futs]
    return [c for c, _ in out], [m for _, m in out]


for label, path, n in [
    ("burst 30× GET / (landing)", "/", 30),
    ("burst 15× GET /kado/[id] (view kado)", f"/kado/{kadoId}" if kadoId else "/", 15),
    ("burst 10× GET /api/papan", "/api/papan", 10),
]:
    codes, lat = burst2(path, n)
    bad = [c for c in codes if c not in (200, 304)]
    p95 = sorted(lat)[int(len(lat) * 0.95) - 1] if lat else 0
    check(label, not bad, f"kode: {sorted(set(codes))}, p95 {p95}ms, max {max(lat)}ms")

# ════════════════════════ RINGKASAN ════════════════════════
fails = [r for r in results if not r[1]]
print("\n" + "═" * 52)
print(f"HASIL: {len(results) - len(fails)}/{len(results)} PASS — {len(fails)} FAIL")
for name, _, detail in fails:
    print(f"  ✗ {name} — {detail}")
sys.exit(1 if fails else 0)
