// Uji interaksi kartu ulasan: klik emoji → kirim → cek status sukses.
import { chromium } from "playwright";

const ID = process.argv[2];
const BASE = "https://kangenin.risyxieee123.workers.dev";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(`${BASE}/kado/${ID}/share`, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(2000);

// 1) klik emoji ke-5 (Suka banget)
await page.locator('button[aria-label*="5 —"]').click();
await page.waitForTimeout(300);
const btnLabel1 = await page.locator('section[aria-label="Ulasan untuk Kangenin"] button:has-text("Kirim")').textContent();
console.log("label tombol setelah pilih emoji:", JSON.stringify(btnLabel1?.trim()));

// 2) textarea opsional muncul?
const adaTa = await page.locator('section[aria-label="Ulasan untuk Kangenin"] textarea').count();
console.log("textarea opsional muncul:", adaTa > 0 ? "YA" : "TIDAK");

// 3) kirim
await page.locator('button:has-text("Kirim ulasan")').click();
await page.waitForTimeout(2500);
const sukses = await page.locator('section[aria-label="Ulasan untuk Kangenin"]').textContent();
console.log("status akhir kartu:", sukses?.includes("Makasih") ? "SUKSES ✅" : `belum: ${sukses?.slice(0, 120)}`);
await browser.close();
