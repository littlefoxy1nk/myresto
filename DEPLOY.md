# Mettre MYRESTO en ligne

Ce guide explique comment héberger l'appli pour un **test fermé** avec quelques restaurants. Rien ici n'est irréversible : tu peux tout recommencer.

## Ce dont tu as besoin (comptes à créer à ton nom)

| Quoi | À quoi ça sert | Exemples |
|---|---|---|
| Un hébergeur d'application | Fait tourner l'appli 24h/24 | Railway, Render, Fly.io |
| Une base PostgreSQL | Garde les données | Celle de l'hébergeur (Railway/Render) ou Neon, Supabase |
| Un disque qui ne s'efface pas | Garde les photos de publications et les documents d'employés | « Volume » chez Railway/Fly/Render |
| Un nom de domaine | Une adresse comme `app.myresto.be` (HTTPS automatique) | OVH, Gandi, Infomaniak… |
| Une boîte d'envoi d'emails | « Mot de passe oublié » et formulaire de contact | Gmail (mot de passe d'application), Brevo, Mailjet |
| Un dépôt GitHub **privé** | Sauvegarde du code et déploiement automatique | github.com |

> Pourquoi un disque persistant ? Les photos et les documents d'employés sont enregistrés dans le dossier `uploads/`. Sur un hébergement sans disque persistant, ils disparaîtraient à chaque redémarrage. Monte le volume sur `/app/uploads` (ou le dossier `uploads` de l'appli).

## 1. Le code sur GitHub

1. Crée un dépôt **privé** sur GitHub.
2. Dans le dossier du projet : `git remote add origin <adresse du dépôt>` puis `git push -u origin main`.

## 2. La base de données

Crée une base PostgreSQL chez l'hébergeur et note son adresse (`postgresql://…`). Si l'hébergeur propose deux adresses (une « poolée », une « directe »), garde les deux.

## 3. Les réglages (variables d'environnement)

À saisir dans l'interface de l'hébergeur. Le modèle complet est dans `.env.example`.

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | L'adresse de la base, en `postgres://` (la « poolée » si tu en as une) |
| `DIRECT_URL` | L'adresse directe de la base (la même s'il n'y en a qu'une) |
| `AUTH_SECRET` | Une longue valeur aléatoire : `openssl rand -base64 32` |
| `APP_URL` | L'adresse publique, ex. `https://app.myresto.be` |
| `AUTH_TRUST_HOST` | `true` |
| `SIGNUP_INVITE_CODE` | Un code secret que **tu** donnes à tes testeurs. Sans lui, personne ne peut créer d'établissement |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Ta boîte d'envoi d'emails |
| `SUPPORT_EMAIL` | Qui reçoit les messages du formulaire de contact |
| `NODE_ENV` | `production` (la plupart des hébergeurs le font déjà) |

