// Builds every image and both READMEs in memory. Nothing is written here: generar.mjs writes only
// after the whole build and all its checks have passed.
//   header  «PORTFOLIO.EXE», four rows of pieces that sit flush (cabecera.mjs)
//   stack   the «STACK.INI» strip, one image (tira.mjs)
//   projects three project windows (proyectos.mjs)
// Each block is a paragraph of its own, so GitHub leaves the same space between them.
import crypto from "node:crypto";
import { THEMES } from "./tema.mjs";
import { buildLayout, pieceSvg } from "./cabecera.mjs";
import { stripSvg } from "./tira.mjs";
import { projectPieces } from "./proyectos.mjs";
import { esc } from "./texto.mjs";
import { LAYOUTS, LAYOUT_ORDER, mediaFor, layoutFor, githubColumn, minTextPx, SWEEP, MAX_HEIGHT_RATIO, MAX_SVG, MAX_VISIT, ANIMATED_ROWS } from "./constantes.mjs";

const DARK = "(prefers-color-scheme: dark)";
const REDUCE = "(prefers-reduced-motion: reduce)";
export const README_FILE = { en: "README.md", es: "README.es.md" };
// The discreet link at the top of each README to the other language.
const OTHER = { en: { lang: "es", label: "Español" }, es: { lang: "en", label: "English" } };

// Which file a visitor gets, in the order the <source> elements are tried.
export function sourceOrder(animated) {
  const combos = [];
  for (const layout of LAYOUT_ORDER) for (const theme of ["dark", "light"]) for (const motion of animated ? ["still", "animated"] : ["still"]) {
    const media = [mediaFor(layout), theme === "dark" ? DARK : null, animated && motion === "still" ? REDUCE : null].filter(Boolean).join(" and ");
    combos.push({ layout, theme, motion, media });
  }
  return combos; // the last one (desk, light) has no media: it is the <img> itself
}

const hash = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 8);
const key = (layout, theme, motion) => `${layout}-${theme}-${motion}`;
const THEME_NAMES = ["dark", "light"];

