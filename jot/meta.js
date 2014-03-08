/*  A library of meta-operations.
	
	COMPOSITION(array_of_operations)
	
	A composition of zero or more operations, given as an array.
	
	It has the following internal form:
	
	{
	 module_name: "meta.js",
	 type: "composition",
	 operations: [op1, op2, ...]
	}

	*/
	
var jot_base = require(__dirname + "/base.js");

// constructors

exports.COMPOSITION = function (operations) {
	return { // don't simplify here -- breaks tests
		module_name: "meta.js",
		type: "composition",
		operations: operations
	};
}

// operations

exports.apply = function (op, value) {
	/* Applies the operation to a value. */
		
	if (op.type == "composition") {
		for (var i = 0; i < op.operations.length; i++)
			value = jot_base.apply(op.operations[i], value);
		return value;
	}
}

exports.simplify = function (op) {
	/* Returns a new atomic operation that is a simpler version
		of another operation. For instance, simplify on a replace
		operation that replaces one value with the same value
		returns a no-op operation. If there's no simpler operation,
		returns the op unchanged. */
		
	if (op.type == "composition")
		return exports.COMPOSITION(jot_base.normalize_array(op.operations));

	return op; // no simplification is possible
}

exports.invert = function (op) {
	/* Returns a new atomic operation that is the inverse of op */
		
	if (op.type == "composition")
		return exports.COMPOSITION(jot_base.invert_array(op.operations));
}

exports.compose = function (a, b) {
	/* Creates a new atomic operation that combines the operations a
		and b, if an atomic operation is possible, otherwise returns
		null. */

	a = exports.simplify(a);
	b = exports.simplify(b);
	
	if (a.type == "composition" && b.type == "composition") {
		return exports.COMPOSITION(a.operations.concat(b.operations));
	}
		
	return null; // no composition is possible
}
	
exports.rebase = function (a, b) {
	/* Transforms b, an operation that was applied simultaneously as a,
		so that it can be composed with a. rebase(a, b) == rebase(b, a). */

	if (a.type == "composition" && b.type == "composition") {
		var ops = jot_base.rebase_array(a.operations, b.operations);
		if (ops == null) return null;
		return exports.COMPOSITION(ops);
	}
}
