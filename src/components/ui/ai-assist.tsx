"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import {
  FETCH_TIMEOUT_MESSAGE,
  fetchWithTimeout,
  isTimeoutError,
} from "@/lib/fetch-timeout";

/**
 * Tombol "✨ Bantuan AI" — minta draft pesan dari /api/ai/tulis
 * (OrcaRouter GLM flash free di sisi server; key tidak pernah ke browser).
 *
 * Reusable untuk form confess & form kado:
 * - `onDraft` menerima teks draft → parent isi ke textarea (tetap bisa diedit).
 * - `blockedReason` menonaktifkan tombol + menampilkan alasan kecil
 *   (mis. "Isi nama dia dulu").
 * - `className` diisi parent supaya gaya tombol menyatu dengan halaman masing-masing.
 */
type AiAssistButtonProps = {
  toName: string;
  fromName?: string;
  context?: string;
  jenis?: "confess" | "kado";
  onDraft: (msg: string) => void;
  blockedReason?: string | null;
  className?: string;
  label?: string;
};

export function AiAssistButton({
  toName,
  fromName,
  context,
  jenis = "confess",
  onDraft,
  blockedReason,
  className,
  label = "Bantuan AI",
}: AiAssistButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (loading) return;
    setError(null);
    setLoading(true);
    // React 19: setState sinkron di dalam handler async aman — tidak ada
    // jalur effect yang memanggil ini, jadi tidak perlu trik setTimeout(0).
    try {
      const res = await fetchWithTimeout(
        "/api/ai/tulis",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toName, fromName, context, jenis }),
        },
        20_000
      );
      const d = (await res.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null;
      if (res.ok && d?.message) {
        onDraft(String(d.message));
      } else {
        setError(d?.error || "Gagal membuat draft. Coba lagi ya.");
      }
    } catch (err) {
      setError(
        isTimeoutError(err)
          ? "AI-nya lama merespons — coba lagi ya."
          : FETCH_TIMEOUT_MESSAGE
      );
    } finally {
      setLoading(false);
    }
  }

  const disabled = loading || Boolean(blockedReason);

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-busy={loading}
        className={className}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="h-4 w-4" aria-hidden />
        )}
        {loading ? "Sedang nulis…" : label}
      </button>
      {blockedReason && !loading ? (
        <span className="text-xs text-muted-foreground" role="note">
          {blockedReason}
        </span>
      ) : null}
      {error ? (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
