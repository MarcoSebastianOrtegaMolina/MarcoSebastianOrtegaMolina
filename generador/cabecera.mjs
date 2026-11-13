// The header: «PORTFOLIO.EXE» as a small window, cut into rows of images that sit flush in the README.
//   row 1  title bar and six tabs        six pieces, one link each
//   row 2  hero: name, role, title, pitch and the animated avatar   one piece
//   row 3  three buttons                  three thirds, one link each
//   row 4  status LED and the bottom edge of the window              one piece
// Every row is drawn once in its own coordinates; each piece is a viewBox window onto it, so the
// grid, the title text and the borders continue across pieces. Two layouts share the same piece
// widths (in percent): "desk" (846 units wide) and "mob" (324 units, 1 unit = 1 CSS px at a
// 390 px wide phone, where GitHub's README column is 324 px).
import fs from "node:fs";
import path from "node:path";
import { esc, measure, wrap, textEl, n, FACES } from "./texto.mjs";
import { avatarAnimated, avatarInner, AVATAR_W, AVATAR_H } from "./avatar.mjs";

const SPEC = {
  desk: {
    W: 846, sx: 4, sy: 5, titleH: 34, tabsH: 42, sq: 10, padL: 14, titleFont: 12, titleLS: 0.48, titleGap: 10,
    ctlW: 18, ctlH: 16, ctlGap: 5, ctlPad: 10, ctlIcon: 10,
    tabFont: 14, tabIcon: 15, tabGap: 8, tabPad: 13, tabsPadL: 12, icons: true,
  },
  mob: {
    W: 324, sx: 4, sy: 5, titleH: 30, tabsH: 34, sq: 9, padL: 10, titleFont: 11.2, titleLS: 0.45, titleGap: 8,
    ctlW: 15, ctlH: 13, ctlGap: 4, ctlPad: 8, ctlIcon: 9,
    tabFont: 11.2, tabIcon: 0, tabGap: 0, tabPad: 5, tabsPadL: 2, icons: false,
  },
};

const FONT_SRC = {
  SG: [["space-grotesk-latin-var.woff2", "300 700"]],
  SM: [["space-mono-400-latin.woff2", "400"], ["space-mono-700-latin.woff2", "700"]],
  IN: [["inter-latin-var.woff2", "100 900"]],
};
const FACE_FILE = { "sg-500": ["SG", 0], "sg-600": ["SG", 0], "mono-400": ["SM", 0], "mono-700": ["SM", 1], "inter-400": ["IN", 0], "inter-600": ["IN", 0] };

export function loadSources(dir) {
  const fonts = {};
  for (const [fam, files] of Object.entries(FONT_SRC)) fonts[fam] = files.map(([f, w]) => ({ weight: w, b64: fs.readFileSync(path.join(dir, "fonts", f)).toString("base64") }));
  const icons = {};
  for (const f of fs.readdirSync(path.join(dir, "icons")).filter((x) => x.endsWith(".svg"))) {
    const s = fs.readFileSync(path.join(dir, "icons", f), "utf8");
    const d = [...s.matchAll(/<path[^>]* d="([^"]+)"/g)].map((m) => m[1]);
    if (!d.length) throw new Error(`icon ${f}: no path found`);
    icons[f.replace(/\.svg$/, "")] = d;
  }
  return { fonts, icons, avatar: fs.readFileSync(path.join(dir, "avatar-marco.svg"), "utf8") };
}

const TAB_ICON = { home: "inicio", projects: "code", stack: "cpu", experience: "ai-chatbot", about: "file-text", contact: "contacto" };
const BUTTON_ICON = { projects: "monitor", contact: "contacto", cv: "descargar" };

// ---------- drawing helpers (all coordinates in the row's own units) ----------
const rect = (x, y, w, h, fill, extra = "") => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}"${extra}/>`;
const icon = (src, name, x, y, size, fill) => `<g transform="translate(${n(x)} ${n(y)}) scale(${n(size / 24)})" fill="${fill}">${src.icons[name].map((d) => `<path d="${d}"/>`).join("")}</g>`;
// Bevel of a raised control: light line top and left, dark line bottom and right, 1 unit inside.
const bevel = (x, y, w, h, hi, lo) => rect(x, y, w, 1, hi) + rect(x, y, 1, h, hi) + rect(x, y + h - 1, w, 1, lo) + rect(x + w - 1, y, 1, h, lo);
// Baseline that centres a line of text (cap height about 0.7 em) on y.
const mid = (y, size) => y + size * 0.35;

