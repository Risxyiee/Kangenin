"""
probe_masukan.py — karakterisasi baca-tulis modul masukan di produksi:
  1. POST feedback tes (status harus 200)
  2. GET daftar SESAAT — catat kapan baris tes MULAI terlihat (ukur TTL cache)
  3. Polling tiap 5 dtk maks 100 dtk sampai terlihat
  4. DELETE baris tes (status harus 200) + GET konfirmasi bersih
Semua langkah mencetak status HTTP eksplisit — tidak ada asumsi senyap.
"""

import time

import requests

BASE = "https://kangenin.risyxieee123.workers.dev"
H = {"x-admin-key": "kangenin-admin-2026"}

msg = f"Probe visibilitas masukan pukul {time.strftime('%H:%M:%S')} — mohon abaikan."

r = requests.post(
    f"{BASE}/api/feedback",
    json={"message": msg, "rating": 5, "category": "lainnya"},
    timeout=30,
)
print("POST feedback:", r.status_code, flush=True)
assert r.status_code == 200, r.text[:200]

t0 = time.time()
seen_at = None
while time.time() - t0 < 100:
    r = requests.get(f"{BASE}/api/admin/masukan", headers=H, timeout=30)
    if r.status_code != 200:
        print(f"  +{time.time()-t0:5.1f}s GET -> {r.status_code} (server error)", flush=True)
    else:
        entries = r.json().get("entries", [])
        ada = any(e["message"] == msg for e in entries)
        print(f"  +{time.time()-t0:5.1f}s GET -> 200, entri={len(entries)}, tes terlihat={ada}", flush=True)
        if ada:
            seen_at = time.time() - t0
            break
    time.sleep(5)

if seen_at is None:
    print("HASIL: baris tes TIDAK terlihat dalam 100 dtk — masalah lebih dalam!", flush=True)
    raise SystemExit(1)

# bersihkan
target = None
for _ in range(5):
    r = requests.get(f"{BASE}/api/admin/masukan", headers=H, timeout=30)
    if r.status_code == 200:
        target = next((e["id"] for e in r.json().get("entries", []) if e["message"] == msg), None)
        if target:
            break
    time.sleep(3)
assert target, "id baris tes tidak ketemu"
r = requests.delete(f"{BASE}/api/admin/masukan", params={"id": target}, headers=H, timeout=30)
print("DELETE tes:", r.status_code, flush=True)

time.sleep(3)
r = requests.get(f"{BASE}/api/admin/masukan", headers=H, timeout=30)
n = len(r.json().get("entries", [])) if r.status_code == 200 else -1
print(f"GET pasca-DELETE: {r.status_code}, entri tersisa={n}", flush=True)
print(f"HASIL: insert terlihat setelah {seen_at:.1f} dtk", flush=True)
