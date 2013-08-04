var ot = require("./ot/base.js");
var spyobj = require("./ot/spyobject.js");

var doc = {
	key1: "Hello World!",
	key2: 10,
};

/* helper */
function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

/* User 1 Makes Changes */

var d1 = new spyobj.SpyObject(clone(doc));
d1.rename("key1", "title");

console.log("User 1")
console.log(d1.doc);
console.log("")

/* User 2 Makes Changes */

var d2 = new spyobj.SpyObject(clone(doc));
d2.set("key1", "My Program");

console.log("User 2")
console.log(d2.doc);
console.log("")

var r1 = d1.pop_history();
var r2 = d2.pop_history();

r2 = ot.rebase_array(r1, r2);

ot.apply_array(r1, doc);
ot.apply_array(r2, doc);

console.log("Merged Edits")
console.log(doc);

