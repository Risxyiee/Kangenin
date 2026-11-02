"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Copy,
  Check,
  Eye,
  Loader2,
  Share2,
} from "lucide-react";
import ConfessionView, { CONFESS_THEMES } from "@/components/confess/ConfessionView";
import { LS_KEYS, lsGet, lsSet } from "@/lib/local-store";
import { FETCH_TIMEOUT_MESSAGE, fetchWithTimeout, isTimeoutError } from "@/lib/fetch-timeout";
import { AiAssistButton } from "@/components/ui/ai-assist";

/* alur demo = CERMIN PERSIS alur asli PremiumConfess (Heartstring Edition):
   segel lilin → tahan detak (3 reward) → hati retak → surat baris demi baris
   → pilihan jawaban → balasan tertulis → terkirim */
type Phase = "seal" | "heartbeat" | "shatter" | "letter" | "question" | "reply" | "sent";
const DEMO_MSG =
  "Hei... aku udah lama pengen bilang ini. Setiap kamu ketawa, aku ikut senyum. Aku suka kamu. Sudah lama.";
const DEMO_REPLY = "aku juga… makasih udah berani bilang 🤍";
/* surat demo dipecah baris — babak "letter" asli memunculkan pesan BARIS DEMI BARIS */
const DEMO_LINES = [
  "Hei... aku udah lama pengen bilang ini.",
  "Setiap kamu ketawa, aku ikut senyum.",
  "Aku suka kamu. Sudah lama.",
];
const DEMO_SENDER = "Rizky";
const DEMO_MASKED = "Ri••y"; // topeng bocor ala leakName() di PremiumConfess

/* geometri retakan & pecahan — disalin dari PremiumConfess (skala sama,
   supaya mini-demo ini benar-benar memperlihatkan babak "shatter" aslinya) */
const CRACKS = [
  { d: "M66 12 L59 46 L73 72 L61 106", delay: 0 },
  { d: "M59 46 L39 58", delay: 0.14 },
  { d: "M73 72 L95 84", delay: 0.2 },
];
const SHARDS = [
  { x: -70, y: -46, r: -120, d: 0.0 },
  { x: 64, y: -58, r: 140, d: 0.05 },
  { x: -46, y: 44, r: -80, d: 0.1 },
  { x: 52, y: 40, r: 100, d: 0.14 },
  { x: -14, y: -84, r: -160, d: 0.18 },
  { x: 20, y: 78, r: 60, d: 0.22 },
];
const FIREFLIES = [
  { x: -84, y: -120, d: 0.05 },
  { x: -46, y: -150, d: 0.18 },
  { x: -8, y: -132, d: 0.1 },
  { x: 34, y: -158, d: 0.26 },
  { x: 72, y: -128, d: 0.14 },
  { x: 98, y: -96, d: 0.34 },
  { x: -104, y: -84, d: 0.4 },
  { x: 12, y: -176, d: 0.5 },
];
const RING_C = 2 * Math.PI * 56; // keliling cincin progres detak

/* warna tema demo — kelas gradien SAMA dengan tema asli di lib/themes.ts,
   muter tiap putaran supaya kelihatan bahwa pilihan tema benar-benar ngaruh */
const DEMO_THEMES = [
  { name: "Rose", bg: "from-[#2b0a1c] via-[#4a0e2e] to-[#160510]", dot: "#ff5f9e" },
  { name: "Matcha", bg: "from-[#0f2118] via-[#1f4d33] to-[#081209]", dot: "#86efac" },
  { name: "Midnight", bg: "from-[#150620] via-[#3b0764] to-[#0b0313]", dot: "#c084fc" },
];

/* cerita di balik tiap tema — ala kartu template kompetitor, gratis semua.
   Tema ber-flag limited ditampilkan dgn badge mundur (FOMO edisi terbatas). */
const THEME_TAGS: Record<string, string> = {
  rose: "klasik — rahasia paling manis",
  sunset: "hangat kayak senja jam 6",
  midnight: "malam berbintang, dalam",
  sakura: "selembut kelopak yang jatuh",
  matcha: "tenang, hangat kayak matcha latte",
};

