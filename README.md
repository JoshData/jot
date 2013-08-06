JSON Operational Transform (JOT)
================================

This module implements operational transform on a JSON data model, in
JavaScript for node.js and browsers.

Basically this is the core of real time simultaneous editing, like Etherpad,
but for structured data rather than just plain text. Since everything can
be represented in JSON, this provides a superset of plain text collaboration
functionality.

This library:

* Models atomic data changes to JSON data structures (operations).
* Inverts, composes, and rebases operations (transforms).
* Manages real-time collaborations between two or more users.
* Provides example client/server code and a working example.

There's no UI here, except in the example.

(Note that I haven't yet decided whether this is open source.)

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
longer there!

What you need is git's "rebase" function that revises B given the simultaneous
edits in A. Here's what you get after rebasing B against A:

	B = [("set" : "title" => "My Program"), ("set" : "count" => 20)]

Now you can apply A and B sequentially.

Installation
------------

The code is written for the node.js platform, and it can also be built
for use in browsers.

Before running anything, you'll need to install the dependencies:

	npm install

To build the library for browsers, use:

	nodejs build_browser_lib.js > jot.js

Example
-------

Here's example code that follows the example in the introduction:

	/* helpers and libraries */
	function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
	var ot = require("./jot/base.js");
	var spyobj = require("./jot/spyobject.js");

	/* here's the initial document */
	var doc = {
		key1: "Hello World!",
		key2: 10,
	};

	/* User 1 Makes Changes */
	var d1 = new spyobj.SpyObject(clone(doc));
	d1.rename("key1", "title");
	d1.rename("key2", "count");

	// d1 is now { title: 'Hello World!', count: 10 }

	/* User 2 Makes Changes */
	var d2 = new spyobj.SpyObject(clone(doc));
	d2.set("key1", "My Program");
	d2.inc("key2", 10); // an atomic increment!

	// d2 is now { key1: 'My Program', key2: 20 }

	/* Merge the Changes */

	var r1 = d1.pop_history();
	ot.apply_array(r1, doc);

	var r2 = d2.pop_history();
	r2 = ot.rebase_array(r1, r2);
	ot.apply_array(r2, doc);

	// doc is now { title: 'My Program', count: 20 }

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

Collaboration
-------------

The next step beyond merging edits through rebase is managing the state
needed to enable real-time simultaneous collaboration between multiple
clients. This involves some complex rebasing as well as handling the
cases of an edit conflict when a rebase isn't possible.

Interactive Example
-------------------

I've packaged an interactive example of multi-user collaborative editing
of a JSON data structure. The front-end is Jos de Jong's excellent
JSONEditor (https://github.com/josdejong/jsoneditor).

To run the interactive example, you'll also need get dependencies:

	json_editor_example/get_json_editor.sh

Then build jot.js, our library suitable for use within the browser:

	nodejs build_browser_lib.js > json_editor_example/jot.js

Start an HTTP server which will serve the static files and also act
as a websockets server to handle the communication between the editors.

	nodejs start.js

Finally, open http://localhost:8080/ in as many browser windows as you
like and start editing.

Document Model
--------------

JOT's document model is JSON. Unlike most collaborative editing models where
the document is simply a string, JOT models editing on any data that can be
structured as JSON (which of course is everything).

You give JOT a sequence of operations, which are one of:

* REP: Replace one value with another (typically array elements or property values).
* MAP: Increment a numeric value by a value, multiply a numeric value by a value, or XOR a boolean value by another boolean value.
* SPLICE (strings): Insert delete, or replace consecutive characters in the string.
* SPLICE (arrays): Insert, delete, or replace consecutive elements of an array.
* MOVE: Move consecutive elements of an array from one index to another.
* PROP: Create, delete, or rename a property on an object or alter a property's value.

Some of the operations have helpful aliases for common edge cases:

* INS (insert text or array elements; part of SPLICE)
* DEL (delete text or array elements; part of SPLICE)
* PUT (add a new property; part of PROP)
* DEL (remove a property; part of PROP)
* REN (rename a property; part of PROP)

There's also

* NO_OP: An operation that does nothing.
* APPLY: Apply an operation to an array element or to an object property value.

As you might be able to see, the JOT model is a superset of the model you need
for basic plain text concurrent editing. That is, it encapsulates the entire
text editing model within the string SPLICE operation, plus it gives you four more
operations to work with structured data.

What makes this useful is that each operation knows how to "rebase" itself against
every other operation. This is the "transform" part of operational transform, and
it's what you do when you have two concurrent edits. For instance:

* When REN is used to rename a property and REP is used to change its value, the
  REP operation is revised to find the property by its new name.
* When MOVE is used twice concurrently to move the same elements to a different
  array location, a conflict is flagged.
* When MAP is used by two concurrent users each to increment a value by one, the two
  operations can be combined so the value is incremented by two.
* When text is edited, insertions using SPLICE at different locations in the text can be
  combined (like a typical merge or patch).

This is all put together in the CollaborationServer class which manages the state
needed to pass operations around between any number of concurrent editors. The library
is also used on the client side to merge incoming remote changes with what has already
been changed locally.

