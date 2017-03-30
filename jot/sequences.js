/* An operational transformation library for sequence-like objects:
   strings and arrays.
   
   Three operations are provided:
   
   new sequences.SPLICE([ { offset: ..., old_value: ..., new_value: ... }])
 
    The SPLICE operation encapsulates a diff/patch on a sequence,
    with zero or more hunks representing changed subsequences.
    The offset in each hunk indicates the number of unchanged
    elements between it and the previous hunk (or the start of
    the sequence).

    Shortcuts are provided:
    
    new sequences.INS(pos, new_value)
    
       Equivalent to SPLICE({ offset: pos, old_value: "" or [], new_value: new_value })
       (where "" is used for strings and [] for arrays).
       
    new sequences.DEL(pos, old_value)
    
       Equivalent to SPLICE({ offset: pos, old_value: old_value, new_value: "" or [] })
       (where "" is used for strings and [] for arrays).

    Supports a conflictless rebase with other SPLICE and APPLY operations.


   new sequences.MOVE(pos, count, new_pos)

    Moves the subsequence starting at pos and count items long
    to a new location starting at index new_pos. pos is zero-based.


   new sequences.APPLY(pos, operation)

    Applies another sort of operation to a single element. Use
    any of the operations in values.js on an element. Or if the
    element is an array or object, use the operators in this module
    or the objects.js module, respectively. pos is zero-based.

    The APPLY operation also accepts a mapping from positions to
    operations. So, like SPLICE, it can represent many changes
    occurring simultaneously at different positions in the sequence.

    When APPLY is used on a string document, it is operating over
    a single character. The operation may not change the character
    into something other than a single character because that would
    change the length of the (whole) string.

    Example:
    
    To replace an element at index 2 with a new value:
    
      new sequences.APPLY(2, new values.SET("old_value", "new_value"))

    To apply multiple operations on different elements:
    
      new sequences.APPLY({
        "2": new values.SET("old_value", "new_value"),
        "4": new values.MATH("add", 5))

    Supports a conflictless rebase with other SPLICE operations and
    with other APPLY operations when the inner operations support a
    conflictless rebase.


   new sequences.MAP(operation)

    Applies another sort of operation to every element of the array.

   */
   
var util = require('util');
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

exports.SPLICE = function () {
	/* An operation that replaces a subrange of the sequence with new elements. */
	if (arguments[0] === "__hmm__") return; // used for subclassing to INS, DEL
	if (arguments.length == 1)
		// The argument is an array of hunks of the form { offset:, old_value:, new_value: }.
		this.hunks = arguments[0];
	else if (arguments.length == 3)
		// The arguments are the position, old_value, and new_value of a single hunk.
		this.hunks = [{ offset: arguments[0], old_value: arguments[1], new_value: arguments[2] }];
	else
		throw "Invaid Argument";

	if (!Array.isArray(this.hunks))
		throw "Invaid Argument";

	// Sanity check & freeze hunks.
	this.hunks.forEach(function(hunk) {
		if (typeof hunk.offset != "number" || hunk.old_value === null || hunk.new_value === null)
			throw "Invalid Argument";
		Object.freeze(hunk);
	});

	Object.freeze(this);
}
exports.SPLICE.prototype = Object.create(jot.BaseOperation.prototype); // inherit
jot.add_op(exports.SPLICE, exports, 'SPLICE', ['hunks']);

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

exports.SPLICE.prototype.inspect = function(depth) {
	return util.format("<sequences.SPLICE%s>",
		this.hunks.map(function(hunk) {
			return util.format(" +%d %j => %j", hunk.offset, hunk.old_value, hunk.new_value)
		}).join(","));
}

exports.SPLICE.prototype.apply = function (document) {
	/* Applies the operation to a document. Returns a new sequence that is
	   the same type as document but with the hunks applied. */
	var index = 0;
	var ret = document.slice(0,0); // start with an empty document
	this.hunks.forEach(function(hunk) {
		// Append unchanged content before this hunk.
		ret = concat2(ret, document.slice(index, index+hunk.offset));
		index += hunk.offset;

		// Append new content.
		ret = concat2(ret, hunk.new_value);
		index += hunk.old_value.length;
	});
	// Append unchanged content after the last hunk.
	ret = concat2(ret, document.slice(index));
	return ret;
}

