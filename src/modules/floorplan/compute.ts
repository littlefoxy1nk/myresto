// Fonctions pures du plan de salle — géométrie uniquement, aucun accès base de
// données. Même principe que modules/planning/compute.ts : testable sans Prisma.

const TABLES_PER_ROW = 5;
const GRID_PITCH = 100;
const GRID_ORIGIN = 40;

/// Position par défaut de la N-ième table d'une zone (0-indexé), en grille — pour que
/// chaque nouvelle table apparaisse à un endroit libre au lieu de s'empiler toutes au
/// même point comme avant. Même grille que l'auto-placement de l'inscription (voir
/// onboarding-actions.ts), pour un plan cohérent qu'on ajoute une table à l'inscription
/// ou plus tard depuis le plan de salle.
export function nextGridPosition(index: number): { posX: number; posY: number } {
  const col = index % TABLES_PER_ROW;
  const row = Math.floor(index / TABLES_PER_ROW);
  return { posX: col * GRID_PITCH + GRID_ORIGIN, posY: row * GRID_PITCH + GRID_ORIGIN };
}

export type Rect = { x: number; y: number; width: number; height: number };

/// Deux rectangles se chevauchent réellement — utilisé pour détecter qu'on a "déposé"
/// une table sur une autre pendant un glisser (déclenche une proposition de fusion
/// plutôt qu'un déplacement, voir floor-plan-canvas.tsx), jamais pour un simple
/// effleurement au pixel près.
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}
