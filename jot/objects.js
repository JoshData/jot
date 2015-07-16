/* A library of operations for objects (i.e. JSON objects/Javascript associative arrays).
   
   Four operations are provided:
   
   new objects.PUT(key, value)
    
    Creates a property with the given value. The property must not already
    exist in the document.

    Supports a conflictless rebase with other PUT operations, and never
    generates conflicts with the other operations in any case because
    a PUT (to add a key) could not apply simultaneously with the other
    operations on the same key because those operations require the key
    exists.

   new objects.REM(key, old_value)
    
    Removes a property from an object. The property must exist in the document.
    The old value of the property is given as old_value.

    This operation never generates conflicts with any of operations in
    this module, including itself.

   new objects.REN(old_key, new_key)
    
    Renames a property in the document object.

    Supports a conflictless rebase with itself and does not generate conflicts
    with the other operations in this module.

   new objects.APPLY(key, operation)

    Applies another sort of operation to a property's value. Use any
    operation defined in any of the modules depending on the data type
    of the property. For instance, the operations in values.js can be
    applied to any property. The operations in sequences.js can be used
    if the property's value is a string or array. And the operations in
    this module can be used if the value is another object.

    Supports a conflictless rebase with itself with the inner operations
    themselves support a conflictless rebase. It does not generate conflicts
    with any other operations in this module.

    Example:
    
    To replace the value of a property with a new value:
    
      new objects.APPLY("key1", new values.SET("old_value", "new_value"))
      
   */
   
var deepEqual = require("deep-equal");
var jot = require("./index.js");
var values = require("./values.js");

//////////////////////////////////////////////////////////////////////////////

function shallow_clone(document) {
	var d = { };
	for (var k in document)
		d[k] = document[k];
	return d;
}

//////////////////////////////////////////////////////////////////////////////

exports.module_name = 'objects'; // for serialization/deserialization

exports.PUT = function (key, value) {
	if (key == null) throw "invalid arguments";
	this.key = key;
	this.value = value;
}
exports.PUT.prototype = Object.create(jot.BaseOperation.prototype); // inherit
jot.add_op(exports.PUT, exports, 'PUT', ['key', 'value']);

exports.REM = function (key, old_value) {
	if (key == null) throw "invalid arguments";
	this.key = key;
	this.old_value = old_value;
}
exports.REM.prototype = Object.create(jot.BaseOperation.prototype); // inherit
jot.add_op(exports.REM, exports, 'REM', ['key', 'old_value']);

exports.REN = function (old_key, new_key) {
	if (old_key == null || new_key == null) throw "invalid arguments";
	this.old_key = old_key;
	this.new_key = new_key;
}
exports.REN.prototype = Object.create(jot.BaseOperation.prototype); // inherit
jot.add_op(exports.REN, exports, 'REN', ['old_key', 'new_key']);

exports.APPLY = function (key, op) {
	if (key == null || op == null) throw "invalid arguments";
	this.key = key;
	this.op = op;
}
exports.APPLY.prototype = Object.create(jot.BaseOperation.prototype); // inherit
jot.add_op(exports.APPLY, exports, 'APPLY', ['key', 'op']);

//////////////////////////////////////////////////////////////////////////////

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
	return new exports.REM(this.key, this.value);
}

exports.PUT.prototype.compose = function (other) {
	/* Creates a new atomic operation that has the same result as this
	   and other applied in sequence (this first, other after). Returns
	   null if no atomic operation is possible. */

	// the next operation is a no-op, so the composition is just this
	if (other instanceof values.NO_OP)
		return this;

	// a SET clobbers this operation, but its old_value must be updated
	if (other instanceof values.SET)
		return new values.SET(this.invert().apply(other.old_value), other.new_value).simplify();

	if (other instanceof exports.REM && this.key == other.key)
		return new values.NO_OP();

	if (other instanceof exports.REN && this.key == other.old_key)
		return new exports.PUT(other.new_key, this.value);

	if (other instanceof exports.APPLY && this.key == other.key)
		return new exports.PUT(this.key, other.op.apply(this.value));

	// No composition possible.
	return null;
}

exports.PUT.prototype.rebase_functions = [
	[exports.PUT, function(other, conflictless) {
		if (this.key == other.key) {
			// Two PUTs on the same key with the same value
			//   either can become a no-op.
			if (deepEqual(this.value, other.value))
				return [new values.NO_OP(), new values.NO_OP()];

			// If they set the key to different values and conflictless is
			// true, then we clobber the one whose value has a lower sort order.
			// The one that remains becomes an APPLY(SET) to change the value.
			if (conflictless && jot.cmp(this.value, other.value) < 0)
				return [
					new values.NO_OP(), // clobbered
					new exports.APPLY(other.key, new values.SET(this.value, other.value))
				];

			// cmp > 0 is handled by a call to this function with the arguments
			// reversed, so we don't need to explicltly code that logic.

			// But with different values it is a conflict.
			return null;
		} else {
			// Two PUTs on different keys don't bother each other.
			return [this, other];
		}
	}]

	// None of the other object operations could have applied
	// simultaneously because while PUT assumes the key did not
	// exist, the other operations assume the key did exist.
]

////


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

