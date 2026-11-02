import type { Metadata } from "next";

// Halaman khusus owner — JANGAN diindeks mesin pencari.
export const metadata: Metadata = {
  title: "Panel Admin — Kangenin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
