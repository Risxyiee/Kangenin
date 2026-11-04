import { expect, test } from "@playwright/test"

/**
 * J4 — Sisi penerima: view confess, unbox kado, dan halaman 404.
 * Data dibuat lewat API (request fixture) supaya test mandiri.
 */

const QA = {
  toName: "Penerima Uji",
  message: "Tes E2E Playwright view penerima — QA Bot, abaikan ya.",
}

async function createConfess(baseURL: string): Promise<{ slug: string }> {
  const res = await fetch(`${baseURL}/api/confess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fromName: "QA Bot", ...QA }),
  })
  const json = (await res.json()) as { slug?: string }
  if (!res.ok || !json.slug) throw new Error(`create confess gagal: ${res.status}`)
  return { slug: json.slug }
}

async function createKado(baseURL: string, kadoType: string): Promise<{ id: string }> {
  const res = await fetch(`${baseURL}/api/kado`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      targetName: QA.toName,
      message: QA.message,
      isAnonymous: true,
      kadoType,
      kadoData: null,
    }),
  })
  const json = (await res.json()) as { data?: { id?: string } }
  if (!res.ok || !json.data?.id) throw new Error(`create kado gagal: ${res.status}`)
  return { id: json.data.id }
}

test.describe("View penerima", () => {
  test("link confess menampilkan nama penerima & pesan", async ({ page, request }) => {
    const baseURL = test.info().project.use.baseURL ?? ""
    const { slug } = await createConfess(baseURL)
    await page.goto(`/?k=${slug}`)
    await expect(page.getByText(QA.toName).first()).toBeVisible()
    // pesan di balik ritual amplop — pakai tombol pintas buka langsung
    await page.getByRole("button", { name: /buka suratnya langsung/i }).click()
    // isi pesan tampil via mesin ketik — cek frasa khasnya
    await expect(page.getByText(/Tes E2E Playwright view penerima/).first()).toBeVisible({
      timeout: 20_000,
    })
  })

  test("kado candle menampilkan pengalaman 'Nyalakan Lilin'", async ({ page }) => {
    const baseURL = test.info().project.use.baseURL ?? ""
    const { id } = await createKado(baseURL, "candle")
    await page.goto(`/kado/${id}`)
    await expect(page.getByText(/Nyalakan Lilin/i)).toBeVisible({ timeout: 30_000 })
  })

  test("kado confess menampilkan pengalaman pengakuan tersegel", async ({ page }) => {
    const baseURL = test.info().project.use.baseURL ?? ""
    const { id } = await createKado(baseURL, "confess")
    await page.goto(`/kado/${id}`)
    // header premium confess + petunjuk eksplisit: ketuk segel, TAHAN hatinya
    await expect(page.getByText(/tersegel dengan detak jantung/i)).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText(/ketuk segelnya/i)).toBeVisible()
  })

  test("kado tipe lama (tap) tetap terbuka lewat pengalaman premium", async ({ page }) => {
    const baseURL = test.info().project.use.baseURL ?? ""
    const { id } = await createKado(baseURL, "tap")
    await page.goto(`/kado/${id}`)
    // hard refactor: tipe lama jatuh ke PremiumConfess — tidak ada UI lama
    await expect(page.getByText(/tersegel dengan detak jantung/i)).toBeVisible({
      timeout: 30_000,
    })
  })

  test("kado ngasal → kartu 404 'Kado nggak ketemu'", async ({ page }) => {
    await page.goto("/kado/00000000-0000-4000-8000-000000000000")
    await expect(page.getByText("Kado nggak ketemu")).toBeVisible()
  })
})
