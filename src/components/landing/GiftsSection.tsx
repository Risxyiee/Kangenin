"use client";

import { useState } from "react";
import { motion } from "framer-motion";

/* ============ 1. BUKET DIGITAL: bunga mekar ============ */
function BuketAnim() {
  const flowers = [
    { left: "18%", delay: "0.9s", color: "#9d1c34" },
    { left: "46%", delay: "1.4s", color: "#b52743" },
    { left: "72%", delay: "1.9s", color: "#7e1428" },
  ];
  return (
    <div className="relative h-full w-full">
      {/* kertas bungkus */}
      <div
        className="absolute bottom-2 left-1/2 h-36 w-40 -translate-x-1/2 bg-[#e9dfd1]"
        style={{ clipPath: "polygon(0 12%, 100% 0, 88% 100%, 12% 100%)" }}
      />
      <div
        className="absolute bottom-2 left-1/2 h-36 w-40 -translate-x-1/2 bg-white/50"
        style={{ clipPath: "polygon(0 12%, 50% 0, 50% 100%, 12% 100%)" }}
      />
      {/* pita */}
      <div className="absolute bottom-9 left-1/2 z-10 h-3.5 w-20 -translate-x-1/2 rounded-full bg-primary" />
      <div className="absolute bottom-11 left-1/2 z-10 -translate-x-1/2">
        <div className="relative h-4 w-4 rotate-45 rounded-sm bg-[#7e1428]" />
      </div>
      {/* batang */}
      {flowers.map((f, i) => (
        <div
          key={i}
          className="absolute bottom-12 h-24 w-1 origin-bottom rounded bg-[#4d7c43]"
          style={{
            left: `calc(${f.left} + 8px)`,
            animation: `grow-stem 5s ease-out ${f.delay} infinite`,
          }}
        />
      ))}
      {/* kepala bunga mekar */}
      {flowers.map((f, i) => (
        <div
          key={`h${i}`}
          className="absolute bottom-32 z-10"
          style={{
            left: f.left,
            animation: `bloom-flower 5s ease-out ${f.delay} infinite`,
          }}
        >
          <div className="relative h-8 w-8">
            <span className="absolute inset-x-0 top-0 mx-auto h-4 w-4 rounded-full" style={{ background: f.color }} />
            <span className="absolute bottom-0 left-0 h-4 w-4 rounded-full" style={{ background: f.color }} />
            <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full" style={{ background: f.color }} />
            <span className="absolute bottom-1 left-1/2 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-[#d9a441]" />
          </div>
        </div>
      ))}
      {/* kelip */}
      {[
        { l: "10%", t: "18%", d: "2.6s" },
        { l: "86%", t: "24%", d: "3.4s" },
        { l: "60%", t: "10%", d: "4.1s" },
      ].map((s, i) => (
        <span
          key={`s${i}`}
          className="absolute h-1.5 w-1.5 rounded-full bg-primary/50"
          style={{ left: s.l, top: s.t, animation: `sparkle-pop 5s ease ${s.d} infinite` }}
        />
      ))}
    </div>
  );
}

/* ============ 2. OPEN WHEN LETTERS ============ */
function OpenWhenAnim() {
  const letters = [
    { label: "Open when you miss me", rot: "-8deg", x: "6%", z: 10, delay: "0s" },
    { label: "Open when you can't sleep", rot: "3deg", x: "22%", z: 20, delay: "0.4s" },
    { label: "Open on our 1st date", rot: "-2deg", x: "38%", z: 30, delay: "0.8s" },
  ];
  return (
    <div className="relative h-full w-full">
      <span className="absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap font-hand text-xl text-primary">
        buat hari-hari beratmu
      </span>
      {letters.map((l, i) => (
        <div
          key={i}
          className="absolute bottom-10 h-24 w-40 rounded-md border border-border bg-white shadow-md"
          style={{
            left: l.x,
            transform: `rotate(${l.rot})`,
            zIndex: l.z,
            animation: `float-y ${4 + i}s ease-in-out ${l.delay} infinite`,
          }}
        >
          <div className="flex h-full flex-col items-center justify-center gap-1.5 px-3">
            <div className="h-1.5 w-3/4 rounded-sm bg-neutral-200" />
            <p className="text-center font-hand text-[13px] leading-4 text-neutral-700">
              {l.label}
            </p>
          </div>
          {i === 2 && (
            <div className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary shadow-sm">
              <span className="text-[10px] text-white">♥</span>
            </div>
          )}
        </div>
      ))}
      {/* segel */}
      <div className="absolute bottom-1 left-1/2 z-40 -translate-x-1/2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary shadow" style={{ animation: "seal-glow 2.2s ease-in-out infinite" }}>
          <span className="text-xs text-white">♥</span>
        </div>
      </div>
    </div>
  );
}