/* pilihan jadwal buka — surat terkunci sampai waktunya (countdown di penerima) */
function unlockDateFor(preset: string): string | null {
  if (!preset) return null;
  const d = new Date();
  if (preset === "malam") {
    d.setHours(20, 0, 0, 0);
    if (d.getTime() < Date.now() + 60_000) d.setDate(d.getDate() + 1); // sudah lewat → besok
  } else if (preset === "besok") {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
  } else if (preset === "minggu") {
    d.setDate(d.getDate() + 7);
  } else {
    return null;
  }
  return d.toISOString();
}

const UNLOCK_OPTIONS = [
  { value: "", label: "Kirim sekarang — dia bisa langsung buka" },
  { value: "malam", label: "Kejutan: buka jam 8 malam nanti 🌙" },
  { value: "besok", label: "Kejutan: buka besok pagi ☀️" },
  { value: "minggu", label: "Kejutan: buka seminggu lagi 📅" },
];

/* ---------- demo looping di dalam HP — cermin PERSIS alur asli (Heartstring):
   segel lilin → tahan detak 850/650/480ms (3 reward: potongan pesan, nama
   bocor, retak) → pecah + kunang-kunang → surat baris demi baris → jawaban
   → balasan → terkirim. Bukan lagi animasi amplop lama. ---------- */
