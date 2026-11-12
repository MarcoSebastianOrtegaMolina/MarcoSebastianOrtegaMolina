// Piloto del README del perfil: mide los cuatro experimentos en github.com y en local.
// Uso: node piloto/medir.cjs <carpeta-de-salida> [--solo-local] [--ref <commit>]
// Playwright se toma de NODE_PATH. Chromium siempre sin cabeza. Solo escribe en <carpeta-de-salida>.
// Con --ref <commit> mide la version de ese commit: sus SVG salen de `git show` (copiados dentro de la
// carpeta de salida) y la pagina es github.com/.../tree/<commit>. En ese modo solo corren las
// comprobaciones de la segunda vuelta, con lo que esa version decia de si misma.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright");

if (!process.argv[2] || process.argv[2].startsWith("--")) {
  console.error("Uso: node piloto/medir.cjs <carpeta-de-salida> [--solo-local] [--ref <commit>]");
  process.exit(2);
}
const SALIDA = path.resolve(process.argv[2]);
const SOLO_LOCAL = process.argv.includes("--solo-local");
const iRef = process.argv.indexOf("--ref");
const REF = iRef > 0 ? process.argv[iRef + 1] : null;
if (iRef > 0 && !/^[0-9a-f]{7,40}$/.test(REF || "")) { console.error("--ref necesita un hash de commit"); process.exit(2); }
const RAIZ = path.resolve(__dirname, "..");
fs.mkdirSync(SALIDA, { recursive: true });
let ASSETS = path.join(__dirname, "assets");
if (REF) {
  ASSETS = path.join(SALIDA, "assets-" + REF);
  fs.mkdirSync(ASSETS, { recursive: true });
  for (const n of execFileSync("git", ["ls-tree", "--name-only", REF, "piloto/assets/"], { cwd: RAIZ, encoding: "utf8" }).split("\n").filter(Boolean))
    fs.writeFileSync(path.join(ASSETS, path.basename(n)), execFileSync("git", ["show", `${REF}:${n}`], { cwd: RAIZ }));
}
const FUENTES = path.resolve(__dirname, "../_trabajo/fuentes");
const URL_GH = "https://github.com/MarcoSebastianOrtegaMolina/MarcoSebastianOrtegaMolina/tree/" + (REF || "piloto-cabecera");
// Lo que cada version decia de si misma: forma del plan A, criterio para decir que las fuentes se
// pintan, e instantes que se capturan como fuera del parpadeo.
const VERSION = REF
  ? { formaPlanA: "e", criterioFuentes: "global", fueraDeParpadeo: [2.5, 3.78, 8.5] }
  : { formaPlanA: "f", criterioFuentes: "por-linea", fueraDeParpadeo: [2.5, 3.4, 8.5] };
const UMBRAL = 32; // un pixel difiere si algun canal cambia mas de 32/255
const FORMAS = { a: "en linea sin espacios", b: 'align="left"', c: "tabla", d: 'en linea con align="top"', e: 'en linea con align="top", pestanas de 76 de alto', f: 'como 2e, cada pieza en <picture> con su tema, fila de 84 de alto' };
// Tiempos de captura del avatar como <img> con reloj real: armado (0.2 a 2.5), antes del parpadeo
// (3.4), mirada a un lado (5.0) y al otro (5.5) y reposo (8.5). Los cuadros del parpadeo se toman
// aparte, con el reloj de la animacion fijo (segunda vuelta, B2 a B4).
const T_AVATAR = [0.2, 0.4, 0.6, 1.2, 2.5, 3.4, 5.0, 5.5, 8.5];

const archivo = (pref) => {
  const f = fs.readdirSync(ASSETS).find((n) => n.startsWith(pref + "-v") && n.endsWith(".svg"));
  if (!f) throw new Error("falta el SVG " + pref);
  return path.join(ASSETS, f);
};
const urlArchivo = (p) => "file:///" + p.replace(/\\/g, "/");
const guardar = (n, buf) => fs.writeFileSync(path.join(SALIDA, n), buf);
const r3 = (x) => Math.round(x * 1000) / 1000;
const res = { fecha: new Date().toISOString(), url: URL_GH, umbralCanal: UMBRAL, soloLocal: SOLO_LOCAL };

// Compara dos PNG en un canvas: % de pixeles que difieren (> UMBRAL y > 8) y diferencia media.
async function comparar(lab, a, b, bandas = null) {
  return lab.evaluate(async ({ a, b, T, bandas }) => {
    const carga = (s) => new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = "data:image/png;base64," + s; });
    const [ia, ib] = await Promise.all([carga(a), carga(b)]);
    const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height);
    const px = (im) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.drawImage(im, 0, 0); return x.getImageData(0, 0, w, h).data; };
    const da = px(ia), db = px(ib);
    let n = 0, n8 = 0, s = 0, tot = 0;
    for (let i = 0; i < da.length; i += 4) {
      if (bandas) { const fila = Math.floor(i / 4 / w) / h; if (!bandas.some(([y0, y1]) => fila >= y0 && fila < y1)) continue; }
      tot++;
      const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
      s += d; if (d > T) n++; if (d > 8) n8++;
    }
    return { tamA: [ia.width, ia.height], tamB: [ib.width, ib.height], pct: +(100 * n / tot).toFixed(3), pct8: +(100 * n8 / tot).toFixed(3), mediaAbs: +(s / tot).toFixed(3) };
  }, { a: a.toString("base64"), b: b.toString("base64"), T: UMBRAL, bandas });
}
async function colorMedio(lab, png) {
  return lab.evaluate(async (s) => {
    const i = await new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.src = "data:image/png;base64," + s; });
    const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const x = c.getContext("2d"); x.drawImage(i, 0, 0);
    const d = x.getImageData(0, 0, i.width, i.height).data; let R = 0, G = 0, B = 0; const n = d.length / 4;
    for (let k = 0; k < d.length; k += 4) { R += d[k]; G += d[k + 1]; B += d[k + 2]; }
    const h = (v) => Math.round(v / n).toString(16).padStart(2, "0");
    return "#" + h(R) + h(G) + h(B);
  }, png.toString("base64"));
}

