/* An operational transformation library for sequence-like objects:
   strings and arrays.
   
   Three operations are provided:
   
   new sequences.SPLICE(pos, old_value, new_value)

    Replaces values in the sequence. Replace nothing with
    something to insert, or replace something with nothing to
    delete. pos is zero-based.
    
    Shortcuts are provided:
    
    new sequences.INS(pos, new_value)
    
       (Equivalent to SPLICE(pos, [], new_value) for arrays or
       SPLICE(pos, "", new_value) for strings.)
       
    new sequences.DEL(pos, old_value)
    
       (Equivalent to SPLICE(pos, old_value, []) for arrays or
       SPLICE(pos, old_value, "") for strings.)

    Supports a conflictless rebase with other SPLICE, APPLY, and
    MAP operations.


   new sequences.MOVE(pos, count, new_pos)

    Moves the subsequence starting at pos and count items long
    to a new location starting at index new_pos. pos is zero-based.

    Supports a conflictless rebase with other MAP operations.

   new sequences.APPLY(pos, operation)

    Applies another sort of operation to a single element. Use
    any of the operations in values.js on an element. Or if the
    element is an array or object, use the operators in this module
    or the objects.js module, respectively. pos is zero-based.

    Example:
    
    To replace an element at index 2 with a new value:
    
      new sequences.APPLY(2, new values.SET("old_value", "new_value"))

    Supports a conflictless rebase with other SPLICE operations and
    with other APPLY and MAP operations when the inner operations
    support a conflictless rebase.


   new sequences.MAP(operation)

    Applies another sort of operation to every element of the array.

    Supports a conflictless rebase with other SPLICE and MOVE operations
    and with other APPLY and MAP operations when the inner operations
    support a conflictless rebase.

   */
   
var deepEqual = require("deep-equal");
var jot = require("./index.js");
var values = require("./values.js");
var LIST = require("./meta.js").LIST;

// utilities

function elem(seq, pos) {
	// get an element of the sequence
	if (typeof seq == "string")
		return seq.charAt(pos);
	else // is an array
		return seq[pos];
}
function unelem(elem, seq) {
	// turn an element into a one-item sequence
	if (typeof seq == "string")
		return elem; // characters and strings are all the same
	else // is an array
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

exports.module_name = 'sequences'; // for serialization/deserialization

exports.SPLICE = function (pos, old_value, new_value) {
	/* An operation that replaces a subrange of the sequence with new elements. */
	if (pos == "__hmm__") return; // used for subclassing to INS, DEL
	if (pos == null || old_value == null || new_value == null) throw "Invalid Argument";
	this.pos = pos;
	this.old_value = old_value;
	this.new_value = new_value;
	Object.freeze(this);
}
exports.SPLICE.prototype = Object.create(jot.BaseOperation.prototype); // inherit
jot.add_op(exports.SPLICE, exports, 'SPLICE', ['pos', 'old_value', 'new_value']);

	// shortcuts
	exports.INS = function (pos, value) {
		if (pos == null || value == null) throw "Invalid Argument";
		// value.slice(0,0) is a shorthand for constructing an empty string or empty list, generically
		exports.SPLICE.apply(this, [pos, value.slice(0,0), value]);
	}
	exports.INS.prototype = new exports.SPLICE("__hmm__"); // inherit prototype

	exports.DEL = function (pos, old_value) {
		if (pos == null || old_value == null) throw "Invalid Argument";
		// value.slice(0,0) is a shorthand for constructing an empty string or empty list, generically
		exports.SPLICE.apply(this, [pos, old_value, old_value.slice(0,0)]);
	}
	exports.DEL.prototype = new exports.SPLICE("__hmm__"); // inherit prototype

exports.MOVE = function (pos, count, new_pos) {
	if (pos == null || count == null || count == 0 || new_pos == null) throw "Invalid Argument";
	this.pos = pos;
	this.count = count;
	this.new_pos = new_pos;
	Object.freeze(this);
}
exports.MOVE.prototype = Object.create(jot.BaseOperation.prototype); // inherit
jot.add_op(exports.MOVE, exports, 'MOVE', ['pos', 'count', 'new_pos']);

exports.APPLY = function (pos, op) {
	if (pos == null || op == null) throw "Invalid Argument";
	this.pos = pos;
	this.op = op;
	Object.freeze(this);
}
exports.APPLY.prototype = Object.create(jot.BaseOperation.prototype); // inherit
jot.add_op(exports.APPLY, exports, 'APPLY', ['pos', 'op']);

exports.MAP = function (op) {
	if (op == null) throw "Invalid Argument";
	this.op = op;
	Object.freeze(this);
}
exports.MAP.prototype = Object.create(jot.BaseOperation.prototype); // inherit
jot.add_op(exports.MAP, exports, 'MAP', ['op']);

//////////////////////////////////////////////////////////////////////////////

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
	return new exports.SPLICE(this.pos, this.new_value, this.old_value);
}

