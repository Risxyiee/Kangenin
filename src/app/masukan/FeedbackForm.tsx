"use client";

import { useState } from "react";
import Link from "next/link";

// ── Form Kritik & Saran (/masukan) ──────────────────────────────────────────
// Jembatan langsung user → founder. Semua field opsional KECUALI cerita;
// friction sengaja rendah biar user betul-betau nulis. Honeypot `website`
// (tersembunyi) menjebak bot; rate limit aslinya di POST /api/feedback.

const RATINGS = [
  { value: 1, emoji: "😖", label: "Jelek banget" },
  { value: 2, emoji: "😕", label: "Kurang banget" },
  { value: 3, emoji: "😐", label: "Biasa aja" },
  { value: 4, emoji: "😊", label: "Suka" },
  { value: 5, emoji: "🥰", label: "Suka banget" },
];

const CATEGORIES = [
  { id: "bug", label: "Ada bug 🐛" },
  { id: "fitur", label: "Ide fitur 💡" },
  { id: "desain", label: "Desain 🎨" },
  { id: "lainnya", label: "Lainnya ✨" },
];

const MAX_LEN = 1000;

export default function FeedbackForm() {
  const [rating, setRating] = useState<number | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — jangan tampil
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const trimmed = message.trim();
  const canSubmit = trimmed.length >= 3 && status !== "sending";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus("sending");
    setErrorMsg("");
    // halaman asal (mis. /masukan?dari=beranda) — dipakai founder untuk tahu
    // dari mana user mulai menulis. Diambil SAAT submit: client-only, jadi
    // aman tanpa state/effect (tidak ada risiko hydration mismatch).
    const path = window.location.pathname + window.location.search;
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          rating,
          category,
          contact: contact.trim() || null,
          path,
          website, // honeypot ikut terkirim — kosong = manusia
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(json.error ?? "Gagal mengirim. Coba lagi ya.");
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch {
      setErrorMsg("Koneksi bermasalah. Cek internet lo terus coba lagi ya.");
      setStatus("error");
    }
  }

  // ── Layar terima kasih ──
  if (status === "done") {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 text-center">
        <div className="text-6xl">💌</div>
        <h1 className="mt-5 font-display text-3xl font-bold tracking-tight text-foreground">
          Makasih banyak!
        </h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          Masukan lo udah nyampe langsung ke yang bikin Kangenin. Dibaca semua,
          dijamin — kritiknya yang paling berharga buat bikin ini makin seru.
        </p>
        <Link
          href="/"
          className="mt-8 rounded-md bg-primary px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#b52743]"
        >
          ← balik ke beranda
        </Link>
      </main>
    );
  }

  // ── Form ──
  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 py-16 sm:px-6">
      <Link
        href="/"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← kembali ke beranda
      </Link>

      <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-foreground">
        Kritik &amp; Saran
      </h1>
      <p className="mt-3 leading-relaxed text-muted-foreground">
        Bebas bilang apa aja — fitur yang kurang, yang bikin bingung, sampai ide
        gila. Nyampe langsung ke founder, tanpa judgment 🤍
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-7" noValidate>
        {/* honeypot: tersembunyi dari manusia, menggoda bot pengisi form */}
        <div className="absolute -left-[9999px] top-auto" aria-hidden="true">
          <label>
            Website
            <input
              type="text"
              name="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </label>
        </div>

        {/* Rating */}
        <div>
          <p className="text-sm font-semibold text-foreground">
            Gimana kesan lo soal Kangenin?{" "}
            <span className="font-normal text-muted-foreground">(opsional)</span>
          </p>
          <div className="mt-3 flex gap-2">
            {RATINGS.map((r) => (
              <button
                key={r.value}
                type="button"
                title={r.label}
                aria-label={r.label}
                onClick={() => setRating(r.value)}
                className={`flex h-12 flex-1 items-center justify-center rounded-xl border text-2xl transition-all ${
                  rating === r.value
                    ? "scale-110 border-primary bg-primary/10 shadow-sm"
                    : "border-border bg-card hover:scale-105 hover:bg-accent/40"
                }`}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Kategori */}
        <div>
          <p className="text-sm font-semibold text-foreground">
            Isinya soal apa?{" "}
            <span className="font-normal text-muted-foreground">(opsional)</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(category === c.id ? null : c.id)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  category === c.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground hover:bg-accent/40"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cerita */}
        <div>
          <label
            htmlFor="pesan"
            className="text-sm font-semibold text-foreground"
          >
            Ceritanya? <span className="text-primary">*</span>
          </label>
          <textarea
            id="pesan"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_LEN))}
            rows={5}
            required
            placeholder="Fitur X bikin bingung, atau… andai ada fitur buat Y, itu bakal gila sih"
            className="mt-2 w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">
            {message.length}/{MAX_LEN}
          </p>
        </div>

        {/* Kontak opsional */}
        <div>
          <label htmlFor="kontak" className="text-sm font-semibold text-foreground">
            Mau dibales / ditanya balik?{" "}
            <span className="font-normal text-muted-foreground">(opsional)</span>
          </label>
          <input
            id="kontak"
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value.slice(0, 100))}
            placeholder="IG / WA / email lo"
            className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {status === "error" && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMsg}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-xl bg-primary px-6 py-4 text-sm font-bold text-white transition-colors hover:bg-[#b52743] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "sending" ? "Mengirim…" : "Kirim masukan 💌"}
        </button>

        <p className="text-center text-xs text-muted-foreground">
          Tanpa nama, tanpa akun, tanpa jejak — kecuali lo sendiri yang
          ninggalin kontak.
        </p>
      </form>
    </main>
  );
}
