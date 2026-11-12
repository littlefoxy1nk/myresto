import { getFile, putFile, removeFile } from "@/lib/file-store";

export function saveMarketingMedia(establishmentId: string, buffer: Buffer, extension: string): Promise<string> {
  return putFile({ establishmentId, kind: "marketing-media", buffer, extension });
}

export function readMarketingMedia(establishmentId: string, fileName: string): Promise<Buffer | null> {
  return getFile(fileName, establishmentId);
}

export function deleteMarketingMedia(establishmentId: string, fileName: string): Promise<void> {
  return removeFile(fileName, establishmentId);
}
