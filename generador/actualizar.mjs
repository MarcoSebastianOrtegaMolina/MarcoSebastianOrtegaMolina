#!/usr/bin/env node
// Updates the profile README from the CV. Downloads https://www.kairomx.tech/cv/perfil.json (kairomx-web
// writes it on every deploy, from the CV texts) and the cover of each featured project, checks all of
// it against the data contract (datos.mjs) and the whole build (every fit and size check of the
// generator), and only then writes datos/perfil.en.json, datos/perfil.es.json,
// generador/fuentes/proyectos/<slug>.webp, assets/ and both READMEs. Node 20 or later, no dependencies.
//
//   node generador/actualizar.mjs                  download and update
//   node generador/actualizar.mjs --from FILE      read the data file from FILE instead of the network
//                                                  (the covers are still downloaded)
//   node generador/actualizar.mjs --check          everything but writing; exits 1 if something would change
//   node generador/actualizar.mjs --message FILE   when something changes, also write a commit message
//                                                  that says what (used by the daily workflow)
//
// What comes from the site is data: it is parsed as JSON and never run, every text and link goes
// through the contract, and the covers must be WebP files under https://www.kairomx.tech/cv/evidencias/.
// Downloads have a time limit and a size cap, follow no redirects and only go to www.kairomx.tech.
// If anything fails it exits with an error and leaves every file as it was: everything is checked in
// memory first, and the writes go as one unit (if one fails, the files already written are put back).
//
// A CV text that does not fit (over its cap in the contract, or wider than its place in a layout) makes
// every daily run fail, on purpose, until the text is shortened in the CV: the error names the language,
// the field, how long it is and how much fits.
//
// The daily workflow (.github/workflows/actualizar-readme.yml):
// - Undoing a README change: `git revert` alone no longer works, because the next daily run rebuilds the
//   README from the CV. To undo for good, change the CV; or first turn the workflow off (Actions tab,
//   "Update README from the CV", "Disable workflow"), then revert.
// - GitHub turns scheduled workflows off by itself in a public repository after 60 days without any
//   activity in it. It shows in the Actions tab (the workflow is marked as disabled and no new runs
//   appear); to turn it back on, open it there and click "Enable workflow". Nothing commits just to
//   keep it alive.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate, LANGS } from "./datos.mjs";
import { build } from "./construir.mjs";
import { loadAll, plan, writeOps, applyAll, report, DATOS, FUENTES } from "./generar.mjs";
import { coverFrom } from "./proyectos.mjs";
import { MAX_DATA, MAX_COVER, FETCH_TIMEOUT_MS } from "./constantes.mjs";

export const DATA_URL = "https://www.kairomx.tech/cv/perfil.json";
export const COVER_PREFIX = "https://www.kairomx.tech/cv/evidencias/";
const HOST = "www.kairomx.tech";
const COVER_URL = /^https:\/\/www\.kairomx\.tech\/cv\/evidencias\/[a-z0-9][a-z0-9-]{0,39}\/[a-z0-9][a-z0-9-]{0,39}\.webp$/;
const COVERS_DIR = path.join(FUENTES, "proyectos");
const SHORTEN = ". Shorten that text in the CV (kairomx-web, public/cv/js/i18n/<lang>.js or public/cv/index.html)";

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
}

