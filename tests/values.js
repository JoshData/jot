var test = require('tap').test;
var values = require("../jot/values.js");

// apply

test('values', function(t) {
t.equal(
	values.apply(values.NO_OP(), "1"),
	"1");

t.equal(
	values.apply(values.SET("1", "2"), "1"),
	"2");

t.equal(
	values.apply(values.MAP("add", 5), 1),
	6);
t.equal(
	values.apply(values.MAP("rot", [5, 3]), 1),
	0);
t.equal(
	values.apply(values.MAP("mult", 5), 2),
	10);
// t.equal(
// 	values.apply(values.MAP("xor", true), true),
// 	false);
// t.equal(
// 	values.apply(values.MAP("xor", true), false),
// 	true);
// t.equal(
// 	values.apply(values.MAP("xor", false), true),
// 	true);
// t.equal(
// 	values.apply(values.MAP("xor", false), false),
// 	false);

// simplify

t.deepEqual(
	values.simplify(values.NO_OP()),
	values.NO_OP());

t.deepEqual(
	values.simplify(values.SET(0, 1)),
	values.SET(0, 1));
t.deepEqual(
	values.simplify(values.SET(0, 0)),
	values.NO_OP());

t.deepEqual(
	values.simplify(values.MAP("add", 5)),
	values.MAP("add", 5));
t.deepEqual(
	values.simplify(values.MAP("add", 0)),
	values.NO_OP());
t.deepEqual(
	values.simplify(values.MAP("rot", [0, 999])),
	values.NO_OP());
t.deepEqual(
	values.simplify(values.MAP("rot", [5, 3])),
	values.MAP("rot", [2, 3]));
t.deepEqual(
	values.simplify(values.MAP("mult", 0)),
	values.MAP("mult", 0));
t.deepEqual(
	values.simplify(values.MAP("mult", 1)),
	values.NO_OP());
t.deepEqual(
	values.simplify(values.MAP("xor", true)),
	values.MAP("xor", true));
t.deepEqual(
	values.simplify(values.MAP("xor", false)),
	values.NO_OP());

// invert

t.deepEqual(
	values.invert(values.NO_OP()),
	values.NO_OP());

t.deepEqual(
	values.invert(values.SET(0, 1)),
	values.SET(1, 0));

t.deepEqual(
	values.invert(values.MAP("add", 5)),
	values.MAP("add", -5));
t.deepEqual(
	values.invert(values.MAP("rot", [5, 2])),
	values.MAP("rot", [-5, 2]));
t.deepEqual(
	values.invert(values.MAP("mult", 5)),
	values.MAP("mult", 1/5));
t.deepEqual(
	values.invert(values.MAP("xor", true)),
	values.MAP("xor", true));
t.deepEqual(
	values.invert(values.MAP("xor", false)),
	values.MAP("xor", false));

// compose

t.deepEqual(
	values.compose(
		values.NO_OP(),
		values.SET(1, 2) ),
	values.SET(1, 2));
t.deepEqual(
	values.compose(
		values.SET(1, 2),
		values.NO_OP() ),
	values.SET(1, 2));

t.deepEqual(
	values.compose(
		values.SET(0, 1),
		values.SET(1, 2) ),
	values.SET(0, 2));

t.deepEqual(
	values.compose(
		values.MAP("add", 1),
		values.MAP("add", 1) ),
	values.MAP("add", 2));
t.deepEqual(
	values.compose(
		values.MAP("rot", [3, 13]),
		values.MAP("rot", [4, 13]) ),
	values.MAP("rot", [7, 13]));
t.deepEqual(
	values.compose(
		values.MAP("mult", 2),
		values.MAP("mult", 3) ),
	values.MAP("mult", 6));
t.deepEqual(
	values.compose(
		values.MAP("xor", true),
		values.MAP("xor", true) ),
	values.NO_OP());
t.deepEqual(
	values.compose(
		values.MAP("add", 1),
		values.MAP("mult", 2) ),
	null);

// rebase

t.deepEqual(
	values.rebase(
		values.NO_OP(),
		values.MAP("add", 1) ),
	values.MAP("add", 1));
t.deepEqual(
	values.rebase(
		values.MAP("add", 1),
		values.NO_OP() ),
	values.NO_OP());

t.deepEqual(
	values.rebase(
		values.SET(0, 1),
		values.SET(0, 1) ),
	values.NO_OP());
t.deepEqual(
	values.rebase(
		values.SET(0, 1),
		values.SET(0, 2) ),
	null);
t.deepEqual(
	values.rebase(
		values.SET(0, 1, 0),
		values.SET(0, 2, 1) ),
	values.SET(1, 2, 1));
t.deepEqual(
	values.rebase(
		values.SET(0, 2, 1),
		values.SET(0, 1, 0) ),
	values.NO_OP());

t.deepEqual(
	values.rebase(
		values.MAP("add", 1),
		values.MAP("add", 2) ),
	values.MAP("add", 2));
t.deepEqual(
	values.rebase(
		values.MAP("rot", [5, 3]),
		values.MAP("rot", [1, 3]) ),
	values.MAP("rot", [1, 3]));
t.deepEqual(
	values.rebase(
		values.MAP("add", 1),
		values.MAP("mult", 2) ),
	null);


    t.end();
});
