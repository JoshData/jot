/*  An operational transformation library for atomic values. This
	library provides three operations: NO_OP (an operation that
	does nothing), SET (replace this.operand with a new value), and
	MAP (apply a function to this.operand). These functions are generic
	over various sorts of data types that they may apply to.

	new values.NO_OP()

	This operation does nothing. It is the return value of various
	functions throughout the library, e.g. when operations cancel
	out.
	

	new values.SET(old_value, new_value[, global_order])
	
	The atomic replacement of one value with another. Works for
	any data type.
	
	global_order is optional. When supplied and when guaranteed
	to be unique, creates a conflict-less replace operation by
	favoring the operation with the higher global_order value.
	

	new values.MAP(operator, operand)
	
	Applies a commutative, invertable function to this.operand. The supported
	operators are:
	
	on numbers:
	
	"add": addition by a number (use a negative number to decrement)
	
	"mult": multiplication by a number (use the reciprocal to divide)
	
	"rot": addition by a number followed by modulus (the value is
	       given as a list of the increment and the modulus). The document
	       object must be non-negative and less than the modulus.
	
	Note that by commutative we mean that the operation is commutative
	under composition, i.e. add(1)+add(2) == add(2)+add(1).
	
	(You might think the union and relative-complement set operators
	would work here, but relative-complement does not have a right-
	inverse. That is, relcomp composed with union may not be a no-op
	because the union may add keys not found in the original.)
	*/
	
var deepEqual = require("deep-equal");

//////////////////////////////////////////////////////////////////////////////

exports.NO_OP = function() {
	/* An operation that makes no change to the document. */
}

exports.NO_OP.prototype.apply = function (document) {
	/* Applies the operation to a document. Returns the document
	   unchanged. */
	return document;
}

exports.NO_OP.prototype.simplify = function () {
	/* Returns a new atomic operation that is a simpler version
	   of this operation.*/
	return this;
}

exports.NO_OP.prototype.invert = function () {
	/* Returns a new atomic operation that is the inverse of this operation */
	return this;
}

exports.NO_OP.prototype.compose = function (other) {
	/* Creates a new atomic operation that has the same result as this
	   and other applied in sequence (this first, other after). Returns
	   null if no atomic operation is possible. */
	return other;
}

exports.NO_OP.prototype.rebase = function (other) {
	/* Transforms this operation so that it can be composed *after* the other
	   operation to yield the same logical effect. Returns null on conflict. */
	return this;
}

//////////////////////////////////////////////////////////////////////////////

exports.SET = function (old_value, new_value, global_order) {
	/* An operation that replaces the document with a new (atomic) value. */
	this.old_value = old_value;
	this.new_value = new_value;
	this.global_order = global_order || null;
}

exports.SET.prototype.apply = function (document) {
	/* Applies the operation to a document. Returns the new
	   value, regardless of the document. */
	return this.new_value;
}

exports.SET.prototype.simplify = function () {
	/* Returns a new atomic operation that is a simpler version
	   of another operation. If the new value is the same as the
	   old value, returns NO_OP. */
	if (deepEqual(this.old_value, this.new_value))
		return new exports.NO_OP();
	return this;
}

exports.SET.prototype.invert = function () {
	/* Returns a new atomic operation that is the inverse of this operation. */
	return new exports.SET(this.new_value, this.old_value, this.global_order);
}

exports.SET.prototype.compose = function (other) {
	/* Creates a new atomic operation that has the same result as this
	   and other applied in sequence (this first, other after). Returns
	   null if no atomic operation is possible.
		   Returns a new SET operation that simply sets the value to what
		   the value would be when the two operations are composed. */
	return new exports.SET(this.old_value, other.apply(this.new_value), this.global_order).simplify();
}

