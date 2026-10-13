/// Une fusion de tables vaut soit "pour toujours" (permanente), soit pour UN jour précis :
/// coller deux tables pour une soirée ne doit jamais toucher le plan des autres jours.
export type GroupWindow = { activeFrom: Date; activeUntil: Date | null; isPermanent: boolean };

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function groupWindow(dateKey: string | undefined, now: Date): GroupWindow {
  if (!dateKey) return { activeFrom: now, activeUntil: null, isPermanent: true };
  const m = DATE_KEY.exec(dateKey);
  if (!m) throw new Error("Date invalide.");
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return {
    activeFrom: new Date(y, mo - 1, d, 0, 0, 0, 0),
    activeUntil: new Date(y, mo - 1, d, 23, 59, 59, 999),
    isPermanent: false,
  };
}

/// Deux fenêtres se chevauchent si chacune commence avant que l'autre se termine
/// (une fin à null = sans fin).
export function windowsOverlap(
  a: { activeFrom: Date; activeUntil: Date | null },
  b: { activeFrom: Date; activeUntil: Date | null }
): boolean {
  const aStartsBeforeBEnds = !b.activeUntil || a.activeFrom <= b.activeUntil;
  const bStartsBeforeAEnds = !a.activeUntil || b.activeFrom <= a.activeUntil;
  return aStartsBeforeBEnds && bStartsBeforeAEnds;
}

/// L'instant à interroger pour savoir quels groupes comptent un jour donné : maintenant si
/// c'est aujourd'hui (une fusion permanente créée cet après-midi existe déjà), sinon midi.
export function groupInstantFor(date: Date, now: Date): Date {
  const sameDay =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  return sameDay ? now : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}
