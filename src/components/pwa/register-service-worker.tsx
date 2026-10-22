"use client";

import { useEffect } from "react";
// Charge le guetteur d'« installation possible » dès l'ouverture de n'importe quelle page.
import "@/components/pwa/install-store";

/// Enregistre le service worker (la page « Pas de connexion ») — uniquement en production : en développement,
/// il gênerait le rechargement automatique des pages.
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Pas de service worker : l'appli marche pareil, seule la page « hors connexion » manque.
    });
  }, []);
  return null;
}
