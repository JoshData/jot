/* A library of operations for objects (i.e. JSON objects/Javascript associative arrays).

   Two operation aliases are provided:
   
   new objects.PUT(key, value)
    
    Creates a property with the given value. The property must not already
    exist in the document. This is an alias for
    new objects.APPLY(key, new values.SET(MISSING, value)).

   new objects.REM(key, old_value)
    
    Removes a property from an object. The property must exist in the document.
    The old value of the property is given as old_value. This is an alias for
    new objects.APPLY(key, new values.SET(old_value, MISSING)).

   Two new operation are provided:

   new objects.REN(old_key, new_key)
    
    Renames a property in the document object.

    Supports a conflictless rebase with itself and does not generate conflicts
    with the other operations in this module.

   new objects.APPLY(key, operation)
   new objects.APPLY({key: operation, ...})

    Applies any operation to a property, or multiple operations to various
    properties, on the object.

    Use any operation defined in any of the modules depending on the data type
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

	or

      new objects.APPLY({ key1: new values.SET("old_value", "new_value") })

   */
   
var deepEqual = require("deep-equal");
var jot = require("./index.js");
var values = require("./values.js");
var LIST = require("./meta.js").LIST;

//////////////////////////////////////////////////////////////////////////////

function shallow_clone(document) {
	var d = { };
	for (var k in document)
		d[k] = document[k];
	return d;
}

//////////////////////////////////////////////////////////////////////////////

exports.module_name = 'objects'; // for serialization/deserialization

exports.REN = function (old_key, new_key) {
	if (old_key == null || new_key == null) throw "invalid arguments";
	this.old_key = old_key;
	this.new_key = new_key;
	Object.freeze(this);
}
exports.REN.prototype = Object.create(jot.BaseOperation.prototype); // inherit
jot.add_op(exports.REN, exports, 'REN', ['old_key', 'new_key']);

exports.APPLY = function () {
	if (arguments.length == 1 && typeof arguments[0] == "object") {
		// Dict form.
		this.ops = arguments[0];
	} else if (arguments.length == 2 && typeof arguments[0] == "string") {
		// key & operation form.
		this.ops = { };
		this.ops[arguments[0]] = arguments[1];
	} else {
		throw "invalid arguments";
	}
	Object.freeze(this);
	Object.freeze(this.ops);
}
exports.APPLY.prototype = Object.create(jot.BaseOperation.prototype); // inherit
jot.add_op(exports.APPLY, exports, 'APPLY', ['ops']);

// The MISSING object is a sentinel to signal the state of an Object property
// that does not exist. It is the old_value to SET when adding a new property
// and the new_value when removing a property.
exports.MISSING = new Object();
Object.freeze(exports.MISSING);

exports.PUT = function (key, value) {
	exports.APPLY.apply(this, [key, new values.SET(exports.MISSING, value)]);
}
exports.PUT.prototype = Object.create(exports.APPLY.prototype); // inherit prototype

exports.REM = function (key, old_value) {
	exports.APPLY.apply(this, [key, new values.SET(old_value, exports.MISSING)]);
}
exports.REM.prototype = Object.create(exports.APPLY.prototype); // inherit prototype

//////////////////////////////////////////////////////////////////////////////

exports.REN.prototype.apply = function (document) {
	/* Applies the operation to a document. Returns a new object that is
	   the same type as document but with the change made. */

	// It's allowable to rename a key that doesn't exist -- that
	// is a no-op.
	if (!(this.old_key in document))
		return document;

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
		// An APPLY applied simultaneously and may have created the
		// key that the old key is being renamed to. That's a conflict.
		if (this.new_key in other.ops) {
			return null;
		}

		// If an APPLY applied simultaneously, there is no conflict but
		// the APPLY's key must be updated. If the apply's operation
		// deletes the key then the REN is left renaming a key that
		// doesn't exist... but we can't detect that so we'll let that
		// be ok.
		if (this.old_key in other.ops) {
			// Clone the other operations, delete the old key, add the
			// new key. The new key can't already exist since the REN
			// would have been invalid in that state.
			var new_apply_ops = shallow_clone(other.ops);
			new_apply_ops[this.new_key] = new_apply_ops[this.old_key];
			delete new_apply_ops[this.old_key];

			return [
				this,
				new exports.APPLY(new_apply_ops)
			];
		}

		// On different keys they don't bother each other.
		return [this, other];
	}]
];

