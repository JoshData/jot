/*  A library of meta-operations.
	
	LIST(array_of_operations)
	
	A composition of zero or more operations, given as an array.

	*/
	
var util = require("util");

var jot = require("./index.js");
var values = require('./values.js');

exports.module_name = 'meta'; // for serialization/deserialization

exports.LIST = function (ops) {
	if (ops == null) throw new Error("Invalid Argument");
	if (!(ops instanceof Array)) throw new Error("Invalid Argument");
	this.ops = ops; // TODO: How to ensure this array is immutable?
	Object.freeze(this);
}
exports.LIST.prototype = Object.create(jot.BaseOperation.prototype); // inherit
jot.add_op(exports.LIST, exports, 'LIST', ['ops']);

exports.LIST.prototype.inspect = function(depth) {
	return util.format("<meta.LIST [%s]>",
		this.ops.map(function(item) { return item.inspect(depth-1) }).join(", "));
}

exports.LIST.prototype.apply = function (document) {
	/* Applies the operation to a document.*/
	for (var i = 0; i < this.ops.length; i++)
		document = this.ops[i].apply(document);
	return document;
}

exports.LIST.prototype.simplify = function (aggressive) {
	/* Returns a new operation that is a simpler version
	   of this operation. Composes consecutive operations where
	   possible and removes no-ops. Returns NO_OP if the result
	   would be an empty list of operations. Returns an
	   atomic (non-LIST) operation if possible. */
	var new_ops = [];
	for (var i = 0; i < this.ops.length; i++) {
		var op = this.ops[i];
		if (op instanceof values.NO_OP) continue; // don't put no-ops into the new list
		
		if (new_ops.length == 0) {
			// first operation
			new_ops.push(op);

		} else {
			for (var j = new_ops.length-1; j >= 0; j--) {
				// try to compose with op[j]
				var c = new_ops[j].atomic_compose(op);
				if (c) {
					if (c instanceof values.NO_OP)
						// they obliterated each other, so remove the one that we already added
						new_ops.splice(j, 1);
					else
						// replace op[j] with the composition
						new_ops[j] = c;
					break;

				} else {
					// We can't bring the op back any further. Insert here.
					new_ops.splice(j+1, 0, op);
					break;
				}
			}
		}
	}

	if (new_ops.length == 0)
		return new values.NO_OP();
	if (new_ops.length == 1)
		return new_ops[0];

	return new exports.LIST(new_ops);
}

exports.LIST.prototype.inverse = function (document) {
	/* Returns a new atomic operation that is the inverse of this operation:
	   the inverse of each operation in reverse order. */
	var new_ops = [];
	this.ops.forEach(function(op) {
		new_ops.push(op.inverse(document));
		document = op.apply(document);
	})
	new_ops.reverse();
	return new exports.LIST(new_ops);
}

exports.LIST.prototype.atomic_compose = function (other) {
	/* Returns a LIST operation that has the same result as this
	   and other applied in sequence (this first, other after). */

	// Nothing here anyway, return the other.
	if (this.ops.length == 0)
		return other;

	// the next operation is an empty list, so the composition is just this
	if (other instanceof exports.LIST) {
		if (other.ops.length == 0)
			return this;
		
		// concatenate
		return new exports.LIST(this.ops.concat(other.ops));
	}


	// append
	var new_ops = this.ops.slice(); // clone
	new_ops.push(other);
	return new exports.LIST(new_ops);
}

exports.rebase = function(base, ops, conflictless, debug) {
	// Turn each argument into an array of operations.
	// If an argument is a LIST, unwrap it.

	if (base instanceof exports.LIST)
		base = base.ops;
	else
		base = [base];

	if (ops instanceof exports.LIST)
		ops = ops.ops;
	else
		ops = [ops];

	// Run the rebase algorithm.

	var ret = rebase_array(base, ops, conflictless, debug);

	// The rebase may have failed.
	if (ret == null) return null;

	// ...or yielded no operations --- turn it into a NO_OP operation.
	if (ret.length == 0) return new values.NO_OP();

	// ...or yielded a single operation --- return it.
	if (ret.length == 1) return ret[0];

	// ...or yielded a list of operations --- re-wrap it in a LIST operation.
	return new exports.LIST(ret).simplify();
}

