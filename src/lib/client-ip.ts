import { headers } from "next/headers";

/// L'adresse de la personne qui appelle. Derrière le serveur d'hébergement, l'en-tête x-forwarded-for se termine par
/// l'adresse vue par ce serveur : c'est la seule qu'on peut croire (le début de la liste, lui, peut être inventé par
/// l'appelant pour contourner les limites).
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return h.get("x-real-ip") ?? "unknown";
}
