// Numbers shared by the generator and the tests. Nothing else may repeat them.

// Width of GitHub's README column for a given browser viewport width, measured on the profile
// repository page (signed out) on 2026-11-12: [first viewport, last viewport, column = viewport + offset].
// Past 1280 px the column stays at 838 px.
export const GITHUB_COLUMN = [[320, 543, -66], [544, 767, -98], [768, 1011, -362], [1012, 1280, -442]];
export const GITHUB_COLUMN_MAX = 838;
export function githubColumn(viewport) {
  for (const [a, b, off] of GITHUB_COLUMN) if (viewport >= a && viewport <= b) return viewport + off;
  return viewport > 1280 ? GITHUB_COLUMN_MAX : viewport - 66;
}

// Three compositions of the header. Each one is used up to its last viewport width (inclusive);
// "width" is its design width in units. The phone one is 1 unit = 1 px at 390 px (column 324 px);
// the middle one is 1:1 at its narrowest column (406 px).
export const LAYOUTS = {
  mob: { lastViewport: 471, width: 324 },
  tab: { lastViewport: 1211, width: 406 },
  desk: { lastViewport: Infinity, width: 846 },
};
export const LAYOUT_ORDER = ["mob", "tab", "desk"];
export const layoutFor = (viewport) => LAYOUT_ORDER.find((k) => viewport <= LAYOUTS[k].lastViewport);
export const mediaFor = (layout) => (LAYOUTS[layout].lastViewport === Infinity ? null : `(max-width: ${LAYOUTS[layout].lastViewport}px)`);

// Viewport range the tests sweep, and the smallest on-screen text size allowed in it.
export const SWEEP = { from: 320, to: 1400 };
export const minTextPx = (viewport) => (viewport >= 360 ? 11 : 10);

// The header may not be taller than this many times its width, except on the phone.
export const MAX_HEIGHT_RATIO = 1.6;

// Size caps.
export const MAX_SVG = 600 * 1024; // bytes per image
export const MAX_VISIT = 3 * 1024 * 1024; // bytes one visit loads (one variant of each piece)

// Rows whose images move (they get a still version for reduced motion).
export const ANIMATED_ROWS = ["hero", "status"];
