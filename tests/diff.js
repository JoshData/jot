var test = require('tap').test;
var jot = require('../jot')
var diff = require("../jot/diff.js");

test('diff', function(t) {

	function test(a, b, options) {
		var op = diff.diff(a, b, options);
		t.deepEqual(op.apply(a), b);
		t.deepEqual(op.invert().apply(b), a);
	}

	// values (these just turn into SET operations)

	test(5, { });

	// strings

	test("This is a test.", "That is not a test of string comparison.");
	test("This is a test.", "I know. This is a test.");
	test("This is a test.", "This is a test. Yes, I know.");

	// arrays

	test([1, 2, 3], [1, 2, 3])
	test([1, 2, 3], [0.5, 1, 1.5, 2, 2.5, 3, 3.5])
	test([0.5, 1, 1.5, 1.75, 2, 2.5, 3, 3.5], [1, 2, 3])

	// objects

	test({ "a": "Hello!" }, { "a": "Goodbye!" });
	test({ "a": "Hello!" }, { "b": "Hello!" });

	// recursive

	test({ "a": ["Hello!", ["Goodbye!"]] }, { "b": ["Hola!", ["Adios!"]] }, { words: true });

    t.end();
});
