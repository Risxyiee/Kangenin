// Bersihkan kado sisa audit pra-launch (targetName "Tes AuditNNNNNN").
// Jalankan: npx tsx scripts/cleanup_audit_kado.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const orphans = await db.kado.findMany({
    where: { targetName: { startsWith: "Tes Audit" } },
    select: { id: true, targetName: true, kadoType: true, createdAt: true },
  });
  console.log(`Ditemukan ${orphans.length} kado sisa audit:`);
  for (const k of orphans) console.log(`  - ${k.id} ${k.targetName} (${k.kadoType}) ${k.createdAt.toISOString()}`);
  if (orphans.length === 0) {
    console.log("Bersih — tidak ada yang perlu dihapus.");
    return;
  }
  const res = await db.kado.deleteMany({
    where: { id: { in: orphans.map((k) => k.id) } },
  });
  console.log(`Dihapus: ${res.count} kado.`);
}

main()
  .catch((e) => {
    console.error("GAGAL:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
