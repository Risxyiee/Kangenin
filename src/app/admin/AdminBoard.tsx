"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// ── Panel Admin (/admin) — khusus founder ────────────────────────────────────
// Lima modul (gerbang satu kunci ADMIN_KEY, pola sama dengan /insight):
//   1. Ringkasan — statistik seluruh platform + tren 7 hari
//   2. Masukan   — kelola feedback: tandai dibaca/selesai, hapus spam
//   3. Dinding   — moderasi Dinding Kangenin: sembunyikan / tampilkan / hapus
//   4. Keamanan  — denyut DB, rate limit aktif, log error + perawatan
//   5. Kunjungan — halaman yang paling sering dikunjungi user (S-08)
//
// Data per tab dimuat malas (saat pertama dibuka) — buka halaman tetap ringan.
// Aksi tulis pakai optimistic update + rollback kalau API gagal (Hyperdrive
// sesekali 500 sesaat — jangan bikin owner menunggu atau kehilangan state).

type Tab = "ringkasan" | "masukan" | "dinding" | "keamanan" | "kunjungan";

const STORAGE_KEY = "kangenin-admin-key";

// ── Tipe payload API ──
type Overview = {
  confess: { total: number; opened: number; responded: number; publicCount: number; reported: number; last7: number };
  kado: { total: number; last7: number; byStatus: Record<string, number>; byType: Record<string, number> };
  gift: { total: number; views: number; last7: number; byType: Record<string, number> };
  letter: { sets: number; letters: number; views: number };
  reactions: { heart: number; laugh: number; cry: number; bloom: number };
  feedback: { total: number; last7: number };
  viewsTotal: number;
  trend: { day: string; conf: number; kado: number; gift: number; letter: number }[] | null;
};

type MasukanEntry = {
  id: string;
  message: string;
  rating: number | null;
  category: string | null;
  contact: string | null;
  path: string | null;
  status: string;
  createdAt: string;
};

type MasukanData = {
  stats: { total: number; baru: number; dibaca: number; selesai: number };
  entries: MasukanEntry[];
};

type DindingItem = {
  id: string;
  from: string;
  to: string;
  theme: string;
  message: string;
  isPublic: boolean;
  showMessage?: boolean;
  showAs?: string;
  reportCount: number;
  views: number;
  answered: boolean;
  createdAt: string;
  reactions: { heart: number; laugh: number; cry: number; bloom: number };
};

type KeamananData = {
  db: { ok: boolean; latencyMs: number | null };
  rateLimit: {
    available: boolean;
    total24h: number;
    top: { key: string; count: number; windowStart: string }[];
  };
  errors: {
    available: boolean;
    h24: number;
    d7: number;
    total: number;
    items: { id: string; route: string; message: string; createdAt: string }[];
  };
};

type KunjunganData = {
  tersedia: boolean;
  hariIni: number;
  mingguIni: number;
  total: number;
  top: { path: string; hariIni: number; mingguIni: number; total: number }[];
};

// Label ramah untuk path yang dikenal; sisanya tampil apa adanya.
function labelPath(path: string): string {
  const statis: Record<string, string> = {
    "/": "🏠 Beranda",
    "/dinding": "💌 Dinding Kangenin",
    "/masukan": "💬 Masukan",
    "/bantuan": "❓ Bantuan",
    "/create": "🎁 Buat Kado",
  };
  if (statis[path]) return statis[path];
  if (path.startsWith("/kado/")) return "🎁 Halaman kado (penerima)";
  if (path.startsWith("/confess/")) return "💌 Halaman confess";
  return path;
}

// ── Label ramah ──
const KADO_TYPE_LABEL: Record<string, string> = {
  fingerprint: "Sidik jari 👆",
  quiz: "Kuis ❓",
  tap: "Ketuk 💥",
  scratch: "Gosok ✨",
};

const GIFT_TYPE_LABEL: Record<string, string> = {
  bouquet: "Buket 💐",
  photobox: "Photobox 📸",
  cake: "Kue 🎂",
  coupons: "Kupon 🎟️",
};

