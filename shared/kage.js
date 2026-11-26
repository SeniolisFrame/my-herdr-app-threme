// Shared by kage-agents, kage-spaces and kage-tabs. A mod can't import from outside its own folder, so
// install.ps1 copies this file into each (as ./kage.js); edit it here, not there.
import { layout } from "herdr";

// Unifont at its native 16px (ships in mods/kage-spaces/fonts).
export const PIXEL = "Unifont";

// A space's name color: its tile hue (or a stored theme color name) lightened to read on black, at least 5.9:1.
export const NAME = { "#6b4fb3": "#b98cff", "#c4224a": "#ff6b86", "#3d4fb8": "#8fa4ff", "#8a3fa8": "#dd8cff", "#5a4a8a": "#b3a6e0", "#a8325e": "#ff8fb5",
  ansi6: "#b98cff", ansi3: "#ff6b86", ansi4: "#8fa4ff", ansi5: "#dd8cff", ansi2: "#b3a6e0", ansi1: "#ff8fb5" };

// The layout node with that id, or null.
export function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The sidebar's rail goes by its width, not a flag: dragging its edge narrows it too.
export const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

// Drops what an agent puts before its title: a status glyph or spinner and the separator
// after it ("✦  Working", "⠋ - Thinking"), and Codex's blinking "[ ! ] " / "[ . ] " mark.
// Stops at an opening bracket or quote, so a title that starts with one ("[web] login") keeps it.
export const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}\p{Ps}\p{Pi}]+/u, "").replace(/^\[ [!.] \] /, "").trim();

// A card or tab goes by its terminal's folder ("my-herdr-app-threme"); null without one.
export const folder = (cwd) => cwd?.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || null;
