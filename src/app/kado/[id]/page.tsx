import type { Metadata } from "next"
import Link from "next/link"
import { db, withDbRetry } from "@/lib/db"
import { describeError } from "@/lib/log-error"
import { CONFESS_THEMES, themeFromKadoData } from "@/lib/themes"
import { Heart, PackageOpen, ServerCrash } from "lucide-react"
import ReloadButton from "./share/ReloadButton"
import CinematicUnboxing, { type KadoForUnboxing } from "./CinematicUnboxing"

/**
 * Halaman pembukaan kado — URL rahasia yang diterima target.
 *
 * Server Component: ambil kado dari Supabase (Prisma via Hyperdrive —
 * aturan mutlak: koneksi HANYA lewat src/lib/db.ts, direct connection 5432).
 * Seluruh sinematiknya ada di CinematicUnboxing (client, state machine 4 fase).
 *
 * Runtime: TANPA `export const runtime = "edge"` — OpenNext Cloudflare
 * meng-compile seluruh app menjadi satu Worker edge (bukti & penjelasan:
 * src/app/api/kado/route.ts).
 *
 * Privasi: link kado bersifat personal — jangan diindeks mesin pencari.
 */
export const metadata: Metadata = {
  title: "Sebuah kado untukmu 💜 — Kangenin",
  description:
    "Seseorang diam-diam menyiapkan kejutan buat kamu di Kangenin. Link ini cuma bisa dibuka sekali — buka sendiri ya.",
  robots: { index: false, follow: false },
  // Kartu preview WA/X/Telegram: dulu og:title & og:description cuma mewarisi
  // beranda (judul situs generik) karena metadata halaman nggak punya blok
  // openGraph sendiri — merge metadata Next itu SHALLOW per segmen. Sekarang
  // eksplisit: teaser penasaran, tanpa bocor nama pengirim/target.
  openGraph: {
    title: "🎁 Ada kado rahasia buat kamu",
    description:
      "Seseorang yang diam-diam perhatian menitipkan kejutan buatmu. Buka sekarang — cuma bisa dibuka sekali!",
    type: "website",
    siteName: "Kangenin",
    images: [
      { url: "/og-generic.png", width: 1200, height: 630, alt: "Kangenin — ada kado rahasia buat kamu" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "🎁 Ada kado rahasia buat kamu",
    description:
      "Seseorang diam-diam menitipkan kejutan buatmu. Buka sekarang — cuma sekali buka!",
    images: ["/og-generic.png"],
  },
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Normalisasi kadoData Json (Prisma) → bentuk aman untuk client. */
function toKadoData(v: unknown): Record<string, string | number> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null
  const out: Record<string, string | number> = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string" || typeof val === "number") out[k] = val
  }
  return Object.keys(out).length > 0 ? out : null
}

// ─────────────────────────────────────────────────────────────────────────────
// UI fallback
// ─────────────────────────────────────────────────────────────────────────────

/** Shell fallback — glow latar bisa ikut tema kado (default: rose). */
function Shell({ children, glow = "rgba(244,63,94,0.10)" }: { children: React.ReactNode; glow?: string }) {
  return (
    <main
      className="flex min-h-dvh items-center justify-center bg-zinc-950 px-4 py-8 text-zinc-100"
      style={{ backgroundImage: `radial-gradient(ellipse at top, ${glow}, transparent 55%)` }}
    >
      <div className="w-full max-w-md">{children}</div>
    </main>
  )
}

function NotFoundCard() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-800/60">
        <PackageOpen className="h-6 w-6 text-zinc-400" strokeWidth={1.75} />
      </div>
      <p className="mt-4 text-5xl font-black tracking-tight text-zinc-700">404</p>
      <h1 className="mt-2 text-lg font-bold text-white">Kado nggak ketemu</h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        Linknya mungkin salah ketik, kadonya sudah dihapus, atau memang belum pernah ada.
      </p>
      <Link
        href="/create"
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-purple-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_24px_-6px_rgba(244,63,94,0.5)] transition-shadow hover:shadow-[0_0_32px_-4px_rgba(244,63,94,0.65)]"
      >
        Bikin Kado Baru
      </Link>
    </div>
  )
}

function AlreadyOpenedCard() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-500/15">
        <Heart className="h-6 w-6 text-rose-300" strokeWidth={1.75} />
      </div>
      <h1 className="mt-4 text-lg font-bold text-white">
        Kado ini sudah dibuka dan menjadi kenangan.
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        Setiap kado cuma bisa dibuka sekali — biarkan kenangannya tetap di tempatnya 💜
      </p>
      <Link
        href="/create"
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/10"
      >
        Bikin kado untuk orang lain
      </Link>
    </div>
  )
}

