import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getPgPool, withDbRetry, dbNonce } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

// ── Aturan mutlak infrastruktur (OpenNext & Supabase) ──────────────────────
// TANPA `export const runtime = "edge"` — OpenNext Cloudflare meng-compile
// SELURUH app menjadi satu Worker (marker edge memaksa bundler yang tidak
// mendukung builtin Node → build gagal). Koneksi DB HANYA lewat pool pg
// bersama (src/lib/db.ts) → Hyperdrive → direct connection Supabase 5432.

/**
 * Fitur KRITIK & SARAN — jembatan langsung user → founder.
 *
 * POST /api/feedback  — kirim masukan (publik, dari halaman /masukan)
 * GET  /api/feedback?key=… — baca semua masukan + statistik (khusus owner,
 *                      dipakai halaman /insight; key = env INSIGHT_KEY)
 *
 * Tabel `feedback` TIDAK dimodelkan di schema.prisma (mengikuti pola tabel
 * rate_limit: infrastruktur ringan yang diakses raw SQL). Tabel dibuat
 * OTOMATIS saat POST pertama: kalau INSERT kena 42P01 (relation not exist),
 * endpoint menjalankan CREATE TABLE IF NOT EXISTS lalu mengulang insert —
 * nol migrasi manual, nol sentuhan Supabase SQL Editor.
 *
 * Anti-spam berlapis:
 *   - rate limit durable 5 kirim / 30 menit / IP (tabel rate_limit, S-04)
 *   - honeypot `website` (field tersembunyi; bot yang mengisinya di-drop
 *     diam-diam dengan respons sukses palsu — biar bot nggak belajar)
 * Masukan TIDAK melalui moderasi: cuma owner yang bisa membacanya.
 */

const feedbackSchema = z.object({
  message: z.string().trim().min(3, "Ceritanya kependekan").max(1000),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  category: z.enum(["bug", "fitur", "desain", "lainnya"]).nullable().optional(),
  contact: z.string().trim().max(100).nullable().optional(),
  path: z.string().trim().max(300).nullable().optional(),
  // honeypot — manusia nggak bisa mengisi field ini (tersembunyi di form)
  website: z.string().max(200).optional(),
});

const CREATE_TABLE_SQL = `
  create table if not exists feedback (
    id          uuid primary key,
    message     text not null,
    rating      integer check (rating between 1 and 5),
    category    text,
    contact     text,
    path        text,
    user_agent  text,
    created_at  timestamptz not null default now()
  )
`;

// Index dibuat terpisah — IF NOT EXISTS-nya masing-masing, jadi aman diulang.
const CREATE_INDEX_SQL = `
  create index if not exists feedback_created_at_idx on feedback (created_at desc)
`;

const INSERT_SQL = `
  insert into feedback (id, message, rating, category, contact, path, user_agent)
  values ($1::uuid, $2::text, $3::int, $4::text, $5::text, $6::text, $7::text)
`;

// ── Auto-provision tabel (sekali per isolate setelah sukses) ────────────────
let ensurePromise: Promise<void> | null = null;

function ensureFeedbackTable(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const pool = getPgPool();
      // DDL dibungkus withDbRetry — dial dingin isolate segar pascadeploy
      // bisa >4,5 dtk; tanpa ulang = 500. DDL idempoten (IF NOT EXISTS).
      await withDbRetry(() => pool.query(CREATE_TABLE_SQL));
      await withDbRetry(() => pool.query(CREATE_INDEX_SQL));
    })().catch((err) => {
      // gagal → reset supaya request berikutnya mencoba lagi
      ensurePromise = null;
      throw err;
    });
  }
  return ensurePromise;
}

/** Deteksi "relation does not exist" antar varian error (pg / Prisma wrap). */
function isMissingTable(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  if (code === "42P01") return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /42P01|relation "feedback" does not exist/i.test(msg);
}

// ── Kunci baca (halaman /insight) ───────────────────────────────────────────
// Urutan resolusi: binding/secret INSIGHT_KEY di Cloudflare → process.env →
// bawaan. Ganti lewat Cloudflare dashboard (Settings → Variables) kalau mau
// lebih ketat — kode tidak perlu diubah.
function insightKey(): string {
  try {
    const { env } = getCloudflareContext() as unknown as {
      env?: { INSIGHT_KEY?: string }
    }
    if (env?.INSIGHT_KEY) return env.INSIGHT_KEY
  } catch {
    // bukan runtime Cloudflare (dev lokal) → lanjut ke process.env
  }
  return process.env.INSIGHT_KEY ?? "kangenin-insight-2026"
}