const KADO_STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu",
  opened: "Dibuka",
  accepted: "Diterima",
  rejected: "Ditolak",
};

const MASUKAN_STATUS_LABEL: Record<string, string> = {
  baru: "Baru",
  dibaca: "Dibaca",
  selesai: "Selesai",
};

const RATING_EMOJI: Record<number, string> = {
  1: "😖", 2: "😕", 3: "😐", 4: "😊", 5: "🥰",
};

const DAY_LABEL = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

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

function nf(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Kartu statistik kecil ──
function StatCard({
  value,
  label,
  sub,
}: {
  value: string | number;
  label: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-center shadow-sm">
      <p className="font-display text-2xl font-bold text-foreground sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-muted-foreground/70">{sub}</p> : null}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground">
      {children}
    </span>
  );
}

export default function AdminBoard() {
  const [key, setKey] = useState("");
  const [auth, setAuth] = useState<"idle" | "loading" | "ready" | "wrongkey" | "error">("idle");
  const [authMsg, setAuthMsg] = useState("");

  const [tab, setTab] = useState<Tab>("ringkasan");

  // data per modul
  const [overview, setOverview] = useState<Overview | null>(null);
  const [ovLoading, setOvLoading] = useState(false);
  const [ovError, setOvError] = useState("");

  const [masukan, setMasukan] = useState<MasukanData | null>(null);
  const [msLoading, setMsLoading] = useState(false);
  const [msError, setMsError] = useState("");
  const [msFilter, setMsFilter] = useState<"semua" | "baru" | "dibaca" | "selesai">("semua");
  const [msBusy, setMsBusy] = useState<string | null>(null);

  const [dinding, setDinding] = useState<DindingItem[] | null>(null);
  const [ddLoading, setDdLoading] = useState(false);
  const [ddError, setDdError] = useState("");
  const [ddRevealed, setDdRevealed] = useState<Record<string, boolean>>({});
  const [ddBusy, setDdBusy] = useState<string | null>(null);

  const [keamanan, setKeamanan] = useState<KeamananData | null>(null);
  const [kmLoading, setKmLoading] = useState(false);
  const [kmError, setKmError] = useState("");
  const [kmBusy, setKmBusy] = useState(false);
  const [kmNote, setKmNote] = useState("");

  const [kunjungan, setKunjungan] = useState<KunjunganData | null>(null);
  const [kjLoading, setKjLoading] = useState(false);
  const [kjError, setKjError] = useState("");

  // ── helper fetch dengan header kunci ──
  async function api(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
    const res = await fetch(path, {
      ...init,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": key.trim(),
        ...(init?.headers ?? {}),
      },
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new Error(String(json.error ?? `Error ${res.status}`));
    return json;
  }

  // ── pemuat data per modul ──
  async function loadOverview() {
    setOvLoading(true);
    setOvError("");
    try {
      const json = await api("/api/admin/overview");
      setOverview(json as unknown as Overview);
    } catch (e) {
      setOvError(e instanceof Error ? e.message : "Gagal memuat ringkasan.");
    } finally {
      setOvLoading(false);
    }
  }

  async function loadMasukan() {
    setMsLoading(true);
    setMsError("");
    try {
      const json = await api("/api/admin/masukan");
      setMasukan(json as unknown as MasukanData);
    } catch (e) {
      setMsError(e instanceof Error ? e.message : "Gagal memuat masukan.");
    } finally {
      setMsLoading(false);
    }
  }

  async function loadDinding() {
    setDdLoading(true);
    setDdError("");
    try {
      const json = await api("/api/admin/dinding");
      setDinding((json.items as DindingItem[]) ?? []);
    } catch (e) {
      setDdError(e instanceof Error ? e.message : "Gagal memuat dinding.");
    } finally {
      setDdLoading(false);
    }
  }

  async function loadKeamanan() {
    setKmLoading(true);
    setKmError("");
    try {
      const json = await api("/api/admin/keamanan");
      setKeamanan(json as unknown as KeamananData);
    } catch (e) {
      setKmError(e instanceof Error ? e.message : "Gagal memuat panel keamanan.");
    } finally {
      setKmLoading(false);
    }
  }

  async function loadKunjungan() {
    setKjLoading(true);
    setKjError("");
    try {
      const json = await api("/api/admin/kunjungan");
      setKunjungan(json as unknown as KunjunganData);
    } catch (e) {
      setKjError(e instanceof Error ? e.message : "Gagal memuat kunjungan.");
    } finally {
      setKjLoading(false);
    }
  }

  function loadTab(t: Tab) {
    if (t === "ringkasan" && !overview && !ovLoading) void loadOverview();
    if (t === "masukan" && !masukan && !msLoading) void loadMasukan();
    if (t === "dinding" && !dinding && !ddLoading) void loadDinding();
    if (t === "keamanan" && !keamanan && !kmLoading) void loadKeamanan();
    if (t === "kunjungan" && !kunjungan && !kjLoading) void loadKunjungan();
  }

  function switchTab(t: Tab) {
    setTab(t);
    loadTab(t);
  }

  // ── gerbang kunci: buka dengan key tersimpan (pola timer InsightBoard) ──
  async function unlock(k: string) {
    if (!k.trim()) return;
    setAuth("loading");
    setAuthMsg("");
    try {
      const res = await fetch("/api/admin/overview", {
        cache: "no-store",
        headers: { "x-admin-key": k.trim() },
      });
      if (res.status === 404) {
        setAuth("wrongkey");
        return;
      }
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setAuthMsg(json.error ?? "Gagal membuka panel.");
        setAuth("error");
        return;
      }
      setOverview((await res.json()) as Overview);
      setAuth("ready");
      try {
        sessionStorage.setItem(STORAGE_KEY, k.trim());
      } catch {
        /* mode privat — biarkan */
      }
    } catch {
      setAuthMsg("Koneksi bermasalah. Coba lagi ya.");
      setAuth("error");
    }
  }

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(STORAGE_KEY);
    } catch {
      /* mode privat */
    }
    if (!saved) return;
    const t = setTimeout(() => {
      setKey(saved as string);
      void unlock(saved as string);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // ── aksi: masukan ──
  async function setStatusMasukan(id: string, status: string) {
    const prev = masukan;
    setMsBusy(id);
    setMasukan((m) =>
      m
        ? {
            ...m,
            entries: m.entries.map((e) => (e.id === id ? { ...e, status } : e)),
          }
        : m
    );
    try {
      await api("/api/admin/masukan", {
        method: "PATCH",
        body: JSON.stringify({ id, status }),
      });
    } catch (e) {
      setMasukan(prev); // rollback
      setMsError(e instanceof Error ? e.message : "Gagal mengubah status.");
    } finally {
      setMsBusy(null);
    }
  }

  async function hapusMasukan(id: string) {
    if (!window.confirm("Hapus masukan ini permanen?")) return;
    const prev = masukan;
    setMsBusy(id);
    setMasukan((m) =>
      m
        ? {
            ...m,
            entries: m.entries.filter((e) => e.id !== id),
            stats: { ...m.stats, total: Math.max(0, m.stats.total - 1) },
          }
        : m
    );
    try {
      await api(`/api/admin/masukan?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch (e) {
      setMasukan(prev); // rollback
      setMsError(e instanceof Error ? e.message : "Gagal menghapus masukan.");
    } finally {
      setMsBusy(null);
    }
  }

  // ── aksi: dinding ──
  async function moderasiDinding(item: DindingItem, action: "hide" | "unhide" | "delete") {
    if (action === "delete" && !window.confirm(`Hapus PERMANEN surat untuk ${item.to}? Reaksi ikut terhapus.`)) return;
    const prev = dinding;
    setDdBusy(item.id);
    if (action === "delete") {
      setDinding((d) => (d ? d.filter((x) => x.id !== item.id) : d));
    } else {
      setDinding((d) =>
        d
          ? d.map((x) =>
              x.id === item.id
                ? {
                    ...x,
                    isPublic: action === "unhide",
                    reportCount: action === "unhide" ? 0 : x.reportCount,
                  }
                : x
            )
          : d
      );
    }
    try {
      await api("/api/admin/dinding", {
        method: "PATCH",
        body: JSON.stringify({ id: item.id, action }),
      });
    } catch (e) {
      setDinding(prev); // rollback
      setDdError(e instanceof Error ? e.message : "Gagal memoderasi surat.");
    } finally {
      setDdBusy(null);
    }
  }

  // ── aksi: keamanan ──
  async function perawatan(action: "sapu-rate-limit" | "bersihkan-error" | "sapu-qa") {
    if (action === "bersihkan-error" && !window.confirm("Kosongkan seluruh log error?")) return;
    if (action === "sapu-qa" && !window.confirm("Hapus SEMUA confess & kado uji ber-tanda QA Bot/AuditBot?")) return;
    setKmBusy(true);
    setKmNote("");
    try {
      const json = await api("/api/admin/keamanan", {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      const n = Number(json.deleted ?? 0);
      setKmNote(
        action === "sapu-rate-limit"
          ? `${n} entri rate limit basi terhapus.`
          : action === "sapu-qa"
            ? `${n} baris data uji (confess + kado QA Bot/AuditBot) terhapus.`
            : `${n} log error terhapus.`
      );
      await loadKeamanan();
    } catch (e) {
      setKmError(e instanceof Error ? e.message : "Gagal menjalankan perawatan.");
    } finally {
      setKmBusy(false);
    }
  }

  // ── Gerbang kunci ──
  if (auth !== "ready") {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-4">
        <div className="w-full rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="text-4xl">🛡️</div>
          <h1 className="mt-3 font-display text-xl font-bold text-foreground">Panel Admin</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Masukin key admin buat kelola Kangenin: statistik, masukan, dinding, keamanan.
          </p>
          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void unlock(key);
            }}
          >
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Key admin"
              autoFocus
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-center text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              type="submit"
              disabled={auth === "loading" || !key.trim()}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#b52743] disabled:opacity-50"
            >
              {auth === "loading" ? "Membuka…" : "Buka Panel"}
            </button>
          </form>
          {auth === "wrongkey" && <p className="mt-4 text-sm text-destructive">Key-nya salah.</p>}
          {auth === "error" && <p className="mt-4 text-sm text-destructive">{authMsg}</p>}
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

  // ── Panel utama ──
  const tabs: { id: Tab; label: string }[] = [
    { id: "ringkasan", label: "Ringkasan" },
    { id: "masukan", label: "Masukan" },
    { id: "dinding", label: "Dinding" },
    { id: "keamanan", label: "Keamanan" },
    { id: "kunjungan", label: "Kunjungan" },
  ];

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Panel Admin
        </h1>
        <button
          type="button"
          onClick={() => {
            setOverview(null);
            setMasukan(null);
            setDinding(null);
            setKeamanan(null);
            setKunjungan(null);
            loadTab(tab);
          }}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent/40"
        >
          ⟳ Muat ulang
        </button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Statistik, masukan, moderasi dinding, dan kesehatan Kangenin — semua dalam satu tempat.
      </p>

      {/* Tab bar */}
      <div className="mt-5 grid grid-cols-5 gap-1 rounded-2xl border border-border bg-card p-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => switchTab(t.id)}
            className={`rounded-xl px-2 py-2.5 text-xs font-semibold transition-colors sm:text-sm ${
              tab === t.id
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ MODUL 1: RINGKASAN ═══ */}
      {tab === "ringkasan" && (
        <section className="mt-6">
          {ovLoading && <p className="text-sm text-muted-foreground">Memuat ringkasan…</p>}
          {ovError && <p className="text-sm text-destructive">{ovError}</p>}
          {overview && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard value={nf(overview.confess.total)} label="confess dibuat" sub={`${nf(overview.confess.last7)} dalam 7 hari`} />
                <StatCard value={nf(overview.confess.opened)} label="sudah dibuka" sub={`${nf(overview.confess.responded)} dijawab`} />
                <StatCard value={nf(overview.kado.total)} label="kado dibuat" sub={`${nf(overview.kado.last7)} dalam 7 hari`} />
                <StatCard value={nf(overview.gift.total)} label="kado klasik" sub={`${nf(overview.gift.last7)} dalam 7 hari`} />
                <StatCard value={nf(overview.letter.sets)} label="surat beruntun" sub={`${nf(overview.letter.letters)} surat`} />
                <StatCard value={nf(overview.viewsTotal)} label="total views" sub="confess + kado + surat" />
                <StatCard value={nf(overview.feedback.total)} label="masukan user" sub={`${nf(overview.feedback.last7)} dalam 7 hari`} />
                <StatCard value={nf(overview.confess.publicCount)} label="tampil di dinding" sub={overview.confess.reported > 0 ? `${overview.confess.reported} dilaporkan` : "tidak ada laporan"} />
              </div>

              {/* Tren 7 hari */}
              <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h2 className="font-display text-lg font-bold text-foreground">Tren 7 hari</h2>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" /> Confess</span>
                  <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" /> Kado</span>
                  <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-violet-400" /> Kado klasik</span>
                  <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-400" /> Surat beruntun</span>
                </div>
                {overview.trend ? (
                  <div className="mt-4 flex h-36 items-end gap-2">
                    {overview.trend.map((d) => {
                      const max = Math.max(
                        1,
                        ...overview.trend!.map((x) => x.conf + x.kado + x.gift + x.letter)
                      );
                      const total = d.conf + d.kado + d.gift + d.letter;
                      const h = (v: number) => `${(v / max) * 100}%`;
                      const dt = new Date(d.day + "T00:00:00");
                      return (
                        <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
                          <div className="flex w-full flex-1 flex-col justify-end overflow-hidden rounded-lg bg-muted/60">
                            {total === 0 ? (
                              <div className="h-0.5" />
                            ) : (
                              <>
                                {d.letter > 0 && <div className="w-full bg-sky-400" style={{ height: h(d.letter) }} />}
                                {d.gift > 0 && <div className="w-full bg-violet-400" style={{ height: h(d.gift) }} />}
                                {d.kado > 0 && <div className="w-full bg-amber-400" style={{ height: h(d.kado) }} />}
                                {d.conf > 0 && <div className="w-full bg-primary" style={{ height: h(d.conf) }} />}
                              </>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {DAY_LABEL[dt.getDay()]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">Tren tidak tersedia saat ini.</p>
                )}
              </div>

              {/* Rincian kado */}
              <div className="mt-4 flex flex-wrap gap-2">
                {Object.entries(overview.kado.byType).map(([t, n]) => (
                  <Chip key={t}>{KADO_TYPE_LABEL[t] ?? cap(t)} · {n}</Chip>
                ))}
                {Object.entries(overview.kado.byStatus).map(([s, n]) => (
                  <Chip key={s}>{KADO_STATUS_LABEL[s] ?? cap(s)} · {n}</Chip>
                ))}
                {Object.entries(overview.gift.byType).map(([t, n]) => (
                  <Chip key={t}>{GIFT_TYPE_LABEL[t] ?? cap(t)} · {n}</Chip>
                ))}
                <Chip>💔 {nf(overview.reactions.heart)} · 😂 {nf(overview.reactions.laugh)} · 😢 {nf(overview.reactions.cry)} · 🌸 {nf(overview.reactions.bloom)}</Chip>
              </div>
            </>
          )}
        </section>
      )}

      {/* ═══ MODUL 2: MASUKAN ═══ */}
      {tab === "masukan" && (
        <section className="mt-6">
          {msLoading && <p className="text-sm text-muted-foreground">Memuat masukan…</p>}
          {msError && <p className="text-sm text-destructive">{msError}</p>}
          {masukan && (
            <>
              <div className="grid grid-cols-4 gap-2">
                <StatCard value={nf(masukan.stats.total)} label="teratas" />
                <StatCard value={nf(masukan.stats.baru)} label="baru" />
                <StatCard value={nf(masukan.stats.dibaca)} label="dibaca" />
                <StatCard value={nf(masukan.stats.selesai)} label="selesai" />
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {(["semua", "baru", "dibaca", "selesai"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setMsFilter(f)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                      msFilter === f
                        ? "bg-primary text-white"
                        : "border border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f === "semua" ? "Semua" : MASUKAN_STATUS_LABEL[f]}
                  </button>
                ))}
              </div>

              {masukan.entries.filter((e) => msFilter === "semua" || e.status === msFilter).length === 0 ? (
                <p className="mt-6 rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
                  Tidak ada masukan pada filter ini.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {masukan.entries
                    .filter((e) => msFilter === "semua" || e.status === msFilter)
                    .map((e) => (
                      <article key={e.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatTanggal(e.createdAt)}</span>
                          {e.rating !== null && (
                            <span className="text-base" title={`Rating ${e.rating}/5`}>
                              {RATING_EMOJI[e.rating] ?? "⭐"}
                            </span>
                          )}
                          {e.category && (
                            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary">
                              {cap(e.category)}
                            </span>
                          )}
                          <span
                            className={`rounded-full px-2.5 py-0.5 font-medium ${
                              e.status === "baru"
                                ? "bg-amber-100 text-amber-800"
                                : e.status === "selesai"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {MASUKAN_STATUS_LABEL[e.status] ?? e.status}
                          </span>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                          {e.message}
                        </p>
                        {(e.contact || e.path) && (
                          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {e.contact && <span>kontak: {e.contact}</span>}
                            {e.path && <span>dari: {e.path}</span>}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {e.status !== "selesai" && (
                            <button
                              type="button"
                              disabled={msBusy === e.id}
                              onClick={() => void setStatusMasukan(e.id, "selesai")}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                            >
                              ✓ Selesai
                            </button>
                          )}
                          {e.status !== "dibaca" && (
                            <button
                              type="button"
                              disabled={msBusy === e.id}
                              onClick={() => void setStatusMasukan(e.id, "dibaca")}
                              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent/40 disabled:opacity-50"
                            >
                              👁 Tandai dibaca
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={msBusy === e.id}
                            onClick={() => void hapusMasukan(e.id)}
                            className="rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                          >
                            🗑 Hapus
                          </button>
                        </div>
                      </article>
                    ))}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ═══ MODUL 3: DINDING ═══ */}
      {tab === "dinding" && (
        <section className="mt-6">
          {ddLoading && <p className="text-sm text-muted-foreground">Memuat dinding…</p>}
          {ddError && <p className="text-sm text-destructive">{ddError}</p>}
          {dinding && dinding.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
              Belum ada surat di dinding — dan tidak ada yang dilaporkan.
            </p>
          )}
          <div className="space-y-3">
            {dinding?.map((d) => {
              const totalReaksi = d.reactions.heart + d.reactions.laugh + d.reactions.cry + d.reactions.bloom;
              return (
                <article key={d.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatTanggal(d.createdAt)}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-medium ${
                        d.isPublic ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {d.isPublic ? "Tampil di dinding" : "Disembunyikan"}
                    </span>
                    {d.showMessage && (
                      <span className="rounded-full bg-fuchsia-100 px-2.5 py-0.5 font-medium text-fuchsia-800">
                        Papan: {d.showAs === "nama" ? "nama depan" : "anonim"}
                      </span>
                    )}
                    {d.reportCount > 0 && (
                      <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 font-semibold text-destructive">
                        ⚠ dilaporkan {d.reportCount}×
                      </span>
                    )}
                    {d.answered && (
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary">sudah dijawab</span>
                    )}
                  </div>
                  <p className="mt-2.5 text-sm font-semibold text-foreground">
                    {d.from} <span className="text-muted-foreground">→</span> {d.to}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      tema {cap(d.theme)} · 👁 {nf(d.views)} · reaksi {nf(totalReaksi)} (💔{d.reactions.heart} 😂{d.reactions.laugh} 😢{d.reactions.cry} 🌸{d.reactions.bloom})
                    </span>
                  </p>
                  {ddRevealed[d.id] ? (
                    <p className="mt-3 whitespace-pre-wrap rounded-xl bg-muted/50 p-3 text-sm leading-relaxed text-foreground">
                      {d.message}
                      <button
                        type="button"
                        onClick={() => setDdRevealed((r) => ({ ...r, [d.id]: false }))}
                        className="mt-2 block text-xs font-semibold text-primary"
                      >
                        sembunyikan isi
                      </button>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDdRevealed((r) => ({ ...r, [d.id]: true }))}
                      className="mt-2 text-xs font-semibold text-primary"
                    >
                      👁 lihat isi surat (privasi: tersembunyi sampai dibuka)
                    </button>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {d.isPublic ? (
                      <button
                        type="button"
                        disabled={ddBusy === d.id}
                        onClick={() => void moderasiDinding(d, "hide")}
                        className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent/40 disabled:opacity-50"
                      >
                        🙈 Sembunyikan dari dinding
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={ddBusy === d.id}
                        onClick={() => void moderasiDinding(d, "unhide")}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                      >
                        ✅ Tampilkan lagi (reset laporan)
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={ddBusy === d.id}
                      onClick={() => void moderasiDinding(d, "delete")}
                      className="rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                    >
                      🗑 Hapus permanen
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══ MODUL 4: KEAMANAN ═══ */}
      {tab === "keamanan" && (
        <section className="mt-6 space-y-4">
          {kmLoading && <p className="text-sm text-muted-foreground">Memuat panel keamanan…</p>}
          {kmError && <p className="text-sm text-destructive">{kmError}</p>}
          {kmNote && <p className="text-sm text-emerald-700">{kmNote}</p>}
          {keamanan && (
            <>
              {/* Denyut database */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h2 className="font-display text-lg font-bold text-foreground">Denyut database</h2>
                <div className="mt-3 flex items-center gap-3">
                  <span
                    className={`inline-block h-3 w-3 rounded-full ${keamanan.db.ok ? "bg-emerald-500" : "bg-destructive"}`}
                  />
                  <p className="text-sm text-foreground">
                    {keamanan.db.ok
                      ? `Terhubung — ping ${keamanan.db.latencyMs ?? "?"} ms`
                      : "Database tidak terjangkau saat ini (Hyperdrive/origin)"}
                  </p>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Ping sesekali 500 saat dingin itu normal (Hyperdrive dial origin). Kalau ping
                  di atas 3.000 ms berulang, cek dashboard Cloudflare → Workers → Logs.
                </p>
              </div>

              {/* Rate limit */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-lg font-bold text-foreground">
                    Rate limit 24 jam terakhir
                  </h2>
                  <button
                    type="button"
                    disabled={kmBusy}
                    onClick={() => void perawatan("sapu-rate-limit")}
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent/40 disabled:opacity-50"
                  >
                    🧹 Sapu entri basi
                  </button>
                </div>
                {!keamanan.rateLimit.available ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Tabel rate limit belum terbentuk (belum ada traffic yang di-limit).
                  </p>
                ) : keamanan.rateLimit.top.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Tenang — tidak ada aktivitas limit dalam 24 jam.
                  </p>
                ) : (
                  <>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {nf(keamanan.rateLimit.total24h)} aksi terlimit-record; 25 teratas:
                    </p>
                    <div className="mt-3 space-y-1.5">
                      {keamanan.rateLimit.top.map((r) => (
                        <div
                          key={r.key}
                          className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 text-xs"
                        >
                          <span className="truncate font-mono text-foreground">{r.key}</span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 font-bold ${
                              r.count > 20 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {nf(r.count)}×
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Log error */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-lg font-bold text-foreground">Log error</h2>
                  <button
                    type="button"
                    disabled={kmBusy}
                    onClick={() => void perawatan("bersihkan-error")}
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent/40 disabled:opacity-50"
                  >
                    🧹 Bersihkan log
                  </button>
                </div>
                {!keamanan.errors.available ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Tabel error log belum terbentuk — belum ada error yang tercatat. Bagus!
                  </p>
                ) : (
                  <>
                    <div className="mt-3 flex gap-2">
                      <Chip>24 jam: {nf(keamanan.errors.h24)}</Chip>
                      <Chip>7 hari: {nf(keamanan.errors.d7)}</Chip>
                      <Chip>total: {nf(keamanan.errors.total)}</Chip>
                    </div>
                    {keamanan.errors.items.length === 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">Log kosong. Bagus!</p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {keamanan.errors.items.map((e) => (
                          <div key={e.id} className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-mono font-semibold text-foreground">{e.route}</span>
                              <span className="text-muted-foreground">{formatTanggal(e.createdAt)}</span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-muted-foreground">{e.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              {/* Sapu data uji */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-lg font-bold text-foreground">Data uji QA Bot</h2>
                  <button
                    type="button"
                    disabled={kmBusy}
                    onClick={() => void perawatan("sapu-qa")}
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent/40 disabled:opacity-50"
                  >
                    🧹 Sapu data QA
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Uji otomatis (E2E & audit) menandai datanya "QA Bot"/"AuditBot". Tombol ini
                  menyapu semuanya sekali klik — dipakai juga oleh cleanup otomatis E2E.
                </p>
              </div>
            </>
          )}
        </section>
      )}

      {/* ═══ MODUL 5: KUNJUNGAN ═══ */}
      {tab === "kunjungan" && (
        <section className="mt-6">
          {kjLoading && <p className="text-sm text-muted-foreground">Memuat kunjungan…</p>}
          {kjError && <p className="text-sm text-destructive">{kjError}</p>}
          {kunjungan && !kunjungan.tersedia && (
            <p className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
              Tabel kunjungan belum dibuat di database — jalankan SQL setup
              "PageVisitDaily" di Supabase dulu (cek catatan dari asisten), lalu muat ulang.
            </p>
          )}
          {kunjungan?.tersedia && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <StatCard value={nf(kunjungan.hariIni)} label="kunjungan hari ini" />
                <StatCard value={nf(kunjungan.mingguIni)} label="kunjungan 7 hari" />
                <StatCard value={nf(kunjungan.total)} label="total tercatat" />
              </div>
              {kunjungan.top.length === 0 ? (
                <p className="mt-6 rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
                  Belum ada kunjungan tercatat — buka beberapa halaman lalu muat ulang.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {kunjungan.top.map((r) => {
                    const max = Math.max(1, ...kunjungan.top.map((x) => x.mingguIni));
                    return (
                      <div key={r.path} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {labelPath(r.path)}
                          </span>
                          <span className="shrink-0 text-xs font-medium text-muted-foreground">
                            {nf(r.mingguIni)} · 7 hari
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted/60">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.max(4, (r.mingguIni / max) * 100)}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          hari ini {nf(r.hariIni)} · total {nf(r.total)}
                          <span className="ml-1 font-mono">({r.path})</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      )}

      <p className="mt-10 text-center text-sm text-muted-foreground">
        <Link href="/" className="transition-colors hover:text-foreground">
          ← kembali ke beranda
        </Link>
        <span className="mx-2">·</span>
        <Link href="/insight" className="transition-colors hover:text-foreground">
          insight masukan
        </Link>
      </p>
    </main>
  );
}
