/// Le navigateur (Android, ordinateur) annonce « cette appli peut être installée » UNE seule fois par page ouverte, par un
/// événement. On le capte ici, au chargement du fichier, pour que la carte et la bannière puissent s'en servir plus tard,
/// même si elles s'affichent après l'événement.
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // on propose l'installation nous-mêmes, au bon moment
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

export const installStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  canPrompt: () => deferred !== null,
  async prompt(): Promise<"accepted" | "dismissed" | "unavailable"> {
    if (!deferred) return "unavailable";
    const event = deferred;
    await event.prompt();
    const { outcome } = await event.userChoice;
    deferred = null;
    notify();
    return outcome;
  },
};

/// Quel appareil, et l'appli est-elle déjà installée ?
export function detectDevice(): { installed: boolean; ios: boolean } {
  const nav = navigator as Navigator & { standalone?: boolean };
  const installed = window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
  return { installed, ios: isIos(navigator.userAgent, navigator.maxTouchPoints) };
}

/// Les iPad récents se présentent comme des Mac : on les reconnaît à leur écran tactile.
export function isIos(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
}
