import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..");
const spaSourceDir = path.join(repoRoot, "frontend");
const spaOutputDir = path.join(repoRoot, "public", "spa");
const entriesToCopy = ["index.html", "src"];

async function ensureExists(targetPath) {
  try {
    await stat(targetPath);
  } catch {
    throw new Error(`Missing required SPA source path: ${path.relative(repoRoot, targetPath)}`);
  }
}

async function syncSpa() {
  await ensureExists(spaSourceDir);
  await rm(spaOutputDir, { recursive: true, force: true });
  await mkdir(spaOutputDir, { recursive: true });

  for (const entry of entriesToCopy) {
    const fromPath = path.join(spaSourceDir, entry);
    const toPath = path.join(spaOutputDir, entry);
    await ensureExists(fromPath);
    await cp(fromPath, toPath, { force: true, recursive: true });
  }

  console.log(`Synced SPA files: frontend -> ${path.relative(repoRoot, spaOutputDir)}`);
}

syncSpa().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
