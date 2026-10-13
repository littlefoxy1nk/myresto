/// Numéro saisi à la main ("0475 12 34 56", "+32 475 12 34 56", "0032475123456") → chiffres
/// au format international sans "+" (ce qu'attendent wa.me et sms:). Null si le numéro ne
/// ressemble pas à un numéro — jamais de supposition hasardeuse. Par défaut un numéro
/// national est supposé belge (32), l'établissement cible.
export function normalizePhone(raw: string | null | undefined, defaultCountryCode = "32"): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^[+\d][\d\s.\-/()]*$/.test(trimmed)) return null;

  const hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");

  if (hasPlus) {
    // déjà international
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = defaultCountryCode + digits.slice(1);
  } else {
    return null;
  }

  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}
