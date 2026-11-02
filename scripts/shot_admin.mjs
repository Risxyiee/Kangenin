/**
 * shot_admin.mjs — screenshot Panel Admin di Produksi (viewport HP):
 *   1) gerbang kunci  2) tab Ringkasan (terbuka)  3) tab Keamanan.
 * Key diambil dari env ADMIN_SHOT_KEY (jangan di-hardcode).
 */
import { chromium } from "playwright"
import fs from "node:fs"

const BASE = process.env.SHOT_BASE || "https://kangenin.risyxieee123.workers.dev"
const KEY = process.env.ADMIN_SHOT_KEY || ""
const OUT = "/home/z/my-project/download"
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  executablePath:
    "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome",
  args: ["--no-sandbox"],
})
const page = await browser.newPage({ viewport: { width: 420, height: 960 } })
await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded", timeout: 60000 })

// 1) Gerbang kunci
await page.waitForFunction(
  () => document.body?.innerText.includes("Masukin key admin"),
  null,
  { timeout: 30000 }
)
await page.waitForTimeout(1200) // font & layout settle
await page.screenshot({ path: `${OUT}/admin-1-gerbang.png`, fullPage: false })
console.log("shot 1: gerbang ok")

// 2) Buka panel
await page.fill('input[type="password"]', KEY)
await page.click('button:has-text("Buka Panel")')
await page.waitForFunction(
  () => document.body?.innerText.includes("masukan user"),
  null,
  { timeout: 30000 }
)
await page.waitForTimeout(1500)
await page.screenshot({ path: `${OUT}/admin-2-ringkasan.png`, fullPage: true })
console.log("shot 2: ringkasan ok")

// 3) Tab Keamanan (rate limit + kesehatan DB)
await page.click('button:has-text("Keamanan")')
await page.waitForFunction(
  () => document.body?.innerText.toLowerCase().includes("rate limit"),
  null,
  { timeout: 30000 }
)
await page.waitForTimeout(1500)
await page.screenshot({ path: `${OUT}/admin-3-keamanan.png`, fullPage: true })
console.log("shot 3: keamanan ok")

await browser.close()
console.log("SELESAI — 3 screenshot di", OUT)
