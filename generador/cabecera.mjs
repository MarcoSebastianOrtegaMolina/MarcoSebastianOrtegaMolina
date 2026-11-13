// The header: «PORTFOLIO.EXE» as a small window, cut into rows of images that sit flush in the README.
//   row 1  title bar and six tabs        six pieces, one link each
//   row 2  hero: name, role, title, pitch and the animated avatar   one piece
//   row 3  three buttons                  three thirds, one link each
//   row 4  status LED and the bottom edge of the window              one piece
// Every row is drawn once in its own coordinates; each piece is a viewBox window onto it, so the
// grid, the title text and the borders continue across pieces. Three compositions (constantes.mjs)
// share the same piece widths in percent: the img width in the README cannot change with the source.
import fs from "node:fs";
import path from "node:path";
import { esc, measure, wrap, textEl, n } from "./texto.mjs";
import { avatarAnimated, avatarStill, AVATAR_W, AVATAR_H } from "./avatar.mjs";
import { LAYOUTS, LAYOUT_ORDER } from "./constantes.mjs";

// Sizes per composition. Desktop text positions follow the CSS of the chosen sketch: baselines
// at 51, 73.5, 132.5, 177.5 and 221 px from the top of the body, moved down 14 units; the role,
// buttons and title bar are a little larger than the sketch so they stay at 11 px or more on screen.
const SPEC = {
  desk: {
    sx: 4, sy: 5, titleH: 34, tabsH: 42, sq: 10, padL: 14, titleFont: 12.2, titleLS: 0.49, titleGap: 10,
    ctlW: 18, ctlH: 16, ctlGap: 5, ctlPad: 10, ctlIcon: 10,
    tabFont: 14, tabIcon: 15, tabGap: 8, tabPad: 13, tabsPadL: 12, icons: true,
    hero: {
      kind: "columns", height: 296, left: 38, avatar: 272, avatarY: 10, avatarRight: 24, textGap: 16,
      nameSize: 16, firstBaseline: 65, roleSize: 12.2, roleLS: 1.95, roleGap: 22.5, roleLH: 16,
      titleSize: 44, titleLS: -1.32, titleGap: 59, titleLineGap: 45,
      pitchSize: 14.5, pitchGap: 43.5, pitchLH: 23.2, pitchMax: 430, pitchLines: 2,
    },
    buttons: { style: "inline", h: 58, bh: 40, L: 38, gap: 24, size: 12.2, ls: 0.98, icon: 15, iconGap: 8, pad: 13 },
    status: { winBottom: 59, base: 20, size: 12.5, left: 38 },
  },
  tab: {
    sx: 3, sy: 4, titleH: 30, tabsH: 34, sq: 9, padL: 10, titleFont: 11.2, titleLS: 0.45, titleGap: 8,
    ctlW: 15, ctlH: 13, ctlGap: 4, ctlPad: 8, ctlIcon: 9,
    tabFont: 11.6, tabIcon: 0, tabGap: 0, tabPad: 4, tabsPadL: 4, icons: false,
    hero: {
      kind: "columns", left: 22, avatar: 140, avatarRight: 16, avatarMargin: 14, textGap: 12, bottom: 20,
      nameSize: 13.5, firstBaseline: 38, roleSize: 11.2, roleLS: 1.12, roleGap: 20, roleLH: 15,
      titleSize: 27, titleLS: -0.81, titleGap: 38, titleLineGap: 29,
      pitchSize: 12.4, pitchGap: 28, pitchLH: 18.5, pitchMax: 1000, pitchLines: 4,
    },
    buttons: { style: "stack2", h: 75, bh: 58, L: 22, gap: 18, size: 11.2, ls: 0.45, icon: 13, iconGap: 6, lh: 14, minSide: 8 },
    status: { winBottom: 40, base: 21, size: 11.2, left: 22 },
  },
  mob: {
    sx: 4, sy: 5, titleH: 32, tabsH: 36, sq: 9, padL: 10, titleFont: 12.8, titleLS: 0.38, titleGap: 8,
    ctlW: 15, ctlH: 13, ctlGap: 4, ctlPad: 8, ctlIcon: 9,
    tabFont: 12.8, tabIcon: 0, tabGap: 0, tabPad: 2.5, tabsPadL: 1, icons: false, tabGrid: 3, gridH: 34,
    hero: {
      kind: "stacked", left: 16, avatar: 236, avatarY: 16, bottom: 26,
      nameSize: 17, nameGap: 32, roleSize: 12.8, roleLS: 1.28, roleGap: 23, roleLH: 18,
      titleSize: 36, titleLS: -1.08, titleGap: 46, titleLineGap: 38,
      pitchSize: 14.5, pitchGap: 36, pitchLH: 22.5, pitchLines: 5,
    },
    buttons: { style: "stack2", h: 83, bh: 66, L: 10, gap: 14, size: 12.8, ls: 0.3, icon: 14, iconGap: 7, lh: 15, minSide: 8 },
    status: { winBottom: 44, base: 23, size: 12.8, left: 16 },
  },
};

