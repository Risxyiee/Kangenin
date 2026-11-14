#!/usr/bin/env python3
"""Migrasi VisitLive — SATU statement per koneksi (pola Hyperdrive).

Cara pakai (dari sandbox / lokal):
  python scripts/migrate_visit_live.py "postgresql://postgres.<ref>:<sandi>@<host>:5432/postgres"
Atau isi env SUPABASE_DB_URL. URL dari .env (DATABASE_URL) dipakai HANYA kalau
benar-benar Postgres (bukan SQLite dev lokal).
"""
import os
import re
import sys

try:
    import psycopg
except ImportError:
    os.system(f"{sys.executable} -m pip install -q psycopg[binary]")
    import psycopg

url = ""
if len(sys.argv) > 1:
    url = sys.argv[1]
elif os.environ.get("SUPABASE_DB_URL"):
    url = os.environ["SUPABASE_DB_URL"]
else:
    with open("/home/z/my-project/.env") as f:
        for line in f:
            if line.startswith("DATABASE_URL="):
                url = line.split("=", 1)[1].strip()
                break

if not url or not url.startswith("postgres"):
    print("URL Postgres Supabase tidak ketemu.")
    print("Pakai: python scripts/migrate_visit_live.py 'postgresql://...'")
    print("(atau jalankan SQL-nya manual di Supabase Dashboard → SQL Editor —")
    print(" file: scripts/sql_visit_live.sql, SATU statement per Run)")
    sys.exit(1)

sql = open("/home/z/my-project/scripts/sql_visit_live.sql").read()
# buang baris komentar, pecah per ";"
sql_bersih = "\n".join(
    l for l in sql.splitlines() if not l.strip().startswith("--") and l.strip()
)
statements = [s.strip() for s in sql_bersih.split(";") if s.strip()]

with psycopg.connect(url, autocommit=True) as conn:
    for i, st in enumerate(statements, 1):
        print(f"--- statement {i} ---")
        conn.execute(st)
        print("OK")
    row = conn.execute(
        """select column_name, data_type from information_schema.columns
           where table_name = 'VisitLive' order by ordinal_position"""
    ).fetchall()
    print("--- struktur VisitLive ---")
    for r in row:
        print(r)
print("MIGRASI SELESAI")
