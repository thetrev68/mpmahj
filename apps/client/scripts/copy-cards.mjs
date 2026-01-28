import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const sourceDir = path.resolve(repoRoot, "data", "cards");
const targetDir = path.resolve(repoRoot, "apps", "client", "public", "cards");

await fs.mkdir(targetDir, { recursive: true });

const entries = await fs.readdir(sourceDir);
const files = entries.filter(
  (name) =>
    name.endsWith(".json") &&
    (name.startsWith("unified_card") || name.startsWith("card")),
);

await Promise.all(
  files.map((name) =>
    fs.copyFile(path.join(sourceDir, name), path.join(targetDir, name)),
  ),
);
