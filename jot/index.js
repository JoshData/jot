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
exports.SPLICE = function() { return new_op(sequences.SPLICE, arguments) };
exports.INS = function() { return new_op(sequences.INS, arguments) };
exports.DEL = function() { return new_op(sequences.DEL, arguments) };
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

exports.diff = require('./diff.js').diff;

/////////////////////////////////////////////////////////////////////

exports.BaseOperation.prototype.isNoOp = function() {
	return this instanceof values.NO_OP;
}

exports.BaseOperation.prototype.inspect = function(depth) {
	var repr = [ ];
	var keys = Object.keys(this);
	for (var i = 0; i < keys.length; i++) {
		var v;
		if (this[keys[i]] instanceof exports.BaseOperation)
			v = this[keys[i]].inspect(depth-1);
		else if (Array.isArray(this[keys[i]]))
			v = "[" + this[keys[i]].map(function(item) {
				return item.inspect ? item.inspect() : util.format("%j", item)
			}) + "]";
		else if (typeof this[keys[i]] != 'undefined')
			v = util.format("%j", this[keys[i]]);
		else
			continue;
		repr.push(keys[i] + ":" + v);
	}
	return util.format("<%s.%s {%s}>",
		this.type[0],
		this.type[1],
		repr.join(", "));
}

exports.BaseOperation.prototype.toJsonableObject = function() {
	var repr = { };
	repr['_type'] = { 'module': this.type[0], 'class': this.type[1] };
	var keys = Object.keys(this);
	for (var i = 0; i < keys.length; i++) {
		var v;
		if (this[keys[i]] instanceof exports.BaseOperation) {
			v = this[keys[i]].toJsonableObject();
        }
        else if (keys[i] === 'ops' && Array.isArray(this[keys[i]])) {
            v = this[keys[i]].map(function(ki) {
                return ki.toJsonableObject();
            });
        }
		else if (typeof this[keys[i]] !== 'undefined') {
			v = this[keys[i]];
        }
		else {
			continue;
        }
		repr[keys[i]] = v
	}
	return repr;
}

exports.opFromJsonableObject = function(obj, op_map) {
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

	// Sanity check.
	if (!('_type' in obj)) throw "Invalid argument: Not an operation.";

	// Reconstruct.
	var constructor = op_map[obj._type.module][obj._type.class];
	var args = constructor.prototype.constructor_args.map(function(item) {
		if (obj[item] !== null && typeof obj[item] == 'object' && '_type' in obj[item]) {
			return exports.opFromJsonableObject(obj[item]);
        } else if (item === 'ops' && Array.isArray(obj[item])) {
            obj[item] = obj[item].map(function(op) {
                return exports.opFromJsonableObject(op);
            });
        }
		return obj[item];
	});
	var op = Object.create(constructor.prototype);
	constructor.apply(op, args);
	return op;
}

exports.BaseOperation.prototype.serialize = function() {
	return JSON.stringify(this.toJsonableObject());
}
exports.deserialize = function(op_json) {
	return exports.opFromJsonableObject(JSON.parse(op_json));
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

	// Everything case rebase against a LIST.
	if (other instanceof meta.LIST) {
		return meta.rebase(other, this, conflictless);
	}

	return null;
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

