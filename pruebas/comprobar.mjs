// Static checks of the generated README (both languages). No dependencies, no network, and it writes
// nothing: every generator run below is --check or --validate, and the last check compares a hash of
// the whole tree (but .git) before and after.
//   node pruebas/comprobar.mjs
// 1. The generator, run in memory, gives exactly the files on disk.
// 2. Broken data files make the generator fail without touching any file (one case each).
// 3. Every SVG is well-formed XML, has no http(s) address other than the SVG namespace, no <script>,
//    no foreignObject, no on* attributes, embeds images only as data:image/jpeg or data:image/webp,
//    and stays within the size caps of generador/constantes.mjs; every link in the READMEs starts with
//    https://www.kairomx.tech/ (but the relative link between the two) and every image they use exists.
// Also: legibility and height per composition, M1 (texts that do not fit), M2 (shared numbers in one
// place), data (text direction, emoji, invisible characters, byte order mark), 6 (buttons), 7
// (leftovers) and N1 (the checks leave the tree as it was).
// Daily update: U1 (each embedded cover is the CV's WebP byte for byte), U2 (the data files are in the
// format generador/actualizar.mjs writes), U3 (actualizar.mjs with today's data changes nothing; with
// broken data or the network down it fails, says why and changes nothing; offline, through
// pruebas/red-falsa.mjs) and U4 (the workflow: pinned actions, least permissions, concurrency).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = path.join(root, "assets");
const results = [];
const walkAll = (d) => fs.readdirSync(path.join(root, d)).flatMap((f) => { const p = d ? `${d}/${f}` : f; return f === ".git" || f === "_trabajo" ? [] : fs.statSync(path.join(root, p)).isDirectory() ? walkAll(p) : [p]; });
const treeHash = () => { const h = crypto.createHash("sha256"); for (const f of walkAll("").sort()) h.update(f + "\0").update(fs.readFileSync(path.join(root, f))); return h.digest("hex"); };
const treeBefore = treeHash();
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); };

// ---------- minimal XML well-formedness check (elements, attributes, entities, nesting) ----------
function wellFormed(xml) {
  let i = 0, roots = 0;
  const stack = [];
  const entity = /^&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/;
  const name = /^[A-Za-z_:][\w.:-]*/;
  if (xml.startsWith("﻿")) return "byte order mark";
  while (i < xml.length) {
    const c = xml[i];
    if (c === "<") {
      if (xml.startsWith("<!--", i)) { const e = xml.indexOf("-->", i + 4); if (e < 0) return "unclosed comment"; i = e + 3; continue; }
      if (xml.startsWith("<?", i)) { const e = xml.indexOf("?>", i + 2); if (e < 0) return "unclosed declaration"; i = e + 2; continue; }
      if (xml.startsWith("<![CDATA[", i)) { const e = xml.indexOf("]]>", i); if (e < 0) return "unclosed CDATA"; i = e + 3; continue; }
      if (xml[i + 1] === "/") {
        const m = xml.slice(i + 2).match(name);
        if (!m) return `bad end tag at ${i}`;
        const top = stack.pop();
        if (top !== m[0]) return `</${m[0]}> closes <${top}> at ${i}`;
        i += 2 + m[0].length;
        while (/\s/.test(xml[i])) i++;
        if (xml[i] !== ">") return `bad end tag at ${i}`;
        i++;
        continue;
      }
      const m = xml.slice(i + 1).match(name);
      if (!m) return `bad start tag at ${i}`;
      if (!stack.length && ++roots > 1) return "more than one root element";
      i += 1 + m[0].length;
      const seen = new Set();
      for (;;) {
        const ws = xml.slice(i).match(/^\s*/)[0].length;
        i += ws;
        if (xml.startsWith("/>", i)) { i += 2; break; }
        if (xml[i] === ">") { stack.push(m[0]); i++; break; }
        if (!ws) return `missing space before attribute at ${i}`;
        const a = xml.slice(i).match(/^([A-Za-z_:][\w.:-]*)\s*=\s*("([^"<]*)"|'([^'<]*)')/);
        if (!a) return `bad attribute at ${i}`;
        if (seen.has(a[1])) return `duplicate attribute ${a[1]} at ${i}`;
        seen.add(a[1]);
        const val = a[3] ?? a[4];
        for (let k = val.indexOf("&"); k >= 0; k = val.indexOf("&", k + 1)) if (!entity.test(val.slice(k))) return `bad entity in attribute at ${i}`;
        i += a[0].length;
      }
      continue;
    }
    if (c === "&") { if (!entity.test(xml.slice(i))) return `bad entity at ${i}`; }
    else if (!stack.length && !/\s/.test(c)) return `text outside the root element at ${i}`;
    i++;
  }
  if (stack.length) return `unclosed <${stack[stack.length - 1]}>`;
  if (!roots) return "no root element";
  return null;
}

