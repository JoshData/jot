var assert = require('assert')
var values = require("../ot/values.js");
var seqs = require("../ot/sequences.js");
var base = require("../ot/base.js");

// apply

assert.equal(
	seqs.apply(seqs.NO_OP(), "123"),
	"123");
assert.equal(
	seqs.apply(seqs.SPLICE(0, "1", "4"), "123"),
	"423");
assert.equal(
	seqs.apply(seqs.SPLICE(0, "1", ""), "123"),
	"23");
assert.equal(
	seqs.apply(seqs.SPLICE(0, "1", "44"), "123"),
	"4423");
assert.equal(
	seqs.apply(seqs.SPLICE(3, "", "44"), "123"),
	"12344");

assert.equal(
	seqs.apply(seqs.MOVE(0, 1, 3), "123"),
	"231");
assert.equal(
	seqs.apply(seqs.MOVE(2, 1, 0), "123"),
	"312");

assert.deepEqual(
	seqs.apply(seqs.APPLY(0, values.REP(1, 4)), [1, 2, 3]),
	[4, 2, 3]);

// simplify

assert.deepEqual(
	seqs.simplify(seqs.SPLICE(3, "123", "123")),
	seqs.NO_OP());
assert.deepEqual(
	seqs.simplify(seqs.SPLICE(3, "123", "456")),
	seqs.SPLICE(3, "123", "456"));
assert.deepEqual(
	seqs.simplify(seqs.MOVE(3, 5, 3)),
	seqs.NO_OP());
assert.deepEqual(
	seqs.simplify(seqs.MOVE(3, 5, 4)),
	seqs.MOVE(3, 5, 4));
assert.deepEqual(
	seqs.simplify(seqs.APPLY(0, values.REP(1, 1))),
	seqs.NO_OP());
assert.deepEqual(
	seqs.simplify(seqs.APPLY(0, values.REP(1, 2))),
	seqs.APPLY(0, values.REP(1, 2)));

// invert

assert.deepEqual(
	seqs.invert(seqs.SPLICE(3, "123", "456")),
	seqs.SPLICE(3, "456", "123"));
assert.deepEqual(
	seqs.invert(seqs.MOVE(3, 3, 10)),
	seqs.MOVE(7, 3, 3));
assert.deepEqual(
	seqs.invert(seqs.MOVE(10, 3, 3)),
	seqs.MOVE(3, 3, 13));
assert.deepEqual(
	seqs.invert(seqs.APPLY(0, values.REP(1, 2))),
	seqs.APPLY(0, values.REP(2, 1)));

// compose

// ...

// rebase

// ...

// from_string_rep

assert.equal(
	base.apply_array(
		seqs.from_string_rep(values.REP("this is a test", "calculus was a hard test")),
		"this is a test"),
	"calculus was a hard test");
