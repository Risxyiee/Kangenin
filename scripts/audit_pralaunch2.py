#!/usr/bin/env python3
"""
Audit pra-launch fase 2 — alur confess inti + sanity API lain.
Pakai: python3 scripts/audit_pralaunch2.py [BASE_URL]
"""
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
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method)
    r.add_header("User-Agent", UA)
    r.add_header("Accept", "text/html,application/json,*/*")
    if data:
        r.add_header("Content-Type", "application/json")
    t0 = time.time()
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, resp.read(), int((time.time() - t0) * 1000)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), int((time.time() - t0) * 1000)
    except Exception as e:  # noqa: BLE001
        return -1, str(e).encode(), int((time.time() - t0) * 1000)


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


print("── ALUR CONFESS INTI (buat → metadata → view → cleanup) ──")
UNIQ = f"Cek{int(time.time()) % 100000}"
payload = {
    "fromName": "AuditBot",
    "toName": f"Tujuan {UNIQ}",
    "message": f"Pengakuan audit pra-launch {UNIQ}. Pesan ini untuk cek alur inti.",
    "theme": "rose",
}
st, raw, ms = req("/api/confess", "POST", payload)
slug, senderKey = "", ""
try:
    d = json.loads(raw)
    data = d.get("data", d)
    slug = data.get("slug", "")
    senderKey = data.get("senderKey", "")
except Exception:  # noqa: BLE001
    pass
check("POST /api/confess", st in (200, 201) and bool(slug), f"HTTP {st}, {ms}ms, slug ada: {bool(slug)}")

if slug:
    # jalur viral terpanas: metadata OG + SSR view (detectKind 1 query UNION)
    st, raw, ms = req(f"/?k={slug}")
    body = raw.decode("utf-8", "ignore")
    ok = st == 200 and f"Tujuan {UNIQ}" in body
    check("GET /?k=slug (view + metadata OG)", ok, f"HTTP {st}, nama target ter-render: {f'Tujuan {UNIQ}' in body}, {ms}ms")

    st, raw, ms = req(f"/api/confess/{slug}")
    check("GET /api/confess/[slug] (buka isi)", st == 200, f"HTTP {st}, {ms}ms")

# cleanup confess: PATCH /api/status/[senderKey] wallMode:"off" — pola yang
# sama dengan verifikasi papan (isPublic default false, jadi tak tampil di
# mana pun; wallMode off memastikan ganda)
if senderKey:
    st, raw, ms = req(f"/api/status/{senderKey}", "PATCH", {"wallMode": "off"})
    check("PATCH /api/status wallMode off (cleanup)", st == 200, f"HTTP {st}, {ms}ms")

print("\n── SANITY API LAIN ──")
st, raw, ms = req("/api/stats")
check("GET /api/stats", st == 200, f"HTTP {st}, isi: {raw[:100].decode('utf-8', 'ignore')}")
st, raw, ms = req("/api/papan")
check("GET /api/papan", st == 200, f"HTTP {st}, isi: {raw[:80].decode('utf-8', 'ignore')}")
st, raw, ms = req("/api/ai/tulis", "POST", {"x": 1})
check("POST /api/ai/tulis input sampah ditolak", st in (400, 401, 403, 422), f"HTTP {st}")
st, raw, ms = req("/api/image-to-text", "POST", {})
check("POST /api/image-to-text input sampah ditolak", st in (400, 401, 403, 422), f"HTTP {st}")
st, raw, ms = req("/api/report", "POST", {"targetId": "x", "reason": "spam-test-audit"})
check("POST /api/report validasi", st in (200, 201, 400, 404), f"HTTP {st}")

fails = [r for r in results if not r[1]]
print("\n" + "═" * 52)
print(f"FASE 2: {len(results) - len(fails)}/{len(results)} PASS — {len(fails)} FAIL")
for name, _, detail in fails:
    print(f"  ✗ {name} — {detail}")
sys.exit(1 if fails else 0)
