import AdminBoard from "./AdminBoard";

// Panel admin founder — isinya client component karena butuh interaksi
// key gate + fetch + aksi moderasi. metadata noindex diset di layout.tsx.
export default function AdminPage() {
  return <AdminBoard />;
}
