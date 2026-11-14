"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// ── Beacon kunjungan realtime ────────────────────────────────────────────────
// Dipasang di root layout: kirim "view" tiap halaman dibuka / route berganti,
// lalu "ping" tiap 30 dtk selama tab terbuka. Sesi diidentifikasi ID acak di
// localStorage (bukan cookie, bukan IP) — server yang meng-hash.
//
// Tanpa beacon saat document hidden (tab background) supaya hitungan
// "online sekarang" jujur — orang yang pindah app dianggap pergi.
export const VisitBeacon: React.FC = () => {
  const pathname = usePathname();
  const sid = useRef<string>("");

  useEffect(() => {
    try {
      let s = localStorage.getItem("kg_sid");
      if (!s || !/^[a-zA-Z0-9-]{8,64}$/.test(s)) {
        s = crypto.randomUUID();
        localStorage.setItem("kg_sid", s);
      }
      sid.current = s;
    } catch {
      // localStorage diblokir → pakai ID sesi halaman (tab ini saja)
      sid.current = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    }
  }, []);

  useEffect(() => {
    if (!pathname || !sid.current) return;
    const kirim = (kind: "view" | "ping") => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        const body = JSON.stringify({ sid: sid.current, path: pathname, kind });
        // sendBeacon = nol biaya di navigation/unload; fetch keepalive cadangan
        if (navigator.sendBeacon?.("/api/track/visit", new Blob([body], { type: "application/json" }))) {
          return;
        }
        void fetch("/api/track/visit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      } catch {
        /* tracking opsional — biarkan senyap */
      }
    };

    kirim("view");
    const interval = setInterval(() => kirim("ping"), 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") kirim("ping");
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname]);

  return null;
};
