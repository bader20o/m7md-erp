import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve("prisma", "schema.prisma");
const targetPath = path.resolve("prisma", "schema.sqlite.prisma");

let schema = fs.readFileSync(sourcePath, "utf8");

const providerMarker = 'provider = "postgresql"';
if (!schema.includes(providerMarker)) {
  throw new Error(`Expected to find ${providerMarker} in prisma/schema.prisma`);
}

schema = schema.replace(providerMarker, 'provider = "sqlite"');

const datasourceUrlPattern = /url\s*=\s*env\("DATABASE_URL"\)/;
if (!datasourceUrlPattern.test(schema)) {
  throw new Error('Expected datasource url to use env("DATABASE_URL")');
}

schema = schema.replace(datasourceUrlPattern, 'url      = env("DATABASE_URL_SQLITE")');
schema = schema.replace(/\s+@db\.Decimal\(\d+,\s*\d+\)/g, "");

fs.writeFileSync(targetPath, schema, "utf8");
console.log(`Wrote ${path.relative(process.cwd(), targetPath)}`);
