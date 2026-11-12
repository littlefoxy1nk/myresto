/// L'équipe MYRESTO (les personnes qui créent et accompagnent les établissements) : leurs adresses email sont listées dans
/// le réglage PLATFORM_ADMIN_EMAILS (séparées par des virgules), que seule la personne qui gère l'hébergement peut changer.
/// Personne ne peut se donner ces droits depuis l'appli.
type Env = Record<string, string | undefined>;

export function platformAdminEmails(env: Env = process.env): Set<string> {
  return new Set(
    (env.PLATFORM_ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isPlatformAdminEmail(email: string | null | undefined, env: Env = process.env): boolean {
  return !!email && platformAdminEmails(env).has(email.trim().toLowerCase());
}

/// Qui peut créer un compte avec une adresse de l'équipe MYRESTO ? Seulement avec le code d'invitation « équipe »
/// (ADMIN_INVITE_CODE), pas avec celui qu'on donne aux restaurateurs : sans cela, quelqu'un qui aurait le code des
/// restaurateurs pourrait s'inscrire avec l'adresse d'une administratrice avant elle. Retourne un message d'erreur, ou null.
export function checkAdminSignup(params: {
  email: string;
  code: string;
  adminCodeMatches: (code: string) => boolean;
  env?: Env;
}): string | null {
  const env = params.env ?? process.env;
  if (!isPlatformAdminEmail(params.email, env)) return null;
  const configured = !!env.ADMIN_INVITE_CODE?.trim();
  if (!configured) {
    // En développement, sans code configuré, on laisse faire pour pouvoir essayer ; en production, c'est fermé.
    return env.NODE_ENV === "production" ? "Cette adresse est réservée à l'équipe MYRESTO." : null;
  }
  return params.adminCodeMatches(params.code) ? null : "Cette adresse est réservée à l'équipe MYRESTO : saisis le code d'invitation de l'équipe.";
}
