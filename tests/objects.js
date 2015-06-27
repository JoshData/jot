var test = require('tap').test;
var values = require("../jot/values.js");
var seqs = require("../jot/sequences.js");
var objs = require("../jot/objects.js");
var meta = require("../jot/meta.js");

// apply

test('objects', function(t) {
t.deepEqual(
	new objs.PUT("a", "b")
		.apply({}),
	{ "a": "b" });
t.deepEqual(
	new objs.REM("a", "b")
		.apply({"a": "b"}),
	{});
t.deepEqual(
	new objs.APPLY(
		"a",
		new values.SET("b", "c"))
		.apply({"a": "b"}),
	{ "a": "c" });
t.deepEqual(
	new objs.APPLY(
		"a",
		new seqs.SPLICE(0, "b", "Hello"))
		.apply({"a": "b"}),
	{ "a": "Hello" });
t.deepEqual(
	new objs.APPLY(
		"a",
		new seqs.APPLY(
			1,
			new values.MAP("add", 1)
			))
		.apply({"a": [0, 0]}),
	{ "a": [0, 1] });

// invert

// ...

// compose

// ...

// rebase

t.deepEqual(
	new objs.APPLY("a", new values.MAP("add", 2)).rebase(
		new objs.APPLY("a", new values.MAP("add", 1))),
	new objs.APPLY("a", new values.MAP("add", 2))
	);
t.deepEqual(
	new objs.APPLY("a", new values.SET(0, 1)).rebase(
		new objs.APPLY("a", new values.SET(0, 2))),
	null
	);
t.deepEqual(
	new objs.APPLY("a", new values.SET(0, 2)).rebase(
		new objs.APPLY("b", new values.SET(0, 1))),
	new objs.APPLY("a", new values.SET(0, 2))
	);


// meta

t.deepEqual(
	new objs.APPLY(
		"a",
		new meta.LIST([
			new seqs.APPLY(
				1,
				new values.MAP("add", 1)
				),
			new seqs.APPLY(
				2,
				new values.MAP("add", -1)
				)
		])
	).apply({"a": [0, 0, 0]}),
	{ "a": [0, 1, -1] });

    t.end();
});
