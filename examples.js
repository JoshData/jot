/* load libraries */
var jot = require("./jot");
function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

/* The Base Document */

var doc = {
	key1: "Hello World!",
	key2: 10,
};

console.log("Original Document")
console.log(doc); // { key1: 'Hello World!', key2: 10 }
console.log("")

/* User 1 Makes Changes To The Keys */

var user1 = [
	jot.REN("key1", "title"),
	jot.REN("key2", "count")
];

console.log("User 1")
console.log(jot.apply_array(user1, clone(doc))); // { title: 'Hello World!', count: 10 }
console.log("")

/* User 2 Makes Changes To The Values */

var user2 = [
	jot.OBJECT_APPLY("key1", jot.SET("Hello World!", "My Program")), // must provide the before and after values
	jot.OBJECT_APPLY("key2", jot.MAP('add', 10))
];

console.log("User 2")
console.log(jot.apply_array(user2, clone(doc))); // { key1: 'My Program', key2: 20 }
console.log("")

/* Can't Do This */

// jot.apply_array(user1.concat(user2), doc);

/* Serialize the Two Changes */

user2_rebased = jot.rebase_array(user1, user2);

console.log("Merged")
console.log(jot.apply_array(user1.concat(user2_rebased), clone(doc))); // { title: 'My Program', count: 20 }
console.log("")


