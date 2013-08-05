/* helper */
function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

/* load libraries */
var ot = require("./jot/base.js");
var spyobj = require("./jot/spyobject.js");

var doc = {
	key1: "Hello World!",
	key2: 10,
};

/* User 1 Makes Changes */

var d1 = new spyobj.SpyObject(clone(doc));
d1.rename("key1", "title");
d1.rename("key2", "count");

console.log("User 1")
console.log(d1.doc); // { title: 'Hello World!', count: 10 }
console.log("")

/* User 2 Makes Changes */

var d2 = new spyobj.SpyObject(clone(doc));
d2.set("key1", "My Program");
d2.inc("key2", 10);

console.log("User 2")
console.log(d2.doc); // { key1: 'My Program', key2: 20 }
console.log("")

var r1 = d1.pop_history();
ot.apply_array(r1, doc);

var r2 = d2.pop_history();
r2 = ot.rebase_array(r1, r2);
ot.apply_array(r2, doc);

console.log("Merged Edits")
console.log(doc); // { title: 'My Program', count: 20 }


