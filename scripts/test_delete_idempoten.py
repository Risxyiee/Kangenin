#!/usr/bin/env python3
"""
Uji terisolasi idempotensi DELETE /api/kado/[id] — 3 putaran:
  buat kado → DELETE (harus 200) → DELETE lagi (harus 200, baris sudah tiada).
Kalau DELETE kedua gagal, ulangi DELETE sampai sukses supaya tidak ada sisa
data audit di DB. Body error kegagalan dicetak untuk diagnosis.
"""
import json
import time
import urllib.error
import urllib.request

BASE = "https://www.kangenin.web.id"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)


def call(method, path, body=None, timeout=45):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method)
    r.add_header("User-Agent", UA)
    r.add_header("Content-Type", "application/json")
    t0 = time.time()
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, resp.read(), int((time.time() - t0) * 1000)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), int((time.time() - t0) * 1000)
    except Exception as e:  # noqa: BLE001
        return -1, str(e).encode(), int((time.time() - t0) * 1000)


hasil = []
for ronde in range(1, 4):
    uniq = f"Idem{int(time.time()) % 100000}R{ronde}"
    payload = {
        "targetName": f"Tes {uniq}",
        "message": f"Pesan uji idempotensi {uniq} — akan langsung dihapus.",
        "senderName": "AuditBot",
        "isAnonymous": False,
        "kadoType": "bouquet",
        "kadoData": {"occasion": "audit", "message": "Uji idempotensi."},
    }
    st, raw, ms = call("POST", "/api/kado", payload)
    kadoId = ""
    try:
        kadoId = json.loads(raw).get("data", {}).get("id", "")
    except Exception:  # noqa: BLE001
        pass
    print(f"Ronde {ronde}: POST /api/kado → {st} ({ms}ms) id={kadoId[:8]}…")
    if st != 201 or not kadoId:
        hasil.append(("buat", st))
        continue

    st1, raw1, ms1 = call("DELETE", f"/api/kado/{kadoId}")
    print(f"  DELETE pertama → {st1} ({ms1}ms) body={raw1[:120]!r}")
    st2, raw2, ms2 = call("DELETE", f"/api/kado/{kadoId}")
    print(f"  DELETE kedua   → {st2} ({ms2}ms) body={raw2[:200]!r}")
    hasil.append(("delete2", st2))

    # pastikan bersih: kalau ada yang gagal, terus DELETE sampai 200
    while st1 != 200 or st2 != 200:
        stx, rawx, _ = call("DELETE", f"/api/kado/{kadoId}")
        print(f"  DELETE pembersih → {stx} body={rawx[:120]!r}")
        if stx == 200:
            break
        time.sleep(2)

ok = all(s == 200 for _, s in hasil)
print(f"\nHASIL: {'SEMUA 200 — idempotensi SEHAT (500 tadi = transien)' if ok else 'ADA YANG BUKAN 200 — perlu investigasi kode'}")
print("Rincian:", hasil)
