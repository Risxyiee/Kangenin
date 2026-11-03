"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Check,
  ChevronDown,
  Copy,
  Eye,
  Loader2,
  Lock,
  LockOpen,
  MailOpen,
  BookOpenCheck,
  Share2,
} from "lucide-react";
import { CONFESS_THEMES } from "@/components/confess/ConfessionView";
import { LS_KEYS, lsGet, lsSet } from "@/lib/local-store";
import { FETCH_TIMEOUT_MESSAGE, fetchWithTimeout, isTimeoutError } from "@/lib/fetch-timeout";

type DraftLetter = { title: string; body: string; unlockDays: number };

/* ---------- preset template surat ---------- */
const PRESETS: Record<string, { label: string; letters: DraftLetter[] }> = {
  romantis: {
    label: "Romantis",
    letters: [
      {
        title: "Open When kamu kangen aku",
        unlockDays: 0,
        body: "Iya, aku juga lagi kangen kamu. Aneh ya, rasanya kayak ada yang kurang pas kamu nggak ada. Tarik napas pelan-pelan — kamu kangen, aku juga. Kita sama-sama kuat sampai ketemu lagi.",
      },
      {
        title: "Open When kamu lagi sedih",
        unlockDays: 7,
        body: "Kamu lagi sedih ya? Nggak apa-apa, nangis aja dulu kalau perlu. Kamu udah hebat banget bisa bertahan sejauh ini. Ingat ya: hari yang buruk bukan berarti hidup yang buruk. Aku di sini, selalu.",
      },
      {
        title: "Open When kamu capek banget",
        unlockDays: 14,
        body: "Tarik napas dulu. Kamu udah ngelakuin banyak hal hari ini, dan itu luar biasa. Rehat sebentar — dunia nggak kemana-mana kok. Kalau udah kuat lagi, aku yakin kamu bisa. Aku bangga sama kamu.",
      },
      {
        title: "Open When kamu kangen suara aku",
        unlockDays: 21,
        body: "Coba buka foto kita yang paling kamu suka. Terasa kan? Nanti malam teleponan lama-lama ya, aku pengen dengar cerita kamu semuanya — sampai ketawa-ketawa nggak jelas lagi.",
      },
      {
        title: "Open When kamu mau tidur",
        unlockDays: 28,
        body: "Sebelum tidur, satu hal dulu: kamu berarti banget buat aku. Mimpi indah ya, jangan lupa selimutnya. Besok kita mulai hari baru lagi — pelan-pelan aja. Good night, sayang.",
      },
    ],
  },
  supportif: {
    label: "Supportif",
    letters: [
      {
        title: "Open When kamu butuh semangat",
        unlockDays: 0,
        body: "Hei, tarik napas dulu. Kamu udah sejauh ini, dan itu bukan hal kecil. Hari ini cuma butuh versi kamu yang 'cukup', bukan yang sempurna. Kamu lebih kuat dari yang kamu kira. Gas terus, pelan-pelan.",
      },
      {
        title: "Open When kamu ragu sama diri sendiri",
        unlockDays: 7,
        body: "Ragu itu tandanya kamu peduli sama hasilnya, bukan tandanya kamu nggak mampu. Ingat waktu kamu berhasil melewati hal yang dulu kelihatannya mustahil? Kamu udah buktiin sekali, bisa lagi.",
      },
      {
        title: "Open When kamu merasa nggak cukup baik",
        unlockDays: 14,
        body: "Kalau kamu bisa dilihat pakai mataku, kamu bakal lihat orang yang selalu usaha, pernah bikin orang lain senyum, dan terus belajar. 'Cukup baik' itu mitos — kamu udah lebih dari cukup.",
      },
      {
        title: "Open When kamu pengen menyerah",
        unlockDays: 21,
        body: "Boleh istirahat, tapi jangan menyerah ya. Bedanya cuma satu langkah kecil, tapi hasilnya jauh banget. Tarik napas, hitung sampai sepuluh, terus satu langkah kecil lagi. Aku percaya kamu bisa.",
      },
      {
        title: "Open When kamu lupa seberapa hebat kamu",
        unlockDays: 28,
        body: "Bikin daftar 3 hal yang kamu raih bulan ini — walau kecil. Nggak kehitung kan? Itu bukti kamu terus gerak maju. Simpen surat ini buat dibaca lagi kapan pun kamu lupa. Kamu hebat, beneran.",
      },
    ],
  },
};

