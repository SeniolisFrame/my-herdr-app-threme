import assert from "node:assert/strict";
import { CLASSES, classFor } from "./classes.js";

const ids = CLASSES.map((c) => c.id);
assert.equal(classFor("a", {}), classFor("a", {}), "stable");
assert.ok(ids.includes(classFor("a", undefined)), "undefined map does not throw");
assert.equal(classFor("a", { a: "rogue" }), "rogue", "a pick wins");
assert.equal(classFor("a", { a: "bat" }), classFor("a", {}), "unknown saved class falls back");
assert.equal(classFor("a", { b: "rogue" }), classFor("a", {}), "other agents' picks don't apply");
assert.ok(new Set(Array.from({ length: 50 }, (_, i) => classFor(`agent-${i}`, {}))).size > 1, "ids spread over classes");
console.log("classes ok");
