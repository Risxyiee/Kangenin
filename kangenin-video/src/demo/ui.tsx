import {
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CSSProperties, ReactNode } from "react";
import { E, FONT_HAND, FONT_STACK } from "./theme";

/** Kartu kertas dasar — flat, border tipis, sudut besar, tanpa gradien. */
export const PaperCard: React.FC<{
  children?: ReactNode;
  style?: CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      background: E.card,
      border: `2px solid ${E.border}`,
      borderRadius: 32,
      boxShadow: "0 24px 60px -34px rgba(33,29,23,0.35)",
      fontFamily: FONT_STACK,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Judul scene besar di zona aman atas. */
export const Head: React.FC<{
  children: ReactNode;
  delay?: number;
  color?: string;
  size?: number;
  top?: number;
}> = ({ children, delay = 6, color = E.ink, size = 76, top = 210 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame: frame - delay,
    fps,
    config: { damping: 18, stiffness: 130 },
  });
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 70,
        right: 70,
        textAlign: "center",
        fontFamily: FONT_STACK,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1.18,
        letterSpacing: "-1px",
        color,
        opacity: interpolate(enter, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(enter, [0, 1], [44, 0])}px)`,
      }}
    >
      {children}
    </div>
  );
};

/** Kicker kecil uppercase crimson. */
export const Kicker: React.FC<{ children: ReactNode; delay?: number; top?: number; color?: string }> = ({
  children,
  delay = 2,
  top = 140,
  color = E.crimson,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 16 } });
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: FONT_STACK,
        fontWeight: 700,
        fontSize: 34,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color,
        opacity: interpolate(enter, [0, 1], [0, 1]),
      }}
    >
      {children}
    </div>
  );
};

/** Pill/tombol flat. */
export const Pill: React.FC<{
  children: ReactNode;
  tone?: "crimson" | "cream" | "dark";
  style?: CSSProperties;
}> = ({ children, tone = "crimson", style }) => {
  const tones: Record<string, CSSProperties> = {
    crimson: { background: E.crimson, color: "#fffdf9" },
    cream: { background: E.card, color: E.ink, border: `2px solid ${E.border}` },
    dark: { background: E.dark, color: E.creamText },
  };
  return (
    <div
      style={{
        display: "inline-block",
        borderRadius: 999,
        padding: "20px 44px",
        fontWeight: 800,
        fontSize: 40,
        letterSpacing: "-0.2px",
        boxShadow: "0 16px 36px -22px rgba(33,29,23,0.5)",
        ...tones[tone],
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Chip kecil (badge). */
export const Tag: React.FC<{ children: ReactNode; tone?: "crimson" | "cream" }> = ({
  children,
  tone = "cream",
}) => (
  <div
    style={{
      display: "inline-block",
      borderRadius: 999,
      padding: "10px 26px",
      fontWeight: 700,
      fontSize: 28,
      ...(tone === "crimson"
        ? { background: "rgba(157,28,52,0.1)", color: E.crimson, border: `1.5px solid rgba(157,28,52,0.35)` }
        : { background: E.paperDeep, color: E.inkSoft, border: `1.5px solid ${E.border}` }),
    }}
  >
    {children}
  </div>
);

/** Kursor klik — titik hitam kecil yang "menekan" tombol. */
export const Cursor: React.FC<{ x: number; y: number; press?: boolean; show?: boolean }> = ({
  x,
  y,
  press = false,
  show = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!show) return null;
  const pop = spring({ frame: frame - 2, fps, config: { damping: 14 } });
  const scale = press ? 0.82 : 1;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `scale(${interpolate(pop, [0, 1], [0.4, 1]) * scale})`,
        width: 34,
        height: 34,
      }}
    >
      <svg viewBox="0 0 24 24" width={54} height={54}>
        <path
          d="M5 3l14 10-6.2 0.7L15.6 21l-3.4 1.2-2.7-7.2L5 18.5V3z"
          fill="#211d1a"
          stroke="#fffdf9"
          strokeWidth={1.6}
        />
      </svg>
    </div>
  );
};

/** Efek ketik: substring teks mulai dari frame tertentu. */
export const typed = (text: string, frame: number, start: number, perFrame = 0.8) => {
  const n = Math.max(0, Math.floor((frame - start) * perFrame));
  return text.slice(0, Math.min(text.length, n));
};

/** Centang yang "digambar" (stroke animasi). */
export const CheckDraw: React.FC<{ delay: number; size?: number; color?: string }> = ({
  delay,
  size = 44,
  color = E.crimson,
}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame - delay, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <svg width={size} height={size} viewBox="0 0 44 44">
      <circle cx={22} cy={22} r={20} fill="none" stroke={color} strokeWidth={2.5} opacity={t} />
      <path
        d="M13 23 L19.5 29.5 L31 15.5"
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={34}
        strokeDashoffset={34 - 34 * t}
      />
    </svg>
  );
};

/** Teks tangan (Caveat) — dipakai di surat. */
export const HandText: React.FC<{ children: ReactNode; style?: CSSProperties }> = ({
  children,
  style,
}) => (
  <span style={{ fontFamily: FONT_HAND, fontWeight: 600, ...style }}>{children}</span>
);

/** Segel lilin dari aset logo. Img + staticFile → Remotion menunggu load. */
export const Seal: React.FC<{ size: number; style?: CSSProperties }> = ({ size, style }) => (
  <Img
    src={staticFile("logo-seal.svg")}
    width={size}
    height={size}
    style={{ display: "block", ...style }}
  />
);