function buildLang(data, src) {
  const lang = data.lang;
  const layouts = {};
  for (const layout of LAYOUT_ORDER) for (const theme of THEME_NAMES) layouts[`${layout}-${theme}`] = buildLayout(data, src, layout, THEMES[theme]);
  // No header composition but the phone one taller than MAX_HEIGHT_RATIO times its width.
  for (const layout of LAYOUT_ORDER) {
    const lo = layouts[`${layout}-dark`];
    if (layout !== "mob" && lo.height / lo.W > MAX_HEIGHT_RATIO) throw new Error(`[${lang}] the ${layout} layout is ${lo.height} units tall for ${lo.W} wide, over ${MAX_HEIGHT_RATIO} times its width`);
  }
  const files = [];
  const add = (pic, f) => {
    f.name = `${f.base}-${hash(f.content)}.svg`;
    f.bytes = Buffer.byteLength(f.content);
    f.lang = lang;
    pic.files[key(f.layout, f.theme, f.motion)] = f;
    files.push(f);
  };
  // Header: one picture per piece of the desktop rows.
  const desk = layouts["desk-dark"];
  const header = desk.rows.map((row, r) => row.pieces.map((piece, p) => {
    const animated = ANIMATED_ROWS.includes(row.id);
    const pic = { id: piece.id, section: "header", animated, alt: piece.alt, href: piece.href, files: {} };
    for (const layout of LAYOUT_ORDER) for (const theme of THEME_NAMES) for (const motion of animated ? ["animated", "still"] : ["still"]) {
      const lo = layouts[`${layout}-${theme}`];
      const lrow = lo.rows[r], lpiece = lrow.pieces[p];
      if (lpiece.id !== piece.id) throw new Error(`layouts disagree on piece ${piece.id}`);
      const { svg, texts } = pieceSvg(src, THEMES[theme], lrow, lpiece, motion);
      add(pic, { base: `${lang}-${piece.id}-${layout}-${theme}${animated && motion === "still" ? "-still" : ""}`, content: svg, section: "header", row: row.id, piece: piece.id, layout, theme, motion, animated,
        viewX: lpiece.x, viewW: lpiece.w, viewH: lpiece.h ?? lrow.h, pct: lpiece.pct ?? (lpiece.w / lo.W) * 100, texts });
    }
    return pic;
  }));
  // Tech strip.
  const strip = { id: "stack", section: "stack", animated: false, alt: `${data.stack.altLead}: ${data.stack.items.map((i) => i.name).join(", ")}`, href: data.stack.href, files: {} };
  for (const layout of LAYOUT_ORDER) for (const theme of THEME_NAMES) {
    const s = stripSvg(data, src, layout, THEMES[theme]);
    add(strip, { base: `${lang}-stack-${layout}-${theme}`, content: s.svg, section: "stack", row: "stack", piece: "stack", layout, theme, motion: "still", animated: false,
      viewX: 0, viewW: s.W, viewH: s.h, pct: 100, texts: s.texts, logos: s.logos });
  }
  // Featured projects.
  const projects = data.projects.filter((p) => p.featured).map((p) => ({ id: `proj-${p.slug}`, section: "projects", animated: false, alt: `${p.title}. ${p.sub}`, href: p.href, files: {} }));
  for (const layout of LAYOUT_ORDER) for (const theme of THEME_NAMES) {
    projectPieces(data, src, layout, THEMES[theme]).forEach((pc, k) => add(projects[k], { base: `${lang}-${pc.id}-${layout}-${theme}`, content: pc.svg, section: "projects", row: "projects", piece: pc.id,
      layout, theme, motion: "still", animated: false, viewX: pc.x, viewW: pc.w, viewH: pc.h, pct: pc.pct, texts: pc.texts, cover: pc.cover }));
  }
  // Every image: no text under the minimum on screen at any viewport its layout is used for.
  for (const f of files) {
    if (!f.texts.length) continue;
    const min = Math.min(...f.texts.map((t) => t.size));
    for (let v = SWEEP.from; v <= SWEEP.to; v++) {
      if (layoutFor(v) !== f.layout) continue;
      const px = min * (f.pct / 100) * githubColumn(v) / f.viewW;
      if (px < minTextPx(v)) throw new Error(`${f.base} shows text at ${px.toFixed(2)} px at a ${v} px viewport; the minimum there is ${minTextPx(v)} px`);
    }
  }
  for (const f of files) if (f.bytes > MAX_SVG) throw new Error(`${f.base}: ${(f.bytes / 1024).toFixed(1)} KB, over the ${MAX_SVG / 1024} KB cap`);
  // One visit: one file of each picture for a layout, theme and reduced-motion setting.
  const pics = [...header.flat(), strip, ...projects];
  const visits = [];
  for (const layout of LAYOUT_ORDER) for (const theme of THEME_NAMES) for (const reduce of [false, true]) {
    const pick = pics.map((pic) => pic.files[key(layout, theme, pic.animated && !reduce ? "animated" : "still")]);
    const bytes = pick.reduce((s, f) => s + f.bytes, 0);
    visits.push({ lang, layout, theme, reduce, files: pick.length, bytes });
    if (bytes > MAX_VISIT) throw new Error(`[${lang}] one visit (${layout}, ${theme}${reduce ? ", reduced motion" : ""}) loads ${(bytes / 1048576).toFixed(2)} MB, over the ${MAX_VISIT / 1048576} MB cap`);
  }
  // README: linked <picture> elements with no whitespace between tags, each image aligned to the
  // top so the rows sit flush. Every <source> carries its own width: the phone shows the tabs three
  // per line and stacks the projects.
  const pct = (x) => x.toFixed(4) + "%";
  const pictureHtml = (pic) => {
    const order = sourceOrder(pic.animated);
    const fallback = order.pop();
    const file = (c) => pic.files[key(c.layout, c.theme, pic.animated ? c.motion : "still")];
    const sources = order.map((c) => `<source media="${c.media}" srcset="assets/${file(c).name}" width="${pct(file(c).pct)}">`).join("");
    const img = file(fallback);
    return `<a href="${esc(pic.href)}"><picture>${sources}<img alt="${esc(pic.alt)}" width="${pct(img.pct)}" align="top" src="assets/${img.name}"></picture></a>`;
  };
  const other = OTHER[lang];
  const readme = `<!-- Generated by generador/generar.mjs from datos/perfil.${lang}.json. Do not edit by hand. -->\n\n` +
    `<p align="right"><sub><a href="${README_FILE[other.lang]}">${other.label}</a></sub></p>\n\n` +
    `<p>${header.map((row) => row.map(pictureHtml).join("")).join("<br>")}</p>\n\n` +
    `<p>${pictureHtml(strip)}</p>\n\n` +
    `<p>${projects.map(pictureHtml).join("")}</p>\n`;
  const sizes = Object.fromEntries(LAYOUT_ORDER.map((l) => [l, { width: LAYOUTS[l].width, height: layouts[`${l}-dark`].height, minText: layouts[`${l}-dark`].minText }]));
  return { lang, files, readme, visits, layouts, sizes, pics };
}

// Both languages. Files with the same name (same content) are written once.
export function build(datas, src) {
  const langs = {};
  for (const [lang, data] of Object.entries(datas)) langs[lang] = buildLang(data, src);
  const byName = new Map();
  for (const r of Object.values(langs)) for (const f of r.files) byName.set(f.name, f);
  const readmes = Object.fromEntries(Object.values(langs).map((r) => [README_FILE[r.lang], r.readme]));
  return { langs, files: [...byName.values()], readmes, visits: Object.values(langs).flatMap((r) => r.visits) };
}
