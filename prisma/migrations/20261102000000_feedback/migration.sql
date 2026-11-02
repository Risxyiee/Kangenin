-- Fitur Kritik & Saran — tabel feedback (insight pengguna untuk founder).
--
-- NORMALNYA TIDAK PERLU DIJALANKAN MANUAL: endpoint POST /api/feedback
-- membuat tabel ini OTOMATIS saat masukan pertama (CREATE TABLE IF NOT
-- EXISTS — lihat src/app/api/feedback/route.ts). File ini cadangan/manual:
-- kalau role DB tidak punya hak CREATE, tempel di
-- Supabase SQL Editor (Dashboard → SQL → New query → Run).
--
-- Catatan: tabel ini TIDAK dimodelkan di schema.prisma (mengikuti pola
-- tabel rate_limit — diakses via raw SQL di src/app/api/feedback/route.ts).

create table if not exists feedback (
  id          uuid primary key,                   -- dibuat di aplikasi (crypto.randomUUID)
  message     text not null,                      -- isi kritik/saran (max 1000 karakter, divalidasi zod)
  rating      integer check (rating between 1 and 5), -- 1..5, boleh null (tidak mengisi)
  category    text,                               -- bug | fitur | desain | lainnya (boleh null)
  contact     text,                               -- opsional: IG / WA / email untuk follow-up
  path        text,                               -- halaman asal, mis. /masukan?dari=beranda
  user_agent  text,                               -- perangkat/browser (potongan 300 karakter)
  created_at  timestamptz not null default now()
);

create index if not exists feedback_created_at_idx on feedback (created_at desc);

comment on table feedback is
  'Kritik & saran user untuk founder. Ditulis dari /masukan, dibaca dari /insight (dilindungi INSIGHT_KEY). Tabel dibuat otomatis oleh POST /api/feedback saat masukan pertama.';
