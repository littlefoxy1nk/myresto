import { timingSafeEqual } from "node:crypto";

/// Qui peut créer un établissement ? En production, personne sans le code d'invitation que tu donnes toi-même
/// (variable SIGNUP_INVITE_CODE). Sans ce code configuré en production, la création est fermée : mieux vaut un
/// accès fermé par erreur qu'un accès ouvert à tout internet. En développement, c'est ouvert.
export type SignupPolicy = { open: boolean; requiresCode: boolean };

export function signupPolicy(env: { SIGNUP_INVITE_CODE?: string; NODE_ENV?: string } = process.env): SignupPolicy {
  if (env.SIGNUP_INVITE_CODE?.trim()) return { open: true, requiresCode: true };
  return { open: env.NODE_ENV !== "production", requiresCode: false };
}

export function inviteCodeMatches(given: string, expected: string | undefined): boolean {
  if (!expected?.trim()) return false;
  const a = Buffer.from(given.trim());
  const b = Buffer.from(expected.trim());
  return a.length === b.length && timingSafeEqual(a, b);
}
