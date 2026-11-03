import type { Metadata } from "next"
import { guardTestStage } from "@/lib/test-stage"

/**
 * Layout /test-candle — panggung uji internal.
 * noindex + gerbang guardTestStage: di produksi rute ini 404 (lihat
 * src/lib/test-stage.ts); hidup hanya di next dev untuk screenshot Playwright.
 */
export const metadata: Metadata = {
  title: "Panggung Uji — Candle | Kangenin",
  robots: { index: false, follow: false },
}

export default function TestCandleLayout({ children }: { children: React.ReactNode }) {
  guardTestStage() // produksi → notFound()
  return children
}
