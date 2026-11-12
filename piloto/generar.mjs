// Piloto del README del perfil: genera los SVG de prueba en piloto/assets/.
// Node sin dependencias. Uso: node piloto/generar.mjs [carpeta-de-fuentes]
// La carpeta de fuentes por omision es _trabajo/fuentes (avatar-marco.svg y fonts/*.woff2).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, "..");
const fuentes = path.resolve(process.argv[2] || path.join(raiz, "_trabajo/fuentes"));
const salida = path.join(aqui, "assets");

// Version de los nombres: GitHub guarda las imagenes en cache; si cambia un SVG, se sube la version.
const V = "v1";

// Colores del CV (cv-base.css, tema oscuro y claro).
const OSC = { bg: "#0a0a0a", bg2: "#121211", bg3: "#1a1a18", fg: "#f3f1ea", fg2: "#cfcdc4", muted: "#8d8d85", red: "#ff2020", ink: "243,241,234" };
const CLA = { bg: "#f4efe6", bg2: "#fffdf8", bg3: "#e9e2d4", fg: "#141412", fg2: "#34332e", muted: "#5d5a51", red: "#c00000", ink: "20,20,18" };

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const b64 = (f) => fs.readFileSync(path.join(fuentes, "fonts", f)).toString("base64");
const escribir = (nombre, svg) => {
  fs.writeFileSync(path.join(salida, nombre), svg, { encoding: "utf8" });
  return [nombre, Buffer.byteLength(svg)];
};
const rejilla = (id, ink) =>
  `<pattern id="${id}" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="rgba(${ink},.04)" stroke-width="2"/></pattern>`;

// Textos del CV (en.js: hero.role, hero.title, hero.pitch hasta «intelligence»). El boceto corta el pitch igual.
const T = {
  nombre: "Marco Sebastián Ortega Molina",
  rol: "FULL-STACK DEVELOPER · AI TRAINER",
  pitchA: "I build ",
  pitchB: "web and mobile applications",
  pitchC: " with integrated artificial intelligence.",
};

// ---------- Experimento 1: fuentes embebidas y su control ----------
function textoHero(f, conFuentes) {
  // f: familias a pedir. En el control se piden familias que no existen y no hay @font-face.
  const css = conFuentes
    ? `@font-face{font-family:'PilotoSG';src:url(data:font/woff2;base64,${b64("space-grotesk-latin-var.woff2")}) format('woff2');font-weight:300 700}
@font-face{font-family:'PilotoInter';src:url(data:font/woff2;base64,${b64("inter-latin-var.woff2")}) format('woff2');font-weight:100 900}
@font-face{font-family:'PilotoMono';src:url(data:font/woff2;base64,${b64("space-mono-700-latin.woff2")}) format('woff2');font-weight:700}`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="846" height="250" viewBox="0 0 846 250">
<style>${css}
.sg{font-family:'${f.sg}',sans-serif;font-weight:600}
.in{font-family:'${f.inter}',sans-serif;font-weight:400}
.mo{font-family:'${f.mono}',monospace;font-weight:700}
</style>
<defs>${rejilla("r", OSC.ink)}</defs>
<rect width="846" height="250" fill="${OSC.bg}"/><rect width="846" height="250" fill="url(#r)"/>
<text x="38" y="52" class="sg" font-size="16" fill="${OSC.fg}">${esc(T.nombre)}</text>
<text x="38" y="78" class="mo" font-size="10.5" letter-spacing="1.68" fill="${OSC.red}">${esc(T.rol)}</text>
<text x="38" y="130" class="sg" font-size="44" letter-spacing="-1.32" fill="${OSC.fg}">I build <tspan fill="${OSC.muted}">software.</tspan></text>
<text x="38" y="176" class="sg" font-size="44" letter-spacing="-1.32" fill="${OSC.fg}">I train <tspan fill="${OSC.red}">AI.</tspan></text>
<text x="38" y="218" class="in" font-size="14.5" fill="${OSC.fg2}">${esc(T.pitchA)}<tspan font-weight="600" fill="${OSC.fg}">${esc(T.pitchB)}</tspan>${esc(T.pitchC)}</text>
</svg>
`;
}

// ---------- Experimento 2: pestanas y cuerpo ----------
const PEST = [["Home", 118], ["Projects", 148], ["Stack", 120], ["Experience", 170], ["About", 128], ["Contact", 162]];
const ANCHO = PEST.reduce((s, [, w]) => s + w, 0); // 846
function pestana(i, alto) {
  const [txt, w] = PEST[i];
  const on = i === 0;
  const barra = alto > 42; // variante alta: barra de titulo encima de la pestana
  const y0 = barra ? alto - 42 : 0;
  const titulo = barra
    ? `<rect width="${w}" height="${y0}" fill="${OSC.bg3}"/><rect width="${w}" height="2" fill="${OSC.red}"/>` +
      (i === 0 ? `<rect x="14" y="12" width="10" height="10" fill="${OSC.red}"/><text x="34" y="22" font-family="monospace" font-weight="700" font-size="12" fill="${OSC.fg}">MSO · PORTFOLIO<tspan fill="${OSC.red}">.EXE</tspan></text>` : "") +
      `<rect y="${y0 - 1}" width="${w}" height="1" fill="rgba(${OSC.ink},.14)"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${alto}" viewBox="0 0 ${w} ${alto}">
${titulo}<rect y="${y0}" width="${w}" height="42" fill="${OSC.bg2}"/>${on ? `<rect x="12" y="${y0}" width="${w - 24}" height="42" fill="${OSC.bg3}"/><rect x="12" y="${y0 + 40}" width="${w - 24}" height="2" fill="${OSC.red}"/>` : ""}
<rect y="${alto - 1}" width="${w}" height="1" fill="rgba(${OSC.ink},.14)"/>
<text x="${w / 2}" y="${y0 + 26}" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="${on ? 600 : 500}" fill="${on ? OSC.fg : OSC.fg2}">${esc(txt)}</text>
</svg>
`;
}
function cuerpo() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="846" height="160" viewBox="0 0 846 160">
<defs>${rejilla("r", OSC.ink)}</defs>
<rect width="846" height="160" fill="${OSC.bg}"/><rect width="846" height="160" fill="url(#r)"/>
<text x="38" y="88" font-family="sans-serif" font-size="22" font-weight="600" fill="${OSC.fg}">Body of the window <tspan fill="${OSC.muted}">(one image)</tspan></text>
</svg>
`;
}

