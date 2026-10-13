import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

/// Hors de `public/` : une photo ici n'est jamais atteignable par une URL statique, seulement via la
/// route authentifiée src/app/api/marketing-media/[id]/route.ts. Le nom de fichier est tiré au hasard,
/// jamais dérivé du nom fourni par la personne.
const STORAGE_DIR = path.join(process.cwd(), "uploads", "marketing-media");

export async function saveMarketingMedia(buffer: Buffer, extension: string): Promise<string> {
  await mkdir(STORAGE_DIR, { recursive: true });
  const fileName = `${crypto.randomUUID()}${extension}`;
  await writeFile(path.join(STORAGE_DIR, fileName), buffer);
  return fileName;
}

export async function readMarketingMedia(fileName: string): Promise<Buffer> {
  return readFile(path.join(STORAGE_DIR, path.basename(fileName)));
}

/// Supprime la photo du disque ; un fichier déjà absent n'est pas une erreur.
export async function deleteMarketingMedia(fileName: string): Promise<void> {
  await unlink(path.join(STORAGE_DIR, path.basename(fileName))).catch(() => undefined);
}
