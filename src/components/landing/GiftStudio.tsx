"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Check,
  Copy,
  Eye,
  ImagePlus,
  Loader2,
  Plus,
  Share2,
  Trash2,
} from "lucide-react";
import { CONFESS_THEMES } from "@/components/confess/ConfessionView";
import { FLOWERS, FLOWER_IDS } from "@/lib/gift-data";
import { LS_KEYS, lsGet, lsSet } from "@/lib/local-store";
import { FETCH_TIMEOUT_MESSAGE, fetchWithTimeout, isTimeoutError } from "@/lib/fetch-timeout";

type TabKey = "bouquet" | "photobox" | "cake" | "coupons" | "playlist";

const TABS: { key: TabKey; label: string }[] = [
  { key: "bouquet", label: "Buket" },
  { key: "photobox", label: "Photobox" },
  { key: "cake", label: "Kue" },
  { key: "coupons", label: "Kupon" },
  { key: "playlist", label: "Playlist" },
];

const CAKE_OCCASIONS = [
  { key: "ultah", label: "Ulang Tahun" },
  { key: "anniversary", label: "Anniversary" },
  { key: "graduasi", label: "Wisuda" },
] as const;

const CAKE_DEFAULT_MSG: Record<string, string> = {
  ultah:
    "Selamat ulang tahun, sayang! Semoga panjang umur, sehat selalu, dan semua mimpimu satu-satu kejadian. Makasih udah lahir ke dunia — dunia jadi lebih manis ada kamu.",
  anniversary:
    "Selamat anniversary buat kita! Nggak kerasa udah sejauh ini bareng kamu. Makasih udah sabar, udah setia, udah jadi rumah. Ke depannya masih kamu terus ya.",
  graduasi:
    "YEAY selamat wisuda! Kamu berhasil, dan aku bangga banget. Dari bangku kuliah sampai dunia nyata — aku bakal tetap di barisan depan dukung kamu.",
};

const COUPON_PRESETS: Record<string, { label: string; coupons: { title: string; desc: string }[] }> = {
  manja: {
    label: "Couple manja",
    coupons: [
      { title: "1× Pelukan Gratis", desc: "berlaku kapan pun, tanpa syarat" },
      { title: "1× Nonton Pilihanmu", desc: "film apa pun, aku nggak protes" },
      { title: "1× Jajan Dibayarin", desc: "klaim lewat chat ya" },
      { title: "1× Pijat Punggung 10 Menit", desc: "sabar ya walau jariku lelah" },
    ],
  },
  servis: {
    label: "Jasa & servis",
    coupons: [
      { title: "1× Anter Ke Mana Pun", desc: "dalam batas kota wajar ya" },
      { title: "1× Masak Menu Favoritmu", desc: "bukti nyata sayang lewat perut" },
      { title: "1× Gantian Nyuci", desc: "hemat listrik, gabung aja" },
      { title: "1× Bantuin Tugas", desc: "kalau aku bisa, kalau nggak kita cari bareng" },
    ],
  },
  lucu: {
    label: "Random lucu",
    coupons: [
      { title: "1× Hak Menang Argumen", desc: "sekali aja, jangan dibiasain" },
      { title: "1× Bebas Joni Sehari", desc: "aku nggak nanya kamu dimana" },
      { title: "1× Foto Gaje Jadi Wallpaper", desc: "wajib dipakai 3 hari" },
      { title: "1× Karaoke Ditemani", desc: "Nyanyi seikhatnya, aku yang dengar" },
    ],
  },
};

/* Isian awal form playlist — lagu-lagu Indonesia yang relate buat couple */
const PLAYLIST_PRESET = {
  title: "Lagu-lagu yang bikin aku inget kamu",
  message:
    "Tiap lagu di playlist ini ada ceritanya — ada yang bikin inget first date, ada yang nemenin pas kangen. Kalau kamu kangen aku, buka playlist ini ya. Anggap aja pelukan versi suara.",
  songs: [
    { title: "Monolog", artist: "Pamungkas", note: "lagu yang diputer pas pertama anter kamu", link: "" },
    { title: "Rumah Ke Rumah", artist: "Hindia", note: "spontan mampir cuma buat lihat kamu", link: "" },
    { title: "Sial", artist: "Mahalini", note: "yang kamu nyanyiin terus sampe gatel", link: "" },
    { title: "Sekuat Hatimu", artist: "Vincentius", note: "biar kita sama-sama kuat", link: "" },
  ],
};