/* ============ 3. PHOTOBOX ============ */
function PhotoboxAnim() {
  const pics = [
    { rot: "-7deg", x: "12%", grad: "from-[#e7d3c8] via-[#f0e3d3] to-[#e3d5c2]", cap: "first date", delay: "0s" },
    { rot: "3deg", x: "34%", grad: "from-[#d8d2c5] via-[#e5dccd] to-[#d9c9bd]", cap: "capek tapi lucu", delay: "0.5s" },
    { rot: "-2deg", x: "56%", grad: "from-[#e0cfc6] via-[#d9c4bb] to-[#cbb3a9]", cap: "senyummu", delay: "1s" },
  ];
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-x-6 bottom-8 top-6 rounded-lg bg-neutral-900 shadow-lg" />
      {pics.map((p, i) => (
        <div
          key={i}
          className="absolute bottom-14 w-24 rounded-sm bg-white p-1.5 pb-5 shadow-md"
          style={{
            left: p.x,
            transform: `rotate(${p.rot})`,
            animation: `pop-in 5s ease ${p.delay} infinite, float-y ${4 + i * 0.7}s ease-in-out ${p.delay} infinite`,
          }}
        >
          <div className={`grain relative h-20 rounded-sm bg-gradient-to-br ${p.grad}`} />
          <p className="mt-1 text-center font-hand text-[11px] leading-3 text-neutral-600">
            {p.cap}
          </p>
        </div>
      ))}
      <span className="absolute right-5 top-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
        kangenin — 2026
      </span>
    </div>
  );
}

/* ============ 4. KUE DIGITAL: tiup lilin (interaktif) ============ */
function KueAnim() {
  const [lit, setLit] = useState(true);
  return (
    <button
      type="button"
      onClick={() => {
        setLit(false);
        setTimeout(() => setLit(true), 4000);
      }}
      aria-label={lit ? "Tiup lilinnya" : "Nyalakan lagi lilinnya"}
      className="relative h-full w-full cursor-pointer text-center"
    >
      <p className={`font-hand text-lg transition-colors ${lit ? "text-primary" : "text-muted-foreground"}`}>
        {lit ? "ada 3 permintaan nih… tiup!" : "semua permintaan jadi."}
      </p>
      {/* api */}
      <div className="absolute bottom-28 left-1/2 flex -translate-x-1/2 gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="relative h-10 w-2">
            {lit ? (
              <span
                className="absolute -top-4 left-1/2 h-5 w-3 -translate-x-1/2 rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-gradient-to-b from-amber-200 via-amber-400 to-orange-500 shadow-[0_0_16px_4px_rgba(217,164,65,0.55)]"
                style={{ animation: `flame-flicker 0.35s ease-in-out ${i * 0.12}s infinite` }}
              />
            ) : (
              <span
                className="absolute -top-8 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-neutral-300/80 blur-[3px]"
                style={{ animation: "smoke-rise 1.6s ease-out infinite", animationDelay: `${i * 0.3}s` }}
              />
            )}
            {/* lilin */}
            <span className="absolute bottom-0 left-1/2 h-9 w-2 -translate-x-1/2 rounded-sm bg-[#d9cbb8]" />
          </div>
        ))}
      </div>
      {/* kue */}
      <div className="absolute bottom-6 left-1/2 w-40 -translate-x-1/2">
        <div className="mx-auto h-9 w-40 rounded-t-md bg-[#f0e3d3]" />
        <div className="relative mx-auto h-10 w-36 rounded-t-md bg-[#e8d5c4]">
          <div className="absolute -top-1 left-2 h-3 w-3 rounded-b-full bg-[#faf8f3]" />
          <div className="absolute -top-1 left-9 h-4 w-3 rounded-b-full bg-[#faf8f3]" />
          <div className="absolute -top-1 right-8 h-3 w-3 rounded-b-full bg-[#faf8f3]" />
          <div className="absolute -top-1 right-3 h-4 w-3 rounded-b-full bg-[#faf8f3]" />
        </div>
        <div className="mx-auto h-9 w-32 rounded-b-lg bg-[#d9bfa8] shadow-md" />
      </div>
      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-muted-foreground">
        {lit ? "tap untuk meniup" : "tap untuk menyalakan ulang"}
      </span>
    </button>
  );
}

