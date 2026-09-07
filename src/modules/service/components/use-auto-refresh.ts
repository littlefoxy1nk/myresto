"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/// Rafraîchissement léger : re-déclenche le Server Component (nouvelles données, pas de
/// rechargement de page) à intervalle régulier, pour que les états qui changent avec le
/// temps qui passe (une table qui devient "bientôt réservée", un compte à rebours) restent
/// justes même sans action de l'utilisateur. Sans WebSocket ni infra temps réel — l'action
/// de mutation (Server Action + revalidatePath) reste le mécanisme principal de mise à
/// jour ; ce polling ne fait que rattraper l'écoulement du temps entre deux actions.
export function useAutoRefresh(intervalMs: number) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
}