const FONT_SRC = {
  SG: [["space-grotesk-latin-var.woff2", "300 700"]],
  SM: [["space-mono-400-latin.woff2", "400"], ["space-mono-700-latin.woff2", "700"]],
  IN: [["inter-latin-var.woff2", "100 900"]],
};
const FACE_FILE = { "sg-500": ["SG", 0], "sg-600": ["SG", 0], "mono-400": ["SM", 0], "mono-700": ["SM", 1], "inter-400": ["IN", 0], "inter-600": ["IN", 0] };

export const specOf = (layout) => SPEC[layout];

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

// A text that does not fit stops the build with what was measured and what fits.
export function fit(field, layout, width, room) {
  if (width > room + 0.01) throw new Error(`${field} measures ${width.toFixed(1)} units in the ${layout} layout; ${room.toFixed(1)} fit`);
}

// ---------- drawing helpers (all coordinates in the row's own units) ----------
export const rect = (x, y, w, h, fill, extra = "") => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}"${extra}/>`;
export const icon = (src, name, x, y, size, fill) => `<g transform="translate(${n(x)} ${n(y)}) scale(${n(size / 24)})" fill="${fill}">${src.icons[name].map((d) => `<path d="${d}"/>`).join("")}</g>`;
// Bevel of a raised control: light line top and left, dark line bottom and right, 1 unit inside.
export const bevel = (x, y, w, h, hi, lo) => rect(x, y, w, 1, hi) + rect(x, y, 1, h, hi) + rect(x, y + h - 1, w, 1, lo) + rect(x + w - 1, y, 1, h, lo);
// Baseline that centres a line of text (cap height about 0.7 em) on y.
export const mid = (y, size) => y + size * 0.35;

// A text item: markup plus what the tests need (extent of each run, size, faces, colors).
export function textItem(x, y, runs, size, opts = {}) {
  const spacing = opts.spacing || 0;
  const width = runs.reduce((s, r) => s + measure(r.text, r.face, size, spacing), 0);
  const x0 = opts.anchor === "middle" ? x - width / 2 : x;
  let at = x0;
  const spans = runs.map((r) => { const w = measure(r.text, r.face, size, spacing); const o = { ...r, x0: at, x1: at + w }; at += w; return o; });
  return { kind: "text", x0, x1: x0 + width, y0: y - size * 0.75, y1: y + size * 0.25, size, runs: spans, label: opts.label || runs.map((r) => r.text).join(""), markup: textEl(x, y, runs, size, opts) };
}
export const shape = (markup, x0 = -Infinity, x1 = Infinity) => ({ kind: "shape", markup, x0, x1 });
const runsWidth = (runs, size, ls = 0) => runs.reduce((s, r) => s + measure(r.text, r.face, size, ls), 0);

// The role on one line, or one line per part (split at " · ") when one line does not fit.
function roleLines(role, size, ls, room, layout) {
  const one = role.toUpperCase();
  if (measure(one, "mono-700", size, ls) <= room) return [one];
  const parts = one.split(" · ");
  for (const p of parts) fit("hero.role", layout, measure(p, "mono-700", size, ls), room);
  return parts;
}