function PhoneDemo() {
  const [phase, setPhase] = useState<Phase>("seal");
  const [beat, setBeat] = useState(0); // detak keberapa yang sudah terlepas
  const [loop, setLoop] = useState(0);
  const theme = DEMO_THEMES[loop % DEMO_THEMES.length];

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (phase === "seal") {
      // di aslinya penerima yang mengetuk segelnya — demo auto-tap
      timers.push(setTimeout(() => setPhase("heartbeat"), 2600));
    } else if (phase === "heartbeat") {
      // mesin detak yang SAMA dengan PremiumConfess: 850 → 650 → 480 ms
      let acc = 0;
      [850, 650, 480].forEach((dur, i) => {
        acc += dur;
        timers.push(setTimeout(() => setBeat(i + 1), acc));
      });
      // detak ke-3 = hati retak → babak pecah (di asli: audio.crack)
      timers.push(setTimeout(() => setPhase("shatter"), acc + 520));
    } else if (phase === "shatter") {
      // kilatan putih + retakan + pecahan + kunang-kunang → surat (di asli 1.75 dtk)
      timers.push(setTimeout(() => setPhase("letter"), 1900));
    } else if (phase === "letter") {
      // 3 baris blur → tajam (stagger di render), lalu pilihan jawaban
      timers.push(setTimeout(() => setPhase("question"), 3100));
    } else if (phase === "question") {
      // di aslinya penerima memilih — demo memutar jalur jawaban "iya"
      timers.push(setTimeout(() => setPhase("reply"), 3000));
    } else if (phase === "reply") {
      timers.push(setTimeout(() => setPhase("sent"), 2600));
    } else {
      // sent → mulai lagi, tema ganti
      timers.push(
        setTimeout(() => {
          setBeat(0);
          setLoop((l) => l + 1); // putaran baru → tema ganti
          setPhase("seal");
        }, 3600)
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  return (
    <div className="relative mx-auto w-[290px] rounded-[2.4rem] border-[10px] border-neutral-800 bg-neutral-800 shadow-xl sm:w-[310px]">
      {/* notch */}
      <div className="absolute left-1/2 top-0 z-30 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-neutral-800" />
      <div
        className={`relative h-[480px] overflow-hidden rounded-[1.7rem] bg-gradient-to-b transition-all duration-700 ${theme.bg}`}
      >
        {/* chip tema — bukti visual pilihan warna benar-benar dipakai */}
        <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 backdrop-blur">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: theme.dot }}
          />
          <span className="text-[9px] font-semibold tracking-wide text-white/85">
            Tema {theme.name}
          </span>
        </div>

        {/* ── BABAK 0 — SEGEL LILIN (persis "veil" PremiumConfess) ── */}
        {phase === "seal" && (
          <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center">
            <p className="font-hand text-2xl text-white">Buat kamu,</p>
            <p className="mt-0.5 text-[11px] text-white/60">
              seseorang menyegel suratnya
            </p>
            <div className="relative mt-8 flex h-[120px] w-[180px] items-center justify-center anim-float">
              {/* halo glow — animasi seal-glow yang sama dipakai alur asli */}
              <div
                className="absolute h-28 w-28 rounded-full border border-white/20"
                style={{ animation: "seal-glow 1.8s ease-in-out infinite" }}
              />
              {/* segel lilin hati */}
              <div
                className="relative flex h-20 w-20 items-center justify-center rounded-full"
                style={{
                  background:
                    "radial-gradient(circle at 35% 30%, #c14a5e, #7a1f33 72%)",
                  boxShadow:
                    "0 8px 20px rgba(0,0,0,0.45), inset 0 2px 6px rgba(255,255,255,0.28)",
                }}
              >
                <div className="relative h-7 w-7">
                  <div className="heart-shape" style={{ background: "#fff3ea" }} />
                </div>
              </div>
              <span className="absolute bottom-0 rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-semibold text-white/85 backdrop-blur">
                segel detak jantung
              </span>
            </div>
            <p className="mt-8 text-[11px] leading-relaxed text-white/50">
              &ldquo;tersegel dengan detak jantung seseorang&rdquo;
            </p>
          </div>
        )}

        {/* ── BABAK 1 — DETAK (persis "heartbeat": 3 detak makin cepat + reward) ── */}
        {phase === "heartbeat" && (
          <div className="relative z-10 flex h-full flex-col items-center justify-center px-5 text-center">
            <p className="text-sm text-white/80">
              Dengarkan&hellip; dia masih berdetak.
            </p>
            <div className="relative mt-6 h-[132px] w-[132px]">
              {/* cincin progres — terisi tiap detak, seperti ring aslinya */}
              <svg
                viewBox="0 0 132 132"
                className="absolute inset-0 h-full w-full -rotate-90"
                aria-hidden
              >
                <circle
                  cx="66"
                  cy="66"
                  r="56"
                  fill="none"
                  stroke="rgba(255,255,255,0.14)"
                  strokeWidth="3"
                />
                <circle
                  cx="66"
                  cy="66"
                  r="56"
                  fill="none"
                  stroke="#e8b4bb"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={RING_C}
                  strokeDashoffset={RING_C * (1 - beat / 3)}
                  style={{ transition: "stroke-dashoffset 0.72s ease" }}
                />
              </svg>
              {/* hati yang ditahan — berdetak makin cepat */}
              <div className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center anim-heartbeat">
                <div className="relative h-10 w-10">
                  <div className="heart-shape" style={{ background: "#e8798f" }} />
                </div>
              </div>
            </div>
            {/* reward tiap detak — urutan persis alur asli:
                potongan pesan (blur) → nama bocor → retak */}
            <div className="mt-5 flex min-h-[64px] flex-col items-center gap-2">
              {beat >= 1 && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-full bg-white/10 px-3 py-1 text-[10px] text-white/85 backdrop-blur"
                >
                  <span className="blur-[1.5px]">
                    &ldquo;Hei... aku udah lama&hellip;&rdquo;
                  </span>
                </motion.p>
              )}
              {beat >= 2 && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-full border border-[#e8b4bb]/40 bg-[#e8b4bb]/10 px-3 py-1 text-[10px] font-semibold text-[#e8b4bb]"
                >
                  darinya: {DEMO_MASKED}
                </motion.p>
              )}
              {beat >= 3 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[10px] text-white/60"
                >
                  detak ke-3&hellip; hatinya retak
                </motion.p>
              )}
            </div>
            <p className="mt-1 text-[10px] text-white/40">
              (di aslinya, dia nahan detaknya pakai jarinya)
            </p>
          </div>
        )}

        {/* ── BABAK 2 — RETAK (persis "shatter": kilat, retakan, pecahan, kunang-kunang) ── */}
        {phase === "shatter" && (
          <div className="relative z-10 flex h-full flex-col items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.32, 0] }}
              transition={{ duration: 0.9, times: [0, 0.22, 1] }}
              className="pointer-events-none absolute inset-0 bg-white"
            />
            <div className="relative h-40 w-40">
              {/* hati memudar berserakan */}
              <motion.div
                animate={{ scale: 0.55, opacity: 0 }}
                transition={{ duration: 0.7, ease: "easeIn" }}
                className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center"
              >
                <div
                  className="heart-shape h-full w-full"
                  style={{ background: "#e8798f" }}
                />
              </motion.div>
              {/* garis retak menjalar — path asli PremiumConfess */}
              <svg
                viewBox="0 0 132 132"
                className="absolute inset-0 m-auto h-28 w-28 overflow-visible"
                aria-hidden
              >
                {CRACKS.map((c, i) => (
                  <motion.path
                    key={i}
                    d={c.d}
                    fill="none"
                    stroke="rgba(255,255,255,0.8)"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.45, delay: c.delay }}
                  />
                ))}
              </svg>
              {/* pecahan hati terpental */}
              {SHARDS.map((s, i) => (
                <motion.span
                  key={i}
                  className="absolute left-1/2 top-1/2 h-3 w-3"
                  initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                  animate={{ x: s.x, y: s.y, rotate: s.r, opacity: 0 }}
                  transition={{ duration: 0.9, delay: s.d, ease: "easeOut" }}
                >
                  <span
                    className="heart-shape block h-full w-full"
                    style={{ background: i % 2 ? "#e8b4bb" : "#c96b7d" }}
                  />
                </motion.span>
              ))}
              {/* kunang-kunang naik */}
              {FIREFLIES.map((f, i) => (
                <motion.span
                  key={i}
                  className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
                  style={{ background: i % 2 ? "#d9a441" : "#fdf6f0" }}
                  initial={{ x: f.x * 0.4, y: -12, opacity: 0 }}
                  animate={{ x: f.x, y: f.y, opacity: [0, 0.9, 0] }}
                  transition={{ duration: 1.4, delay: f.d, ease: "easeOut" }}
                />
              ))}
            </div>
            <p className="mt-1 text-[11px] text-white/60">
              hatinya retak&hellip; suratnya mulai kebuka
            </p>
          </div>
        )}

        {/* ── BABAK 3 — SURAT (persis "letter": muncul baris demi baris, blur → tajam) ── */}
        {(phase === "letter" || phase === "question") && (
          <div className="relative z-10 flex h-full flex-col justify-center px-4">
            <div className="grain relative rounded-lg bg-[#fffaf5] p-4 text-left shadow-md ring-1 ring-black/5">
              {/* aksen gold-foil seperti lembar pengakuan aslinya */}
              <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[#d9a441]/70 to-transparent" />
              <p className="font-hand text-lg leading-6 text-primary">
                Hai Kamu,
              </p>
              <div className="mt-2 min-h-[92px] space-y-1.5">
                {DEMO_LINES.map((line, i) => (
                  <motion.p
                    key={i}
                    initial={{ opacity: 0, filter: "blur(6px)", y: 6 }}
                    animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                    transition={{ delay: 0.3 + i * 0.55, duration: 0.5 }}
                    className="text-[11.5px] leading-relaxed text-neutral-800"
                  >
                    {line}
                  </motion.p>
                ))}
              </div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + DEMO_LINES.length * 0.55 }}
                className="mt-2 text-right font-hand text-base text-neutral-600"
              >
                — {DEMO_MASKED}
              </motion.p>
            </div>
            {phase === "question" && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="mt-4 space-y-2"
              >
                <p className="text-center text-[10px] font-medium text-white/80">
                  Jadi... gimana jawabanmu?
                </p>
                <div className="rounded-md bg-primary py-2.5 text-center text-[11px] font-bold text-white">
                  Iya, aku juga suka kamu
                </div>
                <div className="rounded-md border border-white/20 bg-white/5 py-2.5 text-center text-[11px] text-white/70">
                  Beri aku waktu dulu
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* ── JAWABAN + BALASAN (persis loop dua arah: iya → nama kebuka → balas) ── */}
        {phase === "reply" && (
          <div className="relative z-10 flex h-full flex-col justify-center px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-lg bg-[#fffaf5] p-3.5 text-left shadow-md ring-1 ring-black/5"
            >
              <p className="text-[11px] font-bold text-[#9d1c34]">
                Dia jawab: IYA 💘
              </p>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-neutral-700">
                Nama pengirimnya kebuka: <b>{DEMO_SENDER}</b>
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-3 rounded-lg border border-white/20 bg-white/5 p-3 backdrop-blur"
            >
              <p className="text-[11px] font-bold text-white">
                Mau kirim pesan buat dia? 💬
              </p>
              <div className="mt-2 flex items-center gap-1.5" aria-label="sedang menulis">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/70" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/70 [animation-delay:0.2s]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/70 [animation-delay:0.4s]" />
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-white/60">
                Balasannya muncul di dashboard pengirimnya — tanpa nama.
              </p>
            </motion.div>
          </div>
        )}

        {/* ── TERKIRIM ── */}
        {phase === "sent" && (
          <div className="relative z-10 flex h-full flex-col items-center justify-center px-5 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
              <div className="relative h-8 w-8 anim-heartbeat">
                <div className="heart-shape" />
              </div>
            </div>
            <p className="mt-4 font-display text-lg font-bold text-white">
              Balasanmu terkirim 💜
            </p>
            <div className="mt-3 w-full rounded-2xl rounded-tl-sm bg-white/10 px-3.5 py-2.5 text-left text-[11px] leading-relaxed text-white/90 backdrop-blur">
              &ldquo;{DEMO_REPLY}&rdquo;
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-white/55">
              Pesannya udah nongol di dashboard pengirimnya —
              tanpa nama, tanpa jejak.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- section utama ---------- */
export default function ConfessSection() {
  const [fromName, setFromName] = useState("");
  const [toName, setToName] = useState("");
  const [message, setMessage] = useState("");
  const [theme, setTheme] = useState("rose");
  const [showOnWall, setShowOnWall] = useState(false);
  const [unlockPreset, setUnlockPreset] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [statusUrl, setStatusUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [previewData, setPreviewData] = useState<null | {
    fromName: string;
    toName: string;
    message: string;
    theme: string;
  }>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  /* draft tersimpan otomatis (localStorage) — pulih saat balik ke halaman */
  useEffect(() => {
    try {
      const raw = lsGet(LS_KEYS.draftConfess); // fallback otomatis ke draft era Sayangin
      if (!raw) return;
      const d = JSON.parse(raw) as Record<string, unknown>;
      if (typeof d.fromName === "string") setFromName(d.fromName);
      if (typeof d.toName === "string") setToName(d.toName);
      if (typeof d.message === "string") setMessage(d.message);
      if (typeof d.theme === "string" && CONFESS_THEMES[d.theme]) setTheme(d.theme);
    } catch {
      /* localStorage mungkin diblokir */
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      lsSet(
        LS_KEYS.draftConfess,
        JSON.stringify({ fromName, toName, message, theme })
      );
    }, 400);
    return () => clearTimeout(t);
  }, [fromName, toName, message, theme]);

  const clearDraft = () => {
    lsSet(
      LS_KEYS.draftConfess,
      JSON.stringify({ fromName: "", toName: "", message: "", theme: "rose" })
    );
  };

  const submit = async () => {
    setError("");
    if (toName.trim().length < 1) {
      setError("Isi dulu nama dia, ya.");
      return;
    }
    if (message.trim().length < 5) {
      setError("Pesanmu kependekan — minimal 5 karakter.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetchWithTimeout(
        "/api/confess",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromName: fromName.trim(),
            toName: toName.trim(),
            message: message.trim(),
            theme,
            isPublic: showOnWall,
            unlockAt: unlockDateFor(unlockPreset),
          }),
        },
        20_000
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal membuat confess");
      setLink(`${window.location.origin}/?k=${data.slug}`);
      setStatusUrl(`${window.location.origin}/?s=${data.senderKey}`);
      setScheduled(!!unlockDateFor(unlockPreset));
      clearDraft();
      // simpan ke daftar pribadi (localStorage) biar bisa dipantau lagi kapan pun
      try {
        const saved = JSON.parse(lsGet(LS_KEYS.confessions) ?? "[]") as Array<Record<string, string>>;
        saved.unshift({
          slug: data.slug,
          senderKey: data.senderKey,
          toName: toName.trim(),
          theme,
          type: "confess",
          createdAt: new Date().toISOString(),
        });
        lsSet(LS_KEYS.confessions, JSON.stringify(saved.slice(0, 20)));
      } catch {
        /* localStorage mungkin diblokir — status tetap bisa diakses via link */
      }
      setTimeout(
        () => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
        120
      );
    } catch (e) {
      setError(
        isTimeoutError(e)
          ? FETCH_TIMEOUT_MESSAGE
          : e instanceof Error
            ? e.message
            : "Terjadi kesalahan. Coba lagi."
      );
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* diabaikan */
    }
  };

  const shareWA = () => {
    const text = encodeURIComponent(
      `Pssst... ada surat rahasia buat kamu. Buka di sini ya: ${link}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  // Web Share API: di HP munculkan share sheet native (WA/IG/TikTok/terserah)
  const shareNative = async () => {
    const text = "Pssst... ada surat rahasia buat kamu 🤫";
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Kangenin", text, url: link });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${link}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user batal — diabaikan */
    }
  };

  // Flex ke X: CTA ala "aku berani, kamu kapan?" — link rahasia TIDAK ikut
  const shareX = () => {
    const text = encodeURIComponent(
      `Aku baru berani ngirim surat rahasia lewat Kangenin 💌 Kamu kapan?`
    );
    window.open(
      `https://twitter.com/intent/tweet?text=${text}`,
      "_blank",
      "noopener"
    );
  };

  return (
    <section id="confess" className="relative py-20 sm:py-28">
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          {/* kiri: copy + form */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6 }}
            >
              <p className="kicker">Fitur utama — gratis</p>
              <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
                Yang malu bilang langsung,{" "}
                <em className="text-primary">tulis di sini.</em>
              </h2>
              <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
                Isi form ini, dapat link, kirim ke dia. Dia membuka suratmu
                lewat seremoni segel detak jantung — hatinya ditahan, retak,
                lalu suratmu muncul baris demi baris — dan memilih jawabannya.
                Namamu{" "}
                <b className="text-foreground">baru muncul kalau dia menjawab &ldquo;iya&rdquo;</b> —
                kalau tidak, kamu tetap anonim.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-8 rounded-lg border border-border bg-card p-6 sm:p-7"
            >
              {!link ? (
                <div className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="fromName" className="text-foreground">
                        Nama kamu{" "}
                        <span className="font-normal text-muted-foreground">
                          (kosongin = anonim)
                        </span>
                      </Label>
                      <Input
                        id="fromName"
                        placeholder="misal: Raka"
                        value={fromName}
                        onChange={(e) => setFromName(e.target.value)}
                        maxLength={40}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="toName" className="text-foreground">
                        Nama dia <span className="text-primary">*</span>
                      </Label>
                      <Input
                        id="toName"
                        placeholder="misal: Nadia"
                        value={toName}
                        onChange={(e) => setToName(e.target.value)}
                        maxLength={40}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-foreground">
                      Pesan confess kamu <span className="text-primary">*</span>
                    </Label>
                    <Textarea
                      id="message"
                      placeholder="Contoh: Aku udah perhatiin kamu dari semester 1. Setiap ketawa kamu tuh bikin hariku baik-baik aja. Boleh nggak kita kenalan lebih?"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={600}
                      rows={4}
                      className="resize-none"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {/* draft otomatis via AI (OrcaRouter) — hasil tetap bisa diedit */}
                      <AiAssistButton
                        toName={toName}
                        fromName={fromName}
                        jenis="confess"
                        onDraft={(draft) => setMessage(draft)}
                        blockedReason={
                          toName.trim().length === 0
                            ? "Isi nama dia dulu biar AI tahu buat siapa ✍️"
                            : null
                        }
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-primary/40 bg-background px-3 text-xs font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <p className="text-right text-xs text-muted-foreground">
                        {message.length}/600 · draft tersimpan otomatis di
                        perangkatmu
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-foreground">
                      Tema suratnya{" "}
                      <span className="font-normal text-muted-foreground">
                        (ada yang cuma muncul beberapa hari 👀)
                      </span>
                    </Label>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      {Object.entries(CONFESS_THEMES).map(([key, t]) => {
                        // hitung sisa hari edisi terbatas — makin makin mepet, makin panas
                        const daysLeft = t.limited
                          ? Math.ceil(
                              (new Date(t.limited.until).getTime() - Date.now()) /
                                86_400_000
                            )
                          : null;
                        const expired = daysLeft !== null && daysLeft <= 0;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setTheme(key)}
                            aria-label={`Tema ${t.name} — ${THEME_TAGS[key]}${t.limited ? ` (${t.limited.label})` : ""}`}
                            aria-pressed={theme === key}
                            disabled={expired}
                            className={`relative rounded-lg border p-3 text-left transition ${
                              theme === key
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-input"
                            } ${expired ? "hidden" : ""}`}
                          >
                            {t.limited && daysLeft !== null && (
                              <span className="absolute -top-2 right-2 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
                                {t.limited.label} · {daysLeft} hari lagi
                              </span>
                            )}
                            <span
                              className={`mb-2 block h-9 w-full rounded-md bg-gradient-to-br ${t.bg} shadow-inner ring-1 ring-black/20`}
                              aria-hidden
                            />
                            <span className="block text-xs font-bold text-foreground">
                              {t.name}
                            </span>
                            <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                              {THEME_TAGS[key]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* jadwal buka — bikin penerima balik lagi (FOMO + antisipasi) */}
                  <div className="space-y-2">
                    <Label htmlFor="unlock" className="text-foreground">
                      Jadwal buka{" "}
                      <span className="font-normal text-muted-foreground">
                        — opsional, rahasia sampai waktunya
                      </span>
                    </Label>
                    <select
                      id="unlock"
                      value={unlockPreset}
                      onChange={(e) => setUnlockPreset(e.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      {UNLOCK_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* opt-in dinding publik — mesin viral, isi surat TETAP rahasia */}
                  <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-secondary/40 p-3.5 transition hover:bg-secondary">
                    <input
                      type="checkbox"
                      checked={showOnWall}
                      onChange={(e) => setShowOnWall(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-primary"
                    />
                    <span className="text-xs leading-relaxed text-foreground">
                      <b>Tampilkan di Dinding Kangenin</b> — namamu &amp; tema
                      suratnya ikut pajangan publik biar orang lain ikut
                      berani. Isi surat <b>100% tetap rahasia</b>, kok.
                    </span>
                  </label>

                  {error && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {error}
                    </p>
                  )}

                  <Button
                    onClick={submit}
                    disabled={loading}
                    className="w-full rounded-md bg-primary py-3.5 text-sm font-bold text-white hover:bg-[#b52743]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Bikin
                        suratnya...
                      </>
                    ) : (
                      <>Buat link confess</>
                    )}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Tanpa daftar akun, tanpa install — link-nya langsung
                    aktif dan siap dikirim.
                  </p>
                </div>
              ) : (
                <div ref={resultRef} className="space-y-4 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Check className="h-5 w-5 text-primary" strokeWidth={3} />
                  </div>
                  <h3 className="font-display text-xl font-bold text-foreground">
                    {scheduled
                      ? "Suratmu terjadwal — dia cuma bisa nunggu 👀"
                      : "Suratmu siap dikirim."}
                  </h3>
                  {scheduled && (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Sampai waktunya, dia cuma melihat hitungan mundur dan
                      pengirimnya rahasia. Antisipasinya bikin deg-degan —
                      itu gunanya.
                    </p>
                  )}
                  <div className="flex items-center gap-2 rounded-md border border-border bg-background p-3 text-left">
                    <span className="flex-1 truncate text-sm font-medium text-foreground">
                      {link}
                    </span>
                    <Button
                      size="sm"
                      onClick={copy}
                      className="shrink-0 rounded-md bg-foreground text-background hover:bg-foreground/85"
                    >
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={() =>
                        setPreviewData({
                          fromName,
                          toName,
                          message,
                          theme,
                        })
                      }
                      variant="outline"
                      className="rounded-md border-border text-foreground hover:bg-secondary"
                    >
                      <Eye className="mr-2 h-4 w-4" /> Pratinjau
                    </Button>
                    <Button
                      onClick={shareWA}
                      className="rounded-md bg-[#1faa59] text-white hover:bg-[#189249]"
                    >
                      <Share2 className="mr-2 h-4 w-4" /> Kirim via WA
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={shareNative}
                      variant="outline"
                      className="rounded-md border-border text-foreground hover:bg-secondary"
                    >
                      <Share2 className="mr-2 h-4 w-4" /> Bagikan
                    </Button>
                    <Button
                      onClick={shareX}
                      variant="outline"
                      className="rounded-md border-border text-foreground hover:bg-secondary"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="mr-2 h-4 w-4 fill-current"
                        aria-hidden
                      >
                        <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93Zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.41Z" />
                      </svg>
                      Post ke X
                    </Button>
                  </div>
                  <a
                    href={statusUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 rounded-md border border-border bg-secondary py-3 text-sm font-bold text-foreground transition-colors hover:bg-accent"
                  >
                    <Eye className="h-4 w-4" /> Pantau status: udah dibuka belum?
                  </a>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Halaman status itu cuma buat kamu — dia tidak tahu.
                    Simpan linknya; di sana kelihatan sudah dibuka belum dan
                    apa jawabannya (update otomatis).
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Tip: kirim pas dia lagi santai — malam hari paling aman.
                    Yang dia lihat persis seperti pratinjau di atas.
                  </p>
                  <a
                    href="/create"
                    className="text-xs font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                  >
                    mau versi sinematiknya? bikin Kado Confess — segel detak
                    jantung — di Creator Studio →
                  </a>
                  <a
                    href="/kado/demo-confess?pratinjau=1"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                  >
                    atau cobain dulu seremoninya: Coba Demo Kado Confess 👁
                  </a>
                  <button
                    onClick={() => {
                      setLink("");
                      setStatusUrl("");
                      setMessage("");
                      setFromName("");
                      setToName("");
                    }}
                    className="text-xs font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                  >
                    buat confess lagi untuk orang lain
                  </button>
                </div>
              )}
            </motion.div>
          </div>

          {/* kanan: HP demo */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="relative"
          >
            <PhoneDemo />
            <div className="mt-6 flex flex-col items-center gap-2 text-sm text-muted-foreground">
              <span>
                Ini simulasi yang diterima dia — coba sendiri lewat form di
                sebelah.
              </span>
              <button
                type="button"
                onClick={() =>
                  setPreviewData({
                    fromName: "",
                    toName: "Kamu",
                    message: DEMO_MSG,
                    theme: "rose",
                  })
                }
                className="text-xs font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
              >
                atau buka contoh suratnya fullscreen
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* pratinjau fullscreen */}
      {previewData && (
        <ConfessionView
          preview={previewData}
          onClose={() => setPreviewData(null)}
        />
      )}
    </section>
  );
}
