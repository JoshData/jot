var test = require('tap').test;
var jot = require('../jot')

function assertEqual(t, v1, v2) {
	// After applying math operators, floating point
	// results can come out a little different. Round
	// numbers to about as much precision as floating
	// point numbers have anyway.
	if (typeof v1 == "number" && typeof v2 == "number") {
		v1 = v1.toPrecision(8);
		v2 = v2.toPrecision(8);
	}
	t.deepEqual(v1, v2);
}

test('random', function(tt) {
for (var i = 0; i < 1000; i++) {
		// Start with a random initial document.
		var initial_value = jot.createRandomValue();
		
		// Create two operations on the initial document.
		var op1 = jot.createRandomOpSequence(initial_value, Math.floor(10*Math.random())+1)
		var op2 = jot.createRandomOpSequence(initial_value, Math.floor(10*Math.random())+1)

		tt.test(
			JSON.stringify({
				"value": initial_value,
				"op1": op1.toJSON(),
				"op2": op2.toJSON(),
			}),
			function(t) {

		// Apply each to get the intermediate values.
		var val1 = op1.apply(initial_value);
		var val2 = op2.apply(initial_value);

		// Check that the parallel rebases match.
		var val1b = op2.rebase(op1, { document: initial_value }).apply(val1);
		var val2b = op1.rebase(op2, { document: initial_value }).apply(val2);
		assertEqual(t, val1b, val2b);

		// Check that they also match using composition.
		var val1c = op1.compose(op2.rebase(op1, { document: initial_value })).apply(initial_value);
		var val2c = op2.compose(op1.rebase(op2, { document: initial_value })).apply(initial_value);
		assertEqual(t, val1c, val2c);

		// Check that we can compute a diff.
		var d = jot.diff(initial_value, val1b);

	    t.end();

		});
}
tt.end();
});
