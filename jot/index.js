/* Base functions for the operational transformation library. */

var util = require('util');
var shallow_clone = require('shallow-clone');

// Must define this ahead of any imports below so that this constructor
// is available to the operation classes.
exports.Operation = function() {
}
exports.add_op = function(constructor, module, opname) {
	// utility.
	constructor.prototype.type = [module.module_name, opname];
	if (!('op_map' in module))
		module['op_map'] = { };
	module['op_map'][opname] = constructor;
}


// Expose the operation classes through the jot library.
var values = require("./values.js");
var sequences = require("./sequences.js");
var objects = require("./objects.js");
var lists = require("./lists.js");
var copies = require("./copies.js");

exports.NO_OP = values.NO_OP;
exports.SET = values.SET;
exports.MATH = values.MATH;
exports.PATCH = sequences.PATCH;
exports.SPLICE = sequences.SPLICE;
exports.ATINDEX = sequences.ATINDEX;
exports.MAP = sequences.MAP;
exports.PUT = objects.PUT;
exports.REM = objects.REM;
exports.APPLY = objects.APPLY;
exports.LIST = lists.LIST;
exports.COPY = copies.COPY;

// Expose the diff function too.
exports.diff = require('./diff.js').diff;

/////////////////////////////////////////////////////////////////////

exports.Operation.prototype.isNoOp = function() {
	return this instanceof values.NO_OP;
}

exports.Operation.prototype.visit = function(visitor) {
	// A simple visitor paradigm. Replace this operation instance itself
	// and any operation within it with the value returned by calling
	// visitor on itself, or if the visitor returns anything falsey
	// (probably undefined) then return the operation unchanged.
	return visitor(this) || this;
}

exports.Operation.prototype.toJSON = function(__key__, protocol_version) {
	// The first argument __key__ is used when this function is called by
	// JSON.stringify. For reasons unclear, we get the name of the property
	// that this object is stored in in its parent? Doesn't matter. We
	// leave a slot so that this function can be correctly called by JSON.
	// stringify, but we don't use it.

	// The return value.
	var repr = { };

	// If protocol_version is unspecified, then this is a top-level call.
	// Choose the latest (and only) protocol version and write it into
	// the output data structure, and pass it down recursively.
	//
	// If protocol_version was specified, this is a recursive call and
	// we don't need to write it out. Sanity check it's a valid value.
	if (typeof protocol_version == "undefined") {
		protocol_version = 1;
		repr["_ver"] = protocol_version;
	} else {
		if (protocol_version !== 1) throw new Error("Invalid protocol version: " + protocol_version);
	}

	// Set the module and operation name.
	repr['_type'] = this.type[0] + "." + this.type[1];

	// Call the operation's toJSON function.
	this.internalToJSON(repr, protocol_version);

	// Return.
	return repr;
}

exports.opFromJSON = function(obj, protocol_version, op_map) {
	// Sanity check.
	if (typeof obj !== "object") throw new Error("Not an operation.");

	// If protocol_version is unspecified, then this is a top-level call.
	// The version must be encoded in the object, and we pass it down
	// recursively.
	//
	// If protocol_version is specified, this is a recursive call and
	// we don't need to read it from the object.
	if (typeof protocol_version === "undefined") {
		protocol_version = obj['_ver'];
		if (protocol_version !== 1)
			throw new Error("JOT serialized data structure is missing protocol version and one wasn't provided as an argument.");
	} else {
		if (protocol_version !== 1)
			throw new Error("Invalid protocol version provided: " + protocol_version)
		if ("_ver" in obj)
			throw new Error("JOT serialized data structure should not have protocol version because it was provided as an argument.");
	}

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
		extend_op_map(lists);
		extend_op_map(copies);
	}

	// Get the operation class.
	if (typeof obj['_type'] !== "string") throw new Error("Not an operation.");
	var dottedclassparts = obj._type.split(/\./g, 2);
	if (dottedclassparts.length != 2) throw new Error("Not an operation.");
	var clazz = op_map[dottedclassparts[0]][dottedclassparts[1]];

	// Call the deserializer function on the class.
	return clazz.internalFromJSON(obj, protocol_version, op_map);
}

exports.Operation.prototype.serialize = function() {
	// JSON.stringify will use the object's toJSON method
	// implicitly.
	return JSON.stringify(this);
}
exports.deserialize = function(op_json) {
	return exports.opFromJSON(JSON.parse(op_json));
}

exports.Operation.prototype.compose = function(other, no_list) {
	if (!(other instanceof exports.Operation))
		throw new Error("Argument must be an operation.");

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

	if (no_list)
		return null;

	// Fall back to creating a LIST. Call simplify() to weed out
	// anything equivalent to a NO_OP.
	return new lists.LIST([this, other]).simplify();
}

