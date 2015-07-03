/* A library of operations for objects (i.e. JSON objects/Javascript associative arrays).
   
   Four operations are provided:
   
   new objects.PUT(key, value)
    
    Creates a property with the given value. The property must not already
    exist in the document.

   new objects.REM(key)
    
    Removes a property from an object. The property must exist in the document.

   new objects.REN(old_key, new_key)
    
    Renames a property in the document object.

   new objects.APPLY(key, operation)

    Applies another sort of operation to a property's value. Use any
    operation defined in any of the modules depending on the data type
    of the property. For instance, the operations in values.js can be
    applied to any property. The operations in sequences.js can be used
    if the property's value is a string or array. And the operations in
    this module can be used if the value is another object.
    
    Example:
    
    To replace the value of a property with a new value:
    
      new objects.APPLY("key1", new values.SET("new_value"))
      
   */
   
var deepEqual = require("deep-equal");
var values = require("./values.js");

//////////////////////////////////////////////////////////////////////////////

function shallow_clone(document) {
	var d = { };
	for (var k in document)
		d[k] = document[k];
	return d;
}

//////////////////////////////////////////////////////////////////////////////

exports.PUT = function (key, value) {
	if (key == null) throw "invalid arguments";
	this.key = key;
	this.value = value;
}

exports.PUT.prototype.apply = function (document) {
	/* Applies the operation to a document. Returns a new object that is
	   the same type as document but with the change made. */

	// Clone first.
	var d = shallow_clone(document);

	// Apply.
	d[this.key] = this.value;

	return d;
}

exports.PUT.prototype.simplify = function () {
	/* Returns a new atomic operation that is a simpler version
	   of this operation.*/
	return this;
}

exports.PUT.prototype.invert = function () {
	/* Returns a new atomic operation that is the inverse of this operation */
	return new exports.REM(this.key);
}

exports.PUT.prototype.compose = function (other) {
	/* Creates a new atomic operation that has the same result as this
	   and other applied in sequence (this first, other after). Returns
	   null if no atomic operation is possible. */

	// the next operation is a no-op, so the composition is just this
	if (other instanceof values.NO_OP)
		return this;

	// a SET clobbers this operation
	if (other instanceof values.SET)
		return other.simplify();

	if (other instanceof exports.REM && this.key == other.key)
		return new values.NO_OP();

	if (other instanceof exports.REN && this.key == other.old_key)
		return new exports.PUT(other.new_key, this.value);

	// No composition possible.
	return null;
}

exports.PUT.prototype.rebase = function (other) {
	/* Transforms this operation so that it can be composed *after* the other
	   operation to yield the same logical effect. Returns null on conflict. */

	if (other instanceof values.NO_OP)
		return this;

	if (other instanceof exports.PUT) {
		if (this.key == other.key) {
			// Two PUTs on the same key with the same value
			//   either can become a no-op.
			if (this.value == other.value)
				return new values.NO_OP();

			// But with different values it is a conflict.
			return null;
		} else {
			// Two PUTs on different keys don't bother each other.
			return this;
		}
	}

	// None of the other object operations could have applied
	// simultaneously because while PUT assumes the key did not
	// exist, the other operations assume the key did exist.

	return null;
}

////

exports.REM = function (key) {
	if (key == null) throw "invalid arguments";
	this.key = key;
}

exports.REM.prototype.apply = function (document) {
	/* Applies the operation to a document. Returns a new object that is
	   the same type as document but with the change made. */

	// Clone first.
	var d = shallow_clone(document);

	// Apply.
	delete d[this.key];

	return d;
}

exports.REM.prototype.simplify = function () {
	/* Returns a new atomic operation that is a simpler version
	   of this operation.*/
	return this;
}

exports.REM.prototype.compose = function (other) {
	/* Creates a new atomic operation that has the same result as this
	   and other applied in sequence (this first, other after). Returns
	   null if no atomic operation is possible. */

	// the next operation is a no-op, so the composition is just this
	if (other instanceof values.NO_OP)
		return this;

	// a SET clobbers this operation
	if (other instanceof values.SET)
		return other.simplify();

	if (other instanceof exports.PUT && this.key == other.key)
		return new exports.APPLY(this.key, values.SET(other.value));

	// No composition possible.
	return null;
}

exports.REM.prototype.rebase = function (other) {
	/* Transforms this operation so that it can be composed *after* the other
	   operation to yield the same logical effect. Returns null on conflict. */

	if (other instanceof values.NO_OP)
		return this;

	if (other instanceof exports.REM) {
		// Two REMs on the same key - either can become a no-op.
		if (this.key == other.key)
			return new values.NO_OP();

		// Otherwise on different keys, they two REMs don't bother each other.
		return this;
	}

	if (other instanceof exports.REN) {
		// A rename on the same key - update this's key.
		if (this.key == other.old_key)
			return new exports.REM(other.new_key);
		return this;
	}

	if (other instanceof exports.APPLY) {
		// An APPLY on the same key. The REM will take precedence.
		return this;
	}

	// PUT could not have applied simultaneously because while this
	// operation assumes the key did exist, PUT assumes the key did not exist.

	return null;
}

////