Facultatif : `APP_TIMEZONE` (par défaut `Europe/Brussels`), `SERVER_ACTION_ORIGINS` (si l'adresse vue par l'appli diffère de l'adresse publique).

## 4. Les commandes de l'hébergeur

- **Installation + construction** : `npm ci && npm run build`
- **Démarrage** : `npm run start:prod` — il applique d'abord les mises à jour de la base (`prisma migrate deploy`), puis lance l'appli.

## 5. Le nom de domaine

Chez l'hébergeur, ajoute ton domaine ; il te donne un enregistrement DNS à saisir chez ton registrar. Le HTTPS est automatique.

## 6. Premier démarrage

1. Ouvre `https://ton-domaine/onboarding`, saisis le code d'invitation et crée **ton** établissement (celui de test).
2. Dans Paramètres → *Aide et contact*, envoie un message : tu vérifies que l'envoi d'emails marche.
3. Sur la page de connexion, teste « Mot de passe oublié ».
4. Donne le code d'invitation à un restaurateur ami : il crée son propre établissement. Les données de chacun sont totalement séparées.

## Variante Vercel (si l'appli est hébergée sur Vercel)

Vercel n'a pas de disque durable : c'est pour cela que les photos et documents sont gardés dans la base de données (aucun volume à brancher).

1. **Base de données** : une base PostgreSQL (Prisma Postgres, Neon, Supabase…), branchée au projet dans *Storage → Connect Project*. L'adresse doit commencer par `postgres://` ou `postgresql://`. Une adresse `prisma+postgres://` (Prisma Accelerate) ne convient pas : utilise l'adresse « directe » (TCP) que la console de la base propose.
2. **Réglages** : *Project → Settings → Environment Variables*, cochés pour **Production** :
   - `DATABASE_URL` (ou les noms posés par Vercel : `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING` — l'appli les reconnaît),
   - `AUTH_SECRET` (`openssl rand -base64 32`),
   - `APP_URL` = l'adresse du site, en `https://…`,
   - `SIGNUP_INVITE_CODE` = ton code d'invitation.
3. **Créer les tables** : automatique. Le build Vercel utilise la commande `vercel-build` (voir `package.json`) qui lance `prisma migrate deploy` avant de construire l'appli. Laisse la commande de build de Vercel par défaut.
4. **Région** : *Settings → Functions → Function Region* : choisis Francfort (`fra1`) ou Paris (`cdg1`), la plus proche de ta base.
5. **Vérifier** : ouvre `https://ton-site/api/health`. Réponse `{"status":"ok"}` = tout est branché. Sinon la réponse dit exactement quelle variable manque ou ce qui ne va pas.
6. Limites propres à Vercel : photos et documents jusqu'à 4 Mo (Vercel refuse les envois plus gros).

## L'équipe MYRESTO : créer l'établissement d'un client

1. Dans les réglages de l'hébergeur, ajoute :
   - `PLATFORM_ADMIN_EMAILS` : les adresses de l'équipe, séparées par des virgules (ex. `chloehamoir@gmail.com,sara-petlic@hotmail.com`) ;
   - `ADMIN_INVITE_CODE` : un code secret réservé à l'équipe (différent de `SIGNUP_INVITE_CODE`, que tu donnes aux restaurateurs).
2. Chaque personne de l'équipe crée son compte sur `/onboarding` avec **son** adresse et le **code d'équipe**. Elle a ainsi son petit établissement d'essai.
3. Un nouveau menu **Équipe MYRESTO** apparaît. Il permet de :
   - **créer l'établissement d'un client** : nom, patron, email → le patron reçoit (ou tu lui transmets) un lien pour choisir son mot de passe, valable 7 jours ;
   - voir **tous les établissements** ;
   - **ouvrir un établissement en mode assistance** : accès à tout, avec un bandeau visible, mais sans être propriétaire (pas de suppression de l'établissement, pas d'export, pas d'accès au compte du patron). Chaque entrée est notée dans le journal de l'établissement.
4. Retirer une adresse de `PLATFORM_ADMIN_EMAILS` coupe aussitôt tous ses accès d'assistance.

## Emails automatiques (réservations)

Deux emails partent tout seuls dès que l'envoi d'emails est configuré :
- **à l'équipe** (toute personne qui gère les réservations et qui a une adresse email) quand une demande arrive par le lien de réservation en ligne — sauf si elle a coupé « Réservations en ligne » dans ses notifications ;
- **au client** quand tu confirme sa réservation, s'il a laissé son adresse. Un seul email par réservation, même si tu la confirmes plusieurs fois. Le client peut répondre à l'email : la réponse arrive chez le propriétaire. Chaque restaurant peut couper cet email dans *Paramètres → Mon établissement → Réservation en ligne*.

Les établissements de démonstration n'envoient jamais d'email. Si l'envoi échoue, la réservation est enregistrée quand même et l'email est simplement retenté à la prochaine confirmation.

**Configurer l'envoi avec Gmail (pour tester)** :
1. Sur l'adresse Gmail qui enverra les emails : active la validation en deux étapes (myaccount.google.com → Sécurité).
2. Toujours dans Sécurité, cherche « Mots de passe des applications », crée-en un (nom : MYRESTO) : Google affiche un code de 16 lettres.
3. Dans Vercel → Settings → Environment Variables, ajoute `SMTP_HOST` = `smtp.gmail.com`, `SMTP_PORT` = `587`, `SMTP_USER` = l'adresse Gmail, `SMTP_PASS` = le code de 16 lettres (sans espaces). Ne remplis pas `SMTP_FROM` : les emails afficheront alors le nom du restaurant comme expéditeur.
4. Redéploie. Pour vérifier : confirme une réservation de test dont l'email du client est le tien.

Pour un vrai lancement, utilise une adresse à ton nom de domaine (sinon Gmail limite le nombre d'envois par jour et les emails risquent de finir dans les spams).

## Notifications sur téléphone

Les notifications dans l'appli (la cloche) marchent toujours. Pour qu'elles arrivent aussi **sur le téléphone, appli fermée** :

1. Sur ton ordinateur, dans le dossier du projet : `npx web-push generate-vapid-keys`. Ça affiche une clé publique et une clé privée.
2. Dans les réglages de l'hébergeur, ajoute `VAPID_PUBLIC_KEY` (clé publique) et `VAPID_PRIVATE_KEY` (clé privée), puis redéploie. Génère-les **une seule fois** et garde-les : si elles changent, chacun doit réactiver ses notifications.
3. Chaque personne active ensuite les notifications dans *Paramètres → Notifications → Sur ce téléphone* (bouton « Activer », puis « Envoyer un essai »).
4. **iPhone** : règle d'Apple — ça ne marche qu'une fois MYRESTO ajouté à l'écran d'accueil (Partager → Sur l'écran d'accueil) et ouvert depuis son icône. Sur Android et ordinateur, ça marche directement dans le navigateur.

## Sauvegardes (indispensable avant d'inviter des amis)

- **Base de données** : active les sauvegardes automatiques chez l'hébergeur (quotidiennes), et fais de temps en temps un export manuel : `pg_dump "<DIRECT_URL>" > sauvegarde.sql`.
- **Fichiers** (`uploads/`) : active les sauvegardes du volume si l'hébergeur le propose.
- **Chaque restaurateur** peut télécharger toutes ses données (Paramètres → *Mes données*).

## Fermer un compte / tout supprimer

Le propriétaire d'un établissement peut, dans Paramètres → *Mes données*, télécharger ses données puis **supprimer définitivement** son établissement : réservations, clients, équipe et leurs comptes, planning, finances, photos et documents. Il doit recopier le nom de l'établissement et redonner son mot de passe.

## Travailler en local

```bash
npm run db:dev      # terminal 1 : base PostgreSQL embarquée (rien à installer)
npm run dev         # terminal 2 : l'appli sur http://localhost:3000
```

- Nouvelle migration après un changement de `prisma/schema.prisma` : `npm run db:migration -- nom_de_la_migration`
- Reprendre d'anciennes données SQLite : `npm run db:import-sqlite -- chemin/vers/dev.db` (base vide uniquement)

## Ce qui est déjà en place côté sécurité

- Données de chaque établissement strictement séparées (chaque lecture et modification vérifie l'établissement).
- Mots de passe hachés (bcrypt), longueur minimale 10 et liste de mots de passe trop courants refusés ; verrouillage du compte après 5 essais ratés ; limites par adresse IP.
- Sessions de 14 jours, révoquées d'un coup quand un mot de passe ou un code change.
- Un responsable ne peut pas se donner plus de droits qu'il n'en a, ni toucher au compte du propriétaire.
- En-têtes de sécurité et politique de contenu (CSP) avec code à usage unique pour les scripts ; HTTPS imposé en production.
- Photos et documents hors du dossier public, servis seulement aux personnes autorisées ; type de fichier vérifié sur le contenu réel.
- Journal des actions sensibles (création/retrait d'employé, changement de droits, export, suppression).

## Ce qui reste à faire avant d'ouvrir au grand public (pas nécessaire pour un test fermé)

- Pages légales (politique de confidentialité, conditions d'utilisation) relues par un juriste.
- Authentification à deux facteurs pour les propriétaires.
- Stockage des photos et documents sur un service dédié (au lieu du disque) pour plusieurs serveurs.
- Limites de requêtes partagées entre plusieurs serveurs (aujourd'hui elles vivent en mémoire d'un seul serveur).
- Suivi d'erreurs (Sentry ou équivalent) et alertes.