exports.SPLICE.prototype.compose = function (other) {
	/* Creates a new atomic operation that has the same result as this
	   and other applied in sequence (this first, other after). Returns
	   null if no atomic operation is possible. */

	// the next operation is a no-op, so the composition is just this
	if (other instanceof values.NO_OP)
		return this;

	// a SET clobbers this operation, but its old_value must be updated
	if (other instanceof values.SET)
		return new values.SET(this.invert().apply(other.old_value), other.new_value).simplify();

	if (other instanceof exports.SPLICE) {
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

	// a SPLICE composed with an APPLY that applies within the range modified
	// by the splice
	if (other instanceof exports.APPLY && other.pos >= this.pos && other.pos < this.pos + this.old_value.length)
		return new exports.SPLICE(
			this.pos,
			this.old_value,
			concat3(
				this.new_value.slice(0, other.pos-this.pos),
				unelem(other.apply(elem(this.new_value, other.pos-this.pos)), this.old_value),
				this.new_value.slice(other.pos-this.pos+1)
				))
				.simplify();

	// No composition possible.
	return null;
}

exports.SPLICE.prototype.rebase_functions = [
	/* Transforms this operation so that it can be composed *after* the other
	   operation to yield the same logical effect. Returns null on conflict. */

	[exports.SPLICE, function(other, conflictless) {
		// If the two SPLICE operations are identical then the one 
		// applied second (the one being rebased) becomes a no-op. Since the
		// two parts of the return value are for each rebased against the
		// other, both are returned as no-ops.
		if (deepEqual(this, other))
			return [new values.NO_OP(), new values.NO_OP()];
		
		// Two insertions at the same location.
		if (this.pos == other.pos && this.old_value.length == 0 && other.old_value.length == 0) {
	 		// We don't know which one to put on the left and which one
	 		// to put on the right, so we can only resolve this if
	 		// conflictless is true.
	 		//
			// Insert the one whose new_value has a lower sort order to
			// the left. The one on the left executes at the same index
			// when it is applied *second* (it is the operation being
			// rebased). The operation on the right, when rebased, must
			// have its index updated.
			if (conflictless && jot.cmp(this.new_value, other.new_value) < 0)
				return [this, new exports.SPLICE(other.pos+this.new_value.length, other.old_value, other.new_value)];

			// cmp > 0 will be handled by a call to other.rebase_functions(this),
			// where everything will reverse, so the cmp < 0 logic will run.

			// If the values have the same sort order, they would have
			// been deepEqual above. If conflictless is false, we have
			// a conflict.
			return null; 
		
		// The operations replace the same substring but with different replacements.
		} else if (this.pos == other.pos && this.old_value.length == other.old_value.length) {
			// If conflictless is true, we clobber the one with the lower sort order.
			// Similar to values.SET.
			if (conflictless && jot.cmp(this.new_value, other.new_value) < 0)
				return [
					new values.NO_OP(),
					new exports.SPLICE(other.pos, this.new_value, other.new_value)
				];

			// cmp > 0 will be handled by a call to other.rebase_functions(this),
			// where everything will reverse, so the cmp < 0 logic will run.

			// If the values have the same sort order, they would have
			// been deepEqual above. If conflictless is false, we have
			// a conflict.
			return null; 

		// This operation is on a range before the range that other touches
		// (but not two insertions at the same point --- that case must be
		// handled above separately, this logic won't work for that).
		// They don't conflict. The indexes on this don't need to be updated,
		// but the indexes on other (when rebased against this) must be.
		} else if (this.pos + this.old_value.length <= other.pos)
			return [
				this,
				new exports.SPLICE(other.pos+(this.new_value.length-this.old_value.length), other.old_value, other.new_value)];

		// The two SPLICE operations touch overlapping parts of the sequence
		// in non-identical ways. Try to resolve in a conflictless way.

		// If this SPLICE totally contains the other, this will clobber
		// the other.
		else if (conflictless
				&& ((this.pos < other.pos) || (this.pos == other.pos && this.old_value.length > other.old_value.length))
				&& ((this.pos+this.old_value.length > other.pos+other.old_value.length)
					|| ((this.pos+this.old_value.length == other.pos+other.old_value.length) && this.pos < other.pos))) {
			return [
				// this clobbers the other -- simply update this's old_value to be
				// consistent with the previous change by other
				new exports.SPLICE(this.pos,
					concat3(
						this.old_value.slice(0, other.pos-this.pos),
						other.new_value,
						this.old_value.slice(other.pos+other.old_value.length-this.pos)
					),
					this.new_value),

				// other gets clobbered
				new values.NO_OP(),
			];

		// If this SPLICE overlaps the left edge of the part of the sequence
		// modified by other, then the composition will have the effect of
		// deleting the union of both operations' old_values and inserting
		// both operations' new values, with this inserted on the left.
		} else if (conflictless && this.pos < other.pos) {
			return [
				// remove the part of old_value that other already deleted
				new exports.SPLICE(
					this.pos,
					this.old_value.slice(0, other.pos-this.pos),
					this.new_value),

				// remove the part of old_value that this already deleted
				// and adjust the position to be right at the right edge
				// of this's replacement
				new exports.SPLICE(
					this.pos + this.new_value.length,
					other.old_value.slice(this.pos+this.old_value.length-other.pos),
					other.new_value)
			];
		}
	}],

	[exports.MOVE, function(other, conflictless) {
		// this is entirely before other
		if (this.pos+this.old_value.length < other.pos)
			return [
				new exports.SPLICE(map_index(this.pos, other), this.old_value, this.new_value),
				new exports.MOVE(other.pos+this.new_value.length-this.old_value.length, other.count, other.new_pos)
			];

		// this is entirely after other
		if (this.pos >= other.pos+other.count)
			return [
				new exports.SPLICE(map_index(this.pos, other), this.old_value, this.new_value),
				other
			];
	}],
	
	[exports.APPLY, function(other, conflictless) {
		// other is after the spliced range
		if (other.pos >= this.pos + this.old_value.length)
			return [this, new exports.APPLY(other.pos+this.new_value.length-this.old_value, other.op)];

		// other is before the spliced range
		if (other.pos < this.pos)
			return [this, other];

		// other is intersecting the spliced range -- handle like
		// we handle SET and MATH (see values.js). If the spliced
		// range isn't changing in length and the APPLY operation
		// can apply to the new value of the element that the APPLY
		// operates on, use that.
		var old_value = concat3(
			this.old_value.slice(0, other.pos-this.pos),
			unelem(other.op.apply(elem(this.old_value, other.pos-this.pos)), this.old_value),
			this.old_value.slice(other.pos-this.pos+1));
		if (this.new_value.length == this.old_value.length) {
			try {
				var new_value = concat3(
					this.new_value.slice(0, other.pos-this.pos),
					unelem(other.op.apply(elem(this.new_value, other.pos-this.pos)), this.old_value),
					this.new_value.slice(other.pos-this.pos+1));
				return [
					new exports.SPLICE(this.pos, old_value, new_value),
					other
				];
			} catch (e) {
			}
		}

		// Otherwise, in conflictless mode, the SPLICE takes precedence.
		if (conflictless)
			return [
				new exports.SPLICE(this.pos, old_value, this.new_value),
				new value.NO_OP()
			];
	}],

	[exports.MAP, function(other, conflictless) {
		// Handle this like we handle SET and APPLY...
		//
		// SPLICE (this) and MAP (other). To get a consistent effect no matter
		// which order the operations are applied in, we say the SPLICE comes
		// first and the MAP second. But the MAP operation may not be able to
		// apply to the new sequence values, so this may not be possible.

		try {
			// If this is possible...
			return [
				new exports.SPLICE(this.pos, other.apply(this.old_value), other.apply(this.new_value)),
				other // no change is needed when it is the MAP being rebased
				];
		} catch (e) {
			// Data type mismatch, e.g. the SPLICE sets an element to a value
			// the MAP's operation can't apply to. For a conflictless rebase,
			// prefer the SPLICE.
			if (conflictless)
				return [
					new exports.SPLICE(this.pos, other.apply(this.old_value), this.new_value),
					new exports.NO_OP()
					];
		}

		// Can't resolve conflict.
		return null;
	}]
];

//////////////////////////////////////////////////////////////////////////////

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

	// a SET clobbers this operation, but its old_value must be updated
	if (other instanceof values.SET)
		return new values.SET(this.invert().apply(other.old_value), other.new_value).simplify();

	// the elements are immediately deleted next
	if (other instanceof exports.SPLICE && this.new_pos == other.pos && this.count == other.old_value.length && other.new_value.length == 0)
		return new exports.DEL(this.pos, other.old_value);

	// The same range moved a second time.
	if (other instanceof exports.MOVE && this.new_pos == other.pos && this.count == other.count)
		return new exports.MOVE(this.pos, other.new_pos, a.count)

	// No composition possible.
	return null;
}

