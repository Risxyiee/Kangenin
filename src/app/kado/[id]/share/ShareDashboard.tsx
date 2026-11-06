"use client"

/**
 * Share Dashboard — "The Anonymous Dashboard" (client component)
 *
 * Meja kendali si pengirim setelah kado dibuat di Creator Studio:
 *   1. The Wingman Alibi  — salin link mentah ATAU teks alibi si-tempel.
 *   2. The Ninja Drop     — QR code emerald, bisa diunduh jadi PNG (stiker).
 *   3. Kangenin WA Bot    — kartu premium, terkunci sampai fase integrasi bot.
 *
 * URL kado: nilai awal dihitung server (prop initialUrl, dipakai saat SSR agar
 * QR & teks tidak berkedip kosong), lalu setelah mount diganti
 * window.location.origin — sumber paling akurat di browser. Kalau keduanya
 * sama, tidak ada re-render sama sekali.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, useReducedMotion } from "framer-motion"
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Drama,
  Eye,
  EyeOff,
  Gift,
  Heart,
  Instagram,
  Loader2,
  Lock,
  MessageCircle,
  QrCode,
  Trash2,
  Twitter,
  type LucideIcon,
} from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import UlasanCard from "./UlasanCard"

// ─────────────────────────────────────────────────────────────────────────────
// Tipe & konstanta
// ─────────────────────────────────────────────────────────────────────────────

interface ShareDashboardProps {
  kadoId: string
  targetName: string
  kadoType: string
  /** "pending" | "opened" | "accepted" | "rejected" — dipakai kartu hapus. */
  kadoStatus: string
  /** URL lengkap hasil hitung server — dipakai sebelum client mount. */
  initialUrl: string
  isAnonymous: boolean
  senderName: string | null
  fomoInitials: string | null
}

/** Label ramah kadoType — fallback: tampilkan token mentahnya. */
const KADO_TYPE_LABEL: Record<string, string> = {
  fingerprint: "Sidik Jari",
  tap: "Tap Layar",
  scratch: "Kartu Gosok",
  quiz: "Kuis",
  bouquet: "Buket Bunga",
  openwhen: "Open When",
  photobox: "Photobox",
  coupon: "Love Coupon",
  candle: "Candle Blow",
  confess: "Confess",
  timeline: "Timeline Kisah",
  playlist: "Playlist",
}

/** Teks alibi persis seperti spesifikasi — [LINK] diganti URL kado asli. */
function buildAlibiText(url: string): string {
  return (
    "Eh, ada yang nitip pesan rahasia nih buat lo via Kangenin. " +
    `Katanya disuruh buka sendiri: ${url}`
  )
}

/** Copy ke clipboard + fallback browser lawas / konteks non-secure. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement("textarea")
      ta.value = text
      ta.setAttribute("readonly", "")
      ta.style.position = "fixed"
      ta.style.opacity = "0"
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand("copy")
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

/** Bentuk respons GET /api/kado/[id]/reply untuk polling dashboard. */
interface ReplyState {
  status: string | null
  reply: string | null
  repliedAt: string | null
  /** Statistik buka (ditulis POST /api/kado/[id]/opened di halaman kado). */
  openCount: number | null
  lastOpenedAt: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Komponen utama
// ─────────────────────────────────────────────────────────────────────────────

export default function ShareDashboard(props: ShareDashboardProps) {
  // null = belum mount (SSR pakai initialUrl) → setelah mount pakai origin browser
  const [origin, setOrigin] = useState<string | null>(null)
  const [copied, setCopied] = useState<"link" | "alibi" | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadFailed, setDownloadFailed] = useState(false)
  const [waNumber, setWaNumber] = useState("")

  const qrBoxRef = useRef<HTMLDivElement>(null)
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reduceMotion = useReducedMotion()