/* Kompres foto di browser: max 640px, JPEG q~0.72 (≤±60KB/foto) */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const maxW = 480;
      const maxH = 640;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas nggak tersedia"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("foto nggak bisa dibaca"));
    };
    img.src = url;
  });
}

export default function GiftStudio() {
  const [tab, setTab] = useState<TabKey>("bouquet");
  const [fromName, setFromName] = useState("");
  const [toName, setToName] = useState("");
  const [theme, setTheme] = useState("rose");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [statusUrl, setStatusUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  // bouquet
  const [flowers, setFlowers] = useState<string[]>(["rose", "tulip", "rose", "sunflower"]);
  const [card, setCard] = useState(
    "Ini buket yang nggak akan pernah layu, kayak perasaanku. Tiap lihat bunga, inget ya — ada yang tiap hari mikirin kamu."
  );

  // photobox
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null, null]);
  const [caption, setCaption] = useState("kita, versi paling fav");
  const [note, setNote] = useState("");

  // cake
  const [occasion, setOccasion] = useState<string>("ultah");
  const [message, setMessage] = useState(CAKE_DEFAULT_MSG.ultah);

  // coupons
  const [coupons, setCoupons] = useState<{ title: string; desc: string }[]>(
    COUPON_PRESETS.manja.coupons.map((c) => ({ ...c }))
  );

  // playlist
  const [plTitle, setPlTitle] = useState(PLAYLIST_PRESET.title);
  const [plMessage, setPlMessage] = useState(PLAYLIST_PRESET.message);
  const [songs, setSongs] = useState(PLAYLIST_PRESET.songs.map((s) => ({ ...s })));

  // tab bisa dipilih dari kartu GiftsSection via anchor #buket dst.
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.replace("#", "");
      const map: Record<string, TabKey> = {
        buket: "bouquet",
        bouquet: "bouquet",
        photobox: "photobox",
        kue: "cake",
        cake: "cake",
        kupon: "coupons",
        coupons: "coupons",
        playlist: "playlist",
      };
      if (map[h]) setTab(map[h]);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  const pickFlower = (id: string) => {
    setFlowers((f) => (f.length >= 9 ? f : [...f, id]));
  };
  const removeFlower = (idx: number) => {
    setFlowers((f) => f.filter((_, i) => i !== idx));
  };

  const setPhoto = async (idx: number, file: File | null) => {
    if (!file) {
      setPhotos((p) => p.map((v, i) => (i === idx ? null : v)));
      return;
    }
    try {
      const dataUrl = await compressImage(file);
      setPhotos((p) => p.map((v, i) => (i === idx ? dataUrl : v)));
    } catch {
      setError("Ada foto yang gagal dimuat — coba format JPG/PNG ya.");
    }
  };

  const photoCount = photos.filter(Boolean).length;

  const switchOccasion = (key: string) => {
    setOccasion(key);
    setMessage(CAKE_DEFAULT_MSG[key] ?? "");
  };

  const submit = async () => {
    setError("");
    if (toName.trim().length < 1) {
      setError("Isi dulu nama dia, ya.");
      return;
    }

    let data: unknown;
    if (tab === "bouquet") {
      if (flowers.length < 3) {
        setError("Pilih minimal 3 bunga buat buketnya, ya.");
        return;
      }
      if (card.trim().length < 5) {
        setError("Kartu ucapannya minimal 5 karakter.");
        return;
      }
      data = { card: card.trim(), flowers };
    } else if (tab === "photobox") {
      if (photoCount < 3) {
        setError("Pilih minimal 3 foto buat strip-nya, ya.");
        return;
      }
      if (caption.trim().length < 2) {
        setError("Captionnya minimal 2 karakter.");
        return;
      }
      data = { caption: caption.trim(), note: note.trim(), photos: photos.filter(Boolean) };
    } else if (tab === "cake") {
      if (message.trim().length < 5) {
        setError("Pesan di kartu kuenya minimal 5 karakter.");
        return;
      }
      data = { occasion, message: message.trim() };
    } else if (tab === "playlist") {
      if (plTitle.trim().length < 3) {
        setError("Judul playlistnya minimal 3 karakter.");
        return;
      }
      if (plMessage.trim().length < 5) {
        setError("Catatan penutupnya minimal 5 karakter.");
        return;
      }
      if (songs.length < 3) {
        setError("Minimal 3 lagu, ya.");
        return;
      }
      const badSong = songs.findIndex((s) => s.title.trim().length < 1);
      if (badSong !== -1) {
        setError(`Lagu #${badSong + 1} belum ada judulnya ya.`);
        return;
      }
      const badLink = songs.findIndex(
        (s) => s.link.trim() !== "" && !/^https?:\/\/\S+\.\S+/.test(s.link.trim())
      );
      if (badLink !== -1) {
        setError(`Link lagu #${badLink + 1} nggak valid — harus diawali https:// ya.`);
        return;
      }
      data = {
        title: plTitle.trim(),
        message: plMessage.trim(),
        songs: songs.map((s) => ({
          title: s.title.trim(),
          artist: s.artist.trim(),
          note: s.note.trim(),
          link: s.link.trim(),
        })),
      };
    } else {
      const bad = coupons.findIndex((c) => c.title.trim().length < 2);
      if (bad !== -1) {
        setError(`Kupon #${bad + 1} belum ada judulnya ya.`);
        return;
      }
      data = { coupons: coupons.map((c) => ({ title: c.title.trim(), desc: c.desc.trim() })) };
    }

    setLoading(true);
    try {
      const res = await fetchWithTimeout(
        "/api/gifts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: tab,
            fromName: fromName.trim(),
            toName: toName.trim(),
            theme,
            data,
          }),
        },
        20_000
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Gagal membuat kado");
      setLink(`${window.location.origin}/?k=${d.slug}`);
      setPreviewUrl(`${window.location.origin}/?k=${d.slug}&p=${d.senderKey}`);
      setStatusUrl(`${window.location.origin}/?s=${d.senderKey}`);

      // simpan ke daftar pribadi (localStorage) — dipakai halaman pantauan
      try {
        const saved = JSON.parse(lsGet(LS_KEYS.confessions) ?? "[]");
        saved.push({
          slug: d.slug,
          senderKey: d.senderKey,
          toName: toName.trim(),
          theme,
          type: `gift:${tab}`,
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

  const WA_TEXT: Record<TabKey, string> = {
    bouquet: "Aku ada buket bunga buat kamu. Bunganya mekar satu-satu pas kamu buka. Lihat ya:",
    photobox: "Aku bungkus foto-foto kita jadi strip photobox. Buka ya:",
    cake: "Ada kue buat kamu. Tiup lilinnya — ada pesan spesial di baliknya:",
    coupons: "Aku kasih kamu buku kupon cinta. Pakai sesuka hatimu ya:",
    playlist:
      "Aku buatin playlist buat kita. Tiap lagunya ada cerita kenangan kita. Dengerin pelan-pelan ya:",
  };

  const shareWA = () => {
    const text = encodeURIComponent(`${WA_TEXT[tab]} ${link}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const reset = () => {
    setLink("");
    setPreviewUrl("");
    setStatusUrl("");
  };

  const tabMeta = TABS.find((t) => t.key === tab)!;

  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      {/* anchor buat link dari kartu kado (#buket/#photobox/#kue/#kupon) */}
      <span id="buket" aria-hidden className="absolute -top-20" />
      <span id="photobox" aria-hidden className="absolute -top-20" />
      <span id="kue" aria-hidden className="absolute -top-20" />
      <span id="kupon" aria-hidden className="absolute -top-20" />
      <span id="playlist" aria-hidden className="absolute -top-20" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="kicker">Studio kado digital — gratis</p>
          <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
            Bikin kadonya di sini,{" "}
            <em className="text-primary">kirim sekarang.</em>
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Buket bunga yang mekar, photobox dari foto kalian, kue yang bisa
            ditiup, sampai kupon cinta anti-lecek — semuanya jadi satu link.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mx-auto mt-10 max-w-2xl rounded-lg border border-border bg-card p-6 sm:p-7"
        >
          {!link ? (
            <div className="space-y-5">
              {/* pilih tipe kado */}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    aria-pressed={tab === t.key}
                    className={`flex flex-col items-center gap-1 rounded-md border py-3 text-xs font-bold transition ${
                      tab === t.key
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-input"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="gs-from" className="text-foreground">
                    Nama kamu{" "}
                    <span className="font-normal text-muted-foreground">(kosongin = rahasia)</span>
                  </Label>
                  <Input
                    id="gs-from"
                    placeholder="misal: Raka"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                    maxLength={40}
                    className="border-input focus-visible:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gs-to" className="text-foreground">
                    Nama dia <span className="text-primary">*</span>
                  </Label>
                  <Input
                    id="gs-to"
                    placeholder="misal: Nadia"
                    value={toName}
                    onChange={(e) => setToName(e.target.value)}
                    maxLength={40}
                    className="border-input focus-visible:ring-primary"
                  />
                </div>
              </div>

              {/* ===== FORM BUKET ===== */}
              {tab === "bouquet" && (
                <>
                  <div className="space-y-2">
                    <Label className="text-foreground">Racik bunganya (tap buat nambah)</Label>
                    <div className="flex flex-wrap gap-2">
                      {FLOWER_IDS.map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => pickFlower(id)}
                          aria-label={`Tambah ${FLOWERS[id].label}`}
                          className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary hover:bg-secondary"
                        >
                          <span className="text-base">{FLOWERS[id].emoji}</span>
                          {FLOWERS[id].label} <Plus className="h-3 w-3 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                    <div className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-md border border-border bg-secondary/50 p-2">
                      {flowers.length === 0 && (
                        <span className="px-1 text-xs text-muted-foreground">buketnya masih kosong…</span>
                      )}
                      {flowers.map((f, i) => (
                        <button
                          key={`${f}-${i}`}
                          type="button"
                          onClick={() => removeFlower(i)}
                          aria-label={`Hapus bunga ${i + 1}`}
                          className="group flex items-center gap-1 rounded-sm bg-card px-2 py-1 text-sm shadow-sm ring-1 ring-border transition hover:ring-primary"
                        >
                          {FLOWERS[f as keyof typeof FLOWERS]?.emoji ?? "❀"}
                          <Trash2 className="h-3 w-3 text-muted-foreground group-hover:text-destructive" />
                        </button>
                      ))}
                      <span className="ml-auto pr-1 text-[11px] text-muted-foreground">
                        {flowers.length}/9
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gs-card" className="text-foreground">Kartu ucapannya</Label>
                    <Textarea
                      id="gs-card"
                      value={card}
                      onChange={(e) => setCard(e.target.value)}
                      maxLength={400}
                      rows={4}
                      className="resize-none text-sm focus-visible:ring-primary"
                    />
                    <p className="text-right text-[11px] text-muted-foreground">{card.length}/400</p>
                  </div>
                </>
              )}

              {/* ===== FORM PHOTOBOX ===== */}
              {tab === "photobox" && (
                <>
                  <div className="space-y-2">
                    <Label className="text-foreground">
                      Foto kalian ({photoCount}/4 — minimal 3)
                    </Label>
                    <div className="grid grid-cols-4 gap-2">
                      {photos.map((p, i) => (
                        <label
                          key={i}
                          className={`relative flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition ${
                            p
                              ? "border-primary/50"
                              : "border-input bg-secondary/50 hover:border-primary"
                          }`}
                        >
                          {p ? (
                            <>
                              <img src={p} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setPhoto(i, null);
                                }}
                                aria-label={`Hapus foto ${i + 1}`}
                                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </>
                          ) : (
                            <span className="flex flex-col items-center gap-1 text-muted-foreground">
                              <ImagePlus className="h-5 w-5" />
                              <span className="text-[10px] font-semibold">foto {i + 1}</span>
                            </span>
                          )}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="sr-only"
                            onChange={(e) => setPhoto(i, e.target.files?.[0] ?? null)}
                          />
                        </label>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Foto dikompres otomatis — privasinya aman, cuma kamu & dia yang punya linknya.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gs-caption" className="text-foreground">Caption strip</Label>
                    <Input
                      id="gs-caption"
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      maxLength={60}
                      className="border-input focus-visible:ring-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gs-note" className="text-foreground">
                      Pesan pendamping <span className="font-normal text-muted-foreground">(opsional)</span>
                    </Label>
                    <Textarea
                      id="gs-note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={300}
                      rows={3}
                      className="resize-none text-sm focus-visible:ring-primary"
                    />
                    <p className="text-right text-[11px] text-muted-foreground">{note.length}/300</p>
                  </div>
                </>
              )}

              {/* ===== FORM KUE ===== */}
              {tab === "cake" && (
                <>
                  <div className="space-y-2">
                    <Label className="text-foreground">Buat momen apa?</Label>
                    <div className="flex flex-wrap gap-2">
                      {CAKE_OCCASIONS.map((o) => (
                        <button
                          key={o.key}
                          type="button"
                          onClick={() => switchOccasion(o.key)}
                          aria-pressed={occasion === o.key}
                          className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                            occasion === o.key
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-muted-foreground hover:border-input"
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gs-msg" className="text-foreground">
                      Pesan yang muncul setelah lilin ditiup
                    </Label>
                    <Textarea
                      id="gs-msg"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={300}
                      rows={4}
                      className="resize-none text-sm focus-visible:ring-primary"
                    />
                    <p className="text-right text-[11px] text-muted-foreground">{message.length}/300</p>
                  </div>
                </>
              )}

              {/* ===== FORM KUPON ===== */}
              {tab === "coupons" && (
                <>
                  <div className="space-y-2">
                    <Label className="text-foreground">Isi dari template (bisa diedit)</Label>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(COUPON_PRESETS).map(([key, p]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setCoupons(p.coupons.map((c) => ({ ...c })))}
                          className="rounded-md border border-input px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary hover:bg-secondary"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">
                      Kuponnnya ({coupons.length}/6 — minimal 3)
                    </Label>
                    <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                      {coupons.map((c, i) => (
                        <div
                          key={i}
                          className="rounded-md border border-border bg-secondary/40 p-2.5"
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                              {i + 1}
                            </span>
                            <Input
                              value={c.title}
                              onChange={(e) =>
                                setCoupons((cs) =>
                                  cs.map((v, j) => (j === i ? { ...v, title: e.target.value } : v))
                                )
                              }
                              maxLength={40}
                              aria-label={`Judul kupon ${i + 1}`}
                              className="h-8 border-0 bg-transparent px-1 text-sm font-semibold shadow-none focus-visible:ring-0"
                            />
                            {coupons.length > 3 && (
                              <button
                                type="button"
                                onClick={() => setCoupons((cs) => cs.filter((_, j) => j !== i))}
                                aria-label={`Hapus kupon ${i + 1}`}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          <Input
                            value={c.desc}
                            onChange={(e) =>
                              setCoupons((cs) =>
                                cs.map((v, j) => (j === i ? { ...v, desc: e.target.value } : v))
                              )
                            }
                            maxLength={80}
                            placeholder="ketentuan kecil (opsional)"
                            aria-label={`Ketentuan kupon ${i + 1}`}
                            className="mt-1 h-7 border-0 bg-transparent px-1 text-xs text-foreground/60 shadow-none focus-visible:ring-0"
                          />
                        </div>
                      ))}
                    </div>
                    {coupons.length < 6 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCoupons((cs) => [...cs, { title: "", desc: "" }])}
                        className="rounded-md border-border text-foreground hover:bg-secondary"
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Tambah kupon
                      </Button>
                    )}
                  </div>
                </>
              )}

              {/* ===== FORM PLAYLIST ===== */}
              {tab === "playlist" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="gs-pltitle" className="text-foreground">
                      Judul playlistnya
                    </Label>
                    <Input
                      id="gs-pltitle"
                      value={plTitle}
                      onChange={(e) => setPlTitle(e.target.value)}
                      maxLength={60}
                      className="border-input focus-visible:ring-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">
                      Lagunya ({songs.length}/15 — minimal 3)
                    </Label>
                    <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                      {songs.map((s, i) => (
                        <div
                          key={i}
                          className="rounded-md border border-border bg-secondary/40 p-2.5"
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                              {i + 1}
                            </span>
                            <Input
                              value={s.title}
                              onChange={(e) =>
                                setSongs((ss) =>
                                  ss.map((v, j) => (j === i ? { ...v, title: e.target.value } : v))
                                )
                              }
                              maxLength={80}
                              placeholder="judul lagu"
                              aria-label={`Judul lagu ${i + 1}`}
                              className="h-8 border-0 bg-transparent px-1 text-sm font-semibold shadow-none focus-visible:ring-0"
                            />
                            {songs.length > 3 && (
                              <button
                                type="button"
                                onClick={() => setSongs((ss) => ss.filter((_, j) => j !== i))}
                                aria-label={`Hapus lagu ${i + 1}`}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          <div className="mt-1 grid grid-cols-2 gap-2">
                            <Input
                              value={s.artist}
                              onChange={(e) =>
                                setSongs((ss) =>
                                  ss.map((v, j) => (j === i ? { ...v, artist: e.target.value } : v))
                                )
                              }
                              maxLength={60}
                              placeholder="penyanyi"
                              aria-label={`Penyanyi lagu ${i + 1}`}
                              className="h-7 border-0 bg-transparent px-1 text-xs text-foreground/70 shadow-none focus-visible:ring-0"
                            />
                            <Input
                              value={s.link}
                              onChange={(e) =>
                                setSongs((ss) =>
                                  ss.map((v, j) => (j === i ? { ...v, link: e.target.value } : v))
                                )
                              }
                              maxLength={300}
                              placeholder="link YouTube/Spotify (opsional)"
                              aria-label={`Link lagu ${i + 1}`}
                              className="h-7 border-0 bg-transparent px-1 text-xs text-foreground/70 shadow-none focus-visible:ring-0"
                            />
                          </div>
                          <Input
                            value={s.note}
                            onChange={(e) =>
                              setSongs((ss) =>
                                ss.map((v, j) => (j === i ? { ...v, note: e.target.value } : v))
                              )
                            }
                            maxLength={120}
                            placeholder="catatan kenangan (opsional) — mis. “lagu first date”"
                            aria-label={`Catatan lagu ${i + 1}`}
                            className="mt-1 h-7 border-0 bg-transparent px-1 text-xs italic text-foreground/70 shadow-none focus-visible:ring-0"
                          />
                        </div>
                      ))}
                    </div>
                    {songs.length < 15 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setSongs((ss) => [...ss, { title: "", artist: "", note: "", link: "" }])
                        }
                        className="rounded-md border-border text-foreground hover:bg-secondary"
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Tambah lagu
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gs-plmsg" className="text-foreground">
                      Catatan penutup buat dia
                    </Label>
                    <Textarea
                      id="gs-plmsg"
                      value={plMessage}
                      onChange={(e) => setPlMessage(e.target.value)}
                      maxLength={400}
                      rows={4}
                      className="resize-none text-sm focus-visible:ring-primary"
                    />
                    <p className="text-right text-[11px] text-muted-foreground">
                      {plMessage.length}/400
                    </p>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Kosongin link? Nanti lagunya dibuka lewat pencarian YouTube otomatis —
                    tetap gratis, tanpa API. 🎧
                  </p>
                </>
              )}

              {/* tema */}
              <div className="space-y-2">
                <Label className="text-foreground">Tema halamannya</Label>
                <div className="flex gap-3">
                  {Object.entries(CONFESS_THEMES).map(([key, t]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTheme(key)}
                      aria-label={`Tema ${t.name}`}
                      aria-pressed={theme === key}
                      className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${
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
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
              )}

              <Button
                onClick={submit}
                disabled={loading}
                className="w-full rounded-md bg-primary py-3.5 text-sm font-bold text-white hover:bg-[#b52743]"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Membungkus kadonya...
                  </>
                ) : (
                  <>Siapkan {tabMeta.label} — gratis</>
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Tanpa akun, tanpa biaya. Link-nya aktif selamanya.
              </p>
            </div>
          ) : (
            <div ref={resultRef} className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Check className="h-5 w-5 text-primary" strokeWidth={3} />
              </div>
              <h3 className="font-display text-xl font-bold text-foreground">
                {tabMeta.label} kamu siap dikirim.
              </h3>
              <div className="flex items-center gap-2 rounded-md border border-border bg-background p-3 text-left">
                <span className="flex-1 truncate text-sm font-medium text-foreground">{link}</span>
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
                <Eye className="h-4 w-4" /> Pantau: udah dibuka berapa kali?
              </a>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Pratinjau dulu juga nggak apa-apa — hitungannya nggak jalan sampai
                kamu bagi link aslinya.
              </p>
              <button
                onClick={reset}
                className="text-xs font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
              >
                buat kado lagi untuk orang lain
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
