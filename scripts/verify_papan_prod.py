#!/usr/bin/env python3
"""
Verify produksi — fitur Papan Pengakuan (isi confess tayang di halaman depan).
Pakai: python3 scripts/verify_papan_prod.py [BASE_URL]

Ekspektasi: kolom showMessage/showAs ada di DB produksi + deploy terbaru.

PELAJARAN 2026-11-02 (versi 2): feed papan kini CLIENT-SIDE via GET /api/papan
(perbaikan Error 1102 — SSR beranda harus nol query DB). Karena itu semua cek
kehadiran menargetkan JSON /api/papan, bukan HTML beranda. Cache Hyperdrive
query ±60 dtk masih aktif di produksi → polling tetap dipakai (maks 180 dtk),
meniru pola verifikasi dinding (344533f). Kalau caching dimatikan di dashboard,
polling lolos di iterasi pertama — skrip kebal dua dunia.
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
SNIPPET = MSG.split(".")[0][:40]  # prosa murni — tidak kena maskKontak

POLL_TIMEOUT = 180  # dtk — cukup buat 1 jendela cache 60dtk + margin
POLL_EVERY = 15

results = []


def req(path, method="GET", body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    # Cloudflare 1010: UA python urllib diblokir — pakai UA browser.
    r.add_header(
        "User-Agent",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    )
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


def poll_papan(desc, cond):
    """Poll GET /api/papan sampai cond(body) True. Return body terakhir + status."""
    t0 = time.time()
    n = 0
    while True:
        n += 1
        s, body = req("/api/papan")
        if s == 200 and cond(body):
            print(f"    [{desc}] lolos di iterasi {n} ({time.time() - t0:.0f} dtk)")
            return body, True
        if time.time() - t0 > POLL_TIMEOUT:
            return body, False
        time.sleep(POLL_EVERY)


def main():
    t_start = time.time()

    # 1. Landing & API papan sehat sebelum apa pun
    s, html = req("/")
    check("GET / 200", s == 200, f"status={s}")
    check("landing ada section Papan", 'id="papan"' in html)
    check("landing ada CTA papan", "Tulis pengakuanmu" in html)
    s, body = req("/api/papan")
    check("GET /api/papan 200", s == 200, f"status={s}")

    # 2. Buat confess dengan mode tayang + nama depan
    s, body = req(
        "/api/confess",
        "POST",
        {
            "fromName": UNIQ,
            "toName": "Nadia",
            "message": MSG,
            "theme": "rose",
            "isPublic": True,
            "showMessage": True,
            "showAs": "nama",
        },
    )
    d = json.loads(body) if body.startswith("{") else {}
    check("POST /api/confess 201", s == 201, f"status={s} {body[:120]}")
    slug, skey = d.get("slug"), d.get("senderKey")
    if not skey:
        check("punya slug+senderKey", False, body[:200])
        return summary()

    # 3. POLLING /api/papan sampai entry tayang (cache Hyperdrive 60dtk)
    body, ok = poll_papan("tayang-nama", lambda b: UNIQ in b and SNIPPET in b)
    check("isi surat tampil di feed papan", SNIPPET in body)
    check("nama depan pengirim tampil", UNIQ in body)
    check("nama depan penerima tampil", '"to":"Nadia"' in body)
    check("no HP termasking", "081234567890" not in body)
    check("email termasking", "test@mail.com" not in body)
    check("URL termasking", "www.contoh.com" not in body)
    check("slug TIDAK bocor di papan", slug not in body)
    check("feed muncul dalam batas polling", ok)

    # 4. Status API laporkan mode dengan benar (read-after-write, nonce-guard)
    s, body = req(f"/api/status/{skey}")
    d = json.loads(body) if body.startswith("{") else {}
    check("GET status: showMessage=true", d.get("showMessage") is True, body[:120])
    check("GET status: showAs=nama", d.get("showAs") == "nama", body[:120])

    # 5. Ganti mode: nama → anonim (nama hilang, isi tetap) — polling
    s, body = req(f"/api/status/{skey}", "PATCH", {"wallMode": "anonim"})
    check(
        "PATCH wallMode=anonim",
        s == 200 and json.loads(body).get("wallMode") == "anonim",
        body[:80],
    )
    body, ok = poll_papan("mode-anonim", lambda b: UNIQ not in b and SNIPPET in b)
    check("mode anonim: isi tetap tampil", SNIPPET in body)
    check("mode anonim: nama depan hilang", UNIQ not in body)
    check("papan anonim dalam batas polling", ok)

    # 6. Ganti mode: off → privat (isi hilang dari feed) — polling
    s, body = req(f"/api/status/{skey}", "PATCH", {"wallMode": "off"})
    check("PATCH wallMode=off", s == 200, body[:80])
    body, ok = poll_papan("mode-privat", lambda b: SNIPPET not in b)
    check("mode privat: isi hilang dari papan", SNIPPET not in body)
    check("papan privat dalam batas polling", ok)

    # 7. Jalur lawas isPublic tetap hidup (teaser dinding)
    s, body = req(f"/api/status/{skey}", "PATCH", {"isPublic": True})
    check("PATCH lawas isPublic=true", s == 200, body[:80])
    time.sleep(2)
    s, body = req("/api/wall?limit=96")
    ok = s == 200 and UNIQ in body and SNIPPET[:20] not in body
    check("dinding teaser: nama ada, ISI TIDAK", ok, f"status={s}")

    # 8. Cleanup: surat tes jadi privat lagi
    s, body = req(f"/api/status/{skey}", "PATCH", {"wallMode": "off"})
    check("cleanup wallMode=off", s == 200, body[:80])

    # 9. Dinding & privasi tetap sehat
    s, _ = req("/dinding")
    check("GET /dinding 200", s == 200)
    s, html = req("/privasi")
    check("GET /privasi sebut papan", s == 200 and "Papan Pengakuan" in html)

    print(f"\ndurasi total: {time.time() - t_start:.0f} dtk (polling cache Hyperdrive)")
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
