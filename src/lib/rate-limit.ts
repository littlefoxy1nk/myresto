import { prisma } from "@/lib/prisma";

/// Fenêtre fixe : au plus `max` essais par clé sur `windowMs`, puis la fenêtre repart de zéro. Fonction pure (le compteur lui-même
/// vit en base, voir `createRateLimiter`).
export function nextWindow(
  state: { count: number; windowStart: number } | null,
  now: number,
  max: number,
  windowMs: number
): { allowed: boolean; count: number; windowStart: number } {
  const fresh = !state || now - state.windowStart >= windowMs;
  const count = fresh ? 1 : state.count + 1;
  return { allowed: count <= max, count, windowStart: fresh ? now : state.windowStart };
}

/// Un compteur par clé, PARTAGÉ entre toutes les copies du serveur : sur un hébergement qui démarre plusieurs copies de l'appli
/// (Vercel), un compteur gardé en mémoire serait remis à zéro à chaque copie et ne freinerait presque rien. Ici une seule requête
/// atomique en base compte l'essai et dit s'il est permis.
///
/// `name` sépare les compteurs entre eux (« login », « reservation »…). Si la base ne répond pas, on laisse passer : elle serait
/// de toute façon indispensable à l'action qui suit, et un compteur en panne ne doit jamais empêcher quelqu'un de se connecter.
export function createRateLimiter(name: string, max: number, windowMs: number) {
  return {
    async allow(key: string, now: number = Date.now()): Promise<boolean> {
      const bucket = `${name}:${key}`;
      const at = new Date(now);
      const expiredBefore = new Date(now - windowMs);
      try {
        const rows = await prisma.$queryRaw<{ count: number }[]>`
          INSERT INTO "RateLimitBucket" ("key", "count", "windowStart")
          VALUES (${bucket}, 1, ${at})
          ON CONFLICT ("key") DO UPDATE SET
            "count" = CASE WHEN "RateLimitBucket"."windowStart" <= ${expiredBefore} THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
            "windowStart" = CASE WHEN "RateLimitBucket"."windowStart" <= ${expiredBefore} THEN ${at} ELSE "RateLimitBucket"."windowStart" END
          RETURNING "count"`;
        // Ménage occasionnel : les compteurs d'adresses qu'on ne revoit plus n'ont pas à rester en base.
        if (Math.random() < 0.02) {
          prisma.rateLimitBucket.deleteMany({ where: { windowStart: { lt: new Date(now - 24 * 3_600_000) } } }).catch(() => undefined);
        }
        return Number(rows[0]?.count ?? 1) <= max;
      } catch (error) {
        console.error("Limite d'essais indisponible", error);
        return true;
      }
    },
  };
}
