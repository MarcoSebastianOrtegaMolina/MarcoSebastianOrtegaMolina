// Static checks of the generated header. No dependencies, no network.
//   node pruebas/comprobar.mjs
// 1. The generator, run in memory, gives exactly the files on disk.
// 2. Broken data files make the generator fail without touching any file (one case each).
// 3. Every SVG is well-formed XML, has no http(s) address other than the SVG namespace, no <script>,
//    no foreignObject, no on* attributes, and stays within the size caps of generador/constantes.mjs;
//    every link in the README starts with https://www.kairomx.tech/ and every image it uses exists.
// Also: legibility and height per composition, M1 (texts that do not fit), M2 (shared numbers in one
// place), data (text direction, emoji, byte order mark), 6 (buttons) and 7 (leftovers).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = path.join(root, "assets");
const results = [];
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
function snapshot() {
  const h = crypto.createHash("sha256");
  const files = ["README.md", ...fs.readdirSync(ASSETS).sort().map((f) => "assets/" + f)];
  for (const f of files) h.update(f + "\0").update(fs.readFileSync(path.join(root, f)));
  return h.digest("hex");
}
const good = JSON.parse(fs.readFileSync(path.join(root, "datos/perfil.en.json"), "utf8"));
const run = (input) => spawnSync(process.execPath, [path.join(root, "generador/generar.mjs"), "--datos", "-"], { input, encoding: "utf8" });
// Each case: how to break the data, and a word the error message must contain.
const broken = {
  "link outside kairomx.tech": [(d) => { d.tabs[1].href = "https://example.com/cv/"; }, "links must start"],
  "text over its cap": [(d) => { d.hero.name = "M".repeat(41); }, "the cap is 40"],
  "missing field": [(d) => { delete d.hero.role; }, 'missing field "role"'],
  "<script> inside a text": [(d) => { d.buttons[0].label = "<script>"; }, "markup"],
  "unknown field": [(d) => { d.extra = "x"; }, 'unknown field "extra"'],
  "not JSON": [null, "not valid JSON"],
  // M1: texts at their cap that do not fit their place in some layout.
  "M1 window title at its cap": [(d) => { d.window.title = "W".repeat(24); d.window.titleAccent = "W".repeat(8); }, "window.title"],
  "M1 tab label at its cap": [(d) => { d.tabs[3].label = "W".repeat(12); }, "tabs["],
  "M1 button label at its cap": [(d) => { d.buttons[1].label = "WWWWWWW WWWWWWWW"; }, "buttons[1].label"],
  "M1 name at its cap": [(d) => { d.hero.name = "W".repeat(40); }, "hero.name"],
  "M1 role at its cap": [(d) => { d.hero.role = "W".repeat(40); }, "hero.role"],
  "M1 title line at its cap": [(d) => { d.hero.titleLine1 = { lead: "W".repeat(12), accent: "W".repeat(12) }; }, "hero.titleLine1"],
  "M1 pitch at its cap": [(d) => { d.hero.pitch = [{ text: "WWWWWWWWW ".repeat(11).trim(), strong: false }]; }, "hero.pitch"],
  "M1 status at its cap": [(d) => { d.status.parts = [{ text: "W".repeat(40), strong: false }]; }, "status.parts"],
  // Data: direction controls and emoji are rejected.
  "U+202E text direction": [(d) => { d.hero.name = "Marco ‮anilom"; }, "text direction"],
  "emoji": [(d) => { d.tabs[0].label = "Home \u{1F3E0}"; }, "emoji"],
};
for (const [label, [mutate, word]] of Object.entries(broken)) {
  const before = snapshot();
  let input = "{ not json";
  if (mutate) { const d = structuredClone(good); mutate(d); input = JSON.stringify(d); }
  const r = run(input);
  const after = snapshot();
  const msg = r.stderr.trim();
  const tag = label.startsWith("M1") ? "2/M1" : /U\+202E|emoji/.test(label) ? "data" : "2";
  check(`${tag}. broken data, ${label}: fails with a clear message and changes nothing`, r.status !== 0 && before === after && msg.includes(word), `exit ${r.status}; ${msg || r.stdout.trim()}`);
}
{
  const before = snapshot();
  const r = run("﻿" + JSON.stringify(good));
  check("data. valid JSON with a byte order mark is accepted and gives the same files", r.status === 0 && snapshot() === before, `exit ${r.status}; ${(r.stderr || r.stdout).trim()}`);
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
  const problems = [wf && `not well-formed: ${wf}`, http && `${http} http addresses`, /<script/i.test(s) && "<script>", /foreignObject/i.test(s) && "foreignObject", onAttr && `${onAttr} on* attributes`, (!C || bytes > C.MAX_SVG) && `${(bytes / 1024).toFixed(1)} KB`].filter(Boolean);
  if (problems.length) bad.push(`${f}: ${problems.join(", ")}`);
}
check(`3. ${svgs.length} SVG: well-formed, no http but the namespace, no script, foreignObject or on*, within the size cap`, svgs.length > 0 && !bad.length, bad.length ? bad.slice(0, 3).join("; ") : `largest ${worst.f} ${(worst.bytes / 1024).toFixed(1)} KB`);