// ---------- Experimento 3: tema claro y oscuro ----------
function tema(c, nombre) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="846" height="120" viewBox="0 0 846 120">
<defs>${rejilla("r", c.ink)}</defs>
<rect width="846" height="120" fill="${c.bg}"/><rect width="846" height="120" fill="url(#r)"/>
<rect width="846" height="34" fill="${c.bg3}"/><rect width="846" height="2" fill="${OSC.red}"/>
<rect x="14" y="12" width="10" height="10" fill="${OSC.red}"/>
<text x="34" y="22" font-family="monospace" font-weight="700" font-size="12" fill="${c.fg}">MSO · PORTFOLIO<tspan fill="${c.red}">.EXE</tspan></text>
<text x="38" y="84" font-family="sans-serif" font-size="24" font-weight="600" fill="${c.fg}">${nombre}</text>
</svg>
`;
}

// ---------- Experimento 4: avatar animado ----------
function avatarAnimado(tem) {
  const crudo = fs.readFileSync(path.join(fuentes, "avatar-marco.svg"), "utf8");
  let interno = crudo.slice(crudo.indexOf('<g id="avatar"'), crudo.lastIndexOf("</svg>")).trim();
  const col = tem === "oscuro"
    ? { bg: OSC.bg, relleno: "#ff2020", trazo: "#0b0b0b", linea: "#ff2020" }
    : { bg: CLA.bg, relleno: "none", trazo: "#ff2020", linea: "#ff2020" };
  interno = interno
    .replace(/var\(--avatar-relleno,#ff2020\)/g, col.relleno)
    .replace(/var\(--avatar-trazo,#0b0b0b\)/g, col.trazo)
    .replace(/var\(--avatar-linea,#ff2020\)/g, col.linea);
  // Pupilas: recorte fijo del tamano del ojo (al mirar no se salen del aro), grupo externo para
  // mirar a los lados, interno para entrecerrar. El parpado (piel y linea de ojo cerrado) tapa el
  // ojo solo en el instante cerrado del parpadeo.
  const quieto = `<svg xmlns="http://www.w3.org/2000/svg" width="1942" height="1988" viewBox="0 0 1942 1988" role="img" aria-label="Hand-drawn portrait of Marco">
