#!/usr/bin/env python3
"""Eksperimen 5: vision dgn max_tokens besar (reasoning butuh budget)."""
import json, time, urllib.request, pathlib

KEY = pathlib.Path("/tmp/nvapi_key").read_text().strip()
URL = "https://integrate.api.nvidia.com/v1/chat/completions"
IMG = "https://assets.ngc.nvidia.com/products/api-catalog/phi-3-5-vision/example1b.jpg"


def vision(model, max_tokens=1500):
    p = {"model": model, "max_tokens": max_tokens, "stream": False,
         "messages": [{"role": "user", "content": [
             {"type": "text", "text": "Deskripsikan gambar ini dalam satu kalimat bahasa Indonesia."},
             {"type": "image_url", "image_url": {"url": IMG}}]}]}
    req = urllib.request.Request(
        URL, data=json.dumps(p).encode(),
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
        method="POST")
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=150) as r:
            body = json.loads(r.read().decode())
            msg = body["choices"][0]["message"]
            usage = body.get("usage", {})
            dt = time.time() - t0
            print(f"{model}")
            print(f"   {dt:5.1f}s | usage={usage.get('completion_tokens')} tok")
            print(f"   content   : {(msg.get('content') or '')[:180].strip()}")
            r = (msg.get("reasoning_content") or "")[:100]
            if r:
                print(f"   reasoning : {r}…")
    except urllib.error.HTTPError as e:
        print(f"{model}  HTTP {e.code} {e.reason}")
    except Exception as e:  # noqa: BLE001
        print(f"{model}  ERR {e}")


vision("nvidia/nemotron-3.5-super-vl-120b-a12b")
vision("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning")