// ---------- 3. the README ----------
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const hrefs = [...readme.matchAll(/href="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
const outside = hrefs.filter((h) => !h.startsWith("https://www.kairomx.tech/"));
check(`3. ${hrefs.length} links in the README start with https://www.kairomx.tech/`, hrefs.length > 0 && !outside.length, outside.join(", "));
const used = new Set([...readme.matchAll(/(?:src|srcset)="assets\/([^"]+)"/g)].map((m) => m[1]));
const missing = [...used].filter((f) => !svgs.includes(f));
const orphans = svgs.filter((f) => !used.has(f));
check("3. every image the README uses exists and no image is unused", !missing.length && !orphans.length, `${used.size} used${missing.length ? `; missing ${missing.join(", ")}` : ""}${orphans.length ? `; unused ${orphans.join(", ")}` : ""}`);

// One visit: for each composition, theme and reduced-motion setting, the first matching source of
// each <picture> (or its <img>), summed.
const pictures = [...readme.matchAll(/<picture>(.*?)<\/picture>/g)].map((m) => ({
  sources: [...m[1].matchAll(/<source media="([^"]+)" srcset="assets\/([^"]+)">/g)].map((s) => ({ media: s[1], file: s[2] })),
  img: m[1].match(/<img [^>]*src="assets\/([^"]+)"/)[1],
}));
const matches = (media, env) => media.split(" and ").every((q) =>
  q === "(prefers-color-scheme: dark)" ? env.dark : q === "(prefers-reduced-motion: reduce)" ? env.reduce : /^\(max-width: (\d+)px\)$/.test(q) ? env.width <= +q.match(/\d+/)[0] : (() => { throw new Error("unknown media " + q); })());
if (C) {
  let heaviest = { bytes: 0 };
  for (const layout of C.LAYOUT_ORDER) for (const dark of [true, false]) for (const reduce of [true, false]) {
    const env = { width: Math.min(C.LAYOUTS[layout].lastViewport, C.SWEEP.to), dark, reduce };
    const files = pictures.map((p) => (p.sources.find((s) => matches(s.media, env)) || { file: p.img }).file);
    const bytes = files.reduce((s, f) => s + fs.statSync(path.join(ASSETS, f)).size, 0);
    if (bytes > heaviest.bytes) heaviest = { bytes, env };
  }
  check(`3. one visit loads ${C.MAX_VISIT / 1048576} MB or less (${pictures.length} pictures)`, heaviest.bytes <= C.MAX_VISIT, `heaviest ${(heaviest.bytes / 1024).toFixed(1)} KB at ${JSON.stringify(heaviest.env)}`);
} else check("3. one visit within the cap", false, "constants missing");

// No e-mail addresses or emojis in what the generator writes or reads.
const texts = [readme, fs.readFileSync(path.join(root, "datos/perfil.en.json"), "utf8")];
const mail = texts.some((t) => /[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(t));
const emoji = texts.concat(svgs.map((f) => fs.readFileSync(path.join(ASSETS, f), "utf8"))).some((t) => /\p{Extended_Pictographic}/u.test(t));
check("3. no e-mail address or emoji in the README, the data or the images", !mail && !emoji, `${mail ? "e-mail found " : ""}${emoji ? "emoji found" : ""}`);

// ---------- 1. legibility and height of every composition (from the build) ----------
if (C && built.sizes) {
  const problems = [];
  for (const layout of C.LAYOUT_ORDER) {
    const s = built.sizes[layout];
    if (!s) { problems.push(`no ${layout} layout`); continue; }
    let min = Infinity;
    for (let v = C.SWEEP.from; v <= C.SWEEP.to; v++) if (C.layoutFor(v) === layout) {
      const px = s.minText * C.githubColumn(v) / s.width;
      min = Math.min(min, px);
      if (px < C.minTextPx(v)) problems.push(`${layout} at ${v} px: ${px.toFixed(2)} px`);
    }
    if (layout !== "mob" && s.height / s.width > C.MAX_HEIGHT_RATIO) problems.push(`${layout} is ${(s.height / s.width).toFixed(2)} times as tall as wide`);
  }
  check("1. smallest text on screen at every viewport from 320 to 1400 px and height of each composition (computed)", !problems.length, problems.slice(0, 4).join("; ") || JSON.stringify(built.sizes));
} else check("1. smallest text and height per composition (computed)", false, "no per-layout sizes from the build");

// ---------- 6. the three buttons share one structure in every composition ----------
{
  const per = {};
  for (const f of built.files.filter((f) => f.row === "buttons" && f.theme === "dark")) (per[f.layout] ||= []).push(f.texts.filter((t) => t.label.startsWith("button")).length);
  const uneven = Object.entries(per).filter(([, v]) => new Set(v).size > 1);
  check("6. the three buttons have the same number of label lines in each composition", Object.keys(per).length > 0 && !uneven.length, JSON.stringify(per));
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
  const patterns = [767, ...C.LAYOUT_ORDER.map((l) => C.LAYOUTS[l].lastViewport).filter(Number.isFinite), C.MAX_SVG, C.MAX_VISIT, C.MAX_VISIT / 1024]
    .map((v) => new RegExp(`(?<![\\w.])${v}(?![\\w.])`)).concat([/\d+\s*\*\s*1024/, /\b600\s*KB/i]);
  const hits = [];
  for (const f of tracked.filter((f) => /\.(mjs|cjs)$/.test(f) && !["generador/constantes.mjs", "pruebas/comprobar.mjs"].includes(f))) {
    fs.readFileSync(path.join(root, f), "utf8").split("\n").forEach((l, i) => { const p = patterns.find((re) => re.test(l)); if (p) hits.push(`${f}:${i + 1} (${l.match(p)[0]})`); });
  }
  const readers = ["pruebas/comprobar.mjs", "pruebas/medir.cjs", "generador/construir.mjs"].filter((f) => !fs.readFileSync(path.join(root, f), "utf8").includes("constantes.mjs"));
  check("M2. breakpoints and caps live only in generador/constantes.mjs, and the tests read them from there", !hits.length && !readers.length, [...hits, ...readers.map((r) => `${r} does not read it`)].join(", "));
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

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
