import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function run(command) {
  execSync(command, { stdio: "inherit" });
}

function readEnvValue(name) {
  if (process.env[name]) {
    return process.env[name];
  }

  if (!fs.existsSync(".env")) {
    return undefined;
  }

  const envText = fs.readFileSync(".env", "utf8");
  const match = envText.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!match) {
    return undefined;
  }

  return match[1].trim().replace(/^"(.*)"$/, "$1");
}

run("node scripts/prepare-sqlite-schema.mjs");
run("npx prisma generate --schema prisma/schema.sqlite.prisma");

const sql = execSync(
  "npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.sqlite.prisma --script",
  { encoding: "utf8" }
);

const sqlPath = path.resolve("prisma", "sqlite-init.sql");
fs.writeFileSync(sqlPath, sql, "utf8");
console.log(`Wrote ${path.relative(process.cwd(), sqlPath)}`);

const sqliteUrl = readEnvValue("DATABASE_URL_SQLITE") ?? "file:./dev.db";
if (!sqliteUrl.startsWith("file:")) {
  throw new Error(`DATABASE_URL_SQLITE must use file: URL for SQLite, got: ${sqliteUrl}`);
}

const sqliteFile = sqliteUrl.slice("file:".length).split("?")[0];
const sqlitePath = path.resolve("prisma", sqliteFile);
fs.rmSync(sqlitePath, { force: true });
console.log(`Reset ${path.relative(process.cwd(), sqlitePath)}`);

run("npx prisma db execute --schema prisma/schema.sqlite.prisma --file prisma/sqlite-init.sql");
fs.rmSync(sqlPath, { force: true });
run("npm run db:seed");
