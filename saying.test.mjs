// Checks the witch board's speech bubble spells (mods/kage-agents/saying.js): node saying.test.mjs (prints "ok").
import assert from "node:assert";
import { saying } from "./mods/kage-agents/saying.js";

assert.equal(saying("● Read(main.js)"), "Perspicio!", "reading");
assert.equal(saying("● Update(main.js)"), "Transmuto!", "changing a file");
assert.equal(saying("● Bash(npm test)"), "Ignis!", "running a command");
assert.equal(saying("● Running 1 shell command…"), "Ignis!", "running, described");
assert.equal(saying("● Searched for 3 patterns"), "Inquiro!", "searching");
assert.equal(saying("● Agent(explore the repo)"), "Veni, familiaris!", "a helper agent");
for (const w of ["Edited", "Updated", "Creating", "Fixed", "Wrote", "Made"]) assert.equal(saying(`● ${w} the file`), "Transmuto!", `past and -ing forms: ${w}`);
assert.equal(saying("● Ran the tests"), "Ignis!", "ran");
assert.notEqual(saying("● Address the bug"), "Transmuto!", "whole words: Address is not add");
assert.notEqual(saying("● Testament"), "Ignis!", "whole words: Testament is not test");
const words = saying("● Yeah, it was too long 555.");
assert.ok(words.endsWith("!") && words === saying("● Yeah, it was too long 555."), "own words: a spell, the same each time");
assert.equal(saying("x\n● Old words\n  ● Read(a)\n✻ Cooked"), "Perspicio!", "the newest ● line");
assert.equal(saying("● Old answer\n\n❯ new question\n\n✻ Thinking…"), null, "nothing from the turn before");
assert.equal(saying("● Read(old)\n❯ q\n● Bash(x)\n───\n❯ \n───"), "Ignis!", "the input box's ❯ is not a sent prompt");
assert.equal(saying("nothing here"), null, "no ● line");
console.log("ok");
