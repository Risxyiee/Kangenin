"use client";

import { motion } from "framer-motion";

export default function FooterCta() {
  return (
    <>
      <section className="relative bg-[#211d1a] py-24 text-center">
        <div className="relative mx-auto max-w-2xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7 }}
          >
            <p className="font-display text-3xl italic leading-snug text-white sm:text-4xl">
              &ldquo;Berani dikit — siapa tau dia juga{" "}
              <span className="text-[#e8b4bb]">nunggu</span>.&rdquo;
            </p>
            <p className="mx-auto mt-5 max-w-md text-base text-white/60">
              Satu link, tiga menit, gratis. Yang hilang cuma kesempatan kalau
              ditunda terus.
            </p>
            <a
              href="#confess"
              className="mt-9 inline-block rounded-md bg-primary px-8 py-4 text-sm font-bold text-white transition-colors hover:bg-[#b52743]"
            >
              Tulis confess-mu sekarang
            </a>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-border bg-background py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <span className="font-display text-base font-bold text-foreground">
              kangen<span className="text-primary">in</span>
            </span>
            <span>— confess &amp; kado digital, dibuat di Indonesia</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <a href="#confess" className="transition-colors hover:text-foreground">
              Confess
            </a>
            <a href="#kejutan" className="transition-colors hover:text-foreground">
              Kado
            </a>
            <a href="/create" className="transition-colors hover:text-foreground">
              Kado Kejutan
            </a>
            <a href="#harga" className="transition-colors hover:text-foreground">
              Harga
            </a>
            <a href="/bantuan" className="transition-colors hover:text-foreground">
              Bantuan
            </a>
            <a href="/tentang" className="transition-colors hover:text-foreground">
              Tentang
            </a>
            <a href="/privasi" className="transition-colors hover:text-foreground">
              Privasi
            </a>
            <a href="/masukan" className="transition-colors hover:text-foreground">
              Kritik &amp; Saran
            </a>
          </div>
          <p className="text-xs">© 2026 Kangenin</p>
        </div>
      </footer>
    </>
  );
}
