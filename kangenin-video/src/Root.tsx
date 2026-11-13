import { Composition } from "remotion";
import { KangeninVideo } from "./KangeninVideo";
import { DemoVideo } from "./demo/DemoVideo";

/**
 * KangeninTikTok — 1080x1920 @ 30fps, 30 detik (900 frame).
 * Tour fitur ala showcase UI (referensi: akun Vigilante92).
 *
 * KangeninConfessDemo — 1080x1920 @ 30fps, 28 detik (840 frame).
 * UI-demo motion ala TikTok motion design (referensi: @ngorzc),
 * alur confess Kangenin: hook → jaminan anonim → 4 langkah → surat
 * → beat "takut ketahuan" → share link → POV buka surat → tagline.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="KangeninTikTok"
        component={KangeninVideo}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="KangeninConfessDemo"
        component={DemoVideo}
        durationInFrames={840}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