// The XML check itself must reject broken samples, or a pass below would mean nothing.
const samples = ["<svg><g></svg>", '<svg a="1" a="2"/>', "<svg>&nbsp;</svg>", "<svg/><svg/>"];
check("3. the XML check rejects broken samples", samples.every((x) => wellFormed(x)) && !wellFormed('<svg a="&amp;"><g/></svg>'), samples.map((x) => wellFormed(x)).join("; "));

// Shared constants. Without them the size, breakpoint and legibility checks cannot run and fail.
const C = await import(pathToFileURL(path.join(root, "generador/constantes.mjs")).href).catch(() => null);
check("M2. the constants module exists and the tests read it", !!C, C ? "generador/constantes.mjs" : "generador/constantes.mjs is missing");
const gen = await import(pathToFileURL(path.join(root, "generador/generar.mjs")).href);
const built = gen.buildFromDisk();

// ---------- 1. regeneration matches the files on disk ----------
const regen = spawnSync(process.execPath, [path.join(root, "generador/generar.mjs"), "--check"], { encoding: "utf8" });
check("1. generator output equals the files on disk", regen.status === 0, regen.stdout.trim() || regen.stderr.trim());

// ---------- 2 and data: broken data makes the generator fail and change nothing ----------
// The generator runs with --validate: it builds everything in memory and writes nothing, so even a
// case it wrongly accepted could not touch the tree.
function snapshot() {
  const h = crypto.createHash("sha256");
  const files = ["README.md", "README.es.md", ...fs.readdirSync(ASSETS).sort().map((f) => "assets/" + f)];
  for (const f of files) h.update(f + "\0").update(fs.readFileSync(path.join(root, f)));
  return h.digest("hex");
}
const good = { en: JSON.parse(fs.readFileSync(path.join(root, "datos/perfil.en.json"), "utf8")), es: JSON.parse(fs.readFileSync(path.join(root, "datos/perfil.es.json"), "utf8")) };
const run = (input, mode = "--validate") => spawnSync(process.execPath, [path.join(root, "generador/generar.mjs"), "--datos", "-", mode], { input, encoding: "utf8" });
// Each case: how to break the data, a word the error message must contain, and the language.
const broken = {
  "link outside kairomx.tech": [(d) => { d.tabs[1].href = "https://example.com/cv/"; }, "links must start"],
  "text over its cap": [(d) => { d.hero.name = "M".repeat(41); }, "the cap is 40"],
  "missing field": [(d) => { delete d.hero.role; }, 'missing field "role"'],
  "<script> inside a text": [(d) => { d.buttons[0].label = "<script>"; }, "markup"],
  "unknown field": [(d) => { d.extra = "x"; }, 'unknown field "extra"'],
  "not JSON": [null, "not valid JSON"],
  "unknown language": [(d) => { d.lang = "fr"; }, "profile.lang"],
  "stack link outside kairomx.tech": [(d) => { d.stack.href = "https://example.com/"; }, "stack.href"],
  "stack with 15 logos": [(d) => { d.stack.items.pop(); }, "expected 16 items"],
  "stack logo without a file": [(d) => { d.stack.items[3].id = "angular"; }, 'no logo file for "angular"'],
  "stack logo twice": [(d) => { d.stack.items[1].id = d.stack.items[0].id; }, "appears twice"],
  "two featured projects": [(d) => { d.projects[2].featured = false; }, "2 marked as featured"],
  "project link outside kairomx.tech": [(d) => { d.projects[0].href = "https://example.com/p.html"; }, "projects[0].href"],
  "project title over its cap": [(d) => { d.projects[1].title = "W".repeat(61); }, "the cap is 60"],
  "project without a cover": [(d) => { d.projects[0].slug = "otro"; }, 'no cover for "otro"'],
  "project missing field": [(d) => { delete d.projects[2].sub; }, 'missing field "sub"'],
  // B4: every link carries the language of its file.
  "B4 English project link in the Spanish file": [(d) => { d.projects[0].href = d.projects[0].href.replace("lang=es", "lang=en"); }, "projects[0].href: the link says lang=en", "es"],
  "B4 Spanish tab link in the English file": [(d) => { d.tabs[2].href = d.tabs[2].href.replace("lang=en", "lang=es"); }, "tabs[2].href: the link says lang=es", "en"],
  "B4 English PDF in the Spanish file": [(d) => { d.buttons[2].href = "https://www.kairomx.tech/cv/pdf/cv-en.pdf"; }, "the PDF is cv-en.pdf", "es"],
  "B4 link without lang": [(d) => { d.stack.href = "https://www.kairomx.tech/cv/index.html#stack"; }, "no lang", "en"],
  // M1: texts at their cap that do not fit their place in some layout.
  "M1 window title at its cap": [(d) => { d.window.title = "W".repeat(24); d.window.titleAccent = "W".repeat(8); }, "window.title"],
  "M1 tab label at its cap": [(d) => { d.tabs[3].label = "W".repeat(12); }, "tabs["],
  "M1 button label at its cap": [(d) => { d.buttons[1].label = "W".repeat(16); }, "buttons[1].label"],
  "M1 name at its cap": [(d) => { d.hero.name = "W".repeat(40); }, "hero.name"],
  "M1 role at its cap": [(d) => { d.hero.role = "W".repeat(48); }, "hero.role"],
  "M1 title line at its cap": [(d) => { d.hero.titleLine1 = { lead: "W".repeat(12), accent: "W".repeat(12) }; }, "hero.titleLine1"],
  "M1 pitch at its cap": [(d) => { d.hero.pitch = [{ text: "WWWWWWWWW ".repeat(11).trim(), strong: false }]; }, "hero.pitch"],
  "M1 status at its cap": [(d) => { d.status.parts = [{ text: "W".repeat(40), strong: false }]; }, "status.parts"],
  "M1 project window title at its cap": [(d) => { d.projects[0].window = "W".repeat(16); }, "projects[0].window"],
  "M1 Spanish tab label at its cap": [(d) => { d.tabs[4].label = "W".repeat(12); }, "tabs[", "es"],
  // Data: direction controls, invisible characters and emoji are rejected.
  "U+202E text direction": [(d) => { d.hero.name = "Marco \u202eanilom"; }, "text direction"],
  "U+200B zero width space": [(d) => { d.hero.name = "Marco\u200bSebastián"; }, "invisible format characters"],
  "emoji": [(d) => { d.tabs[0].label = "Home \u{1F3E0}"; }, "emoji"],
  "check mark U+2713": [(d) => { d.status.parts[1].text = "remote \u2713"; }, "pictographs"],
  "emoji in Spanish data": [(d) => { d.projects[1].sub = "Fugas \u{1F4A7}"; }, "emoji", "es"],
};
for (const [label, [mutate, word, lang = "en"]] of Object.entries(broken)) {
  const before = snapshot();
  let input = "{ not json";
  if (mutate) { const d = structuredClone(good[lang]); mutate(d); input = JSON.stringify(d); }
  const r = run(input);
  const after = snapshot();
  const msg = r.stderr.trim();
  const tag = label.startsWith("M1") ? "2/M1" : label.startsWith("B4") ? "B4" : /U\+|emoji|check mark/.test(label) ? "data" : "2";
  check(`${tag}. broken data, ${label}: fails with a clear message and changes nothing`, r.status !== 0 && before === after && msg.includes(word), `exit ${r.status}; ${msg || r.stdout.trim()}`);
}
// Ordinary text that the symbol filter must accept: accents, ñ, typographic quotes, the middle dot, © ® ™.
{
  const d = structuredClone(good.es);
  d.hero.alt = "Marco Sebastián Ortega Molina · «niño» “año” ‘sí’ © ® ™ ¿qué? ¡sí!";
  const r = run(JSON.stringify(d));
  check("data. accents, ñ, quotes, middle dot, © ® ™ are accepted", r.status === 0, `exit ${r.status}; ${(r.stderr || r.stdout).trim()}`);
}
for (const lang of ["en", "es"]) {
  const before = snapshot();
  const r = run("\ufeff" + JSON.stringify(good[lang]), "--check");
  check(`data. valid ${lang} JSON with a byte order mark is accepted and gives the same files`, r.status === 0 && snapshot() === before, `exit ${r.status}; ${(r.stderr || r.stdout).trim()}`);
}

