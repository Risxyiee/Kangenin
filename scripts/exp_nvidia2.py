#!/usr/bin/env python3
"""Eksperimen 2 NVIDIA NIM: cari model cepat non-reasoning + tes vision."""
import json, time, urllib.request, pathlib

KEY = pathlib.Path("/tmp/nvapi_key").read_text().strip()
URL = "https://integrate.api.nvidia.com/v1/chat/completions"


def call(payload, timeout=75):
    req = urllib.request.Request(
        URL, data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json",
                 "Accept": "application/json"}, method="POST")
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = json.loads(r.read().decode())
            dt = time.time() - t0
            msg = body.get("choices", [{}])[0].get("message", {})
            usage = body.get("usage", {})
            return (dt, r.status, (msg.get("content") or "").strip()[:110],
                    bool(msg.get("reasoning_content")), usage.get("total_tokens"))
    except Exception as e:  # noqa: BLE001
        return time.time() - t0, getattr(e, "code", 0), f"ERR {e}"[:110], None, None


def txt(model, extra=None):
    p = {"model": model, "max_tokens": 300, "stream": False,
         "messages": [{"role": "user", "content":
                       "Tulis SATU pesan confess pendek (maks 40 kata) untuk 'Nadia' dari pengirim anonim. Bahasa Indonesia, tulus, tanpa kutip."}]}
    if extra:
        p.update(extra)
    return call(p)


for model in ["google/gemma-3-4b-it", "z-ai/glm-5.3-flash",
              "meta/llama-3.2-11b-vision-instruct", "mistralai/mistral-7b-instruct-v0.3"]:
    dt, status, content, has_reason, tok = txt(model)
    print(f"{model:42s} {dt:6.1f}s HTTP {status} reasoning={has_reason} tok={tok}")
    print(f"    -> {content}")

# tes vision: gambar contoh publik
vis = {"model": "meta/llama-3.2-11b-vision-instruct", "max_tokens": 200, "stream": False,
       "messages": [{"role": "user", "content": [
           {"type": "text", "text": "Deskripsikan gambar ini dalam satu kalimat bahasa Indonesia."},
           {"type": "image_url", "image_url": {"url":
            "https://assets.ngc.nvidia.com/products/api-catalog/phi-3-5-vision/example1b.jpg"}}]}]}
dt, status, content, has_reason, tok = call(vis)
print(f"\nVISION llama-3.2-11b-vision {dt:6.1f}s HTTP {status} tok={tok}")
print(f"    -> {content}")
