/* Base functions for the operational transformation library. */

var util = require('util');

// Must define this ahead of any imports below so that this constructor
// is available to the operation classes.
exports.BaseOperation = function() {
}
exports.add_op = function(constructor, module, opname, constructor_args) {
	// utility.
	constructor.prototype.type = [module.module_name, opname];
	constructor.prototype.constructor_args = constructor_args;
	if (!('op_map' in module))
		module['op_map'] = { };
	module['op_map'][opname] = constructor;
}


// Imports.
var values = require("./values.js");
var sequences = require("./sequences.js");
var objects = require("./objects.js");
var meta = require("./meta.js");

// Define aliases.
function new_op(op_class, args) {
	var op = Object.create(op_class.prototype);
	op_class.apply(op, args);
	return op;
}
exports.NO_OP = function() { return new_op(values.NO_OP, arguments) };
exports.SET = function() { return new_op(values.SET, arguments) };
exports.MATH = function() { return new_op(values.MATH, arguments) };
exports.PATCH = function() { return new_op(sequences.PATCH, arguments) };
exports.SPLICE = function() { return new_op(sequences.SPLICE, arguments) };
exports.MAP = function() { return new_op(sequences.MAP, arguments) };
exports.PUT = function() { return new_op(objects.PUT, arguments) };
exports.REN = function() { return new_op(objects.REN, arguments) };
exports.REM = function() { return new_op(objects.REM, arguments) };
exports.LIST = function() { return new_op(meta.LIST, arguments) };
exports.APPLY = function(pos_or_key) {
	if (typeof pos_or_key == "number")
		return new_op(sequences.APPLY, arguments);
	if (typeof pos_or_key == "string")
		return new_op(objects.APPLY, arguments);
	throw "Invalid Argument";
};
exports.UNAPPLY = function(op, pos_or_key) {
	if (typeof pos_or_key == "number"
		&& op instanceof sequences.APPLY
		&& op.pos == pos_or_key)
		return op.op;
	if (typeof pos_or_key == "string"
		&& op instanceof objects.APPLY
		&& pos_or_key in op.ops)
		return op.ops[pos_or_key];
	if (op instanceof meta.LIST)
		return new meta.LIST(op.ops.map(function(op) {
			return exports.UNAPPLY(op, pos_or_key)
		}));
	return new values.NO_OP();
};

exports.diff = require('./diff.js').diff;

/////////////////////////////////////////////////////////////////////

exports.BaseOperation.prototype.isNoOp = function() {
	return this instanceof values.NO_OP;
}

exports.BaseOperation.prototype.toJSON = function() {
	var repr = { };
	repr['_type'] = this.type[0] + "." + this.type[1];
	var keys = Object.keys(this);
	for (var i = 0; i < keys.length; i++) {
		var value = this[keys[i]];
		var v;
		if (value instanceof exports.BaseOperation) {
			v = value.toJSON();
        }
		else if (value === objects.MISSING) {
			repr[keys[i] + "_missing"] = true;
			continue;
        }
        else if (keys[i] === 'ops' && Array.isArray(value)) {
            v = value.map(function(ki) {
                return ki.toJSON();
            });
        }
        else if (keys[i] === 'ops' && typeof value === "object") {
            v = { };
            for (var key in value)
            	v[key] = value[key].toJSON();
        }
		else if (typeof value !== 'undefined') {
			v = value;
        }
		else {
			continue;
        }
		repr[keys[i]] = v
	}
	return repr;
}

exports.opFromJSON = function(obj, op_map) {
	// Create a default mapping from encoded types to constructors
	// allowing all operations to be deserialized.
	if (!op_map) {
		op_map = { };

		function extend_op_map(module) {
			op_map[module.module_name] = { };
			for (var key in module.op_map)
				op_map[module.module_name][key] = module.op_map[key];
		}

		extend_op_map(values);
		extend_op_map(sequences);
		extend_op_map(objects);
		extend_op_map(meta);
	}

	// Fetch the constructor.
	if (typeof obj['_type'] !== "string") throw "Not an operation.";
	var dottedclassparts = obj._type.split(/\./g, 2);
	if (dottedclassparts.length != 2) throw "Not an operation.";
	var constructor = op_map[dottedclassparts[0]][dottedclassparts[1]];

	// Construct the constructor's arguments by using the class's
	// constructor_args static field that we require op classes to have.
	var args = constructor.prototype.constructor_args.map(function(item) {
		var value = obj[item];

		if (obj[item + "_missing"]) {
			// Put "missing" values back.
			value = objects.MISSING;

		} if (value !== null && typeof value == 'object' && '_type' in value) {
			// Value is an operation.
			return exports.opFromJSON(value);
        
        } else if (item === 'ops' && Array.isArray(value)) {
        	// Value is an array of operations.
            value = value.map(function(op) {
                return exports.opFromJSON(op);
            });

        } else if (item === 'ops' && typeof value === "object") {
        	// Value is a mapping array of operations.
        	var newvalue = { };
        	for (var key in value)
        		newvalue[key] = exports.opFromJSON(value[key]);
        	value = newvalue;
        
        } else {
        	// Value is just a raw JSON value.
        }
		return value;
	});
	
	var op = Object.create(constructor.prototype);
	constructor.apply(op, args);
	return op;
}

