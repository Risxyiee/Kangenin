#!/usr/bin/env python3
"""Eksperimen NVIDIA NIM: cek cara mematikan reasoning di minimax-m3.1-flash,
ukur latensi, dan bandingkan dengan model non-reasoning. Key dibaca dari file."""
import json, time, urllib.request, pathlib

KEY = pathlib.Path("/tmp/nvapi_key").read_text().strip()
URL = "https://integrate.api.nvidia.com/v1/chat/completions"
HDR = {"Authorization": f"Bearer {KEY}", "Content-Type": "application/json",
       "Accept": "application/json"}


def call(payload, timeout=90):
    req = urllib.request.Request(URL, data=json.dumps(payload).encode(),
                                 headers=HDR, method="POST")
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = json.loads(r.read().decode())
            dt = time.time() - t0
            msg = body.get("choices", [{}])[0].get("message", {})
            content = (msg.get("content") or "").strip()
            reasoning = bool(msg.get("reasoning_content"))
            return dt, r.status, content[:120], reasoning
    except Exception as e:  # noqa: BLE001
        return time.time() - t0, getattr(e, "code", 0), f"ERR {e}"[:120], None


base = {"model": "minimaxai/minimax-m3.1-flash", "max_tokens": 300,
        "messages": [{"role": "user", "content": "Balas satu kalimat singkat: halo!"}]}

variants = [
    ("plain non-stream", dict(base, stream=False)),
    ("thinking:false", dict(base, stream=False,
        chat_template_kwargs={"thinking": False})),
    ("enable_thinking:false", dict(base, stream=False,
        chat_template_kwargs={"enable_thinking": False})),
    ("reasoning:false", dict(base, stream=False,
        chat_template_kwargs={"reasoning": False})),
    ("reasoning_effort:low", dict(base, stream=False, reasoning_effort="low")),
]

for name, payload in variants:
    dt, status, content, has_reason = call(payload)
    print(f"{name:24s} {dt:6.1f}s HTTP {status} reasoning={has_reason} :: {content}")

# pembanding: model non-reasoning cepat
llama = {"model": "meta/llama-3.3-70b-instruct", "max_tokens": 300, "stream": False,
         "messages": [{"role": "user", "content": "Balas satu kalimat singkat: halo!"}]}
dt, status, content, has_reason = call(llama)
print(f"{'llama-3.3-70b (pembanding)':24s} {dt:6.1f}s HTTP {status} reasoning={has_reason} :: {content}")
