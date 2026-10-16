/// Crée une migration à partir des changements de `prisma/schema.prisma` SANS base « fantôme » (que la base embarquée
/// de développement ne sait pas créer) : on compare la base actuelle au schéma, on enregistre le SQL, puis on l'applique.
///   npm run db:migration -- nom_de_la_migration
/// Avec un vrai PostgreSQL hébergé, `npx prisma migrate dev --name ...` fonctionne aussi.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const name = (process.argv[2] ?? "").replace(/[^a-z0-9_]/gi, "_").toLowerCase();
if (!name) {
  console.error("Donne un nom : npm run db:migration -- ajout_quelque_chose");
  process.exit(1);
}

const sql = execFileSync(
  "npx",
  ["prisma", "migrate", "diff", "--from-schema-datasource", "prisma/schema.prisma", "--to-schema-datamodel", "prisma/schema.prisma", "--script"],
  { encoding: "utf8" }
);

if (sql.includes("-- This is an empty migration") || sql.trim() === "") {
  console.log("Aucun changement à migrer.");
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const dir = `prisma/migrations/${stamp}_${name}`;
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/migration.sql`, sql);
console.log(`Migration écrite : ${dir}`);
execFileSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit" });
execFileSync("npx", ["prisma", "generate"], { stdio: "inherit" });
