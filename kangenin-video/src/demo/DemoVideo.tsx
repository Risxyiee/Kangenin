import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { DemoFonts } from "./fonts";
import { Hook, Promise, Steps, Letter, Anonim, Share, Buka, Closer } from "./scenes";

/**
 * Komposisi demo confess — 840 frame = 28 detik @30fps.
 * Konsep: UI-demo motion ala TikTok motion design (referensi @ngorzc),
 * diterjemahkan jadi alur produk Kangenin yang jujur:
 *   Hook 0-84 · Promise 84-150 · Langkah 150-270 · Surat 270-408
 *   Anonim 408-498 · Share 498-624 · Buka 624-744 · Closer 744-840
 */
export const DemoVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#f6efe7" }}>
      <DemoFonts />

      <Sequence from={0} durationInFrames={84}>
        <Hook />
      </Sequence>
      <Sequence from={84} durationInFrames={66}>
        <Promise />
      </Sequence>
      <Sequence from={150} durationInFrames={120}>
        <Steps />
      </Sequence>
      <Sequence from={270} durationInFrames={138}>
        <Letter />
      </Sequence>
      <Sequence from={408} durationInFrames={90}>
        <Anonim />
      </Sequence>
      <Sequence from={498} durationInFrames={126}>
        <Share />
      </Sequence>
      <Sequence from={624} durationInFrames={120}>
        <Buka />
      </Sequence>
      <Sequence from={744} durationInFrames={96}>
        <Closer />
      </Sequence>

      <Audio src={staticFile("audio/ambient.wav")} />
    </AbsoluteFill>
  );
};