  useEffect(() => {
    setOrigin(window.location.origin)
    return () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current)
    }
  }, [])

  const kadoUrl = `${origin ?? props.initialUrl}/kado/${props.kadoId}`
  const alibiText = buildAlibiText(kadoUrl)

  /** Salin teks → feedback "Tersalin ✓" selama 2 detik. */
  async function handleCopy(which: "link" | "alibi") {
    const ok = await copyToClipboard(which === "link" ? kadoUrl : alibiText)
    if (copyResetRef.current) clearTimeout(copyResetRef.current)
    if (ok) {
      setCopyFailed(false)
      setCopied(which)
      copyResetRef.current = setTimeout(() => setCopied(null), 2000)
    } else {
      setCopied(null)
      setCopyFailed(true)
    }
  }

  /**
   * Download QR sebagai PNG: serialisasi <svg> → gambar ke canvas 640×640
   * di atas latar PUTIH solid → toBlob → unduh. Latar putih penting: QR
   * transparan yang dicetak di kertas gelap/berpola sering gagal discan,
   * sedangkan stiker putih selalu aman. Tampilan di layar tetap transparan
   * sesuai desain.
   */
  async function handleDownloadQr() {
    if (downloading) return
    setDownloading(true)
    setDownloadFailed(false)
    try {
      const svg = qrBoxRef.current?.querySelector("svg")
      if (!svg) throw new Error("QR belum dirender")

      if (!svg.getAttribute("xmlns")) {
        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg")
      }
      const xml = new XMLSerializer().serializeToString(svg)
      const svgUrl = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }))

      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error("SVG QR gagal dimuat"))
        img.src = svgUrl
      })

      const S = 640
      const canvas = document.createElement("canvas")
      canvas.width = S
      canvas.height = S
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas 2D tidak tersedia")
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, S, S)
      ctx.drawImage(img, 0, 0, S, S)
      URL.revokeObjectURL(svgUrl)

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
      if (!blob) throw new Error("PNG gagal dibuat")

      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = `kangenin-kado-${props.kadoId}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      // beri waktu browser mulai unduh sebelum revoke
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    } catch (err) {
      console.error("Download QR gagal:", err)
      setDownloadFailed(true)
    } finally {
      setDownloading(false)
    }
  }

  const typeLabel = KADO_TYPE_LABEL[props.kadoType] ?? props.kadoType

  return (
    <main className="min-h-dvh bg-zinc-950 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.10),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(244,63,94,0.12),transparent_55%)] px-4 py-8 text-zinc-100">
      <div className="mx-auto w-full max-w-md">
        {/* Header */}
        <header className="mb-6">
          <Link
            href="/create"
            className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Studio
          </Link>

          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-500/15 shadow-[0_0_24px_-6px_rgba(16,185,129,0.6)]">
              <Gift className="h-5 w-5 text-emerald-300" strokeWidth={1.75} />
            </div>
            <h1 className="text-2xl leading-snug font-bold tracking-tight text-white">
              Kado untuk{" "}
              <span className="bg-gradient-to-r from-rose-300 to-purple-300 bg-clip-text text-transparent">
                {props.targetName}
              </span>{" "}
              berhasil dibuat! ✨
            </h1>
          </div>

          {/* Chip ringkasan: kunci buka + identitas pengirim */}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
              🔑 Kunci: {typeLabel}
            </span>
            {props.isAnonymous || !props.fomoInitials ? (
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                <EyeOff className="h-3 w-3 text-zinc-400" />
                Dari: Seseorang
              </span>
            ) : (
              <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold tracking-wider text-rose-300">
                Dari: {props.fomoInitials}
              </span>
            )}
          </div>
        </header>

        {/* Pratinjau pengirim — intip sebelum dikirim tanpa mengunci kado */}
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.35, ease: "easeOut" }}
          className="mb-4 rounded-3xl border border-amber-300/25 bg-amber-400/[0.07] p-4 shadow-2xl shadow-black/40 backdrop-blur-md"
        >
          <Link
            href={`/kado/${props.kadoId}?pratinjau=1`}
            className="group flex items-center gap-3"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300/30 bg-amber-400/15 text-amber-300">
              <Eye className="h-4.5 w-4.5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white group-hover:text-amber-200">
                Lihat Pratinjau Kadonya 👁
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                Intip persis seperti yang dia alami nanti — kado <b className="text-amber-200/90">nggak akan terkunci</b>, jawabanmu cuma simulasi.
              </p>
            </div>
            <span className="shrink-0 text-xs font-semibold text-amber-300 transition-transform group-hover:translate-x-0.5">
              Buka →
            </span>
          </Link>
        </motion.div>

        {/* Balasan penerima — loop dua arah: dia jawab kado → pesannya muncul
            di sini. Polling 12 dtk + tombol muat ulang manual. Sekaligus
            statistik buka + tombol kabar WA (pesan terisi otomatis). */}
        <ReplyCard
          kadoId={props.kadoId}
          targetName={props.targetName}
          kadoUrl={kadoUrl}
          waNumber={waNumber}
        />

        {/* 3 kartu opsi pengiriman */}
        <div className="space-y-4">
          <Card delay={0} reduceMotion={reduceMotion ?? false}>
            <WingmanAlibiCard
              kadoUrl={kadoUrl}
              copied={copied}
              copyFailed={copyFailed}
              onCopy={handleCopy}
            />
          </Card>

          <Card delay={0.07} reduceMotion={reduceMotion ?? false}>
            <NinjaDropCard
              qrBoxRef={qrBoxRef}
              kadoUrl={kadoUrl}
              downloading={downloading}
              downloadFailed={downloadFailed}
              onDownload={handleDownloadQr}
            />
          </Card>

          <Card delay={0.14} reduceMotion={reduceMotion ?? false}>
            <WaBotCard waNumber={waNumber} onWaNumber={setWaNumber} />
          </Card>

          <Card delay={0.21} reduceMotion={reduceMotion ?? false}>
            <DangerZoneCard
              kadoId={props.kadoId}
              targetName={props.targetName}
              kadoStatus={props.kadoStatus}
            />
          </Card>

          {/* Ulasan — paling bawah, bisa di-skip sekali ketuk; jangan menghalangi
              alur share (aturan founder: user gak boleh kabur gara-gara form) */}
          <Card delay={0.28} reduceMotion={reduceMotion ?? false}>
            <UlasanCard kadoId={props.kadoId} />
          </Card>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          Simpan halaman ini — ini satu-satunya tempat kamu pegang link kadonya.
        </p>
      </div>
    </main>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Kartu balasan penerima — polling GET /api/kado/[id]/reply
// ─────────────────────────────────────────────────────────────────────────────

function ReplyCard({
  kadoId,
  targetName,
  kadoUrl,
  waNumber,
}: {
  kadoId: string
  targetName: string
  kadoUrl: string
  waNumber: string
}) {
  const [state, setState] = useState<ReplyState | null>(null)
  const [failed, setFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const reduceMotion = useReducedMotion()

  const load = useCallback(async () => {
    // tab di latar belakang → skip biar hemat baterai & kuota
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return
    setRefreshing(true)
    try {
      const res = await fetch(`/api/kado/${kadoId}/reply`, { cache: "no-store" })
      const json = (await res.json().catch(() => null)) as
        | (ReplyState & { success?: boolean })
        | null
      if (res.ok && json?.success) {
        setState({
          status: json.status ?? null,
          reply: json.reply ?? null,
          repliedAt: json.repliedAt ?? null,
          openCount: json.openCount ?? null,
          lastOpenedAt: json.lastOpenedAt ?? null,
        })
        setFailed(false)
      } else {
        setFailed(true)
      }
    } catch {
      setFailed(true)
    } finally {
      setRefreshing(false)
    }
  }, [kadoId])

  // muat pertama + polling tiap 12 detik
  useEffect(() => {
    load()
    const t = setInterval(load, 12_000)
    // tab balik ke depan → langsung segarkan, jangan nunggu tick berikutnya
    const onVisible = () => {
      if (document.visibilityState === "visible") load()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(t)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [load])

  const repliedAtLabel = state?.repliedAt
    ? new Date(state.repliedAt).toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null

  const lastOpenedAtLabel = state?.lastOpenedAt
    ? new Date(state.lastOpenedAt).toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null

  // Nudge WA — pesan terisi otomatis sesuai status kado. Teks TIDAK pernah
  // membocorkan identitas pengirim (tetap anonim): cuma ajakan buka/jawab.
  const waValid = waNumber.startsWith("62") && waNumber.length >= 10
  const waMessage = !state || state.status === "pending"
    ? `Psst… ada sesuatu buat kamu nih 🎁 coba buka: ${kadoUrl}`
    : `Jangan lupa jawab kado rahasianya ya 💌 dia nunggu balasanmu: ${kadoUrl}`

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.35, ease: "easeOut" }}
      className="mb-4 rounded-3xl border border-rose-400/25 bg-rose-500/[0.07] p-4 shadow-2xl shadow-black/40 backdrop-blur-md"
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-500/15 text-rose-300">
          <Heart className="h-4.5 w-4.5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">
            Balasan dari {targetName} 💬
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
            Kalau dia nulis balasan buatmu, pesannya muncul otomatis di sini.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          aria-label="Muat ulang balasan"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Loader2 className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {state?.reply ? (
        <div>
          <div className="rounded-2xl rounded-tl-sm border border-rose-400/20 bg-black/25 px-4 py-3">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-100">
              {state.reply}
            </p>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">
            Terkirim {repliedAtLabel ?? ""} — dari penerima, tanpa nama.
          </p>
        </div>
      ) : failed ? (
        <p className="text-xs text-zinc-500">
          Gagal cek balasan — koneksi lagi rewel. Coba tombol muat ulang di atas.
        </p>
      ) : state === null ? (
        <p className="text-xs text-zinc-500">Ngecek balasannya…</p>
      ) : state.status === "pending" ? (
        <p className="text-xs leading-relaxed text-zinc-500">
          Kadonya <span className="text-zinc-300">belum dibuka</span> — balasannya bakal muncul di sini setelah dia buka &amp; jawab.
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-zinc-500">
          Kadonya udah dibuka. <span className="text-zinc-300">Nunggu dia nulis balasan…</span> Pantauannya update sendiri tiap beberapa detik.
        </p>
      )}

      {/* Statistik buka — angka jujur: 1 hit per sesi browser per kado,
          pratinjau & demo tidak pernah dihitung. */}
      {state?.openCount != null && state.openCount > 0 && (
        <p className="mt-3 flex items-center gap-1.5 border-t border-white/5 pt-2.5 text-[11px] text-zinc-500">
          <Eye className="h-3 w-3 text-zinc-400" />
          <span>
            Kadonya udah dibuka <span className="font-semibold text-zinc-300">{state.openCount}×</span>
            {lastOpenedAtLabel ? (
              <> — terakhir {lastOpenedAtLabel}</>
            ) : null}
          </span>
        </p>
      )}

      {/* Kabarin dia — deep link WA dengan pesan siap-tempel. Muncul cuma
          kalau nomor target udah diisi di kartu WA Bot di bawah. */}
      {waValid && !state?.reply && (
        <a
          href={`https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20"
        >
          <MessageCircle className="h-4 w-4" />
          {state?.status === "pending" ? "Kabarin dia buka via WA 📲" : "Ingatkan dia bales via WA 📲"}
        </a>
      )}
    </motion.section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Zona Hapus — kado hilang permanen, link mati total
