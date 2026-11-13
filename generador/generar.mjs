#!/usr/bin/env node
// Generates the profile README in two languages: reads datos/perfil.en.json, datos/perfil.es.json and
// generador/fuentes/, writes assets/*.svg, README.md and README.es.md. Node 20 or later, no dependencies.
//
//   node generador/generar.mjs                 build and write
//   node generador/generar.mjs --datos FILE    use FILE for the language it declares ("-" reads stdin)
//   node generador/generar.mjs --check         build and compare with the files on disk; writes nothing
//   node generador/generar.mjs --validate      build only (data contract and every fit check); writes nothing
//
// If the data does not meet the contract or any check fails, it exits with an error and leaves every
// file as it was. File names carry a short hash of their content, so GitHub's image cache never
// serves an old version; images that are no longer used are deleted.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate, LANGS } from "./datos.mjs";
import { loadSources } from "./cabecera.mjs";
import { loadLogos } from "./tira.mjs";
import { loadCovers } from "./proyectos.mjs";
import { build, README_FILE } from "./construir.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const ASSETS = path.join(root, "assets");

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
}

export function readData(file) {
  const text = file === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(file, "utf8");
  // A byte order mark at the start is not part of the JSON: it is dropped.
  const json = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  let raw;
  try { raw = JSON.parse(json); } catch (e) { throw new Error(`the data file is not valid JSON: ${e.message}`); }
  return validate(raw);
}

export function loadAll() {
  const fuentes = path.join(here, "fuentes");
  return { ...loadSources(fuentes), logos: loadLogos(path.join(fuentes, "stack")), covers: loadCovers(path.join(fuentes, "proyectos")) };
}

// override: a data file (or "-") that replaces the file of the language it declares.
export function buildFromDisk(override = null) {
  const datas = {};
  for (const lang of LANGS) {
    const d = readData(path.join(root, `datos/perfil.${lang}.json`));
    if (d.lang !== lang) throw new Error(`datos/perfil.${lang}.json declares lang "${d.lang}"`);
    datas[lang] = d;
  }
  if (override) { const d = readData(override); datas[d.lang] = d; }
  return build(datas, loadAll());
}

function main() {
  const check = process.argv.includes("--check"), only = process.argv.includes("--validate");
  const out = buildFromDisk(arg("--datos"));
  if (only) { console.log(`valid: ${out.files.length} images, ${Object.keys(out.readmes).join(" and ")}`); return; }
  const wanted = new Map(out.files.map((f) => [f.name, f.content]));
  const onDisk = fs.existsSync(ASSETS) ? fs.readdirSync(ASSETS).filter((f) => f.endsWith(".svg")) : [];
  const stale = onDisk.filter((f) => !wanted.has(f));
  const changed = [...wanted].filter(([name, content]) => !fs.existsSync(path.join(ASSETS, name)) || fs.readFileSync(path.join(ASSETS, name), "utf8") !== content).map(([name]) => name);
  const readmes = Object.entries(out.readmes).filter(([file, text]) => !fs.existsSync(path.join(root, file)) || fs.readFileSync(path.join(root, file), "utf8") !== text).map(([file]) => file);
  if (check) {
    const diff = changed.length + stale.length + readmes.length;
    console.log(diff ? `out of date: ${changed.length} images to write, ${stale.length} to delete${readmes.length ? `, ${readmes.join(" and ")} differ` : ""}` : "up to date");
    process.exit(diff ? 1 : 0);
  }
  fs.mkdirSync(ASSETS, { recursive: true });
  for (const name of changed) fs.writeFileSync(path.join(ASSETS, name), wanted.get(name));
  for (const name of stale) fs.unlinkSync(path.join(ASSETS, name));
  for (const file of readmes) fs.writeFileSync(path.join(root, file), out.readmes[file]);
  const biggest = out.files.reduce((a, f) => (f.bytes > a.bytes ? f : a));
  const heaviest = out.visits.reduce((a, v) => (v.bytes > a.bytes ? v : a));
  console.log(`${out.files.length} images (${changed.length} written, ${stale.length} deleted)${readmes.length ? `, ${readmes.join(" and ")} written` : ""}`);
  console.log(`largest image ${biggest.base} ${(biggest.bytes / 1024).toFixed(1)} KB; heaviest visit ${heaviest.lang}/${heaviest.layout}/${heaviest.theme}${heaviest.reduce ? "/reduced" : ""} ${(heaviest.bytes / 1024).toFixed(1)} KB`);
}

export { README_FILE };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (e) { console.error(`generar: ${e.message}`); process.exit(1); }
}
