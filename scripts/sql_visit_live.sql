-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime: tabel sesi pengunjung hidup (online now).
-- Jalankan di Supabase — SATU statement per panggilan (Hyperdrive/psql lokal).
-- Diisi oleh POST /api/track/visit (beacon klien), dibaca oleh
-- GET /api/admin/visits/live + perintah WA bot "pengunjung".
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists "VisitLive" (
  "sid"       text        not null primary key,
  "path"      text        not null default '/',
  "views"     integer     not null default 1,
  "firstSeen" timestamptz not null default now(),
  "lastSeen"  timestamptz not null default now()
);