function ErrorCard() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-500/15">
        <ServerCrash className="h-6 w-6 text-rose-300" strokeWidth={1.75} />
      </div>
      <h1 className="mt-4 text-lg font-bold text-white">Servernya lagi ngambek</h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        Kadonya mungkin masih aman — coba muat ulang halaman ini.
      </p>
      <ReloadButton />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Halaman
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Kado demo — panggung "coba rasa" tiap fitur, TANPA database.
//
// Landing & Creator Studio menautkan /kado/demo-<tipe>?pratinjau=1 supaya
// calon pengirim bisa merasakan tiap pengalaman premium sebelum bikin.
// Id-nya sengaja bukan UUID (pasti tabrakan dengan id sungguhan) dan selalu
// dirender dalam mode pratinjau — tidak ada PATCH status, tidak ada statistik.
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_DATE = "2026-11-01T08:30:00.000Z"

const DEMO_KADOS: Record<string, KadoForUnboxing> = {
  "demo-bouquet": {
    id: "demo-bouquet",
    targetName: "Kamu",
    message:
      "Bunga-bunga ini kupilih satu-satu, tapi tetap nggak ada yang seindah senyum kamu.\n\nTarik pitanya pelan-pelan ya — ada pesan yang nunggu di kartu buketnya.",
    senderName: "Rizri",
    fomoInitials: "R***I",
    kadoType: "bouquet",
    kadoData: null,
    createdAt: DEMO_DATE,
  },
  "demo-openwhen": {
    id: "demo-openwhen",
    targetName: "Kamu",
    message:
      "Kalau kamu buka surat ini, berarti kamu lagi kangen aku.\n\nKebetulan banget — aku juga. Setiap kali hujan turun, aku selalu inget chat pertama kita.",
    senderName: "Rizri",
    fomoInitials: "R***I",
    kadoType: "openwhen",
    kadoData: { title: "Buka saat kamu kangen aku", prompt: "Baca pelan-pelan ya" },
    createdAt: DEMO_DATE,
  },
  "demo-photobox": {
    id: "demo-photobox",
    targetName: "Kamu",
    message:
      "Ini strip kenangan versi demo — kalau aslinya, fotofotomu sendiri yang kecuci di sini, satu per satu, ditutup pesan dariku.",
    senderName: "Rizri",
    fomoInitials: "R***I",
    kadoType: "photobox",
    kadoData: { caption: "kenangan yang paling kuingat 🤍" },
    createdAt: DEMO_DATE,
  },
  "demo-coupon": {
    id: "demo-coupon",
    targetName: "Kamu",
    message:
      "Buklet demo ini isinya kupon yang bisa disobek satu-satu. Kalau aslinya, isinya janji-janjimu sendiri — klaim kapan pun kamu mau.",
    senderName: "Rizri",
    fomoInitials: "R***I",
    kadoType: "coupon",
    kadoData: {
      coupons: JSON.stringify([
        { title: "1x Bebas Ngambek", desc: "Berlaku kapan pun, tanpa syarat." },
        { title: "1x Pelukan Gratis", desc: "Tukarkan saat sedang butuh." },
        { title: "1x Jajan Dibayarin", desc: "Sekali jajan, aku yang traktir." },
        { title: "1x Nemenin Nonton", desc: "Film pilihanmu, aku siap." },
      ]),
    },
    createdAt: DEMO_DATE,
  },
  "demo-candle": {
    id: "demo-candle",
    targetName: "Kamu",
    message:
      "Lilin demo ini boleh ditiup sepuasnya — bikin permintaan yang paling jujur, lalu tiup pelan. Kalau aslinya, pesan spesial menunggu di balik asapnya.",
    senderName: "Rizri",
    fomoInitials: "R***I",
    kadoType: "candle",
    kadoData: { occasion: "ultah" },
    createdAt: DEMO_DATE,
  },
  "demo-confess": {
    id: "demo-confess",
    targetName: "Kamu",
    message:
      "Aku udah nahan perasaan ini dari lama. Hari ini aku memutuskan untuk berhenti nahan — bukan biar kamu harus jawab, tapi biar kamu tahu.\n\nSeremoni buka suratnya: tahan hatinya, dengarkan detaknya.",
    senderName: "Rizri",
    fomoInitials: "R***I",
    kadoType: "confess",
    kadoData: null,
    createdAt: DEMO_DATE,
  },
  "demo-timeline": {
    id: "demo-timeline",
    targetName: "Kamu",
    message:
      "Kalau dipikir-pikir, kita udah jalan jauh banget ya. Halaman ini yang ingetin kalau kamu lupa sejauh mana kita sudah berjalan.",
    senderName: "Rizri",
    fomoInitials: "R***I",
    kadoType: "timeline",
    kadoData: {
      moments: JSON.stringify([
        { date: "12 FEB 2025", caption: "Chat pertama: 'hujan, boleh minta pullutan?'" },
        { date: "1 MAR 2025", caption: "Nonton pertama — kamu ketiduran 20 menit" },
        { date: "17 APR 2025", caption: "Jadian! (di tengah hujan lagi, kebetulan)" },
        { date: "HARI INI", caption: "Masih kangen, masih kalian 💜" },
      ]),
      music: "musicbox",
      endingType: "voucher",
      endingText: "FREE-PELUK-SEUMUR-HIDUP",
    },
    createdAt: DEMO_DATE,
  },
  "demo-playlist": {
    id: "demo-playlist",
    targetName: "Kamu",
    message:
      "Lagu ini nggak sengaja jadi lagu kita — sekarang dia mutar di sini, buat kamu. Geser jarumnya pelan-pelan, dengerin sampai habis ya.",
    senderName: "Rizri",
    fomoInitials: "R***I",
    kadoType: "playlist",
    // spotifyId null → PremiumPlaylist memakai lagu bawaan Kangenin
    kadoData: null,
    createdAt: DEMO_DATE,
  },
}

