"""
Bukti bahwa angka Panel Admin adalah data REAL dari database produksi,
bukan demo/mock. Cukup pakai endpoint PUBLIK (tanpa kunci apa pun):

  1. /api/stats  — hitungan live Confession / Kado / Gift / LetterSet
     (sumber tabel yang SAMA dengan yang dibaca Panel Admin via
     /api/admin/overview — hanya beda jumlah kolom).
  2. /api/wall   — isi dinding publik; nama + tanggal dibuat = jejak
     aktivitas user nyata. Sekalian cek sisa marker data audit
     ([AUDIT / AuditBot / QA Bot).

Angka di screenshot admin (141 confess, 92 kado, 27 kado klasik,
15 surat beruntun) dibandingkan langsung dengan hasil di sini.
"""

import json
import time

import requests

BASE = "https://www.kangenin.web.id"
UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}
MARKER_AUDIT = ("[AUDIT", "AuditBot", "QA Bot")


def get(url: str, timeout: int = 40, percobaan: int = 3):
    """GET dengan retry — dial Hyperdrive dingin bisa stall ±15 dtk."""
    last = None
    for i in range(percobaan):
        try:
            r = requests.get(url, headers=UA, timeout=timeout)
            if r.status_code < 500:
                return r
            last = RuntimeError(f"HTTP {r.status_code}")
        except Exception as e:  # noqa: BLE001
            last = e
        time.sleep(3 * (i + 1))
    raise last  # type: ignore[misc]


print("=== 1) /api/stats (hitungan live dari Supabase) ===")
r = get(f"{BASE}/api/stats")
s = r.json()
print("HTTP", r.status_code, "| X-Stats-Source:", r.headers.get("X-Stats-Source", "-"))
print(
    f"  confessions = {s['confessions']}\n"
    f"  kados       = {s['kados']}\n"
    f"  gifts(kado klasik) = {s['gifts']}\n"
    f"  letters(surat beruntun) = {s['letters']}\n"
    f"  total       = {s['total']}\n"
    f"  generatedAt = {s['generatedAt']}"
)

print("\n=== 2) /api/wall (dinding publik — bukti isi user nyata) ===")
# Dinding cuma membocorkan: from, to, tema, waktu, status jawaban, reaksi.
# Isi surat TIDAK PERNAH ikut (desain privasi).
r = get(f"{BASE}/api/wall?limit=96")
w = r.json()
items = w.get("items", [])
print("HTTP", r.status_code, "| X-Feed-Source:", r.headers.get("X-Feed-Source", "-"))
print("jumlah item publik di dinding:", len(items))
print("\n5 terbaru:")
for it in items[:5]:
    print(
        f"  - id {it.get('id','?')[:8]}… | {it.get('from','?')} -> {it.get('to','?')}"
        f" | tema {it.get('theme','?')} | dibuat {str(it.get('createdAt','?'))[:16]}"
        f" | dijawab: {it.get('answered')} | reaksi {json.dumps(it.get('reactions') or {})}"
    )

print("\n5 terlama:")
for it in items[-5:]:
    print(
        f"  - id {it.get('id','?')[:8]}… | {it.get('from','?')} -> {it.get('to','?')}"
        f" | tema {it.get('theme','?')} | dibuat {str(it.get('createdAt','?'))[:16]}"
    )

print("\n=== 3) sisa marker data audit di dinding publik? ===")
kena = []
for it in items:
    blob = json.dumps({k: it.get(k) for k in ("id", "from", "to", "theme")}, ensure_ascii=False)
    m = [x for x in MARKER_AUDIT if x in blob]
    if m:
        kena.append((it.get("id", "?"), it.get("from"), it.get("to"), str(it.get("createdAt"))[:16], m))
if kena:
    print(f"ADA {len(kena)} item penanda audit:")
    for k in kena:
        print("  -", k)
else:
    print("TIDAK ADA — dinding bersih dari data uji")
