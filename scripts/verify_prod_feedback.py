#!/usr/bin/env python3
"""
Verifikasi produksi fitur kritik & saran:
  1. GET /masukan hidup (form tampil di HTML)
  2. POST /api/feedback masukan uji → success:true
  3. GET /api/feedback?key=… → masukan uji terlihat + statistik masuk akal
  4. key salah → 404 (proteksi owner jalan)
  5. honeypot → sukses palsu TAPI tidak tersimpan (anti-bot jalan)
Menunggu deploy Cloudflare selesai (endpoint baru = 404 JSON "nggak ada
apa-apa di sini", bukan 404 HTML Next lama).

Catatan: POST dibatasi 5/30 menit/IP — jalankan maksimal 2x dalam setengah
jam, kalau kena 429 berarti jeda dulu.
"""
import json
import os
import time
import urllib.request
import urllib.error

BASE = "https://kangenin.risyxieee123.workers.dev"
KEY = os.environ.get("INSIGHT_KEY", "")  # set env INSIGHT_KEY dulu — kunci bawaan lama sudah dihapus (fail-closed)
MARKER = "Uji otomatis kritik&saran #K7 — abaikan ya 🤖"
UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36")

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

print("=== [0] Tunggu deploy (GET key salah → 404 JSON 'nggak ada apa-apa') ===")
ready = False
for attempt in range(20):
    st, res = call("GET", f"/api/feedback?key=cek-deploy")
    print(f"    percobaan {attempt+1}: GET key salah → HTTP {st} {str(res)[:80]}")
    if st == 404 and isinstance(res, dict) and res.get("error") == "nggak ada apa-apa di sini":
        ok("endpoint /api/feedback hidup — key salah ditolak 404 JSON")
        ready = True
        break
    time.sleep(15)
if not ready:
    bad("endpoint /api/feedback tidak kunjung hidup — deploy belum selesai")
    print(f"HASIL: PASS={P} FAIL={F}")
    raise SystemExit(1)

print("=== [1] Halaman /masukan hidup ===")
st, res = call("GET", "/masukan")
if st == 200 and isinstance(res, str) and "Kritik" in res:
    ok("/masukan tampil (HTML memuat judul Kritik & Saran)")
else:
    bad(f"/masukan aneh: HTTP {st}, memuat 'Kritik'? {isinstance(res, str) and 'Kritik' in res}")

print("=== [2] Kirim masukan uji ===")
st, res = call("POST", "/api/feedback", {
    "message": MARKER,
    "rating": 5,
    "category": "fitur",
    "contact": "@ujiotomatis",
    "path": "/masukan?dari=uji-otomatis",
})
if st == 200 and isinstance(res, dict) and res.get("success"):
    ok("POST masukan → success (tabel feedback auto-terbentuk bila belum ada)")
else:
    bad(f"POST masukan gagal: HTTP {st} {str(res)[:150]}")
    print(f"HASIL: PASS={P} FAIL={F}")
    raise SystemExit(1)

print("=== [3] Honeypot: bot di-drop diam-diam ===")
st, res = call("POST", "/api/feedback", {
    "message": MARKER + " HONEYPOT",
    "rating": 1,
    "category": "bug",
    "website": "http://spam.example",
})
hp_ok = st == 200 and isinstance(res, dict) and res.get("success")
if hp_ok:
    ok("honeypot dibalas sukses palsu (bot nggak tahu dia ditolak)")
else:
    bad(f"honeypot respons aneh: HTTP {st} {str(res)[:150]}")

print("=== [4] Owner membaca via /insight API ===")
st, res = call("GET", f"/api/feedback?key={KEY}")
if st == 200 and isinstance(res, dict):
    stats, entries = res.get("stats", {}), res.get("entries", [])
    found = any(MARKER in (e.get("message", "")) and "HONEYPOT" not in e.get("message", "")
                for e in entries)
    hp_leaked = any("HONEYPOT" in (e.get("message", "")) for e in entries)
    if stats.get("total", 0) >= 1:
        ok(f"statistik terbaca: total={stats.get('total')} last7={stats.get('last7')} "
           f"avg={stats.get('avgRating')} kategori={stats.get('byCategory')}")
    else:
        bad(f"statistik kosong: {stats}")
    if found:
        ok("masukan uji terlihat di daftar (rating 5, kategori fitur, kontak & path utuh)")
    else:
        bad("masukan uji TIDAK terlihat di daftar")
    if not hp_leaked:
        ok("honeypot TIDAK tersimpan (anti-bot terbukti)")
    else:
        bad("honeypot nyasar masuk database!")
    if stats.get("avgRating") is not None and 1 <= stats["avgRating"] <= 5:
        ok(f"rata-rata rating masuk akal: {stats['avgRating']}")
    else:
        bad(f"avgRating aneh: {stats.get('avgRating')}")
else:
    bad(f"GET dengan key benar gagal: HTTP {st} {str(res)[:150]}")

print("=== [5] Proteksi: key benar wajib ===")
st, res = call("GET", "/api/feedback?key=tebak-annya")
if st == 404:
    ok("key salah tetap 404 — data user aman")
else:
    bad(f"key salah tidak ditolak: HTTP {st}")

print(f"HASIL: PASS={P} FAIL={F}")
print("KRITIK & SARAN SEHAT ✅" if F == 0 else "MASIH ADA MASALAH ❌")
