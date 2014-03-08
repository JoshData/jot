var assert = require('assert')
var values = require("../jot/values.js");
var seqs = require("../jot/sequences.js");
var objs = require("../jot/objects.js");
var meta = require("../jot/meta.js");

// apply

assert.deepEqual(
	objs.apply(objs.PUT("a", "b"), {}),
	{ "a": "b" });
assert.deepEqual(
	objs.apply(objs.DEL("a", "b"), {"a": "b"}),
	{});
assert.deepEqual(
	objs.apply(objs.APPLY(
		"a",
		values.REP("b", "c")
		), {"a": "b"}),
	{ "a": "c" });
assert.deepEqual(
	objs.apply(objs.APPLY(
		"a",
		seqs.SPLICE(0, "b", "Hello")
		), {"a": "b"}),
	{ "a": "Hello" });
assert.deepEqual(
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

// ...

// meta

assert.deepEqual(
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

