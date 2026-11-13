// Colors of the CV (public/cv/css/cv-base.css): dark theme tokens and the light theme overrides.
export const THEMES = {
  dark: {
    name: "dark",
    bg: "#0a0a0a", bg2: "#121211", bg3: "#1a1a18", bg4: "#242421",
    fg: "#f3f1ea", fg2: "#cfcdc4", muted: "#8d8d85",
    ink: "243,241,234", shade: "#000000",
    red: "#ff2020", redInk: "#ff2020", onRed: "#0a0a0a",
    bevelHi: "rgba(243,241,234,.12)", bevelLo: "rgba(0,0,0,.7)",
    avatar: { fill: "#ff2020", stroke: "#0b0b0b", line: "#ff2020" },
  },
  light: {
    name: "light",
    bg: "#f4efe6", bg2: "#fffdf8", bg3: "#e9e2d4", bg4: "#ddd5c4",
    fg: "#141412", fg2: "#34332e", muted: "#5d5a51",
    ink: "20,20,18", shade: "#cfc7b5",
    // Red for text is darker in the light theme so it passes AA; red fills stay #ff2020.
    red: "#ff2020", redInk: "#c00000", onRed: "#0a0a0a",
    bevelHi: "rgba(255,255,255,.9)", bevelLo: "rgba(20,20,18,.25)",
    avatar: { fill: "none", stroke: "#ff2020", line: "#ff2020" },
  },
};
