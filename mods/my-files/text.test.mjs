// node mods/my-files/text.test.mjs
import assert from "node:assert/strict";
import { usesTabs, tabsToSpaces, spacesToTabs, replaceOnLines, replaceAll, snippet, parseCsv, guessSeparator, blameBlocks, ago, findAll, nextMatch, hitSegments } from "./text.js";

// The find view: a line cut at each match, any case; a line without one stays whole.
assert.deepEqual(hitSegments("a foo b FOO", "foo").map((x) => [x.text, x.at, x.hit]), [["a ", 0, false], ["foo", 2, true], [" b ", 5, false], ["FOO", 8, true]]);
assert.deepEqual(hitSegments("none", "foo"), [{ text: "none", at: 0, hit: false }]);
assert.deepEqual(hitSegments("", "foo"), [{ text: "", at: 0, hit: false }]);

// Find: every match (any case, not overlapping), and stepping on from the selection, wrapping.
assert.deepEqual(findAll("Foo foo FOO", "foo"), [0, 4, 8]);
assert.deepEqual(findAll("aaaa", "aa"), [0, 2]);
assert.deepEqual(findAll("abc", ""), []);
assert.equal(nextMatch([0, 4, 8], 0, 3, false), 1);  // on the 1st → the 2nd
assert.equal(nextMatch([0, 4, 8], 8, 11, false), 0); // on the last → wraps to the 1st
assert.equal(nextMatch([0, 4, 8], 4, 7, true), 0);   // back from the 2nd → the 1st
assert.equal(nextMatch([0, 4, 8], 0, 3, true), 2);   // back from the 1st → wraps to the last
assert.equal(nextMatch([], 0, 0, false), -1);

// Blame: one head per run of lines from the same commit, the lines kept in order.
const kinds = blameBlocks([{ hash: "a", line: 1 }, { hash: "a", line: 2 }, { hash: "b", line: 3 }, { hash: "a", line: 4 }])
  .map((r) => (r.head ? `H${r.hash}` : r.line)).join(" ");
assert.equal(kinds, "Ha 1 2 Hb 3 Ha 4");
assert.deepEqual(blameBlocks([]), []);
assert.equal(ago(1000, 1000), "just now");
assert.equal(ago(1000, 1000 + 90), "1 minute ago");
assert.equal(ago(1000, 1000 + 3 * 86400), "3 days ago");
assert.equal(ago(0, 400 * 86400), "1 year ago");

// CSV: quotes hold the separator, line breaks and "" ; CRLF; no row for the last newline.
assert.deepEqual(parseCsv('name,note\r\n"Lee, D","say ""hi""\nthere"\r\nx,\n', ","),
  [["name", "note"], ["Lee, D", 'say "hi"\nthere'], ["x", ""]]);
assert.deepEqual(parseCsv("a;b\n1;2", ";"), [["a", "b"], ["1", "2"]]);
assert.deepEqual(parseCsv("", ","), []);
assert.equal(guessSeparator('"a,b";c;d\n1,2'), ";"); // commas inside quotes don't count
assert.equal(guessSeparator("a\tb\tc"), "\t");
assert.equal(guessSeparator("single"), ",");

// Send to chat: line numbers of the selection, a trailing newline doesn't add a line.
const src = "a\nbb\ncc\ndd\n";
assert.equal(snippet("x/y.js", src, 2, 8), "x/y.js:2-3\n```js\nbb\ncc\n```\n"); // "bb\ncc\n": ends at line 4's start
assert.equal(snippet("y.js", src, 3, 4), "y.js:2\n```js\nb\n```\n");
assert.equal(snippet("Makefile", "```\n", 0, 3), "Makefile:1\n````\n```\n````\n");

// Tabs round-trip, alignment spaces inside a line stay.
const go = "func f() {\n\tif x {\n\t\ty := 1  // a\n\t}\n}\n";
assert.ok(usesTabs(go));
assert.equal(tabsToSpaces(go), "func f() {\n    if x {\n        y := 1  // a\n    }\n}\n");
assert.equal(spacesToTabs(tabsToSpaces(go)), go);
assert.ok(!usesTabs("a\n\tb\n  c\n")); // a space-indented line: no conversion
assert.ok(!usesTabs("x := `\n\t    y`\n")); // tab then 4 spaces would save as 2 tabs: no conversion

// Replace: only the given lines, any case, CRLF kept, `$` taken literally.
const r = replaceOnLines("Foo foo\r\nfoo\r\nfoo\r\n", [1, 3], "FOO", "$1x");
assert.deepEqual(r, { text: "$1x $1x\r\nfoo\r\n$1x\r\n", n: 3 });
assert.equal(replaceOnLines("a.b axb\n", [1], "a.b", "-").text, "- axb\n"); // no regex meaning
assert.equal(replaceOnLines("x\n", [5], "x", "y").n, 0); // a line past the end
assert.deepEqual(replaceAll("Ab ab (ab)", "AB", "$&"), { text: "$& $& ($&)", n: 3 });
console.log("text ok");
