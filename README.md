# MYRESTO

Le copilote du restaurateur : réservations (en ligne et par téléphone), plan de salle, planning de l'équipe, clients, finances, listes de courses et communication — pour un restaurant, un bar, une brasserie ou un café.

Next.js (App Router) · PostgreSQL · Prisma · NextAuth · Tailwind.

## Démarrer en local

```bash
npm install
cp .env.example .env     # puis ajoute AUTH_SECRET (openssl rand -base64 32)
npm run db:dev           # terminal 1 : base PostgreSQL embarquée (rien à installer)
npx prisma migrate deploy
npm run dev              # terminal 2 : http://localhost:3000
```

Créer un établissement : http://localhost:3000/onboarding (ouvert en développement).
Données de démonstration : `npm run db:seed`.

## Commandes utiles

| Commande | Rôle |
|---|---|
| `npm test` | Les tests automatiques (logique métier) |
| `npx tsc --noEmit` | Vérification des types |
| `npm run lint` | Vérification du code |
| `npm run db:migration -- nom` | Nouvelle migration après un changement de `prisma/schema.prisma` |
| `npm run db:import-sqlite -- chemin/dev.db` | Reprendre d'anciennes données SQLite |

## Mise en ligne

Voir [DEPLOY.md](DEPLOY.md) : hébergement, réglages, sauvegardes, sécurité.
