/**
 * shot_share.mjs — screenshot kartu "Hapus Kado" di dashboard share produksi.
 * Pemakaian: SHARE_URL=https://.../kado/<id>/share node scripts/shot_share.mjs
 */
import { chromium } from "playwright"

const browser = await chromium.launch({
  executablePath: "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome",
  args: ["--no-sandbox"],
})
const page = await browser.newPage({ viewport: { width: 420, height: 900 } })
await page.goto(process.env.SHARE_URL, { waitUntil: "domcontentloaded", timeout: 60000 })
await page.waitForFunction(() => document.body?.innerText.includes("Hapus Kado"), null, {
  timeout: 30000,
})
await page.waitForTimeout(1500)
const card = page.locator("section", { hasText: "Hapus Kado" }).last()
await card.scrollIntoViewIfNeeded()
await page.waitForTimeout(800)
await card.screenshot({ path: "/home/z/my-project/download/kado-hapus-kartu.png" })
console.log("shot ok")
await browser.close()