exports.BaseOperation.prototype.serialize = function() {
	return JSON.stringify(this.toJSON());
}
exports.deserialize = function(op_json) {
	return exports.opFromJSON(JSON.parse(op_json));
}

exports.BaseOperation.prototype.compose = function(other) {
	// A NO_OP composed with anything just gives the other thing.
	if (this instanceof values.NO_OP)
		return other;

	// Composing with a NO_OP does nothing.
	if (other instanceof values.NO_OP)
		return this;

	// Composing with a SET obliterates this operation.
	if (other instanceof values.SET)
		return other;

	// Attempt an atomic composition if this defines the method.
	if (this.atomic_compose) {
		var op = this.atomic_compose(other);
		if (op != null)
			return op;
	}

	// Fall back to creating a LIST.
	return new meta.LIST([this, other]);
}

exports.BaseOperation.prototype.rebase = function(other, conflictless) {
	/* Transforms this operation so that it can be composed *after* the other
	   operation to yield the same logical effect as if it had been executed
	   in parallel (rather than in sequence). Returns null on conflict.
	   If conflictless is true, tries extra hard to resolve a conflict in a
	   sensible way but possibly by killing one operation or the other.
	   Returns the rebased version of this. */

	// Rebasing a NO_OP does nothing.
	if (this instanceof values.NO_OP)
		return this;

	// Rebasing on NO_OP leaves the operation unchanged.
	if (other instanceof values.NO_OP)
		return this;

	// Run the rebase operation in a's prototype. If a doesn't define it,
	// check b's prototype. If neither define a rebase operation, then there
	// is a conflict.
	for (var i = 0; i < ((this.rebase_functions!=null) ? this.rebase_functions.length : 0); i++) {
		if (other instanceof this.rebase_functions[i][0]) {
			var r = this.rebase_functions[i][1].call(this, other, conflictless);
			if (r != null && r[0] != null) return r[0];
		}
	}

	// Either a didn't define a rebase function for b's data type, or else
	// it returned null above. We can try running the same logic backwards on b.
	for (var i = 0; i < ((other.rebase_functions!=null) ? other.rebase_functions.length : 0); i++) {
		if (this instanceof other.rebase_functions[i][0]) {
			var r = other.rebase_functions[i][1].call(other, this, conflictless);
			if (r != null && r[1] != null) return r[1];
		}
	}

	// Everything case rebase against a LIST and vice versa.
	// This has higher precedence than the SET fallback.
	if (this instanceof meta.LIST || other instanceof meta.LIST)
		return meta.rebase(other, this, conflictless);

	// Everything can rebase against a SET in a conflictless way.
	if (conflictless) {
		// The SET always wins!
		if (this instanceof values.SET)
			return this;
		if (other instanceof values.SET)
			return new values.NO_OP();
	}

	return null;
}

exports.createRandomOp = function(doc, context) {
	// Creates a random operation that could apply to doc. Just
	// chain off to the modules that can handle the data type.

	var modules = [];

	// The values module can handle any data type.
	modules.push(values);

	// sequences applies to strings and arrays.
	if (typeof doc === "string" || Array.isArray(doc))
		modules.push(sequences);

	// objects applies to objects (but not Array objects or null)
	else if (typeof doc === "object" && doc !== null)
		modules.push(objects);

	// the meta module only defines LIST which can also
	// be applied to any data type but gives us stack
	// overflows
	//modules.push(meta);

	return modules[Math.floor(Math.random() * modules.length)]
		.createRandomOp(doc, context);
}

function type_name(x) {
	if (typeof x == 'object') {
		if (Array.isArray(x))
			return 'array';
		return 'object';
	}
	return typeof x;
}

// Utility function to compare values for the purposes of
// setting sort orders that resolve conflicts.
exports.cmp = function(a, b) {
	// For objects.MISSING, make sure we try object identity.
	if (a === b)
		return 0;

	// objects.MISSING has a lower sort order so that it tends to get clobbered.
	if (a === objects.MISSING)
		return -1;
	if (b === objects.MISSING)
		return 1;

	// Comparing strings to numbers, numbers to objects, etc.
	// just sort based on the type name.
	if (type_name(a) != type_name(b)) {
		return exports.cmp(type_name(a), type_name(b));
	
	} else if (typeof a == "number") {
		if (a < b)
			return -1;
		if (a > b)
			return 1;
		return 0;
		
	} else if (typeof a == "string") {
		return a.localeCompare(b);
	
	} else if (Array.isArray(a)) {
		// First compare on length.
		var x = exports.cmp(a.length, b.length);
		if (x != 0) return x;

		// Same length, compare on values.
		for (var i = 0; i < a.length; i++) {
			x = exports.cmp(a[i], b[i]);
			if (x != 0) return x;
		}

		return 0;
	}

	// Compare on strings.
	// TODO: Find a better way to sort objects.
	return JSON.stringify(a).localeCompare(JSON.stringify(b));
}