interface OpenPageProps {
  // Next 15+: params & searchParams adalah Promise — selalu di-await
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function OpenKadoPage({ params, searchParams }: OpenPageProps) {
  const { id } = await params
  const sp = await searchParams

  /**
   * Mode pratinjau (?pratinjau=1) — khusus si PENGIRIM yang mau intip kadonya
   * sebelum dikirim. Tidak pernah mengubah status: pengirim tidak lagi takut
   * "membakar" kadonya sendiri hanya karena buka linknya. Experience-nya sama
   * persis seperti yang diterima penerima (termasuk dilemma), cuma jawabannya
   * disimulasikan lokal — PATCH status tidak pernah dipanggil.
   */
  const previewMode = sp?.pratinjau === "1"

  // Kado demo (id demo-*) — dirender tanpa DB, selalu mode pratinjau.
  const demo = DEMO_KADOS[id]
  if (demo) {
    return <CinematicUnboxing preview kado={demo} />
  }

  // UUID salah format → tidak perlu ganggu database (kolom id bertipe uuid).
  if (!UUID_RE.test(id)) {
    return (
      <Shell>
        <NotFoundCard />
      </Shell>
    )
  }

  let kado: (KadoForUnboxing & { status: string }) | null = null
  let dbFailed = false

  try {
    // withDbRetry: koneksi zombie Hyperdrive diulang otomatis di koneksi baru
    const row = await withDbRetry(() =>
      db.kado.findUnique({
        where: { id },
        select: {
          id: true,
          targetName: true,
          message: true,
          senderName: true,
          fomoInitials: true,
          kadoType: true,
          kadoData: true,
          createdAt: true,
          status: true,
        },
      })
    )
    if (row) {
      kado = {
        id: row.id,
        targetName: row.targetName,
        message: row.message,
        senderName: row.senderName,
        fomoInitials: row.fomoInitials,
        kadoType: row.kadoType,
        kadoData: toKadoData(row.kadoData),
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
        status: row.status,
      }
    }
  } catch (err) {
    dbFailed = true
    console.error("GET /kado/[id] error:", describeError(err), err)
  }

  if (dbFailed) {
    return (
      <Shell>
        <ErrorCard />
      </Shell>
    )
  }
  if (!kado) {
    return (
      <Shell>
        <NotFoundCard />
      </Shell>
    )
  }

  // Kado cuma bisa dibuka sekali — sudah terbuka/terjawab → kenangan.
  // PENGECUALIAN: mode pratinjau tetap boleh (tanpa mengubah status) supaya
  // pengirim bisa mengintip kadonya kapan pun, sebelum maupun sesudah dibuka.
  if (kado.status !== "pending" && !previewMode) {
    return (
      <Shell glow={CONFESS_THEMES[themeFromKadoData(kado.kadoData)].glowTop}>
        <AlreadyOpenedCard />
      </Shell>
    )
  }

  return (
    <CinematicUnboxing
      preview={previewMode}
      kado={{
        id: kado.id,
        targetName: kado.targetName,
        message: kado.message,
        senderName: kado.senderName,
        fomoInitials: kado.fomoInitials,
        kadoType: kado.kadoType,
        kadoData: toKadoData(kado.kadoData),
      }}
    />
  )
}
