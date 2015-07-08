/* load libraries */
var jot = require("./jot");

/* The Base Document */

var doc = {
	key1: "Hello World!",
	key2: 10,
};

console.log("Original Document")
console.log(doc); // { key1: 'Hello World!', key2: 10 }
console.log("")

/* User 1 makes changes to the document's keys so
 * that the document becomes:
 *
 * { title: 'Hello World!', count: 10 }
 *
 */

var user1 = new jot.LIST([
	new jot.REN("key1", "title"),
	new jot.REN("key2", "count")
]);

console.log("User 1")
console.log(user1.apply(doc)); // { title: 'Hello World!', count: 10 }
console.log("")

/* User 2 makes changes to the document's values so
 * that the document becomes:
 *
 * { key1: 'My Program', key2: 20 }
 *
 */

var user2 = new jot.LIST([
	new jot.OBJECT_APPLY("key1", new jot.SET("Hello World!", "My Program")),
	new jot.OBJECT_APPLY("key2", new jot.MATH('add', 10))
]);

console.log("User 2")
console.log(user2.apply(doc)); // { key1: 'My Program', key2: 20 }
console.log("")

/* You can't do this! */

//console.log("The Wrong Way")
//console.log(user1.compose(user2).apply(doc));
//console.log("")

/* You must rebase user2's operations before composing them. */

user2 = user2.rebase(user1);
if (user2 == null) throw "hmm";

console.log("Merged")
console.log(user1.compose(user2).apply(doc)); // { title: 'My Program', count: 20 }
console.log("")

