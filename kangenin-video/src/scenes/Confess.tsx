import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT_STACK } from "../theme";
import { Caption, Chip, PhoneCard, popIn } from "../ui";

const MESSAGE = "Aku udah lama mikirin kamu… tapi takut bilang langsung 🙈";

/**
 * S2 · Confess (105 frame) — form tulis surat anonim.
 * Beat: kartu pop → teks ngetik sendiri (f 24-78) → tombol ditekan (f 86)
 * → toast "Terkirim ✨" (f 90).
 */
export const Confess: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = popIn({ frame, fps, delay: 2 });

  const chars = Math.round(
    interpolate(frame, [24, 78], [0, MESSAGE.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const typed = MESSAGE.slice(0, chars);

  const press = spring({ frame: frame - 84, fps, config: { damping: 12, stiffness: 260 } });
  const btnScale = frame < 84 ? 1 : interpolate(press, [0, 0.5, 1], [1, 0.9, 1]);
  const toast = spring({ frame: frame - 90, fps, config: { damping: 16, stiffness: 150 } });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <Caption top={140}>
        Tulis tanpa nama — <span style={{ color: C.purpleLight }}>dia tetap bisa bales</span> ✨
      </Caption>

      <PhoneCard style={{ ...card, marginTop: 120 }}>
        <div style={{ fontFamily: FONT_STACK, fontWeight: 800, fontSize: 36, color: C.white, marginBottom: 26 }}>
          Surat Rahasia 💌
        </div>

        {/* tujuan & pengirim */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <span style={{ fontFamily: FONT_STACK, fontSize: 28, color: C.zinc400, width: 110 }}>Buat:</span>
          <Chip tone="rose">Sari 🌷</Chip>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 26 }}>
          <span style={{ fontFamily: FONT_STACK, fontSize: 28, color: C.zinc400, width: 110 }}>Dari:</span>
          <Chip tone="purple">S***A · rahasia 🙈</Chip>
        </div>

        {/* textarea */}
        <div
          style={{
            minHeight: 220,
            borderRadius: 26,
            background: "rgba(0,0,0,0.35)",
            border: `1.5px solid ${C.borderSoft}`,
            padding: "26px 30px",
            fontFamily: FONT_STACK,
            fontSize: 33,
            lineHeight: 1.5,
            color: C.zinc200,
            position: "relative",
          }}
        >
          {typed}
          <span
            style={{
              display: "inline-block",
              width: 4,
              height: 38,
              marginLeft: 4,
              verticalAlign: "-6px",
              background: C.rose,
              opacity: frame < 84 && Math.floor(frame / 8) % 2 === 0 ? 1 : 0.15,
            }}
          />
        </div>

        {/* tombol kirim */}
        <div
          style={{
            marginTop: 30,
            display: "flex",
            justifyContent: "center",
            transform: `scale(${btnScale})`,
          }}
        >
          <div
            style={{
              padding: "22px 64px",
              borderRadius: 999,
              background: `linear-gradient(90deg, ${C.roseDeep}, ${C.purple})`,
              fontFamily: FONT_STACK,
              fontSize: 34,
              fontWeight: 800,
              color: C.white,
              boxShadow: "0 16px 44px -12px rgba(244,63,94,0.65)",
            }}
          >
            Kirim 🚀
          </div>
        </div>

        {/* toast terkirim */}
        {frame >= 90 && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: 28,
              transform: `translateX(-50%) translateY(${interpolate(toast, [0, 1], [50, 0])}px)`,
              opacity: interpolate(toast, [0, 1], [0, 1]),
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              padding: "18px 34px",
              borderRadius: 999,
              background: "rgba(52,211,153,0.16)",
              border: "1.5px solid rgba(52,211,153,0.5)",
              fontFamily: FONT_STACK,
              fontSize: 30,
              fontWeight: 800,
              color: C.emerald,
              whiteSpace: "nowrap",
            }}
          >
            ✅ Terkirim — tanpa jejak namamu
          </div>
        )}
      </PhoneCard>

      <div
        style={{
          marginTop: 54,
          fontFamily: FONT_STACK,
          fontSize: 32,
          color: C.zinc400,
          fontWeight: 600,
          opacity: interpolate(frame, [60, 78], [0, 1]),
        }}
      >
        gratis, tanpa daftar akun 🆓
      </div>
    </AbsoluteFill>
  );
};
