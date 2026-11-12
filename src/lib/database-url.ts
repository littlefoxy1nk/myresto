/// Retrouve l'adresse de la base PostgreSQL dans les réglages, quel que soit le nom que l'hébergeur lui a donné :
/// DATABASE_URL à la main, ou POSTGRES_PRISMA_URL / POSTGRES_URL posés par Vercel, Neon ou Supabase quand on branche une base.
/// Seules les adresses `postgres://` ou `postgresql://` conviennent : une adresse `prisma+postgres://` (Prisma Accelerate)
/// n'est pas utilisable par l'appli, on passe alors à la suivante.
type Env = Record<string, string | undefined>;

const isPostgresUrl = (value: string | undefined): value is string => !!value && /^postgres(ql)?:\/\//i.test(value.trim());

function firstPostgres(env: Env, names: string[]): string | null {
  for (const name of names) {
    const value = env[name];
    if (isPostgresUrl(value)) return value.trim();
  }
  return null;
}

/// L'adresse utilisée par l'appli (celle « poolée » si l'hébergeur en donne une).
export function resolveDatabaseUrl(env: Env = process.env): string | null {
  return firstPostgres(env, ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL"]);
}

/// L'adresse utilisée pour appliquer les migrations : directe, sans pooler, quand elle existe.
export function resolveDirectDatabaseUrl(env: Env = process.env): string | null {
  return firstPostgres(env, ["DIRECT_URL", "POSTGRES_URL_NON_POOLING", "DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL"]);
}

/// Pourquoi aucune adresse ne convient (pour le dire clairement) : rien de défini, ou un mauvais format.
export function explainMissingDatabaseUrl(env: Env = process.env): "absente" | "mauvais-format" {
  const candidates = ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL", "DIRECT_URL", "POSTGRES_URL_NON_POOLING"];
  return candidates.some((name) => env[name]?.trim()) ? "mauvais-format" : "absente";
}
