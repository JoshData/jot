var test = require('tap').test;
var jot = require("../jot");
var values = require("../jot/values.js");
var seqs = require("../jot/sequences.js");
var objs = require("../jot/objects.js");
var lists = require("../jot/lists.js");

test('objects', function(t) {

// inspect

t.equal(
	new objs.PUT("0", "1").inspect(),
	'<objects.APPLY "0":<values.SET "1">>');
t.equal(
	new objs.REM("0", "1").inspect(),
	'<objects.APPLY "0":<values.SET ~>>');
t.equal(
	new objs.REN("0", "1").inspect(),
	'<objects.REN {"1":"0"}>');
t.equal(
	new objs.APPLY("0", new values.SET(2)).inspect(),
	'<objects.APPLY "0":<values.SET 2>>');

// serialization

t.deepEqual(
	jot.opFromJSON(new objs.PUT("0", "1").toJSON()),
	new objs.PUT("0", "1"));
t.deepEqual(
	jot.opFromJSON(new objs.REM("0", "1").toJSON()),
	new objs.REM("0", "1"));
t.deepEqual(
	jot.opFromJSON(new objs.REN("0", "1").toJSON()),
	new objs.REN("0", "1"));
t.deepEqual(
	jot.opFromJSON(new objs.APPLY("0", new values.SET(2)).toJSON()),
	new objs.APPLY("0", new values.SET(2)));

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
		new values.SET("c"))
		.apply({"a": "b"}),
	{ "a": "c" });
t.deepEqual(
	new objs.APPLY(
		"a",
		new seqs.SPLICE(0, 1, "Hello"))
		.apply({"a": "b"}),
	{ "a": "Hello" });
t.deepEqual(
	new objs.APPLY(
		"a",
		new seqs.ATINDEX(
			1,
			new values.MATH("add", 1)
			))
		.apply({"a": [0, 0]}),
	{ "a": [0, 1] });

// drilldown

t.deepEqual(
	new objs.PUT("key", "value").drilldown("other"),
	new values.NO_OP());
t.deepEqual(
	new objs.PUT("key", "value").drilldown("key"),
	new values.SET("value"));

// invert

// ...

// compose

t.deepEqual(
	new objs.PUT("key", "value").compose(new values.SET("123")),
	new values.SET("123"));
t.deepEqual(
	new objs.REM("key", "oldvalue").compose(new values.SET("123")),
	new values.SET("123"));
t.deepEqual(
	new objs.REN("key", "newkey").compose(new values.SET("123")),
	new values.SET("123"));
t.deepEqual(
	new objs.REN("key", "newkey").compose(new objs.REN("newkey", "lastkey")),
	new objs.REN("key", "lastkey"));
t.deepEqual(
	new objs.REN("key", "newkey").compose(new objs.REN("other", "newother")),
	new objs.REN({ "newkey": "key", "newother": "other" }));
t.deepEqual(
	new objs.APPLY("key", new values.MATH('add', 1)).compose(new values.SET("123")),
	new values.SET("123"));
t.deepEqual(
	new objs.APPLY("key", new values.MATH('add', 1)).compose(new objs.APPLY("key", new values.MATH('add', 1))),
	new objs.APPLY("key", new values.MATH('add', 2)));
t.deepEqual(
	new objs.APPLY("key", new values.MATH('add', 1)).compose(new objs.APPLY("key", new values.MATH('add', -1))),
	new values.NO_OP());
t.deepEqual(
	new objs.APPLY("key", new values.MATH('add', 1)).compose(new objs.APPLY("key", new values.MATH('mult', 1))),
	new objs.APPLY("key", new values.MATH('add', 1)));
t.deepEqual(
	new objs.APPLY("key1", new values.MATH('add', 1)).compose(new objs.APPLY("key2", new values.MATH('mult', 2))),
	new objs.APPLY({ "key1": new values.MATH('add', 1), "key2": new values.MATH('mult', 2)}));


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
		new objs.PUT("key", "value2"), {}),
	new values.NO_OP())
t.deepEqual(
	new objs.PUT("key", "value2").rebase(
		new objs.PUT("key", "value1"), {}),
	new objs.APPLY("key", new values.SET("value2")))

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
	new objs.REN("key", "newkey") // it doesn't know key was deleted
	)
t.deepEqual(
	new objs.REN("key2", "newkey").rebase(
		new objs.REM("key1", "value1")),
	new objs.REN("key2", "newkey")
	)

t.deepEqual(
	new objs.REM("key", "old_value").rebase(
		new objs.APPLY("key", new values.SET("new_value")), {}),
	new values.NO_OP()
	)
t.deepEqual(
	new objs.APPLY("key", new values.SET("new_value")).rebase(
		new objs.REM("key", "old_value"), {}),
	new objs.PUT("key", "new_value")
	)

t.deepEqual(
	new objs.REN("key", "newkey").rebase(
		new objs.REN("key2", "newkey2")),
	new objs.REN("key", "newkey")
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
		new objs.REN("key", "newkey2")),
	null
	)
t.deepEqual(
	new objs.REN("key", "newkey2").rebase(
		new objs.REN("key", "newkey1")),
	null
	)
t.notOk(
	new objs.REN("key1", "newkey").rebase(
		new objs.REN("key2", "newkey"))
	)
t.deepEqual(
	new objs.REN("key1", "newkey").rebase(
		new objs.REN("key2", "newkey")),
	null
	)
t.deepEqual(
	new objs.REN("key2", "newkey").rebase(
		new objs.REN("key1", "newkey")),
	null
	)

t.deepEqual(
	new objs.REN("key", "newkey").rebase(
		new objs.APPLY("key", new values.SET("new_value"))),
	new objs.REN("key", "newkey")
	)
t.deepEqual(
	new objs.APPLY("key", new values.SET("new_value")).rebase(
		new objs.REN("key", "newkey")),
	new objs.APPLY("newkey", new values.SET("new_value"))
	)

t.deepEqual(
	new objs.APPLY('key', new values.MATH("add", 3)).rebase(
		new objs.APPLY('key', new values.MATH("add", 1))),
	new objs.APPLY('key', new values.MATH("add", 3)));
t.notOk(
	new objs.APPLY('key', new values.SET("y")).rebase(
		new objs.APPLY('key', new values.SET("z"))))
t.deepEqual(
	new objs.APPLY('key', new values.SET("y")).rebase(
		new objs.APPLY('key', new values.SET("z")), {}),
	new values.NO_OP()
	)
t.deepEqual(
	new objs.APPLY('key', new values.SET("z")).rebase(
		new objs.APPLY('key', new values.SET("y")), {}),
	new objs.APPLY('key', new values.SET("z"))
	)

// lists

t.deepEqual(
	new objs.APPLY(
		"a",
		new lists.LIST([
			new seqs.ATINDEX(
				1,
				new values.MATH("add", 1)
				),
			new seqs.ATINDEX(
				2,
				new values.MATH("add", -1)
				)
		])
	).apply({"a": [0, 0, 0]}),
	{ "a": [0, 1, -1] });

// serialization

function test_serialization(op) {
	t.deepEqual(op.toJSON(), jot.opFromJSON(op.toJSON()).toJSON());
}

test_serialization(new objs.PUT("key", "value"))
test_serialization(new objs.REM("key", "old_value"))

//

    t.end();
});