/* ============ 5. LOVE COUPONS ============ */
function CouponsAnim() {
  const coupons = ["1× Pelukan Gratis", "1× Nonton Pilihanmu", "1× Sarapan Dibawain"];
  const [idx, setIdx] = useState(0);
  return (
    <button
      type="button"
      onClick={() => setIdx((i) => (i + 1) % coupons.length)}
      aria-label="Ganti kupon"
      className="relative h-full w-full"
    >
      <div
        key={idx}
        className="absolute left-1/2 top-1/2 w-56 -translate-x-1/2 -translate-y-1/2 rotate-[-3deg] overflow-hidden rounded-md border-2 border-dashed border-primary/50 bg-white shadow-md"
        style={{ animation: "pop-in 0.5s ease" }}
      >
        <div className="flex items-center justify-between bg-primary px-3 py-1.5">
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white">Kangenin Co.</span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-white">no expiry</span>
        </div>
        <div className="relative px-4 py-5">
          <p className="font-hand text-2xl text-neutral-800">{coupons[idx]}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">berlaku kapan pun kamu minta</p>
          <span
            className="pointer-events-none absolute inset-y-0 w-10 bg-white/70 blur-md"
            style={{ animation: "shimmer-sweep 2.8s ease-in-out infinite" }}
          />
        </div>
        <div className="absolute -left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-[#f2ede3]" />
        <div className="absolute -right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-[#f2ede3]" />
      </div>
      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground">
        tap untuk ganti kupon
      </span>
    </button>
  );
}

