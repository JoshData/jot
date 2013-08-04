JSON Operational Transform Module (JOT)
=======================================

This module implements operational transform on a JSON data model, in JavaScript.

Basically this is the core of real time simultaneous editing, like Etherpad, 
but for structured data rather than just plain text.

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

How do you merge changes? In operational transform, changes are represented
structurally:

	A = [("rename" : "key1" => "title"), ("rename" : "key2" => "count")]
	B = [("set" : "key1" => "My Program"), ("set" : "key2" => 20)]
	
If you were to apply these changes in sequence, you would have a problem.
By the time you get to B's changes, the keys "key1" and "key2" are no
longer there! You'll get a KeyError (or equivalent in your language).

What you need is git's "rebase" function that revises B given the simultaneous
edits in A. Here's what you get after rebasing B against A:

	B = [("set" : "title" => "My Program"), ("set" : "count" => 20)]

Now you can apply A and B sequentially.

Installation
------------

The code is written for the Node platform.

Dependencies:

npm install deep-equal


Document Model
--------------

JOT's document model is JSON. Unlike most collaborative editing models where
the document is simply a string, JOT models editing on any data that can be
structured as JSON (which of course is everything).

You give JOT a sequence of operations, which are one of:

* REP: Replace one value with another (typically array elements or property values).
* MAP: Increment a numeric value by a value, multiply a numeric value by a value, or XOR a boolean value by another boolean value.
* SLICE (strings): Insert delete, or replace consecutive characters in the string.
* SLICE (arrays): Insert, delete, or replace consecutive elements of an array.
* MOVE: Move consecutive elements of an array from one index to another.
* PROP: Create, delete, or rename a property on an object or alter a property's value.

Some of the operations have helpful aliases for common edge cases:

* INS (insert text or array elements; part of SLICE)
* DEL (delete text or array elements; part of SLICE)
* PUT (add a new property; part of PROP)
* DEL (remove a property; part of PROP)
* REN (rename a property; part of PROP)

There's also

* NO_OP: An operation that does nothing.
* APPLY: Apply an operation to an array element or to an object property value.

As you might be able to see, the JOT model is a superset of the model you need
for basic plain text concurrent editing. That is, it encapsulates the entire
text editing model within the string SLICE operation, plus it gives you four more
operations to work with structured data.

Operations
----------

What makes this useful is that each operation knows how to "rebase" itself against
every other operation. This is the "transform" part of operational transform, and
it's what you do when you have two concurrent edits. For instance:

* When REN is used to rename a property and REP is used to change its value, the
  REP operation is revised to find the property by its new name.
* When SLICE or REP is used concurrently and two different values are set, a conflict
  is flagged. One of the two values must be chosen by the caller and the other
  discarded.
* When MAP is used by two concurrent users each to increment a value by one, the two
  operations can be combined so the value is incremented by two.
* When text is edited, insertions using SLICE at different locations in the text can be
  combined (like a typical merge or patch).
  
Example
-------

Here's example code that follows the example in the introduction:
	
	var values = require("./ot/values.js");
	var sequences = require("./ot/sequences.js");
	var objects = require("./ot/objects.js");
	
	var doc = {
		key1: "Hello World!",
		key2: 10,
	};
	
	// create an operation that renames the
	// "key1" property to "title" but preserves
	// the value "Hello World!".
	var rename_key = objects.REN("key1", "title");
	
	// create an operation that applies the REP
	// operation on key1's value, replacing the
	// old string "Hello World!" with the new
	// string "My Program".
	var change_property = objects.access(
		["key1"],
		"values", "REP",
		"Hello World!", "My Program");
	
	// Rebase change_property so that we can compose
	// it with rename_key.
	change_property = objects.atomic_rebase(rename_key, change_property);
	
	// Apply the operations sequentially now to 
	// combine the effects of both simultaneous
	// operations.
	objects.apply(rename_key, doc)
	objects.apply(change_property, doc)
	
	// And show the new value of the document.
	console.log(doc);

To run:

	nodejs example.js
	
The output is:

	{ key2: 10, title: 'My Program' }

Note how the output applies both changes logically, even though the second
change was specified as a change to key1, but that key doesn't exist by
the time the change is applied. It's the atomic_rebase call that takes
care of that.
	
An initial document (doc) is created. Changes are *simultaneously* made to
doc. It's up to you to record those changes. Here, one user renames the key1
property. That rename is encoded by the objects.REN function.

The second user changes the value of the property. To illustrate how to
change values nested deep within objects, we use the objects.access method
which takes a path of keys (and/or array indexes) that target the value
to be changed. The next two arguments are the node package name that defines
the operation and the operation's name. The final arguments are the arguments
to the operation's constructor method. In this case, it is the old value
and the new value.


