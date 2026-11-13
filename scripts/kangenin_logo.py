#!/usr/bin/env python3
"""Logo Kangenin — segel lilin (wax seal) crimson + hati krem.

Palet & motif diambil dari identitas situs (Hero.tsx / globals.css):
  seal  #8e2137  (bg-[#8e2137] di WaxSeal)
  hati  #f0e4dc  (heart-shape !bg-[#f0e4dc])
  dalam #9d1c34  (text-primary / .text-gradient-rose)
  kertas #f5ece4 (cream, tema surat)
Editorial, flat, tanpa gradien/glow — sesuai prinsip desain situs.

Output:
  public/logo.svg        seal transparan (pengganti logo.svg template)
  src/app/icon.svg       favicon Next.js (seal di atas kertas rounded)
  download/logo-kangenin.svg + PNG 512/1024 + preview kecil
"""
import math

# ── path tepi seal bergelombang (Catmull-Rom → cubic bezier) ──────────────
def wavy_path(cx, cy, r, amp, lobes, samples_per_lobe=8):
    pts = []
    n = lobes * samples_per_lobe
    for i in range(n):
        t = 2 * math.pi * i / n
        rr = r + amp * math.cos(lobes * t)
        pts.append((cx + rr * math.cos(t), cy + rr * math.sin(t)))
    d = f"M {pts[0][0]:.2f} {pts[0][1]:.2f} "
    for i in range(1, n + 1):
        p0 = pts[(i - 1) % n]
        p1 = pts[i % n]
        p2 = pts[(i + 1) % n]
        p3 = pts[(i + 2) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f"C {c1[0]:.2f} {c1[1]:.2f} {c2[0]:.2f} {c2[1]:.2f} {p2[0]:.2f} {p2[1]:.2f} "
    return d + "Z"

HEART = (
    "M 120 166 C 106 154 70 132 70 102 C 70 82 84 70 100 70 "
    "C 109 70 116 75 120 83 C 124 75 131 70 140 70 C 156 70 170 82 170 102 "
    "C 170 132 134 154 120 166 Z"
)

SEAL_BODY = wavy_path(120, 120, 94, 4.5, 10)
SEAL_INNER_EDGE = wavy_path(120, 120, 76, 3.0, 10)  # goresan tekanan lilin di tepi

SVG_SEAL = f'''<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="Kangenin">
  <path d="{SEAL_BODY}" fill="#8e2137"/>
  <circle cx="120" cy="120" r="80" fill="#9d1c34"/>
  <path d="{SEAL_INNER_EDGE}" fill="none" stroke="#6f1424" stroke-width="3" opacity="0.55"/>
  <path d="{HEART}" fill="#f0e4dc"/>
</svg>
'''

SVG_ICON = f'''<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="Kangenin">
  <rect width="240" height="240" rx="52" fill="#f5ece4"/>
  <rect x="14" y="14" width="212" height="212" rx="40" fill="none" stroke="#e2d0c2" stroke-width="2" opacity="0.7"/>
  <g transform="translate(9.6 9.6) scale(0.92)">
    <path d="{SEAL_BODY}" fill="#8e2137"/>
    <circle cx="120" cy="120" r="80" fill="#9d1c34"/>
    <path d="{SEAL_INNER_EDGE}" fill="none" stroke="#6f1424" stroke-width="3" opacity="0.55"/>
    <path d="{HEART}" fill="#f0e4dc"/>
  </g>
</svg>
'''

with open("/home/z/my-project/public/logo.svg", "w") as f:
    f.write(SVG_SEAL)
with open("/home/z/my-project/src/app/icon.svg", "w") as f:
    f.write(SVG_ICON)

import cairosvg, os
os.makedirs("/home/z/my-project/download", exist_ok=True)
for name, svg in (("logo-kangenin", SVG_SEAL), ("logo-kangenin-icon", SVG_ICON)):
    with open(f"/home/z/my-project/download/{name}.svg", "w") as f:
        f.write(svg)
    for size in (1024, 512):
        cairosvg.svg2png(bytestring=svg.encode(), write_to=f"/home/z/my-project/download/{name}-{size}.png",
                         output_width=size, output_height=size, background_color="#FFFFFF" if False else None)
# preview kecil untuk dicek visual
cairosvg.svg2png(bytestring=SVG_ICON.encode(), write_to="/tmp/logo-preview-icon.png", output_width=256, output_height=256)
cairosvg.svg2png(bytestring=SVG_SEAL.encode(), write_to="/tmp/logo-preview-seal.png", output_width=256, output_height=256)
# preview seal di atas latar gelap (cek kontras)
cairosvg.svg2png(bytestring=SVG_SEAL.encode(), write_to="/tmp/logo-preview-dark.png",
                 output_width=256, output_height=256, background_color="#211D1A")
print("OK — semua file logo dibuat")
