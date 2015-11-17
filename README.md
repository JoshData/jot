JSON Operational Transformation (JOT)
=====================================

By Joshua Tauberer <http://razor.occams.info>.

August 2013.

License: GPL v3 <http://choosealicense.com/licenses/gpl-v3/>

This module implements operational transformation on a JSON data model,
written in JavaScript for use either in node.js or browsers.

Basically this is the core of real time simultaneous editing, like Etherpad,
but for structured data rather than just plain text. Since everything can
be represented in JSON, this provides a superset of plain text collaboration
functionality.

This library models atomic changes to JSON data structures (operations
over numbers, strings, arrays, and objects) and inverts, composes, and
rebases those operations (transformations). There is no UI or collaboration
framework here.

Introduction
------------

Here's an example of what this is all about. Say you start with:

	{
		"key1": "Hello world!",
		"key2": 10
	}

Then user A makes the following changes:

	{
		"title": "Hello world!",
		"count": 10
	}

and *simultanesouly* user B makes the following changes (to the original):

	{
		"key1": "My Program",
		"key2": 20
	}

How do you merge changes? In operational transformation, changes are represented
structurally:

	A = [("rename" : "key1" => "title"), ("rename" : "key2" => "count")]
	B = [("set" : "key1" => "My Program"), ("set" : "key2" => 20)]

If you were to apply these changes in sequence, you would have a problem.
By the time you get to B's changes, the keys "key1" and "key2" are no
longer there!

What you need is git's "rebase" that revises B given the simultaneous
edits in A. Here's what you get after "rebasing" B against A:

	B = [("set" : "title" => "My Program"), ("set" : "count" => 20)]

Now you *can* apply A and B sequentially.

Installation
------------

The code is written for the node.js platform.

Before running anything, you'll need to install node, and then jot's dependencies:

	# change to this directory
	npm install

To build the library for browsers, do the above, and then run:

	npm install -g browserify
	browserify jot/index.js > jot_browser.js

Then use the library in your HTML page:

	<html>
		<body>
			<script src="jot_browser.js"></script>
			<script>
				// see the example below, but skip the 'require' line
			</script>
		</body>
	</html>

Example
-------

Here's example code that follows the example in the introduction:

	/* load libraries */
	var jot = require("./jot"); // omit this line when in a browser, 'jot' is defined globally

	/* The Base Document */

	var doc = {
		key1: "Hello World!",
		key2: 10,
	};

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

	/* You can't do this! */

	doc = user1.compose(user2).apply(doc);

	/* You must rebase user2's operations before composing them. */

	user2 = user2.rebase(user1);

	doc = user1.compose(user2).apply(doc);

	/* The document now looks like this:
	 *
	 * { title: 'My Program', count: 20 }
	 *
	 */

To run:

	node example.js

Note how the output applies both users' changes logically, even though the
second user's changes specified "key1" and "key2", neither of which exist
by the time the revision is applied. It's the rebase_array call that takes
care of that.

Operations
----------

Unlike most collaborative editing models where operations like insert and
delete apply simply to strings, the document model in JOT is JSON. This
makes JOT useful when tracking changes to data, rather than to text.

The operations in JOT are:

* `INS(index, value)`: Insert text into a string or array elements into an array. When applied to strings, `value` is a string. When applied to arrays, `value` is an array. To insert a single element into an array, wrap it in an array before passing to `INS`.
* `DEL(index, old_value)`: Delete text from a string or removes array elements from an array. When applied to strings, `old_value` is the substring being deleted. When applied to arrays, `old_value` is an array of the items being deleted.
* `PUT(key, value)`: Add a new property to an object. `key` is any valid JSON key (a string) and `value` is any valid JSON object.
* `REM(key, old_value)`: Remove a property from an object. `key` is a string and `old_value` is the value of the property before the property is removed.
* `REN(key, new_name)`: Rename a property of an object. `key` and `new_name` are strings.
* `MOVE(index, count, new_index)`: Move consecutive elements of an array from one index to another.
* `ARRAY_APPLY(index, operation)`: Apply any operation to a particular array element. `operation` is any operation created by these constructors.
* `OBJECT_APPLY(key, operation)`: Apply any operation to a particular property value. `operation` is any operation created by these constructors.
* `SET(old_value, new_value)`: Set a value (an array element, an object property, or an atomic value). `old_value` is the value the document had prior to this operation, and `new_value` is the new value after the operation.
* `MATH(op, value)`: Increment (`op`="add"), multiply (`op`="mult"), increment w/ modulus (`op`="rot"), or exclusive-or (`op`="xor") a number. For `rot`, the value is given as an array of [increment, modulus].
* `MAP(operation)`: Apply any operation to all elements of an array (or all characters in a string). `operation` is any operation created by these constructors.

The JOT model is a superset of the model you need for basic plain text concurrent
editing. That is, it includes the entire text editing model in the INS and DEL
operations plus it adds new operations for non-string data structures.

Note that some operations (DEL, REM, and SET) require passing the value
being modified before the modification took place (i.e. what the value
was before the operation).

(Interally, INS and DEL are subcases of "SPLICE".)


Transformations
---------------

What makes JOT useful is that each operation knows how to "rebase" itself against
every other operation. This is the "transformation" part of operational transformation,
and it's what you do when you have two concurrent edits that need to be merged.

Let's say you have two operations A and B which represent simultaneous edits to
a common base document. For instance, A inserts three characters at the start of
the document and B, which was generated on some other machine concurrently, deletes
the character at index 6. Rebasing B against A yields a new operation B' that can be
applied sequentially *after* A but causes the same logical effect as the original B.
In this example, B' is the deletion of the character at index 9.

To get B' from B, call `b.rebase(a)`. Not all operations can be rebased against
all other operations. When the logical intent of both operations cannot be preserved,
such as if there are two edits to the same character in a string, then `rebase`
returns null, signaling a conflict. But see the section Conflictless Rebase below.

Applying two operations in sequence is called composition and is denoted with the
symbol ○. And lets denote B rebased against A as "B / A". So before the rebase we
have two operations A and B. After the rebase we have A and B/A, such that A ○ (B/A)
combines the logical intent of both A and B.

The rebase operation satisfies the constraints that 1) A ○ (B/A) == B ○ (A/B), and
2) C / (A ○ B) == (C / A) / B.

Conflictless Rebase
-------------------

The rebase method takes a second optional argument `conflictless`. When `conflictless`
is true, `rebase` tries harder to avoid returning null. It may return an operation
that while not preseving the logical intent of the operation at least makes a
rebase possible, avoiding hard-to-handle conflict situations. In the case of two
edits to the same character in a string, a conflictless rebase will cause one of
the edits to be squashed in a predictable way.

Real Time Collaboration
-----------------------
  
You could put these pieces together into a real time collaboration server, but that
involves more complicated handling of conflicts and synchronization, which is out
of scope for this project.

Notes
-----

Thanks to @konklone for some inspiration and the first pull request.

The Substance Operator library is very similar to this library. http://interior.substance.io/modules/operator.html

