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
| `DATABASE_URL` | L'adresse de la base (la « poolée » si tu en as une) |
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
