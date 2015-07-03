/* An operational transformation library for sequence-like objects:
   strings and arrays.
   
   Three operations are provided:
   
   new sequences.SPLICE(pos, old_value, new_value[, global_order])

    Replaces values in the sequence. Replace nothing with
    something to insert, or replace something with nothing to
    delete. pos is zero-based.
    
    Shortcuts are provided:
    
    new sequences.INS(pos, new_value[, global_order])
    
       (Equivalent to SPLICE(pos, [], new_value, global_order)
       for arrays or SPLICE(pos, "", new_value, global_order)
       for strings.)
       
    new sequences.DEL(pos, old_value[, global_order])
    
       (Equivalent to SPLICE(pos, old_value, [], global_order)
       for arrays or SPLICE(pos, old_value, "", global_order)
       for strings.)

   new sequences.MOVE(pos, count, new_pos)

    Moves the subsequence starting at pos and count items long
    to a new location starting at index new_pos. pos is zero-based.

   new sequences.APPLY(pos, operation)

    Applies another sort of operation to a single element. Use
    any of the operations in values.js on an element. Or if the
    element is an array or object, use the operators in this module
    or the objects.js module, respectively. pos is zero-based.

    Example:
    
    To replace an element at index 2 with a new value:
    
      APPLY(2, new values.SET("new_value"))
   */
   
var deepEqual = require("deep-equal");
var values = require("./values.js");
var LIST = require("./meta.js").LIST;

// utilities

function elem(seq, pos) {
	if (seq instanceof String)
		return seq.charAt(pos);
	return seq[pos];
}
function unelem(elem) {
	if (elem instanceof String)
		return elem;
	return [elem];
}
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

function map_index(pos, move_op) {
	if (pos >= move_op.pos && pos < move_op.pos+move_op.count) return (pos-move_op.pos) + move_op.new_pos; // within the move
	if (pos < move_op.pos && pos < move_op.new_pos) return pos; // before the move
	if (pos < move_op.pos) return pos + move_op.count; // a moved around by from right to left
	if (pos > move_op.pos && pos >= move_op.new_pos) return pos; // after the move
	if (pos > move_op.pos) return pos - move_op.count; // a moved around by from left to right
	throw "unhandled problem"
}

//////////////////////////////////////////////////////////////////////////////

exports.SPLICE = function (pos, old_value, new_value, global_order) {
	/* An operation that replaces a subrange of the sequence with new elements. */
	if (pos == "__hmm__") return; // used for subclassing to INS, DEL
	if (pos == null || old_value == null || new_value == null) throw "Invalid Argument";
	this.pos = pos;
	this.old_value = old_value;
	this.new_value = new_value;
	this.global_order = global_order;
}

	// shortcuts
	exports.INS = function (pos, value, global_order) {
		if (pos == null || value == null) throw "Invalid Argument";
		// value.slice(0,0) is a shorthand for constructing an empty string or empty list, generically
		exports.SPLICE.apply(this, [pos, value.slice(0,0), value, global_order]);
	}
	exports.INS.prototype = new exports.SPLICE("__hmm__"); // inherit prototype

	exports.DEL = function (pos, old_value, global_order) {
		if (pos == null || old_value == null) throw "Invalid Argument";
		// value.slice(0,0) is a shorthand for constructing an empty string or empty list, generically
		exports.SPLICE.apply(this, [pos, old_value, old_value.slice(0,0), global_order]);
	}
	exports.DEL.prototype = new exports.SPLICE("__hmm__"); // inherit prototype

exports.SPLICE.prototype.apply = function (document) {
	/* Applies the operation to a document. Returns a new sequence that is
	   the same type as document but with the subrange replaced. */
	return concat3(document.slice(0, this.pos), this.new_value, document.slice(this.pos+this.old_value.length));
}

exports.SPLICE.prototype.simplify = function () {
	/* Returns a new atomic operation that is a simpler version
	   of this operation.*/
	if (deepEqual(this.old_value, this.new_value))
		return new values.NO_OP();
	return this;
}

exports.SPLICE.prototype.invert = function () {
	/* Returns a new atomic operation that is the inverse of this operation */
	return new exports.SPLICE(this.pos, this.new_value, this.old_value, this.global_order);
}