export async function POST(req: NextRequest) {
  try {
    // anti-spam: 5 masukan / 30 menit / IP — longgar buat manusia, mematikan
    // buat skrip flood
    const rl = await rateLimit(req, "feedback", 5, 30 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Udah cukup banyak masukan dari perangkat ini. Coba lagi nanti ya." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    // body rusak / bukan JSON → 400 rapi (bukan 500 dari outer catch)
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Format request tidak valid" }, { status: 400 });
    }
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Masukan belum lengkap — ceritanya ditulis dulu ya (min. 3 karakter)." },
        { status: 400 }
      );
    }

    const { message, rating, category, contact, path, website } = parsed.data;

    // honeypot terisi = bot → drop diam-diam, balas sukses palsu
    if (website && website.trim() !== "") {
      return NextResponse.json({ success: true });
    }

    const id = crypto.randomUUID();
    const userAgent = (req.headers.get("user-agent") ?? "").slice(0, 300);

    // pg menolak parameter `undefined` → konversi eksplisit ke null
    const insert = () =>
      getPgPool().query(INSERT_SQL, [
        id,
        message,
        rating ?? null,
        category ?? null,
        contact ?? null,
        path ?? null,
        userAgent,
      ]);

    try {
      await withDbRetry(insert);
    } catch (err) {
      if (!isMissingTable(err)) throw err;
      // POST pertama di hidup database → bikin tabelnya, lalu ulang insert
      console.warn("[feedback] tabel feedback belum ada — dibuat otomatis sekarang");
      await ensureFeedbackTable();
      await withDbRetry(insert);
    }

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store, max-age=0", "CDN-Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("POST /api/feedback error:", describeError(err), err);
    reportError(err, { route: "POST /api/feedback" });
    return NextResponse.json(
      { error: "Gagal mengirim masukan. Coba lagi ya." },
      { status: 500 }
    );
  }
}

// ── Baca masukan (khusus owner, dipakai /insight) ───────────────────────────

type StatsRow = { total: number; rated: number; avg_rating: number; last7: number };
type CatRow = { category: string; n: number };
type EntryRow = {
  id: string;
  message: string;
  rating: number | null;
  category: string | null;
  contact: string | null;
  path: string | null;
  created_at: string;
};

export async function GET(req: NextRequest) {
  try {
    // key salah → 404 (bukan 403) — jangan sempurnakan peta buat pengintip
    const key = req.nextUrl.searchParams.get("key") ?? "";
    if (key !== insightKey()) {
      return NextResponse.json({ error: "nggak ada apa-apa di sini" }, { status: 404 });
    }

    const rl = await rateLimit(req, "feedback-read", 30, 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan. Coba lagi nanti ya." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    // dbNonce: baca SETELAH tulis harus ke origin, bukan cache Hyperdrive
    // (pelajaran staleness produksi 2026-11-01 — lihat src/lib/db.ts)
    const nonce = dbNonce();
    const statsQ = withDbRetry(() =>
      getPgPool().query<StatsRow>(
        `/* ${nonce} */
         select count(*)::int as total,
                count(rating)::int as rated,
                coalesce(round(avg(rating)::numeric, 2), 0)::float8 as avg_rating,
                count(*) filter (where created_at > now() - interval '7 days')::int as last7
         from feedback`
      )
    );
    const catsQ = withDbRetry(() =>
      getPgPool().query<CatRow>(
        `/* ${nonce} */
         select coalesce(category, 'tanpa-kategori') as category, count(*)::int as n
         from feedback group by 1 order by n desc`
      )
    );
    const entriesQ = withDbRetry(() =>
      getPgPool().query<EntryRow>(
        `/* ${nonce} */
         select id, message, rating, category, contact, path, created_at
         from feedback
         order by created_at desc
         limit 100`
      )
    );

    let stats, cats, entries;
    try {
      [stats, cats, entries] = await Promise.all([statsQ, catsQ, entriesQ]);
    } catch (err) {
      if (isMissingTable(err)) {
        // tabel belum pernah dibuat = belum ada masukan apa pun → jawab kosong
        return NextResponse.json(
          {
            stats: { total: 0, rated: 0, avgRating: null, last7: 0, byCategory: {} },
            entries: [],
          },
          { headers: { "Cache-Control": "no-store, max-age=0" } }
        );
      }
      throw err;
    }

    const s = stats.rows[0];
    const byCategory: Record<string, number> = {};
    for (const row of cats.rows) byCategory[row.category] = Number(row.n);

    return NextResponse.json(
      {
        stats: {
          total: Number(s?.total ?? 0),
          rated: Number(s?.rated ?? 0),
          avgRating: Number(s?.rated ?? 0) > 0 ? Number(s?.avg_rating ?? 0) : null,
          last7: Number(s?.last7 ?? 0),
          byCategory,
        },
        entries: entries.rows.map((r) => ({
          id: r.id,
          message: r.message,
          rating: r.rating === null ? null : Number(r.rating),
          category: r.category,
          contact: r.contact,
          path: r.path,
          createdAt: r.created_at,
        })),
      },
      { headers: { "Cache-Control": "no-store, max-age=0", "CDN-Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("GET /api/feedback error:", describeError(err), err);
    reportError(err, { route: "GET /api/feedback" });
    return NextResponse.json(
      { error: "Gagal memuat masukan. Coba lagi ya." },
      { status: 500 }
    );
  }
}
