var test = require('tap').test;
var jot = require('../jot')
var values = require("../jot/values.js");
var MISSING = require("../jot/objects.js").MISSING;
var LIST = require("../jot/lists.js").LIST;

test('values', function(t) {

// inspect

t.equal(
	new values.NO_OP().inspect(),
	"<NO_OP>");
t.equal(
	new values.SET(4).inspect(),
	'<SET 4>');
t.equal(
	new values.MATH('add', 4).inspect(),
	'<MATH add:4>');

// serialization

t.deepEqual(
	jot.deserialize(new values.NO_OP().serialize()),
	new values.NO_OP());
t.deepEqual(
	jot.opFromJSON(new values.NO_OP().toJSON()),
	new values.NO_OP());
t.deepEqual(
	jot.opFromJSON(new values.SET(4).toJSON()),
	new values.SET(4));
t.deepEqual(
	jot.opFromJSON(new values.MATH('add', 4).toJSON()),
	new values.MATH('add', 4));

// apply

t.equal(
	new values.NO_OP().apply("1"),
	"1");

t.equal(
	new values.SET("2").apply("1"),
	"2");

t.equal(
	new values.MATH("add", 5).apply(1),
	6);
t.equal(
	new values.MATH("rot", [2, 3]).apply(1),
	0);
t.equal(
	new values.MATH("mult", 5).apply(2),
	10);
t.equal(
	new values.MATH("and", 0xF0).apply(0xF1),
	0xF0);
t.equal(
	new values.MATH("or", 0xF0).apply(0x1),
	0xF1);
t.equal(
	new values.MATH("xor", 12).apply(25),
	21);
t.equal(
	new values.MATH("xor", 1).apply(true),
	false);
t.equal(
	new values.MATH("xor", 1).apply(false),
	true);
t.equal(
	new values.MATH("not", null).apply(0xF1),
	~0xF1);

// simplify

t.deepEqual(
	new values.NO_OP().simplify(),
	new values.NO_OP());

t.deepEqual(
	new values.SET(1).simplify(),
	new values.SET(1));

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
	new values.MATH("mult", 0).simplify(),
	new values.MATH("mult", 0));
t.deepEqual(
	new values.MATH("mult", 1).simplify(),
	new values.NO_OP());
t.deepEqual(
	new values.MATH("and", 0).simplify(),
	new values.SET(0));
t.deepEqual(
	new values.MATH("or", 0).simplify(),
	new values.NO_OP());
t.deepEqual(
	new values.MATH("xor", 0).simplify(),
	new values.NO_OP());

// invert

t.deepEqual(
	new values.NO_OP().inverse('anything here'),
	new values.NO_OP());

t.deepEqual(
	new values.SET(1).inverse(0),
	new values.SET(0));

t.deepEqual(
	new values.MATH("add", 5).inverse(0),
	new values.MATH("add", -5));
t.deepEqual(
	new values.MATH("rot", [5, 20]).inverse(0),
	new values.MATH("rot", [-5, 20]));
t.deepEqual(
	new values.MATH("mult", 5).inverse(0),
	new values.MATH("mult", 1/5));
t.deepEqual(
	new values.MATH("and", 0xF0).inverse(0xF),
	new values.MATH("or", 0xF));
t.deepEqual(
	new values.MATH("or", 0xF0).inverse(0xF),
	new values.MATH("xor", 0xF0));
t.deepEqual(
	new values.MATH("xor", 5).inverse(0),
	new values.MATH("xor", 5));

// drilldown

t.deepEqual(
	new values.SET({ 5: "A" }).drilldown('4'),
	new values.SET(MISSING));
t.deepEqual(
	new values.SET({ 5: "A" }).drilldown('5'),
	new values.SET("A"));
t.deepEqual(
	new values.SET([0, -1, -2]).drilldown(3),
	new values.SET(MISSING));
t.deepEqual(
	new values.SET([0, -1, -2]).drilldown(2),
	new values.SET(-2));

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
	new values.MATH("add", 1).atomic_compose(
		new values.MATH("mult", 2) ),
	null);
t.deepEqual(
	new values.MATH("and", 0x1).atomic_compose(
		new values.MATH("and", 0x2) ),
	new values.SET(0));
t.deepEqual(
	new values.MATH("or", 0x1).atomic_compose(
		new values.MATH("or", 0x2) ),
	new values.MATH("or", 0x3));
t.deepEqual(
	new values.MATH("xor", 12).compose(
		new values.MATH("xor", 3) ),
	new values.MATH("xor", 15));
t.deepEqual(
	new values.MATH("not", null).compose(
		new values.MATH("not", null) ),
	new values.NO_OP());

t.deepEqual(
	new values.MATH("add", 1).compose(
		new values.SET(3) ),
	new values.SET(3));

// rebase

t.deepEqual(
	new values.NO_OP().rebase(new values.NO_OP() ),
	new values.NO_OP());
t.deepEqual(
	new values.NO_OP().rebase(new values.MATH("add", 1) ),
	new values.NO_OP());

t.deepEqual(
	new values.SET(1).rebase(new values.SET(1) ),
	new values.NO_OP());
t.deepEqual(
	new values.SET(2).rebase(new values.SET(1) ),
	null);
t.deepEqual(
	new values.SET(2).rebase(new values.SET(1), true),
	new values.SET(2));
t.deepEqual(
	new values.SET(1).rebase(new values.SET(2), true),
	new values.NO_OP());

t.deepEqual(
	new values.SET(2).rebase(new values.MATH("add", 3)),
	new values.SET(2));
t.deepEqual(
	new values.SET("2").rebase(new values.MATH("add", 3), true),
	new values.SET("2"));

t.deepEqual(
	new values.MATH("add", 1).rebase(new values.NO_OP() ),
	new values.MATH("add", 1));
t.deepEqual(
	new values.MATH("add", 2).rebase(new values.MATH("add", 1) ),
	new values.MATH("add", 2));
t.deepEqual(
	new values.MATH("rot", [1, 3]).rebase(new values.MATH("rot", [2, 3]) ),
	new values.MATH("rot", [1, 3]));
t.notOk(
	new values.MATH("mult", 2).rebase(new values.MATH("add", 1) )
	);
t.deepEqual(
	new values.MATH("xor", 3).rebase(new values.MATH("xor", 12) ),
	new values.MATH("xor", 3));

t.deepEqual(
	new values.MATH("add", 3).rebase(new values.SET(2)),
	new values.NO_OP());
t.deepEqual(
	new values.MATH("add", 3).rebase(new values.SET("2"), true),
	new values.NO_OP());


    t.end();
});
