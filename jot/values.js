/*  An operational transformation library for atomic values. This
	library provides two operations: replace and map. These
	functions are generic over various sorts of data types.
	
	SET(old_value, new_value[, global_order])
	
	The atomic replacement of one value with another. Works for
	any data type.
	
	global_order is optional. When supplied and when guaranteed
	to be unique, creates a conflict-less replace operation by
	favoring the operation with the higher global_order value.
	
	The replace operation has the following internal form:
	
	{
	 module_name: "values.js",
	 type: "rep",
	 old_value: ...a value...,
	 new_value: ...a value...,
	 global_order: ...a value...,
	}
	
	MAP(operator, value)
	
	Applies a commutative, invertable function to a value. The supported
	operators are:
	
	on numbers:
	
	"add": addition by a number (use a negative number to decrement)
	
	"mult": multiplication by a number (use the reciprocal to divide)
	
	"rot": addition by a number followed by modulus (the value is
	       given as a list of the increment and the modulus). The document
	       object must be non-negative and less than the modulus.
	
	on boolean values:
	
	"xor": exclusive-or (really only useful with 'true' which makes
	this a bit-flipper; 'false' is a no-op)
	
	Note that by commutative we mean that the operation is commutative
	under the composition transform, i.e. add(1)+add(2) == add(2)+add(1).
	
	(You might think the union and relative-complement set operators
	would work here, but relative-complement does not have a right-
	inverse. That is, relcomp composed with union may not be a no-op
	because the union may add keys not found in the original.)
	
	The map operation has the following internal form:
	
	{
	 module_name: "values.js",
	 type: "map",
	 operator: "add" | "mult" | "rot" | "xor"
	 value: ...a value...,
	}
	
	*/
	
var deepEqual = require("deep-equal");

// constructors

exports.NO_OP = function() {
	return { "type": "no-op" }; // no module_name is required on no-ops
}

exports.SET = function (old_value, new_value, global_order) {
	return { // don't simplify here -- breaks tests
		module_name: "values.js",
		type: "rep",
		old_value: old_value,
		new_value: new_value,
		global_order: global_order || null
	};
}

exports.MAP = function (operator, value) {
	return { // don't simplify here -- breaks tests
		module_name: "values.js",
		type: "map",
		operator: operator,
		value: value
	};
}

// operations

exports.apply = function (op, value) {
	/* Applies the operation to a value. */
		
	if (op.type == "no-op")
		return value;

	if (op.type == "rep")
		return op.new_value;
	
	if (op.type == "map" && op.operator == "add")
		return value + op.value;

	if (op.type == "map" && op.operator == "rot")
		return (value + op.value[0]) % op.value[1];
	
	if (op.type == "map" && op.operator == "mult")
		return value * op.value;
	
	if (op.type == "map" && op.operator == "xor")
		return !!(value ^ op.value); // the ^ operator is over numbers, then use "!!" to cast it to a boolean
}

exports.simplify = function (op) {
	/* Returns a new atomic operation that is a simpler version
		of another operation. For instance, simplify on a replace
		operation that replaces one value with the same value
		returns a no-op operation. If there's no simpler operation,
		returns the op unchanged. */
		
	if (op.type == "rep" && deepEqual(op.old_value, op.new_value))
		return exports.NO_OP();
	
	if (op.type == "map" && op.operator == "add" && op.value == 0)
		return exports.NO_OP();
	
	if (op.type == "map" && op.operator == "rot" && op.value[0] == 0)
		return exports.NO_OP();

	if (op.type == "map" && op.operator == "rot")
		// ensure the first value is less than the modulus
		return exports.MAP("rot", [op.value[0] % op.value[1], op.value[1]]);
	
	if (op.type == "map" && op.operator == "mult" && op.value == 1)
		return exports.NO_OP();
	
	if (op.type == "map" && op.operator == "xor" && op.value == false)
		return exports.NO_OP();
	
	if (op.type == "map" && op.operator == "xor" && op.value == false)
		return exports.NO_OP();
	
	return op; // no simplification is possible
}

exports.invert = function (op) {
	/* Returns a new atomic operation that is the inverse of op */
		
	if (op.type == "no-op")
		return op;

	if (op.type == "rep")
		return exports.SET(op.new_value, op.old_value, op.global_order);
	
	if (op.type == "map" && op.operator == "add")
		return exports.MAP("add", -op.value);

	if (op.type == "map" && op.operator == "rot")
		return exports.MAP("rot", [-op.value[0], op.value[1]]);
	
	if (op.type == "map" && op.operator == "mult")
		return exports.MAP("mult", 1.0/op.value);
	
	if (op.type == "map" && op.operator == "xor")
		return op; // it's its own inverse
}

exports.compose = function (a, b) {
	/* Creates a new atomic operation that combines the operations a
		and b, if an atomic operation is possible, otherwise returns
		null. */

	a = exports.simplify(a);
	b = exports.simplify(b);
	
	if (a.type == "no-op")
		return b;

	if (b.type == "no-op")
		return a;

	if (a.type == "rep" && b.type == "rep" && a.global_order == b.global_order)
		return exports.simplify(exports.SET(a.old_value, b.new_value, a.global_order));
	
	if (a.type == "map" && b.type == "map" && a.operator == b.operator && a.operator == "add")
		return exports.simplify(exports.MAP("add", a.value + b.value));

	if (a.type == "map" && b.type == "map" && a.operator == b.operator && a.operator == "rot" && a.value[1] == b.value[1])
		return exports.simplify(exports.MAP("rot", [a.value[0] + b.value[0], a.value[1]]));

	if (a.type == "map" && b.type == "map" && a.operator == b.operator && a.operator == "mult")
		return exports.simplify(exports.MAP("mult", a.value * b.value));

	if (a.type == "map" && b.type == "map" && a.operator == b.operator && a.operator == "xor") {
		if (a.value == false && b.value == false)
			return exports.NO_OP();
		if (a.value == true && b.value == true)
			return exports.NO_OP();
		if (a.value == true)
			return a;
		if (b.value == true)
			return b;
	}
		
	return null; // no composition is possible
}
	
exports.rebase = function (a, b) {
	/* Transforms b, an operation that was applied simultaneously as a,
		so that it can be composed with a. rebase(a, b) == rebase(b, a). */

	a = exports.simplify(a);
	b = exports.simplify(b);

	if (a.type == "no-op")
		return b;

	if (b.type == "no-op")
		return b;

	if (a.type == "rep" && b.type == "rep") {
		if (deepEqual(a.new_value, b.new_value))
			return exports.NO_OP();
		
		if (b.global_order > a.global_order)
			// clobber a's operation
			return exports.simplify(exports.SET(a.new_value, b.new_value, b.global_order));
			
		if (b.global_order < a.global_order)
			return exports.NO_OP(); // this replacement gets clobbered
		
		// If their global_order is the same (e.g. null and null), then
		// this results in a conflict error (thrown below).
	}
	
	// Since the map operators are commutative, it doesn't matter which order
	// they are applied in. That makes the rebase trivial.
	if (a.type == "map" && b.type == "map" && a.operator == b.operator) {
		if (a.operator == "rot" && a.value[1] != b.value[1]) return null; // rot must have same modulus
		return b;
	}
		
	// Return null indicating this is an unresolvable conflict.
	return null;
}

