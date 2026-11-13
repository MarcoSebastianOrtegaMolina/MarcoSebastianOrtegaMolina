// Featured projects: one small window per project, like the project cards of the CV (article.pcard):
// a title bar with the CV's window title, the real cover, then the category, the name and the short
// line. Wide layouts put the three side by side (each a third of the width); the phone stacks them
// (each the full width). The cover is embedded as a JPEG reduced to its on-screen size at 2x
// (generador/herramientas/reducir-portadas.cjs), because GitHub does not let an SVG load images.
import fs from "node:fs";
import path from "node:path";
import { LAYOUTS, githubColumn, SWEEP, layoutFor } from "./constantes.mjs";
import { rect, bevel, textItem, specOf, fontCss, mid } from "./cabecera.mjs";
import { measure, wrap, n } from "./texto.mjs";

const CARD = {
  desk: { gap: 16, bar: 32, sq: 10, padL: 12, sqGap: 8, padR: 8, title: 12.2, titleLS: 0.73, ctl: 12, pad: 14, cat: 12.2, catLS: 1.22, name: 17, nameLH: 22, sub: 13.5, subLH: 20, catGap: 28, nameGap: 26, subGap: 24, bottom: 16 },
  tab: { gap: 8, bar: 26, sq: 7, padL: 5, sqGap: 5, padR: 4, title: 11.2, titleLS: 0, ctl: 0, pad: 9, cat: 11.2, catLS: 0.56, name: 12.4, nameLH: 16, sub: 11.2, subLH: 15, catGap: 21, nameGap: 20, subGap: 18, bottom: 12 },
  mob: { stacked: true, after: 16, bar: 32, sq: 9, padL: 10, sqGap: 8, padR: 8, title: 12.8, titleLS: 0.38, ctl: 12, pad: 14, cat: 12.8, catLS: 1.28, name: 17, nameLH: 22, sub: 13.5, subLH: 20, catGap: 28, nameGap: 26, subGap: 24, bottom: 16 },
};

// Width of the cover in units, and the largest width in device pixels it is shown at (at 2x) in any
// viewport of its layout: the size the reduced covers are made at.
export function coverUnits(layout) {
  const c = CARD[layout], sp = specOf(layout), W = LAYOUTS[layout].width;
  const ww = c.stacked ? W - sp.sx : (W - sp.sx - 2 * c.gap) / 3;
  return { ww, cover: ww - 2, pct: c.stacked ? 100 : 100 / 3, pieceW: c.stacked ? W : W / 3 };
}
export function coverPixels(layout) {
  const u = coverUnits(layout);
  let col = 0;
  for (let v = SWEEP.from; v <= SWEEP.to; v++) if (layoutFor(v) === layout) col = Math.max(col, githubColumn(v));
  return Math.ceil(2 * u.cover * (u.pct / 100) * col / u.pieceW);
}

// Size of a JPEG from its first frame header.
export function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error("not a JPEG");
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1], len = buf.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  throw new Error("JPEG without a frame header");
}

export function loadCovers(dir) {
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".jpg"))) {
    const m = f.match(/^([a-z0-9-]+)-(desk|tab|mob)\.jpg$/);
    if (!m) throw new Error(`cover ${f}: expected <slug>-<layout>.jpg`);
    const buf = fs.readFileSync(path.join(dir, f));
    (out[m[1]] ||= {})[m[2]] = { ...jpegSize(buf), b64: buf.toString("base64"), bytes: buf.length };
  }
  return out;
}

