import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kebijakan Privasi — Kangenin",
  description:
    "Data apa yang disimpan Kangenin, berapa lama, dan bagaimana privasi pengirim & penerima dijaga.",
};

const SECTIONS: Array<{ title: string; body: string[] }> = [
  {
    title: "Data yang kamu kirim",
    body: [
      "Saat membuat confess/surat/kado, kami menyimpan: nama pengirim (opsional — boleh kosong), nama penerima, isi pesan, tema yang dipilih, dan waktu pembuatan. Tidak ada pendaftaran akun, tidak ada email atau nomor telepon yang diminta.",
    ],
  },
  {
    title: "Link yang acak dan tidak terindeks",
    body: [
      "Setiap konten hanya bisa diakses lewat link dengan kode acak yang tidak ditebak. Semua halaman konten diberi tanda noindex — mesin pencari tidak menampilkannya di hasil pencarian.",
      "Halaman pantauan pengirim (?s=senderKey) masih lebih rahasia lagi: hanya kamu yang punya kodenya, dan isinya tidak dibocorkan ke penerima.",
    ],
  },
  {
    title: "Data teknis",
    body: [
      "Seperti layanan web pada umumnya, alamat IP dipakai sementara untuk pembatasan laju (maksimal 5 confess per 15 menit per IP) guna mencegah spam. Tidak ada profil iklan, tidak ada pelacakan lintas situs yang kami pasang.",
      "Draft tulisanmu dan daftar link yang pernah kamu buat tersimpan di perangkatmu sendiri (localStorage browser), bukan di server — itu artinya hanya bisa dibaca dari browser yang sama.",
    ],
  },
  {
    title: "Yang tidak kami lakukan",
    body: [
      "Kami tidak menjual data, tidak membagikan isi surat ke pihak ketiga, dan tidak membaca pesan kecuali terkait laporan pelanggaran yang masuk antrean tinjauan.",
    ],
  },
  {
    title: "Dinding & Papan Pengakuan — selalu opt-in",
    body: [
      "Kami punya dua pajangan publik: Dinding (cuma nama, tema, dan reaksi — isi surat TIDAK ikut) dan Papan Pengakuan di halaman depan (isi surat ikut tampil). Keduanya hanya berisi surat yang pengirimnya sendiri memilih opsi tayang; default-nya privat.",
      "Di Papan, kamu pilih tampil sebagai anonim atau nama depan saja. Nama penerima juga cuma ditulis nama depannya, dan nomor telepon/email/link di isi surat otomatis ditutup. Mau menarik suratmu dari pajangan? Buka link pantauanmu (?s=...) dan ganti jadi privat — langsung hilang dari publik.",
    ],
  },
  {
    title: "Konten dilaporkan",
    body: [
      "Jika sebuah konten dilaporkan 3 kali, konten otomatis disembunyikan sementara dan ditinjau. Kami berhak menghapus konten yang melanggar (pelecehan, ancaman, SARA, atau hal ilegal lainnya).",
    ],
  },
  {
    title: "Penghapusan data",
    body: [
      "Fitur hapus mandiri sedang disiapkan. Sementara ini: simpan senderKey pantauanmu — itu kunci identitas kontenmu di layanan ini. Draft dan daftar link di perangkatmu bisa kamu hapus kapan saja lewat pengaturan situs di browser (hapus data situs).",
    ],
  },
];

export default function PrivasiPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-16 sm:px-6">
      <Link
        href="/"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← kembali ke beranda
      </Link>
      <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-foreground">
        Kebijakan Privasi
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Singkat, jujur, dan tanpa bahasa hukum yang berbelit.
      </p>

      <div className="mt-10 space-y-8">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="font-display text-xl font-bold text-foreground">
              {s.title}
            </h2>
            {s.body.map((p, i) => (
              <p key={i} className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>

      <p className="mt-12 text-xs text-muted-foreground">
        Terakhir diperbarui: Oktober 2026 ·{" "}
        <Link href="/bantuan" className="text-primary underline underline-offset-2">
          butuh bantuan?
        </Link>
      </p>
    </main>
  );
}
