// Measures the header as GitHub shows it (and, where a reference is needed, locally) with Playwright.
//   NODE_PATH=<folder with playwright> node pruebas/medir.cjs <output-folder> [--ref readme-nuevo] [--skip-sweep]
// Writes medicion.json and screenshots into <output-folder>. Checks:
//   4 seams: no gap or dropped piece from 320 to 1400 px, dark and light, 1x and 2x
//   5 every <picture> loads the right file for each theme, width and reduced-motion setting
//   6 avatar: animation runs; final frame vs the original drawing; with reduced motion the first frame is final
//   7 on-screen text sizes at 1280 and 390 px
//   8 contrast measured in the screenshots, both themes
//   9 every README link answers 200 (curl -I)
//  10 the sketch and the desktop dark header side by side
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.resolve(process.argv[2] || "");
if (!process.argv[2]) { console.error("usage: node pruebas/medir.cjs <output-folder> [--ref BRANCH] [--skip-sweep]"); process.exit(2); }
const iRef = process.argv.indexOf("--ref");
const REF = iRef > 0 ? process.argv[iRef + 1] : "readme-nuevo";
const SKIP_SWEEP = process.argv.includes("--skip-sweep");
const iOnly = process.argv.indexOf("--only"); // e.g. --only 6,8 runs just those checks
const ONLY = iOnly > 0 ? process.argv[iOnly + 1].split(",") : null;
const want = (k) => !ONLY || ONLY.includes(k);
const URL_GH = `https://github.com/MarcoSebastianOrtegaMolina/MarcoSebastianOrtegaMolina/tree/${REF}`;
const SKETCH = path.join(ROOT, "_trabajo/referencia/boceto-3-portfolio-exe.png"); // optional, not versioned
const THRESHOLD = 32; // a pixel differs if a channel changes by more than 32/255
fs.mkdirSync(OUT, { recursive: true });
const save = (name, buf) => fs.writeFileSync(path.join(OUT, name), buf);
const r3 = (x) => Math.round(x * 1000) / 1000;
const baseOf = (src) => decodeURIComponent(String(src).split("?")[0].split("/").pop()).replace(/-[0-9a-f]{8}\.svg$/, "");
const fileUrl = (p) => pathToFileURL(p).href;

const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
const ROWS = readme.match(/<p>(.*)<\/p>/s)[1].split("<br>").map((r) => (r.match(/<picture>/g) || []).length);
const HREFS = [...new Set([...readme.matchAll(/href="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&")))];
const PICS = 'article.markdown-body picture > img';

async function openGH(nav, { width, theme = "dark", dpr = 1, reduce = false }) {
  const ctx = await nav.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: dpr, colorScheme: theme, reducedMotion: reduce ? "reduce" : "no-preference", locale: "en-US" });
  const page = await ctx.newPage();
  await page.goto(URL_GH, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector(PICS, { timeout: 90000 });
  await waitImages(page, width <= 767 ? "-mob-" : "-desk-");
  return { ctx, page };
}
async function waitImages(page, layout) {
  await page.evaluate(() => document.querySelectorAll("article.markdown-body img").forEach((i) => i.removeAttribute("loading")));
  await page.waitForFunction(({ sel, layout, n }) => {
    const imgs = [...document.querySelectorAll(sel)];
    return imgs.length === n && imgs.every((i) => i.complete && i.naturalWidth > 0 && i.currentSrc.includes(layout));
  }, { sel: PICS, layout, n: ROWS.reduce((a, b) => a + b, 0) }, { timeout: 60000, polling: 50 });
}
async function headerBox(page) {
  return page.evaluate((sel) => {
    const r = [...document.querySelectorAll(sel)].map((i) => i.getBoundingClientRect());
    const x = Math.min(...r.map((b) => b.left)), y = Math.min(...r.map((b) => b.top)) + scrollY;
    return { x, y, width: Math.max(...r.map((b) => b.right)) - x, height: Math.max(...r.map((b) => b.bottom)) + scrollY - y };
  }, PICS);
}

