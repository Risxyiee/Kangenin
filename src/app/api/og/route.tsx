import { ImageResponse } from "next/og";
import { detectKind } from "@/lib/detect";
import { GIFT_META, type GiftType } from "@/lib/gift-data";
import { singleFlight } from "@/lib/singleflight";

export const runtime = "nodejs";

// Kartu OG 1200x630 buat link kado yang di-share ke WA/Twitter.
// /api/og            → kartu generik (landing)
// /api/og?k=<slug>   → kartu personal ("Ada surat rahasia buat Sari")
// Catatan: tanpa emoji — satori butuh font emoji khusus, kita gambar hati pakai div.

/**
 * Cache-API Workers (perbaikan Error 1102): render satori+resvg itu operasi
 * CPU paling berat di seluruh situs (mudah 30-100ms, budget Worker plan free
 * cuma 10ms). Crawler WA/Twitter/Discord memfetch URL yang sama berkali-kali
 * saat link viral — mulai sekarang render cuma SEKALI per URL per PoP, sisanya
 * dilayani caches.default. Fallback aman: kalau Cache API tak tersedia
 * (next dev lokal), tinggal render biasa.
 *
 * Ditambah single-flight per URL (src/lib/singleflight.ts): burst test
 * 2026-11-02 menunjukkan 15 render satori paralel di isolate yang sama =
 * 12×503 (memori rewel). Sekarang render URL sama bersamaan cukup SEKALI,
 * sisanya menumpang bytes yang sama.
 */
const ogCache = (): Cache | null => {
  try {
    return (globalThis as { caches?: { default: Cache } }).caches?.default ?? null;
  } catch {
    return null;
  }
};

// single-flight per URL — render paralel URL sama cukup satu
const ogInflight = new Map<string, { at: number; p: Promise<ArrayBuffer> }>();

export async function GET(req: Request) {
  // 0) kartu generik (tanpa param) → aset statis pre-render, nol CPU:
  //    layout metadata sudah mengarah ke /og-generic.png; redirect ini cuma
  //    buat link lama yang masih memanggil /api/og polos
  const sp = new URL(req.url).searchParams;
  if (!sp.get("k") && !sp.get("flex") && !sp.get("yes")) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/og-generic.png" },
    });
  }

  const cache = ogCache();

  // 1) fast path — cache hit → nol CPU, tanpa antre
  if (cache) {
    try {
      const hit = await cache.match(req.url);
      if (hit) return hit;
    } catch {
      /* cache gagal → lanjut render biasa */
    }
  }

  // 2) single-flight per URL: 15 crawler menyambar URL sama bersamaan →
  //    render cukup SEKALI per isolate; sisanya menumpang bytes yang sama
  const bytes = await singleFlight(
    ogInflight,
    req.url,
    async (): Promise<ArrayBuffer> => {
      // cek ulang dalam antrean — request lain mungkin baru saja mengisi
      // cache saat kita mengantre di belakangnya
      if (cache) {
        try {
          const hit = await cache.match(req.url);
          if (hit) return await hit.arrayBuffer();
        } catch {
          /* abaikan → render */
        }
      }
      return renderOg(req.url);
    }
  );

  // 3) tiap penerima dapat Response sendiri dari bytes yang sama
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

