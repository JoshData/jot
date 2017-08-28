/* An operational transformation library for sequence-like objects,
   i.e. strings and arrays.

   The main operation provided by this library is PATCH, which represents
   a set of non-overlapping changes to a string or array. Each change,
   called a hunk, applies an operation to a subsequence -- i.e. a sub-string
   or a slice of the array. The operation's .apply method yields a new
   sub-sequence, and they are stitched together (along with unchanged elements)
   to form the new document that results from the PATCH operation.

   The internal structure of the PATCH operation is an array of hunks as
   follows:

   new sequences.PATCH(
     [
       { offset: ..., # unchanged elements to skip before this hunk
         length: ..., # length of subsequence modified by this hunk
         op: ...      # jot operation to apply to the subsequence
       },
       ...
     ]
    )

   The operation must define a "get_length_change" function that returns the
   length of the subsequence after the operation is applied. Composition and
   conflictless rebasing are also supported by a "decompose_right" function on
   the inner operation. NO_OP, SET, and MAP define these functions.

   This library also defines the MAP operation, which applies a jot
   operation to every element of a sequence. The MAP operation is
   also used with length-one hunks to apply an operation to a single
   element. On strings, the MAP operation only accepts inner operations
   that yield back single characters so that a MAP on a string does
   not change the string's length.

   The internal structure of the MAP operation is:

   new sequences.MAP(op)
 
   Shortcuts for constructing useful PATCH operations are provided:

		new sequences.SPLICE(pos, length, value)

			 Equivalent to:

			 PATCH([{
				 offset: pos,
				 length: length,
				 op: new values.SET(value)
				 }])
			 
			 i.e. replace elements with other elements
		
		new sequences.APPLY(pos, op)

			 Equivalent to:

			 PATCH([{
				 offset: pos,
				 length: 1,
				 op: new sequences.MAP(op)
				 }])
			 
			 i.e. apply the operation to the single element at pos

		new sequences.APPLY({ pos: op, ... })

			 Similar to the above but for multiple operations at once.

		Supports a conflictless rebase with other PATCH operations.

	 */
	 
var util = require('util');
var deepEqual = require("deep-equal");
var jot = require("./index.js");
var values = require("./values.js");
var LIST = require("./lists.js").LIST;

// utilities