// ---------- shared geometry ----------
// Width each tab needs in each composition; a piece gets the largest share any composition needs.
// The phone shows the tabs in a grid (three per line), but its one-line widths still set the
// proportions of the strips on the wider layouts; when those do not fit in 100 %, they are scaled
// down together until the six strips fill the width.
function tabFractions(data) {
  const need = (layout, k) => {
    const spec = SPEC[layout], W = LAYOUTS[layout].width;
    const t = data.tabs[k];
    let w = measure(t.label, k === 0 ? "sg-600" : "sg-500", spec.tabFont) + (spec.icons ? spec.tabIcon + spec.tabGap : 0) + 2 * spec.tabPad;
    if (k === 0) w += 1 + spec.tabsPadL;
    if (k === data.tabs.length - 1) w += 1 + spec.sx + 2;
    return w / W;
  };
  const lines = LAYOUT_ORDER.filter((l) => !SPEC[l].tabGrid), grids = LAYOUT_ORDER.filter((l) => SPEC[l].tabGrid);
  for (const layout of lines) {
    const total = data.tabs.reduce((s, _, k) => s + need(layout, k), 0);
    fit("tabs[*].label (the six labels together)", layout, total * LAYOUTS[layout].width, LAYOUTS[layout].width);
  }
  const fixed = data.tabs.map((_, k) => Math.max(...lines.map((l) => need(l, k))));
  const phone = data.tabs.map((_, k) => Math.max(0, ...grids.map((l) => need(l, k))));
  const sum = (sc) => fixed.reduce((a, x, k) => a + Math.max(x, sc * phone[k]), 0);
  let scale = 1;
  if (sum(1) > 1) { let lo = 0, hi = 1; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (sum(m) > 1) hi = m; else lo = m; } scale = lo; }
  const f = fixed.map((x, k) => Math.max(x, scale * phone[k]));
  const total = f.reduce((a, b) => a + b, 0);
  if (total > 1 + 1e-9) throw new Error(`tabs[*].label: the six tabs need ${(total * 100).toFixed(1)} % of the width across the layouts; 100 % fits`);
  // Desktop widths are whole units; the leftover goes to the last tab, where the bar is empty.
  const D = LAYOUTS.desk.width;
  const wd = f.map((x) => Math.ceil(x * D));
  wd[wd.length - 1] = D - wd.slice(0, -1).reduce((a, b) => a + b, 0);
  return wd.map((w) => w / D);
}

