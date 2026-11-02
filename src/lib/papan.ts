// ─────────────────────────────────────────────────────────────────────────────
// Papan Pengakuan — helper bersama buat fitur "isi confess tayang di halaman
// depan". Dipakai API (feed publik, PATCH setelan) dan komponen (label mode),
// jadi aturan mode cuma ada di SATU tempat.
//
// Mode (dari sudut pandang pengirim):
//   "off"    → privat; surat cuma bisa dibaca penerima lewat linknya
//   "anonim" → isi surat tayang di papan, identitas = "Seseorang"
//   "nama"   → isi surat tayang, identitas = kata pertama fromName
//
// Penting: mode "anonim"/"nama" SELALU berarti isPublic=true (dinding teaser
// ikut menyala) — feed papan memfilter showMessage && isPublic supaya aksi
// "hide" admin (isPublic=false) otomatis mencabut surat dari papan.
// ─────────────────────────────────────────────────────────────────────────────

export type PapanMode = "off" | "anonim" | "nama";

export const PAPAN_MODES: PapanMode[] = ["off", "anonim", "nama"];

/** Normalisasi nilai apa pun → mode valid (input user/server tidak dipercaya). */
export function asPapanMode(v: unknown): PapanMode | null {
  return typeof v === "string" && (PAPAN_MODES as string[]).includes(v)
    ? (v as PapanMode)
    : null;
}

/** Mode efektif dari flag di DB (baris Confession / respons status). */
export function papanModeOf(
  isPublic: boolean,
  showMessage: boolean,
  showAs: string
): PapanMode {
  if (!isPublic || !showMessage) return "off";
  return showAs === "nama" ? "nama" : "anonim";
}

/** Data kolom untuk `confession.update` sesuai mode. */
export function papanDataFor(mode: PapanMode): {
  isPublic: boolean;
  showMessage: boolean;
  showAs?: string;
} {
  if (mode === "off") return { isPublic: false, showMessage: false };
  return mode === "nama"
    ? { isPublic: true, showMessage: true, showAs: "nama" }
    : { isPublic: true, showMessage: true, showAs: "anonim" };
}

/** Label pendek buat UI admin & dashboard. */
export const PAPAN_MODE_LABEL: Record<PapanMode, string> = {
  off: "Privat",
  anonim: "Tayang · anonim",
  nama: "Tayang · nama depan",
};

/**
 * Nama depan: kata pertama, dibersihkan, dibatasi 24 karakter.
 * Nama lengkap TIDAK PERNAH ikut ke papan — itu permintaan eksplisit fitur ini.
 */
export function firstName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return first.slice(0, 24);
}

const MASK = "[disembunyikan]";

/**
 * Sanitizer tampilan publik: kontak pribadi di isi surat ditutup sebelum
 * masuk papan (feed HTML). Moderasi kata terlarang sudah jalan di endpoint
 * create; lapisan ini khusus mencegah tukar kontak & link di konten publik.
 */
export function maskKontak(text: string): string {
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, MASK) // email
    .replace(/(https?:\/\/|www\.)[^\s]+/gi, MASK) // URL / wa.me / tiktok dkk
    .replace(/(?:\+?62|0)8\d{7,11}/g, MASK); // nomor HP Indonesia
}

/** Satu item feed papan — field yang AMAN untuk publik, tanpa slug/id link. */
export type ShowcaseItem = {
  id: string;
  from: string; // "Seseorang" atau nama depan
  to: string; // selalu nama depan penerima
  theme: string;
  message: string; // sudah lewat maskKontak
  createdAt: string; // ISO
  answered: boolean;
};

/** Baris DB → item publik. Satu-satunya jalur isi surat keluar ke papan. */
export function toShowcaseItem(r: {
  id: string;
  fromName: string;
  showAs: string;
  toName: string;
  theme: string;
  message: string;
  createdAt: Date;
  response: string | null;
}): ShowcaseItem {
  const useName = r.showAs === "nama" && r.fromName.trim().length > 0;
  return {
    id: r.id,
    from: useName ? firstName(r.fromName) : "Seseorang",
    to: firstName(r.toName) || "seseorang",
    theme: r.theme,
    message: maskKontak(r.message),
    createdAt: r.createdAt.toISOString(),
    answered: r.response !== null && r.response !== undefined,
  };
}

/** "baru saja" / "5 menit lalu" / "2 jam lalu" / "3 hari lalu" / "12 Nov" */
export function relTime(iso: string): string {
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
