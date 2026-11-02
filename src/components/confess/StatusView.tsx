"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Lock,
  Mail,
  MailOpen,
  Check,
  Clock,
  RefreshCw,
  Plus,
  Share2,
  MessageCircle,
  Loader2,
  ChevronDown,
  BookOpenCheck,
  ShieldAlert,
  Eye,
  Ticket,
  Music,
} from "lucide-react";
import { CONFESS_THEMES } from "@/components/confess/ConfessionView";
import { LS_KEYS, lsGet } from "@/lib/local-store";
import { papanModeOf, type PapanMode } from "@/lib/papan";

type LetterStatus = {
  order: number;
  title: string;
  unlockDays: number;
  views: number;
  openedAt: string | null;
  reply?: string | null;
  repliedAt?: string | null;
};

type CouponRow = { title: string; desc?: string };

type StatusData = {
  type: "confess" | "letters" | "gift";
  slug: string;
  fromName: string;
  toName: string;
  theme: string;
  views: number;
  createdAt: string;
  openedAt: string | null;
  hidden?: boolean;
  // khusus confess
  response?: string | null;
  respondedAt?: string | null;
  reply?: string | null;
  repliedAt?: string | null;
  isPublic?: boolean;
  showMessage?: boolean;
  showAs?: string;
  // khusus letters
  startedAt?: string | null;
  total?: number;
  letters?: LetterStatus[];
  // khusus gift
  giftType?: string;
  coupons?: CouponRow[];
  redeemed?: Record<string, string>;
  // khusus playlist
  plTitle?: string;
  plSongs?: number;
};

type SavedItem = {
  slug: string;
  senderKey: string;
  toName: string;
  theme: string;
  type?: string;
  createdAt: string;
};

const GIFT_ICONS: Record<string, string> = {
  confess: "💌",
  letters: "📚",
  bouquet: "💐",
  photobox: "📸",
  cake: "🎂",
  coupons: "🎫",
  playlist: "🎵",
};

function savedIcon(type?: string): string {
  if (!type) return "💌";
  return GIFT_ICONS[type] ?? (type.startsWith("gift:") ? "🎁" : "💌");
}

