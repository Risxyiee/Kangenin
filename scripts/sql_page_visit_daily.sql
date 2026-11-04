-- ─────────────────────────────────────────────────────────────────────────────
-- S-08: Tabel agregat kunjungan halaman Kangenin.
-- Jalankan SEKALI di Supabase Dashboard → SQL Editor → Run.
-- Diisi otomatis oleh src/middleware.ts (upsert per path per tanggal WIB).
-- Dibaca oleh GET /api/admin/kunjungan (modul "Kunjungan" di /admin).
-- Ikut terbackup otomatis oleh workflow backup mingguan (pg_dump seluruh DB).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists "PageVisitDaily" (
  "path"  text    not null,
  "day"   date    not null,
  "count" integer not null default 0,
  constraint "PageVisitDaily_pk" primary key ("path", "day")
);

create index if not exists "PageVisitDaily_day_idx" on "PageVisitDaily" ("day");
