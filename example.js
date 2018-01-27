/* load libraries (test if 'jot' is defined already, so we can use this in the browser where 'require' is not available) */
var jot = jot || require("./jot");

/* The Base Document */

var doc = {
	title: "Hello World!",
	count: 10,
};

console.log("Original Document")
console.log(doc); // { title: 'Hello World!', count: 10 }
console.log("")

/* User 1 revises the title and increments the documents's count.
 *
 * { title: 'It\'s a Small World!', count: 20 }
 *
 */

var user1 = new jot.LIST([
	new jot.APPLY("title", new jot.SPLICE(0, 5, "It's a Small")),
	new jot.APPLY("count", new jot.MATH("add", 10))
]);

console.log("User 1")
console.log(user1.apply(doc)); // { title: 'Hello, User 2!', count: 20 }
console.log("")

/* User 2 makes changes to the original ocument's values so
 * that the document becomes:
 *
 * { title: 'Hello, Small World!', count: 15 }
 *
 */

var user2 = new jot.LIST([
	new jot.APPLY("title", new jot.SPLICE(5, 1, ", Small ")),
	new jot.APPLY("count", new jot.MATH('add', 5))
]);

console.log("User 2")
console.log(user2.apply(doc)); // { key1: 'My Program', key2: 20 }
console.log("")

/* Don't do this! */

console.log("The Wrong Way")
console.log(user1.compose(user2).apply(doc));
console.log("")

/* You must rebase user2's operations before composing them. */

user2 = user2.rebase(user1);
if (user2 == null) throw new Error("hmm");
console.log("Rebased User 2")
console.log(user2);
console.log("")

console.log("Merged")
console.log(user1.compose(user2).apply(doc)); // { title: 'I am, User 2!', count: 25 }
console.log("")

