import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { rateLimit } from "@/lib/rate-limit";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

/**
 * POST /api/ai/tulis — draft pesan confess/kado via OrcaRouter (GLM flash free).
 *
 * Model: z-ai/glm-5.3-flash-free ($0/token selama masih ada di lineup).
 * Endpoint OpenAI-compatible: https://api.orcarouter.ai/v1/chat/completions
 *
 * Key TIDAK PERNAH dikirim ke browser — disimpan sebagai Cloudflare Secret
 * bernama `ORCAROUTER_API_KEY` (Dashboard → Worker → Settings → Variables and
 * Secrets → Add Secret). Lokal dev: taruh di .env.local.
 * Kalau key belum diset, route balas 503 dengan pesan ramah — UI tetap aman.
 *
 * Anti-spam: 8 draft / 10 menit / IP (limiter durable yang sama dengan form
 * lain). Output dipotong 600 karakter & dibersihkan sebelum diberikan ke
 * textarea — pesan final tetap dimoderasi ulang oleh endpoint create saat
 * dikirim (lib/moderation), jadi draft AI tidak punya jalur pintas.
 */

const ENDPOINT = "https://api.orcarouter.ai/v1/chat/completions";
const MODEL = "z-ai/glm-5.3-flash-free";
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

function orcaKey(): string | undefined {
  try {
    const { env } = getCloudflareContext() as unknown as {
      env?: { ORCAROUTER_API_KEY?: string };
    };
    if (env?.ORCAROUTER_API_KEY) return env.ORCAROUTER_API_KEY;
  } catch {
    /* bukan runtime Cloudflare (next dev lokal) — lanjut ke process.env */
  }
  return process.env.ORCAROUTER_API_KEY || undefined;
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

export async function POST(req: NextRequest) {
  // anti-spam: 8 draft per 10 menit per IP — model gratis tapi tetap dijaga
  const rl = await rateLimit(req, "ai-tulis", 8, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Kamu udah minta banyak draft banget — istirahat dulu ya, coba lagi beberapa menit lagi 😅" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const key = orcaKey();
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

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), UPSTREAM_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
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
            {
              role: "user",
              content: `${garisPenerima} ${garisJenis}${garisKonteks}\n\nTulis pesannya sekarang.`,
            },
          ],
        }),
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const status = res.status;
      const detail = await res.text().catch(() => "");
      console.error(
        `[ai-tulis] upstream ${status}: ${detail.slice(0, 300)}`
      );
      // 401/403 = key salah/kadaluarsa; 429 = kuota model free habis
      const pesan =
        status === 429
          ? "AI-nya lagi rame dipakai orang — coba lagi beberapa saat lagi ya."
          : "AI-nya lagi ngambek. Coba lagi sebentar lagi ya 🙏";
      return NextResponse.json({ error: pesan }, { status: 502 });
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const draft = cleanDraft(data.choices?.[0]?.message?.content ?? "");
    if (!draft) {
      return NextResponse.json(
        { error: "AI-nya nggak nulis apa-apa. Coba lagi ya." },
        { status: 502 }
      );
    }
    return NextResponse.json({ message: draft });
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === "AbortError";
    if (!timedOut) {
      console.error("POST /api/ai/tulis error:", describeError(err), err);
      reportError(err, { route: "POST /api/ai/tulis" });
    }
    return NextResponse.json(
      {
        error: timedOut
          ? "AI-nya lama banget merespons — coba lagi ya."
          : "Gagal membuat draft. Coba lagi ya.",
      },
      { status: 502 }
    );
  }
}
