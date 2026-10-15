/// Un service ne porte jamais un nom générique ("Déjeuner", "Dîner") : il s'appelle par son horaire, tel que le
/// restaurateur l'a défini — « Service de midi à 15h », « Service de 18h à 20h30 », « Service de 20h30 à 22h ».

/// "18:00" → "18h", "20:30" → "20h30", "12:00" → "midi", "00:00" → "minuit".
export function formatHourFr(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (h === 12 && m === 0) return "midi";
  if (h === 0 && m === 0) return "minuit";
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/// « de 18h à 20h30 »
export function serviceRange(startTime: string, endTime: string): string {
  return `de ${formatHourFr(startTime)} à ${formatHourFr(endTime)}`;
}

/// « Service de 18h à 20h30 »
export function serviceLabel(startTime: string, endTime: string): string {
  return `Service ${serviceRange(startTime, endTime)}`;
}
