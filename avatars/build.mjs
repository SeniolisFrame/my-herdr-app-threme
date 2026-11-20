// Pixel grids (avatars.json) → one crisp 16x16 SVG per avatar (node avatars/build.mjs).
import fs from "node:fs";
import path from "node:path";

const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const { palette, avatars } = JSON.parse(fs.readFileSync(path.join(dir, "avatars.json"), "utf8"));
for (const [name, rows] of Object.entries(avatars)) {
  if (rows.length !== 16 || rows.some((r) => r.length !== 16)) throw new Error(`${name}: not 16x16`);
  const rects = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === ".") return;
    if (!palette[ch]) throw new Error(`${name}: no colour for ${ch}`);
    rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${palette[ch]}"/>`);
  }));
  fs.writeFileSync(path.join(dir, `${name}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 16 16" shape-rendering="crispEdges">\n${rects.join("\n")}\n</svg>\n`);
}
console.log(Object.keys(avatars).join(" "));
