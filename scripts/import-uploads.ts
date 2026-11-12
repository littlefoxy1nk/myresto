/// Reprend dans la base les photos et documents qui étaient gardés sur le disque (dossier `uploads/`) avant que les fichiers
/// ne passent dans la base. À lancer une fois, en local : `npx tsx scripts/import-uploads.ts`. Sans effet si rien n'est à reprendre.
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  let imported = 0;
  let missing = 0;

  const posts = await prisma.marketingPost.findMany({ where: { mediaFileName: { not: null } }, select: { establishmentId: true, mediaFileName: true } });
  for (const post of posts) {
    const name = post.mediaFileName!;
    if (await prisma.storedFile.findUnique({ where: { name } })) continue;
    try {
      const data = await readFile(path.join(process.cwd(), "uploads", "marketing-media", path.basename(name)));
      await prisma.storedFile.create({ data: { name, establishmentId: post.establishmentId, kind: "marketing-media", size: data.length, data } });
      imported++;
    } catch {
      missing++;
    }
  }

  const docs = await prisma.employeeDocument.findMany({ select: { fileName: true, membership: { select: { establishmentId: true } } } });
  for (const doc of docs) {
    if (await prisma.storedFile.findUnique({ where: { name: doc.fileName } })) continue;
    try {
      const data = await readFile(path.join(process.cwd(), "uploads", "employee-documents", path.basename(doc.fileName)));
      await prisma.storedFile.create({ data: { name: doc.fileName, establishmentId: doc.membership.establishmentId, kind: "employee-document", size: data.length, data } });
      imported++;
    } catch {
      missing++;
    }
  }

  console.log(`Fichiers repris dans la base : ${imported} · introuvables sur le disque : ${missing}`);
}

main().finally(() => prisma.$disconnect());
