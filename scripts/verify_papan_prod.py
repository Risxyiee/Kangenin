#!/usr/bin/env python3
"""
Verify produksi — fitur Papan Pengakuan (isi confess tayang di halaman depan).
Pakai: python3 scripts/verify_papan_prod.py [BASE_URL]
Ekspektasi: kolom showMessage/showAs SUDAH ada di DB produksi + deploy terbaru.
"""
import json
import sys
import time
import urllib.request
import urllib.error

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://kangenin.risyxieee123.workers.dev"
UNIQ = f"Verif{int(time.time()) % 100000}"  # nama unik biar tak bentrok
MSG = (
    "Aku suka cara kamu ketawa waktu jatuhin dompet di perpus. "
    "Hubungi aku di 081234567890 atau test@mail.com ya, atau buka www.contoh.com"
)

results = []


def req(path, method="GET", body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    if data:
        r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(("PASS" if ok else "FAIL"), "-", name, ("| " + detail if detail else ""))


def main():
    # 1. Landing memuat section papan (selalu ada, meski kosong)
    s, html = req("/")
    check("GET / 200", s == 200, f"status={s}")
    check("landing ada section Papan", 'id="papan"' in html)
    check("landing ada CTA papan", "Tulis pengakuanmu" in html)

    # 2. Buat confess dengan mode tayang + nama depan
    s, body = req("/api/confess", "POST", {
        "fromName": UNIQ, "toName": "Nadia", "message": MSG,
        "theme": "rose", "isPublic": True, "showMessage": True, "showAs": "nama",
    })
    d = json.loads(body) if body.startswith("{") else {}
    check("POST /api/confess 201", s == 201, f"status={s} {body[:120]}")
    slug, skey = d.get("slug"), d.get("senderKey")
    if not skey:
        check("punya slug+senderKey", False, body[:200])
        return summary()

    # 3. Muncul di beranda: isi ada, nama depan ada, kontak termasking
    time.sleep(2)
    s, html = req("/")
    check("isi surat tampil di papan", MSG.split(".")[0][:40] in html)
    check("nama depan pengirim tampil", UNIQ in html)
    check("nama depan penerima tampil", ">Nadia<" in html)
    check("no HP termasking", "081234567890" not in html)
    check("email termasking", "test@mail.com" not in html)
    check("URL termasking", "www.contoh.com" not in html)
    check("slug TIDAK bocor di papan", slug not in html)

    # 4. Status API laporkan mode dengan benar
    s, body = req(f"/api/status/{skey}")
    d = json.loads(body) if body.startswith("{") else {}
    check("GET status: showMessage=true", d.get("showMessage") is True, body[:120])
    check("GET status: showAs=nama", d.get("showAs") == "nama", body[:120])

    # 5. Ganti mode: nama → anonim (nama hilang, isi tetap)
    s, body = req(f"/api/status/{skey}", "PATCH", {"wallMode": "anonim"})
    check("PATCH wallMode=anonim", s == 200 and json.loads(body).get("wallMode") == "anonim", body[:80])
    time.sleep(2)
    s, html = req("/")
    check("mode anonim: isi tetap tampil", MSG.split(".")[0][:40] in html)
    check("mode anonim: nama depan hilang", UNIQ not in html)

    # 6. Ganti mode: off → privat (isi hilang dari beranda)
    s, body = req(f"/api/status/{skey}", "PATCH", {"wallMode": "off"})
    check("PATCH wallMode=off", s == 200, body[:80])
    time.sleep(2)
    s, html = req("/")
    check("mode privat: isi hilang dari papan", MSG.split(".")[0][:40] not in html)

    # 7. Jalur lawas isPublic tetap hidup (teaser dinding)
    s, body = req(f"/api/status/{skey}", "PATCH", {"isPublic": True})
    check("PATCH lawas isPublic=true", s == 200, body[:80])
    s, body = req("/api/wall?limit=96")
    ok = s == 200 and UNIQ in body and MSG[:20] not in body
    check("dinding teaser: nama ada, ISI TIDAK", ok, f"status={s}")

    # 8. Cleanup: surat tes jadi privat lagi
    s, body = req(f"/api/status/{skey}", "PATCH", {"wallMode": "off"})
    check("cleanup wallMode=off", s == 200, body[:80])

    # 9. Dinding & privasi tetap sehat
    s, _ = req("/dinding")
    check("GET /dinding 200", s == 200)
    s, html = req("/privasi")
    check("GET /privasi sebut papan", s == 200 and "Papan Pengakuan" in html)

    return summary()


def summary():
    fails = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(fails)}/{len(results)} PASS")
    if fails:
        print("GAGAL:")
        for n, _, d in fails:
            print(" -", n, d)
        sys.exit(1)
    print("SEMUA PASS ✅")


if __name__ == "__main__":
    main()
