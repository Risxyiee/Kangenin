import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT_STACK } from "./theme";

/** Kartu glassmorphism dasar. */
export const GlassCard: React.FC<{
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ style, children }) => (
  <div
    style={{
      background: C.glass,
      border: `1.5px solid ${C.border}`,
      borderRadius: 36,
      backdropFilter: "blur(6px)",
      fontFamily: FONT_STACK,
      ...style,
    }}
  >
    {children}
  </div>
);

/**
 * Bingkai "perangkat" di tengah — bingkai mini berisi UI tiruan.
 * Lebar 760 agar teks besar tetap terbaca di 1080p vertikal.
 */
export const PhoneCard: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      width: 780,
      borderRadius: 48,
      background:
        "linear-gradient(160deg, rgba(255,255,255,0.085), rgba(255,255,255,0.035))",
      border: `2px solid ${C.border}`,
      boxShadow:
        "0 40px 90px -30px rgba(244,63,94,0.35), 0 20px 60px -20px rgba(0,0,0,0.8)",
      padding: "34px 40px",
      fontFamily: FONT_STACK,
      ...style,
    }}
  >
    {children}
  </div>
);

/**
 * Teks overlay besar di area atas (aman dari UI TikTok).
 * Masuk: naik + fade via spring. `hold` frame terakhir sebelum keluar halus.
 */
export const Caption: React.FC<{
  children: React.ReactNode;
  delay?: number;
  size?: number;
  color?: string;
  top?: number;
}> = ({ children, delay = 6, size = 64, color = C.white, top = 150 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 130 } });
  const y = interpolate(enter, [0, 1], [46, 0]);
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 60,
        right: 60,
        textAlign: "center",
        fontFamily: FONT_STACK,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1.22,
        color,
        textShadow: "0 4px 30px rgba(0,0,0,0.65)",
        transform: `translateY(${y}px)`,
        opacity,
        letterSpacing: "-0.5px",
      }}
    >
      {children}
    </div>
  );
};

/** Chip/pill kecil glass. */
export const Chip: React.FC<{
  children: React.ReactNode;
  tone?: "glass" | "rose" | "emerald" | "purple";
  style?: React.CSSProperties;
}> = ({ children, tone = "glass", style }) => {
  const tones: Record<string, React.CSSProperties> = {
    glass: { background: C.glassStrong, border: `1.5px solid ${C.border}`, color: C.zinc200 },
    rose: { background: "rgba(244,63,94,0.16)", border: "1.5px solid rgba(251,113,133,0.45)", color: C.rose },
    emerald: { background: "rgba(52,211,153,0.14)", border: "1.5px solid rgba(52,211,153,0.4)", color: C.emerald },
    purple: { background: "rgba(168,85,247,0.16)", border: "1.5px solid rgba(168,85,247,0.45)", color: C.purpleLight },
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        borderRadius: 999,
        padding: "10px 22px",
        fontSize: 28,
        fontWeight: 700,
        fontFamily: FONT_STACK,
        ...tones[tone],
        ...style,
      }}
    >
      {children}
    </span>
  );
};

/** Titik "sedang mengetik" ala chat. */
export const TypingDots: React.FC<{ size?: number; color?: string }> = ({
  size = 14,
  color = C.zinc400,
}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: color,
            transform: `translateY(${Math.sin(frame * 0.28 + i * 1.1) * 6}px)`,
            opacity: 0.55 + 0.45 * Math.sin(frame * 0.28 + i * 1.1),
          }}
        />
      ))}
    </div>
  );
};

/** Entri kartu: spring masuk (scale + y + fade). */
export const popIn = ({
  frame,
  fps,
  delay,
  from = { y: 60, s: 0.9 },
}: {
  frame: number;
  fps: number;
  delay: number;
  from?: { y: number; s: number };
}) => {
  const p = spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 140 } });
  return {
    opacity: interpolate(p, [0, 1], [0, 1]),
    transform: `translateY(${interpolate(p, [0, 1], [from.y, 0])}px) scale(${interpolate(p, [0, 1], [from.s, 1])})`,
  };
};
