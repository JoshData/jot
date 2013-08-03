/* An operational transform library for objects (associative
   arrays).
   
   Two operations are provided:
   
   PROP

    Creates, deletes, or renames a property.

	{
	 type: "prop",
	 old_key: ...a key name, or null to create a key...,
	 new_key: ...a new key name, or null to delete a key...,
	 old_value: ...the existing value of the key; null when creating or renaming a key...,
	 new_value: ...the new value for the key; null when deleting or renaming a key...,
	}
   
	
   APPLYOP

    Applies another sort of operation to a key's value.

	{
	 type: "apply",
	 key: ...a key name...,
	 package_name: ...package name that defines other operation...,
	 op: ...operation data...,
	}
	
   */
   
var deepEqual = require("deep-equal");

// constructors

exports.NO_OP = function() {
	return { "type": "no-op" };
}

exports.PROP = function (old_key, new_key, old_value, new_value) {
	return {
		type: "prop",
		old_key: old_key,
		new_key: new_key,
		old_value: old_value,
		new_value: new_value
	};
}

exports.PUT = function (key, value) {
	return exports.PROP(null, key, null, value);
}

exports.DEL = function (key, old_value) {
	return exports.PROP(key, null, old_value, null);
}

exports.REN = function (old_key, new_key) {
	return exports.PROP(old_key, new_key, null, null);
}

exports.APPLY = function (key, package_name, op) {
	return { // don't simplify here -- breaks tests
		type: "apply",
		key: key,
		package_name: package_name,
		op: op
	};
}

exports.access = function(path, package_name, op_name /*, op_args */) {
	var op_args = [];
	for (var i = 3; i < arguments.length; i++)
		op_args.push(arguments[i]);
	
	var seqs = require(__dirname + '/sequences.js');
	var lib = require(package_name);
	var op = lib[op_name].apply(null, op_args);
	var op_pkg = package_name;
	for (var i = path.length-1; i >= 0; i--) {
		if (typeof path[i] == 'string') {
			op =  exports.APPLY(path[i], op_pkg, op);
			op_pkg = __dirname + '/objects.js';
		} else {
			op =  seqs.APPLY(path[i], op_pkg, op);
			op_pkg = __dirname + '/sequences.js';
		}
	}
	return op;
}

// operations

exports.apply = function (op, value) {
	/* Applies the operation to a value. */
		
	if (op.type == "no-op")
		return value;

	if (op.type == "prop") {
		if (!op.old_key)
			value[op.new_key] = op.new_value;
		else if (!op.new_key)
			delete value[op.old_key];
		else {
			var v = value[op.old_key];
			delete value[op.old_key];
			value[op.new_key] = v;
		}
		return value;
	}
	
	if (op.type == "apply") {
		// modifies value in-place
		var lib = require(op.package_name);
		value[op.key] = lib.apply(op.op, value[op.key]);
		return value;
	}
}

exports.simplify = function (op) {
	/* Returns a new atomic operation that is a simpler version
		of another operation. For instance, simplify on a replace
		operation that replaces one value with the same value
		returns a no-op operation. If there's no simpler operation,
		returns the op unchanged. */
		
	if (op.type == "prop" && op.old_key == op.new_key && deepEqual(op.old_value, op.new_value))
		return exports.NO_OP();
		
	if (op.type == "apply") {
		var lib = require(op.package_name);
		var op2 = lib.simplify(op.op);
		if (op2.type == "no-op")
			return exports.NO_OP();
	}
	
	return op; // no simplification is possible
}

exports.invert = function (op) {
	/* Returns a new atomic operation that is the inverse of op */
		
	if (op.type == "prop")
		return exports.PROP(op.new_key, op.old_key, op.new_value, op.old_value);
	
	if (op.type == "apply") {
		var lib = require(op.package_name);
		return exports.APPLY(op.key, op.package_name, lib.invert(op.op));
	}
}

exports.atomic_compose = function (a, b) {
	/* Creates a new atomic operation that combines the operations a
		and b, if an atomic operation is possible, otherwise returns
		null. */

	a = exports.simplify(a);
	b = exports.simplify(b);

	if (a.type == "no-op")
		return b;

	if (b.type == "no-op")
		return a;
	
	if (a.type == "prop" && b.type == "prop" && a.new_key == b.old_key) {
		if (a.old_key == b.new_key && deepEqual(a.old_value, b.new_value))
			return exports.NO_OP()
		if (a.old_key != b.new_key && !deepEqual(a.old_value, b.new_value))
			return null; // prevent a rename and a change in value in the same operation
		return exports.PROP(a.old_key, b.new_key, a.old_value, b.new_value);
	}
		
	if (a.type == "apply" && b.type == "apply" && a.key == b.key && a.package_name == b.package_name) {
		var lib = require(a.package_name);
		var op2 = lib.atomic_compose(a.op, b.op);
		if (op2)
			return exports.APPLY(a.key, a.package_name, op2);
	}
	
	return null; // no atomic composition is possible
}
	
exports.atomic_rebase = function (a, b) {
	/* Transforms b, an operation that was applied simultaneously as a,
		so that it can be composed with a. rebase(a, b) == rebase(b, a).
		If no rebase is possible (i.e. a conflict) then null is returned.
		Or an array of operations can be returned if the rebase involves
		multiple steps.*/

	a = exports.simplify(a);
	b = exports.simplify(b);
	
	if (a.type == "no-op")
		return b;

	if (b.type == "no-op")
		return b;
	
	if (a.type == "prop" && b.type == "prop") {
		if (a.old_key == b.old_key && a.new_key == b.new_key) {
			// both deleted, or both changed the value to the same thing, or both inserted the same thing
			if (deepEqual(a.new_value, b.new_value))
				return exports.NO_OP();
			
			// values were changed differently
			else
				return null;
		}
		
		// rename to different things (conflict)
		if (a.old_key == b.old_key && a.new_key != b.new_key && a.old_key != null)
			return null;

		// rename different things to the same key (conflict)
		if (a.old_key != b.old_key && a.new_key == b.new_key && a.new_key != null)
			return null;
		
		// otherwise, the keys are not related so b isn't changed
		return b;
	}
	
	if (a.type == "apply" && b.type == "apply" && a.package_name == b.package_name) {
		var lib = require(a.package_name);
		var op2 = lib.atomic_rebase(a.op, b.op);
		if (op2)
			return exports.APPLY(a.key, a.package_name, op2);
	}

	if (a.type == "prop" && b.type == "apply") {
		// a operated on some other key that doesn't affect b
		if (a.old_key != b.key)
			return b;
		
		// a renamed the key b was working on, so revise b to use the new name
		if (a.old_key != a.new_key)
			return exports.APPLY(a.new_key, b.package_name, b.op);
	}
	
	if (a.type == "apply" && b.type == "prop") {
		// a modified a different key than prop, so b is unaffected
		if (a.key != b.old_key)
			return b;
		
		// b renamed the key, so continue to apply the rename after a
		if (b.old_key != b.new_key)
			return b
	}
	
	// Return null indicating this is an unresolvable conflict.
	return null;
}

