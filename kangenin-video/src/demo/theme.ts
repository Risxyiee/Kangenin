/** Token desain editorial — identik dengan situs Kangenin sekarang
 *  (kertas krem + crimson, tanpa gradien/glow, ala surat & segel lilin). */
export const E = {
  paper: "#f6efe7", // latar krem hangat
  paperDeep: "#ede1d3", // krem lebih tua (field, strip)
  card: "#fffdf9", // kertas surat putih hangat
  ink: "#211d1a", // teks gelap hangat
  inkSoft: "rgba(33,29,23,0.62)",
  crimson: "#9d1c34", // primary
  seal: "#8e2137", // segel lilin
  sealDeep: "#6f1424",
  blush: "#e8b4bb",
  blushSoft: "#d9a0a6",
  border: "#e2d0c2",
  dark: "#1d1917", // latar gelap (beat "takut ketahuan")
  creamText: "#f0e4dc", // teks krem di atas gelap
} as const;

export const FONT_STACK =
  '"Jakarta", "Noto Sans SC", "Noto Color Emoji", sans-serif';
export const FONT_HAND = '"Caveat", "Jakarta", cursive';