// Carga (o recarga con otra URL) una imagen y marca t0 en su evento load: ahi arranca su animacion.
// Si la imagen esta en un <picture> y una <source> coincide, se recarga esa <source>; si no, el src.
// La URL lleva un parametro nuevo para que el navegador no reuse la imagen ya animada de su cache.
async function arrancar(page, sel) {
  return page.evaluate(({ sel, extra }) => new Promise((res, rej) => {
    const img = document.querySelector(sel);
    img.removeAttribute("loading");
    const pic = img.parentElement && img.parentElement.tagName === "PICTURE" ? img.parentElement : null;
    const fuente = pic ? [...pic.querySelectorAll("source")].find((s) => !s.media || matchMedia(s.media).matches) : null;
    const mas = (u) => u + (u.includes("?") ? "&" : "?") + extra;
    img.onload = () => { window.__t0 = performance.now(); res({ via: fuente ? "source" : "img", currentSrc: img.currentSrc }); };
    img.onerror = () => rej(new Error("no cargo la imagen " + sel));
    if (fuente) fuente.srcset = mas(fuente.getAttribute("srcset")); else img.src = mas(img.getAttribute("src"));
  }), { sel, extra: "piloto=" + Date.now() });
}
// Capturas del elemento a tiempos dados desde t0; guarda cuando empezo y termino cada captura.
async function tomasEn(page, el, tiempos, nombre) {
  const out = [];
  for (const t of tiempos) {
    const ahora = await page.evaluate(() => (performance.now() - window.__t0) / 1000);
    if (t > ahora) await page.waitForTimeout((t - ahora) * 1000);
    const a = await page.evaluate(() => (performance.now() - window.__t0) / 1000);
    const png = await el.screenshot();
    const b = await page.evaluate(() => (performance.now() - window.__t0) / 1000);
    guardar(`${nombre}-${t}s.png`, png);
    out.push({ t, capturaEntre: [r3(a), r3(b)], png });
  }
  return out;
}
// Pagina local con la imagen al mismo tamano, misma fraccion de pixel y mismo fondo que en GitHub.
async function tomaLocal(nav, svg, { w, h, fx = 0, fy = 0, bg = "#0d1117", dpr = 2, reducido = false, quieto = null }, tiempos, nombre) {
  const ctx = await nav.newContext({ viewport: { width: Math.ceil(w) + 40, height: Math.ceil(h) + 40 }, deviceScaleFactor: dpr, reducedMotion: reducido ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  const html = path.join(SALIDA, `local-${nombre}.html`);
  const img = `<img id="i" alt="" src="${urlArchivo(svg)}">`;
  fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:${bg}}img{position:absolute;left:${8 + fx}px;top:${8 + fy}px;width:${w}px;height:${h}px;display:block}</style>` +
    (quieto ? `<picture><source media="(prefers-reduced-motion: reduce)" srcset="${urlArchivo(quieto)}">${img}</picture>` : img));
  await page.goto(urlArchivo(html));
  await arrancar(page, "#i");
  const el = page.locator("#i");
  const out = tiempos ? await tomasEn(page, el, tiempos, `local-${nombre}`) : await (async () => {
    await page.waitForTimeout(1500);
    const png = await el.screenshot(); guardar(`local-${nombre}.png`, png); return [{ png }];
  })();
  await ctx.close();
  return out;
}
// El avatar original (avatar-marco.svg sin cambiar sus trazos) con los colores del CV puestos en sus
// variables CSS, como hace la pagina, y el fondo del tema. Se pinta como <img> (misma via que el
// animado) y, aparte, como SVG en linea (dato informativo).
async function referenciaAvatar(nav, tema, geo, nombre) {
  const crudo = fs.readFileSync(path.join(FUENTES, "avatar-marco.svg"), "utf8");
  const v = tema === "oscuro" ? "--avatar-relleno:#ff2020;--avatar-trazo:#0b0b0b;--avatar-linea:#ff2020" : "--avatar-relleno:transparent;--avatar-trazo:#ff2020;--avatar-linea:#ff2020";
  const fondo = tema === "oscuro" ? "#0a0a0a" : "#f4efe6";
  const abre = crudo.indexOf(">", crudo.indexOf("<svg")) + 1;
  const ref = crudo.slice(0, abre) + `<style>svg{${v}}</style><rect width="1942" height="1988" fill="${fondo}"/>` + crudo.slice(abre);
  const archivoRef = path.join(SALIDA, `ref-avatar-${tema}.svg`);
  fs.writeFileSync(archivoRef, ref);
  const [comoImg] = await tomaLocal(nav, archivoRef, geo, null, nombre);
  if (!geo.conLinea) return { img: comoImg.png };
  const interno = crudo.slice(crudo.indexOf('<g id="avatar"'), crudo.lastIndexOf("</svg>"));
  const ctx = await nav.newContext({ viewport: { width: Math.ceil(geo.w) + 40, height: Math.ceil(geo.h) + 40 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const html = path.join(SALIDA, `local-${nombre}-en-linea.html`);
  fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#0d1117}svg{position:absolute;left:8px;top:8px;width:${geo.w}px;height:${geo.h}px;display:block;${v}}</style><svg id="s" viewBox="0 0 1942 1988"><rect width="1942" height="1988" fill="${fondo}"/>${interno}</svg>`);
  await page.goto(urlArchivo(html));
  await page.waitForTimeout(500);
  const png = await page.locator("#s").screenshot();
  guardar(`local-${nombre}-en-linea.png`, png);
  await ctx.close();
  return { img: comoImg.png, enLinea: png };
}
async function abrirGH(nav, { ancho, tema = "dark", dpr = 1, reducido = false }) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: 900 }, deviceScaleFactor: dpr, colorScheme: tema, reducedMotion: reducido ? "reduce" : "no-preference", locale: "en-US" });
  const page = await ctx.newPage();
  await page.goto(URL_GH, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('article.markdown-body img[alt="exp1-fuentes"]', { timeout: 90000 });
  await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll("article.markdown-body img")];
    imgs.forEach((i) => i.removeAttribute("loading"));
    await Promise.all(imgs.map((i) => (i.complete && i.naturalWidth) ? 0 : new Promise((r) => { i.addEventListener("load", r, { once: true }); i.addEventListener("error", r, { once: true }); setTimeout(r, 20000); })));
  });
  await page.waitForTimeout(800);
  return { ctx, page };
}
const imgGH = (alt) => `article.markdown-body img[alt="${alt}"]`;
async function caja(el) {
  return el.evaluate((e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, src: e.currentSrc }; });
}
const frac = (v) => v - Math.floor(v);