// ─────────────────────────────────────────────────────────────────────────────

function DangerZoneCard({
  kadoId,
  targetName,
  kadoStatus,
}: {
  kadoId: string
  targetName: string
  kadoStatus: string
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [error, setError] = useState("")

  async function handleDelete() {
    const sudahDibuka = kadoStatus && kadoStatus !== "pending"
    const ok = window.confirm(
      sudahDibuka
        ? `Kadonya udah dibuka${kadoStatus === "accepted" || kadoStatus === "rejected" ? " & dijawab" : ""}. Tetap hapus permanen kado untuk ${targetName}? Link-nya mati total dan nggak bisa dikembalikan.`
        : `Hapus permanen kado untuk ${targetName}? Link-nya mati total dan nggak bisa dikembalikan.`
    )
    if (!ok) return
    setDeleting(true)
    setError("")
    try {
      const res = await fetch(`/api/kado/${kadoId}`, { method: "DELETE" })
      // 404 = kadonya memang sudah tidak ada → anggap berhasil (idempoten),
      // jangan biarkan user kedua kalau tekan hapus kena error aneh.
      if (res.ok || res.status === 404) {
        setDeleted(true)
        setTimeout(() => router.replace("/create"), 1600)
      } else {
        const json = (await res.json().catch(() => null)) as { error?: string } | null
        setError(json?.error ?? "Gagal menghapus — coba lagi ya.")
      }
    } catch {
      setError("Koneksi bermasalah — coba lagi ya.")
    } finally {
      setDeleting(false)
    }
  }

  if (deleted) {
    return (
      <div className="py-2 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/15 text-emerald-300">
          <Check className="h-4.5 w-4.5" strokeWidth={2} />
        </div>
        <p className="mt-3 text-sm font-semibold text-white">Kadonya udah dihapus.</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Link-nya mati total — dibawa balik ke Studio…
        </p>
      </div>
    )
  }

  return (
    <div>
      <CardHeader
        icon={Trash2}
        tone="rose"
        title="Hapus Kado"
        desc="Menyesal atau salah kirim? Hapus permanen — link-nya langsung mati, isi kadonya hilang dari database."
      />
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={deleting}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200 transition-colors hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {deleting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Menghapus…
          </>
        ) : (
          <>
            <Trash2 className="h-4 w-4" />
            Hapus kado ini permanen
          </>
        )}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-300">
          {error}
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Wrapper kartu glassmorphism + fade-up ringan (cuma opacity & y)
// ─────────────────────────────────────────────────────────────────────────────

function Card({
  delay,
  reduceMotion,
  children,
}: {
  delay: number
  reduceMotion: boolean
  children: React.ReactNode
}) {
  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0 : 0.35,
        delay: reduceMotion ? 0 : delay,
        ease: "easeOut",
      }}
      className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/40 backdrop-blur-md"
    >
      {children}
    </motion.section>
  )
}

