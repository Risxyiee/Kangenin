import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { rateLimit } from "@/lib/rate-limit";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

/**
 * POST /api/ai/tulis — draft pesan confess/kado via NVIDIA NIM (gratis).
 *
 * Model: `nvidia/nemotron-3.5-bolt-e4b` — teruji tercepat di antara model
 * gratis NVIDIA (±1 dtk, non-reasoning, jawaban bersih). Model lain di katalog
 * yang ikut dicoba dan GAGAL syarat latensi (lihat scripts/exp_nvidia*.py):
 *   - minimaxai/minimax-m3.1-flash & meta/muse-glimmer-30b: reasoning 36-90 dtk,
 *     content sering kosong karena max_tokens habis di reasoning_content
 *   - sebagian besar model lain: 404 di endpoint integrate (invoke URL beda)
 *   - z-ai/glm-5.3-flash: 3 dtk tapi reasoning — bolt tetap lebih enak
 *
 * Key: Secret Cloudflare `NVIDIA_API_KEY` (.env.local untuk dev lokal).
 * Key TIDAK PERNAH dikirim ke browser. Kalau key belum diset, balas 503
 * ramah — UI tetap aman.
 *
 * Anti-spam: 8 draft / 10 menit / IP (limiter durable yang sama dengan form
 * lain). Output dipotong 600 karakter & dibersihkan sebelum diberikan ke
 * textarea — pesan final tetap dimoderasi ulang oleh endpoint create saat
 * dikirim (lib/moderation), jadi draft AI tidak punya jalur pintas.
 */

const ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL = "nvidia/nemotron-3.5-bolt-e4b";
const MAX_OUTPUT = 600; // sama dengan maxLength textarea confess
const UPSTREAM_TIMEOUT_MS = 18_000; // klien menyerah di 20 dtk — server duluan

const SYSTEM_PROMPT = [
  "Kamu penulis pesan romantis berbahasa Indonesia yang hangat dan tulus.",
  "Tulis SATU pesan singkat (maksimal 500 karakter) untuk dikirim ke seseorang yang disukai,",
  "atau pesan yang menyertai kado. Gaya: bahasa sehari-hari yang jujur, spesifik, tidak lebay,",
  "tidak klise seperti puisi. Paling banyak satu emoji. Jangan pakai tanda kutip di awal/akhir.",
  "Jangan pernah menyebut bahwa kamu AI atau menulis kalimat pembuka/penjelas apa pun —",
  "balas HANYA isi pesannya, siap kirim.",
].join(" ");

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

function nvidiaKey(): string | undefined {
  return readSecret("NVIDIA_API_KEY");
}

/* Hasil model kadang dibungkus kutip/mulai dengan "Berikut ...:" — rapikan. */
function cleanDraft(raw: string): string {
  let s = raw.trim();
  // buang pembungkus kutip tunggal/ganda kalau mengapit seluruh teks
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length > 1) ||
    (s.startsWith("'") && s.endsWith("'") && s.length > 1)
  ) {
    s = s.slice(1, -1).trim();
  }
  // buang baris pembuka ala asisten ("Berikut draftnya:", "Tentu!" dst.)
  s = s.replace(
    /^(berikut[^:\n]{0,40}:|tentu[^\n]{0,30}!|ok[^\n]{0,20}!)\s*/i,
    ""
  );
  return s.slice(0, MAX_OUTPUT);
}

async function panggilNvidia(key: string, userContent: string): Promise<string> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      signal: ac.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        temperature: 0.9,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`upstream HTTP ${res.status}: ${detail.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: NextRequest) {
  // anti-spam: 8 draft per 10 menit per IP — model gratis tapi tetap dijaga
  const rl = await rateLimit(req, "ai-tulis", 8, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Kamu udah minta banyak draft banget — istirahat dulu ya, coba lagi beberapa menit lagi 😅" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const key = nvidiaKey();
  if (!key) {
    return NextResponse.json(
      { error: "Fitur AI belum diaktifkan di server ini." },
      { status: 503 }
    );
  }

  let body: {
    toName?: unknown;
    fromName?: unknown;
    context?: unknown;
    jenis?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Kirim body JSON: { toName, fromName?, context?, jenis? }." },
      { status: 400 }
    );
  }

  const str = (v: unknown, max: number) =>
    typeof v === "string" ? v.trim().slice(0, max) : "";

  const toName = str(body.toName, 40);
  const fromName = str(body.fromName, 40);
  const context = str(body.context, 300);
  const jenis = body.jenis === "kado" ? "kado" : "confess";

  if (!toName) {
    return NextResponse.json(
      { error: "Nama penerima (toName) wajib diisi." },
      { status: 400 }
    );
  }

  const garisPenerima = fromName
    ? `Pengirim: ${fromName}. Penerima: ${toName}.`
    : `Pengirim anonim (tidak disebut namanya). Penerima: ${toName}.`;
  const garisJenis =
    jenis === "kado"
      ? "Pesan ini menyertai sebuah kado kejutan."
      : "Ini pesan confess — pengirim mau menyatakan perasaannya.";
  const garisKonteks = context
    ? ` Catatan dari pengirim (pakai bila cocok, jangan disebut mentah-mentah): ${context}`
    : "";
  const userContent = `${garisPenerima} ${garisJenis}${garisKonteks}\n\nTulis pesannya sekarang.`;

  let draft = "";
  try {
    draft = cleanDraft(await panggilNvidia(key, userContent));
  } catch (err) {
    console.error("[ai-tulis] NVIDIA gagal:", describeError(err));
    reportError(err, { route: "POST /api/ai/tulis" });
  }

  if (!draft) {
    return NextResponse.json(
      { error: "AI-nya lagi ngambek. Coba lagi sebentar lagi ya 🙏" },
      { status: 502 }
    );
  }
  return NextResponse.json({ message: draft });
}