// One download: https on www.kairomx.tech only, no redirects, a time limit, the expected content type
// and at most `max` bytes (counted while reading, whatever the headers say).
async function download(url, type, max) {
  const u = new URL(url);
  if (u.protocol !== "https:" || u.hostname !== HOST || u.port) throw new Error(`${url}: only https://${HOST}/ is allowed`);
  let res;
  try {
    res = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { accept: type } });
  } catch (e) {
    const why = e && e.name === "TimeoutError" ? `no answer in ${FETCH_TIMEOUT_MS / 1000} s` : `${(e && e.cause && e.cause.code) || (e && e.message) || e}`;
    throw new Error(`${url}: could not download (${why})`);
  }
  if (res.status !== 200) throw new Error(`${url}: the site answered ${res.status}`);
  const got = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (got !== type) throw new Error(`${url}: content type "${got}", expected "${type}"`);
  const declared = Number(res.headers.get("content-length"));
  if (declared > max) throw new Error(`${url}: ${declared} bytes, the cap is ${max}`);
  const chunks = [];
  let total = 0;
  for await (const chunk of res.body) {
    total += chunk.length;
    if (total > max) throw new Error(`${url}: more than ${max} bytes, the cap`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function readLocal(file) {
  const size = fs.statSync(file).size;
  if (size > MAX_DATA) throw new Error(`${file}: ${size} bytes, the cap is ${MAX_DATA}`);
  return fs.readFileSync(file);
}

// The published file: { schema: 1, en: <contract>, es: <contract>, covers: { <slug>: <url> } }, where
// each contract has the shape of datos/perfil.<lang>.json. Returns the validated data of each language
// and the cover address of each featured project.
export function parseProfile(buf) {
  let text = buf.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  let raw;
  try { raw = JSON.parse(text); } catch (e) { throw new Error(`the data file is not valid JSON: ${e.message}`); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("the data file must be an object");
  const keys = ["schema", ...LANGS, "covers"];
  for (const k of keys) if (!(k in raw)) throw new Error(`the data file has no "${k}"`);
  for (const k of Object.keys(raw)) if (!keys.includes(k)) throw new Error(`the data file has an unknown field "${k}"`);
  if (raw.schema !== 1) throw new Error("schema: expected 1");
  const datas = {};
  for (const lang of LANGS) {
    let d;
    try { d = validate(raw[lang]); } catch (e) { throw new Error(`${lang}: ${e.message}${/the cap is/.test(e.message) ? SHORTEN : ""}`); }
    if (d.lang !== lang) throw new Error(`${lang}: the block says lang "${d.lang}"; it must be "${lang}"`);
    datas[lang] = d;
  }
  const featured = (lang) => datas[lang].projects.filter((p) => p.featured).map((p) => p.slug);
  if (featured("en").join() !== featured("es").join()) throw new Error(`projects: the featured projects differ between languages (${featured("en").join(", ")} / ${featured("es").join(", ")})`);
  const c = raw.covers;
  if (!c || typeof c !== "object" || Array.isArray(c)) throw new Error("covers: expected an object");
  const covers = {};
  for (const slug of featured("en")) {
    if (!(slug in c)) throw new Error(`covers: no cover for "${slug}"`);
    const url = c[slug];
    if (typeof url !== "string" || !COVER_URL.test(url)) throw new Error(`covers.${slug}: a cover must be a .webp file inside ${COVER_PREFIX}<folder>/`);
    covers[slug] = url;
  }
  for (const k of Object.keys(c)) if (!(k in covers)) throw new Error(`covers: "${k}" is not a featured project`);
  return { datas, covers };
}

// datos/perfil.<lang>.json as it is written by hand: two spaces, lists one item per line, and every
// object whose values are all plain (a tab, a part, a project) on a single line.
export function formatData(v, depth = 0) {
  const plain = (x) => !x || typeof x !== "object";
  if (plain(v)) return JSON.stringify(v);
  const pad = "  ".repeat(depth + 1), end = "  ".repeat(depth);
  if (Array.isArray(v)) return `[\n${v.map((x) => pad + formatData(x, depth + 1)).join(",\n")}\n${end}]`;
  const entries = Object.entries(v);
  if (depth > 0 && entries.every(([, x]) => plain(x))) return `{ ${entries.map(([k, x]) => `${JSON.stringify(k)}: ${JSON.stringify(x)}`).join(", ")} }`;
  return `{\n${entries.map(([k, x]) => `${pad}${JSON.stringify(k)}: ${formatData(x, depth + 1)}`).join(",\n")}\n${end}}`;
}
export const dataText = (d) => formatData({ schema: 1, ...d }) + "\n";

// Paths of the fields that differ between two versions of a data file ("hero.role", "tabs[1].label").
function changedFields(a, b, where = "", out = []) {
  if (a && b && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) changedFields(a[k], b[k], Array.isArray(a) ? `${where}[${k}]` : where ? `${where}.${k}` : k, out);
  } else if (JSON.stringify(a) !== JSON.stringify(b)) out.push(where || "(whole file)");
  return out;
}

async function main() {
  const from = arg("--from"), check = process.argv.includes("--check"), messageFile = arg("--message");
  const { datas, covers } = parseProfile(from ? readLocal(from) : await download(DATA_URL, "application/json", MAX_DATA));
  const coverFiles = {};
  for (const [slug, url] of Object.entries(covers)) {
    const buf = await download(url, "image/webp", MAX_COVER);
    try { coverFrom(buf); } catch (e) { throw new Error(`${url}: ${e.message}`); }
    coverFiles[slug] = buf;
  }
  // The whole build, in memory, with the new data and covers: every fit and size check runs here.
  const src = { ...loadAll(), covers: Object.fromEntries(Object.entries(coverFiles).map(([slug, buf]) => [slug, coverFrom(buf)])) };
  let out;
  try { out = build(datas, src); } catch (e) { throw new Error(`${e.message}${/ fit|tall for/.test(e.message) ? SHORTEN : ""}`); }
  // What would change.
  const data = LANGS.map((lang) => ({ lang, file: path.join(DATOS, `perfil.${lang}.json`), text: dataText(datas[lang]) }))
    .filter((d) => !fs.existsSync(d.file) || fs.readFileSync(d.file, "utf8") !== d.text);
  const onDisk = fs.existsSync(COVERS_DIR) ? fs.readdirSync(COVERS_DIR).filter((f) => f.endsWith(".webp")) : [];
  const newCovers = Object.keys(coverFiles).filter((slug) => { const f = path.join(COVERS_DIR, `${slug}.webp`); return !fs.existsSync(f) || !fs.readFileSync(f).equals(coverFiles[slug]); });
  const oldCovers = onDisk.filter((f) => !(f.replace(/\.webp$/, "") in coverFiles));
  const p = plan(out);
  const fields = data.flatMap((d) => {
    let before = null;
    try { before = JSON.parse(fs.readFileSync(d.file, "utf8")); } catch { /* missing or unreadable: the whole file changes */ }
    return changedFields(before, JSON.parse(d.text)).map((f) => `${d.lang} ${f}`);
  });
  const count = data.length + newCovers.length + oldCovers.length + p.changed.length + p.stale.length + p.readmes.length;
  const summary = [
    fields.length ? `data: ${fields.slice(0, 12).join(", ")}${fields.length > 12 ? ` and ${fields.length - 12} more` : ""}` : null,
    newCovers.length ? `covers: ${newCovers.join(", ")}` : null,
    oldCovers.length ? `covers removed: ${oldCovers.join(", ")}` : null,
    p.changed.length || p.stale.length ? `images: ${p.changed.length} new, ${p.stale.length} removed` : null,
    p.readmes.length ? `${p.readmes.join(" and ")}` : null,
  ].filter(Boolean);
  if (check) {
    console.log(count ? `out of date: ${summary.join("; ")}` : "up to date");
    process.exit(count ? 1 : 0);
  }
  applyAll([
    ...data.map((d) => ({ file: d.file, content: d.text })),
    ...newCovers.map((slug) => ({ file: path.join(COVERS_DIR, `${slug}.webp`), content: coverFiles[slug] })),
    ...oldCovers.map((f) => ({ file: path.join(COVERS_DIR, f), content: null })),
    ...writeOps(out, p),
  ]);
  report(out, p);
  console.log(count ? `updated: ${summary.join("; ")}` : "up to date: nothing changed");
  if (messageFile && count) fs.writeFileSync(messageFile, `chore(readme): update from the CV\n\n${summary.map((s) => `- ${s}`).join("\n")}\n\nSource: ${from ? "a local file" : DATA_URL}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(`actualizar: ${e.message}`); process.exit(1); });
}
