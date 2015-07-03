var test = require('tap').test;
var values = require("../jot/values.js");
var seqs = require("../jot/sequences.js");
var jot = require("../jot");

// apply
//
test('sequences', function(t) {

t.equal(
	new seqs.SPLICE(0, 1, "4").apply("123"),
	"423");
t.equal(
	new seqs.SPLICE(0, 1, "").apply("123"),
	"23");
t.equal(
	new seqs.SPLICE(0, 1, "44").apply("123"),
	"4423");
t.equal(
	new seqs.SPLICE(3, 0, "44").apply("123"),
	"12344");

t.equal(
	new seqs.MOVE(0, 1, 3).apply("123"),
	"231");
t.equal(
	new seqs.MOVE(2, 1, 0).apply("123"),
	"312");

t.deepEqual(
	new seqs.APPLY(0, new values.SET(4)).apply([1, 2, 3]),
	[4, 2, 3]);
t.deepEqual(
	new seqs.APPLY(1, new values.SET(4)).apply([1, 2, 3]),
	[1, 4, 3]);
t.deepEqual(
	new seqs.APPLY(2, new values.SET(4)).apply([1, 2, 3]),
	[1, 2, 4]);

t.deepEqual(
	new seqs.APPLY(0, new values.SET("d")).apply("abc"),
	"dbc");
t.deepEqual(
	new seqs.APPLY(1, new values.SET("d")).apply("abc"),
	"adc");
t.deepEqual(
	new seqs.APPLY(2, new values.SET("d")).apply("abc"),
	"abd");

// simplify

t.deepEqual(
	new seqs.SPLICE(3, 3, "456").simplify(),
	new seqs.SPLICE(3, 3, "456"));
t.deepEqual(
	new seqs.MOVE(3, 5, 3).simplify(),
	new values.NO_OP());
t.deepEqual(
	new seqs.MOVE(3, 5, 4).simplify(),
	new seqs.MOVE(3, 5, 4));
t.deepEqual(
	new seqs.APPLY(0, new values.SET(1)).simplify(),
	new seqs.APPLY(0, new values.SET(1)));
t.deepEqual(
	new seqs.APPLY(0, new values.SET(2)).simplify(),
	new seqs.APPLY(0, new values.SET(2)));

// invert

t.deepEqual(
	new seqs.MOVE(3, 3, 10).invert(),
	new seqs.MOVE(7, 3, 3));
t.deepEqual(
	new seqs.MOVE(10, 3, 3).invert(),
	new seqs.MOVE(3, 3, 13));
t.deepEqual(
	new seqs.APPLY(0, new values.SET(2)).invert(),
	null);

// compose

// ...

t.deepEqual(
	new seqs.APPLY(555, new values.SET("B"))
		.compose(new seqs.APPLY(555, new values.SET("C"))),
	new seqs.APPLY(555, new values.SET("C")));

// rebase

// ...

t.deepEqual(
	new seqs.APPLY(555, new values.MAP("add", 3)).rebase(
		new seqs.APPLY(555, new values.MAP("add", 1))),
	new seqs.APPLY(555, new values.MAP("add", 3)));

t.deepEqual(
	new seqs.APPLY(555, new values.MAP("add", 3)).rebase(
		new seqs.SPLICE(555, 0, ["NEWVALUE"])),
	new seqs.APPLY(556, new values.MAP("add", 3)));

t.deepEqual(
	new seqs.APPLY(555, new values.MAP("add", 3)).rebase(
		new seqs.MOVE(555, 3, 0)),
	new seqs.APPLY(0, new values.MAP("add", 3)));

// from_string_rep

t.equal(
	seqs.from_diff("this is a test", "calculus was a hard test")
		.apply("this is a test"),
	"calculus was a hard test");

t.end();

});
