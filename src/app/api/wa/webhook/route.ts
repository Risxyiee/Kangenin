import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { describeError } from "@/lib/log-error";
import { detectKind } from "@/lib/detect";
import {
  BASE_URL,
  PESAN_MENU,
  fonnteSend,
  isOwner,
  nomorBersih,
  pesanLink,
  pesanPengunjung,
  waEnv,
  type LinkInfo,
} from "@/lib/wa";
import { getPgPool } from "@/lib/db";

export const runtime = "nodejs";

// ── WA Bot (Fonnte): webhook masuk ───────────────────────────────────────────
// POST /api/wa/webhook?token=<WA_WEBHOOK_SECRET>
//
// Fonnte men-POST setiap pesan WA yang masuk ke device ke URL ini. Kita parse
// command, siapkan balasan, lalu kirim balik via Fonnte (fonnteSend).
//
// Perintah:
//   menu / help                     → daftar perintah (semua orang)
//   link <kunci>                    → link siap-share (semua orang, rate-limit)
//   pengunjung                      → denyut realtime (owner saja)
//   kirim <nomor62xxx> <kunci>      → kirim link ke nomor tujuan (owner saja)
//
// Keamanan: token di URL (WA_WEBHOOK_SECRET) sebagai gerbang pertama;
// perintah owner dicek lewat WA_OWNER_NUMBER; semua balasan kembali lewat
// Fonnte API, bukan echo. Prinsip fail-closed: env belum lengkap → bot diam.

function pesanNotFoundOwner(sender: string): string {
  return [
    "🔒 Perintah ini khusus owner.",
    "",
    `Nomor kamu (${sender}) belum terdaftar di WA_OWNER_NUMBER.`,
    "Pasang di Cloudflare → Settings → Variables, lalu coba lagi.",
  ].join("\n");
}

async function statistikLive() {
  // SATU query agregat + SATU query paths — sama dengan /api/admin/visits/live
  const agg = await getPgPool().query<{
    online1m: number;
    online5m: number;
    unikHariIni: number;
    viewsHariIni: number;
    baru1jam: number;
  }>(
    `select
       count(*) filter (where "lastSeen" > now() - interval '60 seconds')::int as "online1m",
       count(*) filter (where "lastSeen" > now() - interval '5 minutes')::int as "online5m",
       count(*) filter (where ("firstSeen" at time zone 'Asia/Jakarta')::date
                         = (now() at time zone 'Asia/Jakarta')::date)::int as "unikHariIni",
       coalesce(sum("views") filter (
         where ("firstSeen" at time zone 'Asia/Jakarta')::date
               = (now() at time zone 'Asia/Jakarta')::date), 0)::int as "viewsHariIni",
       count(*) filter (where "firstSeen" > now() - interval '1 hour')::int as "baru1jam"
     from "VisitLive"`
  );
  const paths = await getPgPool()
    .query<{ path: string; orang: number }>(
      `select "path", count(*)::int as orang
       from "VisitLive"
       where "lastSeen" > now() - interval '2 minutes'
       group by "path" order by orang desc limit 5`
    )
    .catch(() => ({ rows: [] as { path: string; orang: number }[] }));
  const a = agg.rows[0];
  if (!a) return null;
  return {
    online1m: Number(a.online1m),
    online5m: Number(a.online5m),
    unikHariIni: Number(a.unikHariIni),
    viewsHariIni: Number(a.viewsHariIni),
    baru1jam: Number(a.baru1jam),
    sedangMembuka: paths.rows.map((r) => ({ path: r.path, orang: Number(r.orang) })),
  };
}

async function infoLink(slug: string): Promise<LinkInfo> {
  const k = await detectKind(slug);
  if (k.confession) return { kind: "confession", toName: k.confession.toName };
  if (k.letterSet) return { kind: "letterSet", toName: k.letterSet.toName, jumlah: k.letterSet._count.letters };
  if (k.gift) return { kind: "gift", toName: k.gift.toName, tipe: k.gift.type };
  return { kind: "tidakAda" };
}