/** Header kecil di dalam kartu. */
function CardHeader({
  icon: Icon,
  tone,
  title,
  desc,
  badge,
}: {
  icon: LucideIcon
  tone: "rose" | "emerald" | "amber"
  title: string
  desc: string
  badge?: string
}) {
  const toneCls = {
    rose: "border-rose-400/30 bg-rose-500/15 text-rose-300",
    emerald: "border-emerald-400/30 bg-emerald-500/15 text-emerald-300",
    amber: "border-amber-300/30 bg-amber-400/15 text-amber-300",
  }[tone]

  return (
    <div className="mb-4 flex items-start gap-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${toneCls}`}>
        <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-white">
          {title}
          {badge && (
            <span className="rounded-full border border-amber-300/40 bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold tracking-widest text-amber-300 uppercase">
              {badge}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{desc}</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. The Wingman Alibi — Direct Link
// ─────────────────────────────────────────────────────────────────────────────

function WingmanAlibiCard({
  kadoUrl,
  copied,
  copyFailed,
  onCopy,
}: {
  kadoUrl: string
  copied: "link" | "alibi" | null
  copyFailed: boolean
  onCopy: (which: "link" | "alibi") => void
}) {
  // Status khusus tombol IG (teks alibi tersalin siap-tempel)
  const [igCopied, setIgCopied] = useState(false)
  const igResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (igResetRef.current) clearTimeout(igResetRef.current)
    },
    []
  )

  const alibiText = buildAlibiText(kadoUrl)

  /**
   * IG gak punya share-intent web seperti WA/X — satu-satunya jalan: kop
   * teks alibi dulu, lalu buka Instagram biar tinggal tempel di DM/story.
   * Feedback "Tersalin ✓" tetap ditampilkan 4 detik di tombolnya.
   */
  async function handleShareIg() {
    const ok = await copyToClipboard(alibiText)
    if (!ok) return
    setIgCopied(true)
    if (igResetRef.current) clearTimeout(igResetRef.current)
    igResetRef.current = setTimeout(() => setIgCopied(false), 4000)
    window.open("https://www.instagram.com/", "_blank", "noopener")
  }

  return (
    <div>
      <CardHeader
        icon={Drama}
        tone="rose"
        title="The Wingman Alibi"
        desc="Kirim langsung lewat chat. Pakai teks alibi biar kamu nggak ketahuan siapa pengirimnya."
      />

      {/* Kotak URL — readonly, bisa dilihat & disalin manual */}
      <div className="rounded-xl border border-white/10 bg-black/30 px-3.5 py-3">
        <p className="mb-1 text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
          Link kado
        </p>
        <p className="break-all font-mono text-xs leading-relaxed text-zinc-300 select-all">
          {kadoUrl}
        </p>
      </div>

      <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
        <button
          onClick={() => onCopy("link")}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/10"
        >
          {copied === "link" ? (
            <>
              <Check className="h-4 w-4 text-emerald-400" />
              Tersalin ✓
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy Link Saja
            </>
          )}
        </button>
        <button
          onClick={() => onCopy("alibi")}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-purple-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_0_24px_-6px_rgba(244,63,94,0.55)] transition-shadow hover:shadow-[0_0_32px_-4px_rgba(244,63,94,0.7)]"
        >
          {copied === "alibi" ? (
            <>
              <Check className="h-4 w-4" />
              Alibi Tersalin ✓
            </>
          ) : (
            <>
              <Drama className="h-4 w-4" />
              Copy Teks Alibi 🎭
            </>
          )}
        </button>
      </div>

      {copyFailed && (
        <p role="alert" className="mt-2 text-xs text-rose-300">
          Gagal menyalin — salin manual dari kotak link di atas ya.
        </p>
      )}

      {/* Share satu-tap ke medsos — WA & X membuka aplikasi dengan teks alibi
          udah terisi; IG gak punya intent web, jadi teksnya dikop dulu lalu
          Instagram dibuka otomatis. */}
      <div className="mt-4 border-t border-white/5 pt-4">
        <p className="mb-2 text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
          Bagikan langsung
        </p>
        <div className="grid grid-cols-3 gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(alibiText)}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-2 py-2.5 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20"
          >
            <MessageCircle className="h-4 w-4" />
            WA
          </a>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(alibiText)}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-white/15 bg-white/5 px-2 py-2.5 text-xs font-semibold text-zinc-200 transition-colors hover:bg-white/10"
          >
            <Twitter className="h-4 w-4" />
            X / Twitter
          </a>
          <button
            type="button"
            onClick={() => void handleShareIg()}
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-pink-400/30 bg-gradient-to-r from-pink-500/15 to-purple-500/15 px-2 py-2.5 text-xs font-semibold text-pink-200 transition-colors hover:from-pink-500/25 hover:to-purple-500/25"
          >
            {igCopied ? <Check className="h-4 w-4" /> : <Instagram className="h-4 w-4" />}
            {igCopied ? "Tersalin ✓" : "IG"}
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
          WA &amp; X langsung buka aplikasinya dengan teks udah terisi. Untuk IG:
          teks alibi otomatis tersalin — tinggal tempel di DM atau story
          (pakai stiker link biar bisa diklik).
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. The Ninja Drop — QR Code
// ─────────────────────────────────────────────────────────────────────────────

function NinjaDropCard({
  qrBoxRef,
  kadoUrl,
  downloading,
  downloadFailed,
  onDownload,
}: {
  qrBoxRef: React.RefObject<HTMLDivElement | null>
  kadoUrl: string
  downloading: boolean
  downloadFailed: boolean
  onDownload: () => void
}) {
  return (
    <div>
      <CardHeader
        icon={QrCode}
        tone="emerald"
        title="The Ninja Drop"
        desc="Cetak atau jadikan stiker lalu tempel diam-diam di helm/mejanya."
      />

      <div className="flex flex-col items-center gap-4">
        {/* QR: garis emerald-500 (#10b981), latar SVG transparan — panel putih
            di bawahnya bagian desain kartu, menjaga QR tetap mudah discan. */}
        <div
          ref={qrBoxRef}
          className="rounded-2xl bg-white p-4 shadow-[0_8px_32px_-12px_rgba(16,185,129,0.5)]"
        >
          <QRCodeSVG
            value={kadoUrl}
            size={168}
            bgColor="transparent"
            fgColor="#10b981"
            level="M"
            marginSize={1}
            title="QR Code kado Kangenin"
          />
        </div>

        <button
          onClick={onDownload}
          disabled={downloading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {downloading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Menyiapkan PNG…
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Download QR Code ⬇️
            </>
          )}
        </button>
        {downloadFailed && (
          <p role="alert" className="text-xs text-rose-300">
            Download gagal — coba screenshot QR di atas ya.
          </p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Kangenin WA Bot — VIP Delivery (Coming Soon)
// ─────────────────────────────────────────────────────────────────────────────

function WaBotCard({
  waNumber,
  onWaNumber,
}: {
  waNumber: string
  onWaNumber: (v: string) => void
}) {
  return (
    <div className="relative overflow-hidden">
      {/* kilau premium halus */}
      <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />

      <CardHeader
        icon={MessageCircle}
        tone="amber"
        title="Kangenin WA Bot"
        desc="Kurir rahasia langsung ke WhatsApp target — tanpa jejak namamu."
        badge="VIP Delivery"
      />

      <label htmlFor="waNumber" className="mb-1.5 block text-xs font-medium text-zinc-400">
        No. WA Target (Mulai 62...)
      </label>
      <input
        id="waNumber"
        inputMode="numeric"
        value={waNumber}
        onChange={(e) => onWaNumber(e.target.value.replace(/\D/g, "").slice(0, 16))}
        placeholder="6281234567890"
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors duration-200 focus:border-amber-300/50 focus:bg-white/[0.07] focus:ring-2 focus:ring-amber-400/20"
      />

      <button
        disabled
        aria-disabled="true"
        title="Fitur ini akan hadir di fase berikutnya"
        className="mt-3 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-amber-300/20 bg-amber-400/5 px-4 py-3 text-sm font-semibold text-amber-200/50"
      >
        <Lock className="h-4 w-4" />
        Kirim via Bot (Coming Soon)
      </button>

      <p className="mt-2 text-xs leading-relaxed text-zinc-500">
        Isi nomor target di sini → tombol <span className="text-emerald-300">kabarin via WA</span> di kartu
        balasan di atas langsung aktif — pesannya terisi otomatis, tetap tanpa jejak namamu ✈️
      </p>
    </div>
  )
}
