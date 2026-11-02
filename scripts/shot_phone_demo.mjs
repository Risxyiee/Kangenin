/**
 * shot_phone_demo.mjs — screenshot PhoneDemo (element shot) di Produksi,
 * satu putaran penuh alur Heartstring yang barusan dipasang:
 *   seal → heartbeat (3 detak + reward) → shatter → letter → question
 *   → reply → sent → loop.
 * Timeline fase (ms, mulai mount): seal 0–2600, heartbeat 2600–5100,
 * shatter 5100–7000, letter 7000–10100, question 10100–13100,
 * reply 13100–15700, sent 15700–19300.
 */
import { chromium } from "playwright"
import fs from "node:fs"

const BASE = process.env.SHOT_BASE || "https://kangenin.risyxieee123.workers.dev"
const OUT = "/tmp/render"
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  executablePath:
    "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome",
  args: ["--no-sandbox"],
})
const page = await browser.newPage({ viewport: { width: 420, height: 1400 } })
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 })

// phone = pembungkus w-[290px]/w-[310px] di dalam #confess
const phone = page.locator("#confess .w-\\[290px\\], #confess .w-\\[310px\\]").first()
await phone.scrollIntoViewIfNeeded()

// T0 = tepat setelah scroll — fase mulai dari mount komponen, jadi ambil
// acuan waktunya dari teks yang muncul (lebih tahan latensi jaringan).
const t0 = Date.now()
async function waitText(text, timeoutMs = 25000) {
  await page.waitForFunction(
    (t) => document.body?.innerText.includes(t),
    text,
    { timeout: timeoutMs }
  )
}

// 1) SEAL — segel lilin hati ("menyegel suratnya" unik di fase ini — teks
//    "segel detak jantung" saja bentrok dgn copy intro seremoni)
await waitText("menyegel suratnya")
// kolom demo masuk dgn whileInView (opacity 0→1, 0.7s) — tunggu selesai
// biar screenshot-nya bukan area kosong
await page.waitForTimeout(1400)
await phone.screenshot({ path: `${OUT}/demo-1-seal.png` })
console.log("1 seal ok", Date.now() - t0, "ms")

// 2) HEARTBEAT — detak ke-2/3 + reward (nama bocor)
await waitText("darinya: Ri••y")
await page.waitForTimeout(400) // biar detak ke-3 ("retak") ikut ke penetrate
await phone.screenshot({ path: `${OUT}/demo-2-heartbeat.png` })
console.log("2 heartbeat ok", Date.now() - t0, "ms")

// 3) SHATTER — retakan + pecahan + kunang-kunang
await waitText("hatinya retak… suratnya mulai kebuka")
await page.waitForTimeout(500)
await phone.screenshot({ path: `${OUT}/demo-3-shatter.png` })
console.log("3 shatter ok", Date.now() - t0, "ms")

// 4) LETTER — baris demi baris blur→tajam
await waitText("Aku suka kamu. Sudah lama.")
await page.waitForTimeout(350)
await phone.screenshot({ path: `${OUT}/demo-4-letter.png` })
console.log("4 letter ok", Date.now() - t0, "ms")

// 5) QUESTION — pilihan jawaban
await waitText("Beri aku waktu dulu")
await page.waitForTimeout(400)
await phone.screenshot({ path: `${OUT}/demo-5-question.png` })
console.log("5 question ok", Date.now() - t0, "ms")

// 6) REPLY — jawaban iya + reveal nama + mulai nulis balasan
await waitText("Nama pengirimnya kebuka")
await page.waitForTimeout(450)
await phone.screenshot({ path: `${OUT}/demo-6-reply.png` })
console.log("6 reply ok", Date.now() - t0, "ms")

// 7) SENT — balasan terkirim
await waitText("Balasanmu terkirim")
await page.waitForTimeout(300)
await phone.screenshot({ path: `${OUT}/demo-7-sent.png` })
console.log("7 sent ok", Date.now() - t0, "ms")

// chip tema
const chipText = await phone
  .locator("span", { hasText: /^Tema / })
  .first()
  .textContent()
  .catch(() => "(tidak ketemu)")
console.log("chip tema:", chipText)

await browser.close()
console.log("selesai")
