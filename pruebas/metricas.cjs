// Measures the advance width of every character the header may use, for each embedded font face,
// and writes generador/metricas.json (units per 1000 em). The generator lays text out with this
// table so it stays dependency-free. Run again only when a font file changes:
//   node pruebas/metricas.cjs        (needs Playwright reachable through NODE_PATH)
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const RAIZ = path.resolve(__dirname, "..");
const FONTS = path.join(RAIZ, "generador/fuentes/fonts");
const FACES = {
  "sg-500": ["space-grotesk-latin-var.woff2", 500],
  "sg-600": ["space-grotesk-latin-var.woff2", 600],
  "mono-400": ["space-mono-400-latin.woff2", 400],
  "mono-700": ["space-mono-700-latin.woff2", 700],
  "inter-400": ["inter-latin-var.woff2", 400],
  "inter-600": ["inter-latin-var.woff2", 600],
};
let chars = "";
for (let c = 32; c < 127; c++) chars += String.fromCharCode(c);
chars += "áéíóúÁÉÍÓÚñÑüÜ·—–’‘“”…¿¡";

(async () => {
  const nav = await chromium.launch({ headless: true });
  const page = await nav.newPage();
  await page.setContent("<!doctype html><meta charset='utf-8'><body></body>");
  const out = { note: "Advance widths in 1/1000 em, measured with Chromium canvas from the files in generador/fuentes/fonts.", chars, faces: {} };
  for (const [name, [file, weight]] of Object.entries(FACES)) {
    const b64 = fs.readFileSync(path.join(FONTS, file)).toString("base64");
    out.faces[name] = await page.evaluate(async ({ b64, weight, chars, name }) => {
      const fam = "M" + name.replace(/\W/g, "");
      const f = new FontFace(fam, `url(data:font/woff2;base64,${b64})`, { weight: String(weight) });
      await f.load();
      document.fonts.add(f);
      const ctx = document.createElement("canvas").getContext("2d");
      ctx.font = `${weight} 1000px ${fam}`;
      const w = {};
      for (const ch of chars) w[ch] = Math.round(ctx.measureText(ch).width * 10) / 10;
      return w;
    }, { b64, weight, chars, name });
  }
  await nav.close();
  fs.writeFileSync(path.join(RAIZ, "generador/metricas.json"), JSON.stringify(out, null, 1) + "\n");
  console.log("faces:", Object.keys(out.faces).join(", "), "chars:", [...chars].length);
})().catch((e) => { console.error(e); process.exit(1); });