// Cards of one layout and theme. Returns pieces: [{ id, x, w, h, pct, href, alt, svg, texts }].
export function projectPieces(data, src, layout, T) {
  const c = CARD[layout], sp = specOf(layout);
  const W = LAYOUTS[layout].width;
  const { ww } = coverUnits(layout);
  const line = `rgba(${T.ink},.14)`, lineStrong = `rgba(${T.ink},.32)`;
  const featured = data.projects.filter((p) => p.featured);
  const inner = ww - 2, tw = inner - 2 * c.pad;
  // Text first: every card gets the same height, the tallest one's.
  const cards = featured.map((p, k) => {
    const cov = (src.covers[p.slug] || {})[layout];
    if (!cov) throw new Error(`projects: no cover for "${p.slug}" in the ${layout} layout (generador/fuentes/proyectos/${p.slug}-${layout}.jpg)`);
    const need = coverPixels(layout);
    if (cov.w < need - 1) throw new Error(`cover ${p.slug}-${layout}.jpg is ${cov.w} px wide; it is shown at up to ${need} px (2x)`);
    const coverH = inner * cov.h / cov.w;
    const wrapOr = (runs, size, field, spacing = 0) => { try { return wrap(runs, size, tw, spacing); } catch (e) { throw new Error(`projects[${data.projects.indexOf(p)}].${field}: ${e.message} in the ${layout} layout`); } };
    const catLines = wrapOr([{ text: p.cat.toUpperCase(), face: "mono-700", fill: T.muted }], c.cat, "cat", c.catLS);
    const nameLines = wrapOr([{ text: p.title, face: "sg-600", fill: T.fg }], c.name, "title");
    const subLines = wrapOr([{ text: p.sub, face: "inter-400", fill: T.fg2 }], c.sub, "sub");
    const barTitle = measure(p.window, "mono-700", c.title, c.titleLS) - c.titleLS;
    const ctlW = c.ctl ? 3 * c.ctl + 2 * 4 + c.sqGap : 0;
    const room = inner - c.padL - c.sq - c.sqGap - c.padR - ctlW;
    if (barTitle > room + 0.01) throw new Error(`projects[${data.projects.indexOf(p)}].window measures ${barTitle.toFixed(1)} units in the ${layout} layout; ${room.toFixed(1)} fit`);
    const top = 1 + c.bar + coverH + 1;
    const textH = c.catGap + (catLines.length - 1) * c.subLH + c.nameGap + (nameLines.length - 1) * c.nameLH + c.subGap + (subLines.length - 1) * c.subLH + c.bottom;
    return { p, k, cov, coverH, catLines, nameLines, subLines, top, textH };
  });
  // Side by side, the three cards share the tallest one's height; stacked, each keeps its own.
  const tallest = Math.ceil(Math.max(...cards.map((x) => x.top + x.textH)));
  const pieceW = c.stacked ? W : W / 3;
  return cards.map(({ p, k, cov, coverH, catLines, nameLines, subLines, top, textH }) => {
    const cardH = c.stacked ? Math.ceil(top + textH) : tallest;
    const pieceH = cardH + sp.sy + (c.stacked ? c.after : 0);
    const x = c.stacked ? 0 : k * (ww + c.gap);
    const texts = [];
    const add = (it) => { texts.push(it); return it.markup; };
    let g = rect(x + sp.sx, sp.sy, ww, cardH, T.shade) + rect(x, 0, ww, cardH, T.bg2);
    // Title bar: strip on top, red square, window title, small controls.
    g += rect(x, 0, ww, 1 + c.bar, T.bg3) + rect(x + 1, 1 + c.bar - 1, ww - 2, 1, line);
    const bm = 1 + (c.bar - 1) / 2;
    const sqx = x + 1 + c.padL, sqy = bm - c.sq / 2;
    g += rect(sqx, sqy, c.sq, c.sq, T.red) + rect(sqx + c.sq - 2, sqy, 2, c.sq, "rgba(0,0,0,.35)") + rect(sqx, sqy + c.sq - 2, c.sq - 2, 2, "rgba(0,0,0,.35)");
    g += add(textItem(sqx + c.sq + c.sqGap, mid(bm, c.title), [{ text: p.window, face: "mono-700", fill: T.fg }], c.title, { spacing: c.titleLS, label: `window ${p.window}` }));
    if (c.ctl) for (let i = 0; i < 3; i++) {
      const cx = x + ww - 1 - c.padR - (3 - i) * c.ctl - (2 - i) * 4, cy = bm - c.ctl / 2;
      g += rect(cx, cy, c.ctl, c.ctl, T.bg4) + bevel(cx, cy, c.ctl, c.ctl, T.bevelHi, T.bevelLo);
    }
    // Cover, full inner width, its own proportions.
    g += `<image x="${n(x + 1)}" y="${n(1 + c.bar)}" width="${n(ww - 2)}" height="${n(coverH)}" preserveAspectRatio="xMidYMid slice" href="data:image/jpeg;base64,${cov.b64}"/>`;
    g += rect(x + 1, 1 + c.bar + coverH, ww - 2, 1, line);
    // Category with its LED, name, short line.
    let y = top + c.catGap;
    const lx = x + 1 + c.pad;
    g += `<circle cx="${n(lx + 4)}" cy="${n(y - c.cat * 0.35)}" r="4" fill="#ff2020"/>`;
    catLines.forEach((l, i) => { if (i) y += c.subLH; g += add(textItem(lx + 16, y, l.runs, c.cat, { spacing: c.catLS, label: "project category" })); });
    y += c.nameGap;
    nameLines.forEach((l, i) => { if (i) y += c.nameLH; g += add(textItem(lx, y, l.runs, c.name, { label: "project name" })); });
    y += c.subGap;
    subLines.forEach((l, i) => { if (i) y += c.subLH; g += add(textItem(lx, y, l.runs, c.sub, { label: "project line" })); });
    // Frame: strip on top and border.
    g += rect(x + 1, 1, ww - 2, 2, lineStrong) + `<rect x="${n(x + 0.5)}" y=".5" width="${n(ww - 1)}" height="${n(cardH - 1)}" fill="none" stroke="${lineStrong}"/>`;
    const faces = new Set(texts.flatMap((t) => t.runs.map((r) => r.face)));
    const px = c.stacked ? 0 : k * pieceW;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${n(pieceW)}" height="${n(pieceH)}" viewBox="${n(px)} 0 ${n(pieceW)} ${n(pieceH)}"><style>${fontCss(src, faces)}</style>${g}</svg>\n`;
    const outTexts = texts.map((t) => ({ label: t.label, y0: t.y0, y1: t.y1, size: t.size, runs: t.runs.map((r) => ({ text: r.text, face: r.face, fill: r.fill, x0: r.x0, x1: r.x1, full: r.x1 - r.x0 })) }));
    return { id: `proj-${p.slug}`, x: px, w: pieceW, h: pieceH, pct: c.stacked ? 100 : 100 / 3, href: p.href, alt: `${p.title}. ${p.sub}`, svg, texts: outTexts,
      cover: { slug: p.slug, x: x + 1 - px, y: 1 + c.bar, w: ww - 2, h: coverH, px: cov.w, py: cov.h } };
  });
}
