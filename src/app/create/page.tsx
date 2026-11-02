"use client"

/**
 * Creator Studio Kangenin — halaman /create
 *
 * Wizard 3 langkah untuk merangkai kado kejutan premium (alur kunci lama
 * fingerprint/tap/scratch/quiz SUDAH DIHAPUS — pilihannya kini 8 pengalaman
 * premium, tanpa duplikasi):
 *   1. Pesan & identitas FOMO (anonim total default, inisial bertopeng "R***I")
 *   2. Pilih kado kejutan (bouquet / openwhen / photobox / coupon / candle /
 *      confess / timeline / playlist)
 *   3. Ringkasan + Generate Link Kado → POST /api/kado → redirect /kado/[id]/share
 *
 * Catatan integrasi:
 * - Identitas FOMO diproses lewat buildFomoIdentity() dari @/utils/fomoLogic,
 *   helper yang sama yang dipakai API → payload selalu konsisten dengan model Kado.
 * - fomoInitials dihitung ulang di SERVER — klien cuma kirim senderName + isAnonymous.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  EyeOff,
  Flame,
  Flower2,
  Gift,
  Heart,
  History,
  Images,
  ImagePlus,
  Loader2,
  Mail,
  Music,
  Palette,
  Stamp,
  Ticket,
  UserRound,
  Wand2,
  type LucideIcon,
} from "lucide-react"
import { CONFESS_THEMES, isThemeSelectable, THEME_KEYS, type ThemeKey } from "@/lib/themes"
import { buildFomoIdentity, toFomoInitials } from "@/utils/fomoLogic"
import { extractSpotifyTrackId } from "@/utils/spotify"
import { FETCH_TIMEOUT_MESSAGE, fetchWithTimeout, isTimeoutError } from "@/lib/fetch-timeout"
import { saveKadoHistoryEntry } from "@/lib/kado-history"
import { compressImageFile, PHOTO_ACCEPT } from "@/lib/image-compress"
import { AiAssistButton } from "@/components/ui/ai-assist"

// ─────────────────────────────────────────────────────────────────────────────
// Tipe & konstanta
// ─────────────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3
type KadoType =
  | "bouquet"
  | "openwhen"
  | "photobox"
  | "coupon"
  | "candle"
  | "confess"
  | "timeline"
  | "playlist"

/** Payload yang dikirim Creator Studio ke POST /api/kado. */
interface KadoCreatePayload {
  targetName: string
  message: string
  /** null = anonim total — fomoInitials dihitung ulang di server. */
  senderName: string | null
  isAnonymous: boolean
  kadoType: KadoType
  kadoData: Record<string, string | number> | null
}

/** Bentuk respons POST /api/kado. */
type KadoApiResponse = { success?: boolean; data?: { id?: string }; error?: string }

/** Delapan pengalaman premium — HANYA ini (tanpa opsi bawaan lama). */
const KADO_OPTIONS: { value: KadoType; label: string; desc: string; icon: LucideIcon }[] = [
  { value: "bouquet", label: "Buket Bunga", desc: "Tarik pita, bunga mekar", icon: Flower2 },
  { value: "openwhen", label: "Open When", desc: "Segel lilin surat kangen", icon: Stamp },
  { value: "photobox", label: "Photobox", desc: "Goyang HP buat cuci foto", icon: Camera },
  { value: "coupon", label: "Love Coupon", desc: "Sobek tiket buat klaim", icon: Ticket },
  { value: "candle", label: "Candle Blow", desc: "Tiup lilin lewat mic", icon: Flame },
  { value: "confess", label: "Confess", desc: "Tahan hati, buka pengakuan", icon: Heart },
  { value: "timeline", label: "Timeline Kisah", desc: "Gulir kenangan, musik latar", icon: Images },
  { value: "playlist", label: "Playlist Lagu", desc: "Geser jarum, putar lagu kalian", icon: Music },
]

/** Konfigurasi default per kadoType — interaksi lain bawaan komponen premiumnya. */
const DEFAULT_KADO_DATA: Record<KadoType, Record<string, string | number> | null> = {
  bouquet: null, // interaksinya bawaan PremiumBouquet (pita emas)
  openwhen: null, // interaksinya bawaan PremiumOpenWhen (judul & prompt default)
  photobox: null, // kadoData dibangun saat generate: { caption, photos: JSON.stringify([...]) }
  coupon: null, // kadoData dibangun saat generate: { coupons: JSON.stringify([...]) }
  candle: null, // kadoData dibangun saat generate: { occasion }
  confess: null, // interaksi bawaan PremiumConfess (tahan lambang hati)
  timeline: null, // kadoData dibangun saat generate: { moments, music, endingType, endingText }
  playlist: null, // kadoData dibangun saat generate: { spotifyId } — kosong = lagu bawaan
}

/** Baris kupon awal di Creator Studio — 5 klasic, bisa diedit/ditambah (maks 6). */
const DEFAULT_COUPON_ROWS: { title: string; desc: string }[] = [
  { title: "1x Bebas Ngambek", desc: "Berlaku kapan pun, tanpa syarat." },
  { title: "1x Pelukan Gratis", desc: "Tukarkan saat sedang butuh." },
  { title: "1x Jajan Dibayarin", desc: "Sekali jajan, aku yang traktir." },
  { title: "1x Nemenin Nonton", desc: "Film pilihanmu, aku siap." },
  { title: "1x Minta Apa Aja", desc: "Selama nggak melawan hukum 😉" },
]

const COUPON_MAX = 6
const COUPON_MIN = 3

/** Photobox: batas foto per strip — ditampilkan jelas di form (min/maks). */
const PHOTOBOX_MIN = 3
const PHOTOBOX_MAX = 4

/** Timeline: batas momen per kisah — ditampilkan jelas di form (min/maks). */
const TIMELINE_MIN = 3
const TIMELINE_MAX = 10

/** Baris momen awal Timeline — 3 kosong, bisa ditambah sampai 10. */
const DEFAULT_TIMELINE_ROWS: { date: string; caption: string; photo: string | null }[] = [
  { date: "", caption: "", photo: null },
  { date: "", caption: "", photo: null },
  { date: "", caption: "", photo: null },
]