function loadSaved(): SavedItem[] {
  const raw = lsGet(LS_KEYS.confessions); // fallback otomatis ke kunci era Sayangin
  try {
    return raw ? (JSON.parse(raw) as SavedItem[]) : [];
  } catch {
    return [];
  }
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} hari lalu`;
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

function Step({
  icon,
  title,
  state,
  detail,
  pulse,
}: {
  icon: React.ReactNode;
  title: string;
  state: "done" | "waiting" | "highlight" | "soft";
  detail: React.ReactNode;
  pulse?: boolean;
}) {
  const ring =
    state === "done"
      ? "bg-emerald-500/15 border-emerald-400/50 text-emerald-300"
      : state === "highlight"
        ? "bg-rose-500/20 border-rose-400/60 text-rose-300"
        : state === "soft"
          ? "bg-white/5 border-white/15 text-white/50"
          : "bg-amber-500/10 border-amber-400/40 text-amber-300";

  return (
    <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${ring} ${
          pulse ? "anim-heartbeat" : ""
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-white/60">{detail}</p>
      </div>
    </div>
  );
}

/* daftar kado tersimpan (localStorage) — dipakai confess & letters */
function SavedListBox({
  saved,
  senderKey,
  listOpen,
  setListOpen,
}: {
  saved: SavedItem[];
  senderKey: string;
  listOpen: boolean;
  setListOpen: (v: boolean) => void;
}) {
  if (saved.length === 0) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04]">
      <button
        onClick={() => setListOpen(!listOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        aria-expanded={listOpen}
      >
        <span className="text-xs font-bold text-white/80">
          Confess & kado lain kamu ({saved.length})
        </span>
        <ChevronDown
          className={`h-4 w-4 text-white/50 transition-transform ${
            listOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      <AnimatePresence>
        {listOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-1.5 px-3 pb-3">
              {saved.map((s) => (
                <a
                  key={s.senderKey}
                  href={`/?s=${s.senderKey}`}
                  className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-xs transition ${
                    s.senderKey === senderKey
                      ? "bg-rose-500/20 text-rose-200"
                      : "bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                >
                  <span className="font-semibold">
                    {savedIcon(s.type)} Buat {s.toName}
                  </span>
                  <span className="text-white/40">{relTime(s.createdAt)}</span>
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* kartu status khusus Open When Letters */
function LettersStatusCard({
  data,
  shareAgain,
  saved,
  senderKey,
}: {
  data: StatusData;
  shareAgain: () => void;
  saved: SavedItem[];
  senderKey: string;
}) {
  const [listOpen, setListOpen] = useState(false);
  const DAY = 24 * 3600000;
  const now = Date.now();
  const startedMs = data.startedAt ? new Date(data.startedAt).getTime() : null;
  const letters = data.letters ?? [];
  const readCount = letters.filter((l) => l.openedAt).length;
  const unlockedCount = startedMs
    ? letters.filter((l) => startedMs + l.unlockDays * DAY <= now).length
    : 0;
  const nextLocked = letters.find(
    (l) => !l.openedAt && startedMs && startedMs + l.unlockDays * DAY > now
  );
  const nextIn = nextLocked && startedMs
    ? startedMs + nextLocked.unlockDays * DAY - now
    : 0;
  const nextInDays = Math.max(1, Math.ceil(nextIn / 86400000));
  const replyCount = letters.filter((l) => l.reply).length;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-3">
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur">
        <p className="font-hand text-2xl text-rose-200">{letters.length} surat buat {data.toName},</p>
        <p className="text-xs text-white/50">
          {data.fromName?.trim() ? `dari ${data.fromName} • ` : "dari Seseorang • "}
          dikirim {relTime(data.createdAt)}
        </p>

        {/* progress bar */}
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-600"
              initial={{ width: 0 }}
              animate={{ width: `${letters.length ? (readCount / letters.length) * 100 : 0}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
          <span className="shrink-0 text-xs font-bold text-rose-200">
            {readCount}/{letters.length} dibaca
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {/* 0. kadonya ditinjau tim (dilaporkan >=3x) */}
          {data.hidden && (
            <Step
              icon={<ShieldAlert className="h-5 w-5" />}
              title="Kadonya lagi ditinjau tim"
              state="waiting"
              detail={
                <>
                  Konten ini dilaporkan beberapa kali dan sementara disembunyikan
                  dari penerima.{" "}
                  <a
                    href={`/?k=${data.slug}&p=${senderKey}`}
                    className="font-semibold text-amber-300 underline decoration-amber-400/50 underline-offset-2"
                  >
                    lihat kadonya →
                  </a>
                </>
              }
            />
          )}

          {/* 1. terkirim */}
          <Step
            icon={<Check className="h-5 w-5" />}
            title="Surat-surat terkirim"
            state="done"
            detail={
              <>
                Link aktif & siap dibuka.{" "}
                <a
                  href={`/?k=${data.slug}&p=${senderKey}`}
                  className="inline-flex items-center gap-1 font-semibold text-rose-300 underline decoration-rose-400/50 underline-offset-2 hover:text-rose-200"
                >
                  pratinjau <Eye className="h-3 w-3" />
                </a>{" "}
                ·{" "}
                <button
                  onClick={shareAgain}
                  className="inline-flex items-center gap-1 font-semibold text-rose-300 underline decoration-rose-400/50 underline-offset-2 hover:text-rose-200"
                >
                  kirim ulang <Share2 className="h-3 w-3" />
                </button>
              </>
            }
          />

          {/* 2. dibuka */}
          {data.openedAt ? (
            <Step
              icon={<MailOpen className="h-5 w-5" />}
              title={`Udah dibuka! (${data.views}x)`}
              state="done"
              detail={
                data.startedAt
                  ? "Dia udah mulai bacanya — surat pertama langsung kebuka."
                  : "Dia udah lihat link-nya tapi belum tekan “mulai”. Sabar ya 😌"
              }
            />
          ) : (
            <Step
              icon={<Mail className="h-5 w-5" />}
              title="Belum dibuka"
              state="waiting"
              detail="Link-nya belum dibuka. Kasih tahu dia bahwa ini spesial — pelan-pelan aja. 😌"
            />
          )}

          {/* 3. progres baca */}
          {startedMs ? (
            <Step
              icon={<BookOpenCheck className="h-5 w-5" />}
              title={
                readCount === letters.length
                  ? "Semua suratnya sudah dibaca."
                  : `${unlockedCount - readCount > 0 ? "Ada surat baru yang belum dibaca!" : "Menunggu minggu berikutnya..."}`
              }
              state={unlockedCount - readCount > 0 ? "highlight" : "done"}
              pulse={unlockedCount - readCount > 0}
              detail={
                <>
                  Perjalanan dimulai {relTime(data.startedAt!)}.
                  {replyCount > 0 && (
                    <> Dia sudah bales {replyCount} surat — cek di bawah.</>
                  )}
                  {nextLocked && unlockedCount - readCount <= 0
                    ? ` Surat berikutnya (“${nextLocked.title}”) terbuka dalam ${nextInDays} hari.`
                    : ""}
                </>
              }
            />
          ) : (
            <Step
              icon={<Clock className="h-5 w-5" />}
              title="Belum mulai baca"
              state="soft"
              detail="Waktu buka baru berjalan setelah dia tekan “mulai” di halamannya."
            />
          )}

          {/* daftar per surat */}
          <div className="space-y-1.5 pt-1">
            {letters.map((l) => {
              const unlockMs = startedMs !== null ? startedMs + l.unlockDays * DAY : null;
              const isUnlocked = unlockMs !== null && unlockMs <= now;
              const daysLeft = unlockMs ? Math.ceil((unlockMs - now) / 86400000) : null;
              return (
                <div
                  key={l.order}
                  className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5 text-left"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                      l.openedAt
                        ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300"
                        : isUnlocked
                          ? "border-rose-400/60 bg-rose-500/20 text-rose-300"
                          : "border-white/15 bg-white/5 text-white/40"
                    }`}
                  >
                    {l.openedAt ? (
                      <BookOpenCheck className="h-4 w-4" />
                    ) : isUnlocked ? (
                      <MailOpen className="h-4 w-4" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-white/90">
                      {l.order + 1}. {l.title}
                    </p>
                    <p className="text-[11px] text-white/45">
                      {l.openedAt
                        ? `dibaca ${relTime(l.openedAt)} • ${l.views}x`
                        : isUnlocked
                          ? "sudah bisa dibuka — belum dibaca"
                          : daysLeft
                            ? `terbuka dalam ${daysLeft} hari lagi`
                            : "menunggu dia mulai"}
                    </p>
                    {l.reply && (
                      <div className="mt-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1.5 text-left">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-300">
                          dibalas {l.repliedAt ? relTime(l.repliedAt) : ""}
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap text-[11px] leading-4 text-emerald-100/90">
                          {l.reply}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <SavedListBox saved={saved} senderKey={senderKey} listOpen={listOpen} setListOpen={setListOpen} />

      <a
        href="/#openwhen"
        className="flex items-center justify-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/10 py-3.5 text-sm font-bold text-rose-200 transition hover:bg-rose-500/20"
      >
        <Plus className="h-4 w-4" /> Bikin set surat lagi
      </a>

      <p className="pt-2 text-center text-[11px] leading-relaxed text-white/40">
        Simpan link halaman ini ({typeof window !== "undefined" ? window.location.href.slice(0, 40) : ""}…)
        — ini satu-satunya cara buat lihat status.
      </p>
    </motion.div>
  );
}

/* kartu status khusus kado digital (buket/photobox/kue/kupon) */
function GiftStatusCard({
  data,
  shareAgain,
  saved,
  senderKey,
}: {
  data: StatusData;
  shareAgain: () => void;
  saved: SavedItem[];
  senderKey: string;
}) {
  const [listOpen, setListOpen] = useState(false);
  const giftType = data.giftType ?? "bouquet";
  const icon = savedIcon(giftType);
  const coupons = data.coupons ?? [];
  const redeemed = data.redeemed ?? {};
  const usedCount = Object.keys(redeemed).length;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-3">
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur">
        <p className="font-hand text-2xl text-rose-200">
          {icon} Buat {data.toName},
        </p>
        <p className="text-xs text-white/50">
          {data.fromName?.trim() ? `dari ${data.fromName} • ` : "dari Seseorang • "}
          dikirim {relTime(data.createdAt)} • {data.views}x dibuka
        </p>

        <div className="mt-5 space-y-3">
          {/* 0. kadonya ditinjau tim (dilaporkan >=3x) */}
          {data.hidden && (
            <Step
              icon={<ShieldAlert className="h-5 w-5" />}
              title="Kadonya lagi ditinjau tim"
              state="waiting"
              detail={
                <>
                  Konten ini dilaporkan beberapa kali dan sementara disembunyikan
                  dari penerima.{" "}
                  <a
                    href={`/?k=${data.slug}&p=${senderKey}`}
                    className="font-semibold text-amber-300 underline decoration-amber-400/50 underline-offset-2"
                  >
                    lihat kadonya →
                  </a>
                </>
              }
            />
          )}

          {/* 1. terkirim */}
          <Step
            icon={<Check className="h-5 w-5" />}
            title="Kado terkirim"
            state="done"
            detail={
              <>
                Link aktif & siap dibuka.{" "}
                <a
                  href={`/?k=${data.slug}&p=${senderKey}`}
                  className="inline-flex items-center gap-1 font-semibold text-rose-300 underline decoration-rose-400/50 underline-offset-2 hover:text-rose-200"
                >
                  pratinjau <Eye className="h-3 w-3" />
                </a>{" "}
                ·{" "}
                <button
                  onClick={shareAgain}
                  className="inline-flex items-center gap-1 font-semibold text-rose-300 underline decoration-rose-400/50 underline-offset-2 hover:text-rose-200"
                >
                  kirim ulang <Share2 className="h-3 w-3" />
                </button>
              </>
            }
          />

          {/* 2. dibuka */}
          {data.openedAt ? (
            <Step
              icon={<MailOpen className="h-5 w-5" />}
              title={`Udah dibuka! (${data.views}x)`}
              state="done"
              detail={`Pertama kali ${relTime(data.openedAt)}.`}
            />
          ) : (
            <Step
              icon={<Mail className="h-5 w-5" />}
              title="Belum dibuka"
              state="waiting"
              detail="Link-nya belum dibuka. Kirim lagi pas dia lagi santai 😌"
            />
          )}

          {/* 3a. khusus playlist: ringkasan isi */}
          {giftType === "playlist" && (
            <Step
              icon={<Music className="h-5 w-5" />}
              title={
                data.plSongs
                  ? `${data.plSongs} lagu nunggu didengerin`
                  : "Playlistnya siap didengerin"
              }
              state="soft"
              detail={
                data.plTitle
                  ? `“${data.plTitle}” — tiap lagunya ada catatan kenangan darimu 🎧`
                  : "Tiap lagunya ada catatan kenangan darimu 🎧"
              }
            />
          )}

          {/* 3. khusus kupon: progres pemakaian */}
          {giftType === "coupons" && coupons.length > 0 && (
            <>
              <Step
                icon={<Ticket className="h-5 w-5" />}
                title={
                  usedCount === coupons.length
                    ? "Semua kuponnya udah dipakai."
                    : usedCount > 0
                      ? `${usedCount} dari ${coupons.length} kupon udah dipakai`
                      : "Belum ada kupon yang dipakai"
                }
                state={usedCount > 0 ? "highlight" : "soft"}
                pulse={usedCount > 0 && usedCount < coupons.length}
                detail="Dia bakal nunjukin kupon yang udah dicaput — siap-siap tepati ya."
              />
              <div className="space-y-1.5 pt-1">
                {coupons.map((c, i) => {
                  const usedAt = redeemed[String(i)];
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5 text-left"
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                          usedAt
                            ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300"
                            : "border-white/15 bg-white/5 text-white/40"
                        }`}
                      >
                        {usedAt ? <Check className="h-4 w-4" /> : <Ticket className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-xs font-semibold ${usedAt ? "text-white/60 line-through" : "text-white/90"}`}>
                          {i + 1}. {c.title}
                        </p>
                        <p className="text-[11px] text-white/45">
                          {usedAt
                            ? `dipakai ${new Date(usedAt).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}`
                            : "belum dipakai"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <SavedListBox saved={saved} senderKey={senderKey} listOpen={listOpen} setListOpen={setListOpen} />

      <a
        href="/#kejutan"
        className="flex items-center justify-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/10 py-3.5 text-sm font-bold text-rose-200 transition hover:bg-rose-500/20"
      >
        <Plus className="h-4 w-4" /> Bikin kado lagi
      </a>

      <p className="pt-2 text-center text-[11px] leading-relaxed text-white/40">
        Simpan link halaman ini ({typeof window !== "undefined" ? window.location.href.slice(0, 40) : ""}…)
        — ini satu-satunya cara buat lihat status.
      </p>
    </motion.div>
  );
}

export default function StatusView({ senderKey }: { senderKey: string }) {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [listOpen, setListOpen] = useState(false);
  // kontrol Papan Pengakuan — null = belum disentuh, tampilkan nilai server
  const [wallMode, setWallMode] = useState<PapanMode | null>(null);
  const [wallBusy, setWallBusy] = useState(false);
  const [wallErr, setWallErr] = useState("");

  const modeNow: PapanMode =
    wallMode ??
    papanModeOf(
      data?.isPublic ?? false,
      data?.showMessage ?? false,
      data?.showAs ?? "anonim"
    );

  async function applyWallMode(mode: PapanMode) {
    if (!data || wallBusy || mode === modeNow) return;
    setWallMode(mode); // optimis — rollback kalau server nolak
    setWallBusy(true);
    setWallErr("");
    try {
      const res = await fetch(`/api/status/${senderKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallMode: mode }),
      });
      if (!res.ok) throw new Error("gagal");
    } catch {
      setWallMode(modeNow); // rollback ke nilai sebelumnya
      setWallErr("Gagal menyimpan — coba lagi ya.");
    } finally {
      setWallBusy(false);
    }
  }

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/status/${senderKey}`);
      if (!res.ok) throw new Error("notfound");
      const d = await res.json();
      setData(d);
      setError("");
    } catch {
      setError("Status nggak ditemukan. Buka lewat link yang kamu simpan ya.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [senderKey]);

  useEffect(() => {
    setSaved(loadSaved());
    fetchStatus();
  }, [fetchStatus]);

  // auto-refresh: confess nunggu jawaban / balasan tertulis (12s), letters/gift pantau progres (60s)
  useEffect(() => {
    if (!data) return;
    if (data.type === "confess" && data.response && data.reply) return;
    const t = setInterval(fetchStatus, data.type === "confess" ? 12000 : 60000);
    return () => clearInterval(t);
  }, [data, fetchStatus]);

  const active = useMemo(
    () => saved.find((s) => s.senderKey === senderKey) ?? null,
    [saved, senderKey]
  );

  const refresh = () => {
    setRefreshing(true);
    fetchStatus();
  };

  const shareAgain = () => {
    const link = `${window.location.origin}/?k=${data?.slug}`;
    const text =
      data?.type === "letters"
        ? encodeURIComponent(
            `Aku bikinin surat-surat kecil buat kamu. Satu boleh dibuka tiap minggu — pelan-pelan aja ya: ${link}`
          )
        : data?.type === "gift"
          ? encodeURIComponent(
              `Aku ada kado spesial buat kamu. Buka ya: ${link}`
            )
          : encodeURIComponent(
              `Pssst... ada surat rahasia buat kamu. Buka di sini ya: ${link}`
            );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  // flex ke medsos — mesin FOMO: orang lihat, orang pengen ikutan
  const flexStory = async () => {
    const url = window.location.origin;
    const text =
      "Aku baru berani ngirim surat rahasia lewat Kangenin 💌 Kamu kapan?";
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Kangenin", text, url });
        return;
      }
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
        "_blank",
        "noopener"
      );
    } catch {
      /* user batal — diabaikan */
    }
  };

  const theme = CONFESS_THEMES[data?.theme ?? "rose"] ?? CONFESS_THEMES.rose;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#2b0a1c] via-[#3d0c24] to-[#160510]">
      <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-rose-600/20 blur-[100px]" />
      <div className="absolute -right-16 bottom-10 h-72 w-72 rounded-full bg-pink-500/15 blur-[100px]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-10">
        {/* header */}
        <div className="flex items-center justify-between">
          <a href="/" className="flex items-center gap-1.5">
            <Heart className="h-5 w-5 fill-rose-500 text-rose-500" />
            <span className="text-sm font-extrabold text-white">
              kangen<span className="text-rose-500">.in</span>
            </span>
          </a>
          <button
            onClick={refresh}
            aria-label="Perbarui status"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        <h1 className="mt-8 text-2xl font-extrabold leading-tight text-white">
          {data?.type === "letters"
            ? "Pantau surat mingguanmu"
            : data?.type === "gift"
              ? "Pantau kado digitalmu"
              : "Pantau confess kamu"}
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Halaman ini update otomatis — biarkan tab-nya terbuka.
        </p>

        {/* LOADING */}
        {loading && (
          <div className="mt-20 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-rose-400" />
          </div>
        )}

        {/* ERROR */}
        {!loading && error && (
          <div className="mt-10 rounded-lg bg-white/10 p-6 text-center backdrop-blur">
            <p className="text-sm text-white/75">{error}</p>
            <a
              href="/"
              className="mt-5 inline-block rounded-md bg-primary px-6 py-2.5 text-sm font-bold text-white hover:bg-[#b52743]"
            >
              Ke Kangenin
            </a>
          </div>
        )}

        {/* STATUS CARD */}
        {!loading && !error && data && data.type === "letters" && (
          <LettersStatusCard data={data} shareAgain={shareAgain} saved={saved} senderKey={senderKey} />
        )}
        {!loading && !error && data && data.type === "gift" && (
          <GiftStatusCard data={data} shareAgain={shareAgain} saved={saved} senderKey={senderKey} />
        )}
        {!loading && !error && data && data.type === "confess" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 space-y-3"
          >
            <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur">
              <p className="font-hand text-2xl text-rose-200">
                Buat {data.toName},
              </p>
              <p className="text-xs text-white/50">
                {data.fromName?.trim()
                  ? `dari ${data.fromName} • `
                  : "dari Seseorang • "}
                dikirim {relTime(data.createdAt)}
              </p>

              <div className="mt-5 space-y-3">
                {/* 0. kadonya ditinjau tim (dilaporkan >=3x) */}
                {data.hidden && (
                  <Step
                    icon={<ShieldAlert className="h-5 w-5" />}
                    title="Kadonya lagi ditinjau tim"
                    state="waiting"
                    detail={
                      <>
                        Konten ini dilaporkan beberapa kali dan sementara
                        disembunyikan dari penerima.{" "}
                        <a
                          href={`/?k=${data.slug}&p=${senderKey}`}
                          className="font-semibold text-amber-300 underline decoration-amber-400/50 underline-offset-2"
                        >
                          lihat kadonya →
                        </a>
                      </>
                    }
                  />
                )}

                {/* 1. terkirim */}
                <Step
                  icon={<Check className="h-5 w-5" />}
                  title="Surat terkirim"
                  state="done"
                  detail={
                    <>
                      Link-nya sudah jadi &amp; aktif.{" "}
                      <a
                        href={`/?k=${data.slug}&p=${senderKey}`}
                        className="inline-flex items-center gap-1 font-semibold text-rose-300 underline decoration-rose-400/50 underline-offset-2 hover:text-rose-200"
                      >
                        pratinjau <Eye className="h-3 w-3" />
                      </a>{" "}
                      ·{" "}
                      <button
                        onClick={shareAgain}
                        className="inline-flex items-center gap-1 font-semibold text-rose-300 underline decoration-rose-400/50 underline-offset-2 hover:text-rose-200"
                      >
                        kirim ulang <Share2 className="h-3 w-3" />
                      </button>
                    </>
                  }
                />

                {/* 2. dibuka */}
                {data.openedAt ? (
                  <Step
                    icon={<MailOpen className="h-5 w-5" />}
                    title={`Udah dibuka! (${data.views}x)`}
                    state="done"
                    detail={
                      <>
                        Pertama kali {relTime(data.openedAt)}.{" "}
                        {data.response
                          ? ""
                          : "Dia lagi baca... tunggu jawabannya."}
                      </>
                    }
                  />
                ) : (
                  <Step
                    icon={<Mail className="h-5 w-5" />}
                    title="Belum dibuka"
                    state="waiting"
                    detail="Link-nya belum dibuka. Sabar — jangan spam dia, kirim lagi pas malam hari 😌"
                  />
                )}

                {/* 3. jawaban */}
                {data.response === "yes" ? (
                  <Step
                    icon={<Heart className="h-5 w-5 fill-rose-400 text-rose-400" />}
                    title="Iya — dia juga suka kamu"
                    state="highlight"
                    pulse
                    detail={
                      <>
                        Selamat! {data.fromName?.trim() || "Kamu"} — chat dia
                        sekarang sebelum momennya lewat.{" "}
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(
                            `Hai ${data.toName}! Jadi... katanya kamu juga suka aku?`
                          )}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 font-semibold text-emerald-300 underline decoration-emerald-400/50 underline-offset-2"
                        >
                          buka WA <MessageCircle className="h-3 w-3" />
                        </a>
                      </>
                    }
                  />
                ) : data.response === "later" ? (
                  <Step
                    icon={<Clock className="h-5 w-5" />}
                    title="Dia minta waktu"
                    state="soft"
                    detail="Nggak apa-apa. Kamu tetap anonim — mungkin dia butuh proses. Tetap semangat!"
                  />
                ) : (
                  <Step
                    icon={<Clock className="h-5 w-5" />}
                    title={data.openedAt ? "Nunggu jawaban..." : "Belum ada jawaban"}
                    state={data.openedAt ? "waiting" : "soft"}
                    pulse={!!data.openedAt}
                    detail={
                      data.openedAt
                        ? "Dia udah baca tapi belum jawab. Deg-degan ya."
                        : "Kadang butuh beberapa jam — atau beberapa keberanian."
                    }
                  />
                )}

                {/* 4. balasan tertulis dari penerima */}
                {data.reply ? (
                  <Step
                    icon={<MessageCircle className="h-5 w-5" />}
                    title="Ada balasan dari dia."
                    state="highlight"
                    pulse
                    detail={
                      <span>
                        <span className="mt-1 block whitespace-pre-wrap rounded-xl bg-white/5 p-3 text-sm leading-relaxed text-white/85">
                          {data.reply}
                        </span>
                        <span className="mt-1.5 block">
                          dikirim {relTime(data.repliedAt ?? data.createdAt)} — ini
                          tulisan tangannya langsung.
                        </span>
                      </span>
                    }
                  />
                ) : (
                  data.response && (
                    <Step
                      icon={<MessageCircle className="h-5 w-5" />}
                      title="Nunggu balasan tertulis..."
                      state="soft"
                      pulse
                      detail="Dia udah jawab, tapi belum nulis balasan. Balasan bisa muncul kapan aja — cek lagi nanti."
                    />
                  )
                )}
              </div>
            </div>

            {/* kontrol Papan Pengakuan — 3 mode, bisa diganti kapan saja */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur">
              <p className="text-sm font-bold text-rose-100">
                Tayang di Papan Pengakuan
              </p>
              <p className="mt-1 text-xs leading-relaxed text-white/50">
                {modeNow === "off"
                  ? "Privat — suratmu cuma bisa dibaca dia lewat link rahasianya."
                  : modeNow === "anonim"
                    ? "Isi suratmu tayang di Papan (halaman depan) sebagai “Seseorang” — identitasmu tetap misterius."
                    : "Isi suratmu + nama depanmu tayang di Papan (halaman depan) — pamer bahwa kamu yang berani."}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(["off", "anonim", "nama"] as PapanMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={modeNow === m}
                    disabled={wallBusy}
                    onClick={() => applyWallMode(m)}
                    className={`rounded-lg border px-2 py-2.5 text-[11px] font-bold transition disabled:opacity-60 ${
                      modeNow === m
                        ? "border-rose-400/70 bg-rose-500/20 text-white"
                        : "border-white/15 bg-white/5 text-white/60 hover:border-white/35 hover:text-white"
                    }`}
                  >
                    {m === "off" ? "Privat" : m === "anonim" ? "Anonim" : "Nama depan"}
                  </button>
                ))}
              </div>
              {wallErr && (
                <p className="mt-2 text-[11px] font-medium text-amber-300">
                  {wallErr}
                </p>
              )}
              {modeNow !== "off" && (
                <a
                  href="/#papan"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-[11px] font-semibold text-rose-300 underline decoration-rose-400/50 underline-offset-2"
                >
                  lihat kartumu di Papan halaman depan →
                </a>
              )}
            </div>

            {/* daftar confess lain dari localStorage */}
            <SavedListBox saved={saved} senderKey={senderKey} listOpen={listOpen} setListOpen={setListOpen} />

            <button
              onClick={flexStory}
              className="flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 py-3.5 text-sm font-bold text-white/85 transition hover:bg-white/10"
            >
              <Share2 className="h-4 w-4" /> Flex ke medsos: “aku udah berani,
              kamu kapan?”
            </button>

            <a
              href="/#confess"
              className="flex items-center justify-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/10 py-3.5 text-sm font-bold text-rose-200 transition hover:bg-rose-500/20"
            >
              <Plus className="h-4 w-4" /> Bikin confess / kado lagi
            </a>

            <p className="pt-2 text-center text-[11px] leading-relaxed text-white/40">
              Simpan link halaman ini ({window.location.href.slice(0, 40)}…)
              — ini satu-satunya cara buat lihat status.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