/** Render kartu OG (query judul + satori) lalu simpan ke Cache-API PoP. */
async function renderOg(url: string): Promise<ArrayBuffer> {
  const { searchParams } = new URL(url);
  const k = searchParams.get("k");
  const flex = searchParams.get("flex"); // kartu flex pengirim (share story)
  const yes = searchParams.get("yes"); // kartu kabar bahagia penerima

  let heading = "Ada yang diam-diam mikirin kamu";
  let sub = "Buka kejutannya sekarang — dari seseorang yang selama ini perhatian";

  if (yes) {
    heading = "Dia jawab IYA"; // tanpa emoji — satori butuh font khusus, hati sudah digambar div
    sub = "Semua berawal dari satu surat kecil yang berani dikirim";
  } else if (flex) {
    heading = "Aku baru berani ngirim surat rahasia";
    sub = "Ditulis diam-diam, dikirim cukup lewat link. Kamu kapan?";
  } else if (k) {
    try {
      // detectKind: single-flight — burst crawler URL sama cukup 1 rangkaian query
      const { confession, letterSet, gift } = await detectKind(k);
      if (confession) {
        heading = `Ada surat rahasia buat ${confession.toName}`;
        sub = "Buka sekarang — siapa tahu dia juga punya perasaan yang sama";
      } else if (letterSet) {
        heading = `${letterSet._count.letters} surat kecil buat ${letterSet.toName}`;
        sub = "Satu surat bisa dibuka tiap minggu — pelan-pelan aja bacanya";
      } else if (gift) {
        heading = GIFT_META[gift.type as GiftType]?.ogTitle(gift.toName) ?? `Ada kado buat ${gift.toName}`;
        sub = "Dari seseorang yang diam-diam perhatian — siapin hatinya";
      }
    } catch {
      // gagal query → pakai kartu generik
    }
  }

  const rendered = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #2b0a1c 0%, #4a0e2e 55%, #160510 100%)",
          position: "relative",
        }}
      >
        {/* glow dekoratif — skala 2/3 dari desain 1200px (hemat CPU encode PNG) */}
        <div
          style={{
            position: "absolute",
            top: -93,
            left: -67,
            width: 333,
            height: 333,
            borderRadius: 9999,
            background: "rgba(244,63,94,0.22)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -107,
            right: -53,
            width: 347,
            height: 347,
            borderRadius: 9999,
            background: "rgba(236,72,153,0.16)",
          }}
        />

        {/* segel lilin: lingkaran + hati dari 2 lingkaran & kotak miring */}
        <div
          style={{
            display: "flex",
            width: 72,
            height: 72,
            borderRadius: 9999,
            background: "linear-gradient(135deg, #f43f5e, #be123c)",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 20px 60px rgba(244,63,94,0.45)",
          }}
        >
          <div style={{ position: "relative", width: 29, height: 27, display: "flex" }}>
            <div
              style={{
                position: "absolute",
                width: 15,
                height: 15,
                borderRadius: 9999,
                background: "#ffffff",
                left: 0,
                top: 0,
              }}
            />
            <div
              style={{
                position: "absolute",
                width: 15,
                height: 15,
                borderRadius: 9999,
                background: "#ffffff",
                right: 0,
                top: 0,
              }}
            />
            <div
              style={{
                position: "absolute",
                width: 17,
                height: 17,
                background: "#ffffff",
                transform: "rotate(45deg)",
                left: 6,
                top: 7,
              }}
            />
          </div>
        </div>

        <div
          style={{
            marginTop: 28,
            fontSize: 43,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: -1,
            maxWidth: 667,
            textAlign: "center",
            display: "flex",
          }}
        >
          {heading}
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 20,
            color: "rgba(255,255,255,0.72)",
            maxWidth: 573,
            textAlign: "center",
            display: "flex",
          }}
        >
          {sub}
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 29,
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 9999,
              background: "#f43f5e",
              marginRight: 8,
              display: "flex",
            }}
          />
          <div style={{ fontSize: 19, fontWeight: 700, color: "#ffffff", display: "flex" }}>
            kangen
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, color: "#f43f5e", display: "flex" }}>
            .in
          </div>
        </div>
      </div>
    ),
    // 800×419 = rasio OG 1.91:1 tetap; 44% pixel lebih sedikit dari 1200×630
    // → encode resvg jauh lebih ringan di budget CPU 10ms (Error 1102)
    { width: 800, height: 419 }
  );

  const bytes = await rendered.arrayBuffer();

  // simpan ke Cache-API PoP — request berikutnya nol CPU (isi kartu tak
  // berubah: toName & type statis)
  const cache = ogCache();
  if (cache) {
    try {
      await cache.put(
        url,
        new Response(bytes, {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=86400",
          },
        })
      );
    } catch {
      /* gagal simpan → request ini tetap terlayani */
    }
  }
  return bytes;
}