exports.SPLICE.prototype.simplify = function () {
	/* Returns a new atomic operation that is a simpler version
	   of this operation.*/
	// Simplify the hunks by removing any that don't make changes.
	// Adjust offsets.
	var hunks = [];
	var doffset = 0;
	this.hunks.forEach(function(hunk) {
		if (deepEqual(hunk.old_value, hunk.new_value, { strict: true }))
			// Drop it, but adjust future offsets.
			doffset += hunk.old_value.length;
		else if (hunks.length > 0 && hunk.offset + doffset == 0)
			// It's contiguous with the previous hunk, so combine it.
			hunks[hunks.length-1] = {
				offset: hunks[hunks.length-1].offset,
				old_value: concat2(hunks[hunks.length-1].old_value, hunk.old_value),
				new_value: concat2(hunks[hunks.length-1].new_value, hunk.new_value) }
		else
			hunks.push({ offset: hunk.offset+doffset, old_value: hunk.old_value, new_value: hunk.new_value })
	});
	if (hunks.length == 0)
		return new values.NO_OP();
	return new exports.SPLICE(hunks);
}

exports.SPLICE.prototype.invert = function () {
	/* Returns a new atomic operation that is the inverse of this operation.
	   The inverse simply reverses the hunks. */
	return new exports.SPLICE(this.hunks.map(function(hunk) {
		return { offset: hunk.offset, old_value: hunk.new_value, new_value: hunk.old_value };
	}));
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

	// a SPLICE composes with a SPLICE
	if (other instanceof exports.SPLICE) {
		// Merge the two lists of hunks into one. We process the two lists of
		// hunks as if they are connected by a zipper. The new_values of this's
		// hunks line up with the old_values of other's hunks.
		function make_state(hunks) {
			return {
				hunk_index: 0, // index of current hunk
				hunk: hunks[0], // actual current hunk
				offset_delta: 0, // number of elements inserted/deleted by the other side
				index: 0, // index past last element of last hunk
				hunks: hunks // incoming hunks
			};
		}
		var state = {
			left: make_state(this.hunks),
			right: make_state(other.hunks)
		};
		var hunks = []; // composition
		while (state.left.hunk_index < state.left.hunks.length || state.right.hunk_index < state.right.hunks.length) {
			// Advance over the left hunk if it appears entirely before the right hunk
			// or there are no more right hunks. As we advance, we take the left hunk
			// but alter the offset in case hunks were inserted between this and the
			// previous left hunk and so we're advancing from a nearer position.
			if (state.right.hunk_index == state.right.hunks.length ||
				(state.left.hunk_index < state.left.hunks.length &&
				 state.left.index+state.left.hunk.offset+state.left.hunk.new_value.length
					<= state.right.index+state.right.hunk.offset)) {
				hunks.push({ offset: state.left.hunk.offset-state.left.offset_delta, old_value: state.left.hunk.old_value, new_value: state.left.hunk.new_value });
				state.left.index += state.left.hunk.offset + state.left.hunk.new_value.length;
				state.right.offset_delta += state.left.hunk.offset + state.left.hunk.new_value.length;
				state.left.hunk = state.left.hunks[++state.left.hunk_index];
				state.left.offset_delta = 0;
				continue;
			}

			// Advance over the right hunk if it appears entirely before the left hunk
			// or there are no more left hunks. As we take the right hunk, we adjust
			// the offset.
			if (state.left.hunk_index == state.left.hunks.length ||
				(state.right.hunk_index < state.right.hunks.length &&
				 state.right.index+state.right.hunk.offset+state.right.hunk.old_value.length
					<= state.left.index+state.left.hunk.offset)) {
				hunks.push({ offset: state.right.hunk.offset-state.right.offset_delta, old_value: state.right.hunk.old_value, new_value: state.right.hunk.new_value });
				state.right.index += state.right.hunk.offset + state.right.hunk.old_value.length;
				state.left.offset_delta += state.right.hunk.offset + state.right.hunk.old_value.length;
				state.right.hunk = state.right.hunks[++state.right.hunk_index];
				state.right.offset_delta = 0;
				continue;
			}

			// We have hunks that overlap.
			
			// First create hunks for the portion of the left or right hunks
			// that starts before the other. The left is treated as an insertion
			// and the right a deletion. The left's old value and the right's
			// new value is lumped with the common block in the middle.
			var start_dx = (state.left.index+state.left.hunk.offset) - (state.right.index+state.right.hunk.offset);
			if (start_dx < 0) {
				var chomp = -start_dx;
				hunks.push({
					offset: state.left.hunk.offset-state.left.offset_delta,
					old_value: state.left.hunk.old_value.slice(0, 0),
					new_value: state.left.hunk.new_value.slice(0, chomp)});
				state.left.hunk = {
					offset: 0,
					old_value: state.left.hunk.old_value,
					new_value: state.left.hunk.new_value.slice(chomp)
				};
				state.left.index += state.left.hunk.offset + chomp;
				state.right.offset_delta += state.left.hunk.offset + chomp;
				state.left.offset_delta = 0;
			}
			if (start_dx > 0) {
				var chomp = start_dx;
				hunks.push({
					offset: state.right.hunk.offset-state.right.offset_delta,
					old_value: state.right.hunk.old_value.slice(0, chomp),
					new_value: state.right.hunk.new_value.slice(0, 0)});
				state.right.hunk = {
					offset: 0,
					old_value: state.right.hunk.old_value.slice(chomp),
					new_value: state.right.hunk.new_value
				};
				state.right.index += state.right.hunk.offset + chomp;
				state.left.offset_delta += state.right.hunk.offset + chomp;
				state.right.offset_delta = 0;
			}

			// The hunks now begin at the same location. But they may have
			// different lengths. How long is the part they have in common?
			var overlap = Math.min(state.left.hunk.new_value.length, state.right.hunk.old_value.length);

			// Create a hunk for the overlap.
			// The left's old_value and the right's new_value get lumped here.
			// The overlap characters they have in common drop out are are no
			// longer represented in the SPICE operation. But we consumed them here.
			hunks.push({
				offset: state.left.hunk.offset-state.left.offset_delta,
				old_value: state.left.hunk.old_value,
				new_value: state.right.hunk.new_value});
			state.left.index += state.left.hunk.offset + overlap;
			state.right.index += state.right.hunk.offset + overlap;
			state.left.offset_delta = 0;
			state.right.offset_delta = 0;
			
			// Adjust the hunks because the overlap was consumed.
			state.left.hunk = {
				offset: 0,
				old_value: state.left.hunk.old_value.slice(0, 0), // it was just consumed, nothing left
				new_value: state.left.hunk.new_value.slice(overlap) // there may be more left
			};
			state.right.hunk = {
				offset: 0,
				old_value: state.right.hunk.old_value.slice(overlap),
				new_value: state.right.hunk.new_value.slice(0, 0) // it was just consumed, nothing left
			};

			// Advance the hunks if we consumed one entirely.
			if (state.left.hunk.new_value.length == 0)
				state.left.hunk = state.left.hunks[++state.left.hunk_index];
			if (state.right.hunk.old_value.length == 0)
				state.right.hunk = state.right.hunks[++state.right.hunk_index];
		}
		return new exports.SPLICE(hunks).simplify();
	}

	// a SPLICE composed with an APPLY that applies within a range modified
	// by the splice, by simply replacing an element in a hunk new_value
	// with the result of applying the APPLY's inner operation to it
	if (other instanceof exports.APPLY) {
		// Run the APPLY's inner operation on any subelement of the new value.
		var seen_indexes = { };
		var index = 0;
		var hunks = [];
		this.hunks.forEach(function(hunk) {
			index += hunk.offset;

			// TOOD: This inefficiently re-constructs the new_value for each element
			// that the APPLY operation applies to.
			var new_value = hunk.new_value;
			for (var i = 0; i < new_value.length; i++) {
				if ((index + i) in other.ops) {
					seen_indexes[index + i] = true;
					var op = other.ops[index + i];
					new_value = concat3(
						new_value.slice(0, i),
						unelem(op.apply(elem(new_value, i)), hunk.old_value),
						new_value.slice(i+1)
						);
				}
			}
			hunks.push({ offset: hunk.offset, old_value: hunk.old_value, new_value: new_value });

			index += hunk.new_value.length;
		})

		// If there are any indexes modified by the APPLY that were not within
		// the ranges of the SPLICE, then we can't compose the operations.
		var any_bad = false;
		Object.keys(other.ops).forEach(function(index) {
			if (!(index in seen_indexes))
				any_bad = true;
		})
		if (any_bad) return null;

		return new exports.SPLICE(hunks).simplify();
	}

	// No composition possible.
	return null;
}

