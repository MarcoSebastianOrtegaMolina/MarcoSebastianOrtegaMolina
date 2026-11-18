// The tech strip, «STACK.INI»: a low window with the label in red and 16 logos in gray, one link.
// Wide layouts: label on the left and one row of 16. Narrow layouts: label on top and two rows of 8.
// Each logo keeps its drawing untouched: it is nested as is (ids prefixed) and turned gray with an
// SVG filter equivalent to the CV's CSS: grayscale(1) brightness(1.15) contrast(.85), opacity .6.
import fs from "node:fs";
import path from "node:path";
import { LAYOUTS } from "./constantes.mjs";
import { rect, textItem, fit, specOf, fontCss } from "./cabecera.mjs";
import { measure, n, esc } from "./texto.mjs";

const STRIP = {
  desk: { rows: 1, h: 58, pad: 18, label: 12.2, ls: 1.71, labelGap: 18, logo: 24 },
  tab: { rows: 2, pad: 14, top: 14, label: 11.2, ls: 1.57, labelGap: 13, logo: 22, rowGap: 13, bottom: 15 },
  mob: { rows: 2, pad: 12, top: 15, label: 12.8, ls: 1.79, labelGap: 14, logo: 22, rowGap: 14, bottom: 16 },
};
// Logos drawn wider than square, like the CV's .logo--wide (34 by 22).
const WIDE = { n8n: 34 / 22 };

// Gray filters. From the CV (cv-base.css): "base" is .logo; "invert" is what the light theme does to
// near-white logos; "bright" is .logo--dark, for dark drawings in the dark theme. The CV's own rest
// state does not reach 3:1 on the light background (measured: 1.1 to 2.4 for 13 of the 16 logos), so
// the light theme adds "ink", the same gray at an eighth of the brightness (a fifth left the thin React lines at 2.95:1 on the phone). Which logo gets which is
// set per theme below, from the contrast measured against the strip's background (pruebas/medir.cjs,
// check 8): every logo reaches 3:1.
const FILTERS = {
  base: [["gray"], ["linear", 1.15, 0], ["linear", 0.85, 0.075]],
  invert: [["linear", -1, 1], ["gray"], ["linear", 0.85, 0.075]],
  bright: [["gray"], ["linear", 1.9, 0], ["linear", 0.85, 0.075]],
  ink: [["gray"], ["linear", 0.12, 0], ["linear", 0.85, 0.075]],
};
const DARK_DRAWINGS = ["typescript", "python", "postgresql", "git", "docker", "n8n", "claude"];
const NEAR_WHITE = ["nextjs", "vercel", "expo"];
export const LOGO_FILTER = {
  dark: Object.fromEntries(DARK_DRAWINGS.map((k) => [k, "bright"])),
  light: Object.fromEntries(NEAR_WHITE.map((k) => [k, "invert"])),
};
export const DEFAULT_FILTER = { dark: "base", light: "ink" };
export const LOGO_OPACITY = 0.6;

function filterDefs(names) {
  const prim = (p) => p[0] === "gray"
    ? `<feColorMatrix type="matrix" values="${[0, 1, 2].map(() => "0.2126 0.7152 0.0722 0 0").join(" ")} 0 0 0 1 0"/>`
    : `<feComponentTransfer>${["R", "G", "B"].map((c) => `<feFunc${c} type="linear" slope="${p[1]}" intercept="${p[2]}"/>`).join("")}</feComponentTransfer>`;
  return [...names].sort().map((k) => `<filter id="f-${k}" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB">${FILTERS[k].map(prim).join("")}</filter>`).join("");
}