// Pixel comparison of two PNGs in a canvas (inside a blank page): % of pixels whose largest channel
// difference is over THRESHOLD, optionally inside a rectangle [x, y, w, h] in image pixels.
async function compare(lab, a, b, box = null) {
  return lab.evaluate(async ({ a, b, T, box }) => {
    const load = (s) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = "data:image/png;base64," + s; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height);
    const px = (im) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.drawImage(im, 0, 0); return x.getImageData(0, 0, w, h).data; };
    const da = px(ia), db = px(ib);
    const [x0, y0, bw, bh] = box ? box.map(Math.round) : [0, 0, w, h];
    let n = 0, tot = 0;
    for (let y = Math.max(0, y0); y < Math.min(h, y0 + bh); y++) for (let x = Math.max(0, x0); x < Math.min(w, x0 + bw); x++) {
      const i = (y * w + x) * 4; tot++;
      if (Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2])) > T) n++;
    }
    return { size: [w, h], pct: +(100 * n / Math.max(1, tot)).toFixed(3) };
  }, { a: a.toString("base64"), b: b.toString("base64"), T: THRESHOLD, box });
}

// Contrast of one text run measured in a screenshot: background = most common color in the run's box,
// text = the 99th percentile of contrast against it among the pixels that differ from it.
async function contrast(lab, png, box) {
  return lab.evaluate(async ({ png, box }) => {
    const i = await new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = "data:image/png;base64," + png; });
    const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const x = c.getContext("2d"); x.drawImage(i, 0, 0);
    const [x0, y0, w, h] = box.map(Math.round);
    const d = x.getImageData(Math.max(0, x0), Math.max(0, y0), Math.max(1, Math.min(w, i.width - x0)), Math.max(1, Math.min(h, i.height - y0))).data;
    const lum = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const count = new Map();
    for (let k = 0; k < d.length; k += 4) { const key = (d[k] << 16) | (d[k + 1] << 8) | d[k + 2]; count.set(key, (count.get(key) || 0) + 1); }
    const bgKey = [...count].sort((a, b) => b[1] - a[1])[0][0];
    const bg = [(bgKey >> 16) & 255, (bgKey >> 8) & 255, bgKey & 255];
    const lb = lum(...bg);
    const ratios = [];
    for (let k = 0; k < d.length; k += 4) {
      if (Math.max(Math.abs(d[k] - bg[0]), Math.abs(d[k + 1] - bg[1]), Math.abs(d[k + 2] - bg[2])) <= 8) continue;
      const l = lum(d[k], d[k + 1], d[k + 2]);
      ratios.push((Math.max(l, lb) + 0.05) / (Math.min(l, lb) + 0.05));
    }
    ratios.sort((a, b) => a - b);
    const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
    return { bg: hex(bg), textPixels: ratios.length, ratio: ratios.length ? +ratios[Math.floor(ratios.length * 0.99)].toFixed(2) : null };
  }, { png: png.toString("base64"), box });
}

// Reload one image with a fresh URL and mark the moment it loads: its animation starts there.
async function restart(page, index) {
  return page.evaluate(({ sel, index, extra }) => new Promise((ok, ko) => {
    const img = document.querySelectorAll(sel)[index];
    const src = [...img.parentElement.querySelectorAll("source")].find((s) => matchMedia(s.media).matches);
    const add = (u) => u + (u.includes("?") ? "&" : "?") + extra;
    img.onload = () => { window.__t0 = performance.now(); ok(img.currentSrc); };
    img.onerror = () => ko(new Error("image did not load"));
    if (src) src.srcset = add(src.getAttribute("srcset")); else img.src = add(img.getAttribute("src"));
  }), { sel: PICS, index, extra: "m=" + Date.now() });
}
async function shotAt(page, el, t) {
  const now = await page.evaluate(() => (performance.now() - window.__t0) / 1000);
  if (t > now) await page.waitForTimeout((t - now) * 1000);
  const at = await page.evaluate(() => (performance.now() - window.__t0) / 1000);
  return { png: await el.screenshot(), at: r3(at) };
}