exports.SPLICE.prototype.rebase_functions = [
	/* Transforms this operation so that it can be composed *after* the other
	   operation to yield the same logical effect. Returns null on conflict. */

	[exports.SPLICE, function(other, conflictless) {
		// Rebasing two SPLICEs works like compose, except that we are aligning
		// this's old_values with other's old_values (rather than this's new_values
		// with other's old_values).
		//
		// We process the two lists of hunks as if they are connected by a zipper
		// on the old_values. Parts that don't overlap don't create conflicts but
		// do alter offsets. Overlaps create conflicts, unless conflictless is true,
		// in which case we squash one side or the other.

		function make_state(hunks) {
			return {
				hunk: hunks[0], // actual current hunk
				offset_delta: 0, // number of elements inserted/deleted by the other side
				index: 0, // index past last element of last hunk in hunks

				// private
				hunk_index: 0, // index of current hunk
				source_hunks: hunks, // all hunks
				new_hunks: [], // new hunks

				finished: function() {
					return this.hunk_index == this.source_hunks.length;
				},
				advance: function(other_state, replace_old_value) {
					// Add current hunk & reset the offset_delta because it
					// only needs to be applied once.
					this.new_hunks.push({
						offset: this.hunk.offset+this.offset_delta,
						old_value: (replace_old_value == null ? this.hunk.old_value : replace_old_value),
						new_value: this.hunk.new_value });
					this.offset_delta = 0;

					// Advance index that points to where we're at in the
					// document before the operation applies.
					this.index += this.hunk.offset + this.hunk.old_value.length;

					// Let the other side know that its offsets must be shifted
					// forward because the length of the document changed. (Use
					// the original hunk's old_value.)
					other_state.offset_delta += this.hunk.new_value.length - this.hunk.old_value.length;

					// Advance.
					this.hunk = this.source_hunks[++this.hunk_index];
				},
				insert: function(hunk, other_state) {
					this.new_hunks.push({
						offset: hunk.offset+this.offset_delta,
						old_value: hunk.old_value,
						new_value: hunk.new_value });
					this.offset_delta = 0;
					this.index += hunk.offset + hunk.old_value.length;
					other_state.offset_delta += hunk.new_value.length - hunk.old_value.length;
				},
				skip: function() {
					// The index and next offset has to be adjusted. Then advance.
					this.index += this.hunk.offset + this.hunk.old_value.length;
					this.offset_delta += this.hunk.offset + this.hunk.old_value.length;
					this.hunk = this.source_hunks[++this.hunk_index];
				}
			};
		}

		var state = {
			left: make_state(this.hunks),
			right: make_state(other.hunks)
		};

		// Process the hunks on both sides from top to bottom.
		while (!state.left.finished() || !state.right.finished()) {
			// Case 1: The hunks represent insertions at the same location.
			if (!state.left.finished() && !state.right.finished()
				 && state.left.index+state.left.hunk.offset == state.right.index+state.right.hunk.offset
				 && state.left.hunk.old_value.length == 0
				 && state.right.hunk.old_value.length == 0) {

				if (deepEqual(state.left.hunk.new_value, state.right.hunk.new_value, { strict: true })) {
					// The two insertions are equal. It doesn't matter what order
					// they go in since the document will come out exactly the
					// same.
					//
					// Just fall through.

				} else if (conflictless) {
					// In a conflictless rebase, the side with the lower sort order
					// goes first. The one going first keeps its hunk exactly
					// unchanged -- an insertion at the same index will come before
					// whatever else might have been inserted at that index already.
					// The one going second adjusts its index forward by the number
					// of elements the first hunk added.
					if (jot.cmp(state.left.hunk.new_value, state.right.hunk.new_value) < 0) {
						state.left.advance(state.right);
						continue;
					} else {
						state.right.advance(state.left);
						continue;
					}
				} else {
					// Conflict because we don't know what order to put the
					// insertions in.
					return null;
				}
			}

			// Case 2: The hunks don't overlap at all.

			// Advance over the left hunk if it appears entirely before the right hunk,
			// or there are no more right hunks.
			if (state.right.finished() ||
				(!state.left.finished() &&
				 state.left.index+state.left.hunk.offset+state.left.hunk.old_value.length
					<= state.right.index+state.right.hunk.offset)) {
				state.left.advance(state.right);
				continue;
			}

			// Advance over the right hunk if it appears entirely before the left hunk,
			// or there are no more left hunks.
			if (state.left.finished() ||
				(!state.right.finished() &&
				 state.right.index+state.right.hunk.offset+state.right.hunk.old_value.length
					<= state.left.index+state.left.hunk.offset)) {
				state.right.advance(state.left);
				continue;
			}

			// Case 3: The hunks overlap, i.e. one of these 9 cases:
			//   (a)   (b)   (c)   (d)  (e)  (f)   (g)  (h)  (i)
			//   XXX   XXX   XXX   XXX  XXX  XXX   XXX  XXX  XXX 
			//  YY    YYYY  YYYYY  YY   YYY  YYYY   Y    YY   YYY

			var dx_start = (state.left.index+state.left.hunk.offset) - (state.right.index+state.right.hunk.offset);
			var dx_end = (state.left.index+state.left.hunk.offset+state.left.hunk.old_value.length) - (state.right.index+state.right.hunk.offset+state.right.hunk.old_value.length);

			// Case 3(e) *and* the changes are identical. We can
			// avoid a conflict in this case by NO_OPing the
			// second one to apply (i.e. both left and right
			// because we're computing the two rebases at once).
			if (dx_start == 0 && dx_end == 0
				&& deepEqual(state.left.hunk.new_value, state.right.hunk.new_value, { strict: true })) {
				state.left.skip();
				state.right.skip();
				continue;
			}

			// Otherwise, without conflictless mode, there is a conflict.
			if (!conflictless)
				return null;

			// Ok now we have the 9 cases of overlap left to resolve in a
			// conflictless way...

			// Case 3(e) but the changes are not identical. We'll choose
			// as the winner the one with the longer new_value or, if
			// they have the same length, then the one with the higher
			// sort order. The winner's
			// old_value is updated with the loser's new_value, because the
			// loser already occured. The loser is NO_OP'd by skipping the
			// hunk.
			if (dx_start == 0 && dx_end == 0) {
				if (jot.cmp([state.left.hunk.new_value.length, state.left.hunk.new_value],
					        [state.right.hunk.new_value.length, state.right.hunk.new_value]) > 0) {
					// Left wins.
					state.left.advance(state.right, state.right.hunk.new_value);
					state.right.skip();
					continue;
				} else {
					// Right wins.
					state.right.advance(state.left, state.left.hunk.new_value);
					state.left.skip();
					continue;
				}
			}

			// Case 3(c) and 3(g): A side that completely ecompasses the other
			// wins. The winning side is adjusted so that its old_value reflects
			// that the losing operation has already occurred. The losing operation
			// is NO_OP'd.
			if (dx_start < 0 && dx_end > 0) {
				// 3(g), left completely encompasses right
				state.left.advance(state.right, concat3(
					state.left.hunk.old_value.slice(0, -dx_start),
					state.right.hunk.new_value,
					state.left.hunk.old_value.slice(state.left.hunk.old_value.length-dx_end)
					));
				state.right.skip();
				continue;
			}
			if (dx_start > 0 && dx_end < 0) {
				// 3(c), right completely encompasses left
				state.right.advance(state.left, concat3(
					state.right.hunk.old_value.slice(0, dx_start),
					state.left.hunk.new_value,
					state.right.hunk.old_value.slice(state.right.hunk.old_value.length+dx_end)
					));
				state.left.skip();
				continue;
			}

			// If one starts before the other, decompose it into two operations
			// where its new_value is lumped at the start and in the overlap
			// it is just a deletion.
			if (dx_start < 0) {
				// left starts first
				state.left.insert({
					offset: state.left.hunk.offset,
					old_value: state.left.hunk.old_value.slice(0, -dx_start),
					new_value: state.left.hunk.new_value
				}, state.right)
				state.left.hunk = {
					offset: 0,
					old_value: state.left.hunk.old_value.slice(-dx_start),
					new_value: state.left.hunk.new_value.slice(0, 0) // empty
				};
				continue;
			} else if (dx_start > 0) {
				// right starts first
				state.right.insert({
					offset: state.right.hunk.offset,
					old_value: state.right.hunk.old_value.slice(0, dx_start),
					new_value: state.right.hunk.new_value
				}, state.left)
				state.right.hunk = {
					offset: 0,
					old_value: state.right.hunk.old_value.slice(dx_start),
					new_value: state.right.hunk.new_value.slice(0, 0) // empty
				};
				continue;
			}

			// If one ends after the other, decompose it into two operations
			// where its new_value is lumped at the end and in the overlap
			// it is just a deletion.
			if (dx_end > 0) {
				// left ends last
				var new_hunk = {
					offset: 0,
					old_value: state.left.hunk.old_value.slice(state.left.hunk.old_value.length-dx_end),
					new_value: state.left.hunk.new_value
				};
				state.left.hunk = {
					offset: state.left.hunk.offset,
					old_value: state.left.hunk.old_value.slice(0, state.left.hunk.old_value.length-dx_end),
					new_value: state.left.hunk.new_value.slice(0, 0) // empty
				};
				state.left.source_hunks.splice(1, 0, new_hunk);
				continue;
			} else if (dx_end < 0) {
				// right ends last
				var new_hunk = {
					offset: 0,
					old_value: state.right.hunk.old_value.slice(state.right.hunk.old_value.length+dx_end),
					new_value: state.right.hunk.new_value
				};
				state.right.hunk = {
					offset: state.right.hunk.offset,
					old_value: state.right.hunk.old_value.slice(0, state.right.hunk.old_value.length+dx_end),
					new_value: state.right.hunk.new_value.slice(0, 0) // empty
				};
				state.right.source_hunks.splice(1, 0, new_hunk);
				continue;
			}

			throw "should not come here";
		}

		// Return the new operations.
		return [
			new exports.SPLICE(state.left.new_hunks).simplify(),
			new exports.SPLICE(state.right.new_hunks).simplify()]
	}],

	[exports.MOVE, function(other, conflictless) {
		// TODO
	}],
	
	[exports.APPLY, function(other, conflictless) {
		// Rebasing a SPLICE on an APPLY is easy because we can just
		// update the SPLICE's old_value to the value of the document
		// after APPLY applies (i.e. APPLY.apply(SPLICE.old_value))
		// and then treat the SPLICE as squashing the effect of the APPLY.
		// The APPLY is NO_OP'd for that index, and other indices are
		// shifted.

		var left = [];
		var seen_indexes = { };
		var index = 0;
		this.hunks.forEach(function(hunk) {
			index += hunk.offset;
			for (var i = 0; i < hunk.old_value.length; i++) {
				if (index in other.ops) {
					// Replace old_value and squash the op.
					hunk = {
						offset: hunk.offset,
						old_value: concat3(
							hunk.old_value.slice(0, i),
							unelem(other.ops[index].apply(elem(hunk.old_value, i)), hunk.old_value),
							hunk.old_value.slice(i+1)
						),
						new_value: hunk.new_value
					}
					seen_indexes[index] = true;
				}
				index++;
			}
			left.push(hunk);
		});

		// Add in any sub-operations in other that didn't overlap with the SPLICE.
		// The overlapped ones are squashed.
		var right = {};
		for (var index in other.ops) {
			index = parseInt(index);
			if (!(index in seen_indexes)) {
				var shift = 0;
				this.hunks.forEach(function(hunk) {
					if (hunk.offset + hunk.old_value.length <= index)
						shift += hunk.new_value.length - hunk.old_value.length;
				});
				right[index+shift] = other.ops[index];
			}
		}

		// Return the new operations.
		return [new exports.SPLICE(left).simplify(), new exports.APPLY(right).simplify()];

	}]
];

