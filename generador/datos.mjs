// Validation of the data contract (datos/perfil.en.json). The same shape will later be published by
// the CV site, so its content is treated as untrusted: every field is required, unknown fields are
// rejected, texts are plain (no markup, no control characters) and length-capped, and every link
// must point inside https://www.kairomx.tech/.
export const LINK_PREFIX = "https://www.kairomx.tech/";
export const TAB_IDS = ["home", "projects", "stack", "experience", "about", "contact"];
export const BUTTON_IDS = ["projects", "contact", "cv"];

class DataError extends Error {}

function text(v, where, max) {
  if (typeof v !== "string") throw new DataError(`${where}: expected a string`);
  if (!v.trim()) throw new DataError(`${where}: must not be empty`);
  if ([...v].length > max) throw new DataError(`${where}: ${[...v].length} characters, the cap is ${max}`);
  if (/[<>]/.test(v)) throw new DataError(`${where}: markup characters (< or >) are not allowed`);
  if (/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(v)) throw new DataError(`${where}: control characters are not allowed`);
  if (/[؜‎‏‪-‮⁦-⁩]/.test(v)) throw new DataError(`${where}: text direction characters (such as U+202E) are not allowed`);
  if (/[\p{Extended_Pictographic}\p{Regional_Indicator}️‍⃣]/u.test(v)) throw new DataError(`${where}: emoji are not allowed`);
  return v;
}

function link(v, where) {
  if (typeof v !== "string") throw new DataError(`${where}: expected a string`);
  if (!v.startsWith(LINK_PREFIX)) throw new DataError(`${where}: links must start with ${LINK_PREFIX}`);
  if (v.length > 200) throw new DataError(`${where}: the link is longer than 200 characters`);
  if (!/^[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+$/.test(v) || /["'<>\\\s]/.test(v)) throw new DataError(`${where}: the link has characters that are not allowed`);
  return v;
}

function object(v, where, keys) {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new DataError(`${where}: expected an object`);
  for (const k of keys) if (!(k in v)) throw new DataError(`${where}: missing field "${k}"`);
  for (const k of Object.keys(v)) if (!keys.includes(k)) throw new DataError(`${where}: unknown field "${k}"`);
  return v;
}

function list(v, where, count) {
  if (!Array.isArray(v)) throw new DataError(`${where}: expected a list`);
  if (v.length !== count) throw new DataError(`${where}: expected ${count} items, found ${v.length}`);
  return v;
}

// Styled text: a list of {text, strong} parts.
function parts(v, where, maxTotal) {
  if (!Array.isArray(v) || v.length < 1 || v.length > 5) throw new DataError(`${where}: expected 1 to 5 parts`);
  const out = v.map((p, i) => {
    object(p, `${where}[${i}]`, ["text", "strong"]);
    if (typeof p.strong !== "boolean") throw new DataError(`${where}[${i}].strong: expected true or false`);
    return { text: text(p.text, `${where}[${i}].text`, maxTotal), strong: p.strong };
  });
  const total = out.reduce((s, p) => s + [...p.text].length, 0);
  if (total > maxTotal) throw new DataError(`${where}: ${total} characters in total, the cap is ${maxTotal}`);
  return out;
}

export function validate(raw) {
  const d = object(raw, "profile", ["schema", "lang", "cv", "window", "tabs", "hero", "buttons", "status"]);
  if (d.schema !== 1) throw new DataError("profile.schema: expected 1");
  if (d.lang !== "en") throw new DataError('profile.lang: expected "en"');
  const w = object(d.window, "window", ["title", "titleAccent"]);
  const h = object(d.hero, "hero", ["name", "role", "titleLine1", "titleLine2", "pitch", "alt"]);
  const t1 = object(h.titleLine1, "hero.titleLine1", ["lead", "accent"]);
  const t2 = object(h.titleLine2, "hero.titleLine2", ["lead", "accent"]);
  const s = object(d.status, "status", ["parts", "href", "alt"]);
  const out = {
    cv: link(d.cv, "profile.cv"),
    window: { title: text(w.title, "window.title", 24), titleAccent: text(w.titleAccent, "window.titleAccent", 8) },
    tabs: list(d.tabs, "tabs", TAB_IDS.length).map((t, i) => {
      object(t, `tabs[${i}]`, ["id", "label", "href"]);
      if (t.id !== TAB_IDS[i]) throw new DataError(`tabs[${i}].id: expected "${TAB_IDS[i]}"`);
      return { id: t.id, label: text(t.label, `tabs[${i}].label`, 12), href: link(t.href, `tabs[${i}].href`) };
    }),
    hero: {
      name: text(h.name, "hero.name", 40),
      role: text(h.role, "hero.role", 40),
      titleLine1: { lead: text(t1.lead, "hero.titleLine1.lead", 12), accent: text(t1.accent, "hero.titleLine1.accent", 12) },
      titleLine2: { lead: text(t2.lead, "hero.titleLine2.lead", 12), accent: text(t2.accent, "hero.titleLine2.accent", 12) },
      pitch: parts(h.pitch, "hero.pitch", 110),
      alt: text(h.alt, "hero.alt", 200),
    },
    buttons: list(d.buttons, "buttons", BUTTON_IDS.length).map((b, i) => {
      object(b, `buttons[${i}]`, ["id", "label", "href"]);
      if (b.id !== BUTTON_IDS[i]) throw new DataError(`buttons[${i}].id: expected "${BUTTON_IDS[i]}"`);
      return { id: b.id, label: text(b.label, `buttons[${i}].label`, 16), href: link(b.href, `buttons[${i}].href`) };
    }),
    status: { parts: parts(s.parts, "status.parts", 40), href: link(s.href, "status.href"), alt: text(s.alt, "status.alt", 80) },
  };
  return out;
}

export { DataError };