(async () => {
  const { buildFromDisk } = await import(pathToFileURL(path.join(ROOT, "generador/generar.mjs")).href);
  const built = buildFromDisk();
  const fileByBase = new Map(built.files.map((f) => [f.base, f]));
  const nav = await chromium.launch({ headless: true });
  const lab = await (await nav.newContext()).newPage();
  await lab.goto("about:blank");
  const res = { date: new Date().toISOString(), url: URL_GH, chromium: nav.version(), rows: ROWS };
  const nPics = ROWS.reduce((a, b) => a + b, 0);
  const heroIndex = ROWS[0], statusIndex = nPics - 1;

  // ---------- 5. which file each <picture> loads ----------
  if (want("5")) {
    const cases = [];
    for (const width of [1280, 390]) for (const theme of ["dark", "light"]) for (const reduce of [false, true]) {
      const { ctx, page } = await openGH(nav, { width, theme, reduce });
      const got = await page.evaluate((sel) => [...document.querySelectorAll(sel)].map((i) => ({ src: i.currentSrc, media: [...i.parentElement.querySelectorAll("source")].map((s) => s.getAttribute("media")) })), PICS);
      const layout = width <= 767 ? "mob" : "desk";
      const wrong = [];
      got.forEach((g, i) => {
        const b = baseOf(g.src);
        const animated = i === heroIndex || i === statusIndex;
        const want = new RegExp(`-${layout}-${theme}${animated && reduce ? "-still" : ""}$`);
        if (!want.test(b)) wrong.push(`${b} (want *-${layout}-${theme}${animated && reduce ? "-still" : ""})`);
      });
      cases.push({ width, theme, reduce, pictures: got.length, sourcesKept: got.every((g) => g.media.every(Boolean)), wrong });
      await ctx.close();
    }
    res.p5 = { cases, pass: cases.every((c) => c.pictures === nPics && c.sourcesKept && !c.wrong.length) };
    console.log("5 sources:", res.p5.pass, cases.filter((c) => c.wrong.length).map((c) => JSON.stringify(c)).join(" "));
  }

  // ---------- 7 and 8: text sizes and contrast, plus screenshots for review ----------
  if (want("7") || want("8")) {
    const sizes = [], contrasts = [];
    for (const width of [1280, 390]) for (const theme of ["dark", "light"]) {
      const { ctx, page } = await openGH(nav, { width, theme, dpr: 2 });
      // SVG animations start when the image is first painted: bring the header into view, then wait
      // until the avatar has finished building up.
      await page.evaluate((sel) => document.querySelectorAll(sel)[0].scrollIntoView({ block: "start" }), PICS);
      await page.waitForTimeout(3200);
      const box = await headerBox(page);
      save(`gh-${width}-${theme}.png`, await page.screenshot({ fullPage: true, clip: { x: box.x - 6, y: box.y - 6, width: box.width + 12, height: box.height + 12 } }));
      const imgs = await page.$$(PICS);
      for (const el of imgs) {
        const info = await el.evaluate((i) => ({ src: i.currentSrc, w: i.getBoundingClientRect().width }));
        const f = fileByBase.get(baseOf(info.src));
        if (!f) { sizes.push({ width, theme, error: "unknown file " + baseOf(info.src) }); continue; }
        const scale = info.w / f.viewW;
        const png = f.texts.length ? await el.screenshot() : null;
        for (const t of f.texts) {
          sizes.push({ width, theme, file: f.base, text: t.label, px: r3(t.size * scale) });
          for (const run of t.runs) {
            if (run.x1 - run.x0 < 0.5 * run.full) continue; // a run cut by the piece edge is measured in the piece that holds most of it
            const b = [(run.x0 - f.viewX) * scale * 2, t.y0 * scale * 2, (run.x1 - run.x0) * scale * 2, (t.y1 - t.y0) * scale * 2];
            const c = await contrast(lab, png, b);
            const px = t.size * scale;
            const large = px >= 24 || (px >= 18.66 && /600|700/.test(run.face));
            contrasts.push({ width, theme, file: f.base, text: run.text.trim().slice(0, 40), px: r3(px), large, need: large ? 3 : 4.5, ...c, pass: c.ratio !== null && c.ratio >= (large ? 3 : 4.5) });
          }
        }
      }
      await ctx.close();
    }
    const phone = sizes.filter((s) => s.width === 390 && s.px !== undefined);
    const desk = sizes.filter((s) => s.width === 1280 && s.px !== undefined);
    res.p7 = { minPhone: Math.min(...phone.map((s) => s.px)), minDesk: Math.min(...desk.map((s) => s.px)), sizes, pass: phone.length > 0 && phone.every((s) => s.px >= 11) && !sizes.some((s) => s.error) };
    res.p8 = { worst: contrasts.slice().sort((a, b) => (a.ratio / a.need) - (b.ratio / b.need)).slice(0, 5), failures: contrasts.filter((c) => !c.pass), runs: contrasts.length, all: contrasts, pass: contrasts.length > 0 && contrasts.every((c) => c.pass) };
    console.log("7 sizes:", res.p7.pass, "phone min", res.p7.minPhone, "desk min", res.p7.minDesk);
    console.log("8 contrast:", res.p8.pass, "runs", contrasts.length, "worst", JSON.stringify(res.p8.worst.slice(0, 2)));
  }

  // ---------- 6. avatar ----------
  if (want("6")) {
    const out = {};
    for (const [width, theme] of [[1280, "dark"], [1280, "light"], [390, "dark"], [390, "light"]]) {
      const layout = width <= 767 ? "mob" : "desk";
      const f = fileByBase.get(`hero-${layout}-${theme}`);
      const lo = built.layouts[`${layout}-${theme}`];
      const av = lo.rows[1].avatar;
      // Animated: frames at 0.4 s and 3.0 s after load (the eyes do not move before 3.76 s).
      const a = await openGH(nav, { width, theme, dpr: 2 });
      const el = (await a.page.$$(PICS))[heroIndex];
      await el.scrollIntoViewIfNeeded();
      await restart(a.page, heroIndex);
      const early = await shotAt(a.page, el, 0.4);
      const late = await shotAt(a.page, el, 3.0);
      const w = await el.evaluate((i) => i.getBoundingClientRect().width);
      const pos = await el.evaluate((i) => { const b = i.getBoundingClientRect(); return { fx: b.left - Math.floor(b.left), fy: b.top - Math.floor(b.top) }; });
      await a.ctx.close();
      const scale = w / f.viewW;
      const avBox = [av.x * scale * 2, av.y * scale * 2, av.w * scale * 2, av.h * scale * 2];
      // Reduced motion: frames at 0.2 s and 3.0 s.
      const r = await openGH(nav, { width, theme, dpr: 2, reduce: true });
      const rel = (await r.page.$$(PICS))[heroIndex];
      await rel.scrollIntoViewIfNeeded();
      await restart(r.page, heroIndex);
      const rFirst = await shotAt(r.page, rel, 0.2);
      const rLate = await shotAt(r.page, rel, 3.0);
      await r.ctx.close();
      // Original drawing, its markup untouched and colored through the CV's variables, nested at the
      // avatar's place in an image of the hero's size, shown at the same size and sub-pixel offset.
      const raw = fs.readFileSync(path.join(ROOT, "generador/fuentes/avatar-marco.svg"), "utf8");
      const vars = theme === "dark" ? "--avatar-relleno:#ff2020;--avatar-trazo:#0b0b0b;--avatar-linea:#ff2020" : "--avatar-relleno:transparent;--avatar-trazo:#ff2020;--avatar-linea:#ff2020";
      const inner = raw.slice(raw.indexOf('<g id="avatar"'), raw.lastIndexOf("</svg>"));
      const bg = theme === "dark" ? "#0a0a0a" : "#f4efe6";
      const refSvg = path.join(OUT, `ref-avatar-${layout}-${theme}.svg`);
      fs.writeFileSync(refSvg, `<svg xmlns="http://www.w3.org/2000/svg" width="${f.viewW}" height="${f.viewH}" viewBox="${f.viewX} 0 ${f.viewW} ${f.viewH}"><style>svg{${vars}}</style><rect x="${f.viewX}" width="${f.viewW}" height="${f.viewH}" fill="${bg}"/><svg x="${av.x}" y="${av.y}" width="${av.w}" height="${av.h}" viewBox="0 0 1942 1988">${inner}</svg></svg>`);
      const ctx = await nav.newContext({ viewport: { width: Math.ceil(w) + 40, height: Math.ceil(f.viewH * scale) + 40 }, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      const refHtml = path.join(OUT, `ref-avatar-${layout}-${theme}.html`);
      fs.writeFileSync(refHtml, `<!doctype html><style>body{margin:0}img{position:absolute;left:${8 + pos.fx}px;top:${8 + pos.fy}px;width:${w}px}</style><img id="b" src="${fileUrl(refSvg)}">`);
      await page.goto(fileUrl(refHtml));
      await page.waitForFunction(() => document.querySelector("img").complete);
      await page.waitForTimeout(300);
      const ref = await page.locator("#b").screenshot();
      await ctx.close();
      save(`avatar-${layout}-${theme}-0.4s.png`, early.png); save(`avatar-${layout}-${theme}-3.0s.png`, late.png);
      save(`avatar-${layout}-${theme}-reduce-0.2s.png`, rFirst.png); save(`avatar-${layout}-${theme}-original.png`, ref);
      out[`${layout}-${theme}`] = {
        times: { early: early.at, late: late.at, reduceFirst: rFirst.at, reduceLate: rLate.at },
        animationRuns: await compare(lab, early.png, late.png, avBox),
        finalVsOriginal: await compare(lab, late.png, ref, avBox),
        reduceFirstVsOriginal: await compare(lab, rFirst.png, ref, avBox),
        reduceFirstVsLate: await compare(lab, rFirst.png, rLate.png),
      };
    }
    const v = Object.values(out);
    res.p6 = { cases: out, pass: v.every((c) => c.animationRuns.pct > 5 && c.finalVsOriginal.pct < 1 && c.reduceFirstVsOriginal.pct < 1 && c.reduceFirstVsLate.pct === 0) };
    console.log("6 avatar:", res.p6.pass, JSON.stringify(out));
  }

  // ---------- 4. seams ----------
  if (!SKIP_SWEEP && want("4")) {
    const combos = {};
    for (const theme of ["dark", "light"]) for (const dpr of [1, 2]) {
      const { ctx, page } = await openGH(nav, { width: 1400, theme, dpr });
      const fails = [];
      let worst = { gap: 0 };
      for (let w = 1400; w >= 320; w--) {
        await page.setViewportSize({ width: w, height: 1000 });
        await waitImages(page, w <= 767 ? "-mob-" : "-desk-");
        const m = await page.evaluate(({ sel, rows }) => {
          const r = [...document.querySelectorAll(sel)].map((i) => i.getBoundingClientRect());
          let k = 0, maxH = 0, maxV = 0, drops = 0, maxEdge = 0;
          const rowsR = rows.map((n) => r.slice(k, (k += n)));
          const right = rowsR[1][0].right, left = rowsR[1][0].left;
          rowsR.forEach((row, j) => {
            row.forEach((b, i) => { if (i) maxH = Math.max(maxH, Math.abs(b.left - row[i - 1].right)); if (Math.abs(b.top - row[0].top) > 0.5) drops++; });
            maxEdge = Math.max(maxEdge, Math.abs(row[row.length - 1].right - right), Math.abs(row[0].left - left));
            if (j) maxV = Math.max(maxV, Math.abs(Math.min(...row.map((b) => b.top)) - Math.max(...rowsR[j - 1].map((b) => b.bottom))));
          });
          return { maxH, maxV, drops, maxEdge };
        }, { sel: PICS, rows: ROWS });
        const gap = Math.max(m.maxH, m.maxV, m.maxEdge);
        if (gap > worst.gap) worst = { w, ...m, gap };
        if (gap > 0.5 || m.drops) fails.push({ w, ...m });
        if ([320, 390, 767, 768, 1012, 1280].includes(w) && dpr === 2) {
          const box = await headerBox(page);
          save(`seam-${w}-${theme}.png`, await page.screenshot({ fullPage: true, clip: { x: box.x - 4, y: box.y - 4, width: box.width + 8, height: box.height + 8 } }));
        }
      }
      combos[`${theme}-dpr${dpr}`] = { widths: 1081, fails: fails.length, firstFails: fails.slice(0, 5), worst };
      await ctx.close();
    }
    res.p4 = { combos, pass: Object.values(combos).every((c) => !c.fails) };
    console.log("4 seams:", res.p4.pass, JSON.stringify(combos));
  }

  // ---------- 9. links ----------
  if (want("9")) {
    const links = HREFS.map((url) => {
      let code = null;
      try { code = execFileSync("curl", ["-sI", "-o", process.platform === "win32" ? "NUL" : "/dev/null", "-w", "%{http_code}", "--max-time", "30", url], { encoding: "utf8" }).trim(); } catch (e) { code = String(e.status); }
      return { url, code };
    });
    res.p9 = { links, pass: links.every((l) => l.code === "200") };
    console.log("9 links:", res.p9.pass, links.map((l) => `${l.code} ${l.url}`).join(" | "));
  }

  // ---------- 10. sketch and header side by side ----------
  if (fs.existsSync(SKETCH) && fs.existsSync(path.join(OUT, "gh-1280-dark.png"))) {
    const page = await (await nav.newContext({ viewport: { width: 1800, height: 700 } })).newPage();
    const b64 = (p) => fs.readFileSync(p).toString("base64");
    // The sketch PNG is at 2x; its window (with shadow) spans x 98-1798 and y 214-1158.
    await page.setContent(`<!doctype html><style>body{margin:0;background:#0d1117;display:flex;gap:24px;padding:16px;font:14px sans-serif;color:#e6edf3}div{width:860px}.c{width:860px;height:480px;overflow:hidden;position:relative}.c img{position:absolute}</style>
<div>Sketch (boceto 3)<div class="c"><img src="data:image/png;base64,${b64(SKETCH)}" style="width:${1888 / 2 * 860 / 850}px;left:${-98 / 2 * 860 / 850}px;top:${-214 / 2 * 860 / 850}px"></div></div>
<div>Header on github.com, 1280 px, dark<div class="c"><img src="data:image/png;base64,${b64(path.join(OUT, "gh-1280-dark.png"))}" style="width:860px"></div></div>`);
    await page.waitForTimeout(300);
    save("lado-a-lado.png", await page.screenshot({ fullPage: true }));
    res.p10 = { image: "lado-a-lado.png" };
  }

  await nav.close();
  res.summary = Object.fromEntries(["p4", "p5", "p6", "p7", "p8", "p9"].map((k) => [k, res[k] ? res[k].pass : "not run"]));
  fs.writeFileSync(path.join(OUT, "medicion.json"), JSON.stringify(res, null, 1));
  console.log("summary", JSON.stringify(res.summary));
})().catch((e) => { console.error(e); process.exit(1); });
