import type { Metadata } from "next";
import Landing, { type LandingProps } from "@/components/landing/Landing";
import ConfessionView from "@/components/confess/ConfessionView";
import LettersView from "@/components/confess/LettersView";
import StatusView from "@/components/confess/StatusView";
import GiftView from "@/components/confess/GiftView";
import { GIFT_META, type GiftType } from "@/lib/gift-data";
import { db, withDbRetry } from "@/lib/db";
import { toShowcaseItem, type ShowcaseItem } from "@/lib/papan";

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
    const [confession, letterSet, gift] = await withDbRetry(() =>
      Promise.all([
        db.confession.findUnique({
          where: { slug: k },
          select: { toName: true },
        }),
        db.letterSet.findUnique({
          where: { slug: k },
          select: { toName: true, _count: { select: { letters: true } } },
        }),
        db.gift.findUnique({
          where: { slug: k },
          select: { toName: true, type: true },
        }),
      ]
    ));

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
    const [confession, letterSet, gift] = await withDbRetry(() =>
      Promise.all([
        db.confession.findUnique({ where: { slug: k }, select: { id: true } }),
        db.letterSet.findUnique({ where: { slug: k }, select: { id: true } }),
        db.gift.findUnique({ where: { slug: k }, select: { id: true } }),
      ])
    );
    if (letterSet) return <LettersView slug={k} previewKey={p} />;
    if (gift) return <GiftView slug={k} previewKey={p} />;
    return <ConfessionView slug={k} previewKey={p} />; // view sendiri menangani 404
  }

  // Halaman status pengirim: /?s=<senderKey> → dashboard pantauan
  if (s) return <StatusView senderKey={s} />;

  // Papan Pengakuan: isi confess yang pengirimnya IZINKAN tayang (opt-in dua
  // flag: showMessage && isPublic, reportCount < 3). Isi sudah lewat moderasi
  // di create + mask kontak di toShowcaseItem. DB gagal → papan kosong, jangan
  // pernah 500-kan beranda gara-gara feed sosial.
  let showcase: ShowcaseItem[] = [];
  try {
    const rows = await withDbRetry(() =>
      db.confession.findMany({
        where: { showMessage: true, isPublic: true, reportCount: { lt: 3 } },
        orderBy: { createdAt: "desc" },
        take: 14,
        select: {
          id: true,
          fromName: true,
          showAs: true,
          toName: true,
          theme: true,
          message: true,
          createdAt: true,
          response: true,
        },
      })
    );
    showcase = rows.map(toShowcaseItem);
  } catch (err) {
    console.error("GET / (papan) error:", err);
  }

  return <Landing showcase={showcase} />;
}
