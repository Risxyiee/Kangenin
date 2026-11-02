#!/usr/bin/env python3
"""Eksperimen 3: matriks model cepat NVIDIA + bedah isi respons glm-5.3-flash."""
import json, time, urllib.request, pathlib

KEY = pathlib.Path("/tmp/nvapi_key").read_text().strip()
URL = "https://integrate.api.nvidia.com/v1/chat/completions"


def call(model, timeout=60, max_tokens=300):
    p = {"model": model, "max_tokens": max_tokens, "stream": False,
         "messages": [{"role": "user", "content": "Balas satu kalimat singkat: halo!"}]}
    req = urllib.request.Request(
        URL, data=json.dumps(p).encode(),
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
        method="POST")
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = json.loads(r.read().decode())
            msg = body["choices"][0]["message"]
            content = (msg.get("content") or "").strip()
            reason = (msg.get("reasoning_content") or "").strip()
            return (time.time() - t0, 200, len(reason), content[:80])
    except urllib.error.HTTPError as e:
        return (time.time() - t0, e.code, 0, f"ERR {e.reason}"[:80])
    except Exception as e:  # noqa: BLE001
        return (time.time() - t0, 0, 0, f"ERR {e}"[:80])


models = [
    "nvidia/nemotron-3.5-bolt-e4b",
    "nvidia/nemotron-3.5-lightning-30b-a3b",
    "openai/gpt-oss-20b",
    "google/gemma-3-12b-it",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    "moonshotai/kimi-k2.6",
    "deepseek-ai/deepseek-v4.1-flash",
]
for m in models:
    dt, status, rlen, content = call(m)
    print(f"{m:52s} {dt:6.1f}s HTTP {status} reason_len={rlen:5d} :: {content}")

# bedah isi penuh respons glm-5.3-flash (stream, kumpulkan)
print("\n--- glm-5.3-flash stream (max_tokens 1200) ---")
p = {"model": "z-ai/glm-5.3-flash", "max_tokens": 1200, "stream": True,
     "messages": [{"role": "user", "content": "Balas satu kalimat singkat: halo!"}]}
req = urllib.request.Request(
    URL, data=json.dumps(p).encode(),
    headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json",
             "Accept": "text/event-stream"}, method="POST")
t0, reason, content, first_content_at = time.time(), [], [], None
try:
    with urllib.request.urlopen(req, timeout=120) as r:
        for raw in r:
            line = raw.decode().strip()
            if not line.startswith("data: ") or line == "data: [DONE]":
                continue
            delta = json.loads(line[6:])["choices"][0].get("delta", {})
            if delta.get("reasoning_content"):
                reason.append(delta["reasoning_content"])
            if delta.get("content"):
                if first_content_at is None:
                    first_content_at = time.time() - t0
                content.append(delta["content"])
except Exception as e:  # noqa: BLE001
    print("ERR", e)
print(f"total {time.time()-t0:.1f}s | reasoning {len(''.join(reason))} char "
      f"| first content token at {first_content_at}")
print("content:", "".join(content)[:150])
