/*  This module defines one operation:
	
	LIST([op1, op2, ...])
	
	A composition of zero or more operations, given as an array.

	*/
	
var util = require("util");

var shallow_clone = require('shallow-clone');

var jot = require("./index.js");
var values = require('./values.js');

exports.module_name = 'lists'; // for serialization/deserialization

exports.LIST = function (ops) {
	if (!Array.isArray(ops)) throw new Error("Argument must be an array.");
	ops.forEach(function(op) {
		if (!(op instanceof jot.Operation))
			throw new Error("Argument must be an array containing operations (found " + op + ").");
	})
	this.ops = ops; // TODO: How to ensure this array is immutable?
	Object.freeze(this);
}
exports.LIST.prototype = Object.create(jot.Operation.prototype); // inherit
jot.add_op(exports.LIST, exports, 'LIST');

exports.LIST.prototype.inspect = function(depth) {
	return util.format("<LIST [%s]>",
		this.ops.map(function(item) { return item.inspect(depth-1) }).join(", "));
}

exports.LIST.prototype.visit = function(visitor) {
	// A simple visitor paradigm. Replace this operation instance itself
	// and any operation within it with the value returned by calling
	// visitor on itself, or if the visitor returns anything falsey
	// (probably undefined) then return the operation unchanged.
	var ret = new exports.LIST(this.ops.map(function(op) { return op.visit(visitor); }));
	return visitor(ret) || ret;
}

exports.LIST.prototype.internalToJSON = function(json, protocol_version) {
	json.ops = this.ops.map(function(op) {
		return op.toJSON(undefined, protocol_version);
	});
}

exports.LIST.internalFromJSON = function(json, protocol_version, op_map) {
	var ops = json.ops.map(function(op) {
		return jot.opFromJSON(op, protocol_version, op_map);
	});
	return new exports.LIST(ops);
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

		// simplify the inner op
		op = op.simplify();

		// if this isn't the first operation, try to atomic_compose the operation
		// with the previous one.
		while (new_ops.length > 0) {
			// Don't bother with atomic_compose if the op to add is a no-op.
			if (op.isNoOp())
				break;

			var c = new_ops[new_ops.length-1].compose(op, true);

			// If there is no atomic composition, there's nothing more we can do.
			if (!c)
				break;

			// The atomic composition was successful. Remove the old previous operation.
			new_ops.pop();

			// Use the atomic_composition as the next op to add. On the next iteration
			// try composing it with the new last element of new_ops.
			op = c;
		}

		// Don't add to the new list if it is a no-op.
		if (op.isNoOp())
			continue;

		// if it's the first operation, or atomic_compose failed, add it to the new_ops list
		new_ops.push(op);
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
	// Ensure the operations are simplified, since rebase
	// is much more expensive than simplified.

	base = base.simplify();
	ops = ops.simplify();

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
		debug("rebasing", ops, "on", base, conflictless ? "conflictless" : "", "document" in conflictless ? JSON.stringify(conflictless.document) : "", "...");
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
		var conflictless2 = null;
		if (conflictless) {
			conflictless2 = shallow_clone(conflictless);
			if ("document" in conflictless2)
				conflictless2.document = op1[0].apply(conflictless2.document);
		}

		var r3 = rebase_array(r2, op2, conflictless2, debug);
		if (r3 == null) return null; // rebase failed
		
		// returns a new array
		return r1.concat(r3);

	} else {
		// Rebase one or more operations (ops) against more than one operation (base).
		//
		// From the second part of the rebase contract, we can rebase ops
		// against each operation in the base sequentially (base[0], base[1], ...).
		
		// shallow clone
		conflictless = !conflictless ? null : shallow_clone(conflictless);

		for (var i = 0; i < base.length; i++) {
			ops = rebase_array([base[i]], ops, conflictless, debug);
			if (ops == null) return null; // conflict

			// Adjust the 'conflictless' object if it provides the base document state
			// since for later operations we're assuming base[i] has now been applied.
			if (conflictless && "document" in conflictless)
				conflictless.document = base[i].apply(conflictless.document);
		}

		return ops;
	}
}

exports.LIST.prototype.drilldown = function(index_or_key) {
	return new exports.LIST(this.ops.map(function(op) {
		return op.drilldown(index_or_key)
	})).simplify();
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
