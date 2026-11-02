import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { rateLimit } from "@/lib/rate-limit";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

/**
 * POST /api/image-to-text — deskripsi gambar via LLM vision gratis.
 *
 * Rantai provider:
 *   1. NVIDIA NIM — `nvidia/nemotron-3.5-super-vl-120b-a12b` (±4 dtk, teruji)
 *      key: Secret Cloudflare `NVIDIA_API_KEY` (.env.local untuk dev)
 *      Catatan: model ini reasoning — `max_tokens` MINIMAL 1200 supaya
 *      token tidak habis di reasoning_content sebelum content tercetak.
 *   2. Workers AI binding `AI` — `@cf/meta/llama-3.2-11b-vision-instruct`
 *      (cadangan bila key NVIDIA tidak ada / gagal; perlu sekali "agree"
 *      Meta License saat pertama dipakai).
 *
 * Dipakai untuk fitur "upload screenshot → jadi bahan surat kangen".
 */

// Tipe minimum binding Workers AI — hindari dependensi @cloudflare/workers-types
type AiBinding = {
  run(model: string, input: unknown): Promise<unknown>;
};

const NVIDIA_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_MODEL = "nvidia/nemotron-3.5-super-vl-120b-a12b";
const WF_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 6 * 1024 * 1024; // 6 MB — model vision tak butuh lebih besar
const DEFAULT_PROMPT =
  "Deskripsikan gambar ini secara singkat dan jelas dalam bahasa Indonesia.";
const UPSTREAM_TIMEOUT_MS = 25_000; // vision + reasoning butuh waktu lebih

function readSecret(name: string): string | undefined {
  try {
    const { env } = getCloudflareContext() as unknown as {
      env?: Record<string, string | undefined>;
    };
    if (env?.[name]) return env[name];
  } catch {
    /* bukan runtime Cloudflare (next dev lokal) — lanjut ke process.env */
  }
  return process.env[name] || undefined;
}

function aiBinding(): AiBinding | undefined {
  try {
    const { env } = getCloudflareContext() as unknown as {
      env?: { AI?: AiBinding };
    };
    return env?.AI;
  } catch {
    return undefined; // bukan runtime Cloudflare (next dev lokal)
  }
}

/* Kedua provider menerima gambar sebagai data URI base64 (bukan ArrayBuffer). */
function toDataUri(bytes: ArrayBuffer, mime: string): string {
  const u8 = new Uint8Array(bytes);
  let bin = "";
  const CHUNK = 8192; // hindari stack overflow String.fromCharCode(...)
  for (let i = 0; i < u8.length; i += CHUNK) {
    bin += String.fromCharCode(...u8.subarray(i, i + CHUNK));
  }
  return `data:${mime};base64,${btoa(bin)}`;
}

async function visionNvidia(
  key: string,
  dataUri: string,
  prompt: string
): Promise<string> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(NVIDIA_ENDPOINT, {
      method: "POST",
      signal: ac.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        max_tokens: 1500, // reasoning model — kekecilan = content kosong
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUri } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`nvidia HTTP ${res.status}: ${detail.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content?.trim() ?? "";
  } finally {
    clearTimeout(timer);
  }
}

async function visionWorkersAi(
  ai: AiBinding,
  messages: unknown
): Promise<string> {
  const runVision = () =>
    ai.run(WF_MODEL, { messages, max_tokens: 512 }) as Promise<
      { description?: string; response?: string } | string
    >;

  let result;
  try {
    result = await runVision();
  } catch (firstErr) {
    // Penyebab paling umum: Meta License model ini belum disetujui.
    // Model card mewajibkan satu request awal { prompt: "agree" } —
    // kirim sekali, lalu ulangi panggilan vision-nya.
    console.warn(
      "[image-to-text] run pertama gagal — kirim 'agree' Meta License lalu ulangi:",
      describeError(firstErr)
    );
    try {
      await ai.run(WF_MODEL, { prompt: "agree" });
    } catch {
      /* persetujuan gagal — ulangan tetap dicoba, error aslinya yang menang */
    }
    result = await runVision();
  }

  return typeof result === "string"
    ? result
    : (result?.description ?? result?.response ?? "");
}

export async function POST(req: NextRequest) {
  // anti-spam: 10 gambar per 10 menit per IP (hemat kuota model gratis)
  const rl = await rateLimit(req, "image-to-text", 10, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Terlalu sering — coba lagi beberapa menit lagi ya 😅" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Kirim gambar sebagai multipart/form-data, field 'image'." },
      { status: 400 }
    );
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Field 'image' wajib diisi (file gambar)." },
      { status: 400 }
    );
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "Format harus JPG, PNG, atau WebP." },
      { status: 415 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Ukuran gambar maksimal 6 MB." },
      { status: 413 }
    );
  }

  const rawPrompt = form.get("prompt");
  const prompt =
    typeof rawPrompt === "string" && rawPrompt.trim().length > 0
      ? rawPrompt.trim().slice(0, 300)
      : DEFAULT_PROMPT;

  try {
    const bytes = await file.arrayBuffer();
    const dataUri = toDataUri(bytes, file.type);
    const wfMessages = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: dataUri } },
        ],
      },
    ];

    // 1) NVIDIA vision (jika key ada)
    const nvKey = readSecret("NVIDIA_API_KEY");
    if (nvKey) {
      try {
        const desc = await visionNvidia(nvKey, dataUri, prompt);
        if (desc) return NextResponse.json({ description: desc });
      } catch (err) {
        console.error(
          "[image-to-text] NVIDIA gagal, coba Workers AI:",
          describeError(err)
        );
      }
    }

    // 2) cadangan Workers AI (hanya di runtime Cloudflare)
    const ai = aiBinding();
    if (ai) {
      const desc = await visionWorkersAi(ai, wfMessages);
      if (desc) return NextResponse.json({ description: desc });
    }

    return NextResponse.json(
      { error: "Fitur vision belum diaktifkan di server ini." },
      { status: 503 }
    );
  } catch (err) {
    console.error("POST /api/image-to-text error:", describeError(err), err);
    reportError(err, { route: "POST /api/image-to-text" });
    return NextResponse.json(
      { error: "Gagal memproses gambar. Coba lagi ya." },
      { status: 500 }
    );
  }
}
