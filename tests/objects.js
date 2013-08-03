var assert = require('assert')
var values = require("../ot/values.js");
var seqs = require("../ot/sequences.js");
var objs = require("../ot/objects.js");

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
		"../ot/values.js",
		values.REP("b", "c")
		), {"a": "b"}),
	{ "a": "c" });
assert.deepEqual(
	objs.apply(objs.APPLY(
		"a",
		"../ot/sequences.js",
		seqs.SLICE(0, "b", "Hello")
		), {"a": "b"}),
	{ "a": "Hello" });
assert.deepEqual(
	objs.apply(objs.APPLY(
		"a",
		"../ot/sequences.js",
		seqs.APPLY(
			1,
			"../ot/values.js",
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

