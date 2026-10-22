/// Dessine les icônes de l'appli (écran d'accueil du téléphone) à partir d'un petit dessin vectoriel : le « M » de MYRESTO
/// sur le dégradé terracotta → bordeaux. À relancer seulement si on change le dessin : `npx tsx scripts/make-icons.ts`.
import sharp from "sharp";

const gradient = `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ee7d4b"/>
      <stop offset="0.5" stop-color="#c0451f"/>
      <stop offset="1" stop-color="#9f1f4d"/>
    </linearGradient>
  </defs>`;

/// Le « M » est tracé en lignes (pas en texte) : même rendu partout, sans dépendre d'une police installée.
const letter = (scale: number) => `
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <path d="M148 366 V160 L256 292 L364 160 V366" fill="none" stroke="#fff" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;

/// `rounded` : coins arrondis (icône ordinaire). Sinon plein cadre (« maskable » : le téléphone découpe lui-même la forme).
const svg = (rounded: boolean, scale: number) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${gradient}
    <rect width="512" height="512" ${rounded ? 'rx="112"' : ""} fill="url(#g)"/>${letter(scale)}</svg>`);

async function png(file: string, size: number, rounded: boolean, scale = 1) {
  await sharp(svg(rounded, scale), { density: 384 }).resize(size, size).png().toFile(`public/icons/${file}`);
  console.log("écrit", file);
}

async function main() {
  await png("icon-192.png", 192, true);
  await png("icon-512.png", 512, true);
  // Plein cadre, lettre un peu plus petite : elle reste dans la « zone de sécurité » quelle que soit la forme découpée.
  await png("maskable-512.png", 512, false, 0.8);
  // iOS applique ses propres coins : on lui donne un carré plein.
  await png("apple-touch-icon.png", 180, false, 0.9);
}

main();
