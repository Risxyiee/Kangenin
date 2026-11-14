import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isAdmin } from "@/lib/admin-key";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";
import { BASE_URL, fonnteSend, ownerNumbers, waEnv } from "@/lib/wa";

export const runtime = "nodejs";

// ── Admin modul 7: BOT — status & tes WA bot (Fonnte) ────────────────────────
// GET  /api/admin/bot  — status env (tanpa membocorkan isinya) + URL webhook
// POST /api/admin/bot  — kirim pesan tes ke nomor owner via Fonnte
//
// Owner tinggal: (1) pasang env, (2) copy URL webhook ke dashboard Fonnte,
// (3) tekan "Kirim pesan tes". Prinsip fail-closed: tanpa env, status bilang
// jujur apa yang belum ada — tidak pernah setengah hidup.

export async function GET(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json({ error: "nggak ada apa-apa di sini" }, { status: 404 });
    }

    const rl = await rateLimit(req, "admin-bot", 30, 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan. Coba lagi nanti ya." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const env = waEnv();
    const owner = ownerNumbers();
    const secret = env.WA_WEBHOOK_SECRET?.trim();
    const webhookUrl = secret
      ? `${BASE_URL}/api/wa/webhook?token=${encodeURIComponent(secret.slice(0, 6))}…(selengkapnya ada di env)`
      : `${BASE_URL}/api/wa/webhook?token=<WA_WEBHOOK_SECRET>`;

    return NextResponse.json(
      {
        tokenTerpasang: !!env.FONNTE_TOKEN?.trim(),
        ownerTerpasang: owner.length > 0,
        ownerMasked: owner.map((n) => `${n.slice(0, 4)}••••${n.slice(-3)}`),
        secretTerpasang: !!secret,
        webhookUrl,
        perintah: ["menu", "link <kunci>", "pengunjung", "kirim <nomor62> <kunci>"],
      },
      { headers: { "Cache-Control": "no-store, max-age=0", "CDN-Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("GET /api/admin/bot error:", describeError(err), err);
    reportError(err, { route: "GET /api/admin/bot" });
    return NextResponse.json({ error: "Gagal memuat status bot." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json({ error: "nggak ada apa-apa di sini" }, { status: 404 });
    }

    const rl = await rateLimit(req, "admin-bot-test", 6, 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan. Coba lagi nanti ya." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const owner = ownerNumbers()[0];
    if (!owner) {
      return NextResponse.json(
        { error: "WA_OWNER_NUMBER belum terpasang — pesan tes nggak tahu mau dikirim ke mana." },
        { status: 503 }
      );
    }

    const hasil = await fonnteSend(
      owner,
      "✅ Tes bot Kangenin berhasil!\n\nBot sudah terhubung. Ketik *menu* ke bot ini buat lihat daftar perintah."
    );
    if (!hasil.ok) {
      return NextResponse.json({ error: `Gagal kirim: ${hasil.error ?? "tidak diketahui"}` }, { status: 502 });
    }
    return NextResponse.json({ ok: true, tujuan: `${owner.slice(0, 4)}••••${owner.slice(-3)}` });
  } catch (err) {
    console.error("POST /api/admin/bot error:", describeError(err), err);
    reportError(err, { route: "POST /api/admin/bot" });
    return NextResponse.json({ error: "Gagal kirim pesan tes." }, { status: 500 });
  }
}
