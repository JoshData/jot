/* An operational transformation library for sequence-like objects,
   including strings and arrays.
   
   Three operations are provided:
   
   SPLICE(pos, old_value, new_value[, global_order])

    Replaces values in the sequence. Replace nothing with
    something to insert, or replace something with nothing to
    delete. pos is zero-based.
    
    Shortcuts are provided:
    
    INS(pos, new_value[, global_order])
    
       (Equivalent to SPLICE(pos, [], new_value, global_order)
       for arrays or SPLICE(pos, "", new_value, global_order)
       for strings.)
       
    DEL(pos, old_value[, global_order])
    
       (Equivalent to SPLICE(pos, old_value, [], global_order)
       for arrays or SPLICE(pos, old_value, "", global_order)
       for strings.)

	The SPLICE operation has the following internal form:
	
	{
	 module_name: "sequences.js",
	 type: "splice",
	 pos: ...an index...
	 old_value: ...a value...,
	 new_value: ...a value...,
	 global_order: ...a value...,
	}

   MOVE(pos, count, new_pos)

    Moves the subsequence starting at pos and count items long
    to a new location starting at index new_pos.  pos is zero-based.

	The MOVE operation has the following internal form:
	
	{
	 module_name: "sequences.js",
	 type: "move",
	 pos: ...an index...,
	 count: ...a length...,
	 new_pos: ...a new index...,
	}
   
   APPLY(pos, operation)

    Applies another sort of operation to a single element. For
    arrays only. Use any of the operations in values.js on an
    element. Or if the element is an array or object, use the
    operators in this module or the objects.js module, respectively.
    pos is zero-based.

    Example:
    
    To replace an element at index 2 with a new value:
    
      APPLY(2, values.SET("old_value", "new_value"))
      
	The APPLY operation has the following internal form:
	
	{
	 module_name: "sequences.js",
	 type: "apply",
	 pos: ...an index...,
	 op: ...an operation from another module...,
	}
	
   */
   
var jot_platform = require(__dirname + "/platform.js");
var deepEqual = require("deep-equal");

// constructors

exports.NO_OP = function() {
	return { "type": "no-op" }; // module_name is not required on no-ops
}

exports.SPLICE = function (pos, old_value, new_value, global_order) {
	if (pos == null || old_value == null || new_value == null) throw "Invalid Argument";
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
	if (pos == null || value == null) throw "Invalid Argument";
	// value.slice(0,0) is a shorthand for constructing an empty string or empty list, generically
	return exports.SPLICE(pos, value.slice(0,0), value, global_order);
}

exports.DEL = function (pos, old_value, global_order) {
	if (pos == null || old_value == null) throw "Invalid Argument";
	// value.slice(0,0) is a shorthand for constructing an empty string or empty list, generically
	return exports.SPLICE(pos, old_value, old_value.slice(0,0), global_order);
}

exports.MOVE = function (pos, count, new_pos) {
	if (pos == null || count == null || new_pos == null) throw "Invalid Argument";
	return { // don't simplify here -- breaks tests
		module_name: "sequences.js",
		type: "move",
		pos: pos,
		count: count,
		new_pos: new_pos
	};
}

