// Piloto del README del perfil: mide los cuatro experimentos en github.com y en local.
// Uso: node piloto/medir.cjs <carpeta-de-salida> [--solo-local]
// Playwright se toma de NODE_PATH. Chromium siempre sin cabeza. Solo escribe en <carpeta-de-salida>.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

if (!process.argv[2] || process.argv[2].startsWith("--")) {
  console.error("Uso: node piloto/medir.cjs <carpeta-de-salida> [--solo-local]");
  process.exit(2);
}
const SALIDA = path.resolve(process.argv[2]);
const SOLO_LOCAL = process.argv.includes("--solo-local");
const ASSETS = path.join(__dirname, "assets");
const FUENTES = path.resolve(__dirname, "../_trabajo/fuentes");
const URL_GH = "https://github.com/MarcoSebastianOrtegaMolina/MarcoSebastianOrtegaMolina/tree/piloto-cabecera";
const UMBRAL = 32; // un pixel difiere si algun canal cambia mas de 32/255
const FORMAS = { a: "en linea sin espacios", b: 'align="left"', c: "tabla", d: 'en linea con align="top"', e: 'en linea con align="top", pestanas de 76 de alto' };
// Tiempos de captura del avatar: armado (0.2 a 2.5), parpadeo 1 entrecerrando (3.78) y cerrado
// (3.88), mirada a un lado (5.0) y al otro (5.5), parpadeo 2 cerrado (6.46) y reposo (8.5).
const T_AVATAR = [0.2, 0.4, 0.6, 1.2, 2.5, 3.78, 3.88, 5.0, 5.5, 6.46, 8.5];
fs.mkdirSync(SALIDA, { recursive: true });

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
async function comparar(lab, a, b) {
  return lab.evaluate(async ({ a, b, T }) => {
    const carga = (s) => new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = "data:image/png;base64," + s; });
    const [ia, ib] = await Promise.all([carga(a), carga(b)]);
    const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height);
    const px = (im) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.drawImage(im, 0, 0); return x.getImageData(0, 0, w, h).data; };
    const da = px(ia), db = px(ib);
    let n = 0, n8 = 0, s = 0;
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
      s += d; if (d > T) n++; if (d > 8) n8++;
    }
    const tot = w * h;
    return { tamA: [ia.width, ia.height], tamB: [ib.width, ib.height], pct: +(100 * n / tot).toFixed(3), pct8: +(100 * n8 / tot).toFixed(3), mediaAbs: +(s / tot).toFixed(3) };
  }, { a: a.toString("base64"), b: b.toString("base64"), T: UMBRAL });
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

    if (!SOLO_LOCAL) {
      for (const reducido of [false, true]) {
        const gh = await abrirGH(nav, { ancho: 1280, tema: "dark", dpr: 2, reducido });
        const sel = imgGH("exp4-avatar-" + tema);
        const el = gh.page.locator(sel);
        await el.scrollIntoViewIfNeeded();
        const fondo = await gh.page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        const carga = await arrancar(gh.page, sel);
        const c = await caja(el);
        const tomas = await tomasEn(gh.page, el, reducido ? [0.4] : [0.4, 8.5], `gh-exp4-${tema}${reducido ? "-reducido" : ""}`);
        const geo = { w: c.w, h: c.h, fx: frac(c.x), fy: frac(c.y), bg: fondo };
        const [locFin] = await tomaLocal(nav, svg, geo, [8.5], `exp4-${tema}-final-geo-gh`);
        const refGeo = (await referenciaAvatar(nav, tema, geo, `ref-${tema}-geo-gh`)).img;
        if (!reducido) {
          t.github = {
            caja: { x: r3(c.x), y: r3(c.y), w: r3(c.w), h: r3(c.h) }, cargo: carga,
            capturas: tomas.map((x) => ({ t: x.t, capturaEntre: x.capturaEntre })),
            t04VsT85: await comparar(lab, tomas[0].png, tomas[1].png),
            finalVsLocalFinal: await comparar(lab, tomas[1].png, locFin.png),
            finalVsOriginal: await comparar(lab, tomas[1].png, refGeo),
          };
          t.github.animacionCorre = t.github.t04VsT85.pct > 1;
          t.github.finalCoincide = t.github.finalVsLocalFinal.pct <= 1.5;
        } else {
          t.githubReducido = {
            cargo: carga, capturaEntre: tomas[0].capturaEntre,
            t04VsLocalFinal: await comparar(lab, tomas[0].png, locFin.png),
            t04VsOriginal: await comparar(lab, tomas[0].png, refGeo),
          };
          t.githubReducido.quietoYCompleto = t.githubReducido.t04VsLocalFinal.pct <= 1.5;
        }
        await gh.ctx.close();
      }
    }
    t.fidelidadMenor1 = t.local.finalVsOriginal.pct < 1;
    t.pesoOk = t.kb <= 600;
    const sv = res.svg[path.basename(svg)];
    t.limpio = sv.http === 0 && sv.script === 0 && sv.foreignObject === 0;
  }

  await nav.close();
  fs.writeFileSync(path.join(SALIDA, "medicion.json"), JSON.stringify(res, null, 2) + "\n");
  console.log(JSON.stringify(res, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
