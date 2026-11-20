// Pixel grids (avatars.json) → one crisp square SVG per avatar (node avatars/build.mjs).
import fs from "node:fs";
import path from "node:path";

const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const { palette, avatars } = JSON.parse(fs.readFileSync(path.join(dir, "avatars.json"), "utf8"));
for (const [name, rows] of Object.entries(avatars)) {
  const n = rows.length;
  if (rows.some((r) => r.length !== n)) throw new Error(`${name}: not square`);
  const rects = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === ".") return;
    if (!palette[ch]) throw new Error(`${name}: no colour for ${ch}`);
    rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${palette[ch]}"/>`);
  }));
  fs.writeFileSync(path.join(dir, `${name}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n * 4}" height="${n * 4}" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges">\n${rects.join("\n")}\n</svg>\n`);
}
console.log(Object.keys(avatars).join(" "));
