// Text helpers: XML escaping, width estimates from the measured font table, and line wrapping.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const METRICS = JSON.parse(fs.readFileSync(path.join(here, "metricas.json"), "utf8"));

// Escapes text for XML content and attribute values.
export const esc = (t) =>
  String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// Font faces used by the header: CSS family, weight and the metrics key.
export const FACES = {
  "sg-500": { family: "SG", weight: 500 },
  "sg-600": { family: "SG", weight: 600 },
  "mono-400": { family: "SM", weight: 400 },
  "mono-700": { family: "SM", weight: 700 },
  "inter-400": { family: "IN", weight: 400 },
  "inter-600": { family: "IN", weight: 600 },
};

// Characters the table does not know are counted as wide as "M", so estimates err on the safe side.
export function measure(text, face, size, spacing = 0) {
  const table = METRICS.faces[face];
  if (!table) throw new Error(`unknown font face ${face}`);
  let w = 0;
  for (const ch of String(text)) w += (table[ch] ?? table.M) * size / 1000 + spacing;
  return w;
}

// Greedy wrap of styled runs ([{text, face, fill}]) into lines no wider than maxWidth.
// Returns lines of runs; words never break, so a word wider than maxWidth is reported as an error.
export function wrap(runs, size, maxWidth, spacing = 0) {
  const words = [];
  for (const r of runs) {
    const parts = r.text.split(/(\s+)/).filter((p) => p.length);
    for (const p of parts) words.push({ ...r, text: p, space: /^\s+$/.test(p) });
  }
  const lines = [[]];
  let width = 0;
  for (const w of words) {
    const ww = measure(w.text, w.face, size, spacing);
    const line = lines[lines.length - 1];
    if (w.space) {
      if (line.length) { line.push(w); width += ww; }
      continue;
    }
    if (line.length && width + ww > maxWidth) {
      while (line.length && line[line.length - 1].space) line.pop();
      lines.push([w]);
      width = ww;
    } else { line.push(w); width += ww; }
    if (ww > maxWidth) throw new Error(`the word "${w.text}" does not fit in ${maxWidth.toFixed(1)} units`);
  }
  const last = lines[lines.length - 1];
  while (last.length && last[last.length - 1].space) last.pop();
  // Merge neighbours with the same style back into single runs.
  return lines.map((line) => {
    const out = [];
    for (const w of line) {
      const prev = out[out.length - 1];
      if (prev && prev.face === w.face && prev.fill === w.fill) prev.text += w.text;
      else out.push({ text: w.text, face: w.face, fill: w.fill });
    }
    return { runs: out, width: out.reduce((s, r) => s + measure(r.text, r.face, size, spacing), 0) };
  });
}

// One <text> element made of styled runs. Each run picks its family and weight from its face.
export function textEl(x, y, runs, size, { spacing = 0, anchor = "start", extra = "" } = {}) {
  const attrs = (r) => `font-family="${FACES[r.face].family}" font-weight="${FACES[r.face].weight}" fill="${r.fill}"`;
  const ls = spacing ? ` letter-spacing="${+spacing.toFixed(3)}"` : "";
  const anchorAttr = anchor === "start" ? "" : ` text-anchor="${anchor}"`;
  if (runs.length === 1) {
    return `<text x="${n(x)}" y="${n(y)}" font-size="${n(size)}"${ls}${anchorAttr} ${attrs(runs[0])}${extra}>${esc(runs[0].text)}</text>`;
  }
  return `<text x="${n(x)}" y="${n(y)}" font-size="${n(size)}"${ls}${anchorAttr}${extra}>${runs.map((r) => `<tspan ${attrs(r)}>${esc(r.text)}</tspan>`).join("")}</text>`;
}

// Numbers in the SVG source: at most three decimals, no trailing zeros.
export const n = (v) => String(Math.round(v * 1000) / 1000);
