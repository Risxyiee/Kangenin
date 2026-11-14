import { getCloudflareContext } from "@opennextjs/cloudflare";

// ── WhatsApp bot (Fonnte) — konfigurasi & pengirim pesan ─────────────────────
// Bot jalan via Fonnte (fonnte.com): device WA owner terhubung ke Fonnte,
// webhook masuk di /api/wa/webhook, balasan keluar via API api.fonnte.com.
//
// Env/secret Cloudflare (Settings → Variables, pola sama dengan ADMIN_KEY):
//   FONNTE_TOKEN       — token device Fonnte (wajib, tanpa ini bot bisu)
//   WA_OWNER_NUMBER    — nomor owner format 62xxx (wajib untuk perintah owner)
//   WA_WEBHOOK_SECRET  — token rahasia di URL webhook (?token=...) (disarankan)
// Semua fail-closed: tanpa env, bot senyap/501 — tidak pernah setengah hidup.

type WaEnv = {
  FONNTE_TOKEN?: string;
  WA_OWNER_NUMBER?: string;
  WA_WEBHOOK_SECRET?: string;
};

export function waEnv(): WaEnv {
  try {
    const { env } = getCloudflareContext() as unknown as { env?: WaEnv };
    if (env?.FONNTE_TOKEN || env?.WA_OWNER_NUMBER || env?.WA_WEBHOOK_SECRET) return env;
  } catch {
    // bukan runtime Cloudflare (dev lokal) → process.env
  }
  return {
    FONNTE_TOKEN: process.env.FONNTE_TOKEN,
    WA_OWNER_NUMBER: process.env.WA_OWNER_NUMBER,
    WA_WEBHOOK_SECRET: process.env.WA_WEBHOOK_SECRET,
  };
}

export const BASE_URL = "https://www.kangenin.web.id";

/** Nomor owner (daftar, biar bisa lebih dari satu HP). Kosong = belum dipasang. */
export function ownerNumbers(): string[] {
  return (waEnv().WA_OWNER_NUMBER ?? "")
    .split(",")
    .map((s) => s.replace(/[^0-9]/g, ""))
    .filter(Boolean);
}

/** Normalisasi sender Fonnte ("628xxx@s.whatsapp.net" → "628xxx"). */
export function nomorBersih(sender: string): string {
  return sender.replace(/@.*/, "").replace(/[^0-9]/g, "");
}

export function isOwner(sender: string): boolean {
  const n = nomorBersih(sender);
  return ownerNumbers().includes(n);
}

/** Kirim pesan WA via Fonnte. Balas string error kalau gagal. */
export async function fonnteSend(target: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const token = waEnv().FONNTE_TOKEN?.trim();
  if (!token) return { ok: false, error: "FONNTE_TOKEN belum terpasang" };
  try {
    const res = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ target: target.replace(/[^0-9]/g, ""), message }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: `Fonnte ${res.status}: ${t.slice(0, 120)}` };
    }
    const json = (await res.json().catch(() => ({}))) as { status?: boolean | string; reason?: string };
    if (json.status === false || json.status === "false") {
      return { ok: false, error: json.reason ?? "Fonnte menolak" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "fetch gagal" };
  }
}

// ── Format pesan share (mirror og:description asli di page.tsx) ──────────────

export type LinkInfo =
  | { kind: "confession"; toName: string }
  | { kind: "letterSet"; toName: string; jumlah: number }
  | { kind: "gift"; toName: string; tipe: string }
  | { kind: "tidakAda" };

export function pesanLink(info: LinkInfo, slug: string): string {
  if (info.kind === "tidakAda") {
    return "Hmm, nggak ada yang cocok dengan kunci itu 🤔\nCek lagi kuncinya — formatnya: link <kunci>\nContoh: link abc123";
  }
  const url = `${BASE_URL}/?k=${encodeURIComponent(slug)}`;
  if (info.kind === "confession") {
    return (
      `💌 Ada surat rahasia buat ${info.toName}\n\n` +
      `Seseorang diam-diam perhatian ngirim sesuatu buat kamu. ` +
      `Buka sekarang — siapa tahu dia juga punya perasaan yang sama 🤍\n\n${url}`
    );
  }
  if (info.kind === "letterSet") {
    return (
      `✉️ ${info.jumlah} surat kecil buat ${info.toName}\n\n` +
      `Seseorang bikinin surat-surat kecil — satu surat bisa dibuka tiap minggu. ` +
      `Buka yang pertama sekarang 🤍\n\n${url}`
    );
  }
  return (
    `🎁 Ada kado spesial buat ${info.toName}\n\n` +
    `Seseorang yang diam-diam perhatian ngirim kado. Buka sekarang — siapin hatinya 🤍\n\n${url}`
  );
}

export const PESAN_MENU = [
  "🤖 *Kangenin Bot*",
  "",
  "Perintah yang bisa dipakai:",
  "• `link <kunci>` — kirim ulang link confess/kado dengan teks siap-share",
  "• `pengunjung` — denyut pengunjung realtime *(owner)*",
  "• `kirim <nomor62> <kunci>` — langsung kirim link ke nomor itu *(owner)*",
  "• `menu` — lihat daftar ini lagi",
  "",
  `${BASE_URL} 💜`,
].join("\n");

export function pesanPengunjung(d: {
  online1m: number;
  online5m: number;
  unikHariIni: number;
  viewsHariIni: number;
  baru1jam: number;
  sedangMembuka: { path: string; orang: number }[];
}): string {
  const garis = d.sedangMembuka
    .slice(0, 5)
    .map((p) => `  • ${p.path} — ${p.orang} orang`)
    .join("\n");
  return [
    "🔴 *Denyut Kangenin (realtime)*",
    "",
    `👥 Online sekarang: *${d.online1m} orang*`,
    `🟡 Aktif 5 menit terakhir: ${d.online5m}`,
    "",
    `📅 Pengunjung baru hari ini: *${d.unikHariIni}*`,
    `📄 Pageviews hari ini: ${d.viewsHariIni}`,
    `⏱️ Kunjungan 1 jam terakhir: ${d.baru1jam}`,
    ...(garis ? ["", "Sedang membuka:", garis] : []),
  ].join("\n");
}