// Reads one logo file and returns its root attributes and inner markup, cleaned for nesting: no XML
// declaration, comments or <title>, ids prefixed, xlink:href written as href. Anything that could run
// code or load something from outside stops the build.
export function loadLogo(file, key) {
  let s = fs.readFileSync(file, "utf8").replace(/^﻿/, "").replace(/<\?xml[^>]*\?>/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<title>[\s\S]*?<\/title>/g, "").trim();
  if (/<script|foreignObject|\son[a-z]+\s*=|https?:\/\/(?!www\.w3\.org\/)|url\(\s*['"]?(?!#)/i.test(s)) throw new Error(`logo ${key}: it has a script, an event attribute or an outside reference`);
  const m = s.match(/^<svg\b([^>]*)>([\s\S]*)<\/svg>$/);
  if (!m) throw new Error(`logo ${key}: not a single <svg> element`);
  const attrs = {};
  for (const a of m[1].matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[a[1]] = a[2];
  const vb = (attrs.viewBox || "").trim().split(/[\s,]+/).map(Number);
  if (vb.length !== 4 || vb.some((v) => !Number.isFinite(v))) throw new Error(`logo ${key}: no viewBox`);
  const keep = Object.entries(attrs).filter(([k]) => !/^(xmlns(:\w+)?|version|width|height|x|y|xml:space|preserveAspectRatio|viewBox|id|class|style)$/.test(k));
  let inner = m[2].replace(/xlink:href=/g, "href=");
  const ids = [...inner.matchAll(/\sid="([^"]+)"/g)].map((x) => x[1]);
  for (const id of ids) {
    const q = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    inner = inner.replace(new RegExp(`id="${q}"`, "g"), `id="${key}-${id}"`).replace(new RegExp(`url\\(#${q}\\)`, "g"), `url(#${key}-${id})`).replace(new RegExp(`href="#${q}"`, "g"), `href="#${key}-${id}"`);
  }
  return { viewBox: vb, attrs: keep, inner };
}

export function loadLogos(dir) {
  const out = {};
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".svg"))) { const key = f.replace(/\.svg$/, ""); out[key] = loadLogo(path.join(dir, f), key); }
  return out;
}

// One strip for a layout and theme: { svg, texts, logos (boxes in units), h, W }.
export function stripSvg(data, src, layout, T) {
  const st = STRIP[layout], sp = specOf(layout);
  const W = LAYOUTS[layout].width, win = W - sp.sx;
  const lineStrong = `rgba(${T.ink},.32)`;
  for (const it of data.stack.items) if (!src.logos[it.id]) throw new Error(`stack.items: no logo file for "${it.id}" in generador/fuentes/stack`);
  const labelW = measure(data.stack.label, "mono-700", st.label, st.ls) - st.ls;
  const per = data.stack.items.length / st.rows;
  let h, slotsX0, slotsX1, rowY, labelX = st.pad, labelBase;
  if (st.rows === 1) {
    h = st.h;
    labelBase = h / 2 + st.label * 0.35;
    slotsX0 = st.pad + labelW + st.labelGap; slotsX1 = win - 1 - st.pad + 6;
    rowY = [h / 2];
  } else {
    labelBase = st.top + st.label * 0.75;
    const r0 = labelBase + st.label * 0.25 + st.labelGap + st.logo / 2;
    rowY = [r0, r0 + st.logo + st.rowGap];
    h = Math.ceil(rowY[1] + st.logo / 2 + st.bottom);
    slotsX0 = st.pad - 6; slotsX1 = win - 1 - st.pad + 6;
  }
  fit("stack.label", layout, labelW, st.rows === 1 ? 200 : win - 2 * st.pad);
  const slot = (slotsX1 - slotsX0) / per;
  const logos = [], used = new Set();
  let body = "";
  data.stack.items.forEach((it, i) => {
    const r = Math.floor(i / per), c = i % per;
    const lg = src.logos[it.id];
    const boxW = st.logo * (WIDE[it.id] || 1), boxH = st.logo;
    if (boxW > slot - 4) throw new Error(`stack: the ${it.id} logo does not fit its slot in the ${layout} layout`);
    // Contain, like object-fit: contain in the CV.
    const [, , vw, vh] = lg.viewBox;
    const k = Math.min(boxW / vw, boxH / vh), dw = vw * k, dh = vh * k;
    const cx = slotsX0 + slot * (c + 0.5), cy = rowY[r];
    const x = cx - dw / 2, y = cy - dh / 2;
    const f = LOGO_FILTER[T.name][it.id] || DEFAULT_FILTER[T.name];
    used.add(f);
    body += `<g filter="url(#f-${f})" opacity="${LOGO_OPACITY}"><svg x="${n(x)}" y="${n(y)}" width="${n(dw)}" height="${n(dh)}" viewBox="${lg.viewBox.join(" ")}"${lg.attrs.map(([a, v]) => ` ${a}="${esc(v)}"`).join("")}>${lg.inner}</svg></g>`;
    logos.push({ id: it.id, filter: f, x0: x, y0: y, x1: x + dw, y1: y + dh });
  });
  const winBottom = h - sp.sy;
  const label = textItem(labelX, labelBase, [{ text: data.stack.label, face: "mono-700", fill: T.redInk }], st.label, { spacing: st.ls, label: "stack label" });
  const frame = rect(win, sp.sy, sp.sx, winBottom - sp.sy, T.shade) + rect(sp.sx, winBottom, W - sp.sx, sp.sy, T.shade) + rect(0, 0, win, winBottom, T.bg2) +
    `<rect x=".5" y=".5" width="${n(win - 1)}" height="${n(winBottom - 1)}" fill="none" stroke="${lineStrong}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${n(W)}" height="${n(h)}" viewBox="0 0 ${n(W)} ${n(h)}"><style>${fontCss(src, new Set(["mono-700"]))}</style><defs>${filterDefs(used)}</defs>` +
    frame + label.markup + body + `</svg>\n`;
  const texts = [{ label: label.label, y0: label.y0, y1: label.y1, size: label.size, runs: label.runs.map((r) => ({ text: r.text, face: r.face, fill: r.fill, x0: r.x0, x1: r.x1, full: r.x1 - r.x0 })) }];
  return { svg, texts, logos, h, W };
}
