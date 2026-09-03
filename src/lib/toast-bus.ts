// Bus minimal pour déclencher un toast depuis n'importe quel composant client, sans
// avoir à faire remonter un contexte React à travers chaque page. Le Toaster (monté une
// fois dans le layout racine) est le seul abonné.

export type ToastVariant = "success" | "error" | "info";

export type ToastEvent = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type Listener = (event: ToastEvent) => void;

const listeners = new Set<Listener>();

export function toast(message: string, variant: ToastVariant = "success") {
  const event: ToastEvent = { id: crypto.randomUUID(), message, variant };
  listeners.forEach((listen) => listen(event));
}

export function subscribeToToasts(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
