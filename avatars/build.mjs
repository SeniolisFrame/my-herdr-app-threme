// Pixel grids (avatars.json) → one crisp square SVG per avatar (node avatars/build.mjs).
import fs from "node:fs";
import path from "node:path";

const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
for (const file of ["witch.json", "dragon.json", "swordsman.json", "rogue.json", "priest.json", "reaper.json"]) {
const { palette, avatars } = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
for (const [name, rows] of Object.entries(avatars)) {
  const n = rows.length, w = rows[0].length;
  if (rows.some((r) => r.length !== w)) throw new Error(`${name}: rows differ in length`);
  const rects = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === ".") return;
    if (!palette[ch]) throw new Error(`${name}: no colour for ${ch}`);
    rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${palette[ch]}"/>`);
  }));
  fs.writeFileSync(path.join(dir, `${name}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 4}" height="${n * 4}" viewBox="0 0 ${w} ${n}" shape-rendering="crispEdges">\n${rects.join("\n")}\n</svg>\n`);
}
console.log(Object.keys(avatars).join(" "));
}
