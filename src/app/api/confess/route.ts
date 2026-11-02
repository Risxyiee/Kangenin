import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, withDbRetry, isUniqueViolation } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { findProhibited, MODERATION_ERROR } from "@/lib/moderation";
import { makeSlug, makeToken } from "@/lib/token";
import { describeError } from "@/lib/log-error";
import { THEME_KEYS, THEME_INVALID_MESSAGE, isThemeSelectable } from "@/lib/themes";
import { reportError } from "@/lib/monitor";
import { scheduleOgWarm } from "@/lib/og-warm";

const confessSchema = z.object({
  fromName: z.string().trim().max(40).optional().default(""),
  toName: z.string().trim().min(1, "Nama crush wajib diisi").max(40),
  message: z
    .string()
    .trim()
    .min(5, "Pesan minimal 5 karakter")
    .max(600, "Pesan maksimal 600 karakter"),
  // sumber tunggal tema: src/lib/themes.ts (UI & API pasti sinkron)
  theme: z.enum(THEME_KEYS).optional().default("rose"),
  // opt-in tampil di Dinding Kangenin (cuma nama & tema — isi surat tidak)
  isPublic: z.boolean().optional().default(false),
  // Papan Pengakuan (halaman depan): isi surat ikut tayang — opt-in eksplisit.
  // showMessage=true memaksa isPublic=true di server (tidak percaya client).
  showMessage: z.boolean().optional().default(false),
  // identitas pengirim di papan: "anonim" | "nama" (kata pertama fromName)
  showAs: z.enum(["anonim", "nama"]).optional().default("anonim"),
  // kirim terjadwal: ISO string, wajib masa depan, maks 30 hari ke depan
  unlockAt: z.string().datetime({ offset: true }).optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    // anti-spam: maks 5 confess per 15 menit per IP
    const rl = await rateLimit(req, "confess-create", 5, 15 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Sabar ya — kamu udah bikin banyak confess. Coba lagi nanti 😅" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    // body rusak / bukan JSON → 400 rapi (bukan 500 dari outer catch)
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Format request tidak valid" }, { status: 400 });
    }
    const parsed = confessSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const isTheme = issue?.path[0] === "theme";
      return NextResponse.json(
        { error: isTheme ? THEME_INVALID_MESSAGE : (issue?.message ?? "Data tidak valid") },
        { status: 400 }
      );
    }
    const { fromName, toName, message, theme, isPublic, showMessage, showAs, unlockAt } =
      parsed.data;
    // papan menyalakan dinding juga (isi tampil > cukup nama tampil), bukan sebaliknya
    const isPublicFinal = isPublic || showMessage;

    // tema edisi terbatas yang sudah lewat tidak boleh dipakai walau client
    // lawas masih mengirimnya
    if (!isThemeSelectable(theme)) {
      return NextResponse.json(
        { error: "Tema itu sudah tutup — udah lewat masa edisinya. Pilih tema lain ya." },
        { status: 400 }
      );
    }

    // moderasi ringan sebelum masuk DB
    for (const field of [fromName, toName, message]) {
      const hit = findProhibited(field);
      if (hit) {
        return NextResponse.json({ error: MODERATION_ERROR }, { status: 400 });
      }
    }

    // validasi jadwal buka: masa depan, maksimal 30 hari
    let unlock: Date | null = null;
    if (unlockAt) {
      const d = new Date(unlockAt);
      const now = Date.now();
      if (Number.isNaN(d.getTime()) || d.getTime() < now + 60_000) {
        return NextResponse.json(
          { error: "Jadwal buka harus minimal 1 menit dari sekarang." },
          { status: 400 }
        );
      }
      if (d.getTime() > now + 30 * 24 * 60 * 60 * 1000) {
        return NextResponse.json(
          { error: "Jadwal buka maksimal 30 hari ke depan ya." },
          { status: 400 }
        );
      }
      unlock = d;
    }

    const senderKey = makeToken(16);
    // withDbRetry: kalau kena koneksi zombie Hyperdrive, ulang sekali di
    // koneksi baru — pengguna tidak melihat errornya.
    //
    // TANPA pre-check findUnique(slug): query pre-check yang NULL ter-cache
    // Hyperdrive sebelum baris dibuat → GET sesaat usai create membaca cache
    // NULL → 404 (insiden null-read 2026-11-01). Uniqueness via catch P2002.
    const confession = await withDbRetry(async () => {
      for (let i = 0; i < 5; i++) {
        try {
          return await db.confession.create({
            data: {
              slug: makeSlug(),
              senderKey,
              fromName: fromName ?? "",
              toName,
              message,
              theme,
              isPublic: isPublicFinal,
              showMessage,
              showAs,
              ...(unlock ? { unlockAt: unlock } : {}),
            },
          });
        } catch (err) {
          if (isUniqueViolation(err) && i < 4) continue; // slug tabrakan — regenerate
          throw err;
        }
      }
      throw new Error("gagal membuat slug unik setelah 5 percobaan");
    });

    // panaskan kartu OG personal sejak sekarang (waitUntil — gak menunda
    // respons): saat link di-share, crawler WA dkk langsung dapat cache,
    // gak jadi korban Error 1102 di jalur render satori
    scheduleOgWarm(new URL(req.url).origin, confession.slug);

    return NextResponse.json(
      { slug: confession.slug, id: confession.id, senderKey },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/confess error:", describeError(err), err);
    reportError(err, { route: "POST /api/confess" });
    return NextResponse.json(
      { error: "Gagal membuat confess. Coba lagi ya." },
      { status: 500 }
    );
  }
}
