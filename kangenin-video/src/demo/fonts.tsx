import { continueRender, delayRender, staticFile } from "remotion";
import { useEffect, useState } from "react";

/** Muat Jakarta (sans) + Caveat (tulisan tangan surat) sebelum render. */
export const DemoFonts: React.FC = () => {
  const [handle] = useState(() => delayRender("memuat font demo"));

  useEffect(() => {
    const load = async () => {
      const jakarta = new FontFace(
        "Jakarta",
        `url(${staticFile("fonts/plus-jakarta-sans-latin.woff2")})`,
        { weight: "200 800", style: "normal" }
      );
      const caveat = new FontFace(
        "Caveat",
        `url(${staticFile("fonts/Caveat-Variable.ttf")})`,
        { weight: "400 700", style: "normal" }
      );
      const results = await Promise.allSettled([jakarta.load(), caveat.load()]);
      const set = document.fonts as FontFaceSet & { add(f: FontFace): void };
      for (const r of results) {
        if (r.status === "fulfilled") set.add(r.value);
      }
      continueRender(handle);
    };
    void load();
  }, [handle]);

  return null;
};
