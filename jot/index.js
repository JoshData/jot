/* Base functions for the operational transformation library. */

var jot_platform = require(__dirname + "/platform.js");

exports.run_op_func = function(op, method/*, arg1, arg2, ... */) {
	/* Runs a method defined in the operation's library. */
	var lib = jot_platform.load_module(op.module_name);
	var args = [op];
	for (var i = 2; i < arguments.length; i++)
		args.push(arguments[i]);
	return lib[method].apply(null, args);
}

exports.simplify = function(op) {
	/* Simplifies any operation by loading its library's simplify function.
	   The return value is op or any operation equivalent to op, and it is
       typically used to turn degenerate cases of operations, like an insertion
       of the empty string, into no-ops.*/
	if (op.type == "no-op") return op; // has no module_name
	return exports.run_op_func(op, "simplify");
}

exports.apply = function(op, document) {
	/* Applies any operation to a document by loading its library's apply function.
	   The document may be modified in place or the new value may be returned,
	   depending on how the particular operation's library works. */
	if (op.type == "no-op") return document; // has no module_name
	return exports.run_op_func(op, "apply", document);
}

exports.invert = function(op) {
	/* Inverts any operation by loading its library's invert function.
	   The inverse operation has the opposite effect as op. Composing an operation
	   and its inverse must result in a no-op.*/
	if (op.type == "no-op") return op; // has no module_name
	return exports.run_op_func(op, "invert");
}

exports.compose = function(a, b) {
	/* Composes any two operations. The return value is a new operation that when
	   applied to a document yields the same value as apply(b, apply(a, document)).
	   May return null indicating a composition was not possible. */
	if (a.type == "no-op") return b;
	if (b.type == "no-op") return a;
	if (a.module_name != b.module_name) return null; // can't compose operations from different modules
	return exports.run_op_func(a, "compose", b);
}

exports.rebase = function(a, b) {
	/* Rebases b against a. If a and be are simultaneous operations, returns a
       new operation that can be composed with a to yield the logical composition
       of a and b. Or returns null indicating a conflict. The order (a, b) is
       to signify the order the caller wants to compose the operations in.
       
       The rebase operation's contract has two parts:
         1) compose(a, rebase(a, b)) == compose(b, rebase(b, a)).
         2) If a = compose(a1, a2), then
            rebase(a, b) == rebase(a2, rebase(a1, b))
            
       This method can be called on operations in any library. It will load the
       library's rebase function.
       */

	if (a.type == "no-op") return b; // rebasing against no-op leaves operation unchanged
	if (b.type == "no-op") return b; // rebasing a no-op is still a no-op
	if (a.module_name != b.module_name) return null; // can't rebase operations from different modules
	return exports.run_op_func(a, "rebase", b);
}

exports.normalize_array = function(ops) {
	/* Takes an array of operations and composes consecutive operations where possible,
	   removes no-ops, and returns a new array of operations. */
	var new_ops = [];
	for (var i = 0; i < ops.length; i++) {
		if (ops[i].type == "no-op") continue; // don't put no-ops into the new list
		if (new_ops.length == 0) {
			new_ops.push(ops[i]); // first operation
		} else {
			// try to compose with the previous op
			var c = exports.compose(new_ops[new_ops.length-1], ops[i]);
			if (c) {
				if (c.type == "no-op")
					new_ops.pop(); // they obliterated each other, so remove the one that we already added
				else
					new_ops[new_ops.length-1] = c; // replace with composition
			} else {
				new_ops.push(ops[i]);
			}
		}
	}
	return new_ops;
}

exports.apply_array = function(ops, document) {
	/* Takes an array of operations and applies them successively to a document.
	   This basically treats the array as the composition of all of the array
	   elements. */
	for (var i = 0; i < ops.length; i++)
		document = exports.apply(ops[i], document);
	return document;
}

exports.invert_array = function(ops) {
	/* Takes an array of operations and returns the inverse of the whole array,
	   i.e. the inverse of each operation in reverse order. */
	var new_ops = [];
	for (var i = ops.length-1; i >= 0; i--)
		new_ops.push(exports.invert(ops[i]));
	return new_ops;
}
		
exports.rebase_array = function(base, ops) {
	/* Takes an array of operations ops and rebases them against operation base.
	   Base may be an array of operations or just a single operation.
	   Returns an array of operations.*/
	   
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
	
	ops = exports.normalize_array(ops);

	if (ops.length == 0) return ops; // basically a no-op
	
	if (base instanceof Array) {
		// from the second part of the rebase contract
		for (var i = 0; i < base.length; i++) {
			ops = exports.rebase_array(base[i], ops);
			if (!ops) return null;
		}
		return ops;
		
	} else {
		// handle edge case
		if (ops.length == 1) {
			var op = exports.rebase(base, ops[0]);
			if (!op) return null; // conflict
			return [op];
		}
		
		var op1 = ops[0];
		var op2 = ops.slice(1); // remaining operations
		
		var r1 = exports.rebase(base, op1);
		if (!r1) return null; // rebase failed
		
		var r2 = exports.rebase(op1, base);
		if (!r2) return null; // rebase failed (must be the same as r1, so this test should never succeed)
		
		var r3 = exports.rebase_array(r2, op2);
		if (!r3) return null; // rebase failed
		
		// returns a new array
		return [r1].concat(r3);
	}
}

/* MAKE SOME ALIASES */
function op_alias(module_name, operation_name, arguments) {
	var lib = jot_platform.load_module(module_name);
	return lib[operation_name].apply(null, arguments);
}
exports.INS = function(/*...*/) { return op_alias("sequences", "INS", arguments); }
exports.DEL = function(/*...*/) { return op_alias("sequences", "DEL", arguments); }
exports.PUT = function(/*...*/) { return op_alias("objects", "PUT", arguments); }
exports.REM = function(/*...*/) { return op_alias("objects", "REM", arguments); }
exports.REN = function(/*...*/) { return op_alias("objects", "REN", arguments); }
exports.MOVE = function(/*...*/) { return op_alias("sequences", "MOVE", arguments); }
exports.OBJECT_APPLY = function(/*...*/) { return op_alias("objects", "APPLY", arguments); }
exports.ARRAY_APPLY = function(/*...*/) { return op_alias("sequences", "APPLY", arguments); }
exports.SET = function(/*...*/) { return op_alias("values", "SET", arguments); }
exports.MAP = function(/*...*/) { return op_alias("values", "MAP", arguments); }
