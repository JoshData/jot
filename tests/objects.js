var test = require('tap').test;
var values = require("../jot/values.js");
var seqs = require("../jot/sequences.js");
var objs = require("../jot/objects.js");
var meta = require("../jot/meta.js");

test('objects', function(t) {

// inspect

t.equal(
	new objs.PUT("0", "1").inspect(),
	'<objects.PUT {key:"0", value:"1"}>');
t.equal(
	new objs.REM("0", "1").inspect(),
	'<objects.REM {key:"0", old_value:"1"}>');
t.equal(
	new objs.REN("0", "1").inspect(),
	'<objects.REN {old_key:"0", new_key:"1"}>');
t.equal(
	new objs.APPLY("0", new values.SET(1, 2)).inspect(),
	'<objects.APPLY {key:"0", op:<values.SET {old_value:1, new_value:2}>}>');

// apply

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
			new values.MATH("add", 1)
			))
		.apply({"a": [0, 0]}),
	{ "a": [0, 1] });

// invert

// ...

// compose

// ...

// rebase

t.deepEqual(
	new objs.APPLY("a", new values.MATH("add", 2)).rebase(
		new objs.APPLY("a", new values.MATH("add", 1))),
	new objs.APPLY("a", new values.MATH("add", 2))
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
				new values.MATH("add", 1)
				),
			new seqs.APPLY(
				2,
				new values.MATH("add", -1)
				)
		])
	).apply({"a": [0, 0, 0]}),
	{ "a": [0, 1, -1] });

    t.end();
});
