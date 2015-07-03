/*  A library of meta-operations.
	
	LIST(array_of_operations)
	
	A composition of zero or more operations, given as an array.

	*/
	
var values = require('./values.js');

exports.LIST = function (ops) {
	if (ops == null) throw "Invalid Argument";
	if (!(ops instanceof Array)) throw "Invalid Argument";
	this.ops = ops;
}

exports.LIST.prototype.apply = function (document) {
	/* Applies the operation to a document.*/
	for (var i = 0; i < this.ops.length; i++)
		document = this.ops[i].apply(document);
	return document;
}

exports.LIST.prototype.simplify = function () {
	/* Returns a new LIST operation that is a simpler version
	   of this operation. Composes consecutive operations where
	   possible and removes no-ops. Returns NO_OP if the result
	   would be an empty list of operations. */
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
				var c = new_ops[j].compose(op);
				if (c) {
					if (c instanceof values.NO_OP)
						// they obliterated each other, so remove the one that we already added
						new_ops.splice(j, 1);
					else
						// replace op[j] with the composition
						new_ops[j] = c;
					break;

				} else {
					if (j > 0) {
						// They do not compose, but we may be able to
						// move it earlier in the list so that we could
						// compose it with another operation. op can be
						// swaped in position with new_ops[j] if op can
						// be rebased on new_ops[j]'s inverse.
						var r1 = op.rebase(new_ops[j].invert());
						var r2 = new_ops[j].rebase(op);
						if (r1 != null && r2 != null) {
							// Can swap order. Iterate.
							op = r1;
							new_ops[j] = r2;
							continue;
						}
					}

					// We can't bring the op back any further. Insert here.
					new_ops.splice(j+1, 0, op);
					break;
				}
			}
		}
	}

	if (new_ops.length == 0)
		return new values.NO_OP();

	return new exports.LIST(new_ops);
}

exports.LIST.prototype.invert = function () {
	/* Returns a new atomic operation that is the inverse of this operation:
	   the inverse of each operation in reverse order. */
	var new_ops = [];
	for (var i = this.ops.length-1; i >= 0; i--)
		new_ops.push(this.ops[i].invert());
	return new exports.LIST(new_ops);
}

exports.LIST.prototype.compose = function (other) {
	/* Creates a new LIST operation that has the same result as this
	   and other applied in sequence (this first, other after). Returns
	   null if no atomic operation is possible. */

	// Nothing here anyway, return the other.
	if (this.ops.length == 0)
		return other;

	// the next operation is a no-op, so the composition is just this
	if (other instanceof values.NO_OP)
		return this;

	// a SET clobbers this operation
	if (other instanceof values.SET)
		return other.simplify();

	// concatenate
	if (other instanceof exports.LIST) {
		if (other.ops.length == 0)
			return this;
		return new exports.LIST(this.ops.concat(other.ops));
	}

	// append
	var new_ops = this.ops.slice(); // clone
	new_ops.push(other);
	return new exports.LIST(new_ops);
}

exports.LIST.prototype.rebase = function (other) {
	/* Transforms this operation so that it can be composed *after* the other
	   operation to yield the same logical effect. Returns null on conflict. */

	if (other instanceof values.NO_OP)
		return this;

	var base;
	if (other instanceof exports.LIST)
		base = other.ops;
	else
		base = other;

	var ops = rebase_array(base, this.ops);
	if (ops == null) return null;
	if (ops.length == 0) return new values.NO_OP();
	return new exports.LIST(ops);
}

function rebase_array(base, ops) {
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
	
	if (base instanceof Array) {
		// from the second part of the rebase contract
		for (var i = 0; i < base.length; i++) {
			ops = rebase_array(base[i], ops);
			if (!ops) return null;
		}
		return ops;
		
	} else {
		// handle edge case
		if (ops.length == 1) {
			var op = ops[0].rebase(base);
			if (!op) return null; // conflict
			return [op];
		}
		
		var op1 = ops[0];
		var op2 = ops.slice(1); // remaining operations
		
		var r1 = op1.rebase(base);
		if (!r1) return null; // rebase failed
		
		var r2 = base.rebase(op1);
		if (!r2) return null; // rebase failed (must be the same as r1, so this test should never succeed)
		
		var r3 = rebase_array(r2, op2);
		if (!r3) return null; // rebase failed
		
		// returns a new array
		return [r1].concat(r3);
	}
}