exports.REM.prototype.invert = function () {
	/* Returns a new atomic operation that is the inverse of this operation */
	return new exports.PUT(this.key, this.old_value);
}

exports.REM.prototype.compose = function (other) {
	/* Creates a new atomic operation that has the same result as this
	   and other applied in sequence (this first, other after). Returns
	   null if no atomic operation is possible. */

	// the next operation is a no-op, so the composition is just this
	if (other instanceof values.NO_OP)
		return this;

	// a SET clobbers this operation, but its old_value must be updated
	if (other instanceof values.SET)
		return new values.SET(this.invert().apply(other.old_value), other.new_value).simplify();

	if (other instanceof exports.PUT && this.key == other.key)
		return new exports.APPLY(this.key, values.SET(other.value));

	// No composition possible.
	return null;
}

exports.REM.prototype.rebase_functions = [
	[exports.REM, function(other, conflictless) {
		// Two REMs on the same key - either can become a no-op.
		if (this.key == other.key)
			return [new values.NO_OP(), new values.NO_OP()];

		// Otherwise on different keys, they two REMs don't bother each other.
		return [this, other];
	}],

	[exports.REN, function(other, conflictless) {
		// A rename on the same key - update this's key.
		if (this.key == other.old_key)
			return [
				new exports.REM(other.new_key, this.old_value),
				new values.NO_OP()
			];
		return [this, other];
	}],

	[exports.APPLY, function(other, conflictless) {
		// If an APPLY applied simultaneously, then update this
		// operation's old_value. It takes precedence. The APPLY
		// becomes a no-op.
		if (this.key == other.key)
			return [
				new exports.REM(this.key, other.op.apply(this.old_value)),
				new values.NO_OP()
			];
		return [this, other];
	}]

	// PUT could not have applied simultaneously because while this
	// operation assumes the key did exist, PUT assumes the key did not exist.
]

////

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

	// a SET clobbers this operation, but its old_value must be updated
	if (other instanceof values.SET)
		return new values.SET(this.invert().apply(other.old_value), other.new_value).simplify();

	if (other instanceof exports.REM && this.new_key == other.key)
		return new exports.REM(this.old_key);

	// No composition possible.
	return null;
}

exports.REN.prototype.rebase_functions = [
	[exports.REN, function(other, conflictless) {
		// Two RENs on the same key.
		if (this.old_key == other.old_key) {
			// If they both rename to the same key, then either can
			// become a no-op.
			if (this.new_key == other.new_key)
				return [new values.NO_OP(), new values.NO_OP()];

			// If they rename to different keys, and if conflictless
			// is true, then rename to the one with the higher sort
			// order.
			if (conflictless && jot.cmp(this.new_key, other.new_key) < 0)
				return [
					new values.NO_OP(), // clobber
					new exports.REN(this.new_key, other.new_key),
				];

			// cmp > 0 is handled by a call to other.rebase_functions(this).

			return null; // conflict
		}

		// The two RENs rename different keys to the same thing.
		if (this.new_key == other.new_key) {
			// If conflictless is true, clobber the one that modified
			// a key with the lower sort order.
			if (conflictless && jot.cmp(this.old_key, other.old_key) < 0)
				return [
					new values.NO_OP(), // clobber
					other,
				];

			// cmp > 0 is handled by a call to other.rebase_functions(this).

			return null;
		}

		// Otherwise on different keys, they two RENs don't bother each other.
		return [this, other];
	}],

	[exports.APPLY, function(other, conflictless) {
		// If an APPLY applied simultaneously, there is no conflict but
		// the APPLY's key must be updated.
		if (this.old_key == other.key)
			return [
				this,
				new exports.APPLY(this.new_key, other.op)
			];

		// On different keys they don't bother each other.
		return [this, other];
	}]

	// PUT could not have applied simultaneously because while this
	// operation assumes the key did exist, PUT assumes the key did not exist.
];

//////////////////////////////////////////////////////////////////////////////


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
	return new exports.APPLY(this.key, this.op.invert());
}

exports.APPLY.prototype.compose = function (other) {
	/* Creates a new atomic operation that has the same result as this
	   and other applied in sequence (this first, other after). Returns
	   null if no atomic operation is possible. */

	// the next operation is a no-op, so the composition is just this
	if (other instanceof values.NO_OP)
		return this;

	// a SET clobbers this operation, but its old_value must be updated
	if (other instanceof values.SET)
		return new values.SET(this.invert().apply(other.old_value), other.new_value).simplify();

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

exports.APPLY.prototype.rebase_functions = [
	[exports.APPLY, function(other, conflictless) {
		if (this.key != other.key) {
			// Changes to different keys are independent.
			return [this, other];
		}

		// Operated on the same key. Rebase the sub-operations.
		// Only succeeds if the rebase both ways is possible.
		var opa = this.op.rebase(other.op, conflictless);
		var opb = other.op.rebase(this.op, conflictless);
		if (opa && opb)
			return [
				(opa instanceof values.NO_OP) ? new values.NO_OP() : new exports.APPLY(this.key, opa),
				(opb instanceof values.NO_OP) ? new values.NO_OP() : new exports.APPLY(other.key, opb)
			];
	}]
]
