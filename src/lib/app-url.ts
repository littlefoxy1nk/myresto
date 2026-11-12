/// L'adresse publique de l'appli, pour construire les liens des emails (mot de passe oublié, invitation). Jamais déduite de la
/// requête (un en-tête Host falsifié ferait pointer le lien vers un faux site) : elle vient de la configuration (APP_URL).
export function appBaseUrl(env: Record<string, string | undefined> = process.env): string | null {
  const configured = (env.APP_URL || env.AUTH_URL || "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  return env.NODE_ENV === "production" ? null : "http://localhost:3000";
}