function rebase_array(base, ops, conflictless, debug) {
	/* This is one of the core functions of the library: rebasing a sequence
	   of operations against another sequence of operations. */

	/*
	* To see the logic, it will help to put this in a symbolic form.
	*
	*   Let a + b == compose(a, b)
	*   and a / b == rebase(b, a)
	*
	* The contract of rebase has two parts;
	*
	* 	1) a + (b/a) == b + (a/b)
	* 	2) x/(a + b) == (x/a)/b
	*
	* Also note that the compose operator is associative, so
	*
	*	a + (b+c) == (a+b) + c
	*
	* Our return value here in symbolic form is:
	*
	*   (op1/base) + (op2/(base/op1))
	*   where ops = op1 + op2
	*
	* To see that we've implemented rebase correctly, let's look
	* at what happens when we compose our result with base as per
	* the rebase rule:
	*
	*   base + (ops/base)
	*
	* And then do some algebraic manipulations:
	*
	*   base + [ (op1/base) + (op2/(base/op1)) ]   (substituting our hypothesis for self/base)
	*   [ base + (op1/base) ] + (op2/(base/op1))   (associativity)
	*   [ op1 + (base/op1) ] + (op2/(base/op1))    (rebase's contract on the left side)
	*   op1 + [ (base/op1)  + (op2/(base/op1)) ]   (associativity)
	*   op1 + [ op2 + ((base/op1)/op2) ]           (rebase's contract on the right side)
	*   (op1 + op2) + ((base/op1)/op2)             (associativity)
	*   self + [(base/op1)/op2]                    (substituting self for (op1+op2))
	*   self + [base/(op1+op2)]                    (rebase's second contract)
	*   self + (base/self)                         (substitution)
	*
	* Thus we've proved that the rebase contract holds for our return value.
	*/

	if (ops.length == 0 || base.length == 0)
		return ops;

	if (ops.length == 1 && base.length == 1) {
		// This is the recursive base case: Rebasing a single operation against a single
		// operation. Wrap the result in an array.
		var op = ops[0].rebase(base[0], conflictless, debug);
		if (!op) return null; // conflict
		if (op instanceof jot.NO_OP) return [];
		if (op instanceof jot.LIST) return op.ops;
		return [op];
	}
	
	if (debug) {
		// Wrap the debug function to emit an extra argument to show depth.
		debug("rebasing", ops, "on", base, "...");
		var original_debug = debug;
		debug = function() { var args = [">"].concat(Array.from(arguments)); original_debug.apply(null, args); }
	}
	
	if (base.length == 1) {
		// Rebase more than one operation (ops) against a single operation (base[0]).

		// Nothing to do if it is a no-op.
		if (base[0] instanceof values.NO_OP)
			return ops;

		// The result is the first operation in ops rebased against the base concatenated with
		// the remainder of ops rebased against the-base-rebased-against-the-first-operation:
		// (op1/base) + (op2/(base/op1))

		var op1 = ops.slice(0, 1); // first operation
		var op2 = ops.slice(1); // remaining operations
		
		var r1 = rebase_array(base, op1, conflictless, debug);
		if (r1 == null) return null; // rebase failed
		
		var r2 = rebase_array(op1, base, conflictless, debug);
		if (r2 == null) return null; // rebase failed (must be the same as r1, so this test should never succeed)
		
		// For the remainder operations, we have to adjust the 'conflictless' object.
		// If it provides the base document state, then we have to advance the document
		// for the application of op1.
		var conflictless2 = !conflictless ? null : Object.assign({}, conflictless);
		if ("document" in conflictless2)
			conflictless2.document = new jot.LIST(op1).apply(conflictless2.document);

		var r3 = rebase_array(r2, op2, conflictless2, debug);
		if (r3 == null) return null; // rebase failed
		
		// returns a new array
		return r1.concat(r3);

	} else {
		// Rebase one or more operations (ops) against more than one operation (base).
		//
		// From the second part of the rebase contract, we can rebase ops
		// against each operation in the base sequentially (base[0], base[1], ...).
		for (var i = 0; i < base.length; i++) {
			ops = rebase_array([base[i]], ops, conflictless, debug);
			if (ops == null) return null; // conflict

			// Adjust the 'conflictless' object if it provides the base document state
			// since for later operations we're assuming base[i] has now been applied.
			if ("document" in conflictless)
				conflictless.document = base[i].apply(conflictless.document);
		}
		return ops;
	}
}

exports.createRandomOp = function(doc, context) {
	// Create a random LIST that could apply to doc.
	var ops = [];
	while (ops.length == 0 || Math.random() < .75) {
		ops.push(jot.createRandomOp(doc, context));
		doc = ops[ops.length-1].apply(doc);
	}
	return new exports.LIST(ops);
}