// ---------- 3. the SVG files ----------
// The only images an SVG may embed: a JPEG or a WebP written into the file itself.
const imageOk = (href) => /^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(href);
{
  const yes = ["data:image/webp;base64,UklGRg==", "data:image/jpeg;base64,/9j/4A=="], no = ["data:image/png;base64,iVBORw==", "data:image/svg+xml;base64,PHN2Zz4=", "https://example.com/a.webp", "a.webp", "data:text/html;base64,PGI+"];
  check("3. the embedded-image rule accepts JPEG and WebP data and rejects anything else", yes.every(imageOk) && !no.some(imageOk), `${yes.filter((h) => !imageOk(h)).length + no.filter(imageOk).length} wrong of ${yes.length + no.length}`);
}
const svgs = fs.readdirSync(ASSETS).filter((f) => f.endsWith(".svg")).sort();
let worst = { f: null, bytes: 0 };
const bad = [];
for (const f of svgs) {
  const s = fs.readFileSync(path.join(ASSETS, f), "utf8");
  const bytes = Buffer.byteLength(s);
  if (bytes > worst.bytes) worst = { f, bytes };
  const wf = wellFormed(s);
  const http = (s.match(/https?:\/\//gi) || []).length - (s.match(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g) || []).length;
  const tags = s.match(/<[^>]*>/g) || [];
  const onAttr = tags.filter((t) => /\son[a-z]+\s*=/i.test(t)).length;
  const images = [...s.matchAll(/<image\b[^>]*\shref="([^"]*)"/g)].map((m) => m[1]);
  const badImages = images.filter((h) => !imageOk(h)).length + (s.match(/<image\b/g) || []).length - images.length;
  const problems = [wf && `not well-formed: ${wf}`, badImages && `${badImages} images that are not data:image/jpeg or webp`, http && `${http} http addresses`, /<script/i.test(s) && "<script>", /foreignObject/i.test(s) && "foreignObject", onAttr && `${onAttr} on* attributes`, (!C || bytes > C.MAX_SVG) && `${(bytes / 1024).toFixed(1)} KB`].filter(Boolean);
  if (problems.length) bad.push(`${f}: ${problems.join(", ")}`);
}
check(`3. ${svgs.length} SVG: well-formed, no http but the namespace, no script, foreignObject or on*, embedded images only JPEG or WebP, within the size cap`, svgs.length > 0 && !bad.length, bad.length ? bad.slice(0, 3).join("; ") : `largest ${worst.f} ${(worst.bytes / 1024).toFixed(1)} KB`);

// ---------- 3. the READMEs ----------
const readmes = Object.fromEntries(["README.md", "README.es.md"].map((f) => [f, fs.readFileSync(path.join(root, f), "utf8")]));
const OTHER = { "README.md": "README.es.md", "README.es.md": "README.md" };
const used = new Set();
for (const [file, readme] of Object.entries(readmes)) {
  const hrefs = [...readme.matchAll(/href="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  const outside = hrefs.filter((h) => !h.startsWith("https://www.kairomx.tech/") && h !== OTHER[file]);
  const lang = file === "README.md" ? "en" : "es";
  const wrongLang = hrefs.filter((h) => h.startsWith("https://www.kairomx.tech/") && !(h.includes(`lang=${lang}`) || h.endsWith(`cv-${lang}.pdf`)));
  check(`3. ${file}: ${hrefs.length} links, all inside https://www.kairomx.tech/ with lang=${lang} but the relative link to ${OTHER[file]}`, hrefs.length > 0 && !outside.length && !wrongLang.length && hrefs.includes(OTHER[file]), [...outside, ...wrongLang].join(", "));
  for (const m of readme.matchAll(/(?:src|srcset)="assets\/([^"]+)"/g)) used.add(m[1]);
}
const missing = [...used].filter((f) => !svgs.includes(f));
const orphans = svgs.filter((f) => !used.has(f));
check("3. every image the READMEs use exists and no image is unused", !missing.length && !orphans.length, `${used.size} used${missing.length ? `; missing ${missing.join(", ")}` : ""}${orphans.length ? `; unused ${orphans.join(", ")}` : ""}`);

// One visit: for each language, composition, theme and reduced-motion setting, the first matching
// source of each <picture> (or its <img>), summed.
const matches = (media, env) => media.split(" and ").every((q) =>
  q === "(prefers-color-scheme: dark)" ? env.dark : q === "(prefers-reduced-motion: reduce)" ? env.reduce : /^\(max-width: (\d+)px\)$/.test(q) ? env.width <= +q.match(/\d+/)[0] : (() => { throw new Error("unknown media " + q); })());
if (C) {
  let heaviest = { bytes: 0 }, count = 0;
  for (const [file, readme] of Object.entries(readmes)) {
    const pictures = [...readme.matchAll(/<picture>(.*?)<\/picture>/g)].map((m) => ({
      sources: [...m[1].matchAll(/<source media="([^"]+)" srcset="assets\/([^"]+)" width="[\d.]+%">/g)].map((x) => ({ media: x[1], file: x[2] })),
      img: m[1].match(/<img [^>]*src="assets\/([^"]+)"/)[1],
    }));
    count = pictures.length;
    for (const layout of C.LAYOUT_ORDER) for (const dark of [true, false]) for (const reduce of [true, false]) {
      const env = { width: Math.min(C.LAYOUTS[layout].lastViewport, C.SWEEP.to), dark, reduce };
      const files = pictures.map((p) => (p.sources.find((x) => matches(x.media, env)) || { file: p.img }).file);
      const bytes = files.reduce((t, f) => t + (fs.existsSync(path.join(ASSETS, f)) ? fs.statSync(path.join(ASSETS, f)).size : Infinity), 0);
      if (bytes > heaviest.bytes) heaviest = { bytes, file, env };
    }
  }
  check(`3. one visit loads ${C.MAX_VISIT / 1048576} MB or less (${count} pictures per README)`, heaviest.bytes <= C.MAX_VISIT, `heaviest ${(heaviest.bytes / 1024).toFixed(1)} KB, ${heaviest.file} at ${JSON.stringify(heaviest.env)}`);
} else check("3. one visit within the cap", false, "constants missing");

// No e-mail addresses or emojis in what the generator writes or reads.
const texts = [...Object.values(readmes), ...["en", "es"].map((l) => fs.readFileSync(path.join(root, `datos/perfil.${l}.json`), "utf8"))];
const mail = texts.some((t) => /[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(t));
const emoji = texts.concat(svgs.map((f) => fs.readFileSync(path.join(ASSETS, f), "utf8"))).some((t) => /\p{Extended_Pictographic}/u.test(t.replace(/[\u00a9\u00ae\u2122]/g, "")));
check("3. no e-mail address or emoji in the READMEs, the data or the images", !mail && !emoji, `${mail ? "e-mail found " : ""}${emoji ? "emoji found" : ""}`);

// ---------- 1. legibility and height of every composition (from the build) ----------
if (C) {
  const problems = [], worst = {};
  for (const f of built.files) {
    if (!f.texts.length) continue;
    const min = Math.min(...f.texts.map((t) => t.size));
    for (let v = C.SWEEP.from; v <= C.SWEEP.to; v++) if (C.layoutFor(v) === f.layout) {
      const px = min * (f.pct / 100) * C.githubColumn(v) / f.viewW;
      const k = `${f.lang}-${f.section}`;
      if (!worst[k] || px - C.minTextPx(v) < worst[k].px - worst[k].need) worst[k] = { px: +px.toFixed(2), need: C.minTextPx(v), v, file: f.base };
      if (px < C.minTextPx(v)) problems.push(`${f.base} at ${v} px: ${px.toFixed(2)} px`);
    }
  }
  for (const [lang, r] of Object.entries(built.langs)) for (const layout of C.LAYOUT_ORDER) {
    const s = r.sizes[layout];
    if (layout !== "mob" && s.height / s.width > C.MAX_HEIGHT_RATIO) problems.push(`${lang} ${layout} is ${(s.height / s.width).toFixed(2)} times as tall as wide`);
  }
  check("1. smallest text on screen at every viewport from 320 to 1400 px, every image of both languages, and height of each header composition (computed)", !problems.length, problems.slice(0, 4).join("; ") || JSON.stringify(worst));
} else check("1. smallest text and height per composition (computed)", false, "constants missing");

// ---------- 6. the three buttons share one structure in every composition ----------
// The label block of each button is centred at the same height (a one-word label sits in the middle
// of a two-line block).
{
  const per = {};
  for (const f of built.files.filter((f) => f.row === "buttons" && f.theme === "dark")) {
    const ys = f.texts.filter((t) => t.label.startsWith("button")).map((t) => (t.y0 + t.y1) / 2);
    (per[`${f.lang}-${f.layout}`] ||= []).push(+(ys.reduce((a, b) => a + b, 0) / ys.length).toFixed(2));
  }
  const uneven = Object.entries(per).filter(([, v]) => new Set(v).size > 1);
  check("6. the three button labels sit at the same height in each composition and language", Object.keys(per).length === 6 && !uneven.length, JSON.stringify(per));
}

// ---------- M2: no shared number written by hand outside generador/constantes.mjs ----------
// Versioned files; outside a git checkout of its own (a git archive copy), every file.
const walk = (d) => fs.readdirSync(path.join(root, d)).flatMap((f) => { const p = d ? `${d}/${f}` : f; return fs.statSync(path.join(root, p)).isDirectory() ? (f === ".git" ? [] : walk(p)) : [p]; });
const inGit = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: root, encoding: "utf8" }).stdout.trim();
const ownCheckout = inGit && path.resolve(inGit) === path.resolve(root);
const listed = ownCheckout ? spawnSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).stdout.split("\n").filter(Boolean) : walk("");
const tracked = listed.filter((f) => /\.(mjs|cjs|js|json|md|svg|txt)$/.test(f) && !f.startsWith("assets/") && !f.startsWith("generador/fuentes/fonts/"));
if (C) {
  // Breakpoints (today's and the one before, 767) and the size caps, however they are written.
  const edges = C.LAYOUT_ORDER.map((l) => C.LAYOUTS[l].lastViewport).filter(Number.isFinite);
  const patterns = [767, ...edges, ...edges.map((e) => e + 1), C.MAX_SVG, C.MAX_VISIT, C.MAX_VISIT / 1024]
    .map((v) => new RegExp(`(?<![\\w.])${v}(?![\\w.])`)).concat([/\d+\s*\*\s*1024/, /\b600\s*KB/i]);
  const hits = [];
  for (const f of tracked.filter((f) => /\.(mjs|cjs)$/.test(f) && !["generador/constantes.mjs", "pruebas/comprobar.mjs"].includes(f))) {
    fs.readFileSync(path.join(root, f), "utf8").split("\n").forEach((l, i) => { const p = patterns.find((re) => re.test(l)); if (p) hits.push(`${f}:${i + 1} (${l.match(p)[0]})`); });
  }
  const readers = ["pruebas/comprobar.mjs", "pruebas/medir.cjs", "generador/construir.mjs"].filter((f) => !fs.readFileSync(path.join(root, f), "utf8").includes("constantes.mjs"));
  check("M2. breakpoints (and the first width past each) and caps live only in generador/constantes.mjs, and the tests read them from there", !hits.length && !readers.length, [...hits, ...readers.map((r) => `${r} does not read it`)].join(", "));
} else check("M2. breakpoints and caps live in one place", false, "constants missing");

// ---------- 7. no internal leftovers in what is versioned ----------
{
  const leftovers = [];
  for (const f of tracked) {
    const s = fs.readFileSync(path.join(root, f), "utf8");
    if (/_trabajo|piloto|\bpilot\b|boceto|\bD-\d{3,}/i.test(s) && ![".gitignore", "pruebas/comprobar.mjs"].includes(f)) leftovers.push(f);
    if (f.endsWith(".svg") && s.includes("<!--")) leftovers.push(`${f} (comment)`);
    // Named imports that the file never uses.
    if (/\.(mjs|cjs)$/.test(f)) for (const m of s.matchAll(/import\s*\{([^}]*)\}\s*from/g)) for (const name of m[1].split(",").map((x) => x.trim().split(/\s+as\s+/).pop()).filter(Boolean)) {
      if ((s.match(new RegExp(`\\b${name}\\b`, "g")) || []).length < 2) leftovers.push(`${f} (unused import ${name})`);
    }
  }
  const ignore = fs.existsSync(path.join(root, ".gitignore")) && /^_trabajo\/$/m.test(fs.readFileSync(path.join(root, ".gitignore"), "utf8"));
  check("7. no internal leftovers or unused imports in versioned files, and .gitignore keeps _trabajo/ out", !leftovers.length && ignore, `${leftovers.join(", ")}${ignore ? "" : "; .gitignore without _trabajo/"}`);
}

