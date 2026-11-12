import { getFile, putFile, removeFile } from "@/lib/file-store";

export const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
/// 4 Mo : au-delà, l'hébergeur (Vercel) refuse l'envoi du formulaire.
export const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

export function saveEmployeeDocument(establishmentId: string, buffer: Buffer, mimeType: string): Promise<string> {
  return putFile({ establishmentId, kind: "employee-document", buffer, extension: EXTENSION_BY_MIME_TYPE[mimeType] ?? "" });
}

export function readEmployeeDocument(establishmentId: string, fileName: string): Promise<Buffer | null> {
  return getFile(fileName, establishmentId);
}

export function deleteEmployeeDocument(establishmentId: string, fileName: string): Promise<void> {
  return removeFile(fileName, establishmentId);
}
