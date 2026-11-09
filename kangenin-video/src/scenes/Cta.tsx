import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT_STACK } from "../theme";
import { popIn } from "../ui";

const FLOATERS = [
  { emoji: "🎵", label: "Playlist", x: 110, y: 380, d: 18 },
  { emoji: "💌", label: "Open When", x: 780, y: 470, d: 34 },
  { emoji: "📸", label: "Photobox", x: 130, y: 1250, d: 50 },
  { emoji: "🌷", label: "Buket", x: 760, y: 1330, d: 66 },
  { emoji: "🕯️", label: "Lilin", x: 90, y: 820, d: 80 },
  { emoji: "🎟️", label: "Coupon", x: 800, y: 950, d: 94 },
];

/**
 * S6 · CTA (255 frame) — logo kangen.in besar, tagline, tombol situs.
 * Kartu mini melayang di sekeliling; glow tombol berdenyut.
 */
export const Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logo = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const word = popIn({ frame, fps, delay: 14 });
  const tagline = popIn({ frame, fps, delay: 30 });
  const button = popIn({ frame, fps, delay: 46, from: { y: 50, s: 0.85 } });
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.12);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      {/* kartu mini melayang (parallax lembut) */}
      {FLOATERS.map((f) => {
        const anim = popIn({ frame, fps, delay: f.d, from: { y: 80, s: 0.7 } });
        const drift = Math.sin(frame * 0.05 + f.x) * 14;
        return (
          <div
            key={f.label}
            style={{
              position: "absolute",
              left: f.x,
              top: f.y,
              ...anim,
              transform: `${anim.transform} translateY(${drift}px)`,
              opacity: anim.opacity * 0.75,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 26px",
              borderRadius: 999,
              background: C.glass,
              border: `1.5px solid ${C.borderSoft}`,
              fontFamily: FONT_STACK,
              fontSize: 26,
              fontWeight: 800,
              color: C.zinc300,
            }}
          >
            <span style={{ fontSize: 32 }}>{f.emoji}</span> {f.label}
          </div>
        );
      })}

      {/* logo */}
      <div
        style={{
          width: 190,
          height: 190,
          borderRadius: 56,
          background: `linear-gradient(135deg, ${C.roseDeep}, ${C.purple})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 96,
          boxShadow: `0 30px 80px -20px rgba(244,63,94,${0.5 + pulse * 0.25})`,
          opacity: interpolate(logo, [0, 1], [0, 1]),
          transform: `scale(${interpolate(logo, [0, 1], [0.4, 1])}) rotate(${interpolate(logo, [0, 1], [-14, 0])}deg)`,
        }}
      >
        💜
      </div>

      {/* wordmark */}
      <div
        style={{
          ...word,
          marginTop: 40,
          fontFamily: FONT_STACK,
          fontWeight: 800,
          fontSize: 110,
          letterSpacing: -3,
          color: C.white,
        }}
      >
        kangen<span style={{ color: C.rose }}>.in</span>
      </div>

      {/* tagline */}
      <div
        style={{
          ...tagline,
          marginTop: 18,
          fontFamily: FONT_STACK,
          fontSize: 40,
          fontWeight: 600,
          color: C.zinc300,
          textAlign: "center",
          lineHeight: 1.4,
          padding: "0 90px",
        }}
      >
        Tulis surat rahasiamu sekarang 💌
        <br />
        <span style={{ color: C.zinc500, fontSize: 32 }}>
          anonim · bisa dibales · kadonya bikin baper
        </span>
      </div>

      {/* tombol situs */}
      {frame >= 46 && (
        <div style={{ ...button, marginTop: 56 }}>
          <div
            style={{
              padding: "26px 70px",
              borderRadius: 999,
              background: `linear-gradient(90deg, ${C.roseDeep}, ${C.purple})`,
              boxShadow: `0 0 ${40 + pulse * 40}px rgba(244,63,94,${0.45 + pulse * 0.3})`,
              fontFamily: FONT_STACK,
              fontSize: 42,
              fontWeight: 800,
              color: C.white,
              whiteSpace: "nowrap",
            }}
          >
            ✨ kangenin.web.id — gratis
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
