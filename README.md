JSON Operational Transformation (JOT)
=====================================

By Joshua Tauberer <https://razor.occams.info>.

August 2013.

License: GPL v3 <http://choosealicense.com/licenses/gpl-v3/>

This module implements operational transformation (OT) on a JSON data model,
written in JavaScript for use either in node.js or browsers.

While most collaborative editing models operate on plain text documents with
operations like insert and delete on strings, the document model in JOT is JSON
--- i.e. the value space of null, booleans, numbers, strings, arrays, and
objects (key-value pairs with string keys). JOT includes the basic insert/delete
operations on strings but adds many other operations that make JOT useful
for tracking changes to any sort of data that can be encoded in JSON.

Basically, this is the core of real time simultaneous editing, like Etherpad,
but for structured data rather than just plain text. Since everything can
be represented in JSON, this provides plain text collaboration functionality
and much more.

This is a work in progress. There is no UI or collaboration framework here.

Why JOT?
--------

### Introduction

The core problem addressed by operational transformation libraries like JOT
is merging edits made simultaneously, i.e. asynchronously, by two or more
users, and the handling of potential conflicts that arise when multiple
users edit the same part of the document.

To illustrate the problem, imagine two users open the following JSON document:

	{ "key1": "Hello world!", "key2": 10 }

Each user now has a copy of this document in their local memory. The first user renames the properties from `key1` and `key2` to `title` and `count`
in their copy of the document:

	{ "title": "Hello world!", "count": 10 }

At the same time, the second user changes the values of the properties in their copy of the document from `Hello world!` to `My Program` and from `10` to `20`. Since the second user does not yet have the first user's changes, the resulting document still has the old property names:

	{ "key1": "My Program", "key2": 20 }

### Structured representation of changes

In order to merge these changes, one must have a structured representation of the
changes being applied to the document. In JOT, it is up to the library user to
form structured representations of changes. The changes above are represented in pseudocode as:

	User 1: RENAME key1 TO title; RENAME key2 TO count

	User 2: IN key1 SET TO "My Program"; IN key2 INCREMENT BY 10

Using JOT, these changes are represented by "operation" objects as follows:

	var user1 = new jot.REN({ title: "key1",
	                          count: "key2" })

	var user2 = new jot.APPLY({ "key1": new jot.SET("My Program"),
	                            "key2": new jot.MATH("add", 10)  })

However these changes cannot yet be combined. If they were applied in order,
there would be an error. We could start with the original document:

	{ "key1": "Hello world!", "key2": 10 }

and then apply the first user's change, resulting in:

	{ "title": "Hello world!", "count": 10 }

but when we get to the second user's changes, which say to change the values of `key1` and `key2`, there is a problem --- those properties no longer exist!

The second user's changes must be "transformed" to take into account the changes
to the property names made by the first user before they can be applied. 

### Transformation

JOT provides an algorithm to transform the structured representation of changes so 
that simultaneous changes can be combined sequentially.

Continuing the example, we desire to transform the second user's changes so that
they can be applied in sequence after the first user's changes.

Instead of

	User 2: IN key1 SET TO "My Program"; IN key2 INCREMENT BY 10

we want the second user's changes to look like

	User 2: IN title SET TO "My Program"; IN count INCREMENT BY 10

Note how the property names have changed. These changes now _can_ be applied after the first user's changes because they refer to the updated property names.

