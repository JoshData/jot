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
	
	var ot = require("./ot/base.js");
	var spyobj = require("./ot/spyobject.js");
	
	var doc = {
		key1: "Hello World!",
		key2: 10,
	};
	
	function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
	
	/* User 1 Makes Changes */
	var d1 = new spyobj.SpyObject(clone(doc));
	d1.rename("key1", "title");
	
	// d1: { title: 'Hello World!', key2: 10 }
	
	/* User 2 Makes Changes */
	var d2 = new spyobj.SpyObject(clone(doc));
	d2.set("key1", "My Program");
	
	// d2: { key1: 'My Program', key2: 10 }
	
	/* Merge Changes */
	
	var r1 = d1.pop_history();
	ot.apply_array(r1, doc);
	
	var r2 = d2.pop_history();
	r2 = ot.rebase_array(r1, r2);
	ot.apply_array(r2, doc);
	
	// doc is now:
	// { title: 'My Program', key2: 10 }

To run:

	nodejs example.js
	
Note how the output applies both changes logically, even though the second
change was specified as a change to key1, but that key doesn't exist by
the time the change is applied. It's the atomic_rebase call that takes
care of that.
	
An initial document (doc) is created. Changes are *simultaneously* made to
doc. Here we're using a utility class SpyObject which records the revisions
taken on it. SpoyObject.pop_history() returns the history of revisions made
on the object. We re-apply the first user's revision history to the original
object doc. Then we get the second user's changes, rebase them against the
first user's changes, and apply the rebased operations to the document.


