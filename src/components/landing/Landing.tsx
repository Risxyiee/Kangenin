"use client";

import Navbar from "./Navbar";
import Hero from "./Hero";
import AktivitasTicker from "./AktivitasTicker";
import Marquee from "./Marquee";
import ShowcaseSection from "./ShowcaseSection";
import ConfessSection from "./ConfessSection";
import StatusTeaser from "./StatusTeaser";
import KadoSurpriseSection from "./KadoSurpriseSection";
import TimelineSection from "./TimelineSection";
import HowItWorks from "./HowItWorks";
import Pricing from "./Pricing";
import Faq from "./Faq";
import FooterCta from "./FooterCta";

export type LandingProps = Record<string, never>;

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        {/* strip gelap 64px = ruang navbar fixed yang transparan saat di atas;
            ticker aktivitas taruh PALING ATAS biar pengunjung baru langsung
            melihat bukti sosial tanpa perlu scroll */}
        <div className="h-16 bg-[#1b1815]" aria-hidden />
        <AktivitasTicker />
        <Hero />
        <Marquee />
        <ShowcaseSection />
        <ConfessSection />
        <StatusTeaser />
        <KadoSurpriseSection />
        <TimelineSection />
        <HowItWorks />
        <Pricing />
        <Faq />
        <FooterCta />
      </main>

      {/* Pintu masukan user — selalu ada di pojok, biar kritik & saran cuma
          sekali ketuk dari mana pun di beranda (dilacak asalnya via ?dari=). */}
      <a
        href="/masukan?dari=beranda"
        aria-label="Kasih kritik dan saran"
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-border bg-card/95 px-4 py-2.5 text-sm font-semibold text-foreground shadow-lg backdrop-blur transition-transform hover:scale-105"
      >
        <span aria-hidden="true">💬</span>
        Kasih saran
      </a>
    </div>
  );
}
