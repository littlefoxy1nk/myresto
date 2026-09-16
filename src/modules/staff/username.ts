/// Pure, sans accès base de données — extrait pour rester testable. La déduplication
/// (suffixe numérique en cas de doublon) reste dans server/actions.ts, qui seul sait
/// interroger la base.
export function slugifyForUsername(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function baseUsername(firstName: string, lastName: string): string {
  return `${slugifyForUsername(firstName)}.${slugifyForUsername(lastName)}`;
}
