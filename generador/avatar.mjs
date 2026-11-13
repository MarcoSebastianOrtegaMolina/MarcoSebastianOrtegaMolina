// The hand-drawn avatar (generador/fuentes/avatar-marco.svg) for one theme: the still drawing and an
// animated version that builds up from small squares, then blinks and glances from time to time.
// The drawing's paths are never changed; the animation only adds layers on top of it.
import { n } from "./texto.mjs";

export const AVATAR_W = 1942;
export const AVATAR_H = 1988;

// Eyelids. Each eye gets an upper lid that slides down and a lower lid that slides up; they meet on the
// closed-eye line, which rides on the edge of the upper lid (it moves with translateY, it is never
// squashed). Both lids are clipped to an ellipse around the iris (and, for the right eye, to the lower
// edge of the top rim of the glasses), so outside a blink nothing of them is visible.
// Ellipse centre and radii are proportions of the pupil's bounding box. For the right eye the iris
// rises above the ellipse at x 1300-1310, so the ellipse moves up 35 units and grows; the rim clip
// (scanned column by column on the drawing at 1 unit per pixel, +1) keeps it off the glasses.
const RIM_R = [[1040, 946], [1060, 941], [1100, 932], [1150, 928], [1170, 936], [1185, 935], [1200, 931], [1215, 928], [1230, 923], [1245, 919], [1260, 924], [1280, 929], [1288, 922], [1297, 920], [1310, 918], [1322, 919], [1330, 923], [1336, 919], [1340, 917], [1360, 919], [1375, 923], [1400, 931], [1430, 946]];
const LIDS = {
  l: { dx: -0.18, dy: -0.4, rx: 1.62, ry: 1.58, lineDepth: 1.58, down: 0.3 },
  r: { dx: -0.225, dy: -0.32, rx: 2.11, ry: 2.17, raise: 35, lineDepth: 1.71, down: 0.2, rim: RIM_R },
};
const GLANCE = 14; // how far the pupils move when looking to the sides
const LINE_W = 22; // closed-eye line width, as in the drawing's thick strokes

// Bounding box of a path made of M, m, L, l, C, c and z commands (the only ones in the avatar),
// control points included.
function bbox(d) {
  const t = d.match(/[MmCcLlZz]|-?\d*\.?\d+(?:e-?\d+)?/g);
  let i = 0, x = 0, y = 0, sx = 0, sy = 0, cmd = "";
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const see = (px, py) => { b.x0 = Math.min(b.x0, px); b.y0 = Math.min(b.y0, py); b.x1 = Math.max(b.x1, px); b.y1 = Math.max(b.y1, py); };
  const num = () => parseFloat(t[i++]);
  while (i < t.length) {
    if (/[A-Za-z]/.test(t[i])) cmd = t[i++];
    if (cmd === "M") { x = num(); y = num(); sx = x; sy = y; see(x, y); cmd = "L"; }
    else if (cmd === "m") { x += num(); y += num(); sx = x; sy = y; see(x, y); cmd = "l"; }
    else if (cmd === "L") { x = num(); y = num(); see(x, y); }
    else if (cmd === "l") { x += num(); y += num(); see(x, y); }
    else if (cmd === "c") { const v = [num(), num(), num(), num(), num(), num()]; see(x + v[0], y + v[1]); see(x + v[2], y + v[3]); x += v[4]; y += v[5]; see(x, y); }
    else if (cmd === "C") { const v = [num(), num(), num(), num(), num(), num()]; see(v[0], v[1]); see(v[2], v[3]); x = v[4]; y = v[5]; see(x, y); }
    else if (cmd === "z" || cmd === "Z") { x = sx; y = sy; cmd = ""; }
    else throw new Error("unexpected path command in the avatar: " + cmd);
  }
  return b;
}

