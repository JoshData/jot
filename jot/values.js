/*  An operational transformation library for atomic values. This
	library provides three operations: NO_OP (an operation that
	does nothing), SET (replace the document with a new value), and
	MATH (apply a function to the document). These functions are generic
	over various sorts of data types that they may apply to.

	new values.NO_OP()

	This operation does nothing. It is the return value of various
	functions throughout the library, e.g. when operations cancel
	out. NO_OP is conflictless: It never creates a conflict when
	rebased against or operations or when other operations are
	rebased against it.
	

	new values.SET(old_value, new_value)
	
	The atomic replacement of one value with another. Works for
	any data type. Supports a conflictless rebase with other SET
	and MATH operations.
	

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

	MATH supports a conflictless rebase with other MATH and SET operations.
	
	*/
	
var deepEqual = require("deep-equal");
var jot = require("./index.js");

//////////////////////////////////////////////////////////////////////////////

exports.module_name = 'values'; // for serialization/deserialization

exports.NO_OP = function() {
	/* An operation that makes no change to the document. */
	Object.freeze(this);
}
exports.NO_OP.prototype = Object.create(jot.BaseOperation.prototype); // inherit
jot.add_op(exports.NO_OP, exports, 'NO_OP', []);

exports.SET = function(old_value, new_value) {
	/* An operation that replaces the document with a new (atomic) value. */
	this.old_value = old_value;
	this.new_value = new_value;
	Object.freeze(this);
}
exports.SET.prototype = Object.create(jot.BaseOperation.prototype); // inherit
jot.add_op(exports.SET, exports, 'SET', ['old_value', 'new_value']);

exports.MATH = function(operator, operand) {
	/* An operation that applies addition, multiplication, or rotation (modulus addition)
	   to a numeric document. */
	this.operator = operator;
	this.operand = operand;
	Object.freeze(this);
}
exports.MATH.prototype = Object.create(jot.BaseOperation.prototype); // inherit
jot.add_op(exports.MATH, exports, 'MATH', ['operator', 'operand']);


//////////////////////////////////////////////////////////////////////////////

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

//////////////////////////////////////////////////////////////////////////////

exports.SET.prototype.apply = function (document) {
	/* Applies the operation to a document. Returns the new
	   value, regardless of the document. */
	return this.new_value;
}

exports.SET.prototype.simplify = function () {
	/* Returns a new atomic operation that is a simpler version
	   of another operation. If the new value is the same as the
	   old value, returns NO_OP. */
	if (deepEqual(this.old_value, this.new_value, { strict: true }))
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

exports.SET.prototype.rebase_functions = [
	// Rebase this against other and other against this.

	[exports.SET, function(other, conflictless) {
		// SET and SET.

		// If they both set the the document to the same value, then the one
		// applied second (the one being rebased) becomes a no-op. Since the
		// two parts of the return value are for each rebased against the
		// other, both are returned as no-ops.
		if (deepEqual(this.new_value, other.new_value, { strict: true }))
			return [new exports.NO_OP(), new exports.NO_OP()];
		
		// If they set the document to different values and conflictless is
		// true, then we clobber the one whose value has a lower sort order.
		if (conflictless && jot.cmp(this.new_value, other.new_value) < 0)
			return [new exports.NO_OP(), new exports.SET(this.new_value, other.new_value)];

		// cmp > 0 is handled by a call to this function with the arguments
		// reversed, so we don't need to explicltly code that logic.

		// If conflictless is false, then we can't rebase the operations
		// because we can't preserve the meaning of both. Return null to
		// signal conflict.
		return null;
	}],

	[exports.MATH, function(other, conflictless) {
		// SET (this) and MATH (other). To get a consistent effect no matter
		// which order the operations are applied in, we say the SET comes
		// first and the MATH second. But since MATH only works for numeric
		// types, this isn't always possible.

		// When it's the SET being rebased, we have to update its old_value
		// so that it matches the value of the document following the application
		// of the MATH operation. We know what the document was because that's
		// in old_value, so we can apply the MATH operation to it. Then to
		// get the logical effect of applying MATH second (even though it's
		// the SET being rebased, meaning it will be composed second), we
		// apply the MATH operation to its new value.
		try {
			// If the data types make this possible...
			return [
				new exports.SET(other.apply(this.old_value), other.apply(this.new_value)),
				other // no change is needed when it is the MATH being rebased
				];
		} catch (e) {
			// Data type mismatch, e.g. the SET sets the value to a string and
			// so the MATH operation can't be applied. In this case, we simply
			// always prefer the SET if we're asked for a conflictless rebase.
			// But we still need to adjust the SET's old value because when
			// rebasing the SET the MATH already did apply. That should never
			// raise an exception because if the MATH operation is valid then
			// it must be able to apply to SET's old_value. The MATH becomes a
			// no-op.
			if (conflictless)
				return [
					new exports.SET(other.apply(this.old_value), this.new_value),
					new exports.NO_OP()
					];
		}

		// Can't resolve conflict.
		return null;
	}]
];

//////////////////////////////////////////////////////////////////////////////

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

	if (other instanceof exports.SET) // wipes away this, bust must adjust old_value
		return new exports.SET(this.invert().apply(other.old_value), other.new_value).simplify();

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

exports.MATH.prototype.rebase_functions = [
	// Rebase this against other and other against this.

	[exports.MATH, function(other, conflictless) {
		// Since the map operators are commutative, it doesn't matter which order
		// they are applied in. That makes the rebase trivial -- if the operators
		// are the same, then nothing needs to be done.
		if (this.operator == other.operator) {
			// rot must have same modulus
			if (this.operator != "rot" || this.operand[1] == other.operand[1])
				return [this, other];
		}

		// If we are given two operators, then we don't know which order they
		// should be applied in. In a conflictless rebase, we can choose on
		// arbitrarily (but predictably). They all operate over numbers so they
		// can be applied in either order, it's just that the resulting value
		// will depend on the order. We sort on both operator and operand because
		// in a rot the operand contains information that distinguishes them.
		if (conflictless) {
			// The one with the lower sort order applies last. So if this has
			// a lower sort order, then when rebasing this we don't make a
			// change. But when rebasing other, we have to undo this, then
			// apply other, then apply this again.
			if (jot.cmp([this.operator, this.operand], [other.operator, other.operand]) < 0) {
				return [
					this,
					jot.LIST([this.invert(), other, this])
				];
			}

			// if cmp == 0, then the operators were the same and we handled
			// it above. if cmp > 0 then we handle this on the call to
			// other.rebase(this).

		}

		return null;
	}]
];

