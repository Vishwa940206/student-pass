// Local development Postgres (real PostgreSQL binaries via `embedded-postgres`;
// no Docker or Homebrew needed). Data lives in ./.data/postgres (git-ignored).
//
//   pnpm db:up      → start (keeps running; Ctrl-C to stop)
//
// Connection: postgresql://postgres:postgres@localhost:54329/student_pass
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const DATA_DIR = new URL("../.data/postgres", import.meta.url).pathname;
const PORT = 54329;
const DB = "student_pass";

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: "postgres",
  password: "postgres",
  port: PORT,
  persistent: true,
  onLog: () => {},
});

const fresh = !existsSync(`${DATA_DIR}/PG_VERSION`);
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase(DB);

console.log(`Postgres ready → postgresql://postgres:postgres@localhost:${PORT}/${DB}`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
