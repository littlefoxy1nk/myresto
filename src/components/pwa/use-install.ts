"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { detectDevice, installStore } from "@/components/pwa/install-store";

export type InstallState = {
  /// Le premier rendu (serveur) ne sait rien de l'appareil : on attend d'être dans le navigateur.
  ready: boolean;
  installed: boolean;
  ios: boolean;
  canPrompt: boolean;
  prompt: () => Promise<"accepted" | "dismissed" | "unavailable">;
};

export function useInstall(): InstallState {
  const [device, setDevice] = useState<{ installed: boolean; ios: boolean } | null>(null);
  const canPrompt = useSyncExternalStore(installStore.subscribe, installStore.canPrompt, () => false);

  useEffect(() => {
    // La détection dépend du navigateur : elle ne peut se faire qu'après l'affichage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDevice(detectDevice());
  }, []);

  return { ready: device !== null, installed: device?.installed ?? false, ios: device?.ios ?? false, canPrompt, prompt: installStore.prompt };
}
