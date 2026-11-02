"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

// ── Insight Masukan (/insight) — khusus founder ─────────────────────────────
// Gerbang satu kunci (key harus sama dengan INSIGHT_KEY di API). Key disimpan
// di sessionStorage perangkat sendiri — nggak perlu login, tapi orang lain
// nggak bisa baca masukan user.

type Entry = {
  id: string;
  message: string;
  rating: number | null;
  category: string | null;
  contact: string | null;
  path: string | null;
  createdAt: string;
};

type Payload = {
  stats: {
    total: number;
    rated: number;
    avgRating: number | null;
    last7: number;
    byCategory: Record<string, number>;
  };
  entries: Entry[];
};

const RATING_EMOJI: Record<number, string> = {
  1: "😖",
  2: "😕",
  3: "😐",
  4: "😊",
  5: "🥰",
};

const CATEGORY_LABEL: Record<string, string> = {
  bug: "Bug 🐛",
  fitur: "Fitur 💡",
  desain: "Desain 🎨",
  lainnya: "Lainnya ✨",
  "tanpa-kategori": "Tanpa kategori",
};

const STORAGE_KEY = "kangenin-insight-key";

function formatTanggal(iso: string): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function InsightBoard() {
  const [key, setKey] = useState("");
  const [data, setData] = useState<Payload | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "wrongkey" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const load = useCallback(async (k: string) => {
    if (!k.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/feedback?key=${encodeURIComponent(k.trim())}`, {
        cache: "no-store",
      });
      if (res.status === 404) {
        setStatus("wrongkey");
        return;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setErrorMsg(json.error ?? "Gagal memuat masukan.");
        setStatus("error");
        return;
      }
      const json = (await res.json()) as Payload;
      setData(json);
      setStatus("ready");
      try {
        sessionStorage.setItem(STORAGE_KEY, k.trim());
      } catch {
        /* mode privat — biarkan */
      }
    } catch {
      setErrorMsg("Koneksi bermasalah. Coba lagi ya.");
      setStatus("error");
    }
  }, []);

  // key tersimpan di perangkat → langsung buka, nggak nanya dua kali.
  // Auto-buka lewat timer (bukan jalur sinkron effect) — pola yang sama
  // dengan polling di ShareDashboard: setState dalam callback eksternal.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(STORAGE_KEY);
    } catch {
      /* mode privat */
    }
    if (!saved) return;
    const t = setTimeout(() => void load(saved as string), 0);
    return () => clearTimeout(t);
  }, [load]);

  // ── Gerbang kunci ──
  if (status !== "ready") {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-4">
        <div className="w-full rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="text-4xl">🔐</div>
          <h1 className="mt-3 font-display text-xl font-bold text-foreground">
            Ruang Owner
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Masukin key insight buat liat semua masukan user.
          </p>
          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void load(key);
            }}
          >
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Key insight"
              autoFocus
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-center text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              type="submit"
              disabled={status === "loading" || !key.trim()}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#b52743] disabled:opacity-50"
            >
              {status === "loading" ? "Membuka…" : "Buka"}
            </button>
          </form>
          {status === "wrongkey" && (
            <p className="mt-4 text-sm text-destructive">Key-nya salah.</p>
          )}
          {status === "error" && (
            <p className="mt-4 text-sm text-destructive">{errorMsg}</p>
          )}
        </div>
        <Link
          href="/"
          className="mt-6 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← kembali ke beranda
        </Link>
      </main>
    );
  }

  // ── Dashboard ──
  const { stats, entries } = data!;
  const catEntries = Object.entries(stats.byCategory);

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Insight Masukan
        </h1>
        <button
          type="button"
          onClick={() => void load(key)}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent/40"
        >
          ⟳ Muat ulang
        </button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Semua kritik &amp; saran dari halaman /masukan — 100 terbaru.
      </p>

      {/* Statistik ringkas */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <p className="font-display text-3xl font-bold text-foreground">{stats.total}</p>
          <p className="mt-1 text-xs text-muted-foreground">total masukan</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <p className="font-display text-3xl font-bold text-foreground">
            {stats.avgRating !== null ? stats.avgRating.toFixed(1) : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            rata-rata rating{stats.rated > 0 ? ` (${stats.rated} penilai)` : ""}
          </p>
        </div>
        <div className="col-span-2 rounded-2xl border border-border bg-card p-4 text-center sm:col-span-1">
          <p className="font-display text-3xl font-bold text-foreground">{stats.last7}</p>
          <p className="mt-1 text-xs text-muted-foreground">7 hari terakhir</p>
        </div>
      </div>

      {/* Sebaran kategori */}
      {catEntries.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {catEntries.map(([cat, n]) => (
            <span
              key={cat}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground"
            >
              {CATEGORY_LABEL[cat] ?? cat} · {n}
            </span>
          ))}
        </div>
      )}

      {/* Daftar masukan */}
      {entries.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
          Belum ada masukan — bagikan situsnya lebih banyak, lalu mampir lagi di sini.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {entries.map((e) => (
            <article
              key={e.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{formatTanggal(e.createdAt)}</span>
                {e.rating !== null && (
                  <span
                    className="text-base"
                    title={`Rating ${e.rating}/5`}
                    aria-label={`Rating ${e.rating} dari 5`}
                  >
                    {RATING_EMOJI[e.rating] ?? "⭐"}
                  </span>
                )}
                {e.category && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary">
                    {CATEGORY_LABEL[e.category] ?? e.category}
                  </span>
                )}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {e.message}
              </p>
              {(e.contact || e.path) && (
                <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {e.contact && <span>kontak: {e.contact}</span>}
                  {e.path && <span>dari: {e.path}</span>}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      <p className="mt-10 text-center text-sm text-muted-foreground">
        <Link href="/" className="transition-colors hover:text-foreground">
          ← kembali ke beranda
        </Link>
      </p>
    </main>
  );
}
