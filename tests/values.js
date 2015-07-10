var test = require('tap').test;
var values = require("../jot/values.js");

test('values', function(t) {

// inspect

t.equal(
	new values.NO_OP().inspect(),
	"<values.NO_OP {}>");
t.equal(
	new values.SET(3, 4).inspect(),
	'<values.SET {old_value:3, new_value:4}>');
t.equal(
	new values.MATH('add', 4).inspect(),
	'<values.MATH {operator:"add", operand:4}>');

// apply

t.equal(
	new values.NO_OP().apply("1"),
	"1");

t.equal(
	new values.SET("1", "2").apply("1"),
	"2");

t.equal(
	new values.MATH("add", 5).apply(1),
	6);
t.equal(
	new values.MATH("rot", [5, 3]).apply(1),
	0);
t.equal(
	new values.MATH("mult", 5).apply(2),
	10);
t.equal(
	new values.MATH("xor", 12).apply(25),
	21);
t.equal(
	new values.MATH("xor", 1).apply(true),
	false);
t.equal(
	new values.MATH("xor", 1).apply(false),
	true);

// simplify

t.deepEqual(
	new values.NO_OP().simplify(),
	new values.NO_OP());

t.deepEqual(
	new values.SET(0, 1).simplify(),
	new values.SET(0, 1));
t.deepEqual(
	new values.SET(0, 0).simplify(),
	new values.NO_OP());

t.deepEqual(
	new values.MATH("add", 5).simplify(),
	new values.MATH("add", 5));
t.deepEqual(
	new values.MATH("add", 0).simplify(),
	new values.NO_OP());
t.deepEqual(
	new values.MATH("rot", [0, 999]).simplify(),
	new values.NO_OP());
t.deepEqual(
	new values.MATH("rot", [5, 3]).simplify(),
	new values.MATH("rot", [2, 3]));
t.deepEqual(
	new values.MATH("mult", 0).simplify(),
	new values.MATH("mult", 0));
t.deepEqual(
	new values.MATH("mult", 1).simplify(),
	new values.NO_OP());
t.deepEqual(
	new values.MATH("xor", 0).simplify(),
	new values.NO_OP());

// invert

t.deepEqual(
	new values.NO_OP().invert(),
	new values.NO_OP());

t.deepEqual(
	new values.SET(0, 1).invert(),
	new values.SET(1, 0));

t.deepEqual(
	new values.MATH("add", 5).invert(),
	new values.MATH("add", -5));
t.deepEqual(
	new values.MATH("rot", [5, 2]).invert(),
	new values.MATH("rot", [-5, 2]));
t.deepEqual(
	new values.MATH("mult", 5).invert(),
	new values.MATH("mult", 1/5));
t.deepEqual(
	new values.MATH("xor", 5).invert(),
	new values.MATH("xor", 5));


// compose

t.deepEqual(
	new values.NO_OP().compose(
		new values.SET(1, 2) ),
	new values.SET(1, 2));
t.deepEqual(
	new values.SET(1, 2).compose(
		new values.NO_OP() ),
	new values.SET(1, 2));

t.deepEqual(
	new values.SET(0, 1).compose(
		new values.SET(1, 2) ),
	new values.SET(0, 2));

t.deepEqual(
	new values.MATH("add", 1).compose(
		new values.MATH("add", 1) ),
	new values.MATH("add", 2));
t.deepEqual(
	new values.MATH("rot", [3, 13]).compose(
		new values.MATH("rot", [4, 13]) ),
	new values.MATH("rot", [7, 13]));
t.deepEqual(
	new values.MATH("mult", 2).compose(
		new values.MATH("mult", 3) ),
	new values.MATH("mult", 6));
t.deepEqual(
	new values.MATH("add", 1).compose(
		new values.MATH("mult", 2) ),
	null);
t.deepEqual(
	new values.MATH("xor", 12).compose(
		new values.MATH("xor", 3) ),
	new values.MATH("xor", 15));

t.deepEqual(
	new values.MATH("add", 1).compose(
		new values.SET(2, 3) ),
	new values.SET(1, 3));

// rebase

t.deepEqual(
	new values.NO_OP().rebase(new values.NO_OP() ),
	new values.NO_OP());
t.deepEqual(
	new values.NO_OP().rebase(new values.MATH("add", 1) ),
	new values.NO_OP());

t.deepEqual(
	new values.SET(0, 1).rebase(new values.SET(0, 1) ),
	new values.NO_OP());
t.deepEqual(
	new values.SET(0, 2).rebase(new values.SET(0, 1) ),
	null);
t.deepEqual(
	new values.SET(0, 2).rebase(new values.SET(0, 1), true),
	new values.SET(1, 2));
t.deepEqual(
	new values.SET(0, 1).rebase(new values.SET(0, 2), true),
	new values.NO_OP());

t.deepEqual(
	new values.SET(0, 2).rebase(new values.MATH("add", 3)),
	new values.SET(3, 5));
t.deepEqual(
	new values.SET(0, "2").rebase(new values.MATH("add", 3)),
	null);
t.deepEqual(
	new values.SET(0, "2").rebase(new values.MATH("add", 3), true),
	new values.SET(3, "2"));

t.deepEqual(
	new values.MATH("add", 1).rebase(new values.NO_OP() ),
	new values.MATH("add", 1));
t.deepEqual(
	new values.MATH("add", 2).rebase(new values.MATH("add", 1) ),
	new values.MATH("add", 2));
t.deepEqual(
	new values.MATH("rot", [1, 3]).rebase(new values.MATH("rot", [5, 3]) ),
	new values.MATH("rot", [1, 3]));
t.notOk(
	new values.MATH("mult", 2).rebase(new values.MATH("add", 1) )
	);
t.deepEqual(
	new values.MATH("xor", 3).rebase(new values.MATH("xor", 12) ),
	new values.MATH("xor", 3));

t.deepEqual(
	new values.MATH("add", 3).rebase(new values.SET(0, 2) ),
	new values.MATH("add", 3));
t.notOk(
	new values.MATH("add", 3).rebase(new values.SET(0, "2"))
	);
t.deepEqual(
	new values.MATH("add", 3).rebase(new values.SET(0, "2"), true),
	new values.NO_OP());


    t.end();
});