//////////////////////////////////////////////////////////////////////////////

exports.MOVE.prototype.inspect = function(depth) {
	return util.format("<sequences.MOVE @%dx%d => @%d>", this.pos, this.count, this.new_pos);
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

	// a SET clobbers this operation, but its old_value must be updated
	if (other instanceof values.SET)
		return new values.SET(this.invert().apply(other.old_value), other.new_value).simplify();

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

exports.APPLY.prototype.inspect = function(depth) {
	var inner = [];
	var ops = this.ops;
	Object.keys(ops).forEach(function(index) {
		inner.push(util.format("%d:%s", parseInt(index), ops[index].inspect(depth-1)));
	});
	return util.format("<sequences.APPLY %s>", inner.join(", "));
}

exports.APPLY.prototype.apply = function (document) {
	/* Applies the operation to a document. Returns a new sequence that is
	   the same type as document but with the element modified. */
	var doc = document;
	for (var index in this.ops) { // TODO: Inefficient.
		index = parseInt(index);

		var newelem = this.ops[index].apply(elem(doc, index));
		if (typeof document == "string") {
			// The operation must return a one-character string.
			if (typeof newelem != "string" || newelem.length != 1)
				throw "Invalid operation: Character became something besides a character."
		}

		doc = concat3(
			doc.slice(0, index),
			unelem(newelem),
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

exports.MAP.prototype.inspect = function(depth) {
	return util.format("<sequences.MAP %s>", this.op.inspect(depth-1));
}

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

exports.createRandomOp = function(doc, context) {
	// Create a random operation that could apply to doc.
	// Choose uniformly across various options.
	var ops = [];

	// Construct a SPLICE.
	ops.push(function() {
		var hunks = [];
		var dx = 0;

		while (dx < doc.length) {
			// Construct a random hunk. First select a range in the
			// document to modify.
			var offset = dx + Math.floor(Math.random() * (doc.length+1-dx));
			var old_length = Math.floor(Math.random() * (doc.length - offset + ((offset<doc.length) ? 1 : 0)));
			var old_value = doc.slice(offset, offset+old_length);

			if (context == "string-character") {
				// Only edits on the whole string, which is a single character, are valid.
				if (dx != 0 || doc.length != 1) throw "shouldn't happen";
				offset = 0;
				old_length = 1;
				old_value = doc;
			}
			
			// Choose a new value.
			var new_values = [];

			if (context != "string-character") {
				// The "string-character" context is when we trying to APPLY
				// to a string sequence, which only allows operations that
				// change a character to another character - the length of
				// the string can't change.

				// Delete (if not already empty).
				if (old_length > 0)
					new_values.push(old_value.slice(0, 0));

				if (old_length >= 1) {
					// shorten at start
					new_values.push(old_value.slice(Math.floor(Math.random()*(old_length-1)), old_length));

					// shorten at end
					new_values.push(old_value.slice(0, Math.floor(Math.random()*(old_length-1))));
				}

				if (old_length >= 2) {
					// shorten by on both sides
					var a = Math.floor(Math.random()*old_length-1);
					var b = Math.floor(Math.random()*(old_length-a));
					new_values.push(old_value.slice(a, a+b));
				}

				if (old_length > 0) {
					// expand by copying existing elements from document
				
					// expand by elements at start
					new_values.push(concat2(old_value.slice(0, 1+Math.floor(Math.random()*(old_length-1))), old_value));
					// expand by elements at end
					new_values.push(concat2(old_value, old_value.slice(0, 1+Math.floor(Math.random()*(old_length-1)))));
					// expand by elements on both sides
					new_values.push(concat3(old_value.slice(0, 1+Math.floor(Math.random()*(old_length-1))), old_value, old_value.slice(0, 1+Math.floor(Math.random()*(old_length-1)))));
				} else {
					// expand by generating new elements
					if (typeof doc === "string")
						new_values.push((Math.random()+"").slice(2));
					else if (Array.isArray(doc))
						new_values.push([null,null,null].map(function() { return Math.random() }));
				}
			}

			// reverse
			if (old_value != old_value.split("").reverse().join(""))
				new_values.push(old_value.split("").reverse().join(""));

			// replace with new elements of the same length
			if (old_length > 0 && typeof doc === "string") {
				var newvalue = "";
				for (var i = 0; i < old_value.length; i++)
					newvalue += (Math.random()+"").slice(2, 3);
				new_values.push(newvalue);
			}

			// Push the hunk.
			hunks.push({
				offset: offset-dx,
				old_value: old_value,
				new_value: new_values[Math.floor(Math.random() * new_values.length)]
			});

			dx = offset + old_length;

			// Create another hunk?
			if (Math.random() < .25)
				break;
		}

		return new exports.SPLICE(hunks);
	});

	// Construct an APPLY (but not an empty one on an empty string).
	if (doc.length > 0) {
		ops.push(function() {
			var ops = {};
			while (ops.length == 0 || Math.random() < .75) {
				var i = Math.floor(Math.random() * doc.length);
				ops[i] = jot.createRandomOp(
					elem(doc, i),

					// context is "string-character" when the document
					// is a string because APPLY cannot change a character
					// to something other than a character
					(typeof doc === "string" ? "string-character" : null));
			}
			return new exports.APPLY(ops);
		});
	}

	// Select randomly.
	return ops[Math.floor(Math.random() * ops.length)]();
}