exports.SPLICE.prototype.compose = function (other) {
	/* Creates a new atomic operation that has the same result as this
	   and other applied in sequence (this first, other after). Returns
	   null if no atomic operation is possible. */

	// the next operation is a no-op, so the composition is just this
	if (other instanceof values.NO_OP)
		return this;

	// a SET clobbers this operation
	if (other instanceof values.SET)
		return other.simplify();

	if (other instanceof exports.SPLICE && this.global_order == other.global_order) {
		if (this.pos <= other.pos && other.pos+other.old_value.length <= this.pos+this.new_value.length) {
			// other replaces some of the values a inserts
			// also takes care of adjacent inserts
			return new exports.SPLICE(
				this.pos,
				this.old_value,
				concat3(
					this.new_value.slice(0, other.pos-this.pos),
					other.new_value,
					this.new_value.slice(this.new_value.length + (other.pos+other.old_value.length)-(this.pos+this.new_value.length))
					) // in the final component, don't use a negative index because it might be zero (which is always treated as positive)
				);
		}
		if (other.pos <= this.pos && this.pos+this.new_value.length <= other.pos+other.old_value.length) {
			// b replaces all of the values a inserts
			// also takes care of adjacent deletes
			return new exports.SPLICE(
				other.pos,
				concat3(
					other.old_value.slice(0, this.pos-other.pos),
					this.old_value,
					other.old_value.slice(other.old_value.length + (this.pos+this.new_value.length)-(other.pos+other.old_value.length))
					),
				other.new_value
				);
		}
		// TODO: a and b partially overlap with each other
	}

	// No composition possible.
	return null;
}

exports.SPLICE.prototype.rebase = function (other) {
	/* Transforms this operation so that it can be composed *after* the other
	   operation to yield the same logical effect. Returns null on conflict. */

	if (other instanceof values.NO_OP)
		return this;

	if (other instanceof exports.SPLICE) {
		// Two insertions at the same location.
		if (this.pos == other.pos && this.old_value.length == 0 && other.old_value.length == 0) {
			// insert to the left (i.e. index doesn't change even though something was inserted)
			if (this.global_order > other.global_order)
				return this;
			
			// insert to the right (update the index)
			if (other.global_order > this.global_order)
				return new exports.SPLICE(this.pos+other.new_value.length, this.old_value, this.new_value, this.global_order);

			// if global_order is the same, then conflict
		}

		// this operation is on a range before the range that other touches
		if (this.pos + this.old_value.length <= other.pos)
			return this;
		
		// this operation is on a range after the range that other touches
		// - adjust the index
		if (this.pos >= other.pos + other.old_value.length)
			return new exports.SPLICE(this.pos+(other.new_value.length-other.old_value.length), this.old_value, this.new_value, this.global_order);
	}

	if (other instanceof exports.MOVE) {
		// if operations don't intersect...
		if (this.pos+this.old_value.length < other.pos || this.pos >= other.pos+other.count)
			return new exports.SPLICE(map_index(this.pos, other), this.old_value, this.new_value, this.global_index);
	}
	
	if (other instanceof exports.APPLY) {
		// if operations don't intersect, then this operation doesn't need to
		// be changed because indexes haven't changed
		if (other.pos > this.pos || other.pos < this.pos+this.old_value.length)
			return this;
	}	

	return null;
}

//////////////////////////////////////////////////////////////////////////////

exports.MOVE = function (pos, count, new_pos) {
	if (pos == null || count == null || new_pos == null) throw "Invalid Argument";
	this.pos = pos;
	this.count = count;
	this.new_pos = new_pos;
}

exports.MOVE.prototype.apply = function (document) {
	/* Applies the operation to a document. Returns a new sequence that is
	   the same type as document but with the subrange moved. */
	if (this.pos < this.new_pos)
		return concat3(document.slice(0, this.pos), document.slice(this.pos+this.count, this.new_pos), document.slice(this.pos, this.pos+this.count) + document.slice(this.new_pos));
	else
		return concat3(document.slice(0, this.new_pos), document.slice(this.pos, this.pos+this.count), document.slice(this.new_pos, this.pos), document.slice(this.pos+this.count));
}

exports.MOVE.prototype.simplify = function () {
	/* Returns a new atomic operation that is a simpler version
	   of this operation.*/
	if (this.pos == this.new_pos)
		return new values.NO_OP();	   
	return this;
}

exports.MOVE.prototype.invert = function () {
	/* Returns a new atomic operation that is the inverse of this operation */
	if (this.new_pos > this.pos)
		return new exports.MOVE(this.new_pos - this.count, this.count, this.pos);
	else
		return new exports.MOVE(this.new_pos, this.count, this.pos + this.count);
}

exports.MOVE.prototype.compose = function (other) {
	/* Creates a new atomic operation that has the same result as this
	   and other applied in sequence (this first, other after). Returns
	   null if no atomic operation is possible. */

	// the next operation is a no-op, so the composition is just this
	if (other instanceof values.NO_OP)
		return this;

	// a SET clobbers this operation
	if (other instanceof values.SET)
		return other.simplify();

	// the elements are immediately deleted next
	if (other instanceof exports.SPLICE && this.new_pos == other.pos && this.count == other.old_value.length && other.new_value.length == 0)
		return new exports.DEL(this.pos, other.old_value);

	// The same range moved a second time.
	if (other instanceof exports.MOVE && this.new_pos == other.pos && this.count == other.count)
		return new exports.MOVE(this.pos, other.new_pos, a.count)

	// No composition possible.
	return null;
}