export async function POST(req: NextRequest) {
  try {
    // gerbang 1: token rahasia di URL (kalau terpasang)
    const secret = waEnv().WA_WEBHOOK_SECRET?.trim();
    if (secret && req.nextUrl.searchParams.get("token") !== secret) {
      return NextResponse.json({ error: "nggak ada apa-apa di sini" }, { status: 404 });
    }

    // gerbang 2: bot belum dikonfigurasi → jawab sopan, Fonnte tak akan kirim
    if (!waEnv().FONNTE_TOKEN?.trim()) {
      return NextResponse.json({ ok: false, alasan: "FONNTE_TOKEN belum terpasang" }, { status: 503 });
    }

    // parse: Fonnte bisa JSON atau form-encoded — terima keduanya
    let sender = "";
    let message = "";
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const j = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      sender = String(j.sender ?? "");
      message = String(j.message ?? "");
    } else {
      const f = await req.formData().catch(() => null);
      sender = String(f?.get("sender") ?? "");
      message = String(f?.get("message") ?? "");
    }
    const nomor = nomorBersih(sender);
    if (!nomor || !message.trim()) return NextResponse.json({ ok: true });

    // rate limit per pengirim (bukan per IP — semua request datang dari Fonnte)
    const rl = await rateLimit(req, `wa-${nomor}`, 12, 60 * 1000);
    if (!rl.ok) {
      await fonnteSend(
        nomor,
        "Santai dulu ya 😅 terlalu banyak perintah dalam semenit. Coba lagi sebentar."
      );
      return NextResponse.json({ ok: true });
    }

    const cmd = message.trim().toLowerCase();

    // ── routing perintah ──
    if (cmd === "menu" || cmd === "help" || cmd === "bantuan") {
      await fonnteSend(nomor, PESAN_MENU);
      return NextResponse.json({ ok: true });
    }

    if (cmd.startsWith("pengunjung")) {
      if (!isOwner(sender)) {
        await fonnteSend(nomor, pesanNotFoundOwner(nomor));
        return NextResponse.json({ ok: true });
      }
      try {
        const d = await statistikLive();
        await fonnteSend(
          nomor,
          d
            ? pesanPengunjung(d)
            : "Tabel realtime belum siap — jalankan SQL setup dulu ya (scripts/sql_visit_live.sql)."
        );
      } catch {
        await fonnteSend(nomor, "Waduh, gagal baca statistik. Coba lagi sebentar ya.");
      }
      return NextResponse.json({ ok: true });
    }

    if (cmd.startsWith("link ") || cmd.startsWith("link\n")) {
      const slug = message.trim().slice(5).trim().split(/\s+/)[0].slice(0, 80);
      if (!slug) {
        await fonnteSend(nomor, "Formatnya: `link <kunci>`\nContoh: link abc123");
        return NextResponse.json({ ok: true });
      }
      const info = await infoLink(slug);
      await fonnteSend(nomor, pesanLink(info, slug));
      return NextResponse.json({ ok: true });
    }

    if (cmd.startsWith("kirim ")) {
      if (!isOwner(sender)) {
        await fonnteSend(nomor, pesanNotFoundOwner(nomor));
        return NextResponse.json({ ok: true });
      }
      const bagian = message.trim().slice(6).trim().split(/\s+/);
      const tujuan = (bagian[0] ?? "").replace(/[^0-9]/g, "");
      const slug = (bagian[1] ?? "").slice(0, 80);
      if (!/^62\d{8,13}$/.test(tujuan) || !slug) {
        await fonnteSend(
          nomor,
          "Formatnya: `kirim <nomor62> <kunci>`\nContoh: kirim 6281234567890 abc123"
        );
        return NextResponse.json({ ok: true });
      }
      const info = await infoLink(slug);
      if (info.kind === "tidakAda") {
        await fonnteSend(nomor, pesanLink(info, slug));
        return NextResponse.json({ ok: true });
      }
      const hasil = await fonnteSend(tujuan, pesanLink(info, slug));
      await fonnteSend(
        nomor,
        hasil.ok
          ? `✅ Link buat kunci "${slug}" sudah dikirim ke ${tujuan}.`
          : `❌ Gagal kirim ke ${tujuan}: ${hasil.error}`
      );
      return NextResponse.json({ ok: true });
    }

    // perintah tak dikenal → menu (jangan spam teks panjang)
    if (cmd.length > 0) {
      await fonnteSend(
        nomor,
        `Nggak paham perintah itu 🤔\nKetik *menu* buat lihat daftar perintah.\n\n${BASE_URL}`
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    // webhook harus tetap 200 — kalau 500 Fonnte akan retry terus
    console.error("POST /api/wa/webhook error:", describeError(err), err);
    return NextResponse.json({ ok: true });
  }
}
