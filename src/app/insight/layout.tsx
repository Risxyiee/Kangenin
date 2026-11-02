import type { Metadata } from "next";

// Halaman khusus owner — JANGAN diindeks mesin pencari.
export const metadata: Metadata = {
  title: "Insight Masukan — Kangenin",
  robots: { index: false, follow: false },
};

export default function InsightLayout({ children }: { children: React.ReactNode }) {
  return children;
}
