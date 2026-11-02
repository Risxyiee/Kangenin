#!/usr/bin/env python3
"""Verifikasi produksi fitur AI Kangenin (post-deploy 5d8be77).
Route tanpa key harus 503 ramah; UI harus memuat tombol Bantuan AI."""
import sys, urllib.request

BASE = "https://kangenin.risyxieee123.workers.dev"
hasil = []


def cek(nama, kondisi, detail=""):
    hasil.append((nama, bool(kondisi), detail))


def req(path, data=None, headers=None, timeout=30):
    h = {"User-Agent": "verify-ai/1.0"}
    if headers:
        h.update(headers)
    r = urllib.request.Request(BASE + path, data=data, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


# 1) POST /api/ai/tulis tanpa key → 503 JSON ramah (bukan 500/HTML)
s, b = req("/api/ai/tulis", data=b'{"toName":"Nadia"}',
           headers={"Content-Type": "application/json"})
cek("tulis tanpa key = 503 ramah", s == 503 and "Fitur AI" in b, f"HTTP {s}: {b[:80]}")

# 2) POST /api/ai/tulis body rusak → 503 dulu (cek key sebelum parse body)
s, b = req("/api/ai/tulis", data=b"bukan-json",
           headers={"Content-Type": "application/json"})
cek("tulis body rusak = 503 (key dicek lebih dulu)", s == 503, f"HTTP {s}")

# 3) Landing memuat tombol Bantuan AI di form confess
s, b = req("/")
cek("landing 200", s == 200, f"HTTP {s}")
cek("landing ada tombol Bantuan AI", "Bantuan AI" in b)

# 4) Halaman /create memuat tombol Bantuan AI (form kado)
s, b = req("/create")
cek("create 200", s == 200, f"HTTP {s}")
cek("create ada tombol Bantuan AI", "Bantuan AI" in b)

# 5) Halaman penting lain tetap hidup
for p in ("/dinding", "/bantuan"):
    s, _ = req(p)
    cek(f"{p} 200", s == 200, f"HTTP {s}")

ok = sum(1 for _, k, _ in hasil if k)
for nama, k, d in hasil:
    print(f"[{'PASS' if k else 'FAIL'}] {nama}  {d}")
print(f"\n{ok}/{len(hasil)} PASS")
sys.exit(0 if ok == len(hasil) else 1)
