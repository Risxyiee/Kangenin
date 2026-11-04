import { expect, test } from "@playwright/test"

/**
 * J2 — Creator Studio /create: validasi langkah + pilih kado premium + generate link.
 * Sejak pengembangan berikutnya, pengalaman premium jadi 8: bouquet, openwhen,
 * photobox, coupon, candle, confess, timeline, playlist. Tipe LEGACY (sidik
 * jari/tap/kartu gosok/kuis) tetap dilarang muncul di pembuat.
 * Data nyawa-nyawa produksi — ditandai "QA Bot"/"Penerima Uji" agar mudah dikenali,
 * dan kado uji DIHAPUS sendiri di akhir journey.
 */

const PREMIUM_OPTIONS = [
  "Buket Bunga",
  "Open When",
  "Photobox",
  "Love Coupon",
  "Candle Blow",
  "Confess",
  "Timeline Kisah",
  "Playlist Lagu",
]

test.describe("Creator Studio", () => {
  test("langkah 1 menolak lanjut saat kosong, lalu lanjut saat lengkap", async ({ page }) => {
    await page.goto("/create")

    const next = page.getByRole("button", { name: /Lanjut Pilih Kado/i })
    const target = page.locator("#targetName")
    const message = page.locator("#message")

    // negatif: tombol mati saat field kosong
    await expect(target).toBeEmpty()
    await expect(next).toBeDisabled()

    await target.fill("Penerima Uji")
    await message.fill("Pesan uji E2E Playwright dari QA Bot — abaikan ya.")
    await expect(next).toBeEnabled()
    await next.click()

    // langkah 2 — radiogroup berisi HANYA 6 pengalaman premium
    const group = page.getByRole("radiogroup", { name: "Tipe kado" })
    await expect(group).toBeVisible()
    for (const label of PREMIUM_OPTIONS) {
      await expect(group.getByRole("radio", { name: new RegExp(label, "i") })).toHaveCount(1)
    }
    // opsi legacy sudah dihapus — tidak boleh muncul lagi
    for (const lama of ["Sidik Jari", "Tap Layar", "Kartu Gosok", "Kuis"]) {
      await expect(group.getByRole("radio", { name: new RegExp(lama, "i") })).toHaveCount(0)
    }
    // tanpa duplikat "Buket"
    await expect(group.getByText("Buket Bunga")).toHaveCount(1)
  })

  test("alur lengkap: isi → pilih kado → generate → halaman share", async ({ page }) => {
    test.setTimeout(90_000) // generate menulis ke DB (origin sesekali lambat)
    await page.goto("/create")

    await page.locator("#targetName").fill("Penerima Uji")
    await page
      .locator("#message")
      .fill("Tes E2E Playwright alur kado utuh — QA Bot, abaikan ya.")
    await page.getByRole("button", { name: /Lanjut Pilih Kado/i }).click()

    await page
      .getByRole("radiogroup", { name: "Tipe kado" })
      .getByRole("radio", { name: /Love Coupon/i })
      .click()
    await page.getByRole("button", { name: /Lanjut Ringkasan/i }).click()

    // langkah 3 — generate; sukses → redirect /kado/<uuid>/share
    await page.getByRole("button", { name: /Generate/i }).click()
    await page.waitForURL(/\/kado\/[0-9a-f-]{36}\/share/, { timeout: 45_000 })
    await expect(page).toHaveURL(/\/kado\/[0-9a-f-]{36}\/share/)

    // bersih-bersih: hapus kado uji supaya produksi tak menumpuk data QA
    // (DELETE /api/kado/[id] publik & idempoten — selalu 200)
    const kadoId = page.url().match(/\/kado\/([0-9a-f-]{36})/)?.[1]
    if (kadoId) {
      const del = await page.request.delete(`/api/kado/${kadoId}`)
      expect(del.ok()).toBeTruthy()
    }
  })
})
