import type { Metadata } from "next"
import { headers } from "next/headers"
import Link from "next/link"
import { db, withDbRetry } from "@/lib/db"
import { describeError } from "@/lib/log-error"
import { PackageOpen, ServerCrash } from "lucide-react"
import ReloadButton from "./ReloadButton"
import ShareDashboard from "./ShareDashboard"

/**
 * Share Dashboard — halaman privat si pengirim kado.
 *
 * Server Component: ambil data kado dari Supabase (Prisma via Hyperdrive —
 * aturan mutlak: koneksi HANYA lewat src/lib/db.ts, direct connection 5432).
 * Interaksi (copy, download QR, input WA) ada di ShareDashboard (client).
 *
 * Runtime: TANPA `export const runtime = "edge"` — OpenNext Cloudflare
 * meng-compile seluruh app menjadi satu Worker edge (bukti & penjelasan
 * lengkap: src/app/api/kado/route.ts).
 *
 * Privasi: halaman ini memegang LINK kado — jangan diindeks mesin pencari.
 * Isi pesan & kadoData TIDAK dikirim ke client; itu rahasia target saat
 * membuka kado, bukan untuk dipajang di dashboard pengirim.
 */
export const metadata: Metadata = {
  title: "Kado siap dikirim — Kangenin",
  robots: { index: false, follow: false },
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Base URL untuk link kado.
 * Urutan: NEXT_PUBLIC_APP_URL (mis. custom domain) → header request
 * (x-forwarded-host/host + x-forwarded-proto, tersedia di Worker OpenNext)
 * → fallback domain produksi. Client akan memvalidasi ulang dengan
 * window.location.origin setelah mount.
 */
async function getBaseUrl(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (envUrl) return envUrl.replace(/\/+$/, "")

  try {
    const h = await headers()
    const host = h.get("x-forwarded-host") ?? h.get("host")
    if (host) {
      const isLocal = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(host)
      const proto = h.get("x-forwarded-proto") ?? (isLocal ? "http" : "https")
      return `${proto}://${host}`
    }
  } catch {
    // headers() tak tersedia (mis. pra-render statis) — jatuh ke fallback
  }
  return "https://kangenin.risyxieee123.workers.dev"
}

// ─────────────────────────────────────────────────────────────────────────────
// UI fallback
// ─────────────────────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-950 bg-[radial-gradient(ellipse_at_top,rgba(244,63,94,0.10),transparent_55%)] px-4 py-8 text-zinc-100">
      <div className="w-full max-w-md">{children}</div>
    </main>
  )
}

function NotFoundCard({ id }: { id: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-800/60">
        <PackageOpen className="h-6 w-6 text-zinc-400" strokeWidth={1.75} />
      </div>
      <p className="mt-4 text-5xl font-black tracking-tight text-zinc-700">404</p>
      <h1 className="mt-2 text-lg font-bold text-white">Kado nggak ketemu</h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        Linknya mungkin salah ketik, kadonya sudah dihapus, atau memang belum pernah ada.
        {UUID_RE.test(id) ? "" : " (Format link tidak valid.)"}
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

function ErrorCard() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-500/15">
        <ServerCrash className="h-6 w-6 text-rose-300" strokeWidth={1.75} />
      </div>
      <h1 className="mt-4 text-lg font-bold text-white">Servernya lagi ngambek</h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        Kado kamu mungkin aman — cuma koneksinya yang lagi rewel. Coba muat ulang halaman ini.
      </p>
      <ReloadButton />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Halaman
// ─────────────────────────────────────────────────────────────────────────────

interface SharePageProps {
  // Next 15+: params adalah Promise — selalu di-await
  params: Promise<{ id: string }>
}

export default async function SharePage({ params }: SharePageProps) {
  const { id } = await params

  // UUID salah format → tidak perlu ganggu database (kolom id bertipe uuid;
  // query dengan string acak cuma menghasilkan error 22P02 di log).
  if (!UUID_RE.test(id)) {
    return (
      <Shell>
        <NotFoundCard id={id} />
      </Shell>
    )
  }

  let kado: {
    id: string
    targetName: string
    kadoType: string
    status: string
    senderName: string | null
    fomoInitials: string | null
  } | null = null
  let dbFailed = false

  try {
    // withDbRetry: koneksi zombie Hyperdrive diulang otomatis di koneksi baru
    kado = await withDbRetry(() =>
      db.kado.findUnique({
        where: { id },
        select: {
          id: true,
          targetName: true,
          kadoType: true,
          // status dipakai kartu hapus: teks peringatan berbeda kalau kado
          // sudah dibuka / dijawab penerima
          status: true,
          senderName: true,
          fomoInitials: true,
        },
      })
    )
  } catch (err) {
    dbFailed = true
    console.error("GET /kado/[id]/share error:", describeError(err), err)
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
        <NotFoundCard id={id} />
      </Shell>
    )
  }

  const baseUrl = await getBaseUrl()
  const initialUrl = `${baseUrl}/kado/${kado.id}`

  return (
    <ShareDashboard
      kadoId={kado.id}
      targetName={kado.targetName}
      kadoType={kado.kadoType}
      kadoStatus={kado.status}
      initialUrl={initialUrl}
      // senderName boleh tampil di dashboard pengirim (dia pemiliknya) —
      // target tetap hanya melihat fomoInitials.
      isAnonymous={kado.senderName === null}
      senderName={kado.senderName}
      fomoInitials={kado.fomoInitials}
    />
  )
}
