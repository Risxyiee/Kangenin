#!/usr/bin/env python3
"""Eksperimen 4: kualitas bolt utk tugas asli + tes vision 3 model."""
import json, time, urllib.request, pathlib

KEY = pathlib.Path("/tmp/nvapi_key").read_text().strip()
URL = "https://integrate.api.nvidia.com/v1/chat/completions"
IMG = "https://assets.ngc.nvidia.com/products/api-catalog/phi-3-5-vision/example1b.jpg"


def post(payload, timeout=150):
    req = urllib.request.Request(
        URL, data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
        method="POST")
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = json.loads(r.read().decode())
            msg = body["choices"][0]["message"]
            return (time.time() - t0, 200, msg)
    except urllib.error.HTTPError as e:
        return (time.time() - t0, e.code, {"content": f"ERR {e.reason}"})
    except Exception as e:  # noqa: BLE001
        return (time.time() - t0, 0, {"content": f"ERR {e}"})


# 1) kualitas bolt utk pesan confess
sysmsg = ("Kamu penulis pesan romantis berbahasa Indonesia yang hangat dan tulus. "
          "Tulis SATU pesan singkat (maksimal 500 karakter). Gaya: bahasa sehari-hari "
          "yang jujur, spesifik, tidak lebay. Paling banyak satu emoji. Jangan pakai "
          "tanda kutip di awal/akhir. Jangan pernah menyebut bahwa kamu AI — balas "
          "HANYA isi pesannya, siap kirim.")
p = {"model": "nvidia/nemotron-3.5-bolt-e4b", "max_tokens": 400, "stream": False,
     "temperature": 0.9,
     "messages": [{"role": "system", "content": sysmsg},
                  {"role": "user", "content":
                   "Pengirim anonim (tidak disebut namanya). Penerima: Nadia. "
                   "Ini pesan confess — pengirim mau menyatakan perasaannya.\n\nTulis pesannya sekarang."}]}
dt, status, msg = post(p)
print(f"1) BOLT confess     {dt:5.1f}s HTTP {status}")
print("   ->", (msg.get("content") or "")[:400].strip())

# 2-4) vision
def vision(model):
    p = {"model": model, "max_tokens": 250, "stream": False,
         "messages": [{"role": "user", "content": [
             {"type": "text", "text": "Deskripsikan gambar ini dalam satu kalimat bahasa Indonesia."},
             {"type": "image_url", "image_url": {"url": IMG}}]}]}
    dt, status, msg = post(p)
    c = (msg.get("content") or "").strip()[:150]
    r = (msg.get("reasoning_content") or "")
    print(f"   {model:52s} {dt:5.1f}s HTTP {status} reason={len(r)}")
    print(f"      -> {c}")

print("2) tes vision:")
vision("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning")
vision("nvidia/nemotron-3.5-super-vl-120b-a12b")
vision("meta/llama-3.2-11b-vision-instruct")