export function buildLayout(data, src, layout, theme) {
  const s = SPEC[layout];
  const T = theme;
  const W = LAYOUTS[layout].width, win = W - s.sx; // window spans 0..win; the hard shadow fills win..W and the bottom
  const line = `rgba(${T.ink},.14)`, lineStrong = `rgba(${T.ink},.32)`;
  const fracs = tabFractions(data);
  const rows = [];
  // Side borders of the window and the shadow strip on the right, for a row of height h.
  const sides = (h, top = 0) => rect(win, top, s.sx, h - top, T.shade) + rect(0, 0, 1, h, lineStrong) + rect(win - 1, 0, 1, h, lineStrong);
  const body = (h) => shape(rect(0, 0, win, h, T.bg) + rect(0, 0, win, h, "url(#g)") + sides(h));

  // ---------- row 1: title bar and tabs ----------
  {
    // The phone draws the tabs as a grid of s.tabGrid per line: the first line under the title bar,
    // the rest on a line of their own, each piece a cell of 1/s.tabGrid of the width.
    const tabsH = s.tabGrid ? s.gridH : s.tabsH;
    const h = 1 + s.titleH + tabsH;
    const items = [];
    const tbTop = 1, tbMid = tbTop + (s.titleH - 1) / 2;
    items.push(shape(rect(0, 0, win, h, T.bg2) + rect(0, tbTop, win, s.titleH, T.bg3) + rect(0, tbTop + s.titleH - 1, win, 1, line)));
    items.push(shape(sides(h, s.sy) + rect(0, 0, win, 1, lineStrong) + rect(1, 1, win - 2, 2, T.red)));
    const sqx = 1 + s.padL, sqy = tbMid - s.sq / 2;
    items.push(shape(rect(sqx, sqy, s.sq, s.sq, T.red) + rect(sqx + s.sq - 2, sqy, 2, s.sq, "rgba(0,0,0,.35)") + rect(sqx, sqy + s.sq - 2, s.sq - 2, 2, "rgba(0,0,0,.35)")));
    const title = textItem(sqx + s.sq + s.titleGap, mid(tbMid, s.titleFont), [
      { text: data.window.title, face: "mono-700", fill: T.fg },
      { text: data.window.titleAccent, face: "mono-700", fill: T.redInk },
    ], s.titleFont, { spacing: s.titleLS, label: "window title" });
    items.push(title);
    // Minimize, maximize and close; the title must end before them.
    let cx = win - 1 - s.ctlPad - s.ctlW;
    const cy = tbMid - s.ctlH / 2;
    const ctlX0 = cx - 2 * (s.ctlW + s.ctlGap);
    fit("window.title + window.titleAccent", layout, title.x1 - title.x0, ctlX0 - s.titleGap - title.x0);
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
    const tTop = tbTop + s.titleH, tH = tabsH - 1;
    items.push(shape(rect(0, tTop + tabsH - 1, win, 1, line)));
    const pieces = [];
    let x = 0;
    if (s.tabGrid) {
      const per = s.tabGrid, cw = W / per, hB = s.gridH;
      const itemsB = [shape(rect(0, 0, win, hB, T.bg2) + sides(hB) + rect(0, hB - 1, win, 1, line))];
      data.tabs.forEach((t, k) => {
        const second = k >= per, col = k % per;
        const into = second ? itemsB : items, top = second ? 0 : tTop;
        const x0 = col * cw + (col === 0 ? 1 : 0), x1 = col === per - 1 ? win - 1 : (col + 1) * cw;
        const on = k === 0, face = on ? "sg-600" : "sg-500";
        fit(`tabs[${k}].label`, layout, measure(t.label, face, s.tabFont) + 2 * s.tabPad, x1 - x0);
        if (col) into.push(shape(rect(col * cw, top + 8, 1, tH - 16, line)));
        if (on) into.push(shape(rect(x0, top, x1 - x0, tH, T.bg3) + rect(x0, top + tH - 2, x1 - x0, 2, T.red)));
        into.push(textItem((x0 + x1) / 2, mid(top + tH / 2, s.tabFont), [{ text: t.label, face, fill: on ? T.fg : T.fg2 }], s.tabFont, { anchor: "middle", label: `tab ${t.label}` }));
        pieces.push({ id: `tab-${t.id}`, x: col * cw, w: cw, h: second ? hB : h, items: second ? itemsB : items, pct: 100 / per, href: t.href, alt: t.label });
      });
      rows.push({ id: "tabs", h: h + hB, items, pieces });
    } else data.tabs.forEach((t, k) => {
      const w = fracs[k] * W;
      const on = k === 0, last = k === data.tabs.length - 1;
      const face = on ? "sg-600" : "sg-500";
      const tw = measure(t.label, face, s.tabFont);
      const content = tw + (s.icons ? s.tabIcon + s.tabGap : 0);
      const spanX = k === 0 ? x + 1 + s.tabsPadL : x;
      const spanW = last ? content + 2 * s.tabPad : (x + w) - spanX;
      fit(`tabs[${k}].label`, layout, content + 2 * s.tabPad, last ? win - 1 - spanX : spanW);
      const cx0 = spanX + (spanW - content) / 2;
      const ym = tTop + tH / 2;
      if (on) items.push(shape(rect(spanX, tTop, spanW, tH, T.bg3) + rect(spanX, tTop + tH - 2, spanW, 2, T.red)));
      if (s.icons) items.push(shape(icon(src, TAB_ICON[t.id], cx0, ym - s.tabIcon / 2, s.tabIcon, on ? T.red : T.muted)));
      items.push(textItem(cx0 + (s.icons ? s.tabIcon + s.tabGap : 0), mid(ym, s.tabFont), [{ text: t.label, face, fill: on ? T.fg : T.fg2 }], s.tabFont, { label: `tab ${t.label}` }));
      pieces.push({ id: `tab-${t.id}`, x, w: last ? W - x : w, href: t.href, alt: t.label });
      x += w;
    });
    if (!s.tabGrid) rows.push({ id: "tabs", h, items, pieces });
  }

  // ---------- row 2: hero ----------
  {
    const hs = s.hero;
    const items = [];
    const runsTitle = (l, accentFill) => [{ text: l.lead + " ", face: "sg-600", fill: T.fg }, { text: l.accent, face: "sg-600", fill: accentFill }];
    const pitchRuns = data.hero.pitch.map((p) => ({ text: p.text, face: p.strong ? "inter-600" : "inter-400", fill: p.strong ? T.fg : T.fg2 }));
    const left = hs.left;
    const avH = hs.avatar * AVATAR_H / AVATAR_W;
    let room, y, h, av;
    if (hs.kind === "columns") {
      const avX = win - 1 - hs.avatarRight - hs.avatar;
      room = avX - hs.textGap - left;
      y = hs.firstBaseline;
      av = { x: avX, w: hs.avatar, h: avH };
    } else {
      room = win - 1 - 2 * left;
      av = { x: (win - hs.avatar) / 2, y: hs.avatarY, w: hs.avatar, h: avH };
      y = av.y + avH + hs.nameGap;
    }
    const name = textItem(left, y, [{ text: data.hero.name, face: "sg-600", fill: T.fg }], hs.nameSize, { label: "name" });
    fit("hero.name", layout, name.x1 - name.x0, room);
    items.push(name);
    roleLines(data.hero.role, hs.roleSize, hs.roleLS, room, layout).forEach((l, i) => {
      y += i ? hs.roleLH : hs.roleGap;
      items.push(textItem(left, y, [{ text: l, face: "mono-700", fill: T.redInk }], hs.roleSize, { spacing: hs.roleLS, label: "role" }));
    });
    y += hs.titleGap;
    for (const [i, l] of [data.hero.titleLine1, data.hero.titleLine2].entries()) {
      if (i) y += hs.titleLineGap;
      const r = runsTitle(l, i ? T.redInk : T.muted);
      if (runsWidth(r, hs.titleSize, hs.titleLS) <= room) {
        items.push(textItem(left, y, r, hs.titleSize, { spacing: hs.titleLS, label: `title line ${i + 1}` }));
        continue;
      }
      // Too wide for one line: it breaks between words, never inside one.
      let parts;
      try { parts = wrap(r, hs.titleSize, room, hs.titleLS); } catch (e) { throw new Error(`hero.titleLine${i + 1}: ${e.message} in the ${layout} layout`); }
      parts.forEach((p, j) => { if (j) y += hs.titleLineGap; items.push(textItem(left, y, p.runs, hs.titleSize, { spacing: hs.titleLS, label: `title line ${i + 1}` })); });
    }
    let lines;
    try { lines = wrap(pitchRuns, hs.pitchSize, Math.min(hs.pitchMax || room, room)); } catch (e) { throw new Error(`hero.pitch: ${e.message} in the ${layout} layout`); }
    if (lines.length > hs.pitchLines) throw new Error(`hero.pitch needs ${lines.length} lines in the ${layout} layout; ${hs.pitchLines} fit`);
    y += hs.pitchGap;
    lines.forEach((l, i) => { if (i) y += hs.pitchLH; items.push(textItem(left, y, l.runs, hs.pitchSize, { label: `pitch line ${i + 1}` })); });
    if (hs.kind === "columns") {
      h = hs.height || Math.ceil(Math.max(avH + 2 * hs.avatarMargin, y + hs.pitchSize * 0.3 + hs.bottom));
      if (y + hs.pitchSize * 0.3 > h) throw new Error(`the hero text is taller than the ${layout} hero (${h} units)`);
      av.y = hs.avatarY ?? (h - avH) / 2;
    } else h = Math.ceil(y + hs.bottom);
    rows.push({ id: "hero", h, items: [body(h), ...items], pieces: [{ id: "hero", x: 0, w: W, href: data.cv, alt: data.hero.alt }], avatar: av });
  }

  // ---------- row 3: buttons, one per third ----------
  {
    const b = s.buttons;
    const h = b.h, bh = b.bh;
    // Label lines: one per button (inline), or a block of two split at the space that balances them
    // best (stack2), so the three buttons share one structure.
    const labelLines = data.buttons.map((btn) => {
      const label = btn.label.toUpperCase();
      if (b.style !== "stack2") return [label];
      const words = label.split(" ");
      let best = null;
      for (let i = 1; i < words.length; i++) {
        const pair = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
        const wmax = Math.max(...pair.map((p) => measure(p, "mono-700", b.size, b.ls)));
        if (!best || wmax < best.wmax) best = { pair, wmax };
      }
      return best ? best.pair : [label];
    });
    // Equal buttons, each inside its own third: start and end margins mirror each other. Stacked
    // labels keep at least b.minSide units on each side; when the longest line needs more, the
    // buttons widen and the outer margins and gaps shrink in proportion.
    let L = b.L, gap = b.gap;
    let bw = (win - 2 * L - 2 * gap) / 3;
    if (b.style !== "inline") {
      const longest = Math.max(...labelLines.flat().map((l) => measure(l, "mono-700", b.size, b.ls) - b.ls));
      const need = longest + 2 * b.minSide;
      if (need > bw) {
        // The gaps may shrink until a button's hard shadow almost touches the next one, no further.
        const kMin = (s.sx + 2) / b.gap, room = (win - 2 * (b.L + b.gap) * kMin) / 3 - 2 * b.minSide;
        const k = (win - 3 * need) / (2 * b.L + 2 * b.gap);
        if (k < kMin) { const i = labelLines.findIndex((ls) => ls.some((l) => measure(l, "mono-700", b.size, b.ls) - b.ls === longest)); fit(`buttons[${i}].label`, layout, longest, room); }
        L = b.L * k; gap = b.gap * k; bw = need;
      }
    }
    const items = [body(h)];
    const pieces = [];
    data.buttons.forEach((btn, k) => {
      const x = L + k * (bw + gap), y = 0;
      const third = W / 3;
      if (x < k * third - 0.01 || x + bw + s.sx > (k + 1) * third + 0.01) throw new Error(`button geometry: a button crosses its third in the ${layout} layout`);
      const primary = k === 0;
      const fill = primary ? T.red : T.bg4, txt = primary ? T.onRed : T.fg;
      const hi = primary ? "rgba(255,255,255,.25)" : T.bevelHi, lo = primary ? "rgba(0,0,0,.3)" : T.bevelLo;
      const shadow = primary ? "rgba(255,32,32,.28)" : T.shade;
      const border = primary ? T.red : lineStrong;
      let g = rect(x + 4, y + 5, bw, bh, shadow) + rect(x, y, bw, bh, fill) + `<rect x="${n(x + 0.5)}" y="${n(y + 0.5)}" width="${n(bw - 1)}" height="${n(bh - 1)}" fill="none" stroke="${border}"/>` + bevel(x + 1, y + 1, bw - 2, bh - 2, hi, lo);
      const label = btn.label.toUpperCase();
      const field = `buttons[${k}].label`;
      if (b.style === "inline") {
        const tw = measure(label, "mono-700", b.size, b.ls) - b.ls;
        const content = b.icon + b.iconGap + tw;
        fit(field, layout, content, bw - 2 * b.pad);
        const cx0 = x + (bw - content) / 2;
        g += icon(src, BUTTON_ICON[btn.id], cx0, y + bh / 2 - b.icon / 2, b.icon, txt);
        items.push(shape(g));
        items.push(textItem(cx0 + b.icon + b.iconGap, mid(y + bh / 2, b.size), [{ text: label, face: "mono-700", fill: txt }], b.size, { spacing: b.ls, label: `button ${btn.label}` }));
      } else {
        // Icon above the label; a one-word label in a two-line block sits in its middle.
        const lines = labelLines[k];
        for (const l of lines) fit(field, layout, measure(l, "mono-700", b.size, b.ls) - b.ls, bw - 2 * b.minSide);
        const slots = b.style === "stack2" ? 2 : 1;
        const block = b.icon + b.iconGap + slots * b.lh;
        let yy = y + (bh - block) / 2;
        g += icon(src, BUTTON_ICON[btn.id], x + bw / 2 - b.icon / 2, yy, b.icon, txt);
        items.push(shape(g));
        yy += b.icon + b.iconGap + ((slots - lines.length) * b.lh) / 2;
        lines.forEach((l) => { items.push(textItem(x + bw / 2 + b.ls / 2, mid(yy + b.lh / 2, b.size), [{ text: l, face: "mono-700", fill: txt }], b.size, { spacing: b.ls, anchor: "middle", label: `button ${btn.label}` })); yy += b.lh; });
      }
      pieces.push({ id: `btn-${btn.id}`, x: k * W / 3, w: W / 3, href: btn.href, alt: btn.label });
    });
    rows.push({ id: "buttons", h, items, pieces });
  }

  // ---------- row 4: status and the bottom of the window ----------
  {
    const st = s.status;
    const winBottom = st.winBottom, h = winBottom + s.sy;
    const items = [shape(rect(win, 0, s.sx, h, T.shade) + rect(s.sx, winBottom, W - s.sx, s.sy, T.shade) + rect(0, 0, win, winBottom, T.bg) + rect(0, 0, win, winBottom, "url(#g)") +
      rect(0, 0, 1, winBottom, lineStrong) + rect(win - 1, 0, 1, winBottom, lineStrong) + rect(0, winBottom - 1, win, 1, lineStrong))];
    const ly = st.base - st.size * 0.35, cx = st.left + 4;
    // LED: 8 unit dot, 2 unit ring at 18 %, soft glow at 35 % (CSS box-shadows of .led).
    items.push(shape(`<defs><radialGradient id="glow"><stop offset="0" stop-color="#ff2020" stop-opacity=".35"/><stop offset="1" stop-color="#ff2020" stop-opacity="0"/></radialGradient></defs>` +
      `<g class="led"><circle cx="${n(cx)}" cy="${n(ly)}" r="12" fill="url(#glow)"/><circle cx="${n(cx)}" cy="${n(ly)}" r="6" fill="rgba(255,32,32,.18)"/><circle cx="${n(cx)}" cy="${n(ly)}" r="4" fill="#ff2020"/></g>`));
    const runs = data.status.parts.map((p) => ({ text: p.text, face: p.strong ? "mono-700" : "mono-400", fill: p.strong ? T.fg : T.fg2 }));
    const it = textItem(st.left + 18, st.base, runs, st.size, { label: "status" });
    fit("status.parts", layout, it.x1 - it.x0, win - 1 - st.left - (st.left + 18));
    items.push(it);
    rows.push({ id: "status", h, items, pieces: [{ id: "status", x: 0, w: W, href: data.status.href, alt: data.status.alt }] });
  }
  // Grid lines sit 47 units below the top of the window body and every 48 after (CSS offset of -1 px).
  let off = 0;
  for (const r of rows.slice(1)) { r.gridY = (((47 - off) % 48) + 48) % 48; off += r.h; }
  const height = rows.reduce((a, r) => a + r.h, 0);
  const minText = Math.min(...rows.flatMap((r) => r.items.filter((it) => it.kind === "text").map((it) => it.size)));
  return { W, rows, height, minText };
}

