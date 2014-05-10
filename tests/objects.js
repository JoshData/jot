var test = require('tap').test;
var values = require("../jot/values.js");
var seqs = require("../jot/sequences.js");
var objs = require("../jot/objects.js");
var meta = require("../jot/meta.js");

// apply

test('objects', function(t) {
t.deepEqual(
	objs.apply(objs.PUT("a", "b"), {}),
	{ "a": "b" });
t.deepEqual(
	objs.apply(objs.REM("a", "b"), {"a": "b"}),
	{});
t.deepEqual(
	objs.apply(objs.APPLY(
		"a",
		values.SET("b", "c")
		), {"a": "b"}),
	{ "a": "c" });
t.deepEqual(
	objs.apply(objs.APPLY(
		"a",
		seqs.SPLICE(0, "b", "Hello")
		), {"a": "b"}),
	{ "a": "Hello" });
t.deepEqual(
	objs.apply(objs.APPLY(
		"a",
		seqs.APPLY(
			1,
			values.MAP("add", 1)
			)
		), {"a": [0, 0]}),
	{ "a": [0, 1] });

// invert

// ...

// compose

// ...

// rebase

t.deepEqual(
	objs.rebase(
		objs.APPLY("a", values.MAP("add", 1)),
		objs.APPLY("a", values.MAP("add", 2))
		),
	objs.APPLY("a", values.MAP("add", 2))
	);
t.deepEqual(
	objs.rebase(
		objs.APPLY("a", values.SET(0, 1)),
		objs.APPLY("a", values.SET(0, 2))
		),
	null
	);
t.deepEqual(
	objs.rebase(
		objs.APPLY("a", values.SET(0, 1)),
		objs.APPLY("b", values.SET(0, 2))
		),
	objs.APPLY("b", values.SET(0, 2))
	);


// meta

t.deepEqual(
	objs.apply(
		objs.APPLY(
			"a",
			meta.COMPOSITION([
				seqs.APPLY(
					1,
					values.MAP("add", 1)
					),
				seqs.APPLY(
					2,
					values.MAP("add", -1)
					)
			])
		),
		{"a": [0, 0, 0]}),
	{ "a": [0, 1, -1] });

    t.end();
});
