/* An operational transform library for sequence-like objects,
   including strings and arrays.
   
   Three operations are provided:
   
   SPLICE

    Replacemes of values in the sequence. Replace nothing with
    something to insert, or replace something with nothing to
    delete.

	{
	 module_name: "sequences.js",
	 type: "splice",
	 pos: ...an index...
	 old_value: ...a value...,
	 new_value: ...a value...,
	 global_order: ...a value...,
	}
   
	Constructed with rep(pos, old_value, new_value, global_order).
	Shortcuts ins(pos, value) and del(pos, old_value) are provided.

   MOVE

    Moves a subsequence from one position to another.

	{
	 module_name: "sequences.js",
	 type: "move",
	 pos: ...an index...,
	 count: ...a length...,
	 new_pos: ...a new index...,
	}
   
   APPLY

    Applies another sort of operation to a single element. For
    arrays only.

	{
	 module_name: "sequences.js",
	 type: "apply",
	 pos: ...an index...,
	 op: ...operation data...,
	}
	
   */
   
var jot_platform = require(__dirname + "/platform.js");
var deepEqual = require("deep-equal");

// constructors

exports.NO_OP = function() {
	return { "type": "no-op" }; // module_name is not required on no-ops
}

exports.SPLICE = function (pos, old_value, new_value, global_order) {
	return { // don't simplify here -- breaks tests
		module_name: "sequences.js",
		type: "splice",
		pos: pos,
		old_value: old_value,
		new_value: new_value,
		global_order: global_order || null
	};
}

exports.INS = function (pos, value, global_order) {
	// value.slice(0,0) is a shorthand for constructing an empty string or empty list, generically
	return exports.SPLICE(pos, value.slice(0,0), value, global_order);
}

exports.DEL = function (pos, old_value, global_order) {
	// value.slice(0,0) is a shorthand for constructing an empty string or empty list, generically
	return exports.SPLICE(pos, old_value, old_value.slice(0,0), global_order);
}

exports.MOVE = function (pos, count, new_pos) {
	return { // don't simplify here -- breaks tests
		module_name: "sequences.js",
		type: "move",
		pos: pos,
		count: count,
		new_pos: new_pos
	};
}

exports.APPLY = function (pos, op) {
	if (op.type == "no-op") return op; // don't embed because it never knows its package name
	return { // don't simplify here -- breaks tests
		module_name: "sequences.js",
		type: "apply",
		pos: pos,
		op: op
	};
}

// utilities

function concat2(item1, item2) {
	if (item1 instanceof String)
		return item1 + item2;
	return item1.concat(item2);
}
function concat3(item1, item2, item3) {
	if (item1 instanceof String)
		return item1 + item2 + item3;
	return item1.concat(item2).concat(item3);
}
function concat4(item1, item2, item3, item4) {
	if (item1 instanceof String)
		return item1 + item2 + item3 + item4;
	return item1.concat(item2).concat(item3).concat(item4);
}

// operations

exports.apply = function (op, value) {
	/* Applies the operation to a value. */
		
	if (op.type == "no-op")
		return value;

	if (op.type == "splice") {
		return concat3(value.slice(0, op.pos), op.new_value, value.slice(op.pos+op.old_value.length));
	}

	if (op.type == "move") {
		if (op.pos < op.new_pos)
			return concat3(value.slice(0, op.pos), value.slice(op.pos+op.count, op.new_pos), value.slice(op.pos, op.pos+op.count) + value.slice(op.new_pos));
		else
			return concat3(value.slice(0, op.new_pos), value.slice(op.pos, op.pos+op.count), value.slice(op.new_pos, op.pos), value.slice(op.pos+op.count));
	}
	
	if (op.type == "apply") {
		// modifies value in-place
		var lib = jot_platform.load_module(op.op.module_name);
		value[op.pos] = lib.apply(op.op, value[op.pos]);
		return value;
	}
}

