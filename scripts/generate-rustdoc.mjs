import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const sourceDir = resolve(root, "target", "doc");
const outputDir = resolve(root, "docs", "rustdoc");

execSync("cargo doc --workspace --no-deps", { stdio: "inherit" });

if (!existsSync(sourceDir)) {
  throw new Error(`Rustdoc output not found at: ${sourceDir}`);
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });
cpSync(sourceDir, outputDir, { recursive: true });

const landingPage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Rustdoc Index</title>
    <meta http-equiv="refresh" content="0; url=mahjong_core/index.html" />
  </head>
  <body>
    <p>Redirecting to <a href="mahjong_core/index.html">mahjong_core docs</a>...</p>
    <p>Other crates: <a href="mahjong_server/index.html">mahjong_server</a>, <a href="mahjong_ai/index.html">mahjong_ai</a></p>
  </body>
</html>
`;

writeFileSync(resolve(outputDir, "index.html"), landingPage, "utf8");

console.log(`Rustdoc copied to ${outputDir}`);