/* ---------- demo HP: grid amplop ---------- */
function LettersPhoneDemo() {
  return (
    <div className="relative mx-auto w-[290px] rounded-[2.4rem] border-[10px] border-neutral-800 bg-neutral-800 shadow-xl sm:w-[310px]">
      <div className="absolute left-1/2 top-0 z-30 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-neutral-800" />
      <div className="relative h-[480px] overflow-hidden rounded-[1.7rem] bg-[#faf8f3]">
        <div className="relative z-10 flex h-full flex-col px-4 py-6">
          <p className="text-center font-hand text-2xl text-primary">Buat kamu</p>
          <p className="mt-0.5 text-center text-[11px] text-muted-foreground">
            1 dari 5 surat sudah kamu baca
          </p>
          <div className="mx-auto mt-3 h-1.5 w-40 overflow-hidden rounded-full bg-neutral-200">
            <div className="h-full w-1/5 rounded-full bg-primary" />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5">
            {/* sudah dibaca */}
            <div className="relative rounded-lg border border-border bg-card p-3 text-center">
              <span className="absolute -right-1 -top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#1faa59] p-0.5 text-white">
                <BookOpenCheck className="h-2.5 w-2.5" />
              </span>
              <div className="relative mx-auto h-11 w-16">
                <div className="absolute inset-0 rounded bg-[#f3ece2]" />
                <div
                  className="absolute inset-0 rounded bg-[#ece2d4]"
                  style={{ clipPath: "polygon(0 18%, 50% 62%, 100% 18%, 100% 100%, 0 100%)" }}
                />
              </div>
              <p className="mt-1.5 font-hand text-[11px] leading-3 text-neutral-600">
                Open When kangen
              </p>
              <p className="mt-0.5 text-[8px] text-muted-foreground">sudah dibaca</p>
            </div>
            {/* baru terbuka */}
            <div className="relative rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
              <span className="absolute -right-1 -top-1 rounded-sm bg-primary px-1.5 py-0.5 text-[7.5px] font-bold uppercase tracking-wide text-white">
                Baru
              </span>
              <div className="relative mx-auto h-11 w-16 anim-float">
                <div className="absolute inset-0 rounded bg-white shadow-sm ring-1 ring-black/5" />
                <div
                  className="absolute inset-0 rounded bg-[#f3ece2]"
                  style={{ clipPath: "polygon(0 18%, 50% 62%, 100% 18%, 100% 100%, 0 100%)" }}
                />
                <div
                  className="absolute left-0 top-0 h-[58%] w-full rounded-t bg-[#ece2d4]"
                  style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)" }}
                />
                <div className="absolute left-1/2 top-1/2 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary">
                  <span className="text-[7px] text-white">♥</span>
                </div>
              </div>
              <p className="mt-1.5 font-hand text-[11px] leading-3 text-neutral-700">
                Open When sedih
              </p>
              <p className="mt-0.5 text-[8px] text-primary">tap buka sekarang</p>
            </div>
            {/* terkunci */}
            {[
              { label: "Open When capek", t: "bisa dibuka 6 hari lagi", d: "0s" },
              { label: "Open When kangen suara", t: "bisa dibuka 13 hari lagi", d: "0.6s" },
              { label: "Open When mau tidur", t: "bisa dibuka 20 hari lagi", d: "1.1s" },
            ].map((l, i) => (
              <div
                key={i}
                className={`relative rounded-lg border border-border bg-card/60 p-3 text-center ${
                  i === 2 ? "col-span-2" : ""
                }`}
                style={{ animation: `float-y ${5 + i}s ease-in-out ${l.d} infinite` }}
              >
                <div className="relative mx-auto h-11 w-16">
                  <div className="absolute inset-0 rounded bg-neutral-100" />
                  <div
                    className="absolute inset-0 rounded bg-neutral-200/70"
                    style={{ clipPath: "polygon(0 18%, 50% 62%, 100% 18%, 100% 100%, 0 100%)" }}
                  />
                  <div className="absolute left-1/2 top-1/2 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-300">
                    <Lock className="h-2 w-2 text-neutral-600" />
                  </div>
                </div>
                <p className="mt-1.5 font-hand text-[11px] leading-3 text-muted-foreground">{l.label}</p>
                <p className="mt-0.5 text-[8px] text-muted-foreground/70">{l.t}</p>
              </div>
            ))}
          </div>

          <div className="mt-auto flex items-center justify-center gap-1.5 text-[9px] text-muted-foreground">
            <LockOpen className="h-2.5 w-2.5" /> satu surat terbuka tiap minggu
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- section utama ---------- */
export default function OpenWhenSection() {
  const [preset, setPreset] = useState<keyof typeof PRESETS>("romantis");
  const [fromName, setFromName] = useState("");
  const [toName, setToName] = useState("");
  const [theme, setTheme] = useState("rose");
  const [letters, setLetters] = useState<DraftLetter[]>(PRESETS.romantis.letters);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [statusUrl, setStatusUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const applyPreset = (key: keyof typeof PRESETS) => {
    setPreset(key);
    setLetters(PRESETS[key].letters);
    setOpenIdx(null);
  };

  const editLetter = (idx: number, patch: Partial<DraftLetter>) => {
    setLetters((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const submit = async () => {
    setError("");
    if (toName.trim().length < 1) {
      setError("Isi dulu nama dia, ya.");
      return;
    }
    const bad = letters.findIndex((l) => l.title.trim().length < 2 || l.body.trim().length < 5);
    if (bad !== -1) {
      setError(`Surat #${bad + 1} belum lengkap — cek judul & isinya ya.`);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchWithTimeout(
        "/api/letters",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromName: fromName.trim(),
            toName: toName.trim(),
            theme,
            letters: letters.map((l) => ({
              title: l.title.trim(),
              body: l.body.trim(),
              unlockDays: l.unlockDays,
            })),
          }),
        },
        20_000
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal membuat surat");
      setLink(`${window.location.origin}/?k=${data.slug}`);
      // pratinjau tanpa mengubah statistik status pengirim
      setPreviewUrl(
        `${window.location.origin}/?k=${data.slug}&p=${data.senderKey}`
      );
      setStatusUrl(`${window.location.origin}/?s=${data.senderKey}`);
      // simpan ke daftar pribadi (sama dgn confess) biar bisa dipantau lagi
      try {
        const saved = JSON.parse(
          lsGet(LS_KEYS.confessions) ?? "[]"
        ) as Array<Record<string, string>>;
        saved.unshift({
          slug: data.slug,
          senderKey: data.senderKey,
          toName: toName.trim(),
          theme,
          type: "letters",
          createdAt: new Date().toISOString(),
        });
        lsSet(LS_KEYS.confessions, JSON.stringify(saved.slice(0, 20)));
      } catch {
        /* localStorage mungkin diblokir */
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
      `Aku bikinin ${letters.length} surat kecil buat kamu. Satu boleh dibuka tiap minggu — pelan-pelan aja bacanya ya: ${link}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <section id="openwhen" className="relative py-20 sm:py-28">
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
              <p className="kicker">Favorit couple LDR — gratis</p>
              <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
                Lima surat kecil,{" "}
                <em className="text-primary">dibuka tiap minggu.</em>
              </h2>
              <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
                Kamu tulis sekali, dia buka pelan-pelan selama sebulan. Surat
                pertama langsung terbuka, sisanya terbuka satu per minggu —
                biar dia balik lagi, lagi, dan lagi.
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
                  {/* preset */}
                  <div className="space-y-2">
                    <Label className="text-foreground">Mau buat siapa?</Label>
                    <div className="flex gap-2.5">
                      {Object.entries(PRESETS).map(([key, p]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => applyPreset(key as keyof typeof PRESETS)}
                          aria-pressed={preset === key}
                          className={`rounded-md border px-4 py-2 text-xs font-semibold transition ${
                            preset === key
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-muted-foreground hover:border-input"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Isi suratnya sudah disiapkan — tinggal edit kalau mau.
                    </p>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="ow-from" className="text-foreground">
                        Nama kamu{" "}
                        <span className="font-normal text-muted-foreground">
                          (kosongin = rahasia)
                        </span>
                      </Label>
                      <Input
                        id="ow-from"
                        placeholder="misal: Raka"
                        value={fromName}
                        onChange={(e) => setFromName(e.target.value)}
                        maxLength={40}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ow-to" className="text-foreground">
                        Nama dia <span className="text-primary">*</span>
                      </Label>
                      <Input
                        id="ow-to"
                        placeholder="misal: Nadia"
                        value={toName}
                        onChange={(e) => setToName(e.target.value)}
                        maxLength={40}
                      />
                    </div>
                  </div>

                  {/* editor surat */}
                  <div className="space-y-2">
                    <Label className="text-foreground">Isi suratnya ({letters.length} surat)</Label>
                    <div className="space-y-2">
                      {letters.map((l, i) => {
                        const open = openIdx === i;
                        return (
                          <div
                            key={i}
                            className={`overflow-hidden rounded-md border transition-colors ${
                              open ? "border-primary/40 bg-primary/[0.03]" : "border-border bg-card"
                            }`}
                          >
                            <div className="flex items-center gap-2 p-2.5">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-secondary text-xs font-bold text-foreground">
                                {i + 1}
                              </span>
                              <Input
                                value={l.title}
                                onChange={(e) => editLetter(i, { title: e.target.value })}
                                maxLength={80}
                                aria-label={`Judul surat ${i + 1}`}
                                className="h-8 border-0 bg-transparent px-1 text-sm font-semibold shadow-none focus-visible:ring-0"
                              />
                              <button
                                type="button"
                                onClick={() => setOpenIdx(open ? null : i)}
                                aria-expanded={open}
                                aria-label={`Edit isi surat ${i + 1}`}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                              >
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                                />
                              </button>
                            </div>
                            {open && (
                              <div className="px-3 pb-3">
                                <Textarea
                                  value={l.body}
                                  onChange={(e) => editLetter(i, { body: e.target.value })}
                                  maxLength={600}
                                  rows={4}
                                  aria-label={`Isi surat ${i + 1}`}
                                  className="resize-none text-sm"
                                />
                                <p className="mt-1 text-right text-[11px] text-muted-foreground">
                                  {l.body.length}/600 • terbuka{" "}
                                  {l.unlockDays === 0
                                    ? "hari ini"
                                    : `minggu ke-${l.unlockDays / 7}`}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-foreground">Tema suratnya</Label>
                    <div className="flex gap-2.5">
                      {Object.entries(CONFESS_THEMES).map(([key, t]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setTheme(key)}
                          aria-label={`Tema ${t.name}`}
                          aria-pressed={theme === key}
                          className={`flex items-center gap-2 rounded-md border px-3.5 py-2 text-xs font-semibold transition ${
                            theme === key
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-muted-foreground hover:border-input"
                          }`}
                        >
                          <span
                            className={`h-3.5 w-3.5 rounded-full ${
                              key === "rose"
                                ? "bg-[#9d1c34]"
                                : key === "sunset"
                                  ? "bg-[#b45309]"
                                  : "bg-[#292524]"
                            }`}
                          />
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>

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
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyegel suratnya...
                      </>
                    ) : (
                      <>Segel {letters.length} surat — gratis</>
                    )}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Tanpa daftar akun. Dia balik tiap minggu buka suratnya.
                  </p>
                </div>
              ) : (
                <div ref={resultRef} className="space-y-4 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Check className="h-5 w-5 text-primary" strokeWidth={3} />
                  </div>
                  <h3 className="font-display text-xl font-bold text-foreground">
                    {letters.length} suratmu sudah tersegel.
                  </h3>
                  <div className="flex items-center gap-2 rounded-md border border-border bg-background p-3 text-left">
                    <span className="flex-1 truncate text-sm font-medium text-foreground">
                      {link}
                    </span>
                    <Button
                      size="sm"
                      onClick={copy}
                      className="shrink-0 rounded-md bg-foreground text-background hover:bg-foreground/85"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      onClick={() => window.open(previewUrl, "_blank")}
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
                  <a
                    href={statusUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 rounded-md border border-border bg-secondary py-3 text-sm font-bold text-foreground transition-colors hover:bg-accent"
                  >
                    <Eye className="h-4 w-4" /> Pantau: dia udah baca surat ke berapa?
                  </a>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Waktu buka mulai berjalan pas dia tekan &ldquo;mulai&rdquo; — bukan pas
                    kamu kirim. Jadi santai, pratinjau dulu juga nggak apa-apa.
                  </p>
                  <button
                    onClick={() => {
                      setLink("");
                      setPreviewUrl("");
                      setStatusUrl("");
                    }}
                    className="text-xs font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                  >
                    buat set surat lagi untuk orang lain
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
            <LettersPhoneDemo />
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <MailOpen className="h-4 w-4" />
              Beginilah yang dilihat dia — satu terbuka tiap minggu.
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
