import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { E, FONT_HAND, FONT_STACK } from "./theme";
import {
  CheckDraw,
  Cursor,
  HandText,
  Head,
  Kicker,
  PaperCard,
  Pill,
  Seal,
  Tag,
  typed,
} from "./ui";

/* ── S1 · Hook: input yang diketik (0-84) ─────────────────────────────── */
export const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = spring({ frame: f - 12, fps, config: { damping: 17 } });
  const btn = spring({ frame: f - 52, fps, config: { damping: 14, stiffness: 150 } });
  const blink = Math.floor(f / 14) % 2 === 0;
  return (
    <AbsoluteFill>
      <Kicker delay={4} top={170}>
        Cara confess tanpa ketahuan
      </Kicker>
      <div
        style={{
          position: "absolute",
          top: 300,
          left: 70,
          right: 70,
          textAlign: "center",
          fontFamily: FONT_STACK,
          fontWeight: 800,
          fontSize: 92,
          lineHeight: 1.12,
          letterSpacing: "-2px",
          color: E.ink,
          opacity: interpolate(spring({ frame: f - 18, fps }), [0, 1], [0, 1]),
          transform: `translateY(${interpolate(spring({ frame: f - 18, fps }), [0, 1], [40, 0])}px)`,
        }}
      >
        tulis apa aja.
        <br />
        <span style={{ color: E.crimson }}>namamu nggak ikut.</span>
      </div>

      <PaperCard
        style={{
          position: "absolute",
          top: 760,
          left: 90,
          right: 90,
          padding: "38px 42px",
          opacity: interpolate(card, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(card, [0, 1], [60, 0])}px)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              width: 16,
              height: 46,
              borderRadius: 8,
              background: E.crimson,
              marginRight: 6,
            }}
          />
          <div
            style={{
              fontSize: 44,
              fontWeight: 600,
              color: E.ink,
              minHeight: 56,
            }}
          >
            {typed("aku suka kamu dari dulu", f, 22, 0.9)}
            <span style={{ opacity: blink ? 1 : 0, color: E.crimson }}>|</span>
          </div>
        </div>
      </PaperCard>

      <div
        style={{
          position: "absolute",
          top: 960,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: interpolate(btn, [0, 1], [0, 1]),
          transform: `scale(${interpolate(btn, [0, 1], [0.7, 1])})`,
        }}
      >
        <Pill tone="crimson">Buat link rahasia →</Pill>
      </div>

      <div
        style={{
          position: "absolute",
          top: 1120,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: interpolate(f - 66, [0, 8], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <Tag tone="crimson">gratis · tanpa login</Tag>
      </div>
    </AbsoluteFill>
  );
};

/* ── S2 · Promise: bubble jaminan anonim (84-150) ─────────────────────── */
export const Promise: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bubble = spring({ frame: f - 8, fps, config: { damping: 16 } });
  return (
    <AbsoluteFill>
      <PaperCard
        style={{
          position: "absolute",
          top: 560,
          left: 110,
          right: 110,
          padding: "48px 52px",
          borderRadius: 40,
          opacity: interpolate(bubble, [0, 1], [0, 1]),
          transform: `scale(${interpolate(bubble, [0, 1], [0.8, 1])})`,
        }}
      >
        <div style={{ fontSize: 58, fontWeight: 700, lineHeight: 1.3, color: E.ink }}>
          Tenang — dia cuma baca suratnya.
          <br />
          <span style={{ color: E.crimson, fontWeight: 800 }}>
            Nama kamu nggak pernah ketahuan.
          </span>
        </div>
        {/* ekor bubble */}
        <div
          style={{
            position: "absolute",
            bottom: -22,
            left: 120,
            width: 44,
            height: 44,
            background: E.card,
            borderRight: `2px solid ${E.border}`,
            borderBottom: `2px solid ${E.border}`,
            transform: "rotate(45deg)",
          }}
        />
      </PaperCard>

      <div
        style={{
          position: "absolute",
          top: 1080,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 24,
          opacity: interpolate(f - 30, [0, 8], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <Tag tone="crimson">🔒 100% anonim</Tag>
        <Tag tone="cream">⚡ 1 menit jadi</Tag>
      </div>
    </AbsoluteFill>
  );
};

/* ── S3 · Checklist "cuma 4 langkah" (150-270) ────────────────────────── */
const STEPS = [
  "Tulis surat rahasiamu",
  "Kasih nama dia — Sari",
  "Bikin link rahasia",
  "Share ke dia 🤫",
];
export const Steps: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Head delay={4} size={84}>
        Cuma <span style={{ color: E.crimson }}>4 langkah</span>
      </Head>
      <PaperCard
        style={{
          position: "absolute",
          top: 480,
          left: 90,
          right: 90,
          padding: "26px 40px",
          opacity: interpolate(spring({ frame: f - 10, fps }), [0, 1], [0, 1]),
        }}
      >
        {STEPS.map((s, i) => {
          const row = spring({
            frame: f - (22 + i * 16),
            fps,
            config: { damping: 16 },
          });
          const active = f >= 22 + i * 16 && f < 46 + i * 16;
          return (
            <div
              key={s}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 26,
                padding: "26px 24px",
                borderRadius: 22,
                marginTop: i === 0 ? 0 : 10,
                background: active ? E.paperDeep : "transparent",
                border: active ? `2px solid ${E.crimson}` : "2px solid transparent",
                opacity: interpolate(row, [0, 1], [0, 1]),
                transform: `translateX(${interpolate(row, [0, 1], [50, 0])}px)`,
              }}
            >
              <CheckDraw delay={26 + i * 16} />
              <div style={{ fontSize: 44, fontWeight: 700, color: E.ink }}>{s}</div>
            </div>
          );
        })}
      </PaperCard>
      <div
        style={{
          position: "absolute",
          top: 1180,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: interpolate(f - 96, [0, 10], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <Tag tone="cream">tinggal tunggu dia buka 👀</Tag>
      </div>
    </AbsoluteFill>
  );
};

/* ── S4 · Menulis surat (270-408) ─────────────────────────────────────── */
export const Letter: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = spring({ frame: f - 8, fps, config: { damping: 18 } });
  const sealPop = spring({
    frame: f - 92,
    fps,
    config: { damping: 12, stiffness: 160 },
  });
  const letter =
    "tiap lihat story kamu, aku senyum-senyum sendiri. hari ini aku beraniin diri bilang: aku suka kamu.";
  return (
    <AbsoluteFill>
      <Head delay={4} size={78}>
        ✍️ Menulis surat
      </Head>

      {/* kertas surat miring + selotip + perangko */}
      <div
        style={{
          position: "absolute",
          top: 430,
          left: 120,
          right: 120,
          transform: `rotate(-2deg) translateY(${interpolate(card, [0, 1], [70, 0])}px)`,
          opacity: interpolate(card, [0, 1], [0, 1]),
        }}
      >
        <PaperCard style={{ padding: "56px 56px 64px", position: "relative", borderRadius: 24 }}>
          {/* selotip */}
          <div
            style={{
              position: "absolute",
              top: -22,
              left: "50%",
              width: 220,
              height: 52,
              transform: "translateX(-50%) rotate(-4deg)",
              background: "rgba(232,180,187,0.75)",
              borderRadius: 6,
            }}
          />
          {/* perangko */}
          <div
            style={{
              position: "absolute",
              top: 40,
              right: 44,
              width: 120,
              height: 140,
              border: `3px dashed rgba(157,28,52,0.45)`,
              background: "rgba(157,28,52,0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Seal size={78} />
          </div>

          <HandText style={{ fontSize: 64, color: E.crimson }}>Buat Sari,</HandText>
          <div
            style={{
              marginTop: 30,
              fontSize: 50,
              lineHeight: 1.45,
              color: E.ink,
              maxWidth: 520,
              minHeight: 320,
            }}
          >
            <HandText>{typed(letter, f, 26, 1.15)}</HandText>
            {f > 26 && f < 100 && (
              <span style={{ opacity: Math.floor(f / 12) % 2 === 0 ? 1 : 0, color: E.crimson }}>
                |
              </span>
            )}
          </div>

          {/* segel lilin pop */}
          <div
            style={{
              position: "absolute",
              bottom: -34,
              right: -20,
              opacity: interpolate(sealPop, [0, 1], [0, 1]),
              transform: `scale(${interpolate(sealPop, [0, 1], [0.3, 1])}) rotate(${interpolate(
                sealPop,
                [0, 1],
                [-30, -8]
              )}deg)`,
            }}
          >
            <Seal size={150} />
          </div>
        </PaperCard>
      </div>

      <div
        style={{
          position: "absolute",
          top: 1340,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: interpolate(f - 108, [0, 10], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <Tag tone="cream">disegel rapat — cuma dia yang bisa buka</Tag>
      </div>
    </AbsoluteFill>
  );
};

/* ── S5 · Beat "takut ketahuan?" (408-498) ────────────────────────────── */
export const Anonim: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const toast = spring({ frame: f - 14, fps, config: { damping: 15 } });
  const stamp = spring({
    frame: f - 44,
    fps,
    config: { damping: 11, stiffness: 170 },
  });
  return (
    <AbsoluteFill style={{ backgroundColor: E.dark }}>
      <Kicker delay={4} top={200} color={E.blush}>
        Terus… dia bisa tahu siapa aku?
      </Kicker>

      {/* kartu pengirim dengan nama yang disensor */}
      <PaperCard
        style={{
          position: "absolute",
          top: 640,
          left: 130,
          right: 130,
          padding: "46px 52px",
          opacity: interpolate(toast, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(toast, [0, 1], [50, 0])}px)`,
        }}
      >
        <div style={{ fontSize: 38, fontWeight: 700, color: E.inkSoft, letterSpacing: "0.08em" }}>
          NAMA PENGIRIM
        </div>
        <div
          style={{
            marginTop: 20,
            display: "flex",
            alignItems: "center",
            gap: 24,
          }}
        >
          <div
            style={{
              flex: 1,
              height: 72,
              borderRadius: 14,
              background: E.ink,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                paddingLeft: 26,
                fontFamily: FONT_STACK,
                fontWeight: 700,
                fontSize: 40,
                color: E.ink,
                WebkitTextFillColor: "transparent",
              }}
            >
              nama kamu di sini
            </div>
          </div>
          {/* stempel ANONIM */}
          <div
            style={{
              transform: `scale(${interpolate(stamp, [0, 1], [2.2, 1])}) rotate(${interpolate(
                stamp,
                [0, 1],
                [-18, -7]
              )}deg)`,
              opacity: interpolate(stamp, [0, 1], [0, 1]),
              border: `6px solid ${E.crimson}`,
              color: E.crimson,
              borderRadius: 14,
              padding: "12px 26px",
              fontWeight: 800,
              fontSize: 44,
              letterSpacing: "0.06em",
            }}
          >
            ANONIM ✓
          </div>
        </div>
      </PaperCard>

      <div
        style={{
          position: "absolute",
          top: 1080,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 22,
          opacity: interpolate(f - 62, [0, 8], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <Pill tone="cream" style={{ fontSize: 34, padding: "16px 34px" }}>
          pakai nama samaran
        </Pill>
        <Pill tone="crimson" style={{ fontSize: 34, padding: "16px 34px" }}>
          tanpa nama sama sekali
        </Pill>
      </div>
    </AbsoluteFill>
  );
};

/* ── S6 · Link + kartu share (498-624) ────────────────────────────────── */
export const Share: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const link = spring({ frame: f - 6, fps, config: { damping: 16 } });
  const copied = f > 40;
  const bubble = spring({ frame: f - 64, fps, config: { damping: 15 } });
  const click = f >= 32 && f < 44;
  return (
    <AbsoluteFill>
      <Head delay={2} size={78}>
        share lewat <span style={{ color: E.crimson }}>link</span>
      </Head>

      {/* bar URL */}
      <PaperCard
        style={{
          position: "absolute",
          top: 440,
          left: 90,
          right: 90,
          padding: "34px 38px",
          display: "flex",
          alignItems: "center",
          gap: 24,
          opacity: interpolate(link, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(link, [0, 1], [50, 0])}px)`,
        }}
      >
        <span style={{ fontSize: 40, color: E.crimson }}>🔗</span>
        <div style={{ fontSize: 42, fontWeight: 700, color: E.ink, flex: 1 }}>
          kangenin.web.id/k/7b3f9a
        </div>
        <div style={{ position: "relative" }}>
          <Pill tone={copied ? "cream" : "crimson"} style={{ fontSize: 32, padding: "14px 30px" }}>
            {copied ? "Tersalin ✓" : "Salin"}
          </Pill>
          <Cursor x={150} y={-20} press={click} show={f >= 30 && f < 58} />
        </div>
      </PaperCard>

      {/* preview kartu di chat (mirip OG card) */}
      <div
        style={{
          position: "absolute",
          top: 760,
          left: 110,
          right: 110,
          opacity: interpolate(bubble, [0, 1], [0, 1]),
          transform: `scale(${interpolate(bubble, [0, 1], [0.82, 1])})`,
        }}
      >
        <PaperCard style={{ borderRadius: 36, overflow: "hidden" }}>
          <div
            style={{
              background: E.blush,
              height: 190,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 74,
            }}
          >
            💌
          </div>
          <div style={{ padding: "34px 40px 40px" }}>
            <div style={{ fontSize: 46, fontWeight: 800, color: E.ink, lineHeight: 1.25 }}>
              Ada surat rahasia buat Sari
            </div>
            <div style={{ marginTop: 14, fontSize: 34, color: E.inkSoft, lineHeight: 1.4 }}>
              Seseorang diam-diam perhatian. Buka sekarang — siapa tahu dia juga punya perasaan
              yang sama.
            </div>
            <div style={{ marginTop: 20, fontSize: 28, fontWeight: 700, color: E.crimson }}>
              kangenin.web.id
            </div>
          </div>
        </PaperCard>
        {/* ekor chat */}
        <div
          style={{
            position: "absolute",
            top: -20,
            left: 60,
            width: 40,
            height: 40,
            background: E.card,
            border: `2px solid ${E.border}`,
            borderBottom: "none",
            borderRight: "none",
            transform: "rotate(45deg)",
          }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          top: 1440,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: interpolate(f - 96, [0, 10], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <Tag tone="cream">kirim ke WA/IG — otomatis jadi kartu penasaran</Tag>
      </div>
    </AbsoluteFill>
  );
};

/* ── S7 · POV dia buka surat (624-744) ────────────────────────────────── */
export const Buka: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flap = interpolate(f - 14, [0, 22], [0, -175], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const letterUp = spring({ frame: f - 40, fps, config: { damping: 17 } });
  return (
    <AbsoluteFill style={{ backgroundColor: "#211d1a" }}>
      <Kicker delay={4} top={200} color={E.blush}>
        POV: dia buka suratnya 🤍
      </Kicker>

      {/* amplop */}
      <div style={{ position: "absolute", top: 620, left: 0, right: 0, perspective: 1200 }}>
        <div style={{ position: "relative", width: 640, height: 420, margin: "0 auto" }}>
          {/* surat yang naik */}
          <div
            style={{
              position: "absolute",
              left: 40,
              right: 40,
              top: 30,
              height: 480,
              background: E.card,
              borderRadius: 16,
              padding: "44px 48px",
              zIndex: 2,
              opacity: interpolate(letterUp, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(letterUp, [0, 1], [120, -170])}px) rotate(-1.5deg)`,
              boxShadow: "0 30px 70px -30px rgba(0,0,0,0.8)",
            }}
          >
            <HandText style={{ fontSize: 58, color: E.crimson, lineHeight: 1.3 }}>
              aku suka kamu, dari lama.
              <br />
              <span style={{ fontSize: 44, color: E.inkSoft }}>— seseorang</span>
            </HandText>
          </div>
          {/* badan amplop */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: E.paperDeep,
              borderRadius: 18,
              border: `2px solid ${E.border}`,
              zIndex: 3,
              clipPath: "polygon(0 45%, 50% 78%, 100% 45%, 100% 100%, 0 100%)",
            }}
          />
          {/* tutup amplop membuka */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 210,
              background: E.paper,
              borderRadius: "18px 18px 0 0",
              zIndex: 4,
              transformOrigin: "top center",
              transform: `rotateX(${flap}deg)`,
              border: `2px solid ${E.border}`,
              borderBottom: "none",
            }}
          >
            <div style={{ position: "absolute", bottom: -46, right: 26 }}>
              <Seal size={110} />
            </div>
          </div>
        </div>
      </div>

      {/* hati kecil melayang pelan */}
      {[
        { x: 200, y: 1180, d: 58, s: 44, c: E.crimson },
        { x: 850, y: 1240, d: 70, s: 36, c: E.blush },
        { x: 520, y: 1300, d: 82, s: 52, c: E.seal },
      ].map((h, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: h.x,
            top: h.y - Math.max(0, f - h.d) * 1.4,
            fontSize: h.s,
            opacity: interpolate(f - h.d, [0, 12, 60], [0, 0.9, 0], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          ❤️
        </div>
      ))}
    </AbsoluteFill>
  );
};

/* ── S8 · Closer: tagline + seal + CTA (744-840) ──────────────────────── */
export const Closer: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seal = spring({ frame: f - 4, fps, config: { damping: 13, stiffness: 130 } });
  const line1 = spring({ frame: f - 22, fps, config: { damping: 16 } });
  const line2 = spring({ frame: f - 32, fps, config: { damping: 16 } });
  const cta = spring({ frame: f - 46, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill style={{ backgroundColor: E.paper }}>
      <div
        style={{
          position: "absolute",
          top: 360,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: interpolate(seal, [0, 1], [0, 1]),
          transform: `scale(${interpolate(seal, [0, 1], [0.5, 1])}) rotate(${interpolate(
            seal,
            [0, 1],
            [-14, -3]
          )}deg)`,
        }}
      >
        <Seal size={330} />
      </div>

      <div
        style={{
          position: "absolute",
          top: 800,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: FONT_STACK,
        }}
      >
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: E.ink,
            opacity: interpolate(line1, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(line1, [0, 1], [40, 0])}px)`,
          }}
        >
          Bukan cuma chat.
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 118,
            fontWeight: 800,
            color: E.crimson,
            letterSpacing: "-2px",
            opacity: interpolate(line2, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(line2, [0, 1], [44, 0])}px)`,
          }}
        >
          BIKIN DIA KANGEN.
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: 1150,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: interpolate(cta, [0, 1], [0, 1]),
          transform: `scale(${interpolate(cta, [0, 1], [0.8, 1])})`,
        }}
      >
        <Pill tone="crimson" style={{ fontSize: 48, padding: "26px 60px" }}>
          kangenin.web.id
        </Pill>
        <div style={{ marginTop: 26, fontSize: 30, fontWeight: 600, color: E.inkSoft }}>
          gratis · tanpa login · 100% anonim
        </div>
      </div>
    </AbsoluteFill>
  );
};
