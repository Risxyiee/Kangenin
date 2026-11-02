// Screenshot mobile dasbor share — fokus kartu ulasan di bagian bawah.
import { chromium } from "playwright";

const ID = process.argv[2];
const OUT = process.argv[3] || "/tmp/ulasan-full.png";
const BASE = "https://kangenin.risyxieee123.workers.dev";

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});
await page.goto(`${BASE}/kado/${ID}/share`, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(2500); // animasi kartu masuk
// gulir sampai bawah biar kartu ulasan terlihat
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(1200);
await page.screenshot({ path: OUT, fullPage: true });
console.log("OK →", OUT);
await browser.close();
