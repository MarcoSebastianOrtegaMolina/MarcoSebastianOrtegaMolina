// Static checks of the generated header. No dependencies, no network.
//   node pruebas/comprobar.mjs
// 1. The generator, run in memory, gives exactly the files on disk.
// 2. Broken data files make the generator fail without touching any file (one case each).
// 3. Every SVG is well-formed XML, has no http(s) address other than the SVG namespace, no <script>,
//    no foreignObject, no on* attributes, and weighs 600 KB or less; one visit loads 3 MB or less;
//    every link in the README starts with https://www.kairomx.tech/ and every image it uses exists.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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

// ---------- 1. regeneration matches the files on disk ----------
const gen = spawnSync(process.execPath, [path.join(root, "generador/generar.mjs"), "--check"], { encoding: "utf8" });
check("1. generator output equals the files on disk", gen.status === 0, gen.stdout.trim() || gen.stderr.trim());

// ---------- 2. broken data: the generator fails and changes nothing ----------
function snapshot() {
  const h = crypto.createHash("sha256");
  const files = ["README.md", ...fs.readdirSync(ASSETS).sort().map((f) => "assets/" + f)];
  for (const f of files) h.update(f + "\0").update(fs.readFileSync(path.join(root, f)));
  return h.digest("hex");
}
const good = JSON.parse(fs.readFileSync(path.join(root, "datos/perfil.en.json"), "utf8"));
const broken = {
  "link outside kairomx.tech": (d) => { d.tabs[1].href = "https://example.com/cv/"; },
  "text over its cap": (d) => { d.hero.name = "M".repeat(41); },
  "missing field": (d) => { delete d.hero.role; },
  "<script> inside a text": (d) => { d.buttons[0].label = "<script>"; },
  "unknown field": (d) => { d.extra = "x"; },
  "not JSON": null,
};
for (const [label, mutate] of Object.entries(broken)) {
  const before = snapshot();
  let input = "{ not json";
  if (mutate) { const d = structuredClone(good); mutate(d); input = JSON.stringify(d); }
  const r = spawnSync(process.execPath, [path.join(root, "generador/generar.mjs"), "--datos", "-"], { input, encoding: "utf8" });
  const after = snapshot();
  check(`2. broken data, ${label}: fails and changes nothing`, r.status !== 0 && before === after, `exit ${r.status}; ${r.stderr.trim()}`);
}

// ---------- 3. the SVG files ----------
const svgs = fs.readdirSync(ASSETS).filter((f) => f.endsWith(".svg")).sort();
let worst = { f: null, kb: 0 };
const bad = [];
for (const f of svgs) {
  const s = fs.readFileSync(path.join(ASSETS, f), "utf8");
  const kb = Buffer.byteLength(s) / 1024;
  if (kb > worst.kb) worst = { f, kb };
  const wf = wellFormed(s);
  const http = (s.match(/https?:\/\//gi) || []).length - (s.match(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g) || []).length;
  const tags = s.match(/<[^>]*>/g) || [];
  const onAttr = tags.filter((t) => /\son[a-z]+\s*=/i.test(t)).length;
  const problems = [wf && `not well-formed: ${wf}`, http && `${http} http addresses`, /<script/i.test(s) && "<script>", /foreignObject/i.test(s) && "foreignObject", onAttr && `${onAttr} on* attributes`, kb > 600 && `${kb.toFixed(1)} KB`].filter(Boolean);
  if (problems.length) bad.push(`${f}: ${problems.join(", ")}`);
}
check(`3. ${svgs.length} SVG: well-formed, no http but the namespace, no script, foreignObject or on*, 600 KB or less`, svgs.length > 0 && !bad.length, bad.length ? bad.join("; ") : `largest ${worst.f} ${worst.kb.toFixed(1)} KB`);

// ---------- 3. the README ----------
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const hrefs = [...readme.matchAll(/href="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
const outside = hrefs.filter((h) => !h.startsWith("https://www.kairomx.tech/"));
check(`3. ${hrefs.length} links in the README start with https://www.kairomx.tech/`, hrefs.length > 0 && !outside.length, outside.join(", "));
const used = new Set([...readme.matchAll(/(?:src|srcset)="assets\/([^"]+)"/g)].map((m) => m[1]));
const missing = [...used].filter((f) => !svgs.includes(f));
const orphans = svgs.filter((f) => !used.has(f));
check("3. every image the README uses exists and no image is unused", !missing.length && !orphans.length, `${used.size} used${missing.length ? `; missing ${missing.join(", ")}` : ""}${orphans.length ? `; unused ${orphans.join(", ")}` : ""}`);

// One visit: for every combination of width, theme and reduced motion, the first matching source of
// each <picture> (or its <img>), summed.
const pictures = [...readme.matchAll(/<picture>(.*?)<\/picture>/g)].map((m) => ({
  sources: [...m[1].matchAll(/<source media="([^"]+)" srcset="assets\/([^"]+)">/g)].map((s) => ({ media: s[1], file: s[2] })),
  img: m[1].match(/<img [^>]*src="assets\/([^"]+)"/)[1],
}));
const matches = (media, env) => media.split(" and ").every((q) =>
  q === "(prefers-color-scheme: dark)" ? env.dark : q === "(prefers-reduced-motion: reduce)" ? env.reduce : /^\(max-width: (\d+)px\)$/.test(q) ? env.width <= +q.match(/\d+/)[0] : (() => { throw new Error("unknown media " + q); })());
let heaviest = { kb: 0 };
for (const width of [390, 1280]) for (const dark of [true, false]) for (const reduce of [true, false]) {
  const env = { width, dark, reduce };
  const files = pictures.map((p) => (p.sources.find((s) => matches(s.media, env)) || { file: p.img }).file);
  const kb = files.reduce((s, f) => s + fs.statSync(path.join(ASSETS, f)).size, 0) / 1024;
  if (kb > heaviest.kb) heaviest = { kb, env };
}
check(`3. one visit loads 3 MB or less (${pictures.length} pictures)`, heaviest.kb <= 3072, `heaviest ${heaviest.kb.toFixed(1)} KB at ${JSON.stringify(heaviest.env)}`);

// No e-mail addresses or emojis in what is versioned by the generator.
const texts = [readme, fs.readFileSync(path.join(root, "datos/perfil.en.json"), "utf8")];
const mail = texts.some((t) => /[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(t));
const emoji = texts.concat(svgs.map((f) => fs.readFileSync(path.join(ASSETS, f), "utf8"))).some((t) => /\p{Extended_Pictographic}/u.test(t));
check("3. no e-mail address or emoji in the README, the data or the images", !mail && !emoji, `${mail ? "e-mail found " : ""}${emoji ? "emoji found" : ""}`);

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