exports.Operation.prototype.rebase = function(other, conflictless, debug) {
	/* Transforms this operation so that it can be composed *after* the other
	   operation to yield the same logical effect as if it had been executed
	   in parallel (rather than in sequence). Returns null on conflict.
	   If conflictless is true, tries extra hard to resolve a conflict in a
	   sensible way but possibly by killing one operation or the other.
	   Returns the rebased version of this. */

	// Run the rebase operation in a's prototype. If a doesn't define it,
	// check b's prototype. If neither define a rebase operation, then there
	// is a conflict.
	for (var i = 0; i < ((this.rebase_functions!=null) ? this.rebase_functions.length : 0); i++) {
		if (other instanceof this.rebase_functions[i][0]) {
			var r = this.rebase_functions[i][1].call(this, other, conflictless);
			if (r != null && r[0] != null) {
				if (debug) debug("rebase", this, "on", other, (conflictless ? "conflictless" : ""), ("document" in conflictless ? JSON.stringify(conflictless.document) : ""), "=>", r[0]);
				return r[0];
			}
		}
	}

	// Either a didn't define a rebase function for b's data type, or else
	// it returned null above. We can try running the same logic backwards on b.
	for (var i = 0; i < ((other.rebase_functions!=null) ? other.rebase_functions.length : 0); i++) {
		if (this instanceof other.rebase_functions[i][0]) {
			var r = other.rebase_functions[i][1].call(other, this, conflictless);
			if (r != null && r[1] != null) {
				if (debug) debug("rebase", this, "on", other, (conflictless ? "conflictless" : ""), ("document" in conflictless ? JSON.stringify(conflictless.document) : ""), "=>", r[0]);
				return r[1];
			}
		}
	}

	// Everything can rebase against a LIST and vice versa.
	// This has higher precedence than the this instanceof SET fallback.
	if (this instanceof lists.LIST || other instanceof lists.LIST) {
		var ret = lists.rebase(other, this, conflictless, debug);
		if (debug) debug("rebase", this, "on", other, "=>", ret);
		return ret;
	}

	if (conflictless) {
		// Everything can rebase against a COPY in conflictless mode when
		// a previous document content is given --- the document is needed
		// to parse a JSONPointer and know whether the path components are
		// for objects or arrays. If this's operation affects a path that
		// is copied, the operation is cloned to the target path.
		// This has higher precedence than the this instanceof SET fallback.
		if (other instanceof copies.COPY && typeof conflictless.document != "undefined")
			return other.clone_operation(this, conflictless.document);

		// Everything can rebase against a SET in a conflictless way.
		// Note that to resolve ties, SET rebased against SET is handled
		// in SET's rebase_functions.

		// The SET always wins!
		if (this instanceof values.SET) {
			if (debug) debug("rebase", this, "on", other, "=>", this);
			return this;
		}
		if (other instanceof values.SET) {
			if (debug) debug("rebase", this, "on", other, "=>", new values.NO_OP());
			return new values.NO_OP();
		}

		// If conflictless rebase would fail, raise an error.
		throw new Error("Rebase failed between " + this.inspect() + " and " + other.inspect() + ".");
	}

	return null;
}

exports.createRandomValue = function(depth) {
	var values = [];

	// null
	values.push(null);

	// boolean
	values.push(false);
	values.push(true);

	// number (integer, float)
	values.push(1000 * Math.floor(Math.random() - .5));
	values.push(Math.random() - .5);
	values.push(1000 * (Math.random() - .5));

	// string
	values.push(Math.random().toString(36).substring(7));

	// array (make nesting exponentially less likely at each level of recursion)
	if (Math.random() < Math.exp(-(depth||0))) {
		var n = Math.floor(Math.exp(3*Math.random()))-1;
		var array = [];
		while (array.length < n)
			array.push(exports.createRandomValue((depth||0)+1));
		values.push(array);
	}

	// object (make nesting exponentially less likely at each level of recursion)
	if (Math.random() < Math.exp(-(depth||0))) {
		var n = Math.floor(Math.exp(2.5*Math.random()))-1;
		var obj = { };
		while (Object.keys(obj).length < n)
			obj[Math.random().toString(36).substring(7)] = exports.createRandomValue((depth||0)+1);
		values.push(obj);
	}

	return values[Math.floor(Math.random() * values.length)];
}

exports.createRandomOp = function(doc, context) {
	// Creates a random operation that could apply to doc. Just
	// chain off to the modules that can handle the data type.

	var modules = [];

	// The values module can handle any data type.
	modules.push(values);

	// sequences applies to strings and arrays.
	if (typeof doc === "string" || Array.isArray(doc)) {
		modules.push(sequences);
		//modules.push(copies);
	}

	// objects applies to objects (but not Array objects or null)
	else if (typeof doc === "object" && doc !== null) {
		modules.push(objects);
		//modules.push(copies);
	}

	// the lists module only defines LIST which can also
	// be applied to any data type but gives us stack
	// overflows
	//modules.push(lists);

	return modules[Math.floor(Math.random() * modules.length)]
		.createRandomOp(doc, context);
}

exports.createRandomOpSequence = function(value, count) {
	// Create a random sequence of operations starting with a given value.
	var ops = [];
	while (ops.length < count) {
		// Create random operation.
		var op = exports.createRandomOp(value);

		// Make the result of applying the op the initial value
		// for the next operation. createRandomOp sometimes returns
		// invalid operations, in which case we'll try again.
		// TODO: Make createRandomOp always return a valid operation
		// and remove the try block.
		try {
			value = op.apply(value);
		} catch (e) {
			continue; // retry
		}

		ops.push(op);
	}
	return new lists.LIST(ops);
}

exports.type_name = function(x) {
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
	if (exports.type_name(a) != exports.type_name(b)) {
		return exports.cmp(exports.type_name(a), exports.type_name(b));
	
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

