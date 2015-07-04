/*  An operational transformation library for atomic values. This
	library provides three operations: NO_OP (an operation that
	does nothing), SET (replace the document with a new value), and
	MATH (apply a function to the document). These functions are generic
	over various sorts of data types that they may apply to.

	new values.NO_OP()

	This operation does nothing. It is the return value of various
	functions throughout the library, e.g. when operations cancel
	out.
	

	new values.SET(old_value, new_value)
	
	The atomic replacement of one value with another. Works for
	any data type.
	

	new values.MATH(operator, operand)
	
	Applies a commutative, invertable arithmetic function to a number.
	
	"add": addition (use a negative number to decrement)
	
	"mult": multiplication (use the reciprocal to divide)
	
	"rot": addition followed by modulus (the operand is given
	       as a tuple of the increment and the modulus). The document
	       object must be non-negative and less than the modulus.

	"xor": bitwise exclusive-or (over integers and booleans
	       only)
	
	Note that by commutative we mean that the operation is commutative
	under composition, i.e. add(1)+add(2) == add(2)+add(1).
	
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

exports.SET = function (old_value, new_value) {
	/* An operation that replaces the document with a new (atomic) value. */
	this.old_value = old_value;
	this.new_value = new_value;
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
	return new exports.SET(this.new_value, this.old_value);
}

exports.SET.prototype.compose = function (other) {
	/* Creates a new atomic operation that has the same result as this
	   and other applied in sequence (this first, other after). Returns
	   null if no atomic operation is possible.
		   Returns a new SET operation that simply sets the value to what
		   the value would be when the two operations are composed. */
	return new exports.SET(this.old_value, other.apply(this.new_value)).simplify();
}

function cmp(a, b) {
	if (a < b)
		return -1;
	if (a > b)
		return 1;
	return 0;
}

exports.SET.prototype.rebase = function (other, conflictless) {
	/* Transforms this operation so that it can be composed *after* the other
	   operation to yield the same logical effect. Returns null on conflict.
	   If conflictless is true, tries extra hard to resolve a conflict in a
	   sensible way but possibly by killing one operation or the other. */

	if (other instanceof exports.NO_OP)
		return this;

	if (other instanceof exports.SET) {
		// If they both set the the document to the same value, then this
		// operation can become a no-op.
		if (deepEqual(this.new_value, other.new_value))
			return new exports.NO_OP();
		
		// If they set the document to different values and conflictless is
		// true, then we clobber the one whose value has a lower sort order.
		else if (conflictless && cmp(this.new_value, other.new_value) < 0)
			return new exports.NO_OP();
		else if (conflictless && cmp(this.new_value, other.new_value) > 0)
			return new exports.SET(other.new_value, this.new_value);
	}

	if (other instanceof exports.MATH) {
		// If the MATH operation can be applied to the new value, then
		// apply it. 
		try {
			return new exports.SET(other.apply(this.old_value), other.apply(this.new_value));
		} catch (e) {
			// A SET to a string value can't be rebased on a MATH operation.
			// If conflictless is true, prefer the SET.
			if (conflictless)
				return this;
		}
	}

	// Can't resolve conflict.
	return null;
}

//////////////////////////////////////////////////////////////////////////////

exports.MATH = function (operator, operand) {
	/* An operation that applies addition, multiplication, or rotation (modulus addition)
	   to a numeric document. */
	this.operator = operator;
	this.operand = operand;
}

exports.MATH.prototype.apply = function (document) {
	/* Applies the operation to this.operand. Applies the operator/operand
	   as a function to the document. */
	if (typeof document != "number" && typeof document != "boolean")
		throw "Invalid operation on non-numeric document."
	if (this.operator == "add")
		return document + this.operand;
	if (this.operator == "rot")
		return (document + this.operand[0]) % this.operand[1];
	if (this.operator == "mult")
		return document * this.operand;
	if (this.operator == "xor") {
		var ret = document ^ this.operand;
		if (typeof document == 'boolean')
			ret = !!ret; // cast to boolean
		return ret;
	}
}

exports.MATH.prototype.simplify = function () {
	/* Returns a new atomic operation that is a simpler version
	   of another operation. If the operation is a degenerate case,
	   return NO_OP. */
	if (this.operator == "add" && this.operand == 0)
		return new exports.NO_OP();
	if (this.operator == "rot" && this.operand[0] == 0)
		return new exports.NO_OP();
	if (this.operator == "rot") // ensure the first value is less than the modulus
		return new exports.MATH("rot", [this.operand[0] % this.operand[1], this.operand[1]]);
	if (this.operator == "mult" && this.operand == 1)
		return new exports.NO_OP();
	if (this.operator == "xor" && this.operand == 0)
		return new exports.NO_OP();
	return this;
}

exports.MATH.prototype.invert = function () {
	/* Returns a new atomic operation that is the inverse of this operation */
	if (this.operator == "add")
		return new exports.MATH("add", -this.operand);
	if (this.operator == "rot")
		return new exports.MATH("rot", [-this.operand[0], this.operand[1]]);
	if (this.operator == "mult")
		return new exports.MATH("mult", 1.0/this.operand);
	if (this.operator == "xor")
		return this; // is its own inverse
}

exports.MATH.prototype.compose = function (other) {
	/* Creates a new atomic operation that has the same result as this
	   and other applied in sequence (this first, other after). Returns
	   null if no atomic operation is possible. */

	if (other instanceof exports.NO_OP)
		return this;

	if (other instanceof exports.SET)
		return other; // wipes away this operation

	if (other instanceof exports.MATH) {
		// two adds just add the operands
		if (this.operator == other.operator && this.operator == "add")
			return new exports.MATH("add", this.operand + other.operand).simplify();

		// two rots with the same modulus add the operands
		if (this.operator == other.operator && this.operator == "rot" && this.operand[1] == other.operand[1])
			return new exports.MATH("rot", [this.operand[0] + other.operand[0], this.operand[1]]).simplify();

		// two multiplications multiply the operands
		if (this.operator == other.operator && this.operator == "mult")
			return new exports.MATH("mult", this.operand * other.operand).simplify();

		// two xor's xor the operands
		if (this.operator == other.operator && this.operator == "xor")
			return new exports.MATH("xor", this.operand ^ other.operand).simplify();
	}
	
	return null; // no composition is possible
}

exports.MATH.prototype.rebase = function (other, conflictless) {
	/* Transforms this operation so that it can be composed *after* the other
	   operation to yield the same logical effect. Returns null on conflict. */

	if (other instanceof exports.NO_OP)
		return this;

	// Symmetric with SET.rebase.
	if (other instanceof exports.SET) {
		// Check if the MATH operation can be applied to SET's new value.
		try {
			new exports.SET(this.apply(other.old_value), this.apply(other.new_value));
			// Operations are a go, so we can return this operation unchanged.
			return this;
		} catch (e) {
			// If conflictless is true, prefer the SET by clobbering this operation.
			if (conflictless)
				return new exports.NO_OP();
		}
	}

	if (other instanceof exports.MATH) {
		// Since the map operators are commutative, it doesn't matter which order
		// they are applied in. That makes the rebase trivial -- if the operators
		// are the same, then nothing needs to be done.
		if (this.operator == other.operator) {
			if (this.operator == "rot" && this.operand[1] != other.operand[1])
				return null; // rot must have same modulus
			return this;
		}
		return null;
	}
}
