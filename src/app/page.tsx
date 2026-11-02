import type { Metadata } from "next";
import Landing from "@/components/landing/Landing";
import ConfessionView from "@/components/confess/ConfessionView";
import LettersView from "@/components/confess/LettersView";
import StatusView from "@/components/confess/StatusView";
import GiftView from "@/components/confess/GiftView";
import { GIFT_META, type GiftType } from "@/lib/gift-data";
import { detectKind } from "@/lib/detect";

type Params = { searchParams: Promise<{ k?: string; s?: string; p?: string }> };

// Metadata dinamis: link kado yang di-share ke WA/Twitter tampil
// sebagai kartu penasaran ("Ada surat rahasia buat Sari"),
// bukan judul situs generik. Ini kunci viral loop.
export async function generateMetadata({ searchParams }: Params): Promise<Metadata> {
  const { k, s } = await searchParams;

  // halaman status pengirim → jangan bocorkan apa pun, jangan diindeks
  if (s) {
    return {
      title: "Pantau kado kamu — Kangenin",
      robots: { index: false, follow: false },
    };
  }

  // link kado penerima
  if (k) {
    // detectKind = React cache() → query yang sama dengan Page di bawah
    // cuma jalan SEKALI per request (dulu 6 query, sekarang 3 — perbaikan 1102)
    const { confession, letterSet, gift } = await detectKind(k);

    if (letterSet) {
      const title = `${letterSet._count.letters} surat kecil buat ${letterSet.toName}`;
      const description =
        "Seseorang bikinin surat-surat kecil buat kamu — satu surat bisa dibuka tiap minggu. Buka yang pertama sekarang.";
      return {
        title,
        description,
        robots: { index: false, follow: false },
        openGraph: {
          title,
          description,
          images: [{ url: `/api/og?k=${k}`, width: 1200, height: 630 }],
        },
        twitter: { card: "summary_large_image", title, description },
      };
    }

    if (gift) {
      const meta = GIFT_META[gift.type as GiftType] ?? GIFT_META.bouquet;
      const title = meta.ogTitle(gift.toName);
      const description =
        "Seseorang yang diam-diam perhatian ngirim kado spesial buat kamu. Buka sekarang — siapin hatinya. 🤍";
      return {
        title,
        description,
        robots: { index: false, follow: false },
        openGraph: {
          title,
          description,
          images: [{ url: `/api/og?k=${k}`, width: 1200, height: 630 }],
        },
        twitter: { card: "summary_large_image", title, description },
      };
    }

    if (confession) {
      const title = `Ada surat rahasia buat ${confession.toName}`;
      const description =
        "Seseorang yang diam-diam perhatian ngirim sesuatu buat kamu. Buka sekarang — siapa tahu dia juga punya perasaan yang sama.";
      return {
        title,
        description,
        robots: { index: false, follow: false },
        openGraph: {
          title,
          description,
          images: [{ url: `/api/og?k=${k}`, width: 1200, height: 630 }],
        },
        twitter: { card: "summary_large_image", title, description },
      };
    }

    // slug nggak dikenal → tetap jangan poluti indeks
    return { title: "Kangenin", robots: { index: false, follow: false } };
  }

  return {};
}

export default async function Page({ searchParams }: Params) {
  const { k, s, p } = await searchParams;

  // Link kado penerima: /?k=<slug> → surat fullscreen
  // (confess biasa / open-when letters / kado digital — deteksi dari DB)
  if (k) {
    const { letterSet, gift } = await detectKind(k);
    if (letterSet) return <LettersView slug={k} previewKey={p} />;
    if (gift) return <GiftView slug={k} previewKey={p} />;
    return <ConfessionView slug={k} previewKey={p} />; // view sendiri menangani 404
  }

  // Halaman status pengirim: /?s=<senderKey> → dashboard pantauan
  if (s) return <StatusView senderKey={s} />;

  // Papan Pengakuan kini diambil CLIENT-SIDE lewat /api/papan (perbaikan
  // Error 1102: SSR beranda dulu menjalankan query + mask + render 28 kartu
  // marquee di SETIAP request — CPU Worker kepangkas terus). Sekarang SSR
  // beranda nol query DB; papan muncul setelah hidrasi, tetap opt-in dua
  // flag (showMessage && isPublic, reportCount < 3) + mask kontak di API.
  return <Landing />;
}
