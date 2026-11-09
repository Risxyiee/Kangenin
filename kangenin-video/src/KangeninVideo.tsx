import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Fonts } from "./fonts";
import { C } from "./theme";
import { Hook } from "./scenes/Hook";
import { Confess } from "./scenes/Confess";
import { Dinding } from "./scenes/Dinding";
import { Kado } from "./scenes/Kado";
import { Jawaban } from "./scenes/Jawaban";
import { Cta } from "./scenes/Cta";

/** Latar: hitam hangat + dua glow rose/purple yang mengapung pelan. */
const Background: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <div
        style={{
          position: "absolute",
          width: 1100,
          height: 1100,
          left: -260 + Math.sin(f * 0.008) * 70,
          top: -320 + Math.cos(f * 0.01) * 50,
          background:
            "radial-gradient(circle, rgba(244,63,94,0.16), transparent 62%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1200,
          height: 1200,
          right: -320 + Math.cos(f * 0.007) * 60,
          bottom: -360 + Math.sin(f * 0.009) * 60,
          background:
            "radial-gradient(circle, rgba(168,85,247,0.15), transparent 62%)",
        }}
      />
    </AbsoluteFill>
  );
};

/** Watermark kecil — selalu tampil di zona aman bawah. */
const Watermark: React.FC = () => (
  <div
    style={{
      position: "absolute",
      bottom: 120,
      left: 0,
      right: 0,
      textAlign: "center",
      fontFamily: '"Jakarta", "Noto Sans SC", "Noto Color Emoji", sans-serif',
      fontSize: 30,
      fontWeight: 700,
      color: "rgba(255,255,255,0.42)",
      letterSpacing: 1,
    }}
  >
    kangen.in 💜
  </div>
);

/**
 * Komposisi utama — 900 frame = 30 detik:
 *   Hook 0-90 · Confess 90-195 · Dinding 195-285 · Kado 285-495
 *   Jawaban 495-645 · CTA 645-900
 */
export const KangeninVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Fonts />
      <Background />

      <Sequence from={0} durationInFrames={90}>
        <Hook />
      </Sequence>
      <Sequence from={90} durationInFrames={105}>
        <Confess />
      </Sequence>
      <Sequence from={195} durationInFrames={90}>
        <Dinding />
      </Sequence>
      <Sequence from={285} durationInFrames={210}>
        <Kado />
      </Sequence>
      <Sequence from={495} durationInFrames={150}>
        <Jawaban />
      </Sequence>
      <Sequence from={645} durationInFrames={255}>
        <Cta />
      </Sequence>

      <Watermark />
      <Audio src={staticFile("audio/ambient.wav")} />
    </AbsoluteFill>
  );
};