const TIMELINE_MUSIC_PILLS: { value: "musicbox" | "lullaby" | "senja" | "none"; label: string }[] = [
  { value: "musicbox", label: "🎁 Kotak Musik" },
  { value: "lullaby", label: "🌙 Nina Bobo" },
  { value: "senja", label: "🌆 Gitar Senja" },
  { value: "none", label: "🔇 Tanpa Musik" },
]

/** Kelas input bersama biar semua field seragam & elegan. */
const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100 " +
  "placeholder:text-zinc-500 outline-none transition-colors duration-200 " +
  "focus:border-rose-400/50 focus:bg-white/[0.07] focus:ring-2 focus:ring-rose-500/20"

/** Transisi antar langkah: cuma x & opacity — ringan di HP. */
const stepVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 56 : -56, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -56 : 56, opacity: 0 }),
}

// ─────────────────────────────────────────────────────────────────────────────
// Halaman utama (state machine wizard)
// ─────────────────────────────────────────────────────────────────────────────

export default function CreatePage() {
  const [step, setStep] = useState<Step>(1)
  const [dir, setDir] = useState<1 | -1>(1) // arah slide: 1 = maju, -1 = mundur

  // Form data — penampung sebelum dikirim ke API
  const [targetName, setTargetName] = useState("")
  const [message, setMessage] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(true) // default: anonim total
  const [senderName, setSenderName] = useState("")
  const [kadoType, setKadoType] = useState<KadoType | null>(null)
  const [kadoData, setKadoData] = useState<Record<string, string | number> | null>(null)
  /** Tema warna kado (semua tipe) — ikut tersimpan di kadoData.theme. */
  const [giftTheme, setGiftTheme] = useState<ThemeKey>("rose")
  /** Editor kupon (kadoType "coupon") — dikodekan ke kadoData.coupons saat generate. */
  const [couponRows, setCouponRows] = useState(DEFAULT_COUPON_ROWS)
  /** Momen lilin (kadoType "candle") — mengubah narasi ritual Wish Keeper. */
  const [occasion, setOccasion] = useState<"ultah" | "anniversary" | "graduasi">("ultah")
  /** Editor Photobox: foto terkompresi (data URL) + caption tulisan tangan. */
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [photoboxCaption, setPhotoboxCaption] = useState("")
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  /** Editor Timeline Kisah: momen (tanggal+caption+foto), musik, kejutan penutup. */
  const [timelineRows, setTimelineRows] = useState(DEFAULT_TIMELINE_ROWS)
  const [timelineMusic, setTimelineMusic] = useState<"musicbox" | "lullaby" | "senja" | "none">("musicbox")
  const [timelineEnding, setTimelineEnding] = useState<"pesan" | "voucher">("pesan")
  const [timelineEndingText, setTimelineEndingText] = useState("")
  const [timelinePhotoBusy, setTimelinePhotoBusy] = useState<number | null>(null)
  /** Kado Playlist (lagu): link Spotify opsional — kosong = lagu bawaan Kangenin. */
  const [playlistUrl, setPlaylistUrl] = useState("")

  const [generating, setGenerating] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const reduceMotion = useReducedMotion()
  const router = useRouter()

  // Praseleksi tipe kado dari query (?tipe=timeline) — dipakai CTA landing.
  useEffect(() => {
    if (kadoType) return
    const tipe = new URLSearchParams(window.location.search).get("tipe")
    if (tipe && KADO_OPTIONS.some((o) => o.value === tipe)) {
      selectKado(tipe as KadoType)
    }
  }, [])

  const canNextStep1 = targetName.trim().length > 0 && message.trim().length > 0
  /** Kupon butuh minimal 3 judul terisi sebelum boleh lanjut. */
  const couponValid =
    kadoType !== "coupon" || couponRows.filter((r) => r.title.trim()).length >= COUPON_MIN
  /** Photobox butuh minimal 3 foto terunggah. */
  const photoboxValid = kadoType !== "photobox" || photoUrls.length >= PHOTOBOX_MIN
  /** Timeline butuh minimal 3 momen ber-caption + isi kejutan penutup. */
  const timelineValid =
    kadoType !== "timeline" ||
    (timelineRows.filter((r) => r.caption.trim().length >= 2).length >= TIMELINE_MIN &&
      timelineEndingText.trim().length >= 3)
  /** Playlist: link Spotify opsional — kalau diisi HARUS link track valid. */
  const playlistSpotifyId = extractSpotifyTrackId(playlistUrl)
  const playlistValid = kadoType !== "playlist" || (playlistUrl.trim() === "" || playlistSpotifyId !== null)
  const canPreview =
    kadoType !== null && couponValid && photoboxValid && timelineValid && playlistValid

  function goTo(next: Step, direction: 1 | -1) {
    setDir(direction)
    setStep(next)
  }

  /** Pilih tipe kado → kadoData langsung diisi default-nya. */
  function selectKado(type: KadoType) {
    setKadoType(type)
    setKadoData(DEFAULT_KADO_DATA[type])
    if (type === "coupon" && !couponRows.some((r) => r.title.trim())) {
      setCouponRows(DEFAULT_COUPON_ROWS)
    }
  }

  /**
   * Unggah + kompres foto Photobox di klien — tiap berkas dijadikan data URL
   * JPEG ≤ 200 ribu karakter (di bawah plafon API). Gagal satu berkas tidak
   * membatalkan yang lain; pesan errornya ditampilkan di bawah uploader.
   */
  async function handleAddPhotos(files: FileList | null) {
    if (!files || files.length === 0 || photoBusy) return
    setPhotoBusy(true)
    setPhotoError(null)
    const added: string[] = []
    let lastError: string | null = null
    for (const file of Array.from(files)) {
      if (photoUrls.length + added.length >= PHOTOBOX_MAX) break
      try {
        added.push(await compressImageFile(file))
      } catch (e) {
        lastError = e instanceof Error ? e.message : "Gagal memproses salah satu foto"
      }
    }
    if (added.length) setPhotoUrls((prev) => [...prev, ...added].slice(0, PHOTOBOX_MAX))
    setPhotoError(lastError)
    setPhotoBusy(false)
  }

  /**
   * Unggah + kompres foto untuk SATU momen timeline.
   */
  async function handleAddMomentPhoto(index: number, files: FileList | null) {
    if (!files || files.length === 0 || timelinePhotoBusy !== null) return
    setTimelinePhotoBusy(index)
    try {
      const url = await compressImageFile(files[0])
      setTimelineRows((prev) =>
        prev.map((r, j) => (j === index ? { ...r, photo: url } : r))
      )
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Gagal memproses foto")
    } finally {
      setTimelinePhotoBusy(null)
    }
  }

  /** Simpan kado via POST /api/kado, lalu redirect ke halaman share. */
  async function handleGenerate() {
    if (!kadoType || generating) return
    setGenerating(true)
    setErrorMsg(null)

    try {
      // kadoData final dibangun di sini — API hanya menerima string/number,
      // jadi daftar kupon dikodekan JSON string (komponen mem-parse ulang).
      let finalKadoData = kadoData
      if (kadoType === "coupon") {
        finalKadoData = {
          coupons: JSON.stringify(
            couponRows
              .filter((r) => r.title.trim())
              .map((r) => ({ title: r.title.trim().slice(0, 40), desc: r.desc.trim().slice(0, 80) }))
          ),
        }
      } else if (kadoType === "candle") {
        finalKadoData = { occasion }
      } else if (kadoType === "photobox") {
        finalKadoData = {
          caption: photoboxCaption.trim().slice(0, 60),
          photos: JSON.stringify(photoUrls),
        }
      } else if (kadoType === "timeline") {
        finalKadoData = {
          moments: JSON.stringify(
            timelineRows
              .filter((r) => r.caption.trim().length >= 2)
              .map((r) => ({
                date: r.date.trim().slice(0, 30),
                caption: r.caption.trim().slice(0, 140),
                ...(r.photo ? { photo: r.photo } : {}),
              }))
          ),
          music: timelineMusic,
          endingType: timelineEnding,
          endingText: timelineEndingText.trim().slice(0, 400),
        }
      } else if (kadoType === "playlist") {
        // ID track diekstrak di klien (link apa pun bentuknya) — API cuma
        // terima string pendek. Kosong → null → PremiumPlaylist pakai lagu
        // bawaan Kangenin.
        finalKadoData = playlistSpotifyId ? { spotifyId: playlistSpotifyId } : null
      }

      // Tema warna ikut SEMUA tipe kado — selipkan setelah kadoData tipe
      // terbentuk, supaya tidak tertimpa blok di atas. API menerima string.
      finalKadoData = { ...(finalKadoData ?? {}), theme: giftTheme }

      const payload: KadoCreatePayload = {
        targetName: targetName.trim(),
        message: message.trim(),
        senderName: isAnonymous ? null : senderName.trim() || null,
        isAnonymous,
        kadoType,
        kadoData: finalKadoData,
      }

      const res = await fetchWithTimeout(
        "/api/kado",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        20_000
      )
      const json = (await res.json().catch(() => null)) as KadoApiResponse | null

      if (res.ok && json?.success && json.data?.id) {
        // Ghost Dashboard: catat kado ini ke riwayat perangkat (localStorage)
        // SEBELUM redirect — kalau tab tertutup, /history tetap menemukannya.
        // Gagal simpan riwayat tidak boleh menggagalkan kado (no-throw).
        saveKadoHistoryEntry({
          id: json.data.id,
          title: `Untuk ${targetName.trim()}`,
          type: kadoType,
        })
        router.push(`/kado/${json.data.id}/share`)
        return
      }
      setErrorMsg(json?.error ?? "Gagal membuat kado. Coba lagi ya.")
    } catch (e) {
      setErrorMsg(
        isTimeoutError(e)
          ? FETCH_TIMEOUT_MESSAGE
          : "Koneksi bermasalah — cek internetmu lalu coba lagi ya."
      )
    } finally {
      setGenerating(false)
    }
  }

  return (
    <main className="min-h-dvh bg-zinc-950 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.14),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(244,63,94,0.10),transparent_55%)] px-4 py-8 text-zinc-100">
      <div className="mx-auto w-full max-w-md">
        {/* Header */}
        <header className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Beranda
            </Link>
            {/* Ghost Dashboard: pintasan ke riwayat kado perangkat ini */}
            <Link
              href="/history"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              <History className="h-3.5 w-3.5 text-rose-300" />
              Kado Saya
            </Link>
          </div>
          <span className="text-xs font-medium tracking-widest text-zinc-500 uppercase">
            Langkah {step}/3
          </span>
        </header>

        <h1 className="mb-1 text-2xl font-bold tracking-tight text-white">Creator Studio</h1>
        <p className="mb-6 text-sm text-zinc-400">
          Rangkai kado kejutan — pesan rahasia plus pengalaman bukanya.
        </p>

        {/* Indikator langkah */}
        <StepDots step={step} />

        {/* Card Glassmorphism */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/40 backdrop-blur-md sm:p-6">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={step}
              custom={dir}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: reduceMotion ? 0 : 0.28, ease: "easeOut" }}
            >
              {step === 1 && (
                <StepIdentity
                  targetName={targetName}
                  message={message}
                  isAnonymous={isAnonymous}
                  senderName={senderName}
                  canNext={canNextStep1}
                  onTargetName={setTargetName}
                  onMessage={setMessage}
                  onAnonymous={setIsAnonymous}
                  onSenderName={setSenderName}
                  onNext={() => goTo(2, 1)}
                />
              )}

              {step === 2 && (
                <StepLock
                  kadoType={kadoType}
                  canPreview={canPreview}
                  theme={giftTheme}
                  onTheme={setGiftTheme}
                  couponRows={couponRows}
                  onCouponRows={setCouponRows}
                  occasion={occasion}
                  onOccasion={setOccasion}
                  photoUrls={photoUrls}
                  photoboxCaption={photoboxCaption}
                  photoBusy={photoBusy}
                  photoError={photoError}
                  onPhotoboxCaption={setPhotoboxCaption}
                  onAddPhotos={handleAddPhotos}
                  onRemovePhoto={(i) => setPhotoUrls((prev) => prev.filter((_, j) => j !== i))}
                  timelineRows={timelineRows}
                  timelineMusic={timelineMusic}
                  timelineEnding={timelineEnding}
                  timelineEndingText={timelineEndingText}
                  timelinePhotoBusy={timelinePhotoBusy}
                  onTimelineRows={setTimelineRows}
                  onTimelineMusic={setTimelineMusic}
                  onTimelineEnding={setTimelineEnding}
                  onTimelineEndingText={setTimelineEndingText}
                  onAddMomentPhoto={handleAddMomentPhoto}
                  playlistUrl={playlistUrl}
                  playlistValid={playlistValid}
                  playlistSpotifyId={playlistSpotifyId}
                  onPlaylistUrl={setPlaylistUrl}
                  onSelectKado={selectKado}
                  onBack={() => goTo(1, -1)}
                  onNext={() => goTo(3, 1)}
                />
              )}

              {step === 3 && (
                <StepGenerate
                  targetName={targetName}
                  message={message}
                  isAnonymous={isAnonymous}
                  senderName={senderName}
                  kadoType={kadoType}
                  kadoData={kadoData}
                  couponCount={couponRows.filter((r) => r.title.trim()).length}
                  occasion={occasion}
                  photoCount={photoUrls.length}
                  timelineCount={timelineRows.filter((r) => r.caption.trim().length >= 2).length}
                  timelineEnding={timelineEnding}
                  playlistHasSong={kadoType === "playlist" && playlistSpotifyId !== null}
                  generating={generating}
                  errorMsg={errorMsg}
                  onBack={() => goTo(2, -1)}
                  onGenerate={handleGenerate}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          Dibuat dengan 💜 di Kangenin — kado kecil, rindu besar.
        </p>
      </div>
    </main>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Indikator langkah (CSS transition saja — super ringan)
// ─────────────────────────────────────────────────────────────────────────────

function StepDots({ step }: { step: Step }) {
  return (
    <div className="mb-5 flex gap-2" aria-label={`Langkah ${step} dari 3`}>
      {([1, 2, 3] as Step[]).map((n) => (
        <div
          key={n}
          className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
            n <= step ? "bg-gradient-to-r from-rose-500 to-purple-500" : "bg-white/10"
          }`}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Pesan & identitas FOMO
// ─────────────────────────────────────────────────────────────────────────────

interface StepIdentityProps {
  targetName: string
  message: string
  isAnonymous: boolean
  senderName: string
  canNext: boolean
  onTargetName: (v: string) => void
  onMessage: (v: string) => void
  onAnonymous: (v: boolean) => void
  onSenderName: (v: string) => void
  onNext: () => void
}

function StepIdentity(props: StepIdentityProps) {
  const initialsPreview = props.isAnonymous ? null : toFomoInitials(props.senderName)

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="targetName" className="mb-2 block text-sm font-medium text-zinc-300">
          Nama Target (Penerima)
        </label>
        <input
          id="targetName"
          value={props.targetName}
          onChange={(e) => props.onTargetName(e.target.value)}
          placeholder="Untuk siapa kado ini?"
          maxLength={60}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="message" className="mb-2 block text-sm font-medium text-zinc-300">
          Pesan Utama (Confess/Ucapan)
        </label>
        <textarea
          id="message"
          value={props.message}
          onChange={(e) => props.onMessage(e.target.value)}
          placeholder="Tulis apa yang selama ini pengen kamu sampaikan…"
          rows={5}
          maxLength={1000}
          className={`${inputCls} resize-none`}
        />
        <div className="mt-2">
          {/* draft otomatis via AI (NVIDIA bolt) — hasil tetap bisa diedit */}
          <AiAssistButton
            toName={props.targetName}
            fromName={props.isAnonymous ? "" : props.senderName}
            jenis="kado"
            onDraft={props.onMessage}
            blockedReason={
              props.targetName.trim().length === 0
                ? "Isi nama target dulu biar AI tahu buat siapa ✍️"
                : null
            }
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-medium text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>

      {/* Toggle anonim total */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
        <div className="pr-3">
          <p className="flex items-center gap-2 text-sm font-medium text-zinc-200">
            <EyeOff className="h-4 w-4 text-rose-300" />
            Kirim sebagai Anonim Total
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">Nama kamu nggak akan muncul sama sekali.</p>
        </div>
        <ToggleSwitch checked={props.isAnonymous} onChange={props.onAnonymous} />
      </div>

      {/* Input nama asli — hanya muncul kalau toggle dimatikan */}
      <AnimatePresence initial={false}>
        {!props.isAnonymous && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <label htmlFor="senderName" className="mb-2 block text-sm font-medium text-zinc-300">
              Nama Aslimu
            </label>
            <div className="relative">
              <input
                id="senderName"
                value={props.senderName}
                onChange={(e) => props.onSenderName(e.target.value)}
                placeholder="Siapa kamu?"
                maxLength={60}
                className={inputCls}
              />
              {initialsPreview && (
                <span className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold tracking-wider text-rose-300">
                  {initialsPreview}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Nama ini akan disembunyikan dan hanya muncul 2 huruf inisialnya untuk bikin target
              penasaran, misal: Rizqi → <span className="text-zinc-400">R***I</span>.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={props.onNext}
        disabled={!props.canNext}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-purple-500 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_0_24px_-6px_rgba(244,63,94,0.5)] transition-shadow hover:shadow-[0_0_32px_-4px_rgba(244,63,94,0.65)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
      >
        Lanjut Pilih Kado
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Pilih kado kejutan (6 pengalaman premium)
// ─────────────────────────────────────────────────────────────────────────────

interface StepLockProps {
  kadoType: KadoType | null
  canPreview: boolean
  /** Tema warna kado — glow latar halaman kado mengikuti pilihan ini. */
  theme: ThemeKey
  onTheme: (t: ThemeKey) => void
  /** Editor kupon — hanya aktif saat kadoType "coupon". */
  couponRows: { title: string; desc: string }[]
  onCouponRows: (rows: { title: string; desc: string }[]) => void
  /** Momen lilin — hanya aktif saat kadoType "candle". */
  occasion: "ultah" | "anniversary" | "graduasi"
  onOccasion: (v: "ultah" | "anniversary" | "graduasi") => void
  /** Editor Photobox — hanya aktif saat kadoType "photobox". */
  photoUrls: string[]
  photoboxCaption: string
  photoBusy: boolean
  photoError: string | null
  onPhotoboxCaption: (v: string) => void
  onAddPhotos: (files: FileList | null) => void
  onRemovePhoto: (index: number) => void
  /** Editor Timeline Kisah — hanya aktif saat kadoType "timeline". */
  timelineRows: { date: string; caption: string; photo: string | null }[]
  timelineMusic: "musicbox" | "lullaby" | "senja" | "none"
  timelineEnding: "pesan" | "voucher"
  timelineEndingText: string
  timelinePhotoBusy: number | null
  onTimelineRows: (rows: { date: string; caption: string; photo: string | null }[]) => void
  onTimelineMusic: (v: "musicbox" | "lullaby" | "senja" | "none") => void
  onTimelineEnding: (v: "pesan" | "voucher") => void
  onTimelineEndingText: (v: string) => void
  onAddMomentPhoto: (index: number, files: FileList | null) => void
  /** Editor Playlist Lagu — hanya aktif saat kadoType "playlist". */
  playlistUrl: string
  playlistValid: boolean
  playlistSpotifyId: string | null
  onPlaylistUrl: (v: string) => void
  onSelectKado: (type: KadoType) => void
  onBack: () => void
  onNext: () => void
}

const OCCASION_PILLS: { value: "ultah" | "anniversary" | "graduasi"; label: string }[] = [
  { value: "ultah", label: "🎂 Ulang Tahun" },
  { value: "anniversary", label: "💍 Anniversary" },
  { value: "graduasi", label: "🎓 Wisuda" },
]

function StepLock(props: StepLockProps) {
  return (
    <div className="space-y-5">
      <div>
        <p className="flex items-center gap-2 text-sm font-medium text-zinc-300">
          <Gift className="h-4 w-4 text-rose-300" />
          Pilih Kado Kejutannya
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Penerima harus mengalaminya dulu — menarik, menggoyang, menyobek,
          meniup, menahan — sebelum pesanmu terbuka.
        </p>
        {/* Demo per fitur — intip rasanya tanpa bikin kado */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-600">
          <span>Intip demo:</span>
          {KADO_OPTIONS.map((o) => (
            <a
              key={o.value}
              href={`/kado/demo-${o.value}?pratinjau=1`}
              target="_blank"
              rel="noreferrer"
              className="text-zinc-400 underline underline-offset-2 transition-colors hover:text-rose-300"
            >
              {o.label}
            </a>
          ))}
        </div>
      </div>

      {/* Grid radio cards */}
      <div role="radiogroup" aria-label="Tipe kado" className="grid grid-cols-2 gap-3">
        {KADO_OPTIONS.map((opt) => {
          const selected = props.kadoType === opt.value
          const Icon = opt.icon
          return (
            <button
              key={opt.value}
              role="radio"
              aria-checked={selected}
              onClick={() => props.onSelectKado(opt.value)}
              className={`relative rounded-2xl border p-4 text-left transition-all duration-200 ${
                selected
                  ? "border-rose-400/60 bg-rose-500/10 shadow-[0_0_24px_-8px_rgba(244,63,94,0.7)]"
                  : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/[0.08]"
              }`}
            >
              {selected && (
                <span className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white">
                  <Check className="h-3 w-3" />
                </span>
              )}
              <Icon
                className={`h-6 w-6 ${selected ? "text-rose-300" : "text-zinc-400"}`}
                strokeWidth={1.75}
              />
              <p className={`mt-3 text-sm font-semibold ${selected ? "text-white" : "text-zinc-200"}`}>
                {opt.label}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">{opt.desc}</p>
            </button>
          )
        })}
      </div>

      {/* Pemilih tema warna — satu sumber dengan tema confess (themes.ts).
          Glow latar halaman kado mengikuti pilihan ini, semua tipe kado. */}
      <div>
        <p className="flex items-center gap-2 text-sm font-medium text-zinc-300">
          <Palette className="h-4 w-4 text-rose-300" />
          Tema Warna Kadonya
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Latar &amp; suasana kadonya ikut warna ini — pilih yang paling kayak dia.
        </p>
        <div role="radiogroup" aria-label="Tema warna kado" className="mt-3 flex flex-wrap gap-2">
          {THEME_KEYS.map((key) => {
            const t = CONFESS_THEMES[key]
            const selectable = isThemeSelectable(key)
            const active = props.theme === key
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={!selectable}
                onClick={() => props.onTheme(key)}
                title={selectable ? `Tema ${t.name}` : "Edisi terbatasnya udah lewat"}
                className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-35 ${
                  active
                    ? "border-rose-400/60 bg-rose-500/15 text-white shadow-[0_0_18px_-6px_rgba(244,63,94,0.6)]"
                    : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/25 hover:bg-white/[0.08]"
                }`}
              >
                <span
                  aria-hidden
                  className="h-3.5 w-3.5 rounded-full border border-white/25"
                  style={{ backgroundColor: t.accent }}
                />
                {t.name}
                {t.limited && selectable && (
                  <span className="rounded-full border border-amber-300/40 bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-amber-300 uppercase">
                    11.11
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Momen lilin — hanya untuk Candle Blow (narasi ritual Wish Keeper) */}
      {props.kadoType === "candle" && (
        <div>
          <p className="mb-2 text-sm font-medium text-zinc-300">Momen apa yang dirayakan?</p>
          <div className="flex gap-2">
            {OCCASION_PILLS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => props.onOccasion(o.value)}
                className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                  props.occasion === o.value
                    ? "border-amber-300/60 bg-amber-400/15 text-amber-200"
                    : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Menentukan kata sambutan ritual menyalakan lilinnya nanti.
          </p>
        </div>
      )}

      {/* Editor buklet kupon — hanya untuk Love Coupon (3-6 kupon) */}
      {props.kadoType === "coupon" && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-300">Isi buklet kuponnya</p>
            <span className="text-xs text-zinc-500">
              {props.couponRows.filter((r) => r.title.trim()).length} kupon · min {COUPON_MIN}, maks {COUPON_MAX}
            </span>
          </div>
          <div className="space-y-2.5">
            {props.couponRows.map((row, i) => (
              <div key={i} className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-2.5">
                <span className="mt-2.5 text-[10px] font-bold tabular-nums text-zinc-500">{i + 1}.</span>
                <div className="flex-1 space-y-1.5">
                  <input
                    value={row.title}
                    onChange={(e) =>
                      props.onCouponRows(
                        props.couponRows.map((r, j) => (j === i ? { ...r, title: e.target.value } : r))
                      )
                    }
                    placeholder={`Judul kupon ${i + 1} — mis. "1x Masak Buatmu"`}
                    maxLength={40}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-rose-400/50 focus:ring-2 focus:ring-rose-500/20"
                  />
                  <input
                    value={row.desc}
                    onChange={(e) =>
                      props.onCouponRows(
                        props.couponRows.map((r, j) => (j === i ? { ...r, desc: e.target.value } : r))
                      )
                    }
                    placeholder="Syarat/catatan kecil (opsional)"
                    maxLength={80}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-rose-400/50 focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
                {props.couponRows.length > COUPON_MIN && (
                  <button
                    type="button"
                    aria-label={`Hapus kupon ${i + 1}`}
                    onClick={() => props.onCouponRows(props.couponRows.filter((_, j) => j !== i))}
                    className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs text-zinc-500 transition-colors hover:bg-rose-500/20 hover:text-rose-300"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {props.couponRows.length < COUPON_MAX && (
            <button
              type="button"
              onClick={() =>
                props.onCouponRows([...props.couponRows, { title: "", desc: "" }])
              }
              className="mt-2.5 w-full rounded-xl border border-dashed border-white/15 bg-white/[0.03] py-2 text-xs font-semibold text-zinc-400 transition-colors hover:border-rose-400/40 hover:text-rose-300"
            >
              + Tambah kupon lagi
            </button>
          )}
          <p className="mt-2 text-xs text-zinc-500">
            Penerima menyobeknya satu-satu — bikin tiap tiket terasa spesial.
          </p>
        </div>
      )}

      {/* Editor strip foto — hanya untuk Photobox (3-4 foto, dikompres di klien) */}
      {props.kadoType === "photobox" && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-300">Foto fotoboxnya</p>
            <span className="text-xs text-zinc-500">
              {props.photoUrls.length} foto · min {PHOTOBOX_MIN}, maks {PHOTOBOX_MAX}
            </span>
          </div>

          {/* Pratinjau foto terpilih */}
          {props.photoUrls.length > 0 && (
            <div className="mb-2.5 grid grid-cols-4 gap-2">
              {props.photoUrls.map((url, i) => (
                <div
                  key={i}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-white/5"
                >
                  <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    aria-label={`Hapus foto ${i + 1}`}
                    onClick={() => props.onRemovePhoto(i)}
                    className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[10px] text-zinc-300 transition-colors hover:bg-rose-500/80 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Tombol unggah — hilang saat kuota penuh */}
          {props.photoUrls.length < PHOTOBOX_MAX && (
            <label
              className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 bg-white/[0.03] py-5 transition-colors hover:border-rose-400/40 ${
                props.photoBusy ? "pointer-events-none opacity-60" : ""
              }`}
            >
              {props.photoBusy ? (
                <Loader2 className="h-5 w-5 animate-spin text-rose-300" />
              ) : (
                <ImagePlus className="h-5 w-5 text-rose-300" strokeWidth={1.75} />
              )}
              <span className="text-xs font-semibold text-zinc-300">
                {props.photoBusy
                  ? "Mengompres foto…"
                  : `+ Pilih foto (${PHOTOBOX_MAX - props.photoUrls.length} slot lagi)`}
              </span>
              <span className="text-[10px] text-zinc-600">
                JPG/PNG/WebP — otomatis dikompres biar ringan
              </span>
              <input
                type="file"
                accept={PHOTO_ACCEPT}
                multiple
                className="hidden"
                onChange={(e) => {
                  props.onAddPhotos(e.target.files)
                  e.target.value = "" // biarkan berkas sama bisa dipilih ulang
                }}
              />
            </label>
          )}
          {props.photoError && (
            <p role="alert" className="mt-2 text-xs text-rose-300">
              {props.photoError}
            </p>
          )}

          <label htmlFor="photoboxCaption" className="mt-3 mb-1.5 block text-xs font-medium text-zinc-400">
            Tulisan di bawah foto (opsional)
          </label>
          <input
            id="photoboxCaption"
            value={props.photoboxCaption}
            onChange={(e) => props.onPhotoboxCaption(e.target.value)}
            placeholder="mis. kenangan kita yang paling demen 🤍"
            maxLength={60}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-rose-400/50 focus:ring-2 focus:ring-rose-500/20"
          />
          <p className="mt-2 text-xs text-zinc-500">
            Foto pertama "dicuci" dengan goyangan — sisanya dia ketuk satu-satu.
          </p>
        </div>
      )}

      {/* Editor garis waktu — hanya untuk Timeline Kisah (3-10 momen) */}
      {props.kadoType === "timeline" && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-300">Momen-momen kisahnya</p>
            <span className="text-xs text-zinc-500">
              {props.timelineRows.filter((r) => r.caption.trim()).length} momen · min {TIMELINE_MIN}, maks {TIMELINE_MAX}
            </span>
          </div>

          <div className="space-y-2.5">
            {props.timelineRows.map((row, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                <div className="flex items-start gap-2">
                  <span className="mt-2.5 text-[10px] font-bold tabular-nums text-zinc-500">{i + 1}.</span>
                  <div className="flex-1 space-y-1.5">
                    <input
                      value={row.date}
                      onChange={(e) =>
                        props.onTimelineRows(
                          props.timelineRows.map((r, j) => (j === i ? { ...r, date: e.target.value } : r))
                        )
                      }
                      placeholder="Tanggal — mis. 12 Feb 2025 (opsional)"
                      maxLength={30}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-rose-200 placeholder:text-zinc-600 outline-none focus:border-rose-400/50 focus:ring-2 focus:ring-rose-500/20"
                    />
                    <input
                      value={row.caption}
                      onChange={(e) =>
                        props.onTimelineRows(
                          props.timelineRows.map((r, j) => (j === i ? { ...r, caption: e.target.value } : r))
                        )
                      }
                      placeholder={`Momen ${i + 1} — mis. "chat pertama: dia reply 2 menit"`}
                      maxLength={140}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-rose-400/50 focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>
                  {props.timelineRows.length > TIMELINE_MIN && (
                    <button
                      type="button"
                      aria-label={`Hapus momen ${i + 1}`}
                      onClick={() => props.onTimelineRows(props.timelineRows.filter((_, j) => j !== i))}
                      className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs text-zinc-500 transition-colors hover:bg-rose-500/20 hover:text-rose-300"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* foto momen — opsional, satu per momen */}
                <div className="mt-2 flex items-center gap-2 pl-5">
                  {row.photo ? (
                    <div className="relative h-12 w-12 overflow-hidden rounded-lg border border-white/10">
                      <img src={row.photo} alt={`Foto momen ${i + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        aria-label={`Hapus foto momen ${i + 1}`}
                        onClick={() =>
                          props.onTimelineRows(props.timelineRows.map((r, j) => (j === i ? { ...r, photo: null } : r)))
                        }
                        className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-bl-md bg-black/70 text-[8px] text-zinc-200 hover:bg-rose-500/80"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <label
                      className={`flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-white/15 px-3 py-1.5 text-[10px] font-semibold text-zinc-400 transition-colors hover:border-rose-400/40 hover:text-rose-300 ${
                        props.timelinePhotoBusy === i ? "pointer-events-none opacity-60" : ""
                      }`}
                    >
                      {props.timelinePhotoBusy === i ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <ImagePlus className="h-3 w-3" />
                      )}
                      {props.timelinePhotoBusy === i ? "Mengompres…" : "+ Foto (opsional)"}
                      <input
                        type="file"
                        accept={PHOTO_ACCEPT}
                        className="hidden"
                        onChange={(e) => {
                          props.onAddMomentPhoto(i, e.target.files)
                          e.target.value = ""
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>

          {props.timelineRows.length < TIMELINE_MAX && (
            <button
              type="button"
              onClick={() =>
                props.onTimelineRows([...props.timelineRows, { date: "", caption: "", photo: null }])
              }
              className="mt-2.5 w-full rounded-xl border border-dashed border-white/15 bg-white/[0.03] py-2 text-xs font-semibold text-zinc-400 transition-colors hover:border-rose-400/40 hover:text-rose-300"
            >
              + Tambah momen lagi
            </button>
          )}

          {/* Musik latar */}
          <p className="mt-4 mb-2 text-sm font-medium text-zinc-300">Musik latarnya</p>
          <div className="flex flex-wrap gap-2">
            {TIMELINE_MUSIC_PILLS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => props.onTimelineMusic(m.value)}
                className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                  props.timelineMusic === m.value
                    ? "border-rose-400/60 bg-rose-500/15 text-rose-200"
                    : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-600">
            Musik mulai otomatis pas dia ketuk "Mulai Perjalanan".
          </p>

          {/* Kejutan penutup */}
          <p className="mt-4 mb-2 text-sm font-medium text-zinc-300">Kejutan di halaman terakhir</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => props.onTimelineEnding("pesan")}
              className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
                props.timelineEnding === "pesan"
                  ? "border-rose-400/60 bg-rose-500/15 text-rose-200"
                  : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
              }`}
            >
              💌 Pesan Rahasia
            </button>
            <button
              type="button"
              onClick={() => props.onTimelineEnding("voucher")}
              className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
                props.timelineEnding === "voucher"
                  ? "border-amber-300/60 bg-amber-400/15 text-amber-200"
                  : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
              }`}
            >
              🎟️ Kode Voucher
            </button>
          </div>
          <textarea
            value={props.timelineEndingText}
            onChange={(e) => props.onTimelineEndingText(e.target.value)}
            placeholder={
              props.timelineEnding === "pesan"
                ? "Pesan rahasiamu — mis. \"sejak hari itu, aku yakin kamu yang terbaik…\""
                : "Kode voucher — mis. \"FREE-PELUK-SEUMUR-HIDUP\""
            }
            rows={2}
            maxLength={400}
            className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-rose-400/50 focus:ring-2 focus:ring-rose-500/20"
          />
          <p className="mt-2 text-xs text-zinc-500">
            Kisahnya dia gulir pelan-pelan — ditutup kejutan dari kamu.
          </p>
        </div>
      )}

      {/* Editor playlist lagu — hanya untuk Playlist (link Spotify opsional) */}
      {props.kadoType === "playlist" && (
        <div>
          <label htmlFor="playlistUrl" className="mb-1.5 block text-sm font-medium text-zinc-300">
            Link lagu Spotify (opsional)
          </label>
          <input
            id="playlistUrl"
            value={props.playlistUrl}
            onChange={(e) => props.onPlaylistUrl(e.target.value)}
            placeholder="mis. https://open.spotify.com/track/…"
            inputMode="url"
            className={`w-full rounded-xl border px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors duration-200 ${
              props.playlistValid
                ? "border-white/10 bg-white/5 focus:border-rose-400/50 focus:bg-white/[0.07] focus:ring-2 focus:ring-rose-500/20"
                : "border-rose-400/50 bg-rose-500/5 focus:ring-2 focus:ring-rose-500/20"
            }`}
          />
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            {props.playlistUrl.trim() === "" ? (
              <>Kosongin aja → piringannya mutar <span className="text-zinc-300">lagu bawaan Kangenin</span>.</>
            ) : props.playlistSpotifyId ? (
              <span className="text-emerald-300">✓ Lagunya kepasang — jarumnya bakal mutar lagu ini.</span>
            ) : (
              <span className="text-rose-300">Link belum valid — buka lagunya di Spotify, tap Bagikan → Salin link, lalu tempel di sini.</span>
            )}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Penerima menggeser jarum piringan retro — lagunya diputar via Spotify resmi (dia bisa pause/play sendiri).
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button
          onClick={props.onBack}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </button>
        <button
          onClick={props.onNext}
          disabled={!props.canPreview}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-purple-500 px-4 py-3.5 text-sm font-semibold text-white shadow-[0_0_24px_-6px_rgba(244,63,94,0.5)] transition-shadow hover:shadow-[0_0_32px_-4px_rgba(244,63,94,0.65)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          Lanjut Ringkasan
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Ringkasan & Generate
// ─────────────────────────────────────────────────────────────────────────────

interface StepGenerateProps {
  targetName: string
  message: string
  isAnonymous: boolean
  senderName: string
  kadoType: KadoType | null
  kadoData: Record<string, string | number> | null
  /** Jumlah kupon valid (kadoType "coupon") — tampil di ringkasan. */
  couponCount: number
  /** Momen lilin (kadoType "candle") — tampil di ringkasan. */
  occasion: "ultah" | "anniversary" | "graduasi"
  /** Jumlah foto terunggah (kadoType "photobox") — tampil di ringkasan. */
  photoCount: number
  /** Jumlah momen terisi (kadoType "timeline") — tampil di ringkasan. */
  timelineCount: number
  /** Jenis kejutan penutup (kadoType "timeline") — tampil di ringkasan. */
  timelineEnding: "pesan" | "voucher"
  /** Kado Playlist: true = lagu pilihan pengirim, false = lagu bawaan. */
  playlistHasSong: boolean
  generating: boolean
  errorMsg: string | null
  onBack: () => void
  onGenerate: () => void
}

function StepGenerate(props: StepGenerateProps) {
  const selected = KADO_OPTIONS.find((o) => o.value === props.kadoType)
  const identity = buildFomoIdentity(props.senderName, props.isAnonymous)

  return (
    <div className="space-y-5">
      {/* Ringkasan: amplop + nama target */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.03] p-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-500/15 shadow-[0_0_24px_-6px_rgba(244,63,94,0.6)]">
          <Mail className="h-6 w-6 text-rose-300" strokeWidth={1.75} />
        </div>
        <p className="mt-3 text-xs tracking-widest text-zinc-500 uppercase">Untuk</p>
        <p className="text-lg font-bold text-white">{props.targetName || "—"}</p>
        <p className="font-hand mt-3 text-xl leading-snug text-zinc-200">“{props.message || "…"}”</p>
      </div>

      {/* Detail ringkasan */}
      <div className="space-y-2.5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-zinc-500">Dari</span>
          <span className="flex items-center gap-1.5 font-medium text-zinc-200">
            {props.isAnonymous || !identity.senderName ? (
              <>
                <EyeOff className="h-3.5 w-3.5 text-zinc-400" />
                Seseorang
              </>
            ) : (
              <>
                <UserRound className="h-3.5 w-3.5 text-zinc-400" />
                {identity.senderName}
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs tracking-wider text-rose-300">
                  {identity.fomoInitials}
                </span>
              </>
            )}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-zinc-500">Kunci buka</span>
          <span className="flex items-center gap-1.5 font-medium text-zinc-200">
            {selected && <selected.icon className="h-3.5 w-3.5 text-rose-300" />}
            {selected?.label ?? "—"}
          </span>
        </div>
        {(props.kadoType === "coupon" || props.kadoType === "candle" || props.kadoType === "photobox" || props.kadoType === "timeline" || props.kadoType === "playlist") && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-500">Detail</span>
            <span className="font-medium text-zinc-200">
              {props.kadoType === "coupon"
                ? `${props.couponCount} kupon siap sobek`
                : props.kadoType === "photobox"
                  ? `${props.photoCount} foto siap dicuci`
                  : props.kadoType === "timeline"
                    ? `${props.timelineCount} momen + ${props.timelineEnding === "voucher" ? "kode voucher" : "pesan rahasia"}`
                    : props.kadoType === "playlist"
                      ? props.playlistHasSong
                        ? "Lagu pilihanmu siap diputar"
                        : "Lagu bawaan Kangenin"
                      : OCCASION_PILLS.find((o) => o.value === props.occasion)?.label ?? "—"}
            </span>
          </div>
        )}
      </div>

      {/* Aksi */}
      <div className="space-y-3">
        {props.errorMsg && (
          <div
            role="alert"
            className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-center text-sm text-rose-200"
          >
            {props.errorMsg}
          </div>
        )}
          <motion.button
            onClick={props.onGenerate}
            disabled={props.generating || !props.kadoType}
            whileTap={props.generating ? undefined : { scale: 0.98 }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 via-fuchsia-500 to-purple-500 px-6 py-4 text-base font-bold text-white shadow-[0_0_36px_-6px_rgba(244,63,94,0.65)] transition-shadow hover:shadow-[0_0_48px_-4px_rgba(244,63,94,0.8)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {props.generating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Menyiapkan kejutan…
              </>
            ) : (
              <>
                <Wand2 className="h-5 w-5" />
                Generate Link Kado
              </>
            )}
          </motion.button>
          <button
            onClick={props.onBack}
            disabled={props.generating}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10 disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Toggle switch custom (tanpa dependensi ekstra — tetap satu file)
// ─────────────────────────────────────────────────────────────────────────────

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label="Kirim sebagai anonim total"
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-200 ${
        checked ? "border-rose-400/50 bg-rose-500/80" : "border-white/15 bg-white/10"
      }`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 34 }}
        className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow ${
          checked ? "right-1" : "left-1"
        }`}
      />
    </button>
  )
}
