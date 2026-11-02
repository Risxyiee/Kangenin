#!/usr/bin/env python3
"""Eksperimen 6: key baru — tes muse-glimmer-30b vs bolt utk tugas confess."""
import json, time, urllib.request, pathlib

KEY = pathlib.Path("/tmp/nvapi_key").read_text().strip()
URL = "https://integrate.api.nvidia.com/v1/chat/completions"

SYS = ("Kamu penulis pesan romantis berbahasa Indonesia yang hangat dan tulus. "
       "Tulis SATU pesan singkat (maksimal 500 karakter) untuk dikirim ke seseorang "
       "yang disukai. Gaya: bahasa sehari-hari yang jujur, spesifik, tidak lebay. "
       "Paling banyak satu emoji. Jangan pakai tanda kutip di awal/akhir. Jangan "
       "pernah menyebut bahwa kamu AI — balas HANYA isi pesannya, siap kirim.")


def post(model, messages, max_tokens=400, timeout=90):
    p = {"model": model, "max_tokens": max_tokens, "stream": False,
         "temperature": 1, "top_p": 0.95, "messages": messages}
    req = urllib.request.Request(
        URL, data=json.dumps(p).encode(),
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
        method="POST")
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = json.loads(r.read().decode())
            msg = body["choices"][0]["message"]
            dt = time.time() - t0
            usage = body.get("usage", {})
            return (dt, 200, msg, usage)
    except urllib.error.HTTPError as e:
        return (time.time() - t0, e.code, {"content": f"ERR {e.reason}"}, {})
    except Exception as e:  # noqa: BLE001
        return (time.time() - t0, 0, {"content": f"ERR {e}"}, {})


# 1) tes logika ala contoh user (9.11 vs 9.8)
for model in ["meta/muse-glimmer-30b", "nvidia/nemotron-3.5-bolt-e4b"]:
    dt, s, msg, usage = post(model, [{"role": "user",
        "content": "Which number is larger, 9.11 or 9.8? Answer briefly."}])
    r = (msg.get("reasoning_content") or "")
    print(f"[logika] {model:32s} {dt:5.1f}s HTTP {s} reason={len(r)} tok={usage.get('completion_tokens')}")
    print(f"    -> {(msg.get('content') or '')[:100].strip()}")

print()
# 2) tugas confess asli (3x bolt utk cek konsistensi, 2x muse)
task = [{"role": "system", "content": SYS},
        {"role": "user", "content":
         "Pengirim anonim (tidak disebut namanya). Penerima: Nadia. "
         "Ini pesan confess — pengirim mau menyatakan perasaannya.\n\nTulis pesannya sekarang."}]
for model, i in [("meta/muse-glimmer-30b", 1), ("meta/muse-glimmer-30b", 2),
                 ("nvidia/nemotron-3.5-bolt-e4b", 1)]:
    dt, s, msg, usage = post(model, task)
    r = (msg.get("reasoning_content") or "")
    c = (msg.get("content") or "").strip()
    print(f"[confess #{i}] {model:32s} {dt:5.1f}s HTTP {s} reason={len(r)} tok={usage.get('completion_tokens')} len={len(c)}")
    print(f"    -> {c[:180]}")
    print()
