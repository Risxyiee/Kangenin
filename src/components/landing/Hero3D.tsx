"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

type P = { x: number; y: number };

/* PRNG deterministik berbasis integer (identik di Node & browser — hindari hydration mismatch) */
function rnd(i: number, salt: number): number {
  let h = (i * 374761393 + salt * 668265263) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

/* kelopak mawar jatuh */
function Petals() {
  const petals = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: rnd(i, 1) * 100,
        delay: rnd(i, 2) * 9,
        duration: 9 + rnd(i, 3) * 8,
        size: 10 + rnd(i, 4) * 14,
        sway: `${rnd(i, 5) * 140 - 70}px`,
        op: 0.35 + rnd(i, 6) * 0.4,
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {petals.map((p) => (
        <span
          key={p.id}
          className="absolute rounded-[60%_40%_60%_40%/60%_60%_40%_40%] bg-rose-400/80"
          style={{
            left: `${p.left}%`,
            top: "-6vh",
            width: p.size,
            height: p.size * 0.72,
            opacity: p.op,
            animation: `petal-fall ${p.duration}s linear ${p.delay}s infinite`,
            ["--sway" as string]: p.sway,
          }}
        />
      ))}
    </div>
  );
}

/* hati yang melayang di kedalaman berbeda */
function FloatingHearts({ m }: { m: P }) {
  const hearts = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        id: i,
        left: rnd(i, 10) * 96,
        top: rnd(i, 11) * 90,
        size: 16 + rnd(i, 12) * 34,
        depth: 0.3 + rnd(i, 13) * 1.4,
        delay: rnd(i, 14) * 6,
        dur: 5 + rnd(i, 15) * 6,
        op: 0.12 + rnd(i, 16) * 0.3,
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {hearts.map((h) => (
        <div
          key={h.id}
          className="absolute"
          style={{
            left: `${h.left}%`,
            top: `${h.top}%`,
            transform: `translate3d(${m.x * h.depth * 26}px, ${m.y * h.depth * 18}px, 0)`,
            transition: "transform 0.25s ease-out",
          }}
        >
          <div
            className="anim-drift"
            style={{ animationDelay: `${h.delay}s`, animationDuration: `${h.dur}s` }}
          >
            <div
              className="relative"
              style={{ width: h.size, height: h.size, opacity: h.op }}
            >
              <div className="heart-shape" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* hati 3D utama yang bisa "merespons" mouse */
function HeroHeart3D({ m }: { m: P }) {
  return (
    <div className="perspective-1200 relative flex h-[300px] w-[300px] items-center justify-center sm:h-[360px] sm:w-[360px]">
      {/* cincin orbit */}
      <div
        className="absolute inset-0 rounded-full border border-rose-400/20"
        style={{
          transform: `rotateX(68deg) scale(1.05)`,
        }}
      />
      <div
        className="absolute inset-[-36px] rounded-full border border-rose-300/10"
        style={{ transform: "rotateX(68deg) scale(1.18)" }}
      />

      {/* satelit hati mengorbit */}
      {[
        { r: 150, d: 9, s: 20, del: 0, z: 30 },
        { r: 175, d: 13, s: 14, del: -4, z: 10 },
        { r: 128, d: 11, s: 24, del: -7, z: 50 },
      ].map((o, i) => (
        <div
          key={i}
          className="absolute left-1/2 top-1/2 preserve-3d"
          style={{
            animation: `orbit ${o.d}s linear infinite`,
            animationDelay: `${o.del}s`,
            ["--orbit-r" as string]: `${o.r}px`,
            zIndex: o.z,
          }}
        >
          <div className="relative" style={{ width: o.s, height: o.s }}>
            <div className="heart-shape" />
          </div>
        </div>
      ))}

      {/* hati utama */}
      <motion.div
        className="relative preserve-3d"
        animate={{
          rotateY: m.x * 26,
          rotateX: -m.y * 18,
        }}
        transition={{ type: "spring", stiffness: 60, damping: 14 }}
      >
        <div className="relative h-40 w-40 sm:h-52 sm:w-52 anim-heartbeat drop-shadow-[0_0_60px_rgba(244,63,94,0.55)]">
          <div className="heart-shape" />
          {/* kilau */}
          <div className="absolute left-[24%] top-[18%] h-6 w-6 rounded-full bg-white/70 blur-[3px]" />
          <div className="absolute left-[38%] top-[10%] h-3 w-3 rounded-full bg-white/50 blur-[2px]" />
        </div>
        {/* bayangan kedalaman */}
        <div
          className="absolute inset-0 -z-10 h-40 w-40 sm:h-52 sm:w-52"
          style={{ transform: "translateZ(-46px)" }}
        >
          <div className="heart-shape opacity-40 blur-md" />
        </div>
      </motion.div>

      {/* glow lantai */}
      <div className="absolute bottom-2 h-10 w-56 rounded-full bg-rose-600/30 blur-2xl" />
    </div>
  );
}

export default function Hero3D() {
  const [m, setM] = useState<P>({ x: 0, y: 0 });

  const onMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setM({
      x: ((e.clientX - r.left) / r.width) * 2 - 1,
      y: ((e.clientY - r.top) / r.height) * 2 - 1,
    });
  }, []);

  return (
    <section
      onMouseMove={onMove}
      className="relative overflow-hidden bg-[#1a0511] pb-20 pt-28 sm:pb-24 sm:pt-36"
      aria-label="Pembuka"
    >
      {/* latar gradasi + glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#2b0a1c] via-[#3d0c24] to-[#160510]" />
      <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-rose-600/25 blur-[120px]" />
      <div className="absolute -right-24 bottom-0 h-[420px] w-[420px] rounded-full bg-pink-500/15 blur-[130px]" />
      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
        }}
      />

      <Petals />
      <FloatingHearts m={m} />

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        {/* kiri: copy */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center lg:text-left"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-rose-200 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            CONFESS GRATIS • KADO DIGITAL &lt; RP50RB
          </div>

          <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl xl:text-6xl">
            Suka dia tapi{" "}
            <span className="font-hand text-5xl font-bold text-rose-300 sm:text-6xl">
              malu
            </span>{" "}
            ngomong?
          </h1>
          <p className="mt-3 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            <span className="text-gradient-rose">Confess aja, diam-diam.</span>
          </p>

          <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-rose-100/70 lg:mx-0">
            Kirim link anonim yang bikin dia tersenyum (atau deg-degan). Sudah
            punya pacar? Kirim kado digital — buket bunga, surat{" "}
            <span className="italic">Open When</span>, photobox, sampai timeline
            kisah kalian. Tanpa install aplikasi.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <a
              href="#confess"
              className="w-full rounded-full bg-rose-500 px-8 py-4 text-center text-base font-bold text-white shadow-xl shadow-rose-600/40 transition hover:scale-[1.04] hover:bg-rose-600 sm:w-auto"
            >
              💌 Confess Sekarang — Gratis
            </a>
            <a
              href="#kado"
              className="w-full rounded-full border border-white/20 bg-white/5 px-8 py-4 text-center text-base font-semibold text-white backdrop-blur transition hover:bg-white/15 sm:w-auto"
            >
              Lihat Kado Digital
            </a>
          </div>

          <div className="mt-9 flex items-center justify-center gap-6 text-left lg:justify-start">
            {[
              { v: "Rp0", k: "confess anonim" },
              { v: "3 menit", k: "kado siap kirim" },
              { v: "< Rp50rb", k: "semua kado premium" },
            ].map((s) => (
              <div key={s.v}>
                <div className="text-xl font-extrabold text-white">{s.v}</div>
                <div className="text-xs text-rose-200/60">{s.k}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* kanan: scene 3D */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="hidden justify-center lg:flex"
        >
          <HeroHeart3D m={m} />
        </motion.div>

        {/* scene 3D versi mobile (lebih kecil) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="flex justify-center lg:hidden"
        >
          <div className="scale-[0.72]">
            <HeroHeart3D m={m} />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
