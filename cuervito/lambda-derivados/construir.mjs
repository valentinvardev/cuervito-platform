// Arma build/handler.js con esbuild. Con --zip, además le instala sharp para
// Linux x64 (el de la Lambda) y deja funcion.zip listo para subir.
import { execSync } from "node:child_process";
import fs from "node:fs";

import { build } from "esbuild";

const conZip = process.argv.includes("--zip");

fs.rmSync("build", { recursive: true, force: true });
fs.rmSync("funcion.zip", { force: true });
fs.mkdirSync("build");

await build({
  entryPoints: ["handler.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: "build/handler.js",
  // sharp es nativo: va en node_modules. El SDK de S3 va adentro del bundle,
  // con la versión que fijamos y no la que traiga el runtime.
  external: ["sharp"],
  tsconfig: "tsconfig.json",
  logLevel: "warning",
});
console.log("build/handler.js listo");

if (!conZip) {
  // Para la prueba local: el mismo núcleo, empaquetado aparte.
  await build({
    entryPoints: ["nucleo.ts"],
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    outfile: "build/nucleo.js",
    external: ["sharp"],
    tsconfig: "tsconfig.json",
    logLevel: "warning",
  });
}

if (conZip) {
  const { dependencies } = JSON.parse(fs.readFileSync("package.json", "utf8"));
  fs.writeFileSync(
    "build/package.json",
    JSON.stringify({ private: true, dependencies: { sharp: dependencies.sharp } }, null, 2),
  );
  // Los binarios de sharp para la Lambda (Amazon Linux, x86_64), aunque se
  // arme en otra máquina.
  execSync("npm install --omit=dev --no-audit --no-fund --os=linux --cpu=x64 --libc=glibc", {
    cwd: "build",
    stdio: "inherit",
  });
  execSync("zip -qr ../funcion.zip .", { cwd: "build", stdio: "inherit" });
  const mb = (fs.statSync("funcion.zip").size / 1048576).toFixed(1);
  console.log(`funcion.zip listo (${mb} MB)`);
}