JOT provides a `rebase` function on operation objects that can make this
transformation. (The transformation is named after [git's rebase](https://git-scm.com/book/en/v2/Git-Branching-Rebasing).) The `rebase` function transforms the operation and yields a new operation that should be applied instead, taking as an argument the operations executed by another user concurrently that have already applied to the document:

	user2 = user2.rebase(user1)

The object now holds:

	new jot.APPLY({ "title": new jot.SET("My Program"),
	                "count": new jot.MATH("add", 10)  })

Note again how the property names have changed. These changes can now be merged using `compose`:

	var all_changes = user1.compose(user2);

and then applied to the base document:

	var document = { "key1": "Hello world!", "key2": 10 };
	document = all_changes.apply(document)

after which the base document will include both user's changes:

	{ "title": "My Program", "count": 20 }

It would also have been possible to rebase `user1` first and then compose the operations in the other order, for the exact same result.

See [example.js](example.js) for the complete example.

### Compared to other OT libraries

Operational transformation libraries often operate only over strings. JOT has
those operations too. For instance, start with the document:

	Hello world!

Two simultaenous changes might be:

	User 1: REPLACE CHARS 0-4 WITH "Brave new"

	User 2: REPLACE CHARS 11-11 WITH "."

To merge these changes, the second user's changes must be rebased to:

	User 2: REPLACE CHARS 15-15 WITH "."

JOT's rebase algorithm can handle this case too:

	// Construct operations
	var document = "Hello world!";
	var user1 = new jot.SPLICE(0, 5, "Brave new");
	var user2 = new jot.SPLICE(11, 1, ".");

	// Rebase user 2
	user2 = user2.rebase(user1, { document: document })

	// user2 now holds:
	// new jot.SPLICE(15, 1, ".")

	// Merge
	user1.compose(user2).apply(document);
	> 'Brave new world.'

Unlike most collaborative editing models where there are only operations like insert and delete that apply to strings, the document model in JOT is JSON --- i.e. the value space of null, booleans, numbers, strings, arrays, and objects (key-value pairs with string keys). Operations are provided that manipulate all of these data types. This makes JOT useful when tracking changes to data, rather than simply to plain text.


Installation
------------

The code is written for the node.js platform.

Before running anything, you'll need to install node, and then jot's dependencies:

	# change to this directory
	npm install

In a node script, import the library:

	var jot = require("./jot");

To build the library for browsers, run:

	npm install -g browserify
	browserify browser_example/browserfy_root.js -d -o dist/jot.js

Then use the library in your HTML page (see [the example](browser_example/example.html) for details):

	<html>
		<body>
			<script src="jot.js"></script>
			<script>
				// see the example below, but skip the 'require' line
			</script>
		</body>
	</html>


Operations
----------

The operations in JOT are...

### General operations

* `SET(new_value)`: Replaces any value with any other JSON-able value. `new_value` is the new value after the operation applies.
* `LIST([op1, op2, op3, ...])`: Executes a series of operations in order. `op1`, `op2`, `op3`, ... are other JOT operations. Equivalent to `op1.compose(op2).compose(op3)...`.

### Operations on booleans and numbers

* `MATH(op, value)`: Applies an arithmetic or boolean operation to a value. `op` is one of "add", "mult" (multiply), "rot" (increment w/ modulus), "and" (boolean or bitwise and), "or" (boolean or bitwise or), "xor" (boolean or bitwise exclusive-or), "not" (boolean or bitwise negation). For `rot`, `value` is given as an array of `[increment, modulus]`. For `not`, `value` is ignored and should be `null`. `add` and `mult` apply to any number, `rot` applies to integers only, and the boolean/bitwise operations only apply to integers and booleans. Because of rounding, operations on floating-point numbers or with floating-point operands could result in inconsistent state depending on the order of execution of the operations.

### Operations on strings and arrays

The same operation is used for both strings and arrays:

* `SPLICE(index, length, new_value)`: Replaces text in a string or array elements in an array at the given index and length in the original. To delete, `new_value` should be an empty string or zero-length array. To insert, `length` should be zero.
* `APPLY(index, operation)`: Apply any operation to a particular array element at `index`. `operation` is any operation. (Overloaded with APPLY for objects.)
* `MAP(operation)`: Apply any operation to all elements of an array (or all characters in a string). `operation` is any operation created by these constructors.

`SPLICE` is the only operation you need for basic plain text concurrent
editing. JOT includes the entire text editing model in the `SPLICE`
operations plus it adds new operations for non-string data structures!

(Note that interally `SPLICE` and `APPLY` are subcases of an internal PATCH operation that maintains an ordered list of edits to a string or array.)

### Operations on objects

* `PUT(key, value)`: Adds a new property to an object. `key` is any valid JSON key (a string) and `value` is any valid JSON object.
* `REM(key)`: Remove a property from an object.
* `REN(key, new_name)`: Rename a property of an object. `key` and `new_name` are strings. It can also take a mapping from new keys to old keys they are renamed from, as `REN({new_name: key, ...})`, which also allows for the duplication of property values.
* `APPLY(key, operation)`: Apply any operation to a particular property named `key`. `operation` is any operation. The operation can also take a mapping from keys to operations, as `APPLY({key: operation, ...})`. (Overloaded with APPLY for strings and arrays.)

(Note that interally `PUT` and `REM` are subcases of SET that use a special value to signal the absense of an object property.)

All of these operations are accessed as `new jot.OPERATION(arguments)`.

Conflictless Rebase
-------------------

What makes JOT useful is that each operation knows how to "rebase" itself against
every other operation. This is the "transformation" part of operational transformation,
and it's what you do when you have two concurrent edits that need to be merged.

The rebase operation guarantees that any two operations can be combined in any order
and result in the same document. In other words, rebase satisfies the constraints
`A ○ (B/A) == B ○ (A/B)` and `C / (A○B) == (C/A) / B`, where `○` is `compose`
and `/` is rebase.

### Rebase conflicts

In general, not all rebases are possible in a way that preserves the logical intent
of each change. This is what results in a merge conflict in source code control
software like git. The conflict indicates where two operations could not be merged
without losing the logical intent of the changes and intervention by a human is
necessary. `rebase` will return `null` in these cases.

For example, two `MATH` operations with different operators will conflict because
the order that these operations apply is significant:

	> new jot.MATH("add", 1)
	    .rebase( new jot.MATH("mult", 2) )
	null

(10 + 1) * 2 = 22 but (10 * 2) + 1 == 21. `rebase` will return `null` in this case
to signal that human intervention is needed to choose which operation should apply
first.

### Using conflictless rebase

However, JOT provides a way to guarantee that `rebase` will return *some* operation,
so that a merge conflict cannot occur. We call this "conflictless" rebase. The result
of a conflictless rebase comes *close* to preserving the logical intent of the
operations by choosing one operation over the other *or* choosing an order that
the operations will apply in.

To get a conflictless rebase, pass a second options argument to `rebase` with the
`document` option set to the content of the document prior to both operations applying:

	> new jot.MATH("add", 1)
	    .rebase( new jot.MATH("mult", 2),
	             { document: 10 } )
	<values.SET 22>

The rebase returns a valid operation now, in this case telling us that to add 1 *after the multiplication has applied*, we should simply set the
result to 22 instead of adding 1. In other words, the rebase has chosen the order
where multiplication goes second.

Rebasing the other way around yields a consistent operation:

	> new jot.MATH("mult", 2)
	    .rebase( new jot.MATH("add", 1),
	             { document: 10 } )
	<values.MATH mult:2>

In other words, if we're multing by 2 *after the addition has applied*, we should
continue to multiply by 2. That's the same order as rebase chose above.

Notes
-----

Thanks to @konklone for some inspiration and the first pull request.

Similar work: [Apache Wave](http://incubator.apache.org/wave/) (formerly Google Wave), [Substance Operator](https://github.com/substance/operator) (defunct).