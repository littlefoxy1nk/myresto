export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type ImageType = { mime: "image/jpeg" | "image/png" | "image/webp"; extension: ".jpg" | ".png" | ".webp" };

/// Le vrai type d'une image, lu dans ses premiers octets — jamais celui que le navigateur déclare
/// (il peut être faux ou falsifié). Null si ce n'est ni du JPEG, ni du PNG, ni du WebP.
export function detectImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", extension: ".jpg" };
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) return { mime: "image/png", extension: ".png" };
  const ascii = (from: number, text: string) => text.split("").every((c, i) => bytes[from + i] === c.charCodeAt(0));
  if (bytes.length >= 12 && ascii(0, "RIFF") && ascii(8, "WEBP")) return { mime: "image/webp", extension: ".webp" };
  return null;
}