exports.SET.prototype.rebase = function (other) {
	/* Transforms this operation so that it can be composed *after* the other
	   operation to yield the same logical effect. Returns null on conflict. */

	if (other instanceof exports.NO_OP)
		return this;

	if (other instanceof exports.SET) {
		// If they both the the document to the same value, then this
		// operation can become a no-op.
		if (deepEqual(this.new_value, other.new_value))
			return new exports.NO_OP();
		
		// Use global_order to resolve the conflicts.
		if (this.global_order > other.global_order)
			// clobber other's operation
			return new exports.SET(other.new_value, this.new_value, this.global_order).simplify();
			
		else if (this.global_order < other.global_order)
			// this gets clobbered
			return new exports.NO_OP(); 
		
		else
			// If their global_order is the same (e.g. null and null), then
			// this results in a conflict error.
			return null;
	}

	// There's always a conflict when rebased against a MAP.
	return null;
}

//////////////////////////////////////////////////////////////////////////////

exports.MAP = function (operator, operand) {
	/* An operation that applies addition, multiplication, or rotation (modulus addition)
	   to a numeric document. */
	this.operator = operator;
	this.operand = operand;
}

exports.MAP.prototype.apply = function (document) {
	/* Applies the operation to this.operand. Applies the operator/operand
	   as a function to the document. */
	if (this.operator == "add")
		return document + this.operand;
	if (this.operator == "rot")
		return (document + this.operand[0]) % this.operand[1];
	if (this.operator == "mult")
		return document * this.operand;
}

exports.MAP.prototype.simplify = function () {
	/* Returns a new atomic operation that is a simpler version
	   of another operation. If the operation is a degenerate case,
	   return NO_OP. */
	if (this.operator == "add" && this.operand == 0)
		return new exports.NO_OP();
	if (this.operator == "rot" && this.operand[0] == 0)
		return new exports.NO_OP();
	if (this.operator == "rot") // ensure the first value is less than the modulus
		return new exports.MAP("rot", [this.operand[0] % this.operand[1], this.operand[1]]);
	if (this.operator == "mult" && this.operand == 1)
		return new exports.NO_OP();
	return this;
}

exports.MAP.prototype.invert = function () {
	/* Returns a new atomic operation that is the inverse of this operation */
	if (this.operator == "add")
		return new exports.MAP("add", -this.operand);
	if (this.operator == "rot")
		return new exports.MAP("rot", [-this.operand[0], this.operand[1]]);
	if (this.operator == "mult")
		return new exports.MAP("mult", 1.0/this.operand);
}

exports.MAP.prototype.compose = function (other) {
	/* Creates a new atomic operation that has the same result as this
	   and other applied in sequence (this first, other after). Returns
	   null if no atomic operation is possible. */

	if (other instanceof exports.NO_OP)
		return this;

	if (other instanceof exports.SET)
		return other; // wipes away this operation

	if (other instanceof exports.MAP) {
		// two adds just add the operands
		if (this.operator == other.operator && this.operator == "add")
			return new exports.MAP("add", this.operand + other.operand).simplify();

		// two rots with the same modulus add the operands
		if (this.operator == other.operator && this.operator == "rot" && this.operand[1] == other.operand[1])
			return new exports.MAP("rot", [this.operand[0] + other.operand[0], this.operand[1]]).simplify();

		// two multiplications multiply the operands
		if (this.operator == other.operator && this.operator == "mult")
			return new exports.MAP("mult", this.operand * other.operand).simplify();
	}
	
	return null; // no composition is possible
}

exports.MAP.prototype.rebase = function (other) {
	/* Transforms this operation so that it can be composed *after* the other
	   operation to yield the same logical effect. Returns null on conflict. */

	if (other instanceof exports.NO_OP)
		return this;

	// Symmetric with SET.rebase, rebasing with SET is always a conflict.
	if (other instanceof exports.SET)
		return null;

	if (other instanceof exports.MAP) {
		// Since the map operators are commutative, it doesn't matter which order
		// they are applied in. That makes the rebase trivial -- if the operators
		// are the same.
		if (this.operator == other.operator) {
			if (this.operator == "rot" && this.operand[1] != other.operand[1])
				return null; // rot must have same modulus
			return this;
		}
	}
}