exports.simplify = function (op) {
	/* Returns a new atomic operation that is a simpler version
		of another operation. For instance, simplify on a replace
		operation that replaces one value with the same value
		returns a no-op operation. If there's no simpler operation,
		returns the op unchanged. */
		
	if (op.type == "splice" && deepEqual(op.old_value, op.new_value))
		return exports.NO_OP();
	
	if (op.type == "move" && op.pos == op.new_pos)
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
		
	if (op.type == "splice")
		return exports.SPLICE(op.pos, op.new_value, op.old_value, op.global_order);
	
	if (op.type == "move" && op.new_pos > op.pos)
		return exports.MOVE(op.new_pos - op.count, op.count, op.pos);
	if (op.type == "move")
		return exports.MOVE(op.new_pos, op.count, op.pos + op.count);

	if (op.type == "apply") {
		var lib = jot_platform.load_module(op.op.module_name);
		return exports.APPLY(op.pos, lib.invert(op.op));
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
	
	if (a.type == 'rep' && b.type == 'rep' && a.global_order == b.global_order) {
		if (a.pos <= b.pos && b.pos+b.old_value.length <= a.pos+a.new_value.length) {
			// b replaces some of the values a inserts
			// also takes care of adjacent inserts
			return exports.SPLICE(a.pos,
				a.old_value,
				concat3(
					a.new_value.slice(0, b.pos-a.pos),
					b.new_value,
					a.new_value.slice((b.pos+b.old_value.length)-(a.pos+a.new_value.length))
					)
				);
		}
		if (b.pos <= a.pos && a.pos+a.new_value.length <= b.pos+b.old_value.length) {
			// b replaces all of the values a inserts
			// also takes care of adjacent deletes
			return exports.SPLICE(b.pos,
				concat3(
					b.old_value.slice(0, a.pos-b.pos),
					a.old_value,
					b.old_value.slice((a.pos+a.new_value.length)-(b.pos+b.old_value.length))
					),
				b.new_value
				);
		}
		// TODO: a and b partially overlap with each other
	}
	
	if (a.type == "move" && b.type == "move" && a.new_pos == b.pos && a.count == b.count)
		return exports.MOVE(a.pos, b.new_pos, a.count)

	if (a.type == "apply" && b.type == "apply" && a.pos == b.pos && a.op.module_name == b.op.module_name) {
		var lib = jot_platform.load_module(a.op.module_name);
		var op2 = lib.atomic_compose(a.op, b.op);
		if (op2)
			return exports.APPLY(a.pos, a.op.module_name, op2);
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

	if (a.type == "splice" && b.type == "splice") {
		// Two insertions at the same location.
		if (a.pos == b.pos && a.old_value.length == 0 && b.old_value.length == 0) {
			// insert to the left
			if (b.global_order < a.global_order)
				return b;
			
			// insert to the right
			if (b.global_order > a.global_order)
				return exports.SPLICE(b.pos+a.new_value.length, b.old_value, b.new_value, b.global_order);
		}

		// b takes place before the range that a affects
		if (b.pos + b.old_value.length <= a.pos)
			return b;
		
		// b takes place after the range that a affects
		if (b.pos >= a.pos + a.old_value.length)
			return rep(b.pos+(a.new_value.length-a.old_value.length), b.old_value, b.new_value, b.global_order);
		
		if (a.pos <= b.pos && b.pos+b.old_value.length <= a.pos+a.old_value.length && b.global_order < a.global_order) {
			// b's replacement is entirely within a's replacement, and a takes precedence
			return exports.NO_OP()
		}
		if (b.pos <= a.pos && a.pos+a.new_value.length <= b.pos+b.old_value.length && b.global_order > a.global_order) {
			// b replaces more than a and b takes precedence; fix b so that it's old value is correct
			return exports.SPLICE(b.pos,
				concat3(
					b.old_value.slice(0, a.pos-b.pos),
					a.new_value,
					b.old_value.slice((a.pos+a.old_value.length)-(b.pos+b.old_value.length))
					),
				b.new_value
				);
		}
	}
	
	function map_index(pos) {
		if (pos >= a.pos && pos < a.pos+a.count) return (pos-a.pos) + a.new_pos; // within the move
		if (pos < a.pos && pos < a.new_pos) return pos; // before the move
		if (pos < a.pos) return pos + a.count; // a moved around by from right to left
		if (pos > a.pos && pos >= a.new_pos) return pos; // after the move
		if (pos > a.pos) return pos - a.count; // a moved around by from left to right
		return null; // ???
	}

	if (a.type == "move" && b.type == "move") {
		// moves intersect
		if (b.pos+b.count >= a.pos && b.pos < a.pos+a.count)
			return null;
		return exports.MOVE(map_index(b.pos), b.count, map_index(b.new_pos));
	}

	if (a.type == "apply" && b.type == "apply") {
		if (a.pos != b.pos)
			return b;
			
		if (a.op.module_name == b.op.module_name) {
			var lib = jot_platform.load_module(a.op.module_name);
			var op2 = lib.atomic_rebase(a.op, b.op);
			if (op2)
				return exports.APPLY(b.pos, b.op.module_name, op2);
		}
	}
	
	if (a.type == "splice" && b.type == "move") {
		// operations intersect
		if (b.pos+b.count >= a.pos && b.pos < a.pos+a.old_value.length)
			return null;
		if (b.pos < a.pos && b.new_pos < a.pos)
			return b; // not affected
		if (b.pos < a.pos && b.new_pos > a.pos)
			return exports.MOVE(b.pos, b.count, b.new_pos + (a.new_value.length-a.old_value.length));
		if (b.pos > a.pos && b.new_pos > a.pos)
			return exports.MOVE(b.pos + (a.new_value.length-a.old_value.length), b.count, b.new_pos + (a.new_value.length-a.old_value.length));
		if (b.pos > a.pos && b.new_pos < a.pos)
			return exports.MOVE(b.pos + (a.new_value.length-a.old_value.length), b.count, b.new_pos);
	}
	
	if (a.type == "splice" && b.type == "apply") {
		// operations intersect
		if (b.pos >= a.pos && b.pos < a.pos+a.old_value.length)
			return null;
		if (b.pos < a.pos)
			return b;
		return exports.APPLY(b.pos + (a.new_value.length-a.old_value.lenght), b.op.module_name, b.op);
	}
	
	if (a.type == "move" && b.type == "splice") {
		// operations intersect
		if (b.pos+b.old_value.length >= a.pos && b.pos < a.pos+a.count)
			return null;
		return exports.SPLICE(map_index(b.pos), b.old_value, b.new_value, b.global_index);
	}
	
	if (a.type == "move" && b.type == "apply")
		return exports.APPLY(map_index(b.pos), b.op.module_name, b.op);
	
	if (a.type == "apply" && b.type == "splice") {
		// operations intersect
		if (a.pos >= b.pos && a.pos < b.pos+b.old_value.length)
			return null;
		return b; // otherwise, no impact
	}

	if (a.type == "apply" && b.type == "move") {
		return b; // no impact
	}
	
	// Return null indicating this is an unresolvable conflict.
	return null;
}