// A text item: markup plus what the tests need (extent, size, faces, colors).
function textItem(x, y, runs, size, opts = {}) {
  const spacing = opts.spacing || 0;
  const width = runs.reduce((s, r) => s + measure(r.text, r.face, size, spacing), 0);
  const x0 = opts.anchor === "middle" ? x - width / 2 : x;
  let at = x0;
  const spans = runs.map((r) => { const w = measure(r.text, r.face, size, spacing); const o = { ...r, x0: at, x1: at + w }; at += w; return o; });
  return { kind: "text", x0, x1: x0 + width, y0: y - size * 0.75, y1: y + size * 0.25, size, runs: spans, label: opts.label || runs.map((r) => r.text).join(""), markup: textEl(x, y, runs, size, opts) };
}
const shape = (markup) => ({ kind: "shape", markup });

// ---------- shared geometry ----------
function tabGeometry(data, s, other) {
  // Width each tab needs in this layout and in the other one; the piece gets the larger share.
  const need = (spec, k) => {
    const t = data.tabs[k];
    const tw = measure(t.label, k === 0 ? "sg-600" : "sg-500", spec.tabFont);
    let w = tw + (spec.icons ? spec.tabIcon + spec.tabGap : 0) + 2 * spec.tabPad;
    if (k === 0) w += 1 + spec.tabsPadL;
    if (k === data.tabs.length - 1) w += 1 + spec.sx + 2;
    return w / spec.W;
  };
  const f = data.tabs.map((_, k) => Math.max(need(s, k), need(other, k)));
  const total = f.reduce((a, b) => a + b, 0);
  if (total > 1) throw new Error(`the six tab labels do not fit in one row (${(total * 100).toFixed(1)} % of the width)`);
  // Desktop widths are whole units; the leftover goes to the last tab, where the empty end of the bar is.
  const D = SPEC.desk.W;
  const wd = f.map((x) => Math.ceil(x * D));
  wd[wd.length - 1] = D - wd.slice(0, -1).reduce((a, b) => a + b, 0);
  return wd.map((w) => w / D);
}

