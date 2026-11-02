#!/usr/bin/env python3
"""
Verifikasi produksi kontrol Dinding Kangenin (opt-in/out dari dashboard):
  1. create confess dengan isPublic=false
  2. GET /api/wall → TIDAK muncul
  3. PATCH /api/status/<senderKey> {isPublic:true} → 200
  4. GET /api/status → isPublic=true; GET /api/wall → MUNCUL
  5. PATCH balik {isPublic:false} → hilang lagi dari dinding
Catatan: /api/wall & /dinding bisa stale ±60 dtk (cache Hyperdrive/ISR) —
pemeriksaan dinding diulang sampai 90 dtk sebelum dinyatakan gagal.
Jalankan SETELAH deploy b8c80f2 selesai (cek pakai verify_prod_feedback.py).
"""
import json
import time
import urllib.request
import urllib.error

BASE = "https://kangenin.risyxieee123.workers.dev"
UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36")
# nama unik per run — biar nggak ketukar sama sisa run sebelumnya di dinding
MARK = f"AuditDinding-{int(time.time()) % 100000}"

P = F = 0
def ok(m): global P; P += 1; print(f"  PASS: {m}")
def bad(m): global F; F += 1; print(f"  FAIL: {m}")

def call(method, path, body=None, timeout=30):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        BASE + path, data=data, method=method,
        headers={"Content-Type": "application/json", "User-Agent": UA},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            txt = r.read().decode()
            try:
                return r.status, json.loads(txt)
            except Exception:
                return r.status, txt
    except urllib.error.HTTPError as e:
        txt = e.read().decode()
        try:
            return e.code, json.loads(txt)
        except Exception:
            return e.code, txt
    except Exception as e:
        return 0, str(e)

def wall_has():
    """Cari item dinding by nama toName unik (item wall nggak membawa slug/id
    yang bisa dicocokkan dari luar)."""
    st, res = call("GET", "/api/wall?limit=96")
    if st != 200 or not isinstance(res, dict):
        return False, f"HTTP {st}"
    for it in res.get("items", []):
        if it.get("to") == MARK:
            return True, it
    return False, f"{len(res.get('items', []))} item"

print("=== [1] Create confess (isPublic=false, dan PALING PENTING: 0 = tidak ada di dinding) ===")
st, res = call("POST", "/api/confess", {
    "toName": MARK,
    "message": f"Uji otomatis dinding {MARK} — isi surat ini tidak boleh bocor ke mana pun.",
    "isPublic": False,
})
skey = (res or {}).get("senderKey", "") if isinstance(res, dict) else ""
if st in (200, 201) and skey:
    ok(f"confess uji terbentuk (senderKey ada)")
else:
    bad(f"create gagal: HTTP {st} {str(res)[:150]}")
    print(f"HASIL: PASS={P} FAIL={F}")
    raise SystemExit(1)

st, res = call("GET", f"/api/status/{skey}")
if st == 200 and isinstance(res, dict) and res.get("isPublic") is False:
    ok("GET status mengembalikan isPublic=false (field baru hidup)")
else:
    bad(f"GET status: HTTP {st} isPublic={res.get('isPublic') if isinstance(res, dict) else res}")
conf_id = (res or {}).get("slug") if isinstance(res, dict) else None  # id tak dikirim; pakai toName utk cek wall

found, info = wall_has()
if not found:
    ok(f"belum opt-in → tidak ada di dinding ({info})")
else:
    bad("muncul di dinding PADAHAL belum opt-in!")

print("=== [2] PATCH isPublic=true (opt-in via dashboard) ===")
st, res = call("PATCH", f"/api/status/{skey}", {"isPublic": True})
if st == 200 and isinstance(res, dict) and res.get("success"):
    ok("PATCH opt-in sukses")
else:
    bad(f"PATCH gagal: HTTP {st} {str(res)[:150]}")

st, res = call("GET", f"/api/status/{skey}")
if st == 200 and isinstance(res, dict) and res.get("isPublic") is True:
    ok("status kini isPublic=true")
else:
    bad(f"GET status: HTTP {st} isPublic={res.get('isPublic') if isinstance(res, dict) else res}")

print("=== [3] Muncul di dinding (toleransi cache ±90 dtk) ===")
seen = False
for i in range(12):
    found, info = wall_has()
    if found:
        ok(f"muncul di /api/wall: {info if isinstance(info, str) else info.get('from')} → {info.get('to') if isinstance(info, dict) else ''}")
        seen = True
        break
    time.sleep(8)
if not seen:
    bad(f"tidak kunjung muncul di dinding ({info})")

print("=== [4] PATCH balik isPublic=false → hilang dari dinding ===")
st, res = call("PATCH", f"/api/status/{skey}", {"isPublic": False})
if st == 200 and isinstance(res, dict) and res.get("success"):
    ok("PATCH opt-out sukses")
else:
    bad(f"PATCH opt-out gagal: HTTP {st}")

gone = False
for i in range(12):
    found, info = wall_has()
    if not found:
        ok(f"hilang lagi dari dinding ({info})")
        gone = True
        break
    time.sleep(8)
if not gone:
    bad("masih nyangkut di dinding setelah opt-out!")

print(f"HASIL: PASS={P} FAIL={F}")
print("KONTROL DINDING SEHAT ✅" if F == 0 else "MASIH ADA MASALAH ❌")
