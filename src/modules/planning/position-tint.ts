/// Une teinte douce par poste : on repère d'un coup d'œil la salle, la cuisine, le bar…
/// (les classes sont écrites en entier pour que Tailwind les détecte).
const TINTS: Record<string, string> = {
  salle: "border-transparent bg-salle-soft text-salle",
  cuisine: "border-transparent bg-cuisine-soft text-cuisine",
  bar: "border-transparent bg-bar-soft text-bar",
  plonge: "border-transparent bg-plonge-soft text-plonge",
  direction: "border-transparent bg-direction-soft text-direction",
};

export function positionTint(position: string): string {
  return TINTS[position] ?? "border-border bg-muted";
}