/* ============ 6. PLAYLIST KITA ============ */
function PlaylistAnim() {
  const songs = [
    { t: "Monolog - Pamungkas", active: true },
    { t: "Rumah Ke Rumah - Hindia", active: false },
    { t: "Sial - Mahalini", active: false },
  ];
  return (
    <div className="relative flex h-full w-full items-center justify-center gap-5">
      {/* piringan hitam */}
      <div className="relative h-28 w-28 shrink-0 anim-spin-slow">
        <div
          className="h-full w-full rounded-full bg-neutral-900 shadow-md"
          style={{
            backgroundImage:
              "repeating-radial-gradient(circle at center, #1c1c1c 0 2px, #2b2b2b 2px 4px)",
          }}
        />
        <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary">
          <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-900" />
        </div>
      </div>
      {/* lagu */}
      <div className="w-36 space-y-2">
        <div className="flex items-end gap-1 pb-1">
          {[0.9, 0.5, 1.1, 0.7, 1.3, 0.6].map((d, i) => (
            <span
              key={i}
              className="w-1.5 origin-bottom rounded-t bg-primary"
              style={{ height: 14 + i * 3, animation: `eq-bounce ${d}s ease-in-out infinite` }}
            />
          ))}
        </div>
        {songs.map((s, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px] font-medium ${
              s.active ? "bg-secondary text-foreground" : "bg-white/80 text-muted-foreground"
            }`}
          >
            <span>{s.active ? "▶" : "♡"}</span>
            <span className="truncate">{s.t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ daftar kado ============ */
const GIFTS = [
  {
    id: "buket",
    num: "01",
    anim: <BuketAnim />,
    title: "Buket Digital",
    desc: "Buket bunga yang tidak pernah layu — kelopaknya mekar satu-satu pas dia buka. Buat anniversary, permintaan maaf, atau sekadar bikin dia senyum.",
    tag: "pengganti buket Rp150rb",
    cta: { href: "#buket", label: "Racik buketnya" },
  },
  {
    id: "openwhen",
    num: "02",
    anim: <OpenWhenAnim />,
    title: "Open When Letters",
    desc: "5 surat terkunci: satu terbuka tiap minggu — biar dia balik lagi, lagi, dan lagi. Favorit couple LDR.",
    tag: "surat tangan, versi link",
    cta: { href: "#openwhen", label: "Bikin suratnya" },
  },
  {
    id: "photobox",
    num: "03",
    anim: <PhotoboxAnim />,
    title: "Photobox Digital",
    desc: "Strip foto gaya photobox mall, versi digital. Upload foto kalian, kasih caption, dia bisa simpan langsung ke galeri.",
    tag: "photobox Rp50rb, tanpa ongkir",
    cta: { href: "#photobox", label: "Pilih fotonya" },
  },
  {
    id: "kue",
    num: "04",
    anim: <KueAnim />,
    title: "Kue Tiup Lilin",
    desc: "Kue ulang tahun interaktif: dia meniup lilinnya lewat layar, asap keluar, permintaan disebut. Kue beneran tetap menyusul, kalau bisa.",
    tag: "tidak akan kadaluarsa",
    cta: { href: "#kue", label: "Siapin kuenya" },
  },
  {
    id: "coupons",
    num: "05",
    anim: <CouponsAnim />,
    title: "Love Coupons",
    desc: "Buku kupon yang dulu kalian buat dari kertas HVS — sekarang versi rapi yang tidak bisa hilang atau dipalsu.",
    tag: "kupon kertas, anti lecek",
    cta: { href: "#kupon", label: "Bikin kuponnya" },
  },
  {
    id: "playlist",
    num: "06",
    anim: <PlaylistAnim />,
    title: "Playlist Kita",
    desc: "Halaman lagu-lagunya kalian berdua, lengkap dengan piringan hitam berputar dan catatan kenangan di tiap lagu.",
    tag: "playlist Spotify, versi halaman",
    cta: { href: "#playlist", label: "Racik playlistnya" },
  },
];

export default function GiftsSection() {
  return (
    <section id="kado" className="relative border-y border-border bg-secondary/40 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="kicker">Enam kado — satu link</p>
          <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
            Kado favorit orang pacaran,{" "}
            <em className="text-primary">sekarang jadi link.</em>
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Yang paling sering dikasih couple di Indonesia — diubah jadi kado
            digital yang tidak bisa hilang, rusak, atau kedaluwarsa.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {GIFTS.map((g, i) => (
            <motion.article
              key={g.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.1 }}
              className="group overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-[0_16px_40px_-24px_rgba(28,25,23,0.35)]"
            >
              <div className="relative h-48 overflow-hidden border-b border-border bg-background p-4">
                {g.anim}
              </div>
              <div className="p-6">
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-sm font-bold text-primary">{g.num}</span>
                  <h3 className="font-display text-lg font-bold text-foreground">{g.title}</h3>
                </div>
                <p className="mt-2 min-h-[72px] text-sm leading-relaxed text-muted-foreground">
                  {g.desc}
                </p>
                <span className="mt-3 inline-block rounded-sm border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  {g.tag}
                </span>
                {g.cta && (
                  <a
                    href={g.cta.href}
                    className="mt-4 flex items-center justify-center gap-1.5 rounded-md border border-foreground/15 px-4 py-2 text-xs font-bold text-foreground transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
                  >
                    {g.cta.label} ↓
                  </a>
                )}
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
