import { Composition } from "remotion";
import { KangeninVideo } from "./KangeninVideo";

/**
 * KangeninTikTok — 1080x1920 @ 30fps, 30 detik (900 frame).
 * Tour fitur ala showcase UI (referensi: akun Vigilante92).
 */
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="KangeninTikTok"
      component={KangeninVideo}
      durationInFrames={900}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
