/// Une valeur recopiée dans l'hébergeur arrive souvent avec des guillemets (le fichier d'exemple en met), des espaces ou un
/// retour à la ligne en trop. On les retire pour que « "abc" », « abc » et « abc\n » soient la même valeur.
export function cleanEnvValue(value: string | undefined | null): string {
  return (value ?? "").trim().replace(/^["'`“”‘’<]+|["'`“”‘’>]+$/g, "").trim();
}
