import { NextRequest, NextResponse } from "next/server";
import { withDbRetry, dbNonce, getPgPool } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { isAdmin } from "@/lib/admin-key";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

export const runtime = "nodejs";

// ── Admin modul 2: KELOLA MASUKAN ────────────────────────────────────────────
// GET    /api/admin/masukan         — daftar masukan + statistik status
// PATCH  /api/admin/masukan         — ubah status { id, status: baru|dibaca|selesai }
// DELETE /api/admin/masukan?id=…    — hapus permanen (spam / tidak relevan)
//
// Tabel `feedback` dibuat otomatis oleh POST /api/feedback (42P01 → CREATE).
// Kolom `status` adalah tambahan khusus admin: ditambah lewat ALTER TABLE
// ADD COLUMN IF NOT EXISTS — idempoten, nol migrasi manual, dan TIDAK
// mengganggu endpoint /api/feedback yang lama (kolom ekstra diabaikan).

const STATUS_VALUES = ["baru", "dibaca", "selesai"] as const;
type FeedbackStatus = (typeof STATUS_VALUES)[number];

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

const ALTER_STATUS_SQL = `
  alter table feedback add column if not exists status text not null default 'baru'
`;

const CREATE_INDEX_SQL = `
  create index if not exists feedback_created_at_idx on feedback (created_at desc)
`;

// Auto-provision sekali per isolate (pola yang sama dengan /api/feedback).
let ensurePromise: Promise<void> | null = null;

function ensureFeedbackAdmin(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const pool = getPgPool();
      await pool.query(CREATE_TABLE_SQL);
      await pool.query(ALTER_STATUS_SQL);
      await pool.query(CREATE_INDEX_SQL);
    })().catch((err) => {
      ensurePromise = null;
      throw err;
    });
  }
  return ensurePromise;
}

function isMissingTable(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  // 42P01 = tabel belum ada; 42703 = tabel ada tapi kolom `status` belum
  // (dibuat route publik lama sebelum kolom admin ini dirilis).
  if (code === "42P01" || code === "42703") return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /42P01|42703|relation "feedback" does not exist|column .* does not exist/i.test(msg);
}

type EntryRow = {
  id: string;
  message: string;
  rating: number | null;
  category: string | null;
  contact: string | null;
  path: string | null;
  status: string;
  created_at: string;
};

export async function GET(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json({ error: "nggak ada apa-apa di sini" }, { status: 404 });
    }

    const rl = await rateLimit(req, "admin-masukan", 60, 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan. Coba lagi nanti ya." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const nonce = dbNonce();
    const listQ = () =>
      getPgPool().query<EntryRow>(
        `/* ${nonce} */
         select id, message, rating, category, contact, path, status, created_at
         from feedback
         order by created_at desc
         limit 150`
      );

    // SELALU pastikan tabel + kolom status ada dulu (idempoten, sekali per
    // isolate) — tabel lama dari route publik tidak punya kolom `status`, dan
    // tanpa ini SELECT-nya 42703 → 500 (insiden produksi 2026-11-02).
    await ensureFeedbackAdmin();

    let rows: EntryRow[];
    try {
      const res = await withDbRetry(listQ);
      rows = res.rows;
    } catch (err) {
      if (!isMissingTable(err)) throw err;
      // skema berubah di bawah kaki isolate ini → pastikan ulang, coba sekali
      ensurePromise = null;
      await ensureFeedbackAdmin();
      const res = await withDbRetry(listQ);
      rows = res.rows;
    }

    const stats = { total: rows.length, baru: 0, dibaca: 0, selesai: 0 };
    for (const r of rows) {
      if (r.status === "baru") stats.baru += 1;
      else if (r.status === "dibaca") stats.dibaca += 1;
      else if (r.status === "selesai") stats.selesai += 1;
    }

    return NextResponse.json(
      {
        stats,
        entries: rows.map((r) => ({
          id: r.id,
          message: r.message,
          rating: r.rating === null ? null : Number(r.rating),
          category: r.category,
          contact: r.contact,
          path: r.path,
          status: r.status,
          createdAt: r.created_at,
        })),
      },
      { headers: { "Cache-Control": "no-store, max-age=0", "CDN-Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("GET /api/admin/masukan error:", describeError(err), err);
    reportError(err, { route: "GET /api/admin/masukan" });
    return NextResponse.json({ error: "Gagal memuat masukan. Coba lagi ya." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json({ error: "nggak ada apa-apa di sini" }, { status: 404 });
    }

    const rl = await rateLimit(req, "admin-masukan-write", 60, 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan. Coba lagi nanti ya." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const body = (await req.json().catch(() => null)) as {
      id?: string;
      status?: string;
    } | null;
    const id = body?.id?.trim();
    const status = body?.status as FeedbackStatus;
    if (!id || !STATUS_VALUES.includes(status)) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    await ensureFeedbackAdmin();

    const nonce = dbNonce();
    const upd = await withDbRetry(() =>
      getPgPool().query(
        `/* ${nonce} */
         update feedback set status = $1 where id = $2::uuid`,
        [status, id]
      )
    );
    if ((upd.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "Masukannya tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    console.error("PATCH /api/admin/masukan error:", describeError(err), err);
    reportError(err, { route: "PATCH /api/admin/masukan" });
    return NextResponse.json({ error: "Gagal mengubah status. Coba lagi ya." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json({ error: "nggak ada apa-apa di sini" }, { status: 404 });
    }

    const rl = await rateLimit(req, "admin-masukan-write", 60, 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan. Coba lagi nanti ya." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
    if (!id) {
      return NextResponse.json({ error: "id masukan wajib diisi" }, { status: 400 });
    }

    await ensureFeedbackAdmin();

    const nonce = dbNonce();
    const del = await withDbRetry(() =>
      getPgPool().query(
        `/* ${nonce} */
         delete from feedback where id = $1::uuid`,
        [id]
      )
    );
    if ((del.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "Masukannya tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    console.error("DELETE /api/admin/masukan error:", describeError(err), err);
    reportError(err, { route: "DELETE /api/admin/masukan" });
    return NextResponse.json({ error: "Gagal menghapus masukan. Coba lagi ya." }, { status: 500 });
  }
}
