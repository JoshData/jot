/* An operational transformation library for objects
   (associative arrays).
   
   Two operations are provided:
   
   PROP(old_key, new_key, old_value, new_value)

    Creates, deletes, or renames a property.

    Shortcuts are provided:
    
    PUT(key, value)
    
      (Equivalent to PROP(null, key, null, value).)

    REM(key, old_value)
    
      (Equivalent to PROP(key, null, old_value, null).)

    REN(old_key, new_key)
    
      (Equivalent to PROP(old_key, new_key, null, null).)
      
    It is not possible to rename a key and change its value
    in the same operation, or to change a value on an existing
    key.
      
	The PROP operation has the following internal form:
	
	{
	 module_name: "objects.js",
	 type: "prop",
	 old_key: ...a key name, or null to create a key...,
	 new_key: ...a new key name, or null to delete a key...,
	 old_value: ...the existing value of the key; null when creating or renaming a key...,
	 new_value: ...the new value for the key; null when deleting or renaming a key...,
	}
   
   APPLY(key, operation)

    Applies another sort of operation to a property's value. Use any
    operation defined in any of the modules depending on the data type
    of the property. For instance, the operations in values.js can be
    applied to any property. The operations in sequences.js can be used
    if the property's value is a string or array. And the operations in
    this module can be used if the value is another object.
    
    Example:
    
    To replace the value of a property with a new value:
    
      APPLY("key1", values.SET("old_value", "new_value"))
      
    You can also use the 'access' helper method to construct recursive
    APPLY operations:
    
      access(["key1", subkey1"], values.SET("old_value", "new_value"))
      or
      access(["key1", subkey1"], "values.js", "SET", "old_value", "new_value")
      
      is equivalent to
      
      APPLY("key1", APPLY("subkey1", values.SET("old_value", "new_value")))

	The APPLY operation has the following internal form:

	{
	 module_name: "objects.js",
	 type: "apply",
	 key: ...a key name...,
	 op: ...operation from another module...,
	}
	
   */
   
var jot_platform = require(__dirname + "/platform.js");
var deepEqual = require("deep-equal");

// constructors

exports.NO_OP = function() {
	return { "type": "no-op" }; // module_name is not required on no-ops
}

exports.PROP = function (old_key, new_key, old_value, new_value) {
	if (old_key == new_key && old_ney != null && old_value != new_value) throw "invalid arguments";
	return {
		module_name: "objects.js",
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

exports.REM = function (key, old_value) {
	return exports.PROP(key, null, old_value, null);
}

exports.REN = function (old_key, new_key) {
	return exports.PROP(old_key, new_key, null, null);
}

exports.APPLY = function (key, op) {
	if (op.type == "no-op") return op; // don't embed because it never knows its package name
	return { // don't simplify here -- breaks tests
		module_name: "objects.js",
		type: "apply",
		key: key,
		op: op
	};
}

exports.access = function(path, module_name, op_name /*, op_args */) {
	// also takes an op directly passed as the second argument
	var op;
	if (module_name instanceof Object) {
		op = module_name;
	} else {
		var op_args = [];
		for (var i = 3; i < arguments.length; i++)
			op_args.push(arguments[i]);
		
		var lib = jot_platform.load_module(module_name);
		if (!(op_name in lib)) throw "Invalid operatio name " + op_name + " in library " + module_name + ".";
		op = lib[op_name].apply(null, op_args);
	}
	
	var seqs = jot_platform.load_module('sequences.js');
	for (var i = path.length-1; i >= 0; i--) {
		if (typeof path[i] == 'string') {
			op = exports.APPLY(path[i], op);
		} else {
			op = seqs.APPLY(path[i], op);
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
		if (op.old_key == null)
			value[op.new_key] = op.new_value;
		else if (op.new_key == null)
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
		var lib = jot_platform.load_module(op.op.module_name);
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
		var lib = jot_platform.load_module(op.op.module_name);
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
		var lib = jot_platform.load_module(op.op.module_name);
		return exports.APPLY(op.key, lib.invert(op.op));
	}
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
	
	if (a.type == "prop" && b.type == "prop" && a.new_key == b.old_key) {
		if (a.old_key == b.new_key && deepEqual(a.old_value, b.new_value))
			return exports.NO_OP()
		if (a.old_key != b.new_key && !deepEqual(a.old_value, b.new_value))
			return null; // prevent a rename and a change in value in the same operation
		return exports.PROP(a.old_key, b.new_key, a.old_value, b.new_value);
	}
		
	if (a.type == "apply" && b.type == "apply" && a.key == b.key && a.op.module_name == b.op.module_name) {
		var lib = jot_platform.load_module(a.op.module_name);
		var op2 = lib.compose(a.op, b.op);
		if (op2)
			return exports.APPLY(a.key, op2);
	}
	
	return null; // no composition is possible
}
	
exports.rebase = function (a, b) {
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
	
	if (a.type == "apply" && b.type == "apply" && a.op.module_name == b.op.module_name) {
		if (a.key != b.key) {
			// Changes to different keys are independent.
			return b;
		}

		var lib = jot_platform.load_module(a.op.module_name);
		var op2 = lib.rebase(a.op, b.op);
		if (op2)
			return exports.APPLY(a.key, op2);
	}

	if (a.type == "prop" && b.type == "apply") {
		// a operated on some other key that doesn't affect b
		if (a.old_key != b.key)
			return b;
		
		// a renamed the key b was working on, so revise b to use the new name
		if (a.old_key != a.new_key)
			return exports.APPLY(a.new_key, b.op);
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

