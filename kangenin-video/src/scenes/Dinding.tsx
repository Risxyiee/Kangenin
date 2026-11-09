import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT_STACK } from "../theme";
import { Caption, Chip, PhoneCard, popIn } from "../ui";

const POSTS = [
  {
    initials: "R***A",
    time: "2 mnt lalu",
    text: "diam-diam aku simpen semua screenshot chat kamu… norak banget ya aku 😭",
    hearts: 128,
    delay: 10,
  },
  {
    initials: "F***O",
    time: "5 mnt lalu",
    text: "lagi suka sama orang yang belum tau kalau aku lagi suka sama dia 🙃",
    hearts: 94,
    delay: 26,
  },
  {
    initials: "S***I",
    time: "8 mnt lalu",
    text: "mungkin aku yang harus mulai duluan. hari ini. mungkin 😳",
    hearts: 211,
    delay: 42,
  },
];

/**
 * S3 · Dinding (90 frame) — Papan Pengakuan: kartu masuk bertahap.
 */
export const Dinding: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <Caption top={140}>
        Dindingnya <span style={{ color: C.rose }}>rame tiap hari</span> 👀
      </Caption>

      <PhoneCard style={{ marginTop: 110, padding: "30px 36px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ fontFamily: FONT_STACK, fontWeight: 800, fontSize: 34, color: C.white }}>
            Papan Pengakuan 💌
          </div>
          <Chip tone="rose">LIVE ●</Chip>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {POSTS.map((p) => {
            const anim = popIn({ frame, fps, delay: p.delay });
            const heartPop = popIn({ frame, fps, delay: p.delay + 20, from: { y: 0, s: 0.4 } });
            return (
              <div
                key={p.initials}
                style={{
                  ...anim,
                  borderRadius: 26,
                  background: C.glass,
                  border: `1.5px solid ${C.borderSoft}`,
                  padding: "22px 26px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: `linear-gradient(135deg, ${C.roseDeep}, ${C.purple})`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: FONT_STACK,
                      fontWeight: 800,
                      fontSize: 18,
                      color: C.white,
                    }}
                  >
                    {p.initials[0]}
                  </div>
                  <span style={{ fontFamily: FONT_STACK, fontWeight: 800, fontSize: 26, color: C.zinc200, letterSpacing: 1 }}>
                    {p.initials}
                  </span>
                  <span style={{ fontFamily: FONT_STACK, fontSize: 22, color: C.zinc500 }}>· {p.time}</span>
                </div>
                <div style={{ fontFamily: FONT_STACK, fontSize: 28, lineHeight: 1.45, color: C.zinc300 }}>
                  {p.text}
                </div>
                {frame >= p.delay + 20 && (
                  <div style={{ ...heartPop, display: "inline-block", marginTop: 10 }}>
                    <span
                      style={{
                        fontFamily: FONT_STACK,
                        fontSize: 24,
                        fontWeight: 800,
                        color: C.rose,
                        background: "rgba(244,63,94,0.12)",
                        border: "1.5px solid rgba(244,63,94,0.4)",
                        borderRadius: 999,
                        padding: "6px 18px",
                        display: "inline-block",
                      }}
                    >
                      💗 {p.hearts}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </PhoneCard>

      <div
        style={{
          marginTop: 50,
          fontFamily: FONT_STACK,
          fontSize: 32,
          color: C.zinc400,
          fontWeight: 600,
          opacity: frame > 55 ? 1 : 0,
        }}
      >
        namanya otomatis disamarkan 🔒
      </div>
    </AbsoluteFill>
  );
};