<rect width="1942" height="1988" fill="${col.bg}"/>
${interno}
</svg>
`;
  const piel = col.relleno === "none" ? col.bg : col.relleno;
  let defs = "", parpados = "", radioMin = Infinity;
  for (const lado of ["l", "r"]) {
    const re = new RegExp(`(<g id="av-pupil-${lado}")>(<path[^>]* d="([^"]*)"[^>]*/>)(</g>)`);
    const m = interno.match(re);
    if (!m) throw new Error("no encontre av-pupil-" + lado);
    const b = caja(m[3]);
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, rx = (b.x1 - b.x0) / 2, ry = (b.y1 - b.y0) / 2;
    const n = (v) => Math.round(v);
    console.log(`ojo ${lado} (${tem}): centro ${n(cx)},${n(cy)} radios ${n(rx)},${n(ry)}`);
    defs += `<clipPath id="ojo-${lado}"><ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}"/></clipPath>`;
    // El iris oscuro del dibujo es mayor que la pupila y esta corrido hacia arriba a la izquierda:
    // el parpado lo tapa entero y lleva la linea de ojo cerrado.
    const q = PARPADO[lado], px = cx + q.dx * rx, py = cy + q.dy * ry, prx = rx * q.rx, pry = ry * q.ry;
    if (q.tope) defs += `<clipPath id="tope-${lado}"><rect x="0" y="${q.tope}" width="1942" height="${1988 - q.tope}"/></clipPath>`;
    parpados += `<g class="parpado"${q.tope ? ` clip-path="url(#tope-${lado})"` : ""}><ellipse cx="${n(px)}" cy="${n(py)}" rx="${n(prx)}" ry="${n(pry)}" fill="${piel}"/>` +
      `<path d="M${n(px - prx * 0.8)} ${n(py)}Q${n(px)} ${n(py + pry * 0.5)} ${n(px + prx * 0.8)} ${n(py)}" fill="none" stroke="${col.trazo}" stroke-width="22" stroke-linecap="round"/></g>`;
    radioMin = Math.min(radioMin, rx, ry);
    interno = interno.replace(re, `$1 clip-path="url(#ojo-${lado})"><g class="mira">$2</g>$4`);
  }
  // Al mirar, la pupila se corre y crece lo justo para seguir tapando su sitio: no deja medialunas.
  const S = (1 + (MIRADA + 6) / radioMin).toFixed(3);
  // El parpado va dentro de av-feat, despues de las pupilas.
  interno = interno.replace(/<\/g><\/g>\s*$/, `${parpados}</g></g>`);
  // Cuadritos que tapan el dibujo y se van quitando: rejilla de 63 x 65 celdas de 31 unidades
  // (mas de 60 por lado), cada cuadro de 35 para que se traslapen y no se vean costuras.
  const W = 1942, H = 1988, P = 31, L = 35, OLAS = 24, T0 = 0.15, DT = 0.085;
  const cols = Math.ceil(W / P), filas = Math.ceil(H / P);
  let s = 20261112; const azar = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const olas = Array.from({ length: OLAS }, () => []);
  for (let f = 0; f < filas; f++) for (let c = 0; c < cols; c++) {
    const dx = (c + 0.5) / cols - 0.5, dy = (f + 0.5) / filas - 0.5;
    const dist = Math.min(1, Math.hypot(dx, dy) / 0.7071);
    const k = Math.min(OLAS - 1, Math.floor((0.6 * azar() + 0.4 * dist) * OLAS));
    olas[k].push(`M${c * P} ${f * P}h${L}v${L}h-${L}z`);
  }
  const cubre = olas.map((d, k) => `<path class="c c${k}" d="${d.join("")}"/>`).join("\n");
  const retrasos = olas.map((_, k) => `.c${k}{animation-delay:${(T0 + k * DT).toFixed(3)}s}`).join("");
  // Ciclo de ojos: empieza a los 2.5 s, dura 7 s. Neutro de 0 a 18 % y de 60 a 100 %.
  const css = `
.c{opacity:0;animation:fuera .12s linear both}
${retrasos}
@keyframes fuera{from{opacity:1}to{opacity:0}}
.mira{transform-box:fill-box;transform-origin:50% 50%;animation:mirar 7s ease-in-out 2.5s infinite}
.parpado{opacity:0;animation:tapa 7s steps(1,end) 2.5s infinite}
@keyframes tapa{0%{opacity:0}18.8%{opacity:1}21.2%{opacity:0}56.2%{opacity:1}58.6%{opacity:0}100%{opacity:0}}
@keyframes mirar{0%,30%,48%,100%{transform:translateX(0) scale(1)}33%,38%{transform:translateX(-${MIRADA}px) scale(${S})}41%,45%{transform:translateX(${MIRADA}px) scale(${S})}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}.cubre{display:none}}`;
  const animado = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Hand-drawn portrait of Marco">
