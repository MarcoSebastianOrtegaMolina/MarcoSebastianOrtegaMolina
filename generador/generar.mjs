#!/usr/bin/env node
// Generates the profile README header: reads datos/perfil.en.json and generador/fuentes/, writes
// assets/*.svg and README.md. Node 20 or later, no dependencies.
//
//   node generador/generar.mjs                 build and write
//   node generador/generar.mjs --datos FILE    use another data file ("-" reads it from stdin)
//   node generador/generar.mjs --check         build and compare with the files on disk; writes nothing
//
// If the data does not meet the contract or any check fails, it exits with an error and leaves every
// file as it was. File names carry a short hash of their content, so GitHub's image cache never
// serves an old version; images that are no longer used are deleted.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "./datos.mjs";
import { loadSources } from "./cabecera.mjs";
import { build } from "./construir.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const ASSETS = path.join(root, "assets");
const README = path.join(root, "README.md");

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
}

export function buildFromDisk(dataPath = path.join(root, "datos/perfil.en.json")) {
  const text = dataPath === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(dataPath, "utf8");
  let raw;
  try { raw = JSON.parse(text); } catch (e) { throw new Error(`the data file is not valid JSON: ${e.message}`); }
  const data = validate(raw);
  return build(data, loadSources(path.join(here, "fuentes")));
}

function main() {
  const check = process.argv.includes("--check");
  const out = buildFromDisk(arg("--datos") || undefined);
  const wanted = new Map(out.files.map((f) => [f.name, f.content]));
  const onDisk = fs.existsSync(ASSETS) ? fs.readdirSync(ASSETS).filter((f) => f.endsWith(".svg")) : [];
  const stale = onDisk.filter((f) => !wanted.has(f));
  const changed = [...wanted].filter(([name, content]) => !fs.existsSync(path.join(ASSETS, name)) || fs.readFileSync(path.join(ASSETS, name), "utf8") !== content).map(([name]) => name);
  const readmeChanged = !fs.existsSync(README) || fs.readFileSync(README, "utf8") !== out.readme;
  if (check) {
    const diff = changed.length + stale.length + (readmeChanged ? 1 : 0);
    console.log(diff ? `out of date: ${changed.length} images to write, ${stale.length} to delete${readmeChanged ? ", README.md differs" : ""}` : "up to date");
    process.exit(diff ? 1 : 0);
  }
  fs.mkdirSync(ASSETS, { recursive: true });
  for (const name of changed) fs.writeFileSync(path.join(ASSETS, name), wanted.get(name));
  for (const name of stale) fs.unlinkSync(path.join(ASSETS, name));
  if (readmeChanged) fs.writeFileSync(README, out.readme);
  const biggest = out.files.reduce((a, f) => (f.bytes > a.bytes ? f : a));
  const heaviest = out.visits.reduce((a, v) => (v.bytes > a.bytes ? v : a));
  console.log(`${out.files.length} images (${changed.length} written, ${stale.length} deleted)${readmeChanged ? ", README.md written" : ""}`);
  console.log(`largest image ${biggest.base} ${(biggest.bytes / 1024).toFixed(1)} KB; heaviest visit ${heaviest.layout}/${heaviest.theme}${heaviest.reduce ? "/reduced" : ""} ${(heaviest.bytes / 1024).toFixed(1)} KB`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (e) { console.error(`generar: ${e.message}`); process.exit(1); }
}