exports.MOVE.prototype.rebase = function (other) {
	/* Transforms this operation so that it can be composed *after* the other
	   operation to yield the same logical effect. Returns null on conflict. */

	if (other instanceof values.NO_OP)
		return this;

	if (other instanceof exports.SPLICE) {
		// operations intersect
		if (this.pos+this.count >= other.pos && this.pos < other.pos+other.old_value.length)
			return null;
		if (this.pos < other.pos && this.new_pos < other.pos)
			return this; // not affected
		if (this.pos < other.pos && this.new_pos > other.pos)
			return new exports.MOVE(this.pos, this.count, this.new_pos + (other.new_value.length-other.old_value.length));
		if (this.pos > other.pos && this.new_pos > other.pos)
			return new exports.MOVE(this.pos + (other.new_value.length-other.old_value.length), this.count, this.new_pos + (other.new_value.length-other.old_value.length));
		if (this.pos > other.pos && this.new_pos < other.pos)
			return new exports.MOVE(this.pos + (other.new_value.length-other.old_value.length), this.count, this.new_pos);
	}

	if (other instanceof exports.MOVE) {
		// moves intersect
		if (this.pos+this.count >= other.pos && this.pos < other.pos+other.count)
			return null;
		return new exports.MOVE(map_index(this.pos, other), this.count, map_index(this.new_pos, other));
	}

	if (other instanceof exports.APPLY)
		return this; // no impact

	return null;
}

//////////////////////////////////////////////////////////////////////////////


exports.APPLY = function (pos, op) {
	if (pos == null || op == null) throw "Invalid Argument";
	this.pos = pos;
	this.op = op;
}

exports.APPLY.prototype.apply = function (document) {
	/* Applies the operation to a document. Returns a new sequence that is
	   the same type as document but with the element modified. */
	return concat3(
		document.slice(0, this.pos),
		unelem(this.op.apply(elem(document, this.pos))),
		document.slice(this.pos+1, document.length));
	return document;
}

exports.APPLY.prototype.simplify = function () {
	/* Returns a new atomic operation that is a simpler version
	   of this operation.*/
	var op = this.op.simplify();
	if (op instanceof values.NO_OP)
		return new values.NO_OP();	   
	return this;
}

exports.APPLY.prototype.invert = function () {
	/* Returns a new atomic operation that is the inverse of this operation */
	if (!this.op.invert) // inner operation does not support inverse
		return null;
	return new exports.APPLY(this.pos, this.op.invert());
}

exports.APPLY.prototype.compose = function (other) {
	/* Creates a new atomic operation that has the same result as this
	   and other applied in sequence (this first, other after). Returns
	   null if no atomic operation is possible. */

	// the next operation is a no-op, so the composition is just this
	if (other instanceof values.NO_OP)
		return this;

	// a SET clobbers this operation
	if (other instanceof values.SET)
		return other.simplify();

	// a SPLICE that includes this operation's position clobbers the operation
	if (other instanceof exports.SPLICE && this.pos >= other.pos && this.pos < other.pos + other.old_value.length)
		return other;

	// two APPLYs on the same element, with composable sub-operations
	if (other instanceof exports.APPLY && this.pos == other.pos) {
		var op2 = this.op.compose(other.op);
		if (op2)
			return new exports.APPLY(this.pos, op2);
	}

	// No composition possible.
	return null;
}

exports.APPLY.prototype.rebase = function (other) {
	/* Transforms this operation so that it can be composed *after* the other
	   operation to yield the same logical effect. Returns null on conflict. */

	if (other instanceof values.NO_OP)
		return this;

	if (other instanceof exports.SPLICE) {
		// operations intersect
		if (this.pos >= other.pos && this.pos < other.pos+other.old_value.length)
			return null;
		if (this.pos < other.pos)
			return this;
		// shift the index
		return new exports.APPLY(this.pos + (other.new_value.length-other.old_value.length), this.op);
	}

	// shift the index
	if (other instanceof exports.MOVE)
		return new exports.APPLY(map_index(this.pos, other), this.op);

	if (other instanceof exports.APPLY) {
		// Two APPLYs at different locations don't affect each other.
		if (other.pos != this.pos)
			return this;
		
		// If they are at the same location, then rebase the sub-operations.
		var op2 = this.op.rebase(other.op);
		if (op2)
			return new exports.APPLY(this.pos, op2);
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
	var jot = require('./index.js');
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
			ret.push(new exports.DEL(pos, d[i][1], global_order));
			// don't increment pos because next operation sees the string with this part deleted
		} else if (d[i][0] == 1) {
			ret.push(new exports.INS(pos, d[i][1], global_order));
			pos += d[i][1].length;
		}
	}

	return new LIST(ret);
}