<style>${css}
</style>
<defs>${defs}</defs>
<rect width="${W}" height="${H}" fill="${col.bg}"/>
${interno}
<g class="cubre" fill="${col.bg}">
${cubre}
</g>
</svg>
`;
  return { animado, quieto };
}
// Parpado: centro corrido y radios en proporcion a la pupila (medidos en la captura del dibujo:
// iris izquierdo de unos 109 x 103 unidades con centro en 685,1056, pupila de 73 en 698,1085; el
// derecho se ajusto mirando el cuadro del parpadeo hasta que no quedaron restos del iris).
const PARPADO = { l: { dx: -0.18, dy: -0.4, rx: 1.62, ry: 1.58 }, r: { dx: -0.225, dy: -0.32, rx: 1.89, ry: 1.71, tope: 936 } };
// tope: el iris derecho toca la linea de arriba de los lentes; el parpado no sube de y=936 para no morderla.
const MIRADA = 14;
// Caja de un trazo con comandos M, c, l, z (los unicos del avatar); incluye puntos de control.
function caja(d) {
  const t = d.match(/[MmCcLlZz]|-?\d*\.?\d+(?:e-?\d+)?/g);
  let i = 0, x = 0, y = 0, sx = 0, sy = 0, cmd = "";
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const ve = (px, py) => { b.x0 = Math.min(b.x0, px); b.y0 = Math.min(b.y0, py); b.x1 = Math.max(b.x1, px); b.y1 = Math.max(b.y1, py); };
  const num = () => parseFloat(t[i++]);
  while (i < t.length) {
    if (/[A-Za-z]/.test(t[i])) cmd = t[i++];
    if (cmd === "M") { x = num(); y = num(); sx = x; sy = y; ve(x, y); cmd = "L"; }
    else if (cmd === "m") { x += num(); y += num(); sx = x; sy = y; ve(x, y); cmd = "l"; }
    else if (cmd === "L") { x = num(); y = num(); ve(x, y); }
    else if (cmd === "l") { x += num(); y += num(); ve(x, y); }
    else if (cmd === "c") { const v = [num(), num(), num(), num(), num(), num()]; ve(x + v[0], y + v[1]); ve(x + v[2], y + v[3]); x += v[4]; y += v[5]; ve(x, y); }
    else if (cmd === "C") { const v = [num(), num(), num(), num(), num(), num()]; ve(v[0], v[1]); ve(v[2], v[3]); x = v[4]; y = v[5]; ve(x, y); }
    else if (cmd === "z" || cmd === "Z") { x = sx; y = sy; cmd = ""; }
    else throw new Error("comando de trazo no previsto: " + cmd);
  }
  return b;
}

// ---------- Escribir ----------
fs.mkdirSync(salida, { recursive: true });
for (const f of fs.readdirSync(salida)) if (f.endsWith(".svg")) fs.unlinkSync(path.join(salida, f));
const hechos = [];
hechos.push(escribir(`exp1-fuentes-${V}.svg`, textoHero({ sg: "PilotoSG", inter: "PilotoInter", mono: "PilotoMono" }, true)));
hechos.push(escribir(`exp1-control-${V}.svg`, textoHero({ sg: "NoExisteSG", inter: "NoExisteInter", mono: "NoExisteMono" }, false)));
PEST.forEach((_, i) => {
  hechos.push(escribir(`exp2-pestana${i + 1}-${V}.svg`, pestana(i, 42)));
  hechos.push(escribir(`exp2-alta${i + 1}-${V}.svg`, pestana(i, 76)));
});
hechos.push(escribir(`exp2-cuerpo-${V}.svg`, cuerpo()));
hechos.push(escribir(`exp3-oscuro-${V}.svg`, tema(OSC, "Dark theme image")));
hechos.push(escribir(`exp3-claro-${V}.svg`, tema(CLA, "Light theme image")));
for (const tem of ["oscuro", "claro"]) {
  const { animado, quieto } = avatarAnimado(tem);
  hechos.push(escribir(`exp4-avatar-${tem}-${V}.svg`, animado));
  hechos.push(escribir(`exp4-avatar-${tem}-quieto-${V}.svg`, quieto));
}

// ---------- README de la rama del piloto ----------
// Enlaces provisionales: solo sirven para que cada pestana sea un enlace distinto; no estan verificados.
const ENL = ["home", "projects", "stack", "experience", "about", "contact"].map((a) => `https://www.kairomx.tech/cv/#${a}`);
const A = (n) => `piloto/assets/${n}-${V}.svg`;
const pct = (w) => ((w / ANCHO) * 100).toFixed(4) + "%";
const fila = (f, alta, extra) => PEST.map(([, w], i) => `<a href="${ENL[i]}"><img alt="exp2${f}-t${i + 1}" width="${pct(w)}"${extra} src="${A(`exp2-${alta ? "alta" : "pestana"}${i + 1}`)}"></a>`).join("");
const cuerpoImg = (f, extra) => `<img alt="exp2${f}-cuerpo" width="100%"${extra} src="${A("exp2-cuerpo")}">`;
const readme = `# Piloto técnico de la cabecera del perfil

Rama de prueba. No es el perfil: aquí se mide si GitHub pinta lo que necesita el README nuevo.
Las medidas y la conclusión están en [piloto/INFORME.md](piloto/INFORME.md).

## Experimento 1: fuentes embebidas

Space Grotesk 600, Space Mono 700 e Inter 400 dentro del SVG, en base64.

<img alt="exp1-fuentes" width="100%" src="${A("exp1-fuentes")}">

Control: el mismo SVG pidiendo fuentes que no existen. Tiene que verse distinto.

<img alt="exp1-control" width="100%" src="${A("exp1-control")}">

## Experimento 2: pestañas como imágenes pegadas

Seis pestañas, cada una con su enlace, y debajo el cuerpo de la ventana. Los enlaces son provisionales.

### 2a. En línea, sin espacios entre etiquetas

<p>${fila("a", false, "")}<br>${cuerpoImg("a", "")}</p>

### 2b. Con align="left"

<p>${fila("b", false, ' align="left"')}${cuerpoImg("b", "")}</p>

### 2c. En una tabla

<table>
<tr>${PEST.map((_, i) => `<td><a href="${ENL[i]}"><img alt="exp2c-t${i + 1}" src="${A(`exp2-pestana${i + 1}`)}"></a></td>`).join("")}</tr>
<tr><td colspan="6">${cuerpoImg("c", "")}</td></tr>
</table>

### 2d. En línea, con align="top"

<p>${fila("d", false, ' align="top"')}<br>${cuerpoImg("d", ' align="top"')}</p>

### 2e. En línea, con align="top" y pestañas de 76 de alto (barra de título encima)

<p>${fila("e", true, ' align="top"')}<br>${cuerpoImg("e", ' align="top"')}</p>

## Experimento 3: tema claro y oscuro

<picture>
<source media="(prefers-color-scheme: dark)" srcset="${A("exp3-oscuro")}">
<img alt="exp3-tema" width="100%" src="${A("exp3-claro")}">
</picture>

## Experimento 4: avatar animado

Entra armándose con cuadritos, parpadea y mira a los lados. Con «reducir movimiento» se carga la versión quieta.

<picture><source media="(prefers-reduced-motion: reduce)" srcset="${A("exp4-avatar-oscuro-quieto")}"><img alt="exp4-avatar-oscuro" width="400" src="${A("exp4-avatar-oscuro")}"></picture>

<picture><source media="(prefers-reduced-motion: reduce)" srcset="${A("exp4-avatar-claro-quieto")}"><img alt="exp4-avatar-claro" width="400" src="${A("exp4-avatar-claro")}"></picture>
`;
fs.writeFileSync(path.join(raiz, "README.md"), readme, { encoding: "utf8" });

const MAX = 600 * 1024;
let mal = 0;
for (const [n, b] of hechos) {
  const ok = b <= MAX;
  if (!ok) mal++;
  console.log(`${ok ? "ok   " : "PESO "} ${(b / 1024).toFixed(1).padStart(7)} KB  ${n}`);
}
console.log(`ancho de las pestanas: ${ANCHO} (debe ser 846); version ${V}`);
if (mal || ANCHO !== 846) process.exit(1);
