/**
 * Build a self-contained `build/` directory that mirrors what the Lambda zip
 * will contain:
 *
 *   build/handler.js              ← compiled by tsc
 *   build/generated/prisma/**     ← Prisma client + linux engine
 *   build/node_modules/...        ← runtime deps only
 *
 * The `function.zip` is then made by zipping this folder.
 *
 * We copy only the runtime dependencies (no devDependencies) to keep the zip
 * under Lambda's 50 MB direct-upload limit.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BUILD = path.join(ROOT, "build");
const DIST = path.join(ROOT, "dist");
const GENERATED = path.join(ROOT, "generated");
const NODE_MODULES = path.join(ROOT, "node_modules");

const RUNTIME_DEPS = [
  "@aws-sdk/client-s3",
  "@aws-sdk/client-rekognition",
  "@prisma/client",
  "prisma", // for the embedded engine helpers prisma client requires at runtime
];

function rmrf(p) {
  if (!fs.existsSync(p)) return;
  fs.rmSync(p, { recursive: true, force: true });
}

function cpr(src, dst) {
  if (!fs.existsSync(src)) {
    throw new Error(`Source does not exist: ${src}`);
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.cpSync(src, dst, { recursive: true });
}

/** Recursively collect a package + its transitive runtime deps (best effort). */
function collectDepTree(pkgName, seen = new Set()) {
  if (seen.has(pkgName)) return seen;
  seen.add(pkgName);
  const pkgDir = path.join(NODE_MODULES, pkgName);
  const pkgJsonPath = path.join(pkgDir, "package.json");
  if (!fs.existsSync(pkgJsonPath)) return seen;
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  } catch {
    return seen;
  }
  const deps = pkg.dependencies ?? {};
  for (const child of Object.keys(deps)) {
    collectDepTree(child, seen);
  }
  return seen;
}

function main() {
  console.log("[stage] cleaning build/");
  rmrf(BUILD);
  fs.mkdirSync(BUILD, { recursive: true });

  console.log("[stage] copying compiled handler from dist/");
  for (const entry of fs.readdirSync(DIST)) {
    cpr(path.join(DIST, entry), path.join(BUILD, entry));
  }

  console.log("[stage] copying Prisma client from generated/");
  cpr(GENERATED, path.join(BUILD, "generated"));

  console.log("[stage] resolving runtime dependency tree...");
  const all = new Set();
  for (const r of RUNTIME_DEPS) {
    collectDepTree(r, all);
  }
  console.log(`[stage] copying ${all.size} runtime packages`);

  for (const dep of all) {
    const src = path.join(NODE_MODULES, dep);
    if (!fs.existsSync(src)) continue;
    cpr(src, path.join(BUILD, "node_modules", dep));
  }

  console.log("[stage] done");
}

main();
