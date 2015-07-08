var test = require('tap').test;
var values = require("../jot/values.js");
var seqs = require("../jot/sequences.js");
var jot = require("../jot");

test('sequences', function(t) {

// inspect

t.equal(
	new seqs.SPLICE(0, "1", "4").inspect(),
	'<sequences.SPLICE {pos:0, old_value:"1", new_value:"4"}>');
t.equal(
	new seqs.MOVE(0, 2, 5).inspect(),
	'<sequences.MOVE {pos:0, count:2, new_pos:5}>');
t.equal(
	new seqs.APPLY(0, new values.SET(1, 2)).inspect(),
	'<sequences.APPLY {pos:0, op:<values.SET {old_value:1, new_value:2}>}>');

// apply

t.equal(
	new seqs.SPLICE(0, "1", "4").apply("123"),
	"423");
t.equal(
	new seqs.SPLICE(0, "1", "").apply("123"),
	"23");
t.equal(
	new seqs.SPLICE(0, "1", "44").apply("123"),
	"4423");
t.equal(
	new seqs.SPLICE(3, "", "44").apply("123"),
	"12344");

t.equal(
	new seqs.MOVE(0, 1, 3).apply("123"),
	"231");
t.equal(
	new seqs.MOVE(2, 1, 0).apply("123"),
	"312");

t.deepEqual(
	new seqs.APPLY(0, new values.SET(1, 4)).apply([1, 2, 3]),
	[4, 2, 3]);
t.deepEqual(
	new seqs.APPLY(1, new values.SET(2, 4)).apply([1, 2, 3]),
	[1, 4, 3]);
t.deepEqual(
	new seqs.APPLY(2, new values.SET(3, 4)).apply([1, 2, 3]),
	[1, 2, 4]);

t.deepEqual(
	new seqs.APPLY(0, new values.SET("a", "d")).apply("abc"),
	"dbc");
t.deepEqual(
	new seqs.APPLY(1, new values.SET("b", "d")).apply("abc"),
	"adc");
t.deepEqual(
	new seqs.APPLY(2, new values.SET("c", "d")).apply("abc"),
	"abd");

// simplify

t.deepEqual(
	new seqs.SPLICE(3, "123", "123").simplify(),
	new values.NO_OP());
t.deepEqual(
	new seqs.SPLICE(3, "123", "456").simplify(),
	new seqs.SPLICE(3, "123", "456"));
t.deepEqual(
	new seqs.MOVE(3, 5, 3).simplify(),
	new values.NO_OP());
t.deepEqual(
	new seqs.MOVE(3, 5, 4).simplify(),
	new seqs.MOVE(3, 5, 4));
t.deepEqual(
	new seqs.APPLY(0, new values.SET(1, 1)).simplify(),
	new values.NO_OP());
t.deepEqual(
	new seqs.APPLY(0, new values.SET(1, 2)).simplify(),
	new seqs.APPLY(0, new values.SET(1, 2)));

// invert

t.deepEqual(
	new seqs.SPLICE(3, "123", "456").invert(),
	new seqs.SPLICE(3, "456", "123"));
t.deepEqual(
	new seqs.MOVE(3, 3, 10).invert(),
	new seqs.MOVE(7, 3, 3));
t.deepEqual(
	new seqs.MOVE(10, 3, 3).invert(),
	new seqs.MOVE(3, 3, 13));
t.deepEqual(
	new seqs.APPLY(0, new values.SET(1, 2)).invert(),
	new seqs.APPLY(0, new values.SET(2, 1)));

// compose

// ...

t.deepEqual(
	new seqs.APPLY(555, new values.SET("A", "B"))
		.compose(new seqs.APPLY(555, new values.SET("B", "C"))),
	new seqs.APPLY(555, new values.SET("A", "C")));

// rebase

// ...

t.deepEqual(
	new seqs.APPLY(555, new values.MATH("add", 3)).rebase(
		new seqs.APPLY(555, new values.MATH("add", 1))),
	new seqs.APPLY(555, new values.MATH("add", 3)));

t.deepEqual(
	new seqs.APPLY(555, new values.MATH("add", 3)).rebase(
		new seqs.INS(555, ["NEWVALUE"])),
	new seqs.APPLY(556, new values.MATH("add", 3)));

t.deepEqual(
	new seqs.APPLY(555, new values.MATH("add", 3)).rebase(
		new seqs.MOVE(555, 3, 0)),
	new seqs.APPLY(0, new values.MATH("add", 3)));

// from_string_rep

t.equal(
	seqs.from_diff("this is a test", "calculus was a hard test")
		.apply("this is a test"),
	"calculus was a hard test");

t.end();

});
