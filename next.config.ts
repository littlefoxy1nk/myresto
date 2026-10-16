import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache la pastille « N » de Next.js en bas de l'écran en développement (elle n'existe pas en production).
  devIndicators: false,
  // Ne dit pas au monde entier quelle technologie fait tourner le site.
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Les photos de publications et les documents d'employés font jusqu'à 5 Mo (+ un peu de marge pour le formulaire).
      bodySizeLimit: "6mb",
      // Derrière un serveur intermédiaire (hébergeur, nom de domaine), l'adresse peut différer de celle vue par l'appli :
      // on y liste les adresses autorisées à envoyer des formulaires (séparées par des virgules).
      ...(process.env.SERVER_ACTION_ORIGINS ? { allowedOrigins: process.env.SERVER_ACTION_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean) } : {}),
    },
  },
};

export default nextConfig;
