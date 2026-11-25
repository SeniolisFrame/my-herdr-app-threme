// node shared/size.test.mjs
import assert from "node:assert/strict";
import { pickSize } from "./size.js";

const D = { xs: 11, row: 20 };
assert.equal(pickSize({ xs: 16 }, "xs", D), 16); // set: used
assert.equal(pickSize({ xs: 16 }, "row", D), 20); // missing key: default
assert.equal(pickSize(null, "xs", D), 11); // no file: default
assert.equal(pickSize({ xs: "big" }, "xs", D), 11); // not a number
assert.equal(pickSize({ row: 0 }, "row", D), 20); // zero would draw empty rows
assert.equal(pickSize({ row: -4 }, "row", D), 20);
assert.equal(pickSize({ xs: Infinity }, "xs", D), 11);
console.log("size ok");