exports.MOVE.prototype.rebase_functions = [
	[exports.MOVE, function(other, conflictless) {
		// moves intersect
		if (this.pos+this.count >= other.pos && this.pos < other.pos+other.count)
			return null;
		return [
			new exports.MOVE(map_index(this.pos, other), this.count, map_index(this.new_pos, other)),
			null // second element is not used when the types of the two operations is the same
		];
	}],
	[exports.APPLY, function(other, conflictless) {
		// APPLY never changes indexes, so the MOVE is unaffected.
		// But the MOVE shifts indexes so the APPLY must be adjusted.
		return [
			this,
			new exports.APPLY(map_index(other.pos, this), other.op)
		];
	}],
	[exports.MAP, function(other, conflictless) {
		// The MOVE changes the order but not the values and the MAP changes
		// values but doesn't care about order, so they don't bother each other.
		return [this, other];
	}]
];

//////////////////////////////////////////////////////////////////////////////

exports.APPLY.prototype.apply = function (document) {
	/* Applies the operation to a document. Returns a new sequence that is
	   the same type as document but with the element modified. */
	return concat3(
		document.slice(0, this.pos),
		unelem(this.op.apply(elem(document, this.pos), document)),
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
	return new exports.APPLY(this.pos, this.op.invert());
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

	// a SPLICE that includes this operation's position clobbers the operation
	if (other instanceof exports.SPLICE && this.pos >= other.pos && this.pos < other.pos + other.old_value.length)
		return new exports.SPLICE(
			other.pos,
			concat3(
				other.old_value.slice(0, this.pos-other.pos),
				unelem(this.invert().apply(elem(other.old_value, this.pos-other.pos)), other.old_value),
				other.old_value.slice(this.pos-other.pos+1)
				),
			other.new_value)
				.simplify();

	// two APPLYs on the same element, with composable sub-operations
	if (other instanceof exports.APPLY && this.pos == other.pos) {
		var op2 = this.op.compose(other.op);
		if (op2)
			return new exports.APPLY(this.pos, op2);
	}

	// No composition possible.
	return null;
}

exports.APPLY.prototype.rebase_functions = [
	[exports.APPLY, function(other, conflictless) {
		// Two APPLYs at different locations don't affect each other.
		if (other.pos != this.pos)
			return [this, other];
		
		// If they are at the same location, then rebase the sub-operations.
		var opa = this.op.rebase(other.op, conflictless);
		var opb = other.op.rebase(this.op, conflictless);
		if (opa && opb)
			return [
				(opa instanceof values.NO_OP) ? new values.NO_OP() : new exports.APPLY(this.pos, opa),
				(opb instanceof values.NO_OP) ? new values.NO_OP() : new exports.APPLY(other.pos, opb)
			];
	}],

	[exports.MAP, function(other, conflictless) {
		// APPLY and MAP. The MAP is assumed to execute first, so when we rebase the APPLY
		// we rebase it against the MAP operation that had run at that index. When
		// we're given a MAP to rebase, we'll have to return a sequence of operations
		// that undoes the APPLY, applies the MAP, and then applies the APPLY rebased
		// on the map.

		var opa = this.op.rebase(other.op, conflictless);
		if (!opa) return null;

		var r = (opa instanceof values.NO_OP) ? new values.NO_OP() : new exports.APPLY(this.pos, opa);

		var opb = other.op.rebase(this.op, conflictless);
		if (opa && opb && deepEqual(other.op, opb))
			// If rebasing the MAP's inner operation yields the same operation,
			// then the two operations can go in either order and rebasing
			// the MAP doesn't change the MAP.
			return [
				r,
				other
			];
		else
			return [
				r,
				new LIST([ this.invert(), other, r ]).simplify()
			];
	}]
];

//////////////////////////////////////////////////////////////////////////////

exports.MAP.prototype.apply = function (document) {
	/* Applies the operation to a document. Returns a new sequence that is
	   the same type as document but with the element modified. */

	// Get an array we can manipulate.
	var d;
	if (typeof document == 'string')
		d = document.split(/.{0}/) // turn string into array of characters
	else
 		d = document.slice(); // clone
	
	// Apply operation.
	for (var i = 0; i < d.length; i++)
		d[i] = this.op.apply(d[i])

	// Reform sequence.
	if (typeof document == 'string')
		return d.join("");
	else
 		return d;
}

exports.MAP.prototype.simplify = function () {
	/* Returns a new atomic operation that is a simpler version
	   of this operation.*/
	var op = this.op.simplify();
	if (op instanceof values.NO_OP)
		return new values.NO_OP();	   
	return this;
}

exports.MAP.prototype.invert = function () {
	/* Returns a new atomic operation that is the inverse of this operation */
	return new exports.MAP(this.op.invert());
}

exports.MAP.prototype.compose = function (other) {
	/* Creates a new atomic operation that has the same result as this
	   and other applied in sequence (this first, other after). Returns
	   null if no atomic operation is possible. */

	// the next operation is a no-op, so the composition is just this
	if (other instanceof values.NO_OP)
		return this;

	// a SET clobbers this operation, but its old_value must be updated
	if (other instanceof values.SET)
		return new values.SET(this.invert().apply(other.old_value), other.new_value).simplify();

	// two MAPs with composable sub-operations
	if (other instanceof exports.MAP) {
		var op2 = this.op.compose(other.op);
		if (op2)
			return new exports.MAP(op2);
	}

	// No composition possible.
	return null;
}

exports.MAP.prototype.rebase_functions = [
	[exports.MAP, function(other, conflictless) {
		// Two MAPs.
		var opa = this.op.rebase(other.op, conflictless);
		var opb = other.op.rebase(this.op, conflictless);
		if (opa && opb)
			return [
				(opa instanceof values.NO_OP) ? new values.NO_OP() : new exports.MAP(opa),
				(opb instanceof values.NO_OP) ? new values.NO_OP() : new exports.MAP(opb)
			];
	}]
];

/////

// Use google-diff-match-patch to convert a diff between two
// strings into an array of SPLICE operations.
exports.from_diff = function(old_value, new_value, mode) {
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
			ret.push(new exports.DEL(pos, d[i][1]));
			// don't increment pos because next operation sees the string with this part deleted
		} else if (d[i][0] == 1) {
			ret.push(new exports.INS(pos, d[i][1]));
			pos += d[i][1].length;
		}
	}

	return new LIST(ret);
}

