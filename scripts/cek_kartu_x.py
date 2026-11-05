"""
Diagnosis kartu preview link kado di X/Twitter.
Alur: buat kado uji (sender AuditBot — auto-ter-sapu tombol sapu QA)
→ buka /kado/<id> dengan UA Twitterbot di domain non-www + www
→ bedah meta og:/twitter: + ukur durasi (X punya timeout crawler ketat)
→ hapus kado uji (self-cleaning).
"""

import json
import re
import time

import requests

BASE = "https://www.kangenin.web.id"
CHROME = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
XBOT = "Twitterbot/1.0"

uniq = f"XTest{int(time.time()) % 100000}"
payload = {
    "targetName": f"Penerima {uniq}",
    "message": f"Pesan uji kartu X {uniq} — akan langsung dihapus.",
    "senderName": "AuditBot",
    "isAnonymous": False,
    "kadoType": "bouquet",
    "kadoData": {"occasion": "audit", "message": "Uji kartu X."},
}

r = requests.post(f"{BASE}/api/kado", json=payload,
                  headers={"User-Agent": CHROME}, timeout=45)
kado_id = r.json().get("data", {}).get("id", "")
print(f"POST /api/kado -> {r.status_code} id={kado_id}")
if r.status_code != 201 or not kado_id:
    raise SystemExit("gagal buat kado uji")

try:
    for domain in ("kangenin.web.id", "www.kangenin.web.id"):
        url = f"https://{domain}/kado/{kado_id}"
        t0 = time.time()
        r = requests.get(url, headers={"User-Agent": XBOT}, timeout=45,
                         allow_redirects=True)
        dur = time.time() - t0
        print(f"\n== {url} (UA Twitterbot) ==")
        print(f"HTTP {r.status_code} | {dur:.2f}s | redirect: {r.history and [h.status_code for h in r.history]} final={r.url}")
        html = r.text
        for pat in (r'property="og:title"\s+content="([^"]+)"',
                    r'property="og:image"\s+content="([^"]+)"',
                    r'name="twitter:card"\s+content="([^"]+)"',
                    r'name="twitter:image"\s+content="([^"]+)"'):
            m = re.search(pat, html)
            print("  ", (m.group(1)[:100] if m else "!! TIDAK ADA") , "<-", pat[:36])
        if r.status_code != 200 or dur > 10:
            print("  >>> INI MASALAHNYA: X memberi waktu sangat singkat untuk fetch kartu")
finally:
    rd = requests.delete(f"{BASE}/api/kado/{kado_id}",
                         headers={"User-Agent": CHROME}, timeout=45)
    print(f"\ncleanup: DELETE kado uji -> {rd.status_code}")
