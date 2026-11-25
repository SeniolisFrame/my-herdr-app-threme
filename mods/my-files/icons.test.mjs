// node mods/my-files/icons.test.mjs
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { iconFor, ICONS } from "./icons.js";

const at = (f) => `mods/my-files/icons/${f}.svg`;
assert.equal(iconFor("main.go", false), at("go"));
assert.equal(iconFor("App.TSX", false), at("react_ts"));
assert.equal(iconFor("types.d.ts", false), at("typescript-def"));
assert.equal(iconFor("package.json", false), at("nodejs"));
assert.equal(iconFor(".env.local", false), at("tune"));
assert.equal(iconFor("README.md", false), at("readme"));
assert.equal(iconFor("Makefile", false), at("file"));
assert.equal(iconFor("go", false), at("file")); // no dot: not an extension
assert.equal(iconFor("weird.xyz", false), at("file"));
assert.equal(iconFor("src", true, false), at("folder-src"));
assert.equal(iconFor("src", true, true), at("folder-src-open"));
assert.equal(iconFor("stuff", true, true), at("folder-open"));
for (const i of ICONS) assert.ok(existsSync(new URL(`./icons/${i}.svg`, import.meta.url)), `missing icons/${i}.svg`);
console.log("ok");
