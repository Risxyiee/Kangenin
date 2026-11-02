#!/usr/bin/env python3
"""Verifikasi produksi fitur AI Kangenin (setelah NVIDIA_API_KEY diset).
Ekspektasi: /api/ai/tulis hidup (200 + draft), validasi 400, UI tampil."""
import sys, urllib.request

BASE = "https://kangenin.risyxieee123.workers.dev"
hasil = []


def cek(nama, kondisi, detail=""):
    hasil.append((nama, bool(kondisi), detail))


def req(path, data=None, headers=None, timeout=40):
    h = {"User-Agent": "verify-ai/1.0"}
    if headers:
        h.update(headers)
    r = urllib.request.Request(BASE + path, data=data, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


# 1) draft confess valid → 200 + pesan
s, b = req("/api/ai/tulis", data=b'{"toName":"Nadia","jenis":"confess"}',
           headers={"Content-Type": "application/json"})
draft = ""
if s == 200:
    try:
        draft = __import__("json").loads(b).get("message", "")
    except Exception:  # noqa: BLE001
        pass
cek("tulis valid = 200 + draft", s == 200 and 10 < len(draft) <= 600,
    f"HTTP {s}: {draft[:90]}")

# 2) tanpa toName → 400
s, b = req("/api/ai/tulis", data=b"{}",
           headers={"Content-Type": "application/json"})
cek("tulis tanpa toName = 400", s == 400, f"HTTP {s}: {b[:60]}")

# 3) body rusak → 400
s, b = req("/api/ai/tulis", data=b"bukan-json",
           headers={"Content-Type": "application/json"})
cek("tulis body rusak = 400", s == 400, f"HTTP {s}")

# 4) jenis kado → 200
s, b = req("/api/ai/tulis", data=b'{"toName":"Budi","jenis":"kado"}',
           headers={"Content-Type": "application/json"})
cek("tulis jenis kado = 200", s == 200, f"HTTP {s}")

# 5) UI tombol Bantuan AI di landing & create
s, b = req("/")
cek("landing 200 + tombol AI", s == 200 and "Bantuan AI" in b, f"HTTP {s}")
s, b = req("/create")
cek("create 200 + tombol AI", s == 200 and "Bantuan AI" in b, f"HTTP {s}")

# 6) halaman penting lain tetap hidup
for p in ("/dinding", "/bantuan"):
    s, _ = req(p)
    cek(f"{p} 200", s == 200, f"HTTP {s}")

ok = sum(1 for _, k, _ in hasil if k)
for nama, k, d in hasil:
    print(f"[{'PASS' if k else 'FAIL'}] {nama}  {d}")
print(f"\n{ok}/{len(hasil)} PASS")
sys.exit(0 if ok == len(hasil) else 1)