// ---------- M3: the middle layout keeps the approved buttons ----------
// One label line per button (icon above), at least 9 units between the label and each side of its
// button, and the header as tall as the approved one (387 units in ae1a6a3) in English.
{
  const problems = [];
  for (const f of built.files.filter((f) => f.row === "buttons" && f.layout === "tab" && f.theme === "dark")) {
    const lines = f.texts.filter((t) => t.label.startsWith("button"));
    if (lines.length !== 1) problems.push(`${f.base}: ${lines.length} label lines`);
    if (!f.button) { problems.push(`${f.base}: no button geometry`); continue; }
    for (const t of lines) for (const r of t.runs) {
      const side = Math.min(r.x0 - f.button.x, f.button.x + f.button.w - r.x1);
      if (side < 9 - 0.01) problems.push(`${f.base}: ${side.toFixed(1)} units to the side`);
    }
  }
  const h = built.langs.en.sizes.tab.height;
  if (h !== 387) problems.push(`English middle header ${h} units tall (approved: 387)`);
  check("M3. middle layout: one label line per button, 9 units or more to each side, English header 387 units tall", !problems.length, problems.slice(0, 4).join("; ") || "6 buttons");
}

// ---------- U1: each embedded cover is the CV's own WebP, byte for byte ----------
{
  const problems = [];
  const dir = path.join(root, "generador/fuentes/proyectos");
  for (const f of built.files.filter((f) => f.section === "projects")) {
    const m = f.content.match(/href="data:image\/webp;base64,([^"]+)"/);
    const file = path.join(dir, `${f.cover.slug}.webp`);
    if (!m) problems.push(`${f.base}: no WebP cover`);
    else if (!fs.existsSync(file) || !Buffer.from(m[1], "base64").equals(fs.readFileSync(file))) problems.push(`${f.base}: differs from ${f.cover.slug}.webp`);
  }
  const extra = fs.readdirSync(dir).filter((f) => !built.files.some((x) => x.cover && `${x.cover.slug}.webp` === f));
  if (extra.length) problems.push(`unused: ${extra.join(", ")}`);
  check("U1. every embedded project cover is byte for byte generador/fuentes/proyectos/<slug>.webp, and nothing else is in that folder", !problems.length, problems.slice(0, 4).join("; ") || `${built.files.filter((f) => f.section === "projects").length} images, ${fs.readdirSync(dir).length} covers`);
}

