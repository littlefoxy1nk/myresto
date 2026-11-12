"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/// Rafraîchissement léger : re-déclenche le Server Component (nouvelles données, pas de
/// rechargement de page) à intervalle régulier, pour que les états qui changent avec le
/// temps qui passe (une table qui devient "bientôt réservée", un compte à rebours) restent
/// justes même sans action de l'utilisateur. Sans WebSocket ni infra temps réel — l'action
/// de mutation (Server Action + revalidatePath) reste le mécanisme principal de mise à
/// jour ; ce polling ne fait que rattraper l'écoulement du temps entre deux actions.
///
/// Il ne tourne QUE quand l'onglet est visible : un téléphone posé avec l'appli ouverte en arrière-plan ne consomme rien
/// (ni base de données, ni serveur). Au retour sur l'onglet, la page se remet à jour tout de suite si elle est restée trop
/// longtemps cachée.
export function useAutoRefresh(intervalMs: number) {
  const router = useRouter();
  useEffect(() => {
    let lastRefresh = Date.now();
    const refresh = () => {
      lastRefresh = Date.now();
      router.refresh();
    };
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefresh >= intervalMs) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, intervalMs]);
}
