/*  JOT operations for copying and pasting values at locations
    in a document.


	*/
	
var util = require('util');
var deepEqual = require("deep-equal");
var jot = require("./index.js");

//////////////////////////////////////////////////////////////////////////////

// Global state for processing COPY/PASTE operations during apply() calls.
var apply_memory = { };

//////////////////////////////////////////////////////////////////////////////

exports.module_name = 'copy'; // for serialization/deserialization

exports.CLIPBOARD = function(op, name, copyFromClipboard) {
	if (!(op instanceof jot.BaseOperation))
		throw new Error("Argument must be an operation (got " + op + ").")
	
	// Create a name for this clipboard context for debugging.
	this.name = name || Math.random().toString(36).substring(7);

	// Bind any COPY operations within op to this CLIPBOARD and if copyFromClipboard
	// is provided, replace any COPY operations with op that are bound to
	// copyFromClipboard with a new COPY operation bound to this, and replace any
	// PASTE operations linked to those COPYs with new PASTE operations linked
	// to the corresponding new COPYs.
	if (copyFromClipboard && !(copyFromClipboard instanceof exports.CLIPBOARD))
		throw new Error("The second argument, if provided, must be a CLIPBOARD.")
	op = change_clipboard_context(op, copyFromClipboard, this);

	// Check that every PASTE comes after its COPY.
	var seen_copies = { };
	op.visit(function(op) {
		if (op instanceof exports.COPY && op.clipboard === this)
			seen_copies[op.symbol] = true;
		if (op instanceof exports.PASTE && op.copy.clipboard === this
			&& !(op.copy.symbol in seen_copies))
			throw new Error("A PASTE operation in op occurs before its COPY.")
	});

	// Create a symbol for this clipboard context so that we can use it in
	// the global apply_memory object.
	this.symbol = Symbol();

	// Store the inner operation and freeze to make this instance immutable.
	this.op = op;
	Object.freeze(this);
}
exports.CLIPBOARD.prototype = Object.create(jot.BaseOperation.prototype); // inherit
jot.add_op(exports.CLIPBOARD, exports, 'CLIPBOARD');

exports.COPY = function(name, clipboard) {
	if (typeof clipboard != "undefined" && !(clipboard instanceof exports.CLIPBOARD))
		throw new Error("The second argument, if provided, must be a CLIPBOARD.")
	this.name = name || Math.random().toString(36).substring(7);
	this.symbol = Symbol(this.name);
	this.clipboard = clipboard;
	Object.freeze(this);
}
exports.COPY.prototype = Object.create(jot.BaseOperation.prototype); // inherit
jot.add_op(exports.COPY, exports, 'COPY');

exports.PASTE = function(copy) {
	if (!(copy instanceof exports.COPY)) throw new Error("Argument must be a Copy instance.");
	this.copy = copy;
	Object.freeze(this);
}
exports.PASTE.prototype = Object.create(jot.BaseOperation.prototype); // inherit
jot.add_op(exports.PASTE, exports, 'PASTE');

//////////////////////////////////////////////////////////////////////////////

function change_clipboard_context(op, fromClipboard, toClipboard) {
	var copy_map = { };
	op = op.visit(function(op) {
		if (op instanceof exports.COPY
			&& (op.clipboard === fromClipboard || !op.clipboard)) {
			var new_copy = new exports.COPY(op.name, toClipboard);
			copy_map[op.symbol] = new_copy;
			return new_copy;
		}
	});

	op = op.visit(function(op) {
		if (op instanceof exports.PASTE && op.copy.symbol in copy_map)
			return new exports.PASTE(copy_map[op.copy.symbol]);
	});

	return op;
}

exports.CLIPBOARD.prototype.inspect = function(depth) {
	return util.format("<copy.CLIPBOARD %s %s>", this.name, this.op.inspect(depth-1));
}

exports.CLIPBOARD.prototype.visit = function(visitor) {
	// A simple visitor paradigm. Replace this operation instance itself
	// and any operation within it with the value returned by calling
	// visitor on itself, or if the visitor returns anything falsey
	// (probably undefined) then return the operation unchanged.
	var ret = new exports.CLIPBOARD(this.op.visit(visitor), this.name, this);
	return visitor(ret) || ret;
}

exports.CLIPBOARD.prototype.internalToJSON = function(json, protocol_version) {
	json.op = this.op.toJSON(undefined, protocol_version);
}

exports.CLIPBOARD.internalFromJSON = function(json, protocol_version, op_map) {
	return new exports.CLIPBOARD();
}

exports.CLIPBOARD.prototype.apply = function (document) {
	/* Applies the (inner) operation to a document. Creates a temporary
	   clipboard context for storing COPY'd values. */
	
	// Create clipboard context.
	apply_memory[this.symbol] = { };
	
	try {
		return this.op.apply(document);
	}
	finally {
		// Destroy clipboard context.
		delete apply_memory[this.symbol];
	}
}

exports.CLIPBOARD.prototype.simplify = function () {
	/* Returns a new atomic operation that is a simpler version
	   of this operation.*/

	// Simplify the inner operation.
	var op = this.op.simplify();

	// Check if there are any COPY/PASTE operations inside op for
	// this CLIPBOARD.
	var has_copy_paste = false;
	op.visit(function(op) {
		if ((op instanceof exports.COPY || op instanceof exports.PASTE)
		     && op.clipboard === this)
			has_copy_paste = true;
	});

	// If there are no COPYs for this CLIPBOARD, then return
	// the inner op --- the clipboard context is no longer relevant.
	if (!has_copy_paste)
		return op;

	// Return a new CLIPBOARD around the possibly changed op.
	return new exports.CLIPBOARD(op, this.name, this);
}