// Inner markup of the drawing (everything inside its <svg>), with the theme colors in place of the
// CSS variables the CV uses.
export function avatarInner(raw, theme) {
  const start = raw.indexOf('<g id="avatar"');
  const end = raw.lastIndexOf("</svg>");
  if (start < 0 || end < start) throw new Error("avatar-marco.svg: <g id=\"avatar\"> not found");
  const c = theme.avatar;
  return raw.slice(start, end).trim()
    .replace(/var\(--avatar-relleno,#ff2020\)/g, c.fill)
    .replace(/var\(--avatar-trazo,#0b0b0b\)/g, c.stroke)
    .replace(/var\(--avatar-linea,#ff2020\)/g, c.line);
}

// Animated avatar. Returns markup for a nested <svg> plus the CSS and defs it needs; every class,
// id and keyframe name starts with "av" so it cannot clash with the rest of the header.
// bg: the color under the avatar (the build-up squares are painted with it).
export function avatarAnimated(raw, theme, bg) {
  let inner = avatarInner(raw, theme);
  const skin = theme.avatar.fill === "none" ? bg : theme.avatar.fill;
  let defs = "", lids = "", keyframes = "", minRadius = Infinity;
  const geometry = {};
  for (const side of ["l", "r"]) {
    const re = new RegExp(`(<g id="av-pupil-${side}")>(<path[^>]* d="([^"]*)"[^>]*/>)(</g>)`);
    const m = inner.match(re);
    if (!m) throw new Error("avatar-marco.svg: av-pupil-" + side + " not found");
    const b = bbox(m[3]);
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, rx = (b.x1 - b.x0) / 2, ry = (b.y1 - b.y0) / 2;
    minRadius = Math.min(minRadius, rx, ry);
    const q = LIDS[side];
    const px = cx + q.dx * rx, py = cy + q.dy * ry, prx = rx * q.rx, pry = ry * q.ry;
    const ey = py - (q.raise || 0); // ellipse centre
    const lineY = py + q.down * pry; // where the lids meet when the eye is closed
    const ctrl = lineY + ry * q.lineDepth * 0.5; // quadratic control point of the closed-eye curve
    const x0 = px - prx * 0.8, x1 = px + prx * 0.8;
    const sag = (ctrl - lineY) / 2; // the curve's lowest point is lineY + sag
    const L = px - prx - 20, R = px + prx + 20, top = ey - pry - 20, bottom = ey + pry + 20;
    const curve = `L${n(x1)} ${n(lineY)}Q${n(px)} ${n(ctrl)} ${n(x0)} ${n(lineY)}`;
    const upper = `M${n(L)} ${n(top)}H${n(R)}V${n(lineY)}${curve}H${n(L)}Z`;
    const lower = `M${n(L)} ${n(bottom)}H${n(R)}V${n(lineY)}${curve}H${n(L)}Z`;
    const line = `M${n(x0)} ${n(lineY)}Q${n(px)} ${n(ctrl)} ${n(x1)} ${n(lineY)}`;
    // Travel: the upper lid starts with its edge (and the line's width) above the ellipse; the lower
    // lid starts with its highest point below it.
    const up = Math.ceil(lineY + sag + LINE_W / 2 - (ey - pry) + 2);
    const low = Math.ceil(ey + pry - lineY + 2);
    geometry[side] = { px, py, prx, pry, ey, lineY, up, low };
    defs += `<clipPath id="av-eye-${side}"><ellipse cx="${n(px)}" cy="${n(ey)}" rx="${n(prx)}" ry="${n(pry)}"/></clipPath>`;
    if (q.rim) {
      const pts = [...q.rim, [q.rim[q.rim.length - 1][0], AVATAR_H], [q.rim[0][0], AVATAR_H]];
      defs += `<clipPath id="av-rim-${side}"><polygon points="${pts.map((p) => p.join(",")).join(" ")}"/></clipPath>`;
    }
    const lidsMarkup = `<g clip-path="url(#av-eye-${side})"><path class="av-low-${side}" d="${lower}" fill="${skin}"/>` +
      `<g class="av-up-${side}"><path d="${upper}" fill="${skin}"/><path d="${line}" fill="none" stroke="${theme.avatar.stroke}" stroke-width="${LINE_W}" stroke-linecap="round"/></g></g>`;
    lids += q.rim ? `<g clip-path="url(#av-rim-${side})">${lidsMarkup}</g>` : lidsMarkup;
    // Blink cycle of 7 s from 2.5 s: two blinks (18-24 % and 55-61 %): 180 ms closing, 60 ms closed,
    // 180 ms opening, at an even pace.
    const kf = (name, dy) => `@keyframes ${name}{0%,18%,24%,55%,61%,100%{transform:translateY(${dy}px)}20.571%,21.429%,57.571%,58.429%{transform:translateY(0)}}`;
    keyframes += kf(`av-up-${side}`, -up) + kf(`av-low-${side}`, low);
    keyframes += `.av-up-${side}{transform:translateY(-${up}px);animation:av-up-${side} 7s linear 2.5s infinite}`;
    keyframes += `.av-low-${side}{transform:translateY(${low}px);animation:av-low-${side} 7s linear 2.5s infinite}`;
    inner = inner.replace(re, `$1 clip-path="url(#av-eye-pupil-${side})"><g class="av-look">$2</g>$4`);
    defs += `<clipPath id="av-eye-pupil-${side}"><ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}"/></clipPath>`;
  }
  // When glancing, the pupil moves and grows just enough to keep covering its own place.
  const S = (1 + (GLANCE + 6) / minRadius).toFixed(3);
  // The lids go inside av-feat, after the pupils.
  if (!/<\/g><\/g>\s*$/.test(inner)) throw new Error("avatar-marco.svg: unexpected end of the drawing");
  inner = inner.replace(/<\/g><\/g>\s*$/, `${lids}</g></g>`);
  // Build-up: a grid of 63 x 65 squares of 31 units (35 wide, so they overlap and leave no seams)
  // that fade out in 24 waves from the centre outwards, with some randomness.
  const P = 31, Q = 35, WAVES = 24, T0 = 0.15, DT = 0.085;
  const cols = Math.ceil(AVATAR_W / P), rows = Math.ceil(AVATAR_H / P);
  let seed = 20261112;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const waves = Array.from({ length: WAVES }, () => []);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const dx = (c + 0.5) / cols - 0.5, dy = (r + 0.5) / rows - 0.5;
    const dist = Math.min(1, Math.hypot(dx, dy) / 0.7071);
    const k = Math.min(WAVES - 1, Math.floor((0.6 * rand() + 0.4 * dist) * WAVES));
    waves[k].push(`M${c * P} ${r * P}h${Q}v${Q}h-${Q}z`);
  }
  const cover = waves.map((d, k) => `<path class="avq avq${k}" d="${d.join("")}"/>`).join("");
  const delays = waves.map((_, k) => `.avq${k}{animation-delay:${(T0 + k * DT).toFixed(3)}s}`).join("");
  const css = `.avq{opacity:0;animation:av-out .12s linear both}${delays}@keyframes av-out{from{opacity:1}to{opacity:0}}` +
    `.av-look{transform-box:fill-box;transform-origin:50% 50%;animation:av-look 7s ease-in-out 2.5s infinite}` +
    `@keyframes av-look{0%,30%,48%,100%{transform:translateX(0) scale(1)}33%,38%{transform:translateX(-${GLANCE}px) scale(${S})}41%,45%{transform:translateX(${GLANCE}px) scale(${S})}}` +
    keyframes;
  const markup = `${inner}<g fill="${bg}">${cover}</g>`;
  return { markup, defs, css, geometry };
}
