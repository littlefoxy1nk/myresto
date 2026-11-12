import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

/// Les fichiers (photos de publications, documents d'employés) vivent dans la base de données : aucun disque à garder,
/// ils suivent les sauvegardes de la base et disparaissent avec l'établissement. Le nom est tiré au hasard, jamais dérivé
/// du nom donné par la personne. Chaque lecture ET chaque suppression vérifient l'établissement : même avec un nom de
/// fichier connu, on ne lit pas celui d'un autre restaurant.
export type FileKind = "employee-document" | "marketing-media";

export async function putFile(params: { establishmentId: string; kind: FileKind; buffer: Buffer; extension: string }): Promise<string> {
  const name = `${crypto.randomUUID()}${params.extension}`;
  await prisma.storedFile.create({
    data: { name, establishmentId: params.establishmentId, kind: params.kind, size: params.buffer.length, data: new Uint8Array(params.buffer) },
  });
  return name;
}

export async function getFile(name: string, establishmentId: string): Promise<Buffer | null> {
  const file = await prisma.storedFile.findFirst({ where: { name, establishmentId }, select: { data: true } });
  return file ? Buffer.from(file.data) : null;
}

/// Un fichier déjà absent n'est pas une erreur.
export async function removeFile(name: string, establishmentId: string): Promise<void> {
  await prisma.storedFile.deleteMany({ where: { name, establishmentId } });
}
