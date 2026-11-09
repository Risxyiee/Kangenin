import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT_STACK } from "../theme";
import { Caption, Chip, PhoneCard, TypingDots, popIn } from "../ui";

const BURST = [
  { ang: -70, dist: 210, emoji: "💗" },
  { ang: -30, dist: 250, emoji: "✨" },
  { ang: 10, dist: 220, emoji: "💗" },
  { ang: 50, dist: 260, emoji: "💖" },
  { ang: 90, dist: 210, emoji: "✨" },
  { ang: 130, dist: 250, emoji: "💗" },
  { ang: 170, dist: 220, emoji: "💖" },
  { ang: 210, dist: 260, emoji: "✨" },
];

/**
 * S5 · Jawaban (150 frame) — dia bisa bales!
 * Beat: bubble keluar (f 8) → mengetik (50-78) → jawaban (f 80)
 * → ledakan hati (f 96) → chip statistik (f 110).
 */
export const Jawaban: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const out1 = popIn({ frame, fps, delay: 8, from: { y: 40, s: 0.85 } });
  const typingIn = popIn({ frame, fps, delay: 50, from: { y: 30, s: 0.9 } });
  const typingOut = frame >= 78 ? { opacity: 0 } : { opacity: 1 };
  const reply = popIn({ frame, fps, delay: 80 });
  const burst = spring({ frame: frame - 96, fps, config: { damping: 14, stiffness: 90 } });
  const stats = popIn({ frame, fps, delay: 112 });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <Caption top={140}>
        Dan dia <span style={{ color: C.rose }}>BISA BALESS</span> 💗
      </Caption>

      <PhoneCard style={{ marginTop: 120, minHeight: 560, position: "relative" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22, padding: "6px 4px" }}>
          {/* bubble keluar (pengirim anonim) */}
          {frame >= 8 && (
            <div style={{ ...out1, display: "flex", justifyContent: "flex-end" }}>
              <div
                style={{
                  maxWidth: 560,
                  padding: "20px 28px",
                  borderRadius: "26px 26px 8px 26px",
                  background: `linear-gradient(135deg, ${C.roseDeep}, #be185d)`,
                  fontFamily: FONT_STACK,
                  fontSize: 31,
                  lineHeight: 1.45,
                  color: C.white,
                }}
              >
                Psst… aku nitipin sesuatu buat kamu 🎁 cek pelan-pelan ya
              </div>
            </div>
          )}

          {/* mengetik */}
          {frame >= 50 && frame < 80 && (
            <div style={{ ...typingIn, ...typingOut, display: "inline-flex" }}>
              <div
                style={{
                  padding: "20px 26px",
                  borderRadius: "26px 26px 26px 8px",
                  background: C.glassStrong,
                  border: `1.5px solid ${C.borderSoft}`,
                }}
              >
                <TypingDots />
              </div>
            </div>
          )}

          {/* jawaban */}
          {frame >= 80 && (
            <div style={{ ...reply, display: "flex", justifyContent: "flex-start" }}>
              <div
                style={{
                  maxWidth: 600,
                  padding: "22px 30px",
                  borderRadius: "26px 26px 26px 8px",
                  background: "rgba(255,255,255,0.14)",
                  border: "1.5px solid rgba(255,255,255,0.22)",
                  fontFamily: FONT_STACK,
                  fontSize: 34,
                  lineHeight: 1.45,
                  fontWeight: 700,
                  color: C.white,
                  boxShadow: "0 14px 50px -18px rgba(244,63,94,0.55)",
                }}
              >
                Ih iya… aku juga suka kamu 💗 baru tau ternyata kamu yang ngirim
              </div>
            </div>
          )}
        </div>

        {/* statistik */}
        {frame >= 112 && (
          <div style={{ ...stats, display: "flex", gap: 14, marginTop: 26, justifyContent: "center" }}>
            <Chip tone="glass">👁 dilihat 3×</Chip>
            <Chip tone="emerald">🔒 sekali buka</Chip>
          </div>
        )}

        {/* ledakan hati */}
        {frame >= 96 && (
          <div style={{ position: "absolute", left: "50%", top: "44%" }}>
            {BURST.map((b, i) => {
              const rad = (b.ang * Math.PI) / 180;
              const p = interpolate(burst, [0, 1], [0, 1]);
              const scale = interpolate(p, [0, 0.4, 1], [0.2, 1.15, 0.65]);
              return (
                <span
                  key={i}
                  style={{
                    position: "absolute",
                    fontSize: 52,
                    transform: `translate(${Math.cos(rad) * b.dist * p}px, ${Math.sin(rad) * b.dist * p}px) scale(${scale})`,
                    opacity: interpolate(p, [0, 0.3, 0.8, 1], [0, 1, 0.85, 0]),
                  }}
                >
                  {b.emoji}
                </span>
              );
            })}
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
          opacity: frame > 118 ? 1 : 0,
        }}
      >
        bukan cuma read-only — percakapan dua arah 💬
      </div>
    </AbsoluteFill>
  );
};
