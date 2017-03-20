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
    The APPLY operation also accepts a mapping from positions to
    operations.

    Example:
    
    To replace an element at index 2 with a new value:
    
      new sequences.APPLY(2, new values.SET("old_value", "new_value"))

    To apply multiple operations on different elements:
    
      new sequences.APPLY({
        "2": new values.SET("old_value", "new_value"),
        "4": new values.MATH("add", 5))

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

exports.APPLY = function () {
	if (arguments.length == 2) {
		if (arguments[0] == null || arguments[1] == null) throw "Invalid Argument";
		this.ops = { };
		this.ops[arguments[0]] = arguments[1];
	} else {
		this.ops = arguments[0];
	}
	Object.freeze(this);
}
exports.APPLY.prototype = Object.create(jot.BaseOperation.prototype); // inherit
jot.add_op(exports.APPLY, exports, 'APPLY', ['ops']);

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
	if (deepEqual(this.old_value, this.new_value, { strict: true }))
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
	if (other instanceof exports.APPLY) {
		// Run the APPLY's inner operation on any subelement of the new value.
		// TOOD: This inefficiently re-constructs the new_value for each element
		// that the APPLY operation applies to.
		var new_value = this.new_value;
		for (var i = 0; i < new_value.length; i++) {
			if ((this.pos + i) in other.ops) {
				var op = other.ops[this.pos + i];
				new_value = concat3(
					this.new_value.slice(0, i),
					unelem(op.apply(elem(this.new_value, i)), this.old_value),
					this.new_value.slice(i+1)
					);
			}
		}
		return new exports.SPLICE(
			this.pos,
			this.old_value,
			new_value).simplify();
	}

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
		if (deepEqual(this, other, { strict: true }))
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
		// If this SPLICE operation isn't changing the length of
		// the array, then we can assume the SPLICE represents
		// element-by-element changes that we can decompose into
		// lots of SETs, and then we can rebase the inner operations.
		if (this.new_value.length == this.old_value.length) {
			var left = [];
			var right = {};
			var all_sets = true;
			for (var i = 0; i < this.old_value.length; i++) {
				// Decompose the SPLICE to an operation on the i'th element
				// and then rebase the corresponding inner operations.
				var left_op = new jot.SET(elem(this.old_value, i), elem(this.new_value, i));
				if ((this.pos + i) in other.ops) {
					var right_op = other.ops[this.pos + i];

					var left_op_rebased = left_op.rebase(right_op, conflictless);
					var right_op_rebased = right_op.rebase(left_op, conflictless);
					if (!left_op_rebased || !right_op_rebased)
						return null; // rebase failed

					left_op = left_op_rebased;
					right[this.pos+i] = right_op_rebased;
				}

				// Add it to the new decomposition.
				left.push(left_op);

				// Was it a set?
				if (!(left_op instanceof values.SET))
					all_sets = false;
			}

			// If all of the decomposed+rebased operations of the SPLICE were
			// SETs, then we can re-compose into a SPLICE again.
			if (all_sets) {
				var old_value = this.old_value.slice(0, 0);
				var new_value = this.new_value.slice(0, 0);
				for (var i = 0; i < this.old_value.length; i++) {
					old_value = concat2(old_value, unelem(left[i].old_value, old_value));
					new_value = concat2(new_value, unelem(left[i].new_value, new_value));
				}
				left = new exports.SPLICE(this.pos, old_value, new_value);

			} else {
				// Turn the decomposed+rebased operations into a LIST.
				var me = this;
				left = left.map(function(op, i) { return new exports.APPLY(me.pos+i, op); })
				left = new jot.LIST(left).simplify();
			}

			// Add in any sub-operations in other that didn't overlap with the SPLICE.
			for (var index in other.ops)
				if (index < this.pos || index >= (this.pos+i))
					right[index] = other.ops[index];

			// Return the new operations.
			return [left, new exports.APPLY(right)];
		}

		// If any of APPLY's operations applied to the same index affected
		// by the SPLICE, then the rebase fails because we can't line up
		// the elements when the SPLICE is changing substring lengths.
		// Except for deletes --- since we know what happens when a substring
		// is deleted entirely.
		if (this.new_value.length > 0) {
			for (var i = 0; i < this.old_value.length; i++)
				if ((this.pos + i) in other.ops)
					return null;
		}

		// Either the two operations did not apply to the same indexes, or they
		// did but the SPLICE deleted the element. Reconstruct the operations. The
		// APPLY indexes may need to be shifted if they occur after the splice
		// or deleted if they occured within a splice. The SPLICE's old_value must
		// be updated to account for the APPLY having already happened.
		var new_old_value = this.old_value;
		var new_right_ops = { };
		for (var index in other.ops) {
			// Adjust the old_value.
			if (index >= this.pos && index < this.pos + this.old_value.length) {
				// The APPLY and the SPLICE affected the same index. If we're
				// here, then the SPLICE must be a deletion. Re-construct the
				// splice and drop the APPLY.
				new_old_value = concat3(
					new_old_value.slice(0, index-this.pos),
					unelem(other.ops[index].invert().apply(elem(new_old_value, index-this.pos)), new_old_value),
					new_old_value.slice(index-this.pos+1)
				)
			} else {
				// Adjust the index.
				var new_index = parseInt(index); // indexes are stored as strings in objects
				if (new_index >= this.pos)
					new_index += this.new_value.length - this.old_value.length;
				new_right_ops[new_index] = other.ops[index];
			}
		}


		// If the SPLICE is changing the array length, then we don't know
		// how to line up the changes with the APPLY operations.
		return [new exports.SPLICE(this.pos, new_old_value, this.new_value), new exports.APPLY(new_right_ops)];

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
		var new_ops = { };
		for (var index in other.ops)
			new_ops[map_index(index, this)] = other.ops[index];
		return [
			this,
			new exports.APPLY(new_ops)
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
	var doc = document;
	for (var index in this.ops) { // TODO: Inefficient.
		index = parseInt(index);
		doc = concat3(
			doc.slice(0, index),
			unelem(this.ops[index].apply(elem(doc, index), doc)),
			doc.slice(index+1, doc.length));
	}
	return doc;
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

exports.APPLY.prototype.invert = function () {
	/* Returns a new atomic operation that is the inverse of this operation.
	   All of the sub-operations get inverted. */
	var new_ops = { };
	for (var key in this.ops) {
		new_ops[key] = this.ops[key].invert();
	}
	return new exports.APPLY(new_ops);
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

	// two APPLYs
	if (other instanceof exports.APPLY) {
		// Start with a clone of this operation's suboperations.
		var new_ops = { };
		for (var index in this.ops)
			new_ops[index] = this.ops[index];

		// Now compose with other.
		for (var index in other.ops) {
			if (!(index in new_ops)) {
				// Operation in other applies to an index not present
				// in this, so we can just merge - the operations
				// happen in parallel and don't affect each other.
				new_ops[index] = other.ops[index];
			} else {
				// Compose.
				var op2 = new_ops[index].compose(other.ops[index]);
				if (op2) {
					// They composed to a no-op, so delete the
					// first operation.
					if (op2 instanceof values.NO_OP)
						delete new_ops[index];

					// They composed to something atomic, so replace.
					else
						new_ops[index] = op2;
				} else {
					// They don't compose to something atomic, so use a LIST.
					new_ops[index] = new LIST([new_ops[index], other.ops[index]]);
				}
			}
		}

		return new exports.APPLY(new_ops).simplify();
	}

	// No composition possible.
	return null;
}

exports.APPLY.prototype.rebase_functions = [
	[exports.APPLY, function(other, conflictless) {
		// Rebase the sub-operations on corresponding indexes.
		// If any rebase fails, the whole rebase fails.
		var new_ops_left = { };
		for (var key in this.ops) {
			new_ops_left[key] = this.ops[key];
			console.log(key, this.ops, new_ops_left);
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
	}],

	[exports.MAP, function(other, conflictless) {
		// APPLY and MAP. Since MAP applies to all indexes, this is
		// like APPLY and APPLY but MAP's inner operation must rebase
		// to the *same* thing when it is rebased against each operation
		// within the APPLY.
		var new_ops_left = { };
		var new_op_right = null;
		for (var key in this.ops) {
			// Rebase left to right.
			new_ops_left[key] = this.ops[key].rebase(other.op, conflictless);
			if (new_ops_left[key] === null)
				return null;

			// Rebase right to left.
			var op = other.op.rebase(this.ops[key]);
			if (op === null)
				return null;
			if (new_op_right !== null)
				if (!deepEqual(op.toJSON(), new_op_right.toJSON(), { strict: true }))
					return null;
			new_op_right = op;
		}

		return [
			new exports.APPLY(new_ops_left).simplify(),
			new exports.MAP(new_op_right)
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
