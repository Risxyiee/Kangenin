import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT_STACK } from "../theme";
import { Caption, Chip, PhoneCard, TypingDots, popIn } from "../ui";

/**
 * S1 · Hook (90 frame) — bubble chat masuk: ada yang nitip sesuatu.
 * Beat: 0-40 titik mengetik → 42 bubble 1 pop → 58 chip link muncul.
 */
export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const b1 = popIn({ frame, fps, delay: 42 });
  const chip = popIn({ frame, fps, delay: 62, from: { y: 34, s: 0.85 } });
  const glow = 0.35 + 0.25 * Math.sin(frame * 0.15);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <Caption top={140}>
        Pssst… ada yang nitip{" "}
        <span style={{ color: C.rose }}>surat rahasia</span> 💌
      </Caption>

      <PhoneCard style={{ marginTop: 120 }}>
        {/* header chat */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: 24,
            borderBottom: `1.5px solid ${C.borderSoft}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 18,
                background: `linear-gradient(135deg, ${C.roseDeep}, ${C.purple})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
              }}
            >
              💬
            </div>
            <span style={{ fontFamily: FONT_STACK, fontWeight: 800, fontSize: 30, color: C.white }}>
              kangen.in
            </span>
          </div>
          <span style={{ fontFamily: FONT_STACK, fontSize: 24, color: C.zinc500 }}>21:47</span>
        </div>

        {/* zona bubble */}
        <div style={{ padding: "36px 6px 10px", minHeight: 300 }}>
          {/* bubble mengetik */}
          <div
            style={{
              opacity: frame < 42 ? 1 : 0,
              transform: `translateY(${interpolate(frame, [0, 12], [24, 0])}px)`,
              transition: "opacity 0.3s",
              display: "inline-flex",
              padding: "20px 26px",
              borderRadius: "28px 28px 28px 8px",
              background: C.glassStrong,
              border: `1.5px solid ${C.borderSoft}`,
            }}
          >
            <TypingDots />
          </div>

          {/* bubble 1 — pesan teka-teki */}
          {frame >= 42 && (
            <div
              style={{
                ...b1,
                display: "inline-flex",
                maxWidth: 640,
                padding: "22px 28px",
                borderRadius: "28px 28px 28px 8px",
                background: C.glassStrong,
                border: `1.5px solid ${C.borderSoft}`,
                fontFamily: FONT_STACK,
                fontSize: 34,
                lineHeight: 1.4,
                color: C.zinc200,
              }}
            >
              Eh… ada yang nitip sesuatu buat kamu 🤫 katanya buka sendiri ya…
            </div>
          )}

          {/* chip link */}
          {frame >= 62 && (
            <div style={{ ...chip, marginTop: 26 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "16px 30px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.10)",
                  border: `1.5px solid rgba(251,113,133,0.55)`,
                  boxShadow: `0 0 ${28 + glow * 26}px rgba(244,63,94,${0.35 + glow * 0.3})`,
                  fontFamily: FONT_STACK,
                  fontSize: 30,
                  fontWeight: 800,
                  color: C.white,
                }}
              >
                🔗 kangenin.web.id
              </div>
            </div>
          )}
        </div>

        {/* pengirim anonim */}
        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 16 }}>
          <Chip tone="purple">Dari: Seseorang 👻</Chip>
        </div>
      </PhoneCard>

      <div
        style={{
          marginTop: 54,
          fontFamily: FONT_STACK,
          fontSize: 32,
          color: C.zinc400,
          fontWeight: 600,
          opacity: interpolate(frame, [50, 70], [0, 1]),
        }}
      >
        penasaran? nanti lihat sendiri 👀
      </div>
    </AbsoluteFill>
  );
};
