import { test } from "node:test";
import assert from "node:assert/strict";
import { explainMissingDatabaseUrl, resolveDatabaseUrl, resolveDirectDatabaseUrl } from "./database-url";

test("DATABASE_URL d'abord", () => assert.equal(resolveDatabaseUrl({ DATABASE_URL: "postgresql://a", POSTGRES_URL: "postgres://b" }), "postgresql://a"));
test("à défaut, les noms posés par Vercel / Neon", () => {
  assert.equal(resolveDatabaseUrl({ POSTGRES_PRISMA_URL: "postgres://pooled", POSTGRES_URL: "postgres://x" }), "postgres://pooled");
  assert.equal(resolveDatabaseUrl({ POSTGRES_URL: "postgres://x" }), "postgres://x");
});
test("une adresse Prisma Accelerate n'est pas utilisable : on passe à la suivante", () => {
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: "prisma+postgres://accelerate.prisma-data.net/?api_key=x", POSTGRES_URL: "postgres://direct" }), "postgres://direct");
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: "prisma+postgres://accelerate.prisma-data.net/?api_key=x" }), null);
});
test("pour les migrations : l'adresse directe d'abord", () => {
  assert.equal(resolveDirectDatabaseUrl({ DATABASE_URL: "postgres://pooled", DIRECT_URL: "postgres://direct" }), "postgres://direct");
  assert.equal(resolveDirectDatabaseUrl({ POSTGRES_PRISMA_URL: "postgres://pooled", POSTGRES_URL_NON_POOLING: "postgres://direct" }), "postgres://direct");
  assert.equal(resolveDirectDatabaseUrl({ DATABASE_URL: "postgres://only" }), "postgres://only");
});
test("on explique pourquoi rien ne convient", () => {
  assert.equal(explainMissingDatabaseUrl({}), "absente");
  assert.equal(explainMissingDatabaseUrl({ DATABASE_URL: "prisma+postgres://x" }), "mauvais-format");
});