function elem(seq, pos) {
	// get an element of the sequence
	if (typeof seq == "string")
		return seq.charAt(pos);
	else // is an array
		return seq[pos];
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
function map_index(pos, move_op) {
	if (pos >= move_op.pos && pos < move_op.pos+move_op.count) return (pos-move_op.pos) + move_op.new_pos; // within the move
	if (pos < move_op.pos && pos < move_op.new_pos) return pos; // before the move
	if (pos < move_op.pos) return pos + move_op.count; // a moved around by from right to left
	if (pos > move_op.pos && pos >= move_op.new_pos) return pos; // after the move
	if (pos > move_op.pos) return pos - move_op.count; // a moved around by from left to right
	throw new Error("unhandled problem");
}

//////////////////////////////////////////////////////////////////////////////

exports.module_name = 'sequences'; // for serialization/deserialization

exports.PATCH = function () {
	/* An operation that replaces a subrange of the sequence with new elements. */
	if (arguments[0] === "__hmm__") return; // used for subclassing
	if (arguments.length != 1)
		throw new Error("Invaid Argument");

	this.hunks = arguments[0];

	// Sanity check & freeze hunks.
	if (!Array.isArray(this.hunks))
		throw new Error("Invaid Argument");
	this.hunks.forEach(function(hunk) {
		if (typeof hunk.offset != "number")
			throw new Error("Invalid Argument (hunk offset not a number)");
		if (hunk.offset < 0)
			throw new Error("Invalid Argument (hunk offset is negative)");
		if (typeof hunk.length != "number")
			throw new Error("Invalid Argument (hunk length is not a number)");
		if (hunk.length < 0)
			throw new Error("Invalid Argument (hunk length is negative)");
		if (!(hunk.op instanceof jot.BaseOperation))
			throw new Error("Invalid Argument (hunk operation is not an operation)");
		if (typeof hunk.op.get_length_change != "function")
			throw new Error("Invalid Argument (hunk operation does not support get_length_change)");
		Object.freeze(hunk);
	});

	Object.freeze(this);
}
exports.PATCH.prototype = Object.create(jot.BaseOperation.prototype); // inherit
jot.add_op(exports.PATCH, exports, 'PATCH', ['hunks']);

	// shortcuts

	exports.SPLICE = function (pos, length, value) {
		// value.slice(0,0) is a shorthand for constructing an empty string or empty list, generically
		exports.PATCH.apply(this, [[{
			offset: pos,
			length: length,
			op: new values.SET(value)
		}]]);
	}
	exports.SPLICE.prototype = new exports.PATCH("__hmm__"); // inherit prototype

	exports.APPLY = function () {
		var indexes;
		var op_map;
		if (arguments.length == 1) {
			// The argument is a mapping from indexes to operations to apply
			// at those indexes. Collect all of the integer indexes in sorted
			// order.
			op_map = arguments[0];
			indexes = [];
			Object.keys(op_map).forEach(function(index) { indexes.push(parseInt(index)); });
			indexes.sort();
		} else if (arguments.length == 2) {
			// The arguments are just a single position and operation.
			indexes = [arguments[0]];
			op_map = { };
			op_map[arguments[0]] = arguments[1];
		} else {
			throw new Error("Invalid Argument")
		}

		// Form hunks.
		var hunks = [];
		var offset = 0;
		indexes.forEach(function(index) {
			hunks.push({
				offset: index-offset,
				length: 1,
				op: new exports.MAP(op_map[index])
			})
			offset = index+1;
		});
		exports.PATCH.apply(this, [hunks]);
	}
	exports.APPLY.prototype = new exports.PATCH("__hmm__"); // inherit prototype

exports.MOVE = function (pos, count, new_pos) {
	if (pos == null || count == null || count == 0 || new_pos == null) throw new Error("Invalid Argument");
	this.pos = pos;
	this.count = count;
	this.new_pos = new_pos;
	Object.freeze(this);
}
exports.MOVE.prototype = Object.create(jot.BaseOperation.prototype); // inherit
jot.add_op(exports.MOVE, exports, 'MOVE', ['pos', 'count', 'new_pos']);

exports.MAP = function (op) {
	if (op == null) throw new Error("Invalid Argument");
	this.op = op;
	Object.freeze(this);
}
exports.MAP.prototype = Object.create(jot.BaseOperation.prototype); // inherit
jot.add_op(exports.MAP, exports, 'MAP', ['op']);

//////////////////////////////////////////////////////////////////////////////

exports.PATCH.prototype.inspect = function(depth) {
	return util.format("<sequences.PATCH%s>",
		this.hunks.map(function(hunk) {
			if ((hunk.length == 1) && (hunk.op instanceof exports.MAP))
				// special format
				return util.format(" +%d %s",
					hunk.offset,
					hunk.op.op.inspect(depth-1));

			return util.format(" +%dx%d %s",
				hunk.offset,
				hunk.length,
				hunk.op instanceof values.SET
					? util.format("%j", hunk.op.value)
					: hunk.op.inspect(depth-1))
		}).join(","));
}

exports.PATCH.prototype.apply = function (document) {
	/* Applies the operation to a document. Returns a new sequence that is
		 the same type as document but with the hunks applied. */
	
	var index = 0;
	var ret = document.slice(0,0); // start with an empty document
	
	this.hunks.forEach(function(hunk) {
		if (index + hunk.offset + hunk.length > document.length)
			throw new Error("offset past end of document");

		// Append unchanged content before this hunk.
		ret = concat2(ret, document.slice(index, index+hunk.offset));
		index += hunk.offset;

		// Append new content.
		var new_value = hunk.op.apply(document.slice(index, index+hunk.length));

		if (typeof document == "string" && typeof new_value != "string")
			throw new Error("operation yielded invalid substring");
		if (Array.isArray(document) && !Array.isArray(new_value))
			throw new Error("operation yielded invalid subarray");

		ret = concat2(ret, new_value);

		// Advance counter.
		index += hunk.length;
	});
	
	// Append unchanged content after the last hunk.
	ret = concat2(ret, document.slice(index));
	
	return ret;
}

exports.PATCH.prototype.simplify = function () {
	/* Returns a new atomic operation that is a simpler version
		 of this operation.*/

	// Simplify the hunks by removing any that don't make changes.
	// Adjust offsets.

	// Some of the composition methods require knowing if these operations
	// are operating on a string or an array. We might not know if the PATCH
	// only has sub-operations where we can't tell, like a MAP.
	var doctype = null;
	this.hunks.forEach(function (hunk) {
		if (hunk.op instanceof values.SET) {
			if (typeof hunk.op.value == "string")
				doctype = "string";
			else if (Array.isArray(hunk.op.value))
				doctype = "array";
		}
	});

	// Form a new set of merged hunks.

	var hunks = [];
	var doffset = 0;

	function handle_hunk(hunk) {
		var op = hunk.op.simplify();
		
		if (op.isNoOp()) {
			// Drop it, but adjust future offsets.
			doffset += hunk.offset + hunk.length;
			return;

		} else if (hunk.length == 0 && hunk.op.get_length_change(hunk.length) == 0) {
			// Drop it, but adjust future offsets.
			doffset += hunk.offset;
			return;

		} else if (op instanceof exports.PATCH) {
			// A PATCH within a PATCH, fun. Account for the range
			// after the last inner hunk through the end of the
			// outer hunk.
			var count = 0;
			op.hunks.forEach(function(hunk) {
				handle_hunk(hunk);
				count += hunk.offset + hunk.length;
			});
			doffset += hunk.length - count;
			return;

		} else if (hunks.length > 0
			&& hunk.offset + doffset == 0) {
			
			// The hunks are adjacent. We can combine them
			// if one of the operations is a SET and the other
			// is a SET or a MAP containing a SET.
			// We can't combine two adjancent MAP->SET's because
			// we wouldn't know whether the combined value (in
			// a SET) should be a string or an array.
			if ((hunks[hunks.length-1].op instanceof values.SET
				|| (hunks[hunks.length-1].op instanceof exports.MAP && hunks[hunks.length-1].op.op instanceof values.SET))
			 && (hunk.op instanceof values.SET || 
			 	  (hunk.op instanceof exports.MAP && hunk.op.op instanceof values.SET) )
			 && doctype != null) {

				function get_value(hunk) {
				 	if (hunk.op instanceof values.SET) {
				 		// The value is just the SET's value.
				 		return hunk.op.value;
				 	} else {
				 		// The value is a sequence of the hunk's length
				 		// where each element is the value of the inner
				 		// SET's value.
					 	var value = [];
					 	for (var i = 0; i < hunk.length; i++)
					 		value.push(hunk.op.op.value);

					 	// If the outer value is a string, reform it as
					 	// a string.
					 	if (doctype == "string")
					 		value = value.join("");
					 	return value;
				 	}
				}

				hunks[hunks.length-1] = {
					offset: hunks[hunks.length-1].offset,
					length: hunks[hunks.length-1].length + hunk.length,
					op: new values.SET(
						concat2(
							get_value(hunks[hunks.length-1]),
							get_value(hunk))
						)
				};

				return;
			}

		}

		// Preserve but adjust offset.
		var newhunk = {
			offset: hunk.offset+doffset,
			length: hunk.length,
			op: op
		}
		hunks.push(newhunk);
	}
	
	this.hunks.forEach(handle_hunk);
	if (hunks.length == 0)
		return new values.NO_OP();
	
	return new exports.PATCH(hunks);
}

exports.PATCH.prototype.inverse = function (document) {
	/* Returns a new atomic operation that is the inverse of this operation,
	   given the state of the document before this operation applies.
	   The inverse simply inverts the operations on the hunks, but the
	   lengths have to be fixed. */
	var offset = 0;
	return new exports.PATCH(this.hunks.map(function(hunk) {
		var newhunk = {
			offset: hunk.offset,
			length: hunk.length + hunk.op.get_length_change(hunk.length),
			op: hunk.op.inverse(document.slice(offset+hunk.offset, offset+hunk.offset+hunk.length))
		}
		offset += hunk.offset + hunk.length;
		return newhunk;
	}));
}

function compose_patches(a, b) {
	// Compose two patches. We do this as if we are zipping up two sequences,
	// where the index into the (hypothetical) sequence that results *after*
	// a is applied lines up with the index into the (hypothetical) sequence
	// before b is applied.
	
	var hunks = [];
	var index = 0;

	function make_state(op, side) {
		return {
			index: 0,
			hunks: op.hunks.slice(),
			empty: function() { return this.hunks.length == 0; },
			take: function() {
				var h = this.hunks[0];
				hunks.push({
					offset: this.index + h.offset - index,
					length: h.length,
					op: h.op
				});
				this.index = this.end();
				index = this.index;
				this.hunks.shift();
			},
			skip: function() {
				this.index = this.end();
				this.hunks.shift();
			},
			start: function() {
				return this.index + this.hunks[0].offset;
			},
			end: function() {
				var h = this.hunks[0];
				var ret = this.index + h.offset + h.length;
				if (side == 0)
					ret += h.op.get_length_change(h.length);
				return ret;
			}
		}
	}
	
	var a_state = make_state(a, 0),
	    b_state = make_state(b, 1);
	
	while (!a_state.empty() || !b_state.empty()) {
		// Only operations in 'a' are remaining.
		if (b_state.empty()) {
			a_state.take();
			continue;
		}

		// Only operations in 'b' are remaining.
		if (a_state.empty()) {
			b_state.take();
			continue;
		}

		// The next hunk in 'a' precedes the next hunk in 'b'.
		if (a_state.end() <= b_state.start()) {
			a_state.take();
			continue;
		}

		// The next hunk in 'b' precedes the next hunk in 'a'.
		if (b_state.end() <= a_state.start()) {
			b_state.take();
			continue;
		}

		// There's overlap.

		var dx_start = b_state.start() - a_state.start();
		var dx_end = b_state.end() - a_state.end();
		if (dx_start >= 0 && dx_end <= 0) {
			// 'a' wholly encompasses 'b', including the case where they
			// changed the exact same elements.

			// Compose a's and b's suboperations using
			// atomic_compose. If the two hunks changed the exact same
			// elements, then we can compose the two operations directly.
			var b_op = b_state.hunks[0].op;
			if (dx_start != 0 || dx_end != 0) {
				// If 'a' whole encompasses 'b', we can make an operation
				// that spans the same elements by wrapping b's operation
				// in a PATCH.
				b_op = new exports.PATCH([{ offset: dx_start, length: b_state.hunks[0].length, op: b_op }]);
			}

			// Replace the 'a' operation with itself composed with b's operation.
			// Don't take it yet because there could be more coming on b's
			// side that is within the range of 'a'.
			a_state.hunks[0] = {
				offset: a_state.hunks[0].offset,
				length: a_state.hunks[0].length,
				op: a_state.hunks[0].op.atomic_compose(b_op)
			};
			if (a_state.hunks[0].op == null)
				return null;

			// Drop b.
			b_state.skip();
			continue;
		}

		if (dx_start <= 0 && dx_end >= 0) {
			// 'b' wholly consumes 'a'. We can't drop a's operation, in the
			// general case. If 'b' is a SET, then we can drop a's operation
			// because we know it does not depend on prior state. Same with
			// NO_OP. In either case we have to update b's length since it
			// is operating on elements that were inserted/deleted by a.
			if (b_state.hunks[0].op.isNoOp()
				|| b_state.hunks[0].op instanceof values.SET) {
				b_state.take();
				hunks[hunks.length-1].length -= a_state.hunks[0].op.get_length_change(a_state.hunks[0].length);
				a_state.skip();
				continue;
			}
		}

		// There is some sort of other overlap. We can handle this by attempting
		// to decompose the operations.
		if (dx_start > 0) {
			// 'a' begins first. Attempt to decompose it into two operations.
			if (!a_state.hunks[0].op.decompose_right)
				return null;
			var decomp = a_state.hunks[0].op.decompose_right(dx_start);
			if (!decomp)
				return null;

			// Take the left part of the decomposition.
			hunks.push({
				offset: a_state.index + a_state.hunks[0].offset - index,
				length: a_state.hunks[0].length,
				op: decomp[0]
			});
			a_state.index += dx_start;
			index += dx_start;

			// Return the right part of the decomposition to the hunks array.
			a_state.hunks[0] = {
				offset: 0,
				length: 0,
				op: decomp[1]
			};
			continue;
		}

		if (dx_start < 0) {
			// 'b' begins first. Attempt to decompose it into two operations.
			// The decompose_right method takes an index into the sequence
			// after the operation applies, but dx_start applies to the
			// document before 'b' applies, so we pass it an arbitrary
			// index of zero.
			if (!b_state.hunks[0].op.decompose_right)
				return null;
			var decomp = b_state.hunks[0].op.decompose_right(0);
			if (!decomp)
				return null;

			// Take the left part of the decomposition.
			hunks.push({
				offset: b_state.index + b_state.hunks[0].offset - index,
				length: (-dx_start),
				op: decomp[0]
			});
			b_state.index += (-dx_start);
			index += (-dx_start);

			// Return the right part of the decomposition to the hunks array.
			b_state.hunks[0] = {
				offset: 0,
				length: b_state.hunks[0].length - (-dx_start),
				op: decomp[1]
			};
			continue;
		}

		// There is no atomic composition.
		return null;
	}

	return new exports.PATCH(hunks).simplify();
}

exports.PATCH.prototype.atomic_compose = function (other) {
	/* Creates a new atomic operation that has the same result as this
		 and other applied in sequence (this first, other after). Returns
		 null if no atomic operation is possible. */

	// a PATCH composes with a PATCH
	if (other instanceof exports.PATCH)
		return compose_patches(this, other);

	// No composition possible.
	return null;
}

function rebase_patches(a, b, conflictless) {
	// Rebasing two PATCHes works like compose, except that we are aligning
	// 'a' and 'b' both on the state of the document before each has applied.
	//
	// We do this as if we are zipping up two sequences, where the index into
	// the (hypothetical) sequence, before either operation applies, lines
	// up across the two operations.
	
	function make_state(op) {
		return {
			old_index: 0,
			old_hunks: op.hunks.slice(),
			new_index: 0,
			new_hunks: [],
			empty: function() { return this.old_hunks.length == 0; },
			take: function() {
				var h = this.old_hunks[0];
				this.new_hunks.push({
					offset: this.old_index + h.offset - this.new_index,
					length: h.length,
					op: h.op
				});
				this.old_index = this.end();
				this.new_index = this.old_index;
				this.old_hunks.shift();
			},
			skip: function() {
				this.old_index = this.end();
				this.old_hunks.shift();
			},
			start: function() {
				return this.old_index + this.old_hunks[0].offset;
			},
			end: function() {
				var h = this.old_hunks[0];
				return this.old_index + h.offset + h.length;
			}
		}
	}
	
	var a_state = make_state(a),
	    b_state = make_state(b);
	
	while (!a_state.empty() || !b_state.empty()) {
		// Only operations in 'a' are remaining.
		if (b_state.empty()) {
			a_state.take();
			continue;
		}

		// Only operations in 'b' are remaining.
		if (a_state.empty()) {
			b_state.take();
			continue;
		}

		// Two insertions at the same location.
		if (a_state.start() == b_state.start()
			&& a_state.old_hunks[0].length == 0
			&& b_state.old_hunks[0].length == 0) {
			
			// This is a conflict because we don't know which side
			// gets inserted first.
			if (!conflictless)
				return null;

			// Or we can resolve the conflict.
			if (jot.cmp(a_state.old_hunks[0].op, b_state.old_hunks[0].op) < 0) {
				b_state.new_index -= a_state.old_hunks[0].op.get_length_change(a_state.old_hunks[0].length);
				a_state.take();
			} else {
				a_state.new_index -= b_state.old_hunks[0].op.get_length_change(b_state.old_hunks[0].length);
				b_state.take();
			}
			continue;
		}


		// The next hunk in 'a' precedes the next hunk in 'b'.
		// Take 'a' and adjust b's next offset.
		if (a_state.end() <= b_state.start()) {
			b_state.new_index -= a_state.old_hunks[0].op.get_length_change(a_state.old_hunks[0].length);
			a_state.take();
			continue;
		}

		// The next hunk in 'b' precedes the next hunk in 'a'.
		// Take 'b' and adjust a's next offset.
		if (b_state.end() <= a_state.start()) {
			a_state.new_index -= b_state.old_hunks[0].op.get_length_change(b_state.old_hunks[0].length);
			b_state.take();
			continue;
		}

		// There's overlap.

		var dx_start = b_state.start() - a_state.start();
		var dx_end = b_state.end() - a_state.end();

		// They both affected the exact same region, so just rebase the
		// inner operations and update lengths.
		if (dx_start == 0 && dx_end == 0) {
			// When conflictless is supplied with a prior document state,
			// the state represents the sequence, so we have to dig into
			// it and pass an inner value
			var conflictless2 = !conflictless ? null : Object.assign({}, conflictless);
			if (conflictless2 && "document" in conflictless2)
				conflictless2.document = conflictless2.document.slice(a_state.start(), a_state.end());

			var ar = a_state.old_hunks[0].op.rebase(b_state.old_hunks[0].op, conflictless2);
			var br = b_state.old_hunks[0].op.rebase(a_state.old_hunks[0].op, conflictless2);
			if (ar == null || br == null)
				return null;
			a_state.old_hunks[0] = {
				offset: a_state.old_hunks[0].offset,
				length: a_state.old_hunks[0].length + b_state.old_hunks[0].op.get_length_change(b_state.old_hunks[0].length),
				op: ar
			}
			b_state.old_hunks[0] = {
				offset: b_state.old_hunks[0].offset,
				length: b_state.old_hunks[0].length + a_state.old_hunks[0].op.get_length_change(a_state.old_hunks[0].length),
				op: br
			}
			a_state.take();
			b_state.take();
			continue;
		}

		// Other overlaps generate conflicts.
		if (!conflictless)
			return null;

		throw "not implemented";

		// One side starts before the other. Take it.
		if (dx_start > 0) {
			// 'a' starts first.
			
		}
	}

	return [
		new exports.PATCH(a_state.new_hunks).simplify(),
		new exports.PATCH(b_state.new_hunks).simplify() ];
}

exports.PATCH.prototype.rebase_functions = [
	/* Transforms this operation so that it can be composed *after* the other
		 operation to yield the same logical effect. Returns null on conflict. */

	[exports.PATCH, function(other, conflictless) {
		// Return the new operations.
		return rebase_patches(this, other, conflictless);
	}],

	[exports.MOVE, function(other, conflictless) {
		// TODO
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

exports.MOVE.prototype.inverse = function (document) {
	/* Returns a new atomic operation that is the inverse of this operation */
	if (this.new_pos > this.pos)
		return new exports.MOVE(this.new_pos - this.count, this.count, this.pos);
	else
		return new exports.MOVE(this.new_pos, this.count, this.pos + this.count);
}

exports.MOVE.prototype.atomic_compose = function (other) {
	/* Creates a new atomic operation that has the same result as this
		 and other applied in sequence (this first, other after). Returns
		 null if no atomic operation is possible. */

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
	[exports.MAP, function(other, conflictless) {
		// The MOVE changes the order but not the values and the MAP changes
		// values but doesn't care about order, so they don't bother each other.
		return [this, other];
	}]
];

//////////////////////////////////////////////////////////////////////////////

exports.MAP.prototype.inspect = function(depth) {
	return util.format("<sequences.MAP %s>", this.op.inspect(depth-1));
}

exports.MAP.prototype.apply = function (document) {
	/* Applies the operation to a document. Returns a new sequence that is
		 the same type as document but with the element modified. */

 	// Turn string into array of characters.
	var d;
	if (typeof document == 'string')
		d = document.split(/.{0}/)

	// Clone array.
	else
		d = document.slice(); // clone
	
	// Apply operation to each element.
	for (var i = 0; i < d.length; i++) {
		d[i] = this.op.apply(d[i])

		// An operation on strings must return a single character.
		if (typeof document == 'string' && (typeof d[i] != 'string' || d[i].length != 1))
			throw new Error("Invalid operation: String type or length changed.")
	}

	// Turn the array of characters back into a string.
	if (typeof document == 'string')
		return d.join("");

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

exports.MAP.prototype.inverse = function (document) {
	/* Returns a new atomic operation that is the inverse of this operation. */

	if (document.length == 0)
		return new exports.NO_OP();
	if (document.length == 1)
		return new exports.MAP(this.op.inverse(document[0]));

	// Since the inverse depends on the value of the document and the
	// elements of document may not all be the same, we have to explode
	// this out into individual operations.
	var hunks = [];
	if (typeof document == 'string')
		document = document.split(/.{0}/);
	document.forEach(function(element) {
		hunks.append({
			offset: 0,
			length: 1,
			op: this.op.inverse(element)
		});
	});
	return new exports.PATCH(hunks);
}

exports.MAP.prototype.atomic_compose = function (other) {
	/* Creates a new atomic operation that has the same result as this
		 and other applied in sequence (this first, other after). Returns
		 null if no atomic operation is possible. */

	// two MAPs with atomically composable sub-operations
	if (other instanceof exports.MAP) {
		var op2 = this.op.atomic_compose(other.op);
		if (op2)
			return new exports.MAP(op2);
	}

	// No composition possible.
	return null;
}

exports.MAP.prototype.rebase_functions = [
	[exports.MAP, function(other, conflictless) {
		// Two MAPs. The rebase succeeds only if a rebase on the
		// inner operations succeeds.
		var opa;
		var opb;

		// If conflictless is null or there is no prior document
		// state, then it's safe to pass conflictless into the
		// inner operations.
		if (!conflictless || !("document" in conflictless)) {
			opa = this.op.rebase(other.op, conflictless);
			opb = other.op.rebase(this.op, conflictless);

		// If there is a single element in the prior document
		// state, then unwrap it for the inner operations.
		} else if (conflictless.document.length == 1) {
			var conflictless2 = Object.assign({}, conflictless); // clone
			conflictless2.document = conflictless2.document[0];

			opa = this.op.rebase(other.op, conflictless2);
			opb = other.op.rebase(this.op, conflictless2);

		// If the prior document state is an empty array, then
		// we know these operations are NO_OPs anyway.
		} else if (conflictless.document.length == 0) {
			return [
				new jot.NO_OP(),
				new jot.NO_OP()
			];

		// The prior document state is an array of more than one
		// element. In order to pass the prior document state into
		// the inner operations, we have to try it for each element
		// of the prior document state. If they all yield the same
		// operation, then we can use that operation. Otherwise the
		// rebases are too sensitive on prior document state and
		// we can't rebase.
		} else {
			var ok = true;
			for (var i = 0; i < conflictless.document.length; i++) {
				var conflictless2 = Object.assign({}, conflictless); // clone
				conflictless2.document = conflictless.document[i];

				var a = this.op.rebase(other.op, conflictless2);
				var b = other.op.rebase(this.op, conflictless2);
				if (i == 0) {
					opa = a;
					opb = b;
				} else {
					if (!deepEqual(opa, a, { strict: true }))
						ok = false;
					if (!deepEqual(opb, b, { strict: true }))
						ok = false;
				}
			}

			if (!ok) {
				// The rebases were not the same for all elements. Decompose
				// the MAPs into PATCHes with individual hunks for each index,
				// and then rebase those.
				var _this = this;
				opa = new exports.PATCH(
					conflictless.document.map(function(item) {
						return {
							offset: 0,
							length: 1,
							op: _this
						}
					}));
				opb = new exports.PATCH(
					conflictless.document.map(function(item) {
						return {
							offset: 0,
							length: 1,
							op: other
						}
					}));
				return rebase_patches(opa, opb, conflictless);
			}
		}


		if (opa && opb)
			return [
				(opa instanceof values.NO_OP) ? new values.NO_OP() : new exports.MAP(opa),
				(opb instanceof values.NO_OP) ? new values.NO_OP() : new exports.MAP(opb)
			];
	}],

	[exports.PATCH, function(other, conflictless) {
		// Rebase MAP and PATCH. Only a conflictless rebase is possible,
		// and prior document state is required.
		if (conflictless && conflictless.document) {
			// Wrap MAP in a PATCH that spans the whole sequence, and then
			// use rebase_patches. This will jump ahead to comparing the
			// MAP to the PATCH's inner operations.
			return rebase_patches(
				new exports.PATCH([{ offset: 0, length: conflictless.document.length, op: this}]),
				other,
				conflictless);

			/*
			// Alternatively:
			// Since the MAP doesn't change the number of elements in the sequence,
			// it makes sense to have the MAP go first.
			// But we don't do this because we have to return a SET so that LIST.rebase
			// doesn't go into infinite recursion by returning a LIST from a rebase,
			// and SET loses logical structure.
			return [
				// MAP is coming second, so create an operation that undoes
				// the patch, applies the map, and then applies the patch.
				// See values.MATH.rebase for why we return a SET.
				new jot.SET(this.compose(other).apply(conflictless.document)),
				//other.inverse(conflictless.document).compose(this).compose(other),

				// PATCH is coming second, which is right
				other
			];
			*/
		}
	}]
];

exports.MAP.prototype.get_length_change = function (old_length) {
	// Support routine for PATCH that returns the change in
	// length to a sequence if this operation is applied to it.
	return 0;
}

exports.MAP.prototype.decompose_right = function (at_old_index, at_new_index) {
	// Support routine for PATCH that returns a decomposition of the
	// operation splitting it at a point in the subsequence this operation
	// applies to. But since MAP applies to all elements, the decomposition
	// is trivial.
	return [this, this];
}

////

exports.createRandomOp = function(doc, context) {
	// Create a random operation that could apply to doc.
	// Choose uniformly across various options.
	var ops = [];

	// Construct a PATCH.
	ops.push(function() {
		var hunks = [];
		var dx = 0;

		while (dx < doc.length) {
			// Construct a random hunk. First select a range in the
			// document to modify.
			var offset = dx + Math.floor(Math.random() * (doc.length+1-dx));
			var old_length = Math.floor(Math.random() * (doc.length - offset + ((offset<doc.length) ? 1 : 0)));
			var old_value = doc.slice(offset, offset+old_length);

			// Choose an inner operation. Only ops in values can be used
			// because ops within PATCH must support get_length_change.
			var op = values.createRandomOp(old_value, context);

			// Push the hunk.
			hunks.push({
				offset: offset-dx,
				length: old_length,
				op: op
			});

			dx = offset + old_length;

			// Create another hunk?
			if (Math.random() < .25)
				break;
		}

		return new exports.PATCH(hunks);
	});

	// Construct a MAP. We may not construct a valid MAP because
	// the random inner operation that we construct for one element
	// may not be valid on all elements.
	if (doc.length > 0) {
		ops.push(function() {
			var random_elem = elem(doc, Math.floor(Math.random() * doc.length));
			var op = values.createRandomOp(random_elem, context);
			return new exports.MAP(op);
		});
	}

	// Select randomly.
	return ops[Math.floor(Math.random() * ops.length)]();
}