export function buildLayout(data, src, layout, theme) {
  const s = SPEC[layout];
  const T = theme;
  const W = s.W, win = W - s.sx; // window spans 0..win; the hard shadow fills win..W and the bottom
  const line = `rgba(${T.ink},.14)`, lineStrong = `rgba(${T.ink},.32)`;
  const fracs = tabGeometry(data, s, layout === "desk" ? SPEC.mob : SPEC.desk);
  const rows = [];

  // Side borders of the window and the shadow strip on the right, for a row of height h.
  // top: y where the shadow strip starts in this row (the shadow is offset 5 units down).
  const sides = (h, top = 0) => rect(win, top, s.sx, h - top, T.shade) + rect(0, 0, 1, h, lineStrong) + rect(win - 1, 0, 1, h, lineStrong);

  // ---------- row 1: title bar and tabs ----------
  {
    const h = 1 + s.titleH + s.tabsH;
    const items = [];
    const tbTop = 1, tbMid = tbTop + (s.titleH - 1) / 2;
    items.push(shape(rect(0, 0, win, h, T.bg2) + rect(0, tbTop, win, s.titleH, T.bg3) + rect(0, tbTop + s.titleH - 1, win, 1, line)));
    items.push(shape(sides(h, s.sy) + rect(0, 0, win, 1, lineStrong) + rect(1, 1, win - 2, 2, T.red)));
    // Red square with its inset shadow, then the title.
    const sqx = 1 + s.padL, sqy = tbMid - s.sq / 2;
    items.push(shape(rect(sqx, sqy, s.sq, s.sq, T.red) + rect(sqx + s.sq - 2, sqy, 2, s.sq, "rgba(0,0,0,.35)") + rect(sqx, sqy + s.sq - 2, s.sq - 2, 2, "rgba(0,0,0,.35)")));
    items.push(textItem(sqx + s.sq + s.titleGap, mid(tbMid, s.titleFont), [
      { text: data.window.title, face: "mono-700", fill: T.fg },
      { text: data.window.titleAccent, face: "mono-700", fill: T.redInk },
    ], s.titleFont, { spacing: s.titleLS, label: "window title" }));
    // Minimize, maximize and close.
    let cx = win - 1 - s.ctlPad - s.ctlW;
    const cy = tbMid - s.ctlH / 2;
    const ctl = [];
    for (let i = 2; i >= 0; i--) {
      let g = rect(cx, cy, s.ctlW, s.ctlH, T.bg4) + bevel(cx, cy, s.ctlW, s.ctlH, T.bevelHi, T.bevelLo);
      const k = s.ctlW / 18;
      if (i === 0) g += rect(cx + 5 * k, cy + s.ctlH - 4 * k - 2 * k, s.ctlW - 10 * k, 2 * k, T.muted);
      if (i === 1) g += `<rect x="${n(cx + 5 * k + 0.75)}" y="${n(cy + 4 * k + 0.75)}" width="${n(s.ctlW - 10 * k - 1.5)}" height="${n(s.ctlH - 8 * k - 1.5)}" fill="none" stroke="${T.muted}" stroke-width="1.5"/>`;
      if (i === 2) g += icon(src, "close", cx + 4 * k, cy + 3 * k, s.ctlIcon, T.muted);
      ctl.push(g);
      cx -= s.ctlW + s.ctlGap;
    }
    items.push(shape(ctl.join("")));
    // Tabs.
    const tTop = tbTop + s.titleH, tH = s.tabsH - 1;
    items.push(shape(rect(0, tTop + s.tabsH - 1, win, 1, line)));
    const pieces = [];
    let x = 0;
    data.tabs.forEach((t, k) => {
      const w = fracs[k] * W;
      const on = k === 0, last = k === data.tabs.length - 1;
      const face = on ? "sg-600" : "sg-500";
      const tw = measure(t.label, face, s.tabFont);
      const content = tw + (s.icons ? s.tabIcon + s.tabGap : 0);
      const spanX = k === 0 ? x + 1 + s.tabsPadL : x;
      const spanW = last ? content + 2 * s.tabPad : (x + w) - spanX;
      const cx0 = spanX + (spanW - content) / 2;
      const ym = tTop + tH / 2;
      if (on) items.push(shape(rect(spanX, tTop, spanW, tH, T.bg3) + rect(spanX, tTop + tH - 2, spanW, 2, T.red)));
      if (s.icons) items.push(shape(icon(src, TAB_ICON[t.id], cx0, ym - s.tabIcon / 2, s.tabIcon, on ? T.red : T.muted)));
      items.push(textItem(cx0 + (s.icons ? s.tabIcon + s.tabGap : 0), mid(ym, s.tabFont), [{ text: t.label, face, fill: on ? T.fg : T.fg2 }], s.tabFont, { label: `tab ${t.label}` }));
      pieces.push({ id: `tab-${t.id}`, x, w: last ? W - x : w, href: t.href, alt: t.label });
      x += w;
    });
    rows.push({ id: "tabs", h, items, pieces });
  }

  // ---------- row 2: hero ----------
  {
    const D = layout === "desk";
    const items = [];
    const runsTitle = (l) => [{ text: l.lead + " ", face: "sg-600", fill: T.fg }, { text: l.accent, face: "sg-600", fill: l === data.hero.titleLine2 ? T.redInk : T.muted }];
    const pitchRuns = data.hero.pitch.map((p) => ({ text: p.text, face: p.strong ? "inter-600" : "inter-400", fill: p.strong ? T.fg : T.fg2 }));
    let h, av;
    const left = D ? 38 : 16;
    if (D) {
      // Positions follow the sketch (CSS of boceto 3), moved down 14 units; the avatar sits at the right.
      const size = 272, dy = 14;
      h = 296;
      av = { x: win - 1 - 24 - size, y: 10, w: size, h: size * AVATAR_H / AVATAR_W };
      const maxText = av.x - 16 - left;
      items.push(textItem(left, 51 + dy, [{ text: data.hero.name, face: "sg-600", fill: T.fg }], 16, { label: "name" }));
      items.push(textItem(left, 73.5 + dy, [{ text: data.hero.role.toUpperCase(), face: "mono-700", fill: T.redInk }], 10.5, { spacing: 1.68, label: "role" }));
      items.push(textItem(left, 132.5 + dy, runsTitle(data.hero.titleLine1), 44, { spacing: -1.32, label: "title line 1" }));
      items.push(textItem(left, 177.5 + dy, runsTitle(data.hero.titleLine2), 44, { spacing: -1.32, label: "title line 2" }));
      const lines = wrap(pitchRuns, 14.5, Math.min(430, maxText));
      if (lines.length > 2) throw new Error(`hero.pitch needs ${lines.length} lines on desktop; the layout has room for 2`);
      lines.forEach((l, i) => items.push(textItem(left, 221 + dy + i * 23.2, l.runs, 14.5, { label: `pitch line ${i + 1}` })));
      for (const it of items) if (it.kind === "text" && it.x1 > left + maxText) throw new Error(`"${it.label}" is too long for the desktop header (${(it.x1 - left).toFixed(0)} of ${maxText.toFixed(0)} units)`);
    } else {
      // Phone: the avatar large on top, the text below it.
      const size = 236, maxText = win - 1 - 2 * 16;
      av = { x: (win - size) / 2, y: 16, w: size, h: size * AVATAR_H / AVATAR_W };
      let y = av.y + av.h + 30;
      items.push(textItem(left, y, [{ text: data.hero.name, face: "sg-600", fill: T.fg }], 16, { label: "name" }));
      const role = wrap([{ text: data.hero.role.toUpperCase(), face: "mono-700", fill: T.redInk }], 11.2, maxText, 1.34);
      for (const l of role) { y += 21; items.push(textItem(left, y, l.runs, 11.2, { spacing: 1.34, label: "role" })); }
      y += 46;
      items.push(textItem(left, y, runsTitle(data.hero.titleLine1), 36, { spacing: -1.08, label: "title line 1" }));
      y += 38;
      items.push(textItem(left, y, runsTitle(data.hero.titleLine2), 36, { spacing: -1.08, label: "title line 2" }));
      const lines = wrap(pitchRuns, 14, maxText);
      if (lines.length > 4) throw new Error(`hero.pitch needs ${lines.length} lines on the phone layout; the layout has room for 4`);
      y += 14;
      lines.forEach((l) => { y += 22; items.push(textItem(left, y, l.runs, 14, { label: "pitch" })); });
      h = y + 26;
      for (const it of items) if (it.kind === "text" && it.x1 > left + maxText) throw new Error(`"${it.label}" is too long for the phone header (${(it.x1 - left).toFixed(0)} of ${maxText.toFixed(0)} units)`);
    }
    const body = shape(rect(0, 0, win, h, T.bg) + rect(0, 0, win, h, "url(#g)") + sides(h));
    rows.push({ id: "hero", h, items: [body, ...items], pieces: [{ id: "hero", x: 0, w: W, href: data.cv, alt: data.hero.alt }], avatar: av });
  }

  // ---------- row 3: buttons, one per third ----------
  {
    const D = layout === "desk";
    const h = D ? 58 : 76, bh = D ? 40 : 58;
    // Equal buttons, each inside its own third: start and end margins mirror each other.
    const L = D ? 38 : 10, gap = D ? 24 : 14;
    const bw = (win - 2 * L - 2 * gap) / 3;
    const items = [shape(rect(0, 0, win, h, T.bg) + rect(0, 0, win, h, "url(#g)") + sides(h))];
    const pieces = [];
    data.buttons.forEach((b, k) => {
      const x = L + k * (bw + gap), y = 0;
      const third = W / 3;
      if (x < k * third - 0.01 || x + bw + s.sx > (k + 1) * third + 0.01) throw new Error("button geometry: a button crosses its third");
      const primary = k === 0;
      const fill = primary ? T.red : T.bg4, txt = primary ? T.onRed : T.fg;
      const hi = primary ? "rgba(255,255,255,.25)" : T.bevelHi, lo = primary ? "rgba(0,0,0,.3)" : T.bevelLo;
      const shadow = primary ? "rgba(255,32,32,.28)" : T.shade;
      const border = primary ? T.red : lineStrong;
      let g = rect(x + 4, y + 5, bw, bh, shadow) + rect(x, y, bw, bh, fill) + `<rect x="${n(x + 0.5)}" y="${n(y + 0.5)}" width="${n(bw - 1)}" height="${n(bh - 1)}" fill="none" stroke="${border}"/>` + bevel(x + 1, y + 1, bw - 2, bh - 2, hi, lo);
      const label = b.label.toUpperCase();
      if (D) {
        const size = 11, ls = 0.88, isz = 15, igap = 8;
        const tw = measure(label, "mono-700", size, ls) - ls;
        const content = isz + igap + tw;
        if (content > bw - 26) throw new Error(`button "${b.label}" is too long for the desktop header`);
        const cx0 = x + (bw - content) / 2;
        g += icon(src, BUTTON_ICON[b.id], cx0, y + bh / 2 - isz / 2, isz, txt);
        items.push(shape(g));
        items.push(textItem(cx0 + isz + igap, mid(y + bh / 2, size), [{ text: label, face: "mono-700", fill: txt }], size, { spacing: ls, label: `button ${b.label}` }));
      } else {
        const size = 11.2, ls = 0.45, isz = 14, lh = 13.5;
        const lines = wrap([{ text: label, face: "mono-700", fill: txt }], size, bw - 10, ls);
        if (lines.length > 2) throw new Error(`button "${b.label}" needs more than two lines on the phone layout`);
        const block = isz + 7 + lines.length * lh;
        let yy = y + (bh - block) / 2;
        g += icon(src, BUTTON_ICON[b.id], x + bw / 2 - isz / 2, yy, isz, txt);
        items.push(shape(g));
        yy += isz + 7;
        lines.forEach((l) => { items.push(textItem(x + bw / 2 + ls / 2, mid(yy + lh / 2, size), l.runs, size, { spacing: ls, anchor: "middle", label: `button ${b.label}` })); yy += lh; });
      }
      pieces.push({ id: `btn-${b.id}`, x: k * W / 3, w: W / 3, href: b.href, alt: b.label });
    });
    rows.push({ id: "buttons", h, items, pieces, grid: true });
  }

  // ---------- row 4: status and the bottom of the window ----------
  {
    const D = layout === "desk";
    const winBottom = D ? 59 : 41, h = winBottom + s.sy;
    const base = D ? 20 : 22, size = D ? 12.5 : 11.5, left = D ? 38 : 16;
    const items = [shape(rect(win, 0, s.sx, h, T.shade) + rect(s.sx, winBottom, W - s.sx, s.sy, T.shade) + rect(0, 0, win, winBottom, T.bg) + rect(0, 0, win, winBottom, "url(#g)") +
      rect(0, 0, 1, winBottom, lineStrong) + rect(win - 1, 0, 1, winBottom, lineStrong) + rect(0, winBottom - 1, win, 1, lineStrong))];
    const ly = base - size * 0.35;
    // LED: 8 unit dot, 2 unit ring at 18 %, soft glow at 35 % (CSS box-shadows of .led).
    items.push(shape(`<defs><radialGradient id="glow"><stop offset="0" stop-color="#ff2020" stop-opacity=".35"/><stop offset="1" stop-color="#ff2020" stop-opacity="0"/></radialGradient></defs>` +
      `<g class="led"><circle cx="${n(left + 4)}" cy="${n(ly)}" r="12" fill="url(#glow)"/><circle cx="${n(left + 4)}" cy="${n(ly)}" r="6" fill="rgba(255,32,32,.18)"/><circle cx="${n(left + 4)}" cy="${n(ly)}" r="4" fill="#ff2020"/></g>`));
    const runs = data.status.parts.map((p) => ({ text: p.text, face: p.strong ? "mono-700" : "mono-400", fill: p.strong ? T.fg : T.fg2 }));
    const it = textItem(left + 18, base, runs, size, { label: "status" });
    if (it.x1 > win - 1 - left) throw new Error("status is too long for the header");
    items.push(it);
    rows.push({ id: "status", h, items, pieces: [{ id: "status", x: 0, w: W, href: data.status.href, alt: data.status.alt }], grid: true, winBottom });
  }
  // Grid lines sit 47 units below the top of the window body and every 48 after (CSS offset of -1 px).
  let off = 0;
  for (const r of rows.slice(1)) { r.gridY = (((47 - off) % 48) + 48) % 48; off += r.h; }
  return { spec: s, W, rows };
}

