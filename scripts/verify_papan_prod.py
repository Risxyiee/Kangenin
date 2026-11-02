#!/usr/bin/env python3
"""
Verify produksi — fitur Papan Pengakuan (isi confess tayang di halaman depan).
Pakai: python3 scripts/verify_papan_prod.py [BASE_URL]

Ekspektasi: kolom showMessage/showAs SUDAH ada di DB produksi + deploy terbaru.

PELAJARAN 2026-11-02: caching Hyperdrive masih aktif di produksi (TTL ±60 dtk,
terbukti lewat probe read-after-write: entry POST langsung GET / TIDAK muncul,
baru muncul setelah jendela cache basi). Karena itu SEMUA cek kehadiran di
beranda pakai POLLING (maks 180 dtk), meniru pola verifikasi dinding
(344533f). Kalau suatu saat caching dimatikan di dashboard Cloudflare,
polling ini otomatis lolos di iterasi pertama — skrip kebal dua dunia.
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


def poll_landing(desc, cond):
    """Poll GET / sampai cond(html) True. Return html terakhir + status kecapaian."""
    t0 = time.time()
    n = 0
    while True:
        n += 1
        s, html = req("/")
        if s == 200 and cond(html):
            print(f"    [{desc}] lolos di iterasi {n} ({time.time() - t0:.0f} dtk)")
            return html, True
        if time.time() - t0 > POLL_TIMEOUT:
            return html, False
        time.sleep(POLL_EVERY)


def main():
    t_start = time.time()

    # 1. Landing sehat sebelum apapun
    s, html = req("/")
    check("GET / 200", s == 200, f"status={s}")
    check("landing ada section Papan", 'id="papan"' in html)
    check("landing ada CTA papan", "Tulis pengakuanmu" in html)

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

    # 3. POLLING beranda sampai entry tayang (cache Hyperdrive 60dtk)
    html, ok = poll_landing("tayang-nama", lambda h: UNIQ in h and SNIPPET in h)
    check("isi surat tampil di papan", SNIPPET in html)
    check("nama depan pengirim tampil", UNIQ in html)
    check("nama depan penerima tampil", ">Nadia<" in html)
    check("no HP termasking", "081234567890" not in html)
    check("email termasking", "test@mail.com" not in html)
    check("URL termasking", "www.contoh.com" not in html)
    check("slug TIDAK bocor di papan", slug not in html)
    check("papan muncul dalam batas polling", ok)

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
    html, ok = poll_landing("mode-anonim", lambda h: UNIQ not in h and SNIPPET in h)
    check("mode anonim: isi tetap tampil", SNIPPET in html)
    check("mode anonim: nama depan hilang", UNIQ not in html)
    check("papan anonim dalam batas polling", ok)

    # 6. Ganti mode: off → privat (isi hilang dari beranda) — polling
    s, body = req(f"/api/status/{skey}", "PATCH", {"wallMode": "off"})
    check("PATCH wallMode=off", s == 200, body[:80])
    html, ok = poll_landing("mode-privat", lambda h: SNIPPET not in h)
    check("mode privat: isi hilang dari papan", SNIPPET not in html)
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
