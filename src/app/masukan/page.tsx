import type { Metadata } from "next";
import FeedbackForm from "./FeedbackForm";

export const metadata: Metadata = {
  title: "Kritik & Saran — Kangenin",
  description:
    "Bebas bilang apa aja soal Kangenin: fitur yang kurang, yang bikin bingung, sampai ide gila. Masukanmu nyampe langsung ke yang bikin.",
};

export default function MasukanPage() {
  return <FeedbackForm />;
}
