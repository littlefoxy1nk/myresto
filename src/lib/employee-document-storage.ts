import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

/// Hors de `public/` : un fichier ici n'est jamais atteignable par une URL statique,
/// uniquement via la route authentifiée src/app/api/employee-documents/[id]/route.ts.
/// Nom de fichier tiré aléatoirement — jamais dérivé du nom fourni par l'utilisateur,
/// pour ne jamais construire un chemin à partir d'une entrée externe.
const STORAGE_DIR = path.join(process.cwd(), "uploads", "employee-documents");

export const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

export async function saveEmployeeDocument(buffer: Buffer, mimeType: string): Promise<string> {
  await mkdir(STORAGE_DIR, { recursive: true });
  const extension = EXTENSION_BY_MIME_TYPE[mimeType] ?? "";
  const fileName = `${crypto.randomUUID()}${extension}`;
  await writeFile(path.join(STORAGE_DIR, fileName), buffer);
  return fileName;
}

export async function readEmployeeDocument(fileName: string): Promise<Buffer> {
  return readFile(path.join(STORAGE_DIR, fileName));
}