// ---------- SVG of one piece ----------
function fontCss(src, faces) {
  const fams = {};
  for (const f of faces) { const [fam, i] = FACE_FILE[f]; (fams[fam] ||= new Set()).add(i); }
  let css = "";
  for (const fam of Object.keys(fams).sort()) for (const i of [...fams[fam]].sort()) {
    const f = src.fonts[fam][i];
    css += `@font-face{font-family:${fam};src:url(data:font/woff2;base64,${f.b64}) format('woff2');font-weight:${f.weight}}`;
  }
  return css;
}

// motion: "animated" or "still". Returns the SVG and the text items inside it.
export function pieceSvg(src, theme, layoutObj, row, piece, motion) {
  const { W } = layoutObj;
  const h = row.h;
  const x0 = piece.x, x1 = piece.x + piece.w;
  const texts = row.items.filter((it) => it.kind === "text" && it.x1 > x0 - 1 && it.x0 < x1 + 1);
  const faces = new Set(texts.flatMap((t) => t.runs.map((r) => r.face)));
  let css = fontCss(src, faces);
  let defs = row.id === "tabs" ? "" : `<defs>${`<pattern id="g" width="48" height="48" patternUnits="userSpaceOnUse" x="0" y="${n(row.gridY)}"><rect width="48" height="1" fill="rgba(${theme.ink},.04)"/><rect width="1" height="48" fill="rgba(${theme.ink},.04)"/></pattern>`}</defs>`;
  let body = row.items.filter((it) => it.kind === "shape" || texts.includes(it)).map((it) => it.markup).join("");
  if (row.id === "hero") {
    const a = row.avatar;
    const open = `<svg x="${n(a.x)}" y="${n(a.y)}" width="${n(a.w)}" height="${n(a.h)}" viewBox="0 0 ${AVATAR_W} ${AVATAR_H}">`;
    if (motion === "animated") {
      const an = avatarAnimated(src.avatar, theme, theme.bg);
      css += an.css;
      body += `${open}<defs>${an.defs}</defs>${an.markup}</svg>`;
    } else body += `${open}${avatarInner(src.avatar, theme)}</svg>`;
  }
  if (row.id === "status" && motion === "animated") css += `.led{animation:led 1.6s steps(1,end) infinite}@keyframes led{0%{opacity:1}50%{opacity:.25}}`;
  if (motion === "animated") css += `@media (prefers-reduced-motion:reduce){*{animation:none!important}.avq{display:none}}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${n(piece.w)}" height="${n(h)}" viewBox="${n(x0)} 0 ${n(piece.w)} ${n(h)}"${row.id === "hero" ? ` role="img" aria-label="${esc(piece.alt)}"` : ""}>` +
    (css ? `<style>${css}</style>` : "") + defs + body + `</svg>\n`;
  return { svg, texts: texts.map((t) => ({ label: t.label, y0: t.y0, y1: t.y1, size: t.size,
    runs: t.runs.map((r) => ({ text: r.text, face: r.face, fill: r.fill, x0: Math.max(r.x0, x0), x1: Math.min(r.x1, x1), full: r.x1 - r.x0 })).filter((r) => r.x1 > r.x0) })) };
}
