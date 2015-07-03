var test = require('tap').test;
var values = require("../jot/values.js");

// apply

test('values', function(t) {
t.equal(
	new values.NO_OP().apply("1"),
	"1");

t.equal(
	new values.SET("2").apply("1"),
	"2");

t.equal(
	new values.MAP("add", 5).apply(1),
	6);
t.equal(
	new values.MAP("rot", [5, 3]).apply(1),
	0);
t.equal(
	new values.MAP("mult", 5).apply(2),
	10);

// simplify

t.deepEqual(
	new values.NO_OP().simplify(),
	new values.NO_OP());

t.deepEqual(
	new values.SET(1).simplify(),
	new values.SET(1));

t.deepEqual(
	new values.MAP("add", 5).simplify(),
	new values.MAP("add", 5));
t.deepEqual(
	new values.MAP("add", 0).simplify(),
	new values.NO_OP());
t.deepEqual(
	new values.MAP("rot", [0, 999]).simplify(),
	new values.NO_OP());
t.deepEqual(
	new values.MAP("rot", [5, 3]).simplify(),
	new values.MAP("rot", [2, 3]));
t.deepEqual(
	new values.MAP("mult", 0).simplify(),
	new values.MAP("mult", 0));
t.deepEqual(
	new values.MAP("mult", 1).simplify(),
	new values.NO_OP());

// invert

t.deepEqual(
	new values.NO_OP().invert(),
	new values.NO_OP());

/*t.deepEqual(
	new values.SET(1).invert(),
	new values.SET(0));*/

t.deepEqual(
	new values.MAP("add", 5).invert(),
	new values.MAP("add", -5));
t.deepEqual(
	new values.MAP("rot", [5, 2]).invert(),
	new values.MAP("rot", [-5, 2]));
t.deepEqual(
	new values.MAP("mult", 5).invert(),
	new values.MAP("mult", 1/5));


// compose

t.deepEqual(
	new values.NO_OP().compose(
		new values.SET(2) ),
	new values.SET(2));
t.deepEqual(
	new values.SET(2).compose(
		new values.NO_OP() ),
	new values.SET(2));

t.deepEqual(
	new values.SET(1).compose(
		new values.SET(2) ),
	new values.SET(2));

t.deepEqual(
	new values.MAP("add", 1).compose(
		new values.MAP("add", 1) ),
	new values.MAP("add", 2));
t.deepEqual(
	new values.MAP("rot", [3, 13]).compose(
		new values.MAP("rot", [4, 13]) ),
	new values.MAP("rot", [7, 13]));
t.deepEqual(
	new values.MAP("mult", 2).compose(
		new values.MAP("mult", 3) ),
	new values.MAP("mult", 6));
t.deepEqual(
	new values.MAP("add", 1).compose(
		new values.MAP("mult", 2) ),
	null);

// rebase

t.deepEqual(
	new values.MAP("add", 1).rebase(new values.NO_OP() ),
	new values.MAP("add", 1));
t.deepEqual(
	new values.NO_OP().rebase(new values.MAP("add", 1) ),
	new values.NO_OP());

t.deepEqual(
	new values.SET(1).rebase(new values.SET(1) ),
	new values.NO_OP());
t.deepEqual(
	new values.SET(2).rebase(new values.SET(1) ),
	null);
t.deepEqual(
	new values.SET(2, 1).rebase(new values.SET(1, 0) ),
	new values.SET(2, 1));
t.deepEqual(
	new values.SET(1, 0).rebase(new values.SET(2, 1) ),
	new values.NO_OP());

t.deepEqual(
	new values.MAP("add", 2).rebase(new values.MAP("add", 1) ),
	new values.MAP("add", 2));
t.deepEqual(
	new values.MAP("rot", [1, 3]).rebase(new values.MAP("rot", [5, 3]) ),
	new values.MAP("rot", [1, 3]));
t.notOk(
	new values.MAP("mult", 2).rebase(new values.MAP("add", 1) )
	);


    t.end();
});
