/// Une vraie base PostgreSQL pour le développement, sans rien installer : PGlite est PostgreSQL lui-même
/// (compilé pour tourner dans Node). Les données sont gardées dans `.pgdata/` (jamais versionné).
/// Lancement : `npm run db:dev` — puis, dans un autre terminal, `npm run dev`.
/// En production on utilise un PostgreSQL hébergé (voir DEPLOY.md) : le code est identique.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const PORT = Number(process.env.DEV_DB_PORT ?? 5433);

async function main() {
  const db = await PGlite.create({ dataDir: ".pgdata" });
  const server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1", maxConnections: 8 });
  await server.start();
  console.log(`Base PostgreSQL de développement prête sur 127.0.0.1:${PORT} (données dans .pgdata/)`);
  console.log(`DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable&connection_limit=1&pgbouncer=true"`);

  const stop = async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
