import InsightBoard from "./InsightBoard";

// Dashboard masukan untuk founder — isinya client component karena butuh
// interaksi key gate + fetch. metadata noindex diset di layout.tsx.
export default function InsightPage() {
  return <InsightBoard />;
}