// ---------- U2 and U3: the daily update (generador/actualizar.mjs) ----------
const act = await import(pathToFileURL(path.join(root, "generador/actualizar.mjs")).href);
{
  const off = ["en", "es"].filter((l) => act.dataText(JSON.parse(fs.readFileSync(path.join(root, `datos/perfil.${l}.json`), "utf8"))) !== fs.readFileSync(path.join(root, `datos/perfil.${l}.json`), "utf8"));
  check("U2. datos/perfil.en.json and perfil.es.json are in the format actualizar.mjs writes", !off.length, off.length ? `${off.join(", ")} differ` : "both");
}
{
  // The published file as kairomx.tech would serve it, from today's data and covers; the network is a
  // test double that answers from local files (pruebas/red-falsa.mjs).
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "actualizar-"));
  const slugs = good.en.projects.filter((p) => p.featured).map((p) => p.slug);
  const coverUrl = (slug) => `${act.COVER_PREFIX}${slug}/portada.webp`;
  const published = { schema: 1, en: good.en, es: good.es, covers: Object.fromEntries(slugs.map((s) => [s, coverUrl(s)])) };
  const coverFile = (slug) => path.join(root, `generador/fuentes/proyectos/${slug}.webp`);
  const net = (data, covers = {}) => ({ [act.DATA_URL]: data, ...Object.fromEntries(slugs.map((s) => [coverUrl(s), covers[s] || { file: coverFile(s), type: "image/webp" }])) });
  const fake = pathToFileURL(path.join(root, "pruebas/red-falsa.mjs")).href;
  const file = (name, content) => { const f = path.join(tmp, name); fs.writeFileSync(f, content); return f; };
  let n = 0;
  const json = (mutate) => { const d = structuredClone(published); mutate(d); return file(`perfil-${n++}.json`, JSON.stringify(d)); };
  const runAct = (args, answers) => spawnSync(process.execPath, ["--import", fake, path.join(root, "generador/actualizar.mjs"), ...args], { encoding: "utf8", env: { ...process.env, RED_FALSA: JSON.stringify(answers) } });
  const pngFile = file("no-webp.webp", Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4c50000000049454e44ae426082", "hex"));
  // Control: good data through the network and through --from: nothing to change.
  {
    const a = runAct(["--check"], net({ file: file("good.json", JSON.stringify(published)), type: "application/json" }));
    const b = runAct(["--from", file("good-from.json", JSON.stringify(published)), "--check"], net("down"));
    check("U3. actualizar.mjs with today's data (from the network and with --from) finds nothing to change", a.status === 0 && b.status === 0 && /up to date/.test(a.stdout) && /up to date/.test(b.stdout), `exit ${a.status} and ${b.status}; ${(a.stdout + a.stderr).trim()} | ${(b.stdout + b.stderr).trim()}`);
  }
  // Broken cases: [how to build the network answers (or --from arguments), a word the message must contain].
  const viaNet = (mutate) => ({ file: json(mutate), type: "application/json" });
  const cases = {
    "link outside kairomx.tech": [() => net(viaNet((d) => { d.en.tabs[1].href = "https://example.com/cv/"; })), "links must start"],
    "text that does not fit its place": [() => net(viaNet((d) => { d.es.window.title = "W".repeat(24); d.es.window.titleAccent = "W".repeat(8); })), "window.title"],
    "emoji": [() => net(viaNet((d) => { d.en.status.parts[1].text = "remote \u{1F680}"; })), "emoji"],
    "language blocks swapped": [() => net(viaNet((d) => { [d.en, d.es] = [d.es, d.en]; })), 'the block says lang "es"'],
    "cover outside its folder": [() => net(viaNet((d) => { d.covers[slugs[1]] = "https://www.kairomx.tech/cv/evidencias/../img/og.webp"; })), `covers.${slugs[1]}`],
    "cover on another site": [() => net(viaNet((d) => { d.covers[slugs[0]] = `https://kairomx.tech.example.com/cv/evidencias/${slugs[0]}/portada.webp`; })), `covers.${slugs[0]}`],
    "cover that is not WebP (PNG served as image/webp)": [() => net(viaNet(() => {}), { [slugs[2]]: { file: pngFile, type: "image/webp" } }), "not a WebP"],
    "cover served as another type": [() => net(viaNet(() => {}), { [slugs[0]]: { file: coverFile(slugs[0]), type: "image/png" } }), 'expected "image/webp"'],
    "huge data file from the network": [() => net({ size: 5000000, type: "application/json" }), "the cap"],
    "huge data file with --from": [() => ({ args: ["--from", file("huge.json", Buffer.alloc(5000000, 32))], net: net("down") }), "the cap is"],
    "huge cover": [() => net(viaNet(() => {}), { [slugs[1]]: { size: 5000000, type: "image/webp" } }), "the cap"],
    "malformed JSON": [() => net({ file: file("bad.json", "{ not json"), type: "application/json" }), "not valid JSON"],
    "data file served as HTML": [() => net({ file: file("page.json", JSON.stringify(published)), type: "text/html" }), 'expected "application/json"'],
    "site answers 404": [() => net({ file: file("nf.json", "{}"), type: "application/json", status: 404 }), "answered 404"],
    "network down": [() => net("down"), "could not download"],
    "cover download fails": [() => { const a = net(viaNet(() => {})); a[coverUrl(slugs[2])] = "down"; return a; }, "could not download"],
  };
  for (const [label, [make, word]] of Object.entries(cases)) {
    const m = make();
    const args = m.args || [], answers = m.args ? m.net : m;
    const before = treeHash();
    const r = runAct(args, answers);
    const msg = r.stderr.trim();
    check(`U3. actualizar.mjs, ${label}: fails, says why and changes nothing`, r.status === 1 && treeHash() === before && msg.includes(word), `exit ${r.status}; ${msg || r.stdout.trim()}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ---------- U4: the daily workflow ----------
{
  const wf = path.join(root, ".github/workflows/actualizar-readme.yml");
  const y = fs.existsSync(wf) ? fs.readFileSync(wf, "utf8") : "";
  const lines = y.split("\n");
  const problems = [];
  if (!y) problems.push("no workflow");
  const uses = lines.filter((l) => /^\s*-?\s*uses:/.test(l));
  for (const l of uses) if (!/uses: [\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+\s*$/.test(l)) problems.push(`not pinned by full SHA with its version: ${l.trim()}`);
  const pins = { "actions/checkout": "3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1", "actions/setup-node": "949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0" };
  for (const [a, pin] of Object.entries(pins)) if (!uses.some((l) => l.includes(`${a}@${pin}`))) problems.push(`${a} is not ${pin}`);
  const perm = lines.findIndex((l) => l === "permissions:");
  const permBlock = [];
  for (let i = perm + 1; perm >= 0 && i < lines.length && /^\s+\S/.test(lines[i]); i++) permBlock.push(lines[i].trim());
  if (perm < 0 || permBlock.join("|") !== "contents: write") problems.push(`permissions: ${permBlock.join(", ") || "missing"}`);
  if (lines.filter((l) => /^\s*permissions:/.test(l)).length !== 1) problems.push("permissions set more than once");
  if (!/^concurrency:\n\s+group: \S+/m.test(y)) problems.push("no concurrency group");
  const cron = (y.match(/cron: "([^"]+)"/) || [])[1];
  if (!cron || cron.split(" ")[0] === "0" || cron.split(" ").slice(2).join(" ") !== "* * *") problems.push(`schedule: ${cron || "none"} (once a day, not on the hour)`);
  if (!/^\s+workflow_dispatch:/m.test(y)) problems.push("no workflow_dispatch");
  if (y.includes("${{")) problems.push("expressions in the workflow");
  if (/secrets\.|pull_request_target|curl |wget /.test(y)) problems.push("secrets, pull_request_target or a download in the shell");
  if (!/node-version: 22\s*$/m.test(y)) problems.push("Node is not 22");
  const steps = ["node generador/actualizar.mjs", "node pruebas/comprobar.mjs", "git status --porcelain", "git commit -F", "git push"].map((s) => y.indexOf(s));
  if (steps.some((i) => i < 0) || steps.some((i, k) => k && i < steps[k - 1])) problems.push("steps missing or out of order (update, check, look for changes, commit, push)");
  if ((y.match(/41898282\+github-actions\[bot\]@users\.noreply\.github\.com$/gm) || []).length !== 2 || (y.match(/: github-actions\[bot\]$/gm) || []).length !== 2) problems.push("commits are not signed by github-actions[bot]");
  check("U4. the workflow: actions pinned by full SHA (checkout v7.0.1, setup-node v7.1.0), contents: write only, concurrency, daily off the hour and by hand, Node 22, no expressions or secrets, update then check then commit as github-actions[bot] only if something changed", !problems.length, problems.join("; ") || `${uses.length} actions, cron ${cron}`);
}

// ---------- B3: the logos' license note ----------
{
  const note = fs.existsSync(path.join(root, "generador/fuentes/stack/LICENSES.md")) ? fs.readFileSync(path.join(root, "generador/fuentes/stack/LICENSES.md"), "utf8") : "";
  const libs = ["material-icon-theme", "devicon", "teenyicons", "vscode-icons", "svgl", "radix-icons"];
  const missing = [...libs.filter((l) => !new RegExp(`^- ${l}: Copyright`, "m").test(note)).map((l) => `${l} copyright line`),
    ...(/Permission is hereby granted, free of charge/.test(note) && /shall be included in all copies/.test(note) ? [] : ["MIT permission text"]),
    ...(/Light theme:/.test(note) && /brightness\(\.12\)/.test(note) ? [] : ["light theme filter"])];
  const marked = (note.match(/Copyright \(c\) \[MISSING\]/g) || []).length;
  check("B3. the logos' license note has a copyright line per MIT library, the MIT text and the light-theme filter", !missing.length, missing.join(", ") || `${marked} of ${libs.length} copyright lines still marked MISSING`);
}

// ---------- N1: nothing above changed the tree ----------
check("N1. the checks leave the tree they check as it was (hash of every file but .git)", treeHash() === treeBefore, treeBefore.slice(0, 12));

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
