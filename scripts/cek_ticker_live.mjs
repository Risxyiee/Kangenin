import { chromium } from "playwright";

// Cek visual live: ticker aktivitas muncul di bawah Hero + bagian bawah
// landing page benar-benar ter-render (keluhan "ga ada tampilannya bawah").

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 }, // ukuran layar HP (webview WA ~ sama)
  userAgent:
    "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
});

await page.goto("https://www.kangenin.web.id/", { waitUntil: "networkidle", timeout: 90_000 });
await page.waitForTimeout(3000); // hidrasi + fetch /api/aktivitas

const ticker = await page
  .locator('a[href="/dinding"]')
  .first()
  .textContent()
  .catch(() => null);
console.log("teks ticker:", JSON.stringify(ticker));

await page.screenshot({ path: "/tmp/render/atas.png" });

// scroll pelan sampai benar-benar bawah
await page.evaluate(async () => {
  const tinggi = document.body.scrollHeight;
  for (let y = 0; y <= tinggi; y += 700) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 120));
  }
});
await page.waitForTimeout(1500);
await page.screenshot({ path: "/tmp/render/bawah.png" });

const tinggi = await page.evaluate(() => document.body.scrollHeight);
console.log("tinggi halaman:", tinggi, "px");

await browser.close();
