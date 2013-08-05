var assert = require('assert')
var ot = require("../jot/base.js");
var spy = require("../jot/spyobject.js");

spydoc = new spy.SpyObject();

spydoc.set("key", { });
spydoc.get("key").set("more", []);
spydoc.get("key").get("more").push("my value");

hist = spydoc.pop_history();
doc2 = ot.apply_array(hist, {});

console.log(spydoc.doc);
console.log(hist);
console.log(doc2);
assert.deepEqual(spydoc.doc, doc2);

