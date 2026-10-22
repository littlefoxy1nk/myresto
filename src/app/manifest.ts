import type { MetadataRoute } from "next";

/// Ce qui rend l'appli « installable » : le téléphone propose de l'ajouter à l'écran d'accueil, et elle s'ouvre ensuite
/// en plein écran, sans barre d'adresse, comme une vraie application.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MYRESTO",
    short_name: "MYRESTO",
    description: "Le copilote du restaurateur : réservations, plan de salle, planning et équipe.",
    lang: "fr",
    start_url: "/aujourdhui",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#faf5f0",
    theme_color: "#1f1612",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Un appui long sur l'icône propose ces raccourcis (Android).
    shortcuts: [
      { name: "Aujourd'hui", url: "/aujourdhui", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Réservations", url: "/reservations", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Planning", url: "/planning", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
