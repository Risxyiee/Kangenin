-- Papan Pengakuan: isi confess opt-in tampil di halaman depan.
-- showMessage = izin tayang isi surat; showAs = identitas pengirim di papan.
-- Idempotent (IF NOT EXISTS) supaya aman dijalankan ulang.
ALTER TABLE "Confession" ADD COLUMN IF NOT EXISTS "showMessage" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Confession" ADD COLUMN IF NOT EXISTS "showAs" TEXT NOT NULL DEFAULT 'anonim';
