#!/usr/bin/env python3
"""
Ambil kartu OG generik dari produksi → simpan sebagai aset statis
public/og-generic.png. Render satori di Worker berada di batas CPU (1102
kadang muncul), jadi fetch diulang sampai dapat 200.
Pakai: python3 scripts/fetch_og_generic.py
"""
import sys
import time
import urllib.request

URL = "https://kangenin.risyxieee123.workers.dev/api/og"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36"
OUT = "public/og-generic.png"

for i in range(1, 11):
    try:
        req = urllib.request.Request(URL, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=45) as r:
            data = r.read()
        if r.status == 200 and len(data) > 50_000:  # PNG kartu utuh ~190KB
            with open(OUT, "wb") as f:
                f.write(data)
            print(f"OK percobaan {i}: {len(data)} bytes → {OUT}")
            sys.exit(0)
        print(f"percobaan {i}: status={r.status} size={len(data)}")
    except Exception as e:
        print(f"percobaan {i}: {e}")
    time.sleep(2)

print("GAGAL — 10 percobaan tidak ada yang 200")
sys.exit(1)
