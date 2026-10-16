/// Reprend les données d'une ancienne base SQLite (celle du développement avant le passage à PostgreSQL) et les copie
/// dans la base PostgreSQL pointée par DATABASE_URL. À lancer une seule fois, sur une base vide :
///   npm run db:import-sqlite -- prisma/dev.db
/// Lit chaque table, convertit les dates (nombres de millisecondes) et les booléens (0/1), puis insère dans l'ordre
/// qui respecte les liens entre tables. Rien n'est modifié dans le fichier SQLite.
// @ts-expect-error — node:sqlite n'est pas encore décrit dans les types de @types/node 20.
import { DatabaseSync } from "node:sqlite";
import { Prisma, PrismaClient } from "../src/generated/prisma";

const source = process.argv[2] ?? "prisma/dev.db";
const prisma = new PrismaClient();
const models = Prisma.dmmf.datamodel.models;

function orderByDependencies(): string[] {
  const deps = new Map<string, Set<string>>();
  for (const m of models) {
    const set = new Set<string>();
    for (const f of m.fields) {
      if (f.kind === "object" && f.relationFromFields?.length && f.type !== m.name) set.add(f.type);
    }
    deps.set(m.name, set);
  }
  const ordered: string[] = [];
  const done = new Set<string>();
  while (ordered.length < models.length) {
    const ready = models.filter((m) => !done.has(m.name) && [...deps.get(m.name)!].every((d) => done.has(d)));
    if (ready.length === 0) throw new Error("Dépendances circulaires entre tables : impossible de choisir un ordre.");
    for (const m of ready) {
      ordered.push(m.name);
      done.add(m.name);
    }
  }
  return ordered;
}

function convert(value: unknown, type: string): unknown {
  if (value === null || value === undefined) return null;
  switch (type) {
    case "DateTime":
      return new Date(typeof value === "number" ? value : Number(value));
    case "Boolean":
      return value === 1 || value === true || value === "1";
    case "BigInt":
      return BigInt(value as number);
    case "Int":
    case "Float":
      return Number(value);
    default:
      return value;
  }
}

async function main() {
  const sqlite = new DatabaseSync(source, { readOnly: true });
  const existing = await prisma.company.count();
  if (existing > 0) throw new Error("La base PostgreSQL contient déjà des données : l'import ne s'exécute que sur une base vide.");

  let total = 0;
  for (const name of orderByDependencies()) {
    const model = models.find((m) => m.name === name)!;
    const scalars = model.fields.filter((f) => f.kind === "scalar" || f.kind === "enum");
    let rows: Record<string, unknown>[];
    try {
      rows = sqlite.prepare(`SELECT * FROM "${name}"`).all() as Record<string, unknown>[];
    } catch {
      console.log(`  ${name}: table absente dans le fichier SQLite, ignorée`);
      continue;
    }
    if (rows.length === 0) continue;
    const data = rows.map((row) => Object.fromEntries(scalars.filter((f) => f.name in row).map((f) => [f.name, convert(row[f.name], f.type)])));
    const delegate = (prisma as unknown as Record<string, { createMany: (args: { data: unknown[] }) => Promise<{ count: number }> }>)[
      name.charAt(0).toLowerCase() + name.slice(1)
    ];
    const { count } = await delegate.createMany({ data });
    total += count;
    console.log(`  ${name}: ${count}`);
  }
  console.log(`Import terminé : ${total} lignes copiées.`);
  sqlite.close();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
