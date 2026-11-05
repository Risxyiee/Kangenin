import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

// Font di-host sendiri (src/fonts) — build & dev nggak perlu fetch ke
// fonts.googleapis.com lagi: lebih cepat, hermetik, dan aman buat
// environment offline. File latin variable diunduh dari Google Fonts.
const jakarta = localFont({
  src: "../fonts/plus-jakarta-sans-latin.woff2",
  variable: "--font-jakarta",
  weight: "200 800",
  display: "swap",
});

const caveat = localFont({
  src: "../fonts/caveat-latin.woff2",
  variable: "--font-caveat",
  weight: "400 700",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    // Fallback JANGAN localhost: bukti produksi 2026-11-04 — NEXT_PUBLIC_SITE_URL
    // tidak terpasang saat build Cloudflare membuat og:image di HTML jadi
    // "http://localhost:3000/og-generic.png" → crawler WA/Telegram/Twitter gagal
    // memuat gambar → link yang di-share tampil polos tanpa kartu preview.
    // Domain produksi tetap dan diketahui — jadikan fallback langsung.
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.kangenin.web.id"
  ),
  title: "Kangenin — tulis surat rahasia, bikin dia kangen",
  description:
    "Confess lewat surat anonim yang bisa dijawab — cukup share link. Sudah jadian? Kirim kado kejutan: buket bunga, surat Open When, photobox, kue tiup lilin, love coupons, timeline kisah. Semua gratis selama masa uji coba.",
  keywords: [
    "confess anonim",
    "surat rahasia",
    "kado digital",
    "kado ulang tahun pacar",
    "surat cinta digital",
    "website buat pacar",
    "hadiah anniversary",
  ],
  authors: [{ name: "Kangenin" }],
  openGraph: {
    title: "Kangenin — tulis surat rahasia, bikin dia kangen",
    description:
      "Confess anonim gratis lewat link, plus kado digital — semua gratis selama masa uji coba. Ditulis kamu, dibuka dia.",
    siteName: "Kangenin",
    type: "website",
    // Aset statis (public/og-generic.png) — dulu /api/og tanpa param dipanggil
    // crawler di setiap crawl beranda → render satori per request berada di
    // batas CPU Worker (Error 1102). Kartu generik tak berubah → sekali
    // pre-render, dilayani edge CDN, nol CPU.
    images: [{ url: "/og-generic.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kangenin — tulis surat rahasia, bikin dia kangen",
    description: "Confess anonim gratis lewat link, plus kado digital — gratis selama masa uji coba.",
    // Eksplisit — sebagian crawler X tidak jatuh ke og:image kalau kosong.
    images: ["/og-generic.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${jakarta.variable} ${caveat.variable} font-sans antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
