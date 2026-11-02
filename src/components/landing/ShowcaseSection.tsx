"use client";

import Link from "next/link";
import { relTime, type ShowcaseItem } from "@/lib/papan";

/* gradien mini per tema — mirror ringan dari CONFESS_THEMES (sama dgn WallGrid) */
const THEME_SWATCH: Record<string, string> = {
  rose: "from-[#4a0e2e] to-rose-500",
  sunset: "from-[#7c2d12] to-orange-400",
  midnight: "from-[#3b0764] to-purple-500",
  sakura: "from-[#7e2148] to-pink-400",
  matcha: "from-[#1f4d33] to-emerald-500",
};

// Papan Pengakuan — isi confess ASLI yang pengirimnya izinkan tayang di
// halaman depan (anonim atau nama depan, pilihannya pengirim). Ini bukti
// sosial level tertinggi: bukan klaim, isi suratnya kelihatan. Dua baris
// marquee berlawanan arah biar papan terasa hidup; hover = berhenti biar
// nyaman dibaca.
export default function ShowcaseSection({ items }: { items: ShowcaseItem[] }) {
  // baris 1 & 2 dibelah dua; fallback 1 baris kalau itemnya sedikit
  const half = Math.ceil(items.length / 2);
  const rowA = items.slice(0, half);
  const rowB = items.slice(half);

  const renderRow = (list: ShowcaseItem[], reverse: boolean, keyPrefix: string) => {
    if (list.length === 0) return null;
    // dua half identik (flex gap-4 pr-4 masing-masing) → -50% = mulus tanpa lompatan
    const renderHalf = (hidden: boolean) => (
      <div className="flex gap-4 pr-4" aria-hidden={hidden || undefined}>
        {list.map((item, i) => (
          <article
            key={`${keyPrefix}-${item.id}-${i}`}
            className="flex w-[270px] shrink-0 flex-col rounded-xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur transition-colors hover:border-white/25 sm:w-[300px]"
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`h-2 w-8 rounded-full bg-gradient-to-r ${
                  THEME_SWATCH[item.theme] ?? THEME_SWATCH.rose
                }`}
                aria-hidden
              />
              <time
                dateTime={item.createdAt}
                suppressHydrationWarning
                className="text-[10.5px] text-white/40"
              >
                {relTime(item.createdAt)}
              </time>
            </div>

            <p className="mt-3 line-clamp-5 whitespace-pre-wrap text-[13px] leading-relaxed text-white/85">
              &ldquo;{item.message}&rdquo;
            </p>

            <p className="mt-3 border-t border-white/10 pt-2.5 text-xs text-white/60">
              dari <b className="font-semibold text-[#e8b4bb]">{item.from}</b>{" "}
              <span className="text-white/35">untuk</span>{" "}
              <b className="font-semibold text-white/85">{item.to}</b>
              {item.answered && (
                <span className="ml-1.5 rounded-full bg-emerald-400/10 px-1.5 py-0.5 text-[9.5px] font-semibold text-emerald-300">
                  dijawab 💘
                </span>
              )}
            </p>
          </article>
        ))}
      </div>
    );
    return (
      <div className="papan-row relative overflow-hidden py-2">
        <div
          className="papan-track flex w-max"
          style={{
            animation: `marquee-x ${Math.max(26, list.length * 11)}s linear infinite`,
            animationDirection: reverse ? "reverse" : "normal",
          }}
        >
          {renderHalf(false)}
          {renderHalf(true)}
        </div>
        {/* fade kiri-kanan biar kartu "keluar" dengan halus */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#211d1a] to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#211d1a] to-transparent"
          aria-hidden
        />
      </div>
    );
  };

  return (
    <section id="papan" className="relative bg-[#211d1a] py-16 sm:py-20">
      <div
        className="absolute inset-0 opacity-[0.05]"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />
      <div className="relative z-10">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <p className="kicker !text-[#d9a0a6]">Papan Pengakuan</p>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-white sm:text-4xl">
            Yang barusan <em className="text-[#e8b4bb]">diakui</em> langsung.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/60">
            Pengakuan asli yang pengirimnya{" "}
            <b className="text-white">ikut izinkan tayang</b> — anonim atau
            nama depan, dia yang milih. Giliranmu kapan?
          </p>
        </div>

        <div className="mt-8">
          {items.length === 0 ? (
            <div className="mx-auto max-w-md px-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-8 text-center backdrop-blur">
                <p className="font-hand text-2xl text-[#e8b4bb]">
                  Papannya masih sepi…
                </p>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-white/60">
                  Jadi yang pertama nongol di sini. Kamu yang tentukan:
                  tampil sebagai anonim, atau pakai nama depanmu biar diakuin.
                </p>
              </div>
            </div>
          ) : (
            <>
              {renderRow(rowA, false, "a")}
              {renderRow(rowB, true, "b")}
            </>
          )}
        </div>

        <div className="mt-8 flex flex-col items-center gap-2 px-4 text-center">
          <Link
            href="/#confess"
            className="rounded-md bg-primary px-7 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#b52743]"
          >
            Tulis pengakuanmu — gratis
          </Link>
          <p className="text-[11px] text-white/40">
            Tayang cuma kalau kamu pilih — bisa diganti jadi privat kapan saja.
          </p>
        </div>
      </div>
    </section>
  );
}
