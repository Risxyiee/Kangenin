import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, withDbRetry, isUniqueViolation } from "@/lib/db";
import { makeSlug, makeToken } from "@/lib/token";
import { rateLimit } from "@/lib/rate-limit";
import { findProhibited, MODERATION_ERROR } from "@/lib/moderation";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";
import { THEME_KEYS, THEME_INVALID_MESSAGE, isThemeSelectable } from "@/lib/themes";

const letterSchema = z.object({
  title: z.string().trim().min(2, "Judul surat minimal 2 karakter").max(80),
  body: z.string().trim().min(5, "Isi surat minimal 5 karakter").max(600),
  unlockDays: z.number().int().min(0).max(84),
});

const createSchema = z.object({
  fromName: z.string().trim().max(40).optional().default(""),
  toName: z.string().trim().min(1, "Nama penerima wajib diisi").max(40),
  // sumber tunggal tema: src/lib/themes.ts (UI & API pasti sinkron) —
  // dulu cuma ["rose","sunset","midnight"] → sakura/matcha dari UI selalu 400
  theme: z.enum(THEME_KEYS).optional().default("rose"),
  letters: z
    .array(letterSchema)
    .min(3, "Minimal 3 surat ya")
    .max(8, "Maksimal 8 surat"),
});

const THEMES = new Set<string>(THEME_KEYS);

export async function POST(req: NextRequest) {
  try {
    // anti-spam: maks 5 set surat per 15 menit per IP
    const rl = await rateLimit(req, "letters-create", 5, 15 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Sabar ya — kamu udah bikin banyak set surat. Coba lagi nanti 😅" },
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
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const isTheme = issue?.path[0] === "theme";
      return NextResponse.json(
        { error: isTheme ? THEME_INVALID_MESSAGE : (issue?.message ?? "Data tidak valid") },
        { status: 400 }
      );
    }
    const { fromName, toName, theme, letters } = parsed.data;

    // tema edisi terbatas yang sudah lewat tidak boleh dipakai walau client
    // lawas masih mengirimnya
    if (!isThemeSelectable(theme)) {
      return NextResponse.json(
        { error: "Tema itu sudah tutup — udah lewat masa edisinya. Pilih tema lain ya." },
        { status: 400 }
      );
    }

    // moderasi ringan: nama + semua judul & isi surat
    for (const field of [fromName, toName]) {
      if (findProhibited(field)) {
        return NextResponse.json({ error: MODERATION_ERROR }, { status: 400 });
      }
    }
    for (let i = 0; i < letters.length; i++) {
      const hit = findProhibited(`${letters[i].title} ${letters[i].body}`);
      if (hit) {
        return NextResponse.json(
          { error: `Surat #${i + 1} ada kata yang nggak boleh dipakai. Tolong ulang pakai bahasa yang baik ya 🙏` },
          { status: 400 }
        );
      }
    }

    // urutkan berdasarkan jeda unlock biar ordernya konsisten
    const sorted = [...letters].sort((a, b) => a.unlockDays - b.unlockDays);

    // withDbRetry: koneksi zombie Hyperdrive sesekali muncul — ulang di
    // koneksi baru, user tidak melihat errornya (pola sama dgn confess/gifts).
    const set = await withDbRetry(async () => {
      // TANPA pre-check findUnique(slug) — query pre-check yang NULL ter-cache
      // Hyperdrive sebelum baris dibuat → GET sesaat usai create 404 (insiden
      // null-read 2026-11-01). Uniqueness ditangani catch P2002 di bawah.
      for (let i = 0; i < 5; i++) {
        try {
          return await db.letterSet.create({
            data: {
              slug: makeSlug(),
              senderKey: makeToken(16),
              fromName: fromName ?? "",
              toName,
              theme: THEMES.has(theme) ? theme : "rose",
              letters: {
                create: sorted.map((l, i) => ({
                  order: i,
                  title: l.title,
                  body: l.body,
                  unlockDays: l.unlockDays,
                })),
              },
            },
            select: { slug: true, id: true, senderKey: true },
          });
        } catch (err) {
          if (isUniqueViolation(err) && i < 4) continue; // slug tabrakan — regenerate
          throw err;
        }
      }
      throw new Error("gagal membuat slug unik setelah 5 percobaan");
    });

    return NextResponse.json(
      { slug: set.slug, id: set.id, senderKey: set.senderKey },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/letters error:", describeError(err), err);
    reportError(err, { route: "POST /api/letters" });
    return NextResponse.json(
      { error: "Gagal membuat surat. Coba lagi ya." },
      { status: 500 }
    );
  }
}
