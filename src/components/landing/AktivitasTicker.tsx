"use client";

import { useEffect, useState } from "react";

// Ticker aktivitas paling atas landing page (tepat di bawah navbar) — bukti
// sosial yang bikin pengunjung baru yakin "ada orang lain yang memakai ini
// juga". Data dari /api/aktivitas (nama sudah disamarkan di server: "Rifka" →
// "R***A"); ticker hanya memutar kalimat + mencicil waktu relatif.
// Kosong → tidak dirender sama sekali.

type Aktivitas = { jenis: string; nama: string | null; waktu: string };

function waktuLalu(iso: string): string {
  const detik = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (detik < 5 * 60) return "baru saja";
  const menit = Math.floor(detik / 60);
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  const hari = Math.floor(jam / 24);
  return hari === 1 ? "1 hari lalu" : `${hari} hari lalu`;
}

export default function AktivitasTicker() {
  const [items, setItems] = useState<Aktivitas[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let hidup = true;

    const muat = () => {
      fetch("/api/aktivitas")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (hidup && Array.isArray(d?.items) && d.items.length > 0) {
            setItems(d.items);
          }
        })
        .catch(() => {
          // jaringan berkali — ticker diam saja, landing tetap utuh
        });
    };

    muat();
    const poll = setInterval(muat, 60_000); // segarkan daftar tiap menit
    const rotasi = setInterval(() => setIdx((i) => i + 1), 4_000); // ganti cerita tiap 4 dtk

    // pulang dari tab lain → ambil daftar segar biar waktunya tidak basi
    const kembali = () => {
      if (document.visibilityState === "visible") muat();
    };
    document.addEventListener("visibilitychange", kembali);

    return () => {
      hidup = false;
      clearInterval(poll);
      clearInterval(rotasi);
      document.removeEventListener("visibilitychange", kembali);
    };
  }, []);

  if (items.length === 0) return null;

  const item = items[idx % items.length];
  const subjek = item.jenis === "dinding" || item.jenis === "papan" ? item.nama ?? "Seseorang" : "Seseorang";
  const aksi =
    item.jenis === "kado"
      ? "membuka kado rahasianya"
      : item.jenis === "bikin-kado"
        ? "menyiapkan kado kejutan"
        : item.jenis === "surat"
          ? "menulis surat rahasia"
          : item.jenis === "papan"
            ? "membagikan pengakuan di papan"
            : "menampilkan pesan di dinding";
  const waktu = waktuLalu(item.waktu);
  const segar = waktu === "baru saja";

  return (
    <a
      href="/dinding"
      aria-label="Lihat Dinding Kangenin"
      className="group block overflow-hidden border-b border-white/5 bg-[#1b1815]"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-2.5 px-4 py-2.5">
        {/* titik hidup berdenyut — tanda ini bukan teks statis */}
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>

        <p className="min-w-0 flex-1 truncate text-xs text-white/75 sm:text-[13px]">
          {/* key={idx} me-remount elemen → animasi masuk jalan tiap ganti cerita */}
          <span key={idx} className="inline-block animate-[aktivitas-in_0.5s_ease-out]">
            {segar ? (
              <>
                <span className="font-semibold text-white/90">{subjek}</span> baru saja {aksi}
              </>
            ) : (
              <>
                <span className="font-semibold text-white/90">{subjek}</span> {aksi}
                <span className="text-white/40"> · {waktu}</span>
              </>
            )}
          </span>
        </p>

        <span
          className="ml-auto hidden shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35 transition-colors group-hover:text-primary sm:block"
          aria-hidden
        >
          Lihat dinding →
        </span>
      </div>
    </a>
  );
}
