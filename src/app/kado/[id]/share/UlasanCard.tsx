"use client";

/**
 * UlasanCard — pintu ulasan super-ringan di dasbor share, muncul setelah
 * kado selesai dibuat. ATURAN EMAS dari founder: HARUS bisa di-skip sekali
 * ketuk — jangan sampai menghalangi user yang buru-buru share link-nya
 * (user kabur = loop viral putus).
 *
 * Desain anti-kabur:
 *   - Posisi paling bawah, setelah semua kartu share — bukan modal, bukan
 *     jalan buntu, gak nutupin tombol share sekalipun.
 *   - 1 ketuk rating emoji = ulasan terkirim (tanpa nulis apa pun).
 *   - "Lewati" di pojok, gede & jelas; pilihan diingat sessionStorage biar
 *     gak nongol lagi pas refresh di sesi yang sama.
 *   - Kirim ke /api/feedback (kategori "ulasan") — masuk panel /insight.
 */

import { useEffect, useState } from "react";
import { Heart, Loader2, Star } from "lucide-react";

const SKIP_KEY = "kangenin-ulasan-share-skip";

// emoji rating: indeks 0 = 1 bintang … 4 = 5 bintang
const RATINGS = [
  { emoji: "😕", label: "Bingung" },
  { emoji: "🙂", label: "Oke" },
  { emoji: "😊", label: "Senang" },
  { emoji: "🤩", label: "Keren" },
  { emoji: "🥰", label: "Suka banget" },
];

type Fase = "isi" | "kirim" | "jadi" | "gagal";

export default function UlasanCard({ kadoId }: { kadoId: string }) {
  const [terlihat, setTerlihat] = useState(true);
  const [rating, setRating] = useState<number | null>(null);
  const [teks, setTeks] = useState("");
  const [fase, setFase] = useState<Fase>("isi");

  // cek skip sesi — di effect (bukan saat render) biar aman lint & hidrasi;
  // kartu di bawah fold, flash sesaat tak terlihat
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SKIP_KEY) === "1") setTerlihat(false);
    } catch {
      /* storage blokir — biarkan kartu tampil */
    }
  }, []);

  if (!terlihat) return null;

  const teksBersih = teks.trim();
  const bolehKirim = rating !== null || teksBersih.length >= 3;

  function lewati() {
    try {
      sessionStorage.setItem(SKIP_KEY, "1");
    } catch {
      /* storage penuh/blokir — tetap sembunyikan untuk sesi render ini */
    }
    setTerlihat(false);
  }

  async function kirim() {
    if (!bolehKirim || fase === "kirim") return;
    setFase("kirim");
    // API butuh message min 3 karakter — rating doang tetap lolos via pesan otomatis
    const pesan =
      teksBersih.length >= 3
        ? teksBersih
        : `Ulasan dasbor kado: ${rating ?? 0}/5 (${RATINGS[(rating ?? 1) - 1]?.label ?? "tanpa teks"})`;
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: pesan,
          rating,
          category: "ulasan",
          path: `/kado/${kadoId}/share`,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setFase("jadi");
    } catch {
      setFase("gagal");
    }
  }

  return (
    <section
      className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/40 backdrop-blur-md"
      aria-label="Ulasan untuk Kangenin"
    >
      {fase === "jadi" ? (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-500/15 text-rose-300">
            <Heart className="h-4.5 w-4.5" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Makasih ulasannya! 🤍</p>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
              Langsung nyampe ke founder — dibaca semua, dijanjiin.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* header + tombol Lewati yang menonjol */}
          <div className="mb-3 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300/30 bg-amber-400/15 text-amber-300">
              <Star className="h-4.5 w-4.5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">
                Gimana rasanya bikin kado di sini?
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                Ketuk emoji doang juga jadi. Nggak maksa — boleh diselesaikan
                nanti.
              </p>
            </div>
            <button
              type="button"
              onClick={lewati}
              className="shrink-0 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              Lewati
            </button>
          </div>

          {/* chip rating emoji */}
          <div className="flex justify-between gap-2" role="radiogroup" aria-label="Rating 1 sampai 5">
            {RATINGS.map((r, i) => {
              const val = i + 1;
              const aktif = rating === val;
              return (
                <button
                  key={val}
                  type="button"
                  role="radio"
                  aria-checked={aktif}
                  aria-label={`${val} — ${r.label}`}
                  onClick={() => setRating(val)}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-2xl border py-2.5 transition-all ${
                    aktif
                      ? "border-rose-400/50 bg-rose-500/15 shadow-[0_0_18px_-6px_rgba(244,63,94,0.6)]"
                      : "border-white/10 bg-white/[0.03] hover:border-white/25"
                  }`}
                >
                  <span className={`text-xl leading-none ${aktif ? "" : "opacity-70"}`}>
                    {r.emoji}
                  </span>
                  <span
                    className={`text-[9.5px] font-medium ${
                      aktif ? "text-rose-200" : "text-zinc-500"
                    }`}
                  >
                    {r.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* teks opsional — muncul setelah pilih rating (masih bisa dilewati) */}
          {rating !== null && (
            <textarea
              value={teks}
              onChange={(e) => setTeks(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder="Mau ceritain kenapa? (opsional)"
              className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-rose-400/40 focus:outline-none"
            />
          )}

          {fase === "gagal" && (
            <p className="mt-2 text-xs text-rose-300">
              Koneksi bermasalah — coba kirim lagi ya.
            </p>
          )}

          <button
            type="button"
            onClick={kirim}
            disabled={!bolehKirim || fase === "kirim"}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-purple-500 py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-35"
          >
            {fase === "kirim" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {bolehKirim ? "Kirim ulasan" : "Pilih emoji dulu"}
          </button>
        </>
      )}
    </section>
  );
}
