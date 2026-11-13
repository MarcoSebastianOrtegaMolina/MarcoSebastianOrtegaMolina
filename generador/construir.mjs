// Builds every header image and the README in memory. Nothing is written here: generar.mjs writes
// only after the whole build and all its checks have passed.
import crypto from "node:crypto";
import { THEMES } from "./tema.mjs";
import { buildLayout, pieceSvg } from "./cabecera.mjs";
import { esc } from "./texto.mjs";
import { LAYOUTS, LAYOUT_ORDER, mediaFor, layoutFor, githubColumn, minTextPx, SWEEP, MAX_HEIGHT_RATIO, MAX_SVG, MAX_VISIT, ANIMATED_ROWS } from "./constantes.mjs";

const DARK = "(prefers-color-scheme: dark)";
const REDUCE = "(prefers-reduced-motion: reduce)";

// Which file a visitor gets, in the order the <source> elements are tried.
export function sourceOrder(animated) {
  const combos = [];
  for (const layout of LAYOUT_ORDER) for (const theme of ["dark", "light"]) for (const motion of animated ? ["still", "animated"] : ["still"]) {
    const media = [mediaFor(layout), theme === "dark" ? DARK : null, animated && motion === "still" ? REDUCE : null].filter(Boolean).join(" and ");
    combos.push({ layout, theme, motion, media });
  }
  return combos; // the last one (desk, light) has no media: it is the <img> itself
}

export function build(data, src) {
  const layouts = {};
  for (const layout of LAYOUT_ORDER) for (const theme of ["dark", "light"]) layouts[`${layout}-${theme}`] = buildLayout(data, src, layout, THEMES[theme]);
  // Every composition: no text under the minimum on screen at any viewport it is used for, and no
  // composition but the phone one taller than MAX_HEIGHT_RATIO times its width.
  for (const layout of LAYOUT_ORDER) {
    const lo = layouts[`${layout}-dark`];
    for (let v = SWEEP.from; v <= SWEEP.to; v++) {
      if (layoutFor(v) !== layout) continue;
      const px = lo.minText * githubColumn(v) / lo.W;
      if (px < minTextPx(v)) throw new Error(`the ${layout} layout shows text at ${px.toFixed(2)} px at a ${v} px viewport; the minimum there is ${minTextPx(v)} px`);
    }
    if (layout !== "mob" && lo.height / lo.W > MAX_HEIGHT_RATIO) throw new Error(`the ${layout} layout is ${lo.height} units tall for ${lo.W} wide, over ${MAX_HEIGHT_RATIO} times its width`);
  }
  const files = [];
  const desk = layouts["desk-dark"];
  for (const [r, row] of desk.rows.entries()) {
    const animated = ANIMATED_ROWS.includes(row.id);
    for (const [p, piece] of row.pieces.entries()) {
      for (const layout of LAYOUT_ORDER) for (const theme of ["dark", "light"]) for (const motion of animated ? ["animated", "still"] : ["still"]) {
        const lo = layouts[`${layout}-${theme}`];
        const lrow = lo.rows[r], lpiece = lrow.pieces[p];
        if (lpiece.id !== piece.id) throw new Error(`layouts disagree on piece ${piece.id}`);
        const { svg, texts } = pieceSvg(src, THEMES[theme], lrow, lpiece, motion);
        const hash = crypto.createHash("sha256").update(svg).digest("hex").slice(0, 8);
        const base = `${piece.id}-${layout}-${theme}${animated && motion === "still" ? "-still" : ""}`;
        files.push({ name: `${base}-${hash}.svg`, base, content: svg, bytes: Buffer.byteLength(svg), row: row.id, piece: piece.id, layout, theme, motion, animated,
          viewX: lpiece.x, viewW: lpiece.w, viewH: lrow.h, texts });
      }
    }
  }
  // Size checks.
  for (const f of files) if (f.bytes > MAX_SVG) throw new Error(`${f.base}: ${(f.bytes / 1024).toFixed(1)} KB, over the ${MAX_SVG / 1024} KB cap`);
  const visits = [];
  for (const layout of LAYOUT_ORDER) for (const theme of ["dark", "light"]) for (const reduce of [false, true]) {
    const pick = files.filter((f) => f.layout === layout && f.theme === theme && (!f.animated || f.motion === (reduce ? "still" : "animated")));
    const bytes = pick.reduce((s, f) => s + f.bytes, 0);
    visits.push({ layout, theme, reduce, files: pick.length, bytes });
    if (bytes > MAX_VISIT) throw new Error(`one visit (${layout}, ${theme}${reduce ? ", reduced motion" : ""}) loads ${(bytes / 1048576).toFixed(2)} MB, over the ${MAX_VISIT / 1048576} MB cap`);
  }
  // README: four rows of linked <picture> elements with no whitespace between tags, each image
  // aligned to the top so the rows sit flush.
  const find = (piece, layout, theme, motion) => files.find((f) => f.piece === piece && f.layout === layout && f.theme === theme && f.motion === motion);
  const rowsHtml = desk.rows.map((row) => row.pieces.map((piece) => {
    const animated = ANIMATED_ROWS.includes(row.id);
    const order = sourceOrder(animated);
    const fallback = order.pop();
    const sources = order.map((c) => `<source media="${c.media}" srcset="assets/${find(piece.id, c.layout, c.theme, animated ? c.motion : "still").name}">`).join("");
    const img = find(piece.id, fallback.layout, fallback.theme, animated ? fallback.motion : "still");
    const pct = ((piece.w / desk.W) * 100).toFixed(4) + "%";
    return `<a href="${esc(piece.href)}"><picture>${sources}<img alt="${esc(piece.alt)}" width="${pct}" align="top" src="assets/${img.name}"></picture></a>`;
  }).join("")).join("<br>");
  const readme = `<!-- Generated by generador/generar.mjs from datos/perfil.en.json. Do not edit by hand. -->\n\n<p>${rowsHtml}</p>\n`;
  const sizes = Object.fromEntries(LAYOUT_ORDER.map((l) => [l, { width: LAYOUTS[l].width, height: layouts[`${l}-dark`].height, minText: layouts[`${l}-dark`].minText }]));
  return { files, readme, visits, layouts, sizes };
}
