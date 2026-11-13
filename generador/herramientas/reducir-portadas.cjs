// Makes the reduced covers that generador/proyectos.mjs embeds in the project windows: for each
// project and layout, a JPEG at the largest width the cover is shown at on GitHub, at 2x
// (coverPixels in proyectos.mjs), made from the CV's original WebP. Run it again only when a cover
// or the card geometry changes; the generator itself never needs a browser.
//   NODE_PATH=<folder with playwright> node generador/herramientas/reducir-portadas.cjs <folder with the originals>
// The folder holds <slug>.webp for every slug; it writes generador/fuentes/proyectos/<slug>-<layout>.jpg.
// How: Chromium decodes the WebP and draws it once at the target size with high-quality smoothing
// (the same resampling the browser uses to show a large image small; halving in steps first left the
// fine detail visibly softer); JPEG quality 0.9.
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "generador/fuentes/proyectos");
const QUALITY = 0.9;

(async () => {
  const dir = process.argv[2];
  if (!dir || !fs.existsSync(dir)) { console.error("usage: node generador/herramientas/reducir-portadas.cjs <folder with <slug>.webp>"); process.exit(2); }
  const { coverPixels } = await import(pathToFileURL(path.join(ROOT, "generador/proyectos.mjs")).href);
  const { LAYOUT_ORDER } = await import(pathToFileURL(path.join(ROOT, "generador/constantes.mjs")).href);
  const slugs = fs.readdirSync(dir).filter((f) => f.endsWith(".webp")).map((f) => f.replace(/\.webp$/, ""));
  fs.mkdirSync(OUT, { recursive: true });
  const nav = await chromium.launch({ headless: true });
  const page = await nav.newPage();
  await page.setContent("<!doctype html><body></body>");
  for (const slug of slugs) {
    const b64 = fs.readFileSync(path.join(dir, slug + ".webp")).toString("base64");
    for (const layout of LAYOUT_ORDER) {
      const target = coverPixels(layout);
      const res = await page.evaluate(async ({ b64, target, q }) => {
        const img = new Image();
        img.src = "data:image/webp;base64," + b64;
        await img.decode();
        const th = Math.round(target * img.naturalHeight / img.naturalWidth);
        const out = document.createElement("canvas"); out.width = target; out.height = th;
        const x = out.getContext("2d"); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high"; x.drawImage(img, 0, 0, target, th);
        return { url: out.toDataURL("image/jpeg", q), w: target, h: th, ow: img.naturalWidth, oh: img.naturalHeight };
      }, { b64, target, q: QUALITY });
      const buf = Buffer.from(res.url.split(",")[1], "base64");
      fs.writeFileSync(path.join(OUT, `${slug}-${layout}.jpg`), buf);
      console.log(`${slug}-${layout}.jpg ${res.w}x${res.h} from ${res.ow}x${res.oh}, ${(buf.length / 1024).toFixed(1)} KB`);
    }
  }
  await nav.close();
})().catch((e) => { console.error(e); process.exit(1); });
