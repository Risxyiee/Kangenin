// Screenshot tombol Bantuan AI di landing (form confess) & /create (form kado)
import { chromium } from "playwright";

const BASE = "https://kangenin.risyxieee123.workers.dev";
const out = (n) => `/tmp/render/ai_${n}.jpg`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); // ukuran HP

// 1) landing → scroll ke form confess
await page.goto(BASE, { waitUntil: "networkidle", timeout: 60_000 });
const label = page.locator('label[for="message"]').first();
await label.scrollIntoViewIfNeeded();
await page.waitForTimeout(800);
await page.screenshot({ path: out("landing_confess"), quality: 60, type: "jpeg" });

// 2) /create → step 1 form kado
await page.goto(BASE + "/create", { waitUntil: "networkidle", timeout: 60_000 });
const msgLabel = page.locator('label[for="message"]').first();
await msgLabel.scrollIntoViewIfNeeded();
await page.waitForTimeout(800);
await page.screenshot({ path: out("create_kado"), quality: 60, type: "jpeg" });

await browser.close();
console.log("OK — screenshot tersimpan");
