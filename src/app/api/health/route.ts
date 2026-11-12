import { prisma } from "@/lib/prisma";
import { explainMissingDatabaseUrl, resolveDatabaseUrl } from "@/lib/database-url";
import { signupPolicy } from "@/lib/signup-policy";
import { readSmtpConfig } from "@/modules/settings/contact";

/// « Est-ce que tout est bien branché ? » À ouvrir dans le navigateur après un déploiement : /api/health
/// Quand tout va bien, la réponse ne dit que « ok ». Quand quelque chose manque, elle dit QUOI (jamais une valeur secrète :
/// seulement présent / absent), pour qu'on sache quoi corriger sans fouiller les journaux de l'hébergeur.
export const dynamic = "force-dynamic";

export async function GET() {
  const env = process.env;
  const databaseUrl = resolveDatabaseUrl(env);

  let databaseReachable = false;
  let migrationsApplied = false;
  if (databaseUrl) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseReachable = true;
      await prisma.company.count(); // échoue si les tables n'existent pas encore
      migrationsApplied = true;
    } catch {
      // On le dit plus bas, sans détail technique.
    }
  }

  const checks = {
    authSecret: !!(env.AUTH_SECRET || env.NEXTAUTH_SECRET),
    databaseUrl: databaseUrl ? "ok" : explainMissingDatabaseUrl(env),
    databaseReachable,
    migrationsApplied,
    appUrl: !!(env.APP_URL || env.AUTH_URL),
  };
  const ok = checks.authSecret && checks.databaseUrl === "ok" && databaseReachable && migrationsApplied && checks.appUrl;

  const headers = { "Cache-Control": "no-store" };
  if (ok) return Response.json({ status: "ok" }, { headers });

  const policy = signupPolicy(env);
  return Response.json(
    {
      status: "à configurer",
      checks,
      aide: {
        authSecret: checks.authSecret ? undefined : "Ajoute la variable AUTH_SECRET (une longue valeur aléatoire).",
        databaseUrl:
          checks.databaseUrl === "ok"
            ? undefined
            : checks.databaseUrl === "absente"
              ? "Ajoute la variable DATABASE_URL (l'adresse de ta base PostgreSQL)."
              : "L'adresse de la base doit commencer par postgres:// ou postgresql:// (pas prisma+postgres://).",
        databaseReachable: databaseReachable || checks.databaseUrl !== "ok" ? undefined : "La base ne répond pas : vérifie l'adresse, le mot de passe et que la base est démarrée.",
        migrationsApplied: migrationsApplied || !databaseReachable ? undefined : "La base est vide : les tables n'ont pas été créées (voir DEPLOY.md, « Créer les tables »).",
        appUrl: checks.appUrl ? undefined : "Ajoute la variable APP_URL (l'adresse publique, en https://).",
        inscriptions: policy.open ? undefined : "La création de compte est fermée : ajoute SIGNUP_INVITE_CODE (un code de ton choix) pour pouvoir créer ton établissement.",
        emails: readSmtpConfig(env) ? undefined : "Facultatif : sans SMTP_*, aucun email (mot de passe oublié…) ne part.",
      },
    },
    { status: 503, headers }
  );
}
