// node mods/my-changes/patch.test.mjs
import assert from "node:assert/strict";
import { oneHunk, someLines, splitDiff, toCrlf } from "./patch.js";

const diff = [
  "diff --git a/f b/f\n", "--- a/f\n", "+++ b/f\n",
  "@@ -1,3 +1,3 @@\n", " a\n", "-b\n", "+B\n", " c\n",
  "@@ -9,2 +9,3 @@\n", " x\r\n", "+y\r\n", " z\r\n",
].join("");

assert.equal(oneHunk(diff, 1), "diff --git a/f b/f\n--- a/f\n+++ b/f\n@@ -9,2 +9,3 @@\n x\r\n+y\r\n z\r\n");
assert.equal(oneHunk(diff, 2), "");

const head = "diff --git a/f b/f\n--- a/f\n+++ b/f\n@@ -1,3 +1,3 @@\n";
// Stage only the "+B" (line 2): the unchosen "-b" stays as context.
assert.equal(someLines(diff, 0, new Set([2]), false), head + " a\n b\n+B\n c\n");
// Stage only the "-b" (line 1): the unchosen "+B" is dropped.
assert.equal(someLines(diff, 0, new Set([1]), false), head + " a\n-b\n c\n");
// Unstage only "+B" from an index diff: the unchosen "-b" is dropped, so -R takes out B only.
assert.equal(someLines(diff, 0, new Set([2]), true), head + " a\n+B\n c\n");
// "\ No newline" goes with its line, and away with a dropped one.
const nl = "@@ -1 +1 @@\n-old\n\\ No newline at end of file\n+new\n\\ No newline at end of file\n";
assert.equal(someLines(nl, 0, new Set([1]), false), "@@ -1 +1 @@\n old\n\\ No newline at end of file\n+new\n\\ No newline at end of file\n");
assert.equal(someLines(nl, 0, new Set([0]), false), "@@ -1 +1 @@\n-old\n\\ No newline at end of file\n");
// A whole diff splits into the per-file text; a path with " b/" in it and a quoted one.
const two = "diff --git a/x b/y b/x b/y\n@@ -1 +1 @@\n-1\n+2\n" + diff +
  "diff --git \"a/\\303\\251\" \"b/\\303\\251\"\n@@ -1 +1 @@\n-a\n+b\n";
const parts = splitDiff(two);
assert.deepEqual([...parts.keys()], ["x b/y", "f"]);
assert.equal(parts.get("f"), diff);
assert.equal(splitDiff("").size, 0);
// CRLF: body lines only, a line that has its "\r" already keeps one.
assert.equal(toCrlf("--- a/f\n+++ b/f\n@@ -1 +1 @@\n-a\n+b\r\n c\n"), "--- a/f\n+++ b/f\n@@ -1 +1 @@\n-a\r\n+b\r\n c\r\n");
console.log("patch ok");
