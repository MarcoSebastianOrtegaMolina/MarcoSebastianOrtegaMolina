// Test double for the network, loaded with `node --import`: replaces fetch with answers taken from a
// JSON map in the RED_FALSA environment variable, so the tests of generador/actualizar.mjs run offline.
//   { "<url>": { "file": "<path>", "type": "<content type>", "status": 200 } }   answer with that file
//   { "<url>": { "size": 5000000, "type": "..." } }                                answer with that many bytes
//   any other url, or "down"                                                      the network is down
import fs from "node:fs";

const answers = JSON.parse(process.env.RED_FALSA || "{}");
globalThis.fetch = async (url) => {
  const a = answers[String(url)];
  if (!a || a === "down") throw new TypeError("fetch failed", { cause: Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }) });
  const body = a.file ? fs.readFileSync(a.file) : new Uint8Array(a.size).fill(32);
  return new Response(body, { status: a.status || 200, headers: { "content-type": a.type } });
};
