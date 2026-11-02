import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Bantuan — Kangenin",
  description:
    "Cara pakai Kangenin: confess anonim, Open When Letters, kado digital. Pertanyaan yang paling sering ditanyakan, dijawab to the point.",
};

const QA = [
  {
    q: "Gimana cara confess-nya?",
    a: "Isi form di halaman utama: nama kamu (boleh kosong = anonim), nama dia, dan pesanmu. Klik 'Buat link confess' — kamu dapat satu link untuk dikirim ke dia (lewat WA paling gampang), plus link pantauan khusus buat kamu.",
  },
  {
    q: "Dia gimana cara bukanya?",
    a: "Dia buka link di browser apa pun (tanpa install apa pun), lalu ketuk & tahan amplopnya sampai segel lilinnya terbuka. Pesanmu muncul seperti diketik langsung, disertai hati yang berjatuhan. Di akhir dia bisa menjawab.",
  },
  {
    q: "Aku mau tahu dia udah baca atau belum — bisa?",
    a: "Bisa. Setiap confess dapat link pantauan (?s=...) yang cuma kamu punya. Di situ kelihatan sudah dibuka belum dan apa jawabannya, update otomatis. Dia tidak akan tahu halaman itu ada.",
  },
  {
    q: "Link yang tadi kubuat hilang / lupa disimpan?",
    a: "Tenang — daftar confess kamu juga tersimpan otomatis di perangkatmu (localStorage browser). Buka lagi situsnya dari browser yang sama dan cek bagian form; draft & daftar confess kamu tetap ada. Kalau browsernya beda, sayangnya link tidak bisa dipulihkan — jadi kebiasaan baik: langsung simpan linknya di catatan.",
  },
  {
    q: "Isi draft-ku hilang kalau keluar halaman?",
    a: "Tidak. Draft (nama, pesan, tema) tersimpan otomatis di perangkatmu saat menulis — tutup tab pun tetap ada. Draft baru terhapus setelah link confess berhasil dibuat atau kamu menghapusnya sendiri.",
  },
  {
    q: "Open When itu apa?",
    a: "Suratmu dibungkus amplop vintage bersegel lilin. Kamu tulis judulnya (mis. 'Buka saat kamu kangen aku') — dia harus mengetik jawaban prompt dulu, lalu segelnya meleleh dan surat keluar. Cocok buat momen tertentu atau pasangan LDR.",
  },
  {
    q: "Kado digitalnya apa saja?",
    a: "Buket bunga yang mekar saat pitanya ditarik, Open When bersegel lilin, photobox polaroid, kue tiup lilin, love coupons yang bisa dicoret saat dipakai, timeline kisah kalian, dan Kado Confess. Semua dikirim sebagai satu link.",
  },
  {
    q: "Bayarnya gimana?",
    a: "Confess gratis, tanpa biaya tersembunyi. Saat masa uji coba, semua kado juga gratis — kalau nanti sudah berbayar, modelnya sekali bayar (bukan langganan) dan harganya diumumkan dulu di halaman harga.",
  },
  {
    q: "Ada konten yang tidak pantas di link yang kuterima?",
    a: "Setiap halaman confess/kado punya tombol lapor. Cukup 3 laporan, kontennya otomatis disembunyikan dan masuk antrean tinjauan.",
  },
  {
    q: "Bisa hapus confess yang sudah kubuat?",
    a: "Fitur hapus mandiri sedang disiapkan — sementara ini simpan senderKey pantauanmu baik-baik. Data yang kamu kirim tidak dibagikan ke siapa pun (lihat halaman Privasi).",
  },
];

export default function BantuanPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-16 sm:px-6">
      <Link
        href="/"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← kembali ke beranda
      </Link>
      <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-foreground">
        Bantuan
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Semua yang sering ditanyakan soal Kangenin — dijawab to the point.
      </p>

      <div className="mt-10 space-y-3">
        {QA.map((item) => (
          <details
            key={item.q}
            className="group rounded-lg border border-border bg-card p-5 open:bg-card/70"
          >
            <summary className="cursor-pointer list-none font-semibold text-foreground">
              <span className="mr-2 inline-block text-primary transition-transform group-open:rotate-90">
                ›
              </span>
              {item.q}
            </summary>
            <p className="mt-3 pl-5 text-sm leading-relaxed text-muted-foreground">
              {item.a}
            </p>
          </details>
        ))}
      </div>

      <p className="mt-12 text-sm text-muted-foreground">
        Belum terjawab? Coba buka{" "}
        <Link href="/tentang" className="text-primary underline underline-offset-2">
          halaman Tentang
        </Link>{" "}
        — atau{" "}
        <Link href="/masukan" className="text-primary underline underline-offset-2">
          kirim kritik &amp; saranmu
        </Link>
        , dibaca langsung sama yang bikin.
      </p>
    </main>
  );
}