exports.APPLY = function (pos, op) {
	if (pos == null || op == null) throw "Invalid Argument";
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

	if (a.type == 'splice' && b.type == 'splice' && a.global_order == b.global_order) {
		if (a.pos <= b.pos && b.pos+b.old_value.length <= a.pos+a.new_value.length) {
			// b replaces some of the values a inserts
			// also takes care of adjacent inserts
			return exports.SPLICE(a.pos,
				a.old_value,
				concat3(
					a.new_value.slice(0, b.pos-a.pos),
					b.new_value,
					a.new_value.slice(a.new_value.length + (b.pos+b.old_value.length)-(a.pos+a.new_value.length))
					) // in the final component, don't use a negative index because it might be zero (which is always treated as positive)
				);
		}
		if (b.pos <= a.pos && a.pos+a.new_value.length <= b.pos+b.old_value.length) {
			// b replaces all of the values a inserts
			// also takes care of adjacent deletes
			return exports.SPLICE(b.pos,
				concat3(
					b.old_value.slice(0, a.pos-b.pos),
					a.old_value,
					b.old_value.slice(b.old_value.length + (a.pos+a.new_value.length)-(b.pos+b.old_value.length))
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
		var op2 = lib.compose(a.op, b.op);
		if (op2)
			return exports.APPLY(a.pos, op2);
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
			return exports.SPLICE(b.pos+(a.new_value.length-a.old_value.length), b.old_value, b.new_value, b.global_order);
		
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
			var op2 = lib.rebase(a.op, b.op);
			if (op2)
				return exports.APPLY(b.pos, op2);
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
		return exports.APPLY(b.pos + (a.new_value.length-a.old_value.length), b.op);
	}
	
	if (a.type == "move" && b.type == "splice") {
		// operations intersect
		if (b.pos+b.old_value.length >= a.pos && b.pos < a.pos+a.count)
			return null;
		return exports.SPLICE(map_index(b.pos), b.old_value, b.new_value, b.global_index);
	}
	
	if (a.type == "move" && b.type == "apply")
		return exports.APPLY(map_index(b.pos), b.op);
	
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

// Use google-diff-match-patch to convert a diff between two
// strings into an array of SPLICE operations.
exports.from_diff = function(old_value, new_value, mode, global_order) {
	// Do a diff, which results in an array of operations of the form
	//  (op_type, op_data)
	// where
	//  op_type ==  0 => text same on both sides
	//  op_type == -1 => text deleted (op_data is deleted text)
	//  op_type == +1 => text inserted (op_data is inserted text)
	// If mode is undefined or 'chars', the diff is performed over
	// characters. Mode can also be 'words' or 'lines'.

	var diff_match_patch = require('googlediff');
	var base = require(__dirname + "/base.js");
	var dmp = new diff_match_patch();

	/////////////////////////////////////////////////////////////
	// adapted from diff_match_patch.prototype.diff_linesToChars_
	function diff_tokensToChars_(text1, text2, split_regex) {
	  var lineArray = [];
	  var lineHash = {};
	  lineArray[0] = '';
	  function munge(text) {
	    var chars = '';
	    var lineStart = 0;
	    var lineEnd = -1;
	    var lineArrayLength = lineArray.length;
	    while (lineEnd < text.length - 1) {
	      split_regex.lastIndex = lineStart;
	      var m = split_regex.exec(text);
	      if (m)
	      	lineEnd = m.index;
	      else
	        lineEnd = text.length - 1;
	      var line = text.substring(lineStart, lineEnd + 1);
	      lineStart = lineEnd + 1;
	      if (lineHash.hasOwnProperty ? lineHash.hasOwnProperty(line) :
	          (lineHash[line] !== undefined)) {
	        chars += String.fromCharCode(lineHash[line]);
	      } else {
	        chars += String.fromCharCode(lineArrayLength);
	        lineHash[line] = lineArrayLength;
	        lineArray[lineArrayLength++] = line;
	      }
	    }
	    return chars;
	  }

	  var chars1 = munge(text1);
	  var chars2 = munge(text2);
	  return {chars1: chars1, chars2: chars2, lineArray: lineArray};
	}
	/////////////////////////////////////////////////////////////

	// handle words or lines mode
	var token_state = null;
	if (mode == "words") token_state = diff_tokensToChars_(old_value, new_value, /[\W]/g);
	if (mode == "lines") token_state = diff_tokensToChars_(old_value, new_value, /\n/g);
	var t1 = old_value;
	var t2 = new_value;
	if (token_state) { t1 = token_state.chars1; t2 = token_state.chars2; }

	// perform the diff
	var d = dmp.diff_main(t1, t2);

	// handle words or lines mode
	if (token_state) dmp.diff_charsToLines_(d, token_state.lineArray);
	dmp.diff_cleanupSemantic(d);

	// turn the output into an array of DEL and INS operations
	var ret = [];
	var pos = 0;
	for (var i = 0; i < d.length; i++) {
		if (d[i][0] == 0) {
			pos += d[i][1].length;
		} else if (d[i][0] == -1) {
			ret.push(exports.DEL(pos, d[i][1], global_order));
			// don't increment pos because next operation sees the string with this part deleted
		} else if (d[i][0] == 1) {
			ret.push(exports.INS(pos, d[i][1], global_order));
			pos += d[i][1].length;
		}
	}
	return base.normalize_array(ret);
}

