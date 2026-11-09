import { continueRender, delayRender, staticFile } from "remotion";
import { useEffect, useState } from "react";

/**
 * Muat font Plus Jakarta Sans (variable 200-800) dari public/fonts —
 * branding identik Kangenin. Font emoji (Noto Color Emoji) sudah ada di
 * fontconfig sistem, jadi cukup cantumkan sebagai fallback di CSS stack.
 */
export const Fonts: React.FC = () => {
  const [handle] = useState(() =>
    delayRender("memuat font Jakarta")
  );

  useEffect(() => {
    const font = new FontFace(
      "Jakarta",
      `url(${staticFile("fonts/plus-jakarta-sans-latin.woff2")})`,
      { weight: "200 800", style: "normal" }
    );
    font
      .load()
      .then((loaded) => {
        (document.fonts as FontFaceSet & { add(f: FontFace): void }).add(loaded);
        continueRender(handle);
      })
      .catch((err) => {
        // font gagal → lanjut dengan font sistem, jangan bikin render gantung
        continueRender(handle);
      });
  }, [handle]);

  return null;
};