exports.REN = function (old_key, new_key) {
	if (old_key == null || new_key == null) throw "invalid arguments";
	this.old_key = old_key;
	this.new_key = new_key;
}

exports.REN.prototype.apply = function (document) {
	/* Applies the operation to a document. Returns a new object that is
	   the same type as document but with the change made. */

	// Clone first.
	var d = shallow_clone(document);

	var v = d[this.old_key];
	delete d[this.old_key];
	d[this.new_key] = v;

	return d;
}

exports.REN.prototype.simplify = function () {
	/* Returns a new atomic operation that is a simpler version
	   of this operation.*/
	return this;
}

exports.REN.prototype.invert = function () {
	/* Returns a new atomic operation that is the inverse of this operation */
	return new exports.REN(this.new_key, this.old_key);
}

exports.REN.prototype.compose = function (other) {
	/* Creates a new atomic operation that has the same result as this
	   and other applied in sequence (this first, other after). Returns
	   null if no atomic operation is possible. */

	// the next operation is a no-op, so the composition is just this
	if (other instanceof values.NO_OP)
		return this;

	// a SET clobbers this operation
	if (other instanceof values.SET)
		return other.simplify();

	if (other instanceof exports.REM && this.new_key == other.key)
		return new exports.REM(this.old_key);

	// No composition possible.
	return null;
}

exports.REN.prototype.rebase = function (other) {
	/* Transforms this operation so that it can be composed *after* the other
	   operation to yield the same logical effect. Returns null on conflict. */

	if (other instanceof values.NO_OP)
		return this;

	if (other instanceof exports.REN) {
		// Two RENs on the same key.
		if (this.old_key == other.old_key) {
			// If they both rename to the same key, then either can
			// become a no-op.
			if (this.new_key == other.new_key)
				return new values.NO_OP();
			return null; // conflict
		}

		// The two RENs rename different keys to the same thing.
		// Conflict.
		if (this.new_key == other.new_key)
			return null;

		// Otherwise on different keys, they two RENs don't bother each other.
		return this;
	}

	if (other instanceof exports.REM) {
		// A simultaneous delete of the same key. The delete
		// takes precedence.
		if (this.old_key == other.key)
			return new values.NO_OP();

		// Otherwise they don't bother each other.
		return this;
	}

	if (other instanceof exports.APPLY) {
		// An APPLY on the same key. The REN will take precedence.
		return this;
	}

	// PUT could not have applied simultaneously because while this
	// operation assumes the key did exist, PUT assumes the key did not exist.

	return null;
}

//////////////////////////////////////////////////////////////////////////////


exports.APPLY = function (key, op) {
	if (key == null || op == null) throw "invalid arguments";
	this.key = key;
	this.op = op;
}

exports.APPLY.prototype.apply = function (document) {
	/* Applies the operation to a document. Returns a new object that is
	   the same type as document but with the change made. */

	// Clone first.
	var d = { };
	for (var k in document)
		d[k] = document[k];

	// Apply.
	d[this.key] = this.op.apply(d[this.key]);
	return d;
}

exports.APPLY.prototype.simplify = function () {
	/* Returns a new atomic operation that is a simpler version
	   of this operation.*/
	var op2 = this.op.simplify();
	if (op2 instanceof values.NO_OP)
		return values.NO_OP();
	return this;
}

exports.APPLY.prototype.invert = function () {
	/* Returns a new atomic operation that is the inverse of this operation */
	if (!this.op.invert) // inner operation does not support inverse
		return null;
	return new exports.APPLY(this.key, this.op.invert());
}

exports.APPLY.prototype.compose = function (other) {
	/* Creates a new atomic operation that has the same result as this
	   and other applied in sequence (this first, other after). Returns
	   null if no atomic operation is possible. */

	// the next operation is a no-op, so the composition is just this
	if (other instanceof values.NO_OP)
		return this;

	// a SET clobbers this operation
	if (other instanceof values.SET)
		return other.simplify();

	// APPLY followed by a REM clobbers this operation
	if (other instanceof exports.REM && this.key == other.key)
		return other.simplify();

	// two APPLYs to the same key in a row
	if (other instanceof exports.APPLY && this.key == other.key) {
		var op2 = this.op.compose(other.op);
		if (op2)
			return exports.APPLY(this.key, op2);
	}

	// No composition possible.
	return null;
}

exports.APPLY.prototype.rebase = function (other) {
	/* Transforms this operation so that it can be composed *after* the other
	   operation to yield the same logical effect. Returns null on conflict. */

	if (other instanceof values.NO_OP)
		return this;
	
	if (other instanceof exports.REM) {
		// REM takes precedence
		if (other.key == this.key)
			return new values.NO_OP();
		else
			return this;
	}
	
	if (other instanceof exports.REN) {
		if (this.key == other.old_key)
			return new exports.APPLY(other.new_key, this.op);
		else
			return this;
	}

	if (other instanceof exports.APPLY) {
		if (this.key != other.key) {
			// Changes to different keys are independent.
			return this;
		}

		// Operated on the same key. Rebase the sub-operations.
		var op2 = this.op.rebase(other.op);
		if (op2)
			return new exports.APPLY(this.key, op2);
	}

	return null;
}
