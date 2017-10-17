var test = require('tap').test;
var jot = require('../jot')

test('copy', function(t) {

var copy_a = new jot.COPY("A");
var paste_a = new jot.PASTE(copy_a);

// inspect

t.equal(
	new jot.CLIPBOARD(new jot.NO_OP(), "clip1").inspect(),
	"<copy.CLIPBOARD clip1 <values.NO_OP>>");
t.equal(
	new jot.COPY("A").inspect(),
	'<copy.COPY A (unbound)>');
t.equal(
	new jot.PASTE(new jot.COPY("A")).inspect(),
	'<copy.PASTE A (unbound)>');
t.equal(
	new jot.CLIPBOARD(new jot.COPY("A"), "clip1").inspect(),
	'<copy.CLIPBOARD clip1 <copy.COPY A in clip1>>');
t.equal(
	new jot.CLIPBOARD(copy_a.compose(paste_a), "clip1").inspect(),
	'<copy.CLIPBOARD clip1 <lists.LIST [<copy.COPY A in clip1>, <copy.PASTE A in clip1>]>>');

// serialization

// apply

t.deepEqual(
	new jot.CLIPBOARD(
		copy_a.compose(new jot.PASTE(copy_a))).apply(100),
	100);

t.deepEqual(
	new jot.CLIPBOARD(new jot.LIST([
		copy_a,
		new jot.SET(200),
		paste_a,
	]))
		.apply(100),
	100);

t.deepEqual(
	new jot.CLIPBOARD(new jot.LIST([
		new jot.ATINDEX(1, copy_a),
		new jot.ATINDEX(3, paste_a),
	]))
		.apply([0, 1, 2, 3]),
	[0, 1, 2, 1]);

t.deepEqual(
	new jot.CLIPBOARD(new jot.LIST([
		new jot.ATINDEX(1, copy_a),
		new jot.SPLICE(1, 1, []),
		new jot.SPLICE(2, 0, [null]),
		new jot.ATINDEX(2, paste_a),
	]))
		.apply(["A", "B", "C"]),
	["A", "C", "B"]);

t.deepEqual(
	new jot.CLIPBOARD(new jot.LIST([
		new jot.PATCH([{ offset: 1, length: 2, op: copy_a }]),
		new jot.SPLICE(1, 2, []),
		new jot.SPLICE(2, 0, [null]),
		new jot.ATINDEX(2, paste_a),
	]))
		.apply(["A", "B", "C" ,"D"]),
	["A", "D", ["B", "C"]]);

t.deepEqual(
	new jot.CLIPBOARD(new jot.LIST([
		new jot.APPLY("A", copy_a),
		new jot.REM("A"),
		new jot.APPLY("B", paste_a),
	]))
		.apply({ "A": 10 }),
	{ "B": 10 });

// simplify

// invert

// drilldown

// compose

// rebase

    t.end();
});
