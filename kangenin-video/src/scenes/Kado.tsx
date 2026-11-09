import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT_STACK } from "../theme";
import { Caption, PhoneCard, popIn } from "../ui";

const GIFTS = [
  { emoji: "🌷", label: "Buket Bunga" },
  { emoji: "💌", label: "Open When" },
  { emoji: "📸", label: "Photobox" },
  { emoji: "🎵", label: "Playlist" },
  { emoji: "🕯️", label: "Lilin" },
  { emoji: "🎟️", label: "Love Coupon" },
];

/** Kartu kado tunggal (dipakai grid & versi hero playlist). */
const GiftTile: React.FC<{ emoji: string; label: string; style?: React.CSSProperties; big?: boolean }> = ({
  emoji,
  label,
  style,
  big,
}) => (
  <div
    style={{
      borderRadius: 28,
      background: C.glass,
      border: `1.5px solid ${C.borderSoft}`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      padding: big ? "34px 0" : "26px 0",
      ...style,
    }}
  >
    <span style={{ fontSize: big ? 84 : 58, lineHeight: 1 }}>{emoji}</span>
    <span
      style={{
        fontFamily: FONT_STACK,
        fontSize: big ? 34 : 24,
        fontWeight: 800,
        color: C.zinc200,
      }}
    >
      {label}
    </span>
  </div>
);

/** Piringan hitam muter — hero scene playlist. */
const Vinyl: React.FC<{ size: number }> = ({ size }) => {
  const frame = useCurrentFrame();
  const deg = frame * 5;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background:
            "repeating-radial-gradient(circle at 50% 50%, #1a1a20 0 3px, #101014 3px 6px)",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 30px 70px -20px rgba(0,0,0,0.9)",
          transform: `rotate(${deg}deg)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* label + lubang */}
        <div
          style={{
            width: size * 0.36,
            height: size * 0.36,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${C.roseDeep}, #9f1239)`,
            border: "2px solid rgba(253,230,138,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: C.bg,
              border: "1px solid rgba(255,255,255,0.35)",
            }}
          />
        </div>
      </div>
      {/* kilau conic */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `conic-gradient(from ${frame * 2}deg at 50% 50%, transparent 0deg, rgba(255,255,255,0.09) 22deg, transparent 48deg, transparent 180deg, rgba(255,255,255,0.05) 205deg, transparent 235deg)`,
        }}
      />
    </div>
  );
};

/**
 * S4 · Kado (210 frame) — grid 6 kado muncul stagger → zoom ke Playlist:
 * turntable muter + equalizer + progress bar.
 */
export const Kado: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // fase: 0-95 grid, 95+ transisi ke hero playlist
  const hero = spring({ frame: frame - 95, fps, config: { damping: 17, stiffness: 110 } });
  const gridOpacity = interpolate(frame, [95, 118], [1, 0]);
  const gridScale = interpolate(frame, [95, 130], [1, 1.28], { extrapolateRight: "clamp" });

  const eq = [0, 1, 2, 3, 4].map((i) =>
    18 + 26 * Math.abs(Math.sin(frame * 0.22 + i * 0.9))
  );
  const progress = interpolate(frame, [110, 205], [8, 92], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <Caption top={140}>
        Bisa ngirim <span style={{ color: C.amber }}>kado kejutan</span> juga 🎁
      </Caption>

      {/* FASE A — grid kado */}
      <PhoneCard style={{ marginTop: 110, opacity: gridOpacity, transform: `scale(${gridScale})` }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
          {GIFTS.map((g, i) => {
            const anim = popIn({ frame, fps, delay: 8 + i * 9 });
            const float = Math.sin((frame - 8 - i * 9) * 0.1) * 6;
            return (
              <GiftTile
                key={g.label}
                emoji={g.emoji}
                label={g.label}
                style={{ ...anim, transform: `${anim.transform} translateY(${float}px)`, height: 200 }}
              />
            );
          })}
        </div>
        <div
          style={{
            marginTop: 26,
            textAlign: "center",
            fontFamily: FONT_STACK,
            fontSize: 28,
            color: C.zinc400,
            fontWeight: 600,
          }}
        >
          6 jenis kado · semua interaktif ✨
        </div>
      </PhoneCard>

      {/* FASE B — hero playlist */}
      {frame >= 95 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: interpolate(hero, [0, 1], [0, 1]),
            transform: `scale(${interpolate(hero, [0, 1], [0.82, 1])})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <PhoneCard style={{ width: 800, padding: "44px 48px" }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Vinyl size={380} />
            </div>

            <div style={{ textAlign: "center", marginTop: 30 }}>
              <div style={{ fontFamily: FONT_STACK, fontWeight: 800, fontSize: 40, color: C.white }}>
                Playlist Rahasia 🎵
              </div>
              <div style={{ fontFamily: FONT_STACK, fontSize: 27, color: C.zinc400, marginTop: 8 }}>
                “lagu-lagu yang bikin aku mikirin kamu”
              </div>
            </div>

            {/* equalizer + progress */}
            <div style={{ display: "flex", justifyContent: "center", gap: 10, alignItems: "flex-end", height: 56, marginTop: 26 }}>
              {eq.map((h, i) => (
                <div
                  key={i}
                  style={{
                    width: 14,
                    height: h,
                    borderRadius: 8,
                    background: `linear-gradient(180deg, ${C.rose}, ${C.purple})`,
                  }}
                />
              ))}
            </div>
            <div
              style={{
                marginTop: 24,
                height: 16,
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: `linear-gradient(90deg, ${C.roseDeep}, ${C.purple})`,
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 12,
                fontFamily: FONT_STACK,
                fontSize: 24,
                color: C.zinc500,
                fontWeight: 700,
              }}
            >
              <span>Side A · 33⅓ RPM</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </PhoneCard>
        </div>
      )}
    </AbsoluteFill>
  );
};
