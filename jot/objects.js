/* A library of operations for objects (i.e. JSON objects/Javascript associative arrays).

   new objects.PUT(key, value)
    
    Creates a property with the given value. This is an alias for
    new objects.APPLY(key, new values.SET(value)).

   new objects.REM(key)
    
    Removes a property from an object. This is an alias for
    new objects.APPLY(key, new values.SET(objects.MISSING)).

   new objects.REN(old_key, new_key)
   new objects.REN({ new_key: old_key })
    
    Renames a property in the document object, renames multiple properties,
    or duplicates properties. In the second form, all old keys that are not
    mentioned as new keys are deleted.

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
    
      new objects.APPLY("key1", new values.SET("new_value"))

	or

      new objects.APPLY({ key1: new values.SET("new_value") })

   */
   
var util = require('util');
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

exports.REN = function () {
	if (arguments.length == 1 && typeof arguments[0] == "object") {
		// Dict form.
		this.map = arguments[0];
	} else if (arguments.length == 2 && typeof arguments[0] == "string" && typeof arguments[1] == "string") {
		// key & operation form.
		this.map = { };
		this.map[arguments[1]] = arguments[0];
	} else {
		throw "invalid arguments";
	}
	Object.freeze(this);
	Object.freeze(this.map);
}
exports.REN.prototype = Object.create(jot.BaseOperation.prototype); // inherit
jot.add_op(exports.REN, exports, 'REN', ['map']);

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
	exports.APPLY.apply(this, [key, new values.SET(value)]);
}
exports.PUT.prototype = Object.create(exports.APPLY.prototype); // inherit prototype

exports.REM = function (key) {
	exports.APPLY.apply(this, [key, new values.SET(exports.MISSING)]);
}
exports.REM.prototype = Object.create(exports.APPLY.prototype); // inherit prototype

//////////////////////////////////////////////////////////////////////////////

exports.REN.prototype.inspect = function(depth) {
	return util.format("<objects.REN %j>", this.map);
}

exports.REN.prototype.apply = function (document) {
	/* Applies the operation to a document. Returns a new object that is
	   the same type as document but with the changes made. */

	// Clone first.
	var d = shallow_clone(document);

	// Apply duplications.
	for (var new_key in this.map) {
		var old_key = this.map[new_key];
		if (old_key in d)
			d[new_key] = d[old_key];
	}

	// Delete old keys. Must do this after the above since duplications
	// might refer to the same old key multiple times. Delete any old_keys
	// in the mapping that are not mentioned as new keys. This allows us
	// to duplicate and preserve by mapping a key to itself and to new
	// keys.
	for (var new_key in this.map) {
		var old_key = this.map[new_key];
		if (!(old_key in this.map))
			delete d[old_key];
	}

	return d;
}

exports.REN.prototype.simplify = function () {
	/* Returns a new atomic operation that is a simpler version
	   of this operation.*/

	// If there are any non-identity mappings, then
	// preserve this object.
	for (var key in this.map) {
		if (key != this.map[key])
			return this;
	}

	return new values.NO_OP();
}

exports.REN.prototype.inverse = function (document) {
	/* Returns a new atomic operation that is the inverse of this operation,
	   given the state of the document before this operation applies. */
	var inv_map = { };
	for (var key in this.map)
		inv_map[this.map[key]] = key;
	return new exports.REN(inv_map);
}

exports.REN.prototype.atomic_compose = function (other) {
	/* Creates a new atomic operation that has the same result as this
	   and other applied in sequence (this first, other after). Returns
	   null if no atomic operation is possible. */

	// merge
	if (other instanceof exports.REN) {
		var map = { };
		for (var key in this.map)
			map[key] = this.map[key];
		for (var key in other.map) {
			if (other.map[key] in map) {
				// The rename is chained.
				map[key] = this.map[other.map[key]];
				delete map[other.map[key]];
			} else {
				// The rename is on another key.
				map[key] = other.map[key];
			}
		}
		return new exports.REN(map);
	}
	
	// No composition possible.
	return null;
}

