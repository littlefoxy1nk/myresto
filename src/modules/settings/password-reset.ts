import { createHash, randomBytes } from "node:crypto";

/// Le lien est un secret de 32 octets aléatoires ; la base ne garde que son empreinte SHA-256.
export function newResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashResetToken(token) };
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const RESET_TOKEN_TTL_MINUTES = 60;

export function isResetTokenUsable(row: { expiresAt: Date; usedAt: Date | null }, now: Date): boolean {
  return row.usedAt === null && row.expiresAt.getTime() > now.getTime();
}

export function buildResetEmail(params: { firstName: string; link: string }): { subject: string; text: string } {
  return {
    subject: "MYRESTO — réinitialiser ton mot de passe",
    text: [
      `Bonjour ${params.firstName},`,
      "",
      "Tu as demandé à réinitialiser ton mot de passe MYRESTO. Clique sur ce lien pour en choisir un nouveau :",
      params.link,
      "",
      `Le lien est valable ${RESET_TOKEN_TTL_MINUTES} minutes et ne peut servir qu'une fois.`,
      "Si tu n'es pas à l'origine de cette demande, ignore simplement ce message : ton mot de passe ne change pas.",
    ].join("\n"),
  };
}
