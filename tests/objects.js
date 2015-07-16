var test = require('tap').test;
var jot = require("../jot");
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

// serialization

t.deepEqual(
	jot.opFromJsonableObject(new objs.PUT("0", "1").toJsonableObject()),
	new objs.PUT("0", "1"));
t.deepEqual(
	jot.opFromJsonableObject(new objs.REM("0", "1").toJsonableObject()),
	new objs.REM("0", "1"));
t.deepEqual(
	jot.opFromJsonableObject(new objs.REN("0", "1").toJsonableObject()),
	new objs.REN("0", "1"));
t.deepEqual(
	jot.opFromJsonableObject(new objs.APPLY("0", new values.SET(1, 2)).toJsonableObject()),
	new objs.APPLY("0", new values.SET(1, 2)));

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

t.deepEqual(
	new objs.PUT("key", "value").compose(new values.SET({ key: "value" }, "123")),
	new values.SET({ }, "123"));
t.deepEqual(
	new objs.REM("key", "oldvalue").compose(new values.SET({ }, "123")),
	new values.SET({ key: "oldvalue" }, "123"));
t.deepEqual(
	new objs.REN("key", "newkey").compose(new values.SET({ newkey: "value" }, "123")),
	new values.SET({ key: "value" }, "123"));
t.deepEqual(
	new objs.APPLY("key", new values.MATH('add', 1)).compose(new values.SET({ key: 2 }, "123")),
	new values.SET({ key: 1 }, "123"));

// rebase

t.deepEqual(
	new objs.PUT("key", "value").rebase(
		new objs.PUT("key", "value")),
	new values.NO_OP()
	)
t.notOk(
	new objs.PUT("key", "value1").rebase(
		new objs.PUT("key", "value2")))
t.deepEqual(
	new objs.PUT("key", "value1").rebase(
		new objs.PUT("key", "value2"), true),
	new values.NO_OP())
t.deepEqual(
	new objs.PUT("key", "value2").rebase(
		new objs.PUT("key", "value1"), true),
	new objs.APPLY("key", new values.SET("value1", "value2")))

t.deepEqual(
	new objs.REM("key", "value").rebase(
		new objs.REM("key", "value")),
	new values.NO_OP()
	)
t.deepEqual(
	new objs.REM("key1", "value1").rebase(
		new objs.REM("key2", "value2")),
	new objs.REM("key1", "value1")
	)

t.deepEqual(
	new objs.REM("key", "value").rebase(
		new objs.REN("key", "newkey")),
	new objs.REM("newkey", "value")
	)
t.deepEqual(
	new objs.REM("key1", "value1").rebase(
		new objs.REN("key2", "newkey")),
	new objs.REM("key1", "value1")
	)
t.deepEqual(
	new objs.REN("key", "newkey").rebase(
		new objs.REM("key", "value")),
	new values.NO_OP()
	)
t.deepEqual(
	new objs.REN("key2", "newkey").rebase(
		new objs.REM("key1", "value1")),
	new objs.REN("key2", "newkey")
	)

t.deepEqual(
	new objs.REM("key", "value").rebase(
		new objs.APPLY("key", new values.SET("value", "new_value"))),
	new objs.REM("key", "new_value")
	)
t.deepEqual(
	new objs.APPLY("key", new values.SET("value", "new_value")).rebase(
		new objs.REM("key", "value")),
	new values.NO_OP()
	)

t.deepEqual(
	new objs.REN("key", "newkey").rebase(
		new objs.REN("key", "newkey")),
	new values.NO_OP()
	)
t.notOk(
	new objs.REN("key", "newkey1").rebase(
		new objs.REN("key", "newkey2"))
	)
t.deepEqual(
	new objs.REN("key", "newkey1").rebase(
		new objs.REN("key", "newkey2"), true),
	new values.NO_OP()
	)
t.deepEqual(
	new objs.REN("key", "newkey2").rebase(
		new objs.REN("key", "newkey1"), true),
	new objs.REN("newkey1", "newkey2")
	)
t.notOk(
	new objs.REN("key1", "newkey").rebase(
		new objs.REN("key2", "newkey"))
	)
t.deepEqual(
	new objs.REN("key1", "newkey").rebase(
		new objs.REN("key2", "newkey"), true),
	new values.NO_OP()
	)
t.deepEqual(
	new objs.REN("key2", "newkey").rebase(
		new objs.REN("key1", "newkey"), true),
	new objs.REN("key2", "newkey")
	)

t.deepEqual(
	new objs.REN("key", "newkey").rebase(
		new objs.APPLY("key", new values.SET("value", "new_value"))),
	new objs.REN("key", "newkey")
	)
t.deepEqual(
	new objs.APPLY("key", new values.SET("value", "new_value")).rebase(
		new objs.REN("key", "newkey")),
	new objs.APPLY("newkey", new values.SET("value", "new_value"))
	)

t.deepEqual(
	new objs.APPLY('key', new values.MATH("add", 3)).rebase(
		new objs.APPLY('key', new values.MATH("add", 1))),
	new objs.APPLY('key', new values.MATH("add", 3)));
t.notOk(
	new objs.APPLY('key', new values.SET("x", "y")).rebase(
		new objs.APPLY('key', new values.SET("x", "z"))))
t.deepEqual(
	new objs.APPLY('key', new values.SET("x", "y")).rebase(
		new objs.APPLY('key', new values.SET("x", "z")), true),
	new values.NO_OP()
	)
t.deepEqual(
	new objs.APPLY('key', new values.SET("x", "z")).rebase(
		new objs.APPLY('key', new values.SET("x", "y")), true),
	new objs.APPLY('key', new values.SET("y", "z"))
	)

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
