"""
Verifikasi produksi Panel Admin Kangenin (commit 5865ede).

Yang diuji (semua aksi tulis dibalikin ke kondisi awal):
  1. /admin ter-deploy (HTTP 200)
  2. Gerbang kunci: key salah → 404, key benar → 200
  3. Modul Ringkasan (/api/admin/overview) — field lengkap
  4. Modul Keamanan (/api/admin/keamanan) — ping DB hidup
  5. Modul Masukan — siklus penuh: kirim tes → muncul → PATCH selesai →
     terverifikasi → DELETE bersih
  6. Modul Dinding — siklus aman: hide 1 surat → hilang dari /api/wall →
     unhide → kembali persis seperti semula
"""

import json
import os
import sys
import time

import requests

BASE = "https://kangenin.risyxieee123.workers.dev"
KEY = os.environ.get("ADMIN_KEY", "")  # set env ADMIN_KEY dulu — kunci bawaan lama sudah dihapus (fail-closed)
H = {"x-admin-key": KEY}

PASS, FAIL = [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(("PASS" if cond else "FAIL"), "-", name, ("| " + detail if detail else ""), flush=True)


# 1) Polling /admin sampai deploy selesai (maks ±4 menit)
ok = False
for i in range(40):
    try:
        r = requests.get(f"{BASE}/admin", timeout=15)
        if r.status_code == 200:
            ok = True
            print(f"deploy terdeteksi setelah ~{i * 6} dtk", flush=True)
            break
    except Exception:
        pass
    time.sleep(6)
check("GET /admin 200", ok)

# 2) Gerbang kunci
r = requests.get(f"{BASE}/api/admin/overview", headers={"x-admin-key": "kunci-salah"}, timeout=20)
check("overview key salah -> 404", r.status_code == 404)

r = requests.get(f"{BASE}/api/admin/overview", headers=H, timeout=30)
ov = r.json() if r.status_code == 200 else {}
check("overview key benar -> 200", r.status_code == 200)
need = ["confess", "kado", "gift", "letter", "reactions", "feedback", "viewsTotal", "trend"]
check(
    "overview field lengkap",
    r.status_code == 200 and all(k in ov for k in need),
    "confess=" + json.dumps(ov.get("confess", {}), ensure_ascii=False),
)

# 3) Keamanan
r = requests.get(f"{BASE}/api/admin/keamanan", headers=H, timeout=30)
km = r.json() if r.status_code == 200 else {}
check("keamanan -> 200", r.status_code == 200)
check("ping DB hidup", km.get("db", {}).get("ok") is True, "latency=" + str(km.get("db", {}).get("latencyMs")) + "ms")
check("panel rate limit terbaca", "rateLimit" in km and "errors" in km)

# 4) Masukan — siklus penuh dengan data tes sendiri
msg = f"Tes otomatis panel admin pukul {time.strftime('%H:%M:%S')} — mohon abaikan."
r = requests.post(
    f"{BASE}/api/feedback",
    json={"message": msg, "rating": 5, "category": "lainnya"},
    timeout=30,
)
# 429 = rate limit 5/30mnt/IP (anti-spam bekerja — skrip & probe berbagi IP
# egress yang sama). Cetak selalu statusnya supaya tidak jadi teka-teki.
check(
    "POST /api/feedback (data tes)",
    r.status_code == 200,
    "" if r.status_code == 200 else f"status={r.status_code} body={r.text[:120]}",
)

r = requests.get(f"{BASE}/api/admin/masukan", headers=H, timeout=30)
check("GET masukan -> 200", r.status_code == 200, r.text[:120] if r.status_code != 200 else "")
ms = r.json() if r.status_code == 200 else {"entries": []}
target = next((e for e in ms.get("entries", []) if e["message"] == msg), None)
check("masukan tes terlihat di admin", target is not None, f"total entri={len(ms.get('entries', []))}")

if target:
    r = requests.patch(
        f"{BASE}/api/admin/masukan",
        headers=H,
        json={"id": target["id"], "status": "selesai"},
        timeout=30,
    )
    check("PATCH status -> selesai", r.status_code == 200)

    # Cache Hyperdrive bisa memegang hasil lama ±60-70 dtk (lihat wrangler.jsonc:
    # caching dimatikan di binding — polling ini jaring pengaman masa transisi).
    st = None
    for _ in range(15):
        r = requests.get(f"{BASE}/api/admin/masukan", headers=H, timeout=30)
        st = next(
            (e["status"] for e in r.json().get("entries", []) if e["id"] == target["id"]),
            None,
        )
        if st == "selesai":
            break
        time.sleep(6)
    check("status tersimpan = selesai (polling cache)", st == "selesai")

    r = requests.delete(
        f"{BASE}/api/admin/masukan",
        params={"id": target["id"]},
        headers=H,
        timeout=30,
    )
    check("DELETE masukan tes bersih", r.status_code == 200)

# 5) Dinding — sembunyi & kembali (keadaan akhir = keadaan awal)
r = requests.get(f"{BASE}/api/admin/dinding", headers=H, timeout=30)
dd = r.json() if r.status_code == 200 else {"items": []}
pub = next((x for x in dd.get("items", []) if x["isPublic"]), None)
check("dinding admin terbaca", r.status_code == 200, f"items={len(dd.get('items', []))}")

if pub:
    def patch_dinding(pid, action):
        """PATCH dinding dengan 1x coba-ulang utk 5xx transien Hyperdrive
        (dokumentasi src/lib/db.ts). 4xx tidak diulang — itu error nyata."""
        last = None
        for attempt in (1, 2):
            last = requests.patch(
                f"{BASE}/api/admin/dinding",
                headers=H,
                json={"id": pid, "action": action},
                timeout=30,
            )
            if last.status_code == 200 or last.status_code < 500:
                return last
            time.sleep(10)
        return last

    r = patch_dinding(pub["id"], "hide")
    check(
        "hide surat dari dinding",
        r.status_code == 200,
        "" if r.status_code == 200 else f"status={r.status_code} body={r.text[:120]}",
    )

    # Cache Hyperdrive bisa masih menyajikan daftar lama ±60 dtk → polling.
    hilang = False
    for _ in range(15):
        w = requests.get(f"{BASE}/api/wall", params={"limit": 96}, timeout=30).json()
        if all(x["id"] != pub["id"] for x in w.get("items", [])):
            hilang = True
            break
        time.sleep(6)
    check("surat hilang dari /api/wall (polling cache)", hilang)

    r = patch_dinding(pub["id"], "unhide")
    check(
        "unhide surat (pulihkan)",
        r.status_code == 200,
        "" if r.status_code == 200 else f"status={r.status_code} body={r.text[:120]}",
    )

    # Cache Hyperdrive ±60 dtk bisa masih pegang hasil saat surat disembunyikan
    # (prilaku terdokumentasi di src/lib/db.ts) → polling maks 90 dtk.
    back = False
    for _ in range(15):
        w = requests.get(f"{BASE}/api/wall", params={"limit": 96}, timeout=30).json()
        if any(x["id"] == pub["id"] for x in w.get("items", [])):
            back = True
            break
        time.sleep(6)
    check("surat kembali di /api/wall (polling cache)", back)
else:
    print("SKIP - tidak ada surat publik di dinding buat diuji hide/unhide", flush=True)

print()
print(f"=== HASIL: {len(PASS)} PASS / {len(FAIL)} FAIL ===")
if FAIL:
    print("Gagal:", FAIL)
    sys.exit(1)