// Revision estatica de cada SVG: peso, http fuera del xmlns, script, foreignObject, atributos on*.
function revisarSVG() {
  const out = {};
  for (const n of fs.readdirSync(ASSETS).filter((f) => f.endsWith(".svg")).sort()) {
    const s = fs.readFileSync(path.join(ASSETS, n), "utf8");
    const http = (s.match(/https?:\/\//g) || []).length - (s.match(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g) || []).length;
    out[n] = { kb: +(Buffer.byteLength(s) / 1024).toFixed(1), http, script: (s.match(/<script/gi) || []).length, foreignObject: (s.match(/foreignObject/gi) || []).length, on: (s.match(/\son[a-z]+\s*=/gi) || []).length };
  }
  return out;
}

(async () => {
  res.svg = revisarSVG();
  const nav = await chromium.launch();
  res.navegador = "chromium " + nav.version();
  const lab = await (await nav.newContext()).newPage();
  await lab.goto("about:blank");

  if (!REF) {
  // ---------------- Experimento 1 ----------------
  const e1 = (res.exp1 = { archivos: { fuentes: path.basename(archivo("exp1-fuentes")), control: path.basename(archivo("exp1-control")) } });
  if (SOLO_LOCAL) {
    const [ref] = await tomaLocal(nav, archivo("exp1-fuentes"), { w: 846, h: 250 }, null, "exp1-fuentes");
    const [ctl] = await tomaLocal(nav, archivo("exp1-control"), { w: 846, h: 250 }, null, "exp1-control");
    e1.localControlVsLocalFuentes = await comparar(lab, ctl.png, ref.png);
  } else {
    const gh = await abrirGH(nav, { ancho: 1280, tema: "dark", dpr: 2 });
    const fondo = await gh.page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    for (const n of ["fuentes", "control"]) {
      const el = gh.page.locator(imgGH("exp1-" + n));
      await el.scrollIntoViewIfNeeded();
      await gh.page.waitForTimeout(1500);
      const c = await caja(el);
      const png = await el.screenshot();
      guardar(`gh-exp1-${n}.png`, png);
      const geo = { w: c.w, h: c.h, fx: frac(c.x), fy: frac(c.y), bg: fondo };
      const [ref] = await tomaLocal(nav, archivo("exp1-fuentes"), geo, null, `exp1-fuentes-para-${n}`);
      const [propio] = await tomaLocal(nav, archivo("exp1-" + n), geo, null, `exp1-${n}`);
      e1[n] = { caja: { ...c, x: r3(c.x), y: r3(c.y) }, githubVsLocalFuentes: await comparar(lab, png, ref.png), githubVsLocalMismoSVG: await comparar(lab, png, propio.png) };
    }
    e1.fuentesSePintan = e1.fuentes.githubVsLocalFuentes.pct <= 1;
    e1.controlFallaComoDebe = e1.control.githubVsLocalFuentes.pct > 1 && e1.control.githubVsLocalFuentes.pct > 5 * Math.max(0.01, e1.fuentes.githubVsLocalFuentes.pct);
    await gh.ctx.close();
  }

  // ---------------- Experimentos 2 y 3 ----------------
  if (!SOLO_LOCAL) {
    res.exp2 = { formas: FORMAS, casos: {} };
    res.exp3 = { archivos: { oscuro: path.basename(archivo("exp3-oscuro")), claro: path.basename(archivo("exp3-claro")) }, casos: {} };
    for (const ancho of [1280, 390]) for (const tema of ["dark", "light"]) {
      const caso = `${ancho}-${tema}`;
      const { ctx, page } = await abrirGH(nav, { ancho, tema });
      const medidas = await page.evaluate((formas) => {
        const q = (a) => document.querySelector(`article.markdown-body img[alt="${a}"]`);
        const R = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top + scrollY, r: b.right, b: b.bottom + scrollY, w: b.width, h: b.height }; };
        const out = {};
        for (const f of Object.keys(formas)) {
          const tabs = [1, 2, 3, 4, 5, 6].map((i) => q(`exp2${f}-t${i}`));
          const cu = q(`exp2${f}-cuerpo`);
          if (tabs.some((t) => !t) || !cu) { out[f] = { error: "faltan imagenes en la pagina" }; continue; }
          const rt = tabs.map(R), rc = R(cu);
          const huecosH = rt.slice(1).map((x, i) => +(x.l - rt[i].r).toFixed(3));
          const caidas = rt.filter((x) => Math.abs(x.t - rt[0].t) > 0.5).length;
          const fondoPestanas = Math.max(...rt.map((x) => x.b));
          const huecoV = +(rc.t - fondoPestanas).toFixed(3);
          out[f] = {
            huecosH, huecoV, caidas,
            altoPestana: +rt[0].h.toFixed(3), anchoCuerpo: +rc.w.toFixed(3),
            bordeDerecho: +(rc.r - rt[5].r).toFixed(3), bordeIzquierdo: +(rt[0].l - rc.l).toFixed(3),
            exito: caidas === 0 && huecosH.every((g) => Math.abs(g) <= 0.5) && Math.abs(huecoV) <= 0.5,
            clip: { x: Math.min(rc.l, ...rt.map((x) => x.l)) - 6, y: Math.min(...rt.map((x) => x.t)) - 6, r: Math.max(rc.r, ...rt.map((x) => x.r)) + 6, b: rc.b + 6 },
          };
        }
        return out;
      }, FORMAS);
      for (const [f, m] of Object.entries(medidas)) {
        if (m.clip) {
          const c = m.clip;
          guardar(`gh-exp2-${f}-${caso}.png`, await page.screenshot({ fullPage: true, clip: { x: Math.max(0, c.x), y: Math.max(0, c.y), width: Math.min(ancho, c.r) - Math.max(0, c.x), height: c.b - Math.max(0, c.y) } }));
          delete m.clip;
        }
      }
      res.exp2.casos[caso] = medidas;

      // Experimento 3
      const t3 = await page.evaluate(() => {
        const i = document.querySelector('article.markdown-body img[alt="exp3-tema"]');
        const a = document.querySelector("article.markdown-body").getBoundingClientRect();
        return {
          currentSrc: i ? i.currentSrc : null,
          dataColorMode: document.documentElement.getAttribute("data-color-mode"),
          dataLightTheme: document.documentElement.getAttribute("data-light-theme"),
          dataDarkTheme: document.documentElement.getAttribute("data-dark-theme"),
          prefiereOscuro: matchMedia("(prefers-color-scheme: dark)").matches,
          fondoBody: getComputedStyle(document.body).backgroundColor,
          muestra: { x: 2, y: a.top + scrollY + 40 },
        };
      });
      const px = await page.screenshot({ fullPage: true, clip: { x: t3.muestra.x, y: t3.muestra.y, width: 4, height: 4 } });
      t3.fondoCaptura = await colorMedio(lab, px);
      t3.archivoCargado = t3.currentSrc ? decodeURIComponent(t3.currentSrc.split("?")[0].split("/").pop()) : null;
      const el3 = page.locator(imgGH("exp3-tema"));
      if (await el3.count()) { await el3.scrollIntoViewIfNeeded(); guardar(`gh-exp3-${caso}.png`, await el3.screenshot()); }
      if (ancho === 1280) guardar(`gh-pagina-${caso}.png`, await page.screenshot());
      res.exp3.casos[caso] = t3;
      await ctx.close();
    }
  }

  // ---------------- Experimento 4 ----------------
  const e4 = (res.exp4 = {});
  for (const tema of ["oscuro", "claro"]) {
    const svg = archivo("exp4-avatar-" + tema);
    const W = 400, H = 400 * 1988 / 1942;
    const t = (e4[tema] = { archivo: path.basename(svg), kb: res.svg[path.basename(svg)].kb });
    const quieto = archivo(`exp4-avatar-${tema}-quieto`);
    const ref = await referenciaAvatar(nav, tema, { w: W, h: H, conLinea: true }, `ref-${tema}`);
    const loc = await tomaLocal(nav, svg, { w: W, h: H, quieto }, T_AVATAR, `exp4-${tema}`);
    const fin = loc[loc.length - 1];
    t.local = {
      capturas: loc.map((x) => ({ t: x.t, capturaEntre: x.capturaEntre })),
      finalVsOriginal: await comparar(lab, fin.png, ref.img),
      finalVsOriginalEnLinea: await comparar(lab, fin.png, ref.enLinea),
      originalImgVsOriginalEnLinea: await comparar(lab, ref.img, ref.enLinea),
      porTiempoVsOriginal: Object.fromEntries(await Promise.all(loc.map(async (x) => [x.t, (await comparar(lab, x.png, ref.img)).pct]))),
    };
    const [red] = await tomaLocal(nav, svg, { w: W, h: H, reducido: true, quieto }, [0.4], `exp4-${tema}-reducido`);
    t.local.reducido04VsOriginal = await comparar(lab, red.png, ref.img);
    t.local.reducido04CapturaEntre = red.capturaEntre;
    const [sinPic] = await tomaLocal(nav, svg, { w: W, h: H, reducido: true }, [0.4], `exp4-${tema}-reducido-sin-picture`);
    t.local.reducidoSinPicture04VsOriginal = await comparar(lab, sinPic.png, ref.img);

    t.fidelidadMenor1 = t.local.finalVsOriginal.pct < 1;
    t.pesoOk = t.kb <= 600;
    const sv = res.svg[path.basename(svg)];
    t.limpio = sv.http === 0 && sv.script === 0 && sv.foreignObject === 0;
  }

  }

  // ================= Segunda vuelta: una comprobacion por hallazgo del revisor =================
  // Cada comprobacion repite los pasos del revisor y deja "pasa". Con --ref corre contra esa version.
  const sv = (res.segundaVuelta = { ref: REF || "piloto-cabecera", version: VERSION });
  const nombreDe = (u) => (u ? decodeURIComponent(u.split("?")[0].split("/").pop()) : null);
  const rangos = (ws) => { const o = []; for (const w of ws) { const u = o[o.length - 1]; if (u && w === u[1] + 1) u[1] = w; else o.push([w, w]); } return o.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(", "); };

  // ---- M1 y M3: barrido de 300 a 1400 px de la forma del plan A, en los dos temas, a 1x y 2x ----
  if (!SOLO_LOCAL) {
    const f = VERSION.formaPlanA;
    const m = (sv.M1_M3 = { forma: f, combos: {} });
    for (const tema of ["dark", "light"]) for (const dpr of [1, 2]) {
      const { ctx, page } = await abrirGH(nav, { ancho: 1400, tema, dpr });
      const piezas = await page.evaluate((f) => [1, 2, 3, 4, 5, 6].map((i) => `exp2${f}-t${i}`).concat([`exp2${f}-cuerpo`]).map((a) => {
        const i = document.querySelector(`article.markdown-body img[alt="${a}"]`);
        return i ? { alt: a, src: i.currentSrc, enPicture: i.parentElement.tagName === "PICTURE" } : { alt: a, src: null, enPicture: false };
      }), f);
      piezas.forEach((p) => (p.src = nombreDe(p.src)));
      const fallos = [];
      let peor = null;
      for (let w = 300; w <= 1400; w++) {
        await page.setViewportSize({ width: w, height: 900 });
        const r = await page.evaluate((f) => {
          const q = (a) => document.querySelector(`article.markdown-body img[alt="${a}"]`);
          const t = [1, 2, 3, 4, 5, 6].map((i) => q(`exp2${f}-t${i}`)), cu = q(`exp2${f}-cuerpo`);
          if (t.some((x) => !x) || !cu) return { error: "faltan imagenes" };
          const rt = t.map((x) => x.getBoundingClientRect()), rc = cu.getBoundingClientRect();
          const maxH = Math.max(...rt.slice(1).map((x, i) => Math.abs(x.left - rt[i].right)));
          const caidas = rt.filter((x) => Math.abs(x.top - rt[0].top) > 0.5).length;
          const V = rc.top - Math.max(...rt.map((x) => x.bottom));
          const borde = rc.right - rt[5].right;
          return { maxH: +maxH.toFixed(3), V: +V.toFixed(3), caidas, borde: +borde.toFixed(3), alto: +rt[0].height.toFixed(3), exito: caidas === 0 && maxH <= 0.5 && Math.abs(V) <= 0.5 && Math.abs(borde) <= 0.5 };
        }, f);
        if (r.error) { fallos.push({ w, error: r.error }); break; }
        if (!r.exito) fallos.push({ w, ...r });
        if (!peor || Math.abs(r.V) > Math.abs(peor.V)) peor = { w, ...r };
        if (w === 320) {
          const c = await page.evaluate((f) => { const q = (a) => document.querySelector(`article.markdown-body img[alt="${a}"]`).getBoundingClientRect(); const a = q(`exp2${f}-t1`), b = q(`exp2${f}-cuerpo`); return { x: b.left, y: a.top + scrollY, w: b.width, h: b.bottom - a.top }; }, f).catch(() => null);
          if (c) guardar(`sv-m1-${f}-320-${tema}-dpr${dpr}.png`, await page.screenshot({ fullPage: true, clip: { x: c.x, y: c.y - 4, width: c.w, height: c.h + 8 } }));
        }
      }
      const desde320 = fallos.filter((x) => x.w >= 320);
      m.combos[`${tema}-dpr${dpr}`] = {
        piezas, fallos: fallos.length, fallosDesde320: desde320.length, anchosQueFallan: rangos(fallos.map((x) => x.w)),
        minimoSostenido: fallos.length ? Math.max(...fallos.map((x) => x.w)) + 1 : 300, peorHuecoV: peor, ejemploFallo: fallos[0] || null,
        temaBien: piezas.every((p) => p.src && p.src.includes(tema === "dark" ? "oscuro" : "claro")),
      };
      await ctx.close();
    }
    const cs = Object.values(m.combos);
    m.M1pasa = cs.every((c) => c.fallosDesde320 === 0);
    m.minimoSostenido = Math.max(...cs.map((c) => c.minimoSostenido));
    m.M3pasa = m.M1pasa && cs.every((c) => c.temaBien && c.piezas.every((p) => p.enPicture));
  }

  // ---- M2: un solo <picture> del avatar con cuatro fuentes, cuatro combinaciones en github.com ----
  if (!SOLO_LOCAL) {
    const m = (sv.M2 = { combos: {} });
    const esperado = { "dark-no-preference": "exp4-avatar-oscuro-v", "dark-reduce": "exp4-avatar-oscuro-quieto-v", "light-no-preference": "exp4-avatar-claro-v", "light-reduce": "exp4-avatar-claro-quieto-v" };
    for (const tema of ["dark", "light"]) for (const reducido of [false, true]) {
      const k = `${tema}-${reducido ? "reduce" : "no-preference"}`;
      const { ctx, page } = await abrirGH(nav, { ancho: 1280, tema, dpr: 2, reducido });
      const sel = imgGH("exp4-avatar");
      if (!(await page.locator(sel).count())) { m.combos[k] = { error: "no hay imagen con alt exp4-avatar", pasa: false }; await ctx.close(); continue; }
      const nFuentes = await page.evaluate((s) => { const p = document.querySelector(s).parentElement; return p.tagName === "PICTURE" ? p.querySelectorAll("source").length : 0; }, sel);
      const el = page.locator(sel);
      await el.scrollIntoViewIfNeeded();
      const fondo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const carga = await arrancar(page, sel);
      const c = await caja(el);
      const tomas = await tomasEn(page, el, reducido ? [0.4] : [0.4, 8.5], `sv-m2-${k}`);
      const geo = { w: c.w, h: c.h, fx: frac(c.x), fy: frac(c.y), bg: fondo };
      const tArch = tema === "dark" ? "oscuro" : "claro", otro = tema === "dark" ? "claro" : "oscuro";
      const [finEsp] = await tomaLocal(nav, archivo(`exp4-avatar-${tArch}`), geo, [8.5], `sv-m2-final-${tArch}-${k}`);
      const [finOtro] = await tomaLocal(nav, archivo(`exp4-avatar-${otro}`), geo, [8.5], `sv-m2-final-${otro}-${k}`);
      const ult = tomas[tomas.length - 1];
      const r = {
        fuentesEnElPicture: nFuentes, archivoCargado: nombreDe(carga.currentSrc), esperado: esperado[k],
        capturas: tomas.map((x) => ({ t: x.t, capturaEntre: x.capturaEntre })),
        capturaVsFinalEsperado: (await comparar(lab, ult.png, finEsp.png)).pct,
        capturaVsFinalOtroTema: (await comparar(lab, ult.png, finOtro.png)).pct,
        corre: reducido ? null : (await comparar(lab, tomas[0].png, tomas[1].png)).pct,
      };
      r.cargaBien = !!r.archivoCargado && r.archivoCargado.startsWith(esperado[k]);
      r.pasa = r.cargaBien && r.capturaVsFinalEsperado <= 1.5 && r.capturaVsFinalOtroTema > 10 && (reducido || r.corre > 1);
      m.combos[k] = r;
      await ctx.close();
    }
    m.pasa = Object.values(m.combos).every((r) => r.pasa);
  }

  // ---- B1: fuentes comparadas por linea de texto, con un control por fuente ----
  {
    const ALTO = 250, FAMS = { sg: "PilotoSG", inter: "PilotoInter", mono: "PilotoMono" };
    const BANDAS = { sg: [[36, 58], [92, 188]], mono: [[66, 84]], inter: [[202, 224]] };
    const fr = (bs) => bs.map(([a, b]) => [a / ALTO, b / ALTO]);
    const fuentesSvg = archivo("exp1-fuentes");
    const texto = fs.readFileSync(fuentesSvg, "utf8");
    const geo = { w: 846, h: 250 };
    const [base] = await tomaLocal(nav, fuentesSvg, geo, null, "sv-b1-fuentes");
    const m = (sv.B1 = { criterio: VERSION.criterioFuentes, bandas: BANDAS, controles: {} });
    for (const k of Object.keys(FAMS)) {
      const t2 = texto.replace(new RegExp(`@font-face\\{font-family:'${FAMS[k]}'[^}]*\\}`), "");
      if (t2 === texto) throw new Error("no encontre la @font-face de " + k);
      const sin = path.join(SALIDA, `sv-b1-sin-${k}.svg`);
      fs.writeFileSync(sin, t2);
      const [ctl] = await tomaLocal(nav, sin, geo, null, `sv-b1-sin-${k}`);
      const global = (await comparar(lab, ctl.png, base.png)).pct;
      const banda = (await comparar(lab, ctl.png, base.png, fr(BANDAS[k]))).pct;
      m.controles[k] = { global, banda, detectado: VERSION.criterioFuentes === "global" ? global > 1 : banda > 1 };
    }
    m.pasaLocal = Object.values(m.controles).every((c) => c.detectado);
    if (!SOLO_LOCAL && !REF) {
      const gh = await abrirGH(nav, { ancho: 1280, tema: "dark", dpr: 2 });
      const fondo = await gh.page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      m.github = {};
      for (const n of ["fuentes", "sin-sg", "sin-inter", "sin-mono"]) {
        const el = gh.page.locator(imgGH("exp1-" + n));
        await el.scrollIntoViewIfNeeded();
        await gh.page.waitForTimeout(1500);
        const c = await caja(el);
        const png = await el.screenshot();
        guardar(`sv-b1-gh-${n}.png`, png);
        const [loc] = await tomaLocal(nav, fuentesSvg, { w: c.w, h: c.h, fx: frac(c.x), fy: frac(c.y), bg: fondo }, null, `sv-b1-fuentes-para-${n}`);
        m.github[n] = Object.fromEntries(await Promise.all(Object.keys(BANDAS).map(async (b) => [b, (await comparar(lab, png, loc.png, fr(BANDAS[b]))).pct])));
      }
      await gh.ctx.close();
      m.pasaGithub = Object.values(m.github.fuentes).every((v) => v <= 1) && ["sg", "inter", "mono"].every((k) => m.github["sin-" + k][k] > 1);
    }
    m.pasa = m.pasaLocal && m.pasaGithub !== false;
  }

  // ---- B2, B3 y B4: el parpadeo con el reloj de la animacion fijo (cuadros exactos) ----
  async function reloj(svg) {
    const ctx = await nav.newContext({ viewport: { width: 1942, height: 1988 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(urlArchivo(svg));
    await page.waitForTimeout(300);
    return {
      en: async (t, clip) => {
        await page.evaluate(async (ms) => { document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ms; }); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); }, t * 1000);
        return page.screenshot({ clip });
      },
      cerrar: () => ctx.close(),
    };
  }
  function analizar(serie) {
    const max = Math.max(...serie.map((s) => s.v));
    if (max < 0.5) return { error: "no hay parpadeo en la ventana", max };
    const i0 = serie.findIndex((s) => s.v > 0.02 * max), i1 = serie.findIndex((s) => s.v >= 0.95 * max);
    let i2 = i1; while (i2 + 1 < serie.length && serie[i2 + 1].v >= 0.95 * max) i2++;
    let i3 = i2; while (i3 + 1 < serie.length && serie[i3 + 1].v > 0.02 * max) i3++;
    const medio = (a, b) => serie.slice(a, b).filter((s) => s.v > 0.1 * max && s.v < 0.9 * max).length;
    const monot = (a, b, sg) => serie.slice(a, b).every((s, k, arr) => k === 0 || sg * (s.v - arr[k - 1].v) >= -0.005 * max);
    return {
      max: +max.toFixed(3), empieza: serie[i0].t, cerrado: [serie[i1].t, serie[i2].t], termina: serie[i3].t,
      cierreMs: Math.round((serie[i1].t - serie[i0].t) * 1000), aperturaMs: Math.round((serie[i3].t - serie[i2].t) * 1000),
      intermediosCierre: medio(i0, i1), intermediosApertura: medio(i2 + 1, i3 + 1),
      sinSaltos: monot(i0, i1 + 1, 1) && monot(i2, i3 + 1, -1), tMedioCerrado: +((serie[i1].t + serie[i2].t) / 2).toFixed(3),
    };
  }
  {
    const b2 = (sv.B2 = {}), b3 = (sv.B3 = {}), b4 = (sv.B4 = { fueraDeParpadeo: VERSION.fueraDeParpadeo });
    const OJOS = { x: 560, y: 900, width: 840, height: 260 }, DER = { x: 1040, y: 860, width: 440, height: 300 };
    for (const tema of ["oscuro", "claro"]) {
      await referenciaAvatar(nav, tema, { w: 400, h: 400 * 1988 / 1942 }, `sv-ref-${tema}`);
      const rel = await reloj(archivo(`exp4-avatar-${tema}`));
      const abierto = await rel.en(3.0, OJOS);
      const parpadeos = [];
      for (const [a, b] of [[3.5, 4.3], [6.1, 6.9]]) {
        const serie = [];
        for (let k = 0; a + k * 0.025 <= b + 1e-9; k++) { const t = +(a + k * 0.025).toFixed(3); const png = await rel.en(t, OJOS); serie.push({ t, v: (await comparar(lab, png, abierto)).pct, png }); }
        const r = analizar(serie);
        if (!r.error) {
          const mitad = serie.filter((s) => s.t >= r.empieza && s.t <= r.cerrado[0]).sort((x, y) => Math.abs(x.v - r.max / 2) - Math.abs(y.v - r.max / 2))[0];
          guardar(`sv-b3-${tema}-${mitad.t}s-mitad.png`, mitad.png);
          r.serie = serie.map((s) => [s.t, s.v]);
        }
        parpadeos.push(r);
      }
      b3[tema] = parpadeos;
      // B2: ojo derecho cerrado contra el original, a 1 unidad por pixel.
      const tC = parpadeos[0].error ? 3.9 : parpadeos[0].tMedioCerrado;
      const cerrado = await rel.en(tC, DER);
      guardar(`sv-b2-${tema}-cerrado-${tC}s.png`, cerrado);
      guardar(`sv-b3-${tema}-cerrado-${tC}s-ojos.png`, await rel.en(tC, OJOS));
      // B4: el mismo instante dos veces da lo mismo con el reloj fijo.
      const d1 = await rel.en(3.4, OJOS), d2 = await rel.en(3.4, OJOS);
      b4[`${tema}Repetible`] = (await comparar(lab, d1, d2)).pct === 0;
      await rel.cerrar();
      const relO = await reloj(path.join(SALIDA, `ref-avatar-${tema}.svg`));
      const orig = await relO.en(0, DER);
      guardar(`sv-b2-${tema}-original.png`, orig);
      await relO.cerrar();
      b2[tema] = await lab.evaluate(async ({ c, o, umbral }) => {
        const carga = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = "data:image/png;base64," + s; });
        const [ic, io] = await Promise.all([carga(c), carga(o)]);
        const W = ic.width, H = ic.height, X0 = 1040, Y0 = 860;
        const px = (im) => { const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d"); g.drawImage(im, 0, 0); return g.getImageData(0, 0, W, H).data; };
        const dc = px(ic), dor = px(io);
        const osc = (d, x, y) => { const k = ((y - Y0) * W + (x - X0)) * 4; return 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2] < umbral; };
        // Restos: pixeles oscuros dentro del ojo que no son la linea de ojo cerrado (la mancha mayor).
        const R = { x0: 1085, x1: 1380, y0: 940, y1: 1130 }, vis = new Set(), comps = [];
        for (let y = R.y0; y < R.y1; y++) for (let x = R.x0; x < R.x1; x++) {
          const id = y * 4000 + x; if (vis.has(id) || !osc(dc, x, y)) continue;
          let n = 0; const pila = [[x, y]]; vis.add(id);
          while (pila.length) { const [a, b] = pila.pop(); n++; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const u = a + dx, v = b + dy, j = v * 4000 + u; if (u < R.x0 || u >= R.x1 || v < R.y0 || v >= R.y1 || vis.has(j) || !osc(dc, u, v)) continue; vis.add(j); pila.push([u, v]); } }
          comps.push(n);
        }
        comps.sort((a, b) => b - a);
        const restos = comps.slice(1).reduce((s, n) => s + n, 0);
        // Canto: borde de abajo de la linea de arriba del lente, cerrado contra original.
        // La linea es a mano y tiene trazos dobles: se juntan los tramos oscuros separados por 10 px o menos.
        const fondoLinea = (d, x) => { let y = 880; while (y < 915 && !osc(d, x, y)) y++; if (y >= 915) return null; let b = y; for (;;) { while (b + 1 < 1150 && osc(d, x, b + 1)) b++; let k = b + 1; while (k <= b + 10 && !osc(d, x, k)) k++; if (k <= b + 10) b = k; else break; } return { ini: y, fin: b }; };
        const esp = [];
        for (let x = 1100; x <= 1360; x++) { const r = fondoLinea(dor, x); esp.push(r && r.fin - r.ini <= 40 ? r.fin : null); }
        // Donde la linea del original se junta con el iris no se sabe donde acaba la linea: lo
        // aceptable es quedar entre los bordes de las columnas limpias mas cercanas a cada lado.
        const banda = esp.map((v, i) => { if (v !== null) return [v, v]; let a = i - 1; while (a >= 0 && esp[a] === null) a--; let b = i + 1; while (b < esp.length && esp[b] === null) b++; const vs = [a >= 0 ? esp[a] : null, b < esp.length ? esp[b] : null].filter((z) => z !== null); return vs.length ? [Math.min(...vs), Math.max(...vs)] : null; });
        let canto = 0, mordida = 0, cantoX = null, mordidaX = null;
        for (let x = 1100; x <= 1360; x++) { const r = fondoLinea(dc, x), e = banda[x - 1100]; if (!r || !e) continue; if (r.fin - e[1] > canto) { canto = r.fin - e[1]; cantoX = x; } if (e[0] - r.fin > mordida) { mordida = e[0] - r.fin; mordidaX = x; } }
        return { restos, manchas: comps.length - 1, cantoMax: +canto.toFixed(1), cantoEnX: cantoX, mordidaMax: +mordida.toFixed(1), mordidaEnX: mordidaX };
      }, { c: cerrado.toString("base64"), o: orig.toString("base64"), umbral: tema === "oscuro" ? 60 : 170 });
      b2[tema].tCerrado = tC;
      b2[tema].pasa = b2[tema].restos <= 8 && b2[tema].cantoMax <= 5 && b2[tema].mordidaMax <= 5;
    }
    b2.pasa = b2.oscuro.pasa && b2.claro.pasa;
    const okB3 = (r) => !r.error && r.intermediosCierre >= 2 && r.intermediosApertura >= 2 && r.cierreMs >= 100 && r.cierreMs <= 200 && r.aperturaMs >= 100 && r.aperturaMs <= 200 && r.sinSaltos;
    b3.pasa = ["oscuro", "claro"].every((t) => b3[t].every(okB3));
    // B4: cada instante "fuera del parpadeo" queda a 150 ms o mas de los dos parpadeos medidos.
    const tramos = b3.oscuro.filter((r) => !r.error).map((r) => [r.empieza - 0.025, r.termina + 0.025]);
    b4.margenes = VERSION.fueraDeParpadeo.map((t) => ({ t, margenMs: Math.round(Math.min(...tramos.map(([a, b]) => (t < a ? a - t : t > b ? t - b : 0))) * 1000) }));
    b4.pasa = tramos.length === 2 && b4.margenes.every((x) => x.margenMs >= 150) && b4.oscuroRepetible && b4.claroRepetible;
  }
  sv.resumen = { M1: sv.M1_M3 ? sv.M1_M3.M1pasa : null, M2: sv.M2 ? sv.M2.pasa : null, M3: sv.M1_M3 ? sv.M1_M3.M3pasa : null, B1: sv.B1.pasa, B2: sv.B2.pasa, B3: sv.B3.pasa, B4: sv.B4.pasa };

  await nav.close();
  fs.writeFileSync(path.join(SALIDA, "medicion.json"), JSON.stringify(res, null, 2) + "\n");
  console.log(JSON.stringify(res, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
