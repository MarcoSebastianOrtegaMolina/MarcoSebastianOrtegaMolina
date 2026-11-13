// Validation of the data contract (datos/perfil.en.json and datos/perfil.es.json, same shape). The
// same shape will later be published by the CV site, so its content is treated as untrusted: every
// field is required, unknown fields are rejected, texts are plain (no markup, no control or invisible
// characters, no emoji) and length-capped, and every link must point inside https://www.kairomx.tech/.
export const LINK_PREFIX = "https://www.kairomx.tech/";
export const TAB_IDS = ["home", "projects", "stack", "experience", "about", "contact"];
export const BUTTON_IDS = ["projects", "contact", "cv"];
export const LANGS = ["en", "es"];
export const STACK_COUNT = 16; // the strip is drawn for 16 logos (two rows of 8 on narrow layouts)
export const FEATURED_COUNT = 3; // three project windows side by side
// Symbols that are ordinary text even though Unicode lists some of them as pictographs: © ® ™ °.
const TEXT_SYMBOLS = new Set(["©", "®", "™", "°"]);

class DataError extends Error {}

const hex = (ch) => "U+" + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0");

// Rejected: control characters, invisible format characters (U+200B and the like), text direction
// characters, emoji and pictographs (U+2713 included). Accepted: letters with accents, punctuation,
// typographic quotes, the middle dot and the symbols in TEXT_SYMBOLS.
function badChar(v) {
  for (const ch of v) {
    if (/[\p{Cc}\p{Zl}\p{Zp}]/u.test(ch)) return "control characters are not allowed";
    if (/[؜‎‏‪-‮⁦-⁩]/.test(ch)) return `text direction characters (such as U+202E) are not allowed (found ${hex(ch)})`;
    if (/\p{Cf}/u.test(ch)) return `invisible format characters (such as U+200B) are not allowed (found ${hex(ch)})`;
    if (TEXT_SYMBOLS.has(ch)) continue;
    if (/[\p{Extended_Pictographic}\p{Regional_Indicator}\p{So}\u{FE0F}\u{20E3}]/u.test(ch)) return `emoji and pictographs are not allowed (found ${hex(ch)})`;
  }
  return null;
}

function text(v, where, max) {
  if (typeof v !== "string") throw new DataError(`${where}: expected a string`);
  if (!v.trim()) throw new DataError(`${where}: must not be empty`);
  if ([...v].length > max) throw new DataError(`${where}: ${[...v].length} characters, the cap is ${max}`);
  if (/[<>]/.test(v)) throw new DataError(`${where}: markup characters (< or >) are not allowed`);
  const bad = badChar(v);
  if (bad) throw new DataError(`${where}: ${bad}`);
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

function list(v, where, count, max = count) {
  if (!Array.isArray(v)) throw new DataError(`${where}: expected a list`);
  if (v.length < count || v.length > max) throw new DataError(`${where}: expected ${count === max ? count : `${count} to ${max}`} items, found ${v.length}`);
  return v;
}

function id(v, where) {
  if (typeof v !== "string" || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(v)) throw new DataError(`${where}: expected a lowercase id (letters, digits and dashes, up to 40)`);
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
  const d = object(raw, "profile", ["schema", "lang", "cv", "window", "tabs", "hero", "buttons", "status", "stack", "projects"]);
  if (d.schema !== 1) throw new DataError("profile.schema: expected 1");
  if (!LANGS.includes(d.lang)) throw new DataError(`profile.lang: expected one of ${LANGS.map((l) => `"${l}"`).join(", ")}`);
  const w = object(d.window, "window", ["title", "titleAccent"]);
  const h = object(d.hero, "hero", ["name", "role", "titleLine1", "titleLine2", "pitch", "alt"]);
  const t1 = object(h.titleLine1, "hero.titleLine1", ["lead", "accent"]);
  const t2 = object(h.titleLine2, "hero.titleLine2", ["lead", "accent"]);
  const s = object(d.status, "status", ["parts", "href", "alt"]);
  const out = {
    lang: d.lang,
    cv: link(d.cv, "profile.cv"),
    window: { title: text(w.title, "window.title", 24), titleAccent: text(w.titleAccent, "window.titleAccent", 8) },
    tabs: list(d.tabs, "tabs", TAB_IDS.length).map((t, i) => {
      object(t, `tabs[${i}]`, ["id", "label", "href"]);
      if (t.id !== TAB_IDS[i]) throw new DataError(`tabs[${i}].id: expected "${TAB_IDS[i]}"`);
      return { id: t.id, label: text(t.label, `tabs[${i}].label`, 12), href: link(t.href, `tabs[${i}].href`) };
    }),
    hero: {
      name: text(h.name, "hero.name", 40),
      role: text(h.role, "hero.role", 48),
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
  // Tech strip: one link, 16 logos in a fixed order (each id names a file in generador/fuentes/stack).
  const st = object(d.stack, "stack", ["label", "href", "altLead", "items"]);
  const seen = new Set();
  out.stack = {
    label: text(st.label, "stack.label", 12),
    href: link(st.href, "stack.href"),
    altLead: text(st.altLead, "stack.altLead", 24),
    items: list(st.items, "stack.items", STACK_COUNT).map((it, i) => {
      object(it, `stack.items[${i}]`, ["id", "name"]);
      const key = id(it.id, `stack.items[${i}].id`);
      if (seen.has(key)) throw new DataError(`stack.items[${i}].id: "${key}" appears twice`);
      seen.add(key);
      return { id: key, name: text(it.name, `stack.items[${i}].name`, 24) };
    }),
  };
  // Projects: any number, exactly FEATURED_COUNT of them featured (shown in the README, in list order).
  const slugs = new Set();
  out.projects = list(d.projects, "projects", 1, 20).map((p, i) => {
    object(p, `projects[${i}]`, ["slug", "window", "title", "cat", "sub", "href", "featured"]);
    const slug = id(p.slug, `projects[${i}].slug`);
    if (slugs.has(slug)) throw new DataError(`projects[${i}].slug: "${slug}" appears twice`);
    slugs.add(slug);
    if (typeof p.featured !== "boolean") throw new DataError(`projects[${i}].featured: expected true or false`);
    return {
      slug, window: text(p.window, `projects[${i}].window`, 16), title: text(p.title, `projects[${i}].title`, 60),
      cat: text(p.cat, `projects[${i}].cat`, 24), sub: text(p.sub, `projects[${i}].sub`, 80), href: link(p.href, `projects[${i}].href`), featured: p.featured,
    };
  });
  const featured = out.projects.filter((p) => p.featured).length;
  if (featured !== FEATURED_COUNT) throw new DataError(`projects: ${featured} marked as featured; the README shows exactly ${FEATURED_COUNT}`);
  return out;
}

export { DataError };
