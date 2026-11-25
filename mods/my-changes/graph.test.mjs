// node mods/my-changes/graph.test.mjs
import assert from "node:assert/strict";
import { layoutGraph } from "./graph.js";

// M merges F into B; F and B both come from A.
//   M
//   |\
//   B F
//   |/
//   A
const rows = layoutGraph([
  { hash: "M", parents: ["B", "F"] },
  { hash: "B", parents: ["A"] },
  { hash: "F", parents: ["A"] },
  { hash: "A", parents: [] },
]);
const [m, b, f, a] = rows;
assert.deepEqual([m.col, b.col, f.col, a.col], [0, 0, 1, 0]);
assert.deepEqual(m.top, []);
assert.deepEqual(m.bottom.map((e) => e.slice(0, 2)).sort(), [[0, 0], [0, 1]]);
assert.deepEqual(b.top.map((e) => e.slice(0, 2)), [[0, 0], [1, 1]]);
assert.deepEqual(f.bottom.map((e) => e.slice(0, 2)), [[0, 0], [1, 1]]); // B's line passes, F goes on to A
assert.deepEqual(a.top.map((e) => e.slice(0, 2)), [[0, 0], [1, 0]]);  // F's line bends into A
assert.deepEqual(a.bottom, []);
assert.equal(m.width, 2);
assert.notEqual(b.top[1][2], b.top[0][2]); // the two lines have different colors

// Two unrelated branch tips: each gets its own lane and color.
const two = layoutGraph([{ hash: "X", parents: ["Y"] }, { hash: "P", parents: [] }, { hash: "Y", parents: [] }]);
assert.deepEqual(two.map((r) => r.col), [0, 1, 0]);
assert.notEqual(two[0].color, two[1].color);
console.log("graph ok");