// ---------- SVG of one piece ----------
export function fontCss(src, faces) {
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
export function pieceSvg(src, theme, row, piece, motion) {
  const h = piece.h ?? row.h, all = piece.items ?? row.items;
  const x0 = piece.x, x1 = piece.x + piece.w;
  const texts = all.filter((it) => it.kind === "text" && it.x1 > x0 - 1 && it.x0 < x1 + 1);
  const faces = new Set(texts.flatMap((t) => t.runs.map((r) => r.face)));
  let css = fontCss(src, faces);
  const defs = row.id === "tabs" ? "" : `<defs><pattern id="g" width="48" height="48" patternUnits="userSpaceOnUse" x="0" y="${n(row.gridY)}"><rect width="48" height="1" fill="rgba(${theme.ink},.04)"/><rect width="1" height="48" fill="rgba(${theme.ink},.04)"/></pattern></defs>`;
  let body = all.filter((it) => (it.kind === "shape" && it.x1 > x0 && it.x0 < x1) || texts.includes(it)).map((it) => it.markup).join("");
  if (row.id === "hero") {
    const a = row.avatar;
    const open = `<svg x="${n(a.x)}" y="${n(a.y)}" width="${n(a.w)}" height="${n(a.h)}" viewBox="0 0 ${AVATAR_W} ${AVATAR_H}">`;
    if (motion === "animated") {
      const an = avatarAnimated(src.avatar, theme, theme.bg);
      css += an.css;
      body += `${open}<defs>${an.defs}</defs>${an.markup}</svg>`;
    } else body += `${open}${avatarStill(src.avatar, theme)}</svg>`;
  }
  if (row.id === "status" && motion === "animated") css += `.led{animation:led 1.6s steps(1,end) infinite}@keyframes led{0%{opacity:1}50%{opacity:.25}}`;
  if (motion === "animated") css += `@media (prefers-reduced-motion:reduce){*{animation:none!important}.avq{display:none}}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${n(piece.w)}" height="${n(h)}" viewBox="${n(x0)} 0 ${n(piece.w)} ${n(h)}"${row.id === "hero" ? ` role="img" aria-label="${esc(piece.alt)}"` : ""}>` +
    (css ? `<style>${css}</style>` : "") + defs + body + `</svg>\n`;
  return { svg, texts: texts.map((t) => ({ label: t.label, y0: t.y0, y1: t.y1, size: t.size,
    runs: t.runs.map((r) => ({ text: r.text, face: r.face, fill: r.fill, x0: Math.max(r.x0, x0), x1: Math.min(r.x1, x1), full: r.x1 - r.x0 })).filter((r) => r.x1 > r.x0) })) };
}
