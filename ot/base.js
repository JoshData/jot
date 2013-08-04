/* Base functions for the operational transform library. */

// load the module named in an operation object
exports.load_module = function(module_name) {
	return require(__dirname + "/" + module_name);
}

exports.run_op_func = function(op, method/*, arg1, arg2, ... */) {
	/* Runs a method defined in the operation's library. */
	var lib = exports.load_module(op.module_name);
	var args = [op];
	for (var i = 2; i < arguments.length; i++)
		args.push(arguments[i]);
	return lib[method].apply(null, args);
}

exports.simplify = function(op) {
	/* Simplifies any operation by loading its library's simplify function. */
	if (op.type == "no-op") return op; // has no module_name
	return exports.run_op_func(op, "simplify");
}

exports.apply = function(op, document) {
	/* Applies any operation by loading its library's apply function. */
	if (op.type == "no-op") return document; // has no module_name
	return exports.run_op_func(op, "apply", document);
}

exports.invert = function(op) {
	/* Inverts any operation by loading its library's invert function. */
	if (op.type == "no-op") return op; // has no module_name
	return exports.run_op_func(op, "invert");
}

exports.compose = function(a, b) {
	/* Composes any two operations. May return null indicating a composition was not possible. */
	if (a.type == "no-op") return b;
	if (b.type == "no-op") return a;
	if (a.module_name != b.module_name) return null; // can't compose operations from different modules
	return exports.run_op_func(a, "atomic_compose", b);
}

exports.rebase = function(a, b) {
	/* Rebases any two operations. May return null indicating a conflict. */
	if (a.type == "no-op") return b; // rebasing against no-op leaves operation unchanged
	if (b.type == "no-op") return b; // rebasing a no-op is still a no-op
	if (a.module_name != b.module_name) return null; // can't rebase operations from different modules
	return exports.run_op_func(a, "atomic_rebase", b);
}


