/// Les règles d'un mot de passe : assez long, pas un des mots de passe les plus courants, pas l'adresse email ni le nom
/// de l'établissement. Volontairement simple et explicable — pas de « 1 majuscule + 1 symbole » qui pousse à choisir
/// « Motdepasse1! ». Une phrase longue est ce qu'il y a de mieux.
export const MIN_PASSWORD_LENGTH = 10;

const COMMON = new Set([
  "password", "password1", "password123", "motdepasse", "motdepasse1", "motdepasse123", "azertyuiop", "azerty123", "azerty1234",
  "qwertyuiop", "qwerty123", "1234567890", "123456789", "12345678", "0123456789", "1q2w3e4r5t", "iloveyou", "welcome123",
  "bienvenue", "restaurant", "restaurant1", "myresto123", "admin12345", "letmein123", "changeme", "abcdef1234", "000000000",
]);

export function validatePassword(password: string, context: { email?: string; name?: string } = {}): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `${MIN_PASSWORD_LENGTH} caractères minimum.`;
  if (password.length > 200) return "200 caractères maximum.";
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return "Ce mot de passe est trop courant : choisis-en un autre.";
  if (/^(.)\1+$/.test(password)) return "Évite de répéter le même caractère.";
  const local = context.email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) return "Ne reprends pas ton adresse email dans ton mot de passe.";
  const name = context.name?.toLowerCase().replace(/\s+/g, "");
  if (name && name.length >= 4 && lower.replace(/\s+/g, "").includes(name)) return "Ne reprends pas le nom de ton établissement dans ton mot de passe.";
  return null;
}
