/// Logique pure de verrouillage après échecs de connexion répétés — isolée d'auth.ts
/// (qui fait l'accès base de données) pour rester testable sans dépendance à Prisma/NextAuth.
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

export function isLockedOut(lockedUntil: Date | null, now: Date): boolean {
  return lockedUntil !== null && lockedUntil.getTime() > now.getTime();
}

export function computeFailedAttempt(
  previousFailedAttempts: number,
  now: Date
): { failedLoginAttempts: number; lockedUntil: Date | null } {
  const failedLoginAttempts = previousFailedAttempts + 1;
  const lockedUntil = failedLoginAttempts >= MAX_FAILED_ATTEMPTS ? new Date(now.getTime() + LOCKOUT_MINUTES * 60_000) : null;
  return { failedLoginAttempts, lockedUntil };
}
