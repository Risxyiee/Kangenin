import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db, withDbRetry } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

// ── Aturan mutlak infrastruktur ──────────────────────────────────────────────
// TANPA `export const runtime = "edge"` — OpenNext meng-compile seluruh app
// jadi satu Worker (penjelasan lengkap: src/app/api/kado/route.ts). Koneksi DB
// HANYA lewat src/lib/db.ts → Hyperdrive → direct connection Supabase 5432.

/**
 * DELETE /api/kado/[id] — pengirim menghapus kadonya permanen.
 *
 * MODEL KEPERCAYAAN (jujur & konsisten dengan seluruh produk): kado tidak
 * menyimpan senderKey — "pemilik" adalah PEMEGANG LINK. Halaman share
 * (/kado/[id]/share) sudah bekerja begitu: siapa pun yang pegang link bisa
 * menyalin alibi, QR, dan memantau balasan. Endpoint ini mengikuti model yang
 * sama. Konsekuensinya: penerima yang punya link kado juga SECARA TEKNIS bisa
 * menghapus — risikonya ke dirinya sendiri (membakar hadiahnya sendiri), data
 * yang hilang cuma miliknya berdua, dan id UUID mustahil ditebak orang luar.
 * Kalau nanti perlu pemisahan kuat, tambahkan kolom senderKey + migrasi —
 * itu keputusan produk, bukan patch kecil.
 *
 * Kenapa hard delete (bukan status "deleted"): balasan & progres tersimpan di
 * baris kado itu sendiri (kadoData JSONB) — tidak ada tabel anak, jadi satu
 * DELETE bersih tanpa data yatim. Foto base64 di kadoData ikut terbeaskan
 * dari baris DB.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    // anti-spam/anti-ngebut: 5 hapus per menit per IP sudah jauh melebihi
    // kebutuhan manusia (hapus = aksi sekali, bukan berulang)
    const rl = await rateLimit(req, "kado-delete", 5, 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Sabar ya — terlalu banyak percobaan hapus. Coba lagi sebentar." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    // UUID salah format → tidak perlu ganggu database (kolom id bertipe uuid;
    // query dengan string acak cuma menghasilkan error 22P02 di log).
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Link kado tidak valid" }, { status: 400 });
    }

    try {
      await withDbRetry(() => db.kado.delete({ where: { id }, select: { id: true } }));
    } catch (err) {
      // P2025 = record not found — kadonya memang sudah tidak ada.
      // Respons tetap sukses: hapus bersifat idempoten, dua kali tekan hapus
      // tidak boleh bikin user melihat error.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return NextResponse.json(
          { success: true, alreadyGone: true },
          { headers: { "Cache-Control": "no-store, max-age=0" } }
        );
      }
      throw err;
    }

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    console.error("DELETE /api/kado/[id] error:", describeError(err), err);
    reportError(err, { route: "DELETE /api/kado/[id]" });
    return NextResponse.json({ error: "Gagal menghapus kado. Coba lagi ya." }, { status: 500 });
  }
}