exports.REN.prototype.rebase_functions = [
	[exports.REN, function(other, conflictless) {
		// Two RENs at the same time.

		// Fast path: If the renames are identical, then each goes
		// to a NO_OP when rebased against the other.
		if (deepEqual(this.map, other.map))
			return [new values.NO_OP(), new values.NO_OP()];

		function inner_rebase(a, b) {
			// Rebase a against b. Keep all of a's renames.
			// Just stop if there is a conflict.
			var new_map = shallow_clone(a.map);
			for (var new_key in b.map) {
				var old_key = b.map[new_key];
				if (new_key in a.map) {
					if (a.map[new_key] != b.map[new_key]) {
						// Both RENs create a property of the same name
						// and not by renaming the same property.
						return null;
					} else {
						// Both RENs renamed the same property to the same
						// new key. So each goes to a no-op on that key since
						// the rename was already made.
						delete new_map[new_key];
					}
				} else {
					// Since a rename has taken place, update any renames
					// in a that are affected.
					for (var a_key in new_map) {
						if (new_map[a_key] == old_key) {
							// Both RENs renamed the same property, but
							// to different keys (if they were the same
							// key then new_key would be in a.map which
							// we already checked).
							return null;
						}
					}
				}
			}
			return new exports.REN(new_map);
		}

		var x = inner_rebase(this, other);
		var y = inner_rebase(other, this);
		if (!x || !y)
			return null;

		return [x, y];
	}],

	[exports.APPLY, function(other, conflictless) {
		// An APPLY applied simultaneously and may have created the
		// key that this operation is also creating through a rename
		// or duplication. That's a conflict.
		// TODO: How to do this in a conflictless way?
		for (var new_key in this.map)
			if (new_key in other.ops)
				return null;

		// If an APPLY applied simultaneously to a key that is not
		// mentioned as a new key in map, there is no conflict but
		// the APPLY's keys may need to be renamed. If a key in the
		// APPLY is involved in duplication, then we must duplicate
		// the operations too.
		//
		// The logic here parallels the logic of REN.apply.

		// Apply duplications.
		var new_apply_ops = shallow_clone(other.ops);
		for (var new_key in this.map) {
			var old_key = this.map[new_key];
			if (old_key in new_apply_ops)
				new_apply_ops[new_key] = new_apply_ops[old_key];
		}

		// Delete old keys.
		for (var new_key in this.map) {
			var old_key = this.map[new_key];
			if (!(old_key in this.map))
				delete new_apply_ops[old_key];
		}

		return [
			this,
			new exports.APPLY(new_apply_ops)
		];
	}]
];

//////////////////////////////////////////////////////////////////////////////

exports.APPLY.prototype.inspect = function(depth) {
	var inner = [];
	var ops = this.ops;
	Object.keys(ops).forEach(function(key) {
		inner.push(util.format("%j:%s", key, ops[key].inspect(depth-1)));
	});
	return util.format("<objects.APPLY %s>", inner.join(", "));
}

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
			// Remember that we have a substantive operation.
			had_non_noop = true;
		else
			// Drop internal NO_OPs.
			delete new_ops[key];
	}
	if (!had_non_noop)
		return new values.NO_OP();
	return new exports.APPLY(new_ops);
}

exports.APPLY.prototype.inverse = function (document) {
	/* Returns a new atomic operation that is the inverse of this operation,
	   given the state of the document before this operation applies. */
	var new_ops = { };
	for (var key in this.ops) {
		new_ops[key] = this.ops[key].inverse(key in document ? document[key] : exports.MISSING);
	}
	return new exports.APPLY(new_ops);
}

exports.APPLY.prototype.atomic_compose = function (other) {
	/* Creates a new atomic operation that has the same result as this
	   and other applied in sequence (this first, other after). Returns
	   null if no atomic operation is possible. */

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

				// They composed to a no-op, so delete the
				// first operation.
				if (op2 instanceof values.NO_OP)
					delete new_ops[key];

				else
					new_ops[key] = op2;
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

exports.createRandomOp = function(doc, context) {
	// Create a random operation that could apply to doc.
	// Choose uniformly across various options.
	var ops = [];

	// Add a random key with a random value.
	ops.push(function() { return new exports.PUT("k"+Math.floor(1000*Math.random()), jot.createRandomValue()); });

	// Apply random operations to individual keys.
	Object.keys(doc).forEach(function(key) {
		ops.push(function() { return jot.createRandomOp(doc[key], "object") });
	});

	// TODO: REN.

	// Select randomly.
	return ops[Math.floor(Math.random() * ops.length)]();
}
