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
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
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
  const tag = label.startsWith("M1") ? "2/M1" : /U\+|emoji|check mark/.test(label) ? "data" : "2";
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
  const images = [...s.matchAll(/<image\b[^>]*\shref="([^"]{0,40})/g)].map((m) => m[1]);
  const badImages = images.filter((h) => !/^data:image\/(jpeg|webp);base64,/.test(h)).length + (s.match(/<image\b/g) || []).length - images.length;
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

// ---------- N1: nothing above changed the tree ----------
check("N1. the checks leave the tree they check as it was (hash of every file but .git)", treeHash() === treeBefore, treeBefore.slice(0, 12));

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