//////////////////////////////////////////////////////////////////////////////


exports.APPLY.prototype.apply = function (document) {
	/* Applies the operation to a document. Returns a new object that is
	   the same type as document but with the change made. */

	// Clone first.
	var d = { };
	for (var k in document)
		d[k] = document[k];

	// Apply. Pass the object and key down in the second argument
	// to apply so that values.SET can handle the special MISSING
	// value.
	for (var key in this.ops) {
		var value = this.ops[key].apply(d[key], [d, key]);
		if (value === exports.MISSING)
			delete d[key]; // key was removed
		else
			d[key] = value;
	}
	return d;
}

exports.APPLY.prototype.simplify = function () {
	/* Returns a new atomic operation that is a simpler version
	   of this operation. If there is no sub-operation that is
	   not a NO_OP, then return a NO_OP. Otherwise, simplify all
	   of the sub-operations. */
	var new_ops = { };
	var had_non_noop = false;
	for (var key in this.ops) {
		new_ops[key] = this.ops[key].simplify();
		if (!(new_ops[key] instanceof values.NO_OP))
			had_non_noop = true;
	}
	if (!had_non_noop)
		return new values.NO_OP();
	return new exports.APPLY(new_ops);
}

exports.APPLY.prototype.invert = function () {
	/* Returns a new atomic operation that is the inverse of this operation.
	   All of the sub-operations get inverted. */
	var new_ops = { };
	for (var key in this.ops) {
		new_ops[key] = this.ops[key].invert();
	}
	return new exports.APPLY(new_ops);
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

	// two APPLYs
	if (other instanceof exports.APPLY) {
		// Start with a clone of this operation's suboperations.
		var new_ops = shallow_clone(this.ops);

		// Now compose with other.
		for (var key in other.ops) {
			if (!(key in new_ops)) {
				// Operation in other applies to a key not present
				// in this, so we can just merge - the operations
				// happen in parallel and don't affect each other.
				new_ops[key] = other.ops[key];
			} else {
				// Compose.
				var op2 = new_ops[key].compose(other.ops[key]);
				if (op2) {
					// They composed to a no-op, so delete the
					// first operation.
					if (op2 instanceof values.NO_OP)
						delete new_ops[key];

					// They composed to something atomic, so replace.
					else
						new_ops[key] = op2;
				} else {
					// They don't compose to something atomic, so use a LIST.
					new_ops[key] = new LIST([new_ops[key], other.ops[key]]);
				}
			}
		}

		return new exports.APPLY(new_ops).simplify();
	}

	// No composition possible.
	return null;
}

exports.APPLY.prototype.rebase_functions = [
	[exports.APPLY, function(other, conflictless) {
		// Rebase the sub-operations on corresponding keys.
		// If any rebase fails, the whole rebase fails.
		var new_ops_left = { };
		for (var key in this.ops) {
			new_ops_left[key] = this.ops[key];
			if (key in other.ops)
				new_ops_left[key] = new_ops_left[key].rebase(other.ops[key], conflictless);
			if (new_ops_left[key] === null)
				return null;
		}

		var new_ops_right = { };
		for (var key in other.ops) {
			new_ops_right[key] = other.ops[key];
			if (key in this.ops)
				new_ops_right[key] = new_ops_right[key].rebase(this.ops[key], conflictless);
			if (new_ops_right[key] === null)
				return null;
		}

		return [
			new exports.APPLY(new_ops_left).simplify(),
			new exports.APPLY(new_ops_right).simplify()
		];
	}]
]