exports.CLIPBOARD.prototype.drilldown = function(index_or_key) {
	return new exports.CLIPBOARD(this.op.drilldown(index_or_key), this.name, this);
};

exports.CLIPBOARD.prototype.inverse = function (document) {
	/* Returns a new atomic operation that is the inverse of this operation,
	given the state of the document before the operation applies. */
	return new exports.CLIPBOARD(this.op.inverse(document), this.name, this);
}

exports.CLIPBOARD.prototype.atomic_compose = function (other) {
	/* Creates a new atomic operation that has the same result as this
	   and other applied in sequence (this first, other after). Returns
	   null if no atomic operation is possible. */

	// Don't compose two CLIPBOARDs because that will increase the scope
	// of the COPY/PASTE operations within them.
	if (other instanceof exports.CLIPBOARD)
		return null;

	return new exports.CLIPBOARD(this.op.compose(other), this.name, this);
}

exports.CLIPBOARD.prototype.rebase_functions = [
	[jot.BaseOperation, function(other, conflictless) {
		// CLIPBOARD rebases against any other operation
		// by rebasing its innards.
		var inner1 = this.op.rebase(other, conflictless);
		if (inner1 == null) return null;

		var inner2 = other.rebase(this.op, conflictless);
		if (inner2 == null) return null;

		return [inner1, inner2];
	}]
];

//////////////////////////////////////////////////////////////////////////////

exports.COPY.prototype.inspect = function(depth) {
	return util.format("<copy.COPY %s %s>",
		this.name,
		this.clipboard ? ("in " + this.clipboard.name) : "(unbound)");
}

exports.COPY.prototype.internalToJSON = function(json, protocol_version) {
	// TODO
}

exports.COPY.internalFromJSON = function(json, protocol_version, op_map) {
	// TODO
	return new exports.COPY();
}

exports.COPY.prototype.apply = function (document) {
	// The COPY operation doesn't change the document.
	// It just places a copy of the document in its clipboard context memory.
	if (typeof this.clipboard == "undefined")
		throw new Error("This COPY is not yet bound to a CLIPBOARD.");
	if (typeof apply_memory[this.clipboard.symbol] !== "object")
		throw new Error("This COPY is bound to a CLIPBOARD but the CLIPBOARD's apply() function does not seem to have been called higher up in the call stack.");
	apply_memory[this.clipboard.symbol][this.symbol] = JSON.parse(JSON.stringify(document)); // clone
	return document;
}

exports.COPY.prototype.getValue = function() {
	if (typeof this.clipboard == "undefined")
		throw new Error("This COPY is not yet bound to a CLIPBOARD.");
	if (typeof apply_memory[this.clipboard.symbol] !== "object")
		throw new Error("This COPY is bound to a CLIPBOARD but the CLIPBOARD's apply() function does not seem to have been called higher up in the call stack.");
	return apply_memory[this.clipboard.symbol][this.symbol];
}

exports.COPY.prototype.simplify = function () {
	/* Returns a new atomic operation that is a simpler version
	   of this operation.*/
	return this;
}

exports.COPY.prototype.inverse = function (document) {
	/* Returns a new atomic operation that is the inverse of this operation,
	given the state of the document before the operation applies. */
	// TODO?
	return this;
}

exports.COPY.prototype.atomic_compose = function (other) {
	/* Creates a new atomic operation that has the same result as this
	   and other applied in sequence (this first, other after). Returns
	   null if no atomic operation is possible. */
	return null;
}

exports.COPY.prototype.rebase_functions = [
	[jot.BaseOperation, function(other, conflictless) {
		// COPY operations do not affect any other operation.
		return [this, other];
	}]
];

exports.COPY.prototype.get_length_change = function (old_length) {
	// Support routine for sequences.PATCH that returns the change in
	// length to a sequence if this operation is applied to it.
	return 0;
}

exports.COPY.prototype.decompose = function (in_out, at_index) {
	// Support routine for when this operation is used as a hunk's
	// op in sequences.PATCH (i.e. its document is a string or array
	// sub-sequence) that returns a decomposition of the operation
	// into two operations, one that applies on the left of the
	// sequence and one on the right of the sequence, such that
	// the length of the input (if !in_out) or output (if in_out)
	// of the left operation is at_index, i.e. the split point
	// at_index is relative to the document either before (if
	// !in_out) or after (if in_out) this operation applies.
	
	// Since COPY has no effect, its decomposition is trivial.
	return [this, this];
}


//////////////////////////////////////////////////////////////////////////////

exports.PASTE.prototype.inspect = function(depth) {
	return util.format("<copy.PASTE %s %s>",
		this.copy.name,
		this.copy.clipboard ? ("in " + this.copy.clipboard.name) : "(unbound)");
}

exports.PASTE.prototype.internalToJSON = function(json, protocol_version) {
	// TODO
}

exports.PASTE.internalFromJSON = function(json, protocol_version, op_map) {
	// TODO
	return new exports.PASTE();
}

exports.PASTE.prototype.apply = function (document) {
	// The PASTE operation ignores the document and instead returns the copied
	// value.
	return this.copy.getValue();
}

exports.PASTE.prototype.simplify = function () {
	/* Returns a new atomic operation that is a simpler version
	   of this operation.*/
	return this;
}

exports.PASTE.prototype.inverse = function (document) {
	/* Returns a new atomic operation that is the inverse of this operation,
	given the state of the document before the operation applies. */
	return new jot.SET(document);
}

exports.PASTE.prototype.atomic_compose = function (other) {
	/* Creates a new atomic operation that has the same result as this
	   and other applied in sequence (this first, other after). Returns
	   null if no atomic operation is possible. */
	return null;
}
