/* A library of operations for objects (i.e. JSON objects/Javascript associative arrays).
   
   Two operations are provided:
   
   new objects.PROP(old_key, new_key, old_value, new_value)

    Creates, deletes, or renames a property.

    Shortcuts are provided:
    
    new objects.PUT(key, value)
    
      (Equivalent to PROP(null, key, null, value).)

    new objects.REM(key, old_value)
    
      (Equivalent to PROP(key, null, old_value, null).)

    new objects.REN(old_key, new_key)
    
      (Equivalent to PROP(old_key, new_key, null, null).)
      
    It is not possible to rename a key and change its value
    in the same operation, or to change a value on an existing
    key.
      
   new objects.APPLY(key, operation)

    Applies another sort of operation to a property's value. Use any
    operation defined in any of the modules depending on the data type
    of the property. For instance, the operations in values.js can be
    applied to any property. The operations in sequences.js can be used
    if the property's value is a string or array. And the operations in
    this module can be used if the value is another object.
    
    Example:
    
    To replace the value of a property with a new value:
    
      new objects.APPLY("key1", new values.SET("old_value", "new_value"))
      
   */
   
var deepEqual = require("deep-equal");
var values = require("./values.js");

//////////////////////////////////////////////////////////////////////////////

exports.PROP = function (old_key, new_key, old_value, new_value) {
	if (old_key == "__hmm__") return; // used for subclassing to INS, DEL
	if (old_key == new_key && old_ney != null && old_value != new_value) throw "invalid arguments";
	this.old_key = old_key;
	this.new_key = new_key;
	this.old_value = old_value;
	this.new_value = new_value;
}

	// shortcuts
	exports.PUT = function (key, value) {
		exports.PROP.apply(this, [null, key, null, value]);
	}
	exports.PUT.prototype = new exports.PROP("__hmm__"); // inherit prototype

	exports.REM = function (key, old_value) {
		exports.PROP.apply(this, [key, null, old_value, null]);
	}
	exports.REM.prototype = new exports.PROP("__hmm__"); // inherit prototype

	exports.REN = function (old_key, new_key) {
		exports.PROP.apply(this, [old_key, new_key, null, null]);
	}
	exports.REN.prototype = new exports.PROP("__hmm__"); // inherit prototype

exports.PROP.prototype.apply = function (document) {
	/* Applies the operation to a document. Returns a new object that is
	   the same type as document but with the change made. */

	// Clone first.
	var d = { };
	for (var k in document)
		d[k] = document[k];

	// Apply.
	if (this.old_key == null)
		d[this.new_key] = this.new_value;
	else if (this.new_key == null)
		delete d[this.old_key];
	else {
		var v = d[this.old_key];
		delete d[this.old_key];
		d[this.new_key] = v;
	}
	return d;
}

exports.PROP.prototype.simplify = function () {
	/* Returns a new atomic operation that is a simpler version
	   of this operation.*/
	if (this.old_key == this.new_key && deepEqual(this.old_value, this.new_value))
		return new values.NO_OP();
	return this;
}

exports.PROP.prototype.invert = function () {
	/* Returns a new atomic operation that is the inverse of this operation */
	return new exports.PROP(this.new_key, this.old_key, this.new_value, this.old_value);
}

exports.PROP.prototype.compose = function (other) {
	/* Creates a new atomic operation that has the same result as this
	   and other applied in sequence (this first, other after). Returns
	   null if no atomic operation is possible. */

	// the next operation is a no-op, so the composition is just this
	if (other instanceof values.NO_OP)
		return this;

	// a SET clobbers this operation
	if (other instanceof values.SET)
		return other.simplify();

	if (other instanceof exports.PROP && this.new_key == other.old_key) {
		if (this.old_key == other.new_key && deepEqual(this.old_value, other.new_value))
			return new values.NO_OP()
		if (this.old_key != other.new_key && !deepEqual(this.old_value, other.new_value))
			return null; // prevent a rename and a change in value in the same operation
		return new exports.PROP(this.old_key, other.new_key, this.old_value, other.new_value);
	}

	// No composition possible.
	return null;
}

exports.PROP.prototype.rebase = function (other) {
	/* Transforms this operation so that it can be composed *after* the other
	   operation to yield the same logical effect. Returns null on conflict. */

	if (other instanceof values.NO_OP)
		return this;

	if (other instanceof exports.PROP) {
		if (this.old_key == other.old_key && this.new_key == other.new_key) {
			// both deleted, or both changed the value to the same thing, or both inserted the same thing
			if (deepEqual(this.new_value, other.new_value))
				return exports.NO_OP();
			
			// values were changed differently
			return null;
		}
		
		// rename to different things (conflict)
		if (this.old_key == other.old_key && this.new_key != other.new_key && this.old_key != null)
			return null;

		// rename different things to the same key (conflict)
		if (this.old_key != other.old_key && this.new_key == other.new_key && this.new_key != null)
			return null;
		
		// otherwise, the keys are not related so this isn't changed
		return this;
	}

	if (other instanceof exports.APPLY) {
		// other modified a different key than this, so this is unaffected
		if (this.old_key != other.key)
			return this;
		
		// this renamed the key, so continue to apply the rename after other
		if (this.old_key != this.new_key)
			return this;
	}

	return null;
}

//////////////////////////////////////////////////////////////////////////////


exports.APPLY = function (key, op) {
	if (key == null || op == null) throw "invalid arguments";
	this.key = key;
	this.op = op;
}

exports.APPLY.prototype.apply = function (document) {
	/* Applies the operation to a document. Returns a new object that is
	   the same type as document but with the change made. */

	// Clone first.
	var d = { };
	for (var k in document)
		d[k] = document[k];

	// Apply.
	d[this.key] = this.op.apply(d[this.key]);
	return d;
}

exports.APPLY.prototype.simplify = function () {
	/* Returns a new atomic operation that is a simpler version
	   of this operation.*/
	var op2 = this.op.simplify();
	if (op2 instanceof values.NO_OP)
		return values.NO_OP();
	return this;
}

exports.APPLY.prototype.invert = function () {
	/* Returns a new atomic operation that is the inverse of this operation */
	return new exports.APPLY(this.key, this.op.invert());
}

exports.APPLY.prototype.compose = function (other) {
	/* Creates a new atomic operation that has the same result as this
	   and other applied in sequence (this first, other after). Returns
	   null if no atomic operation is possible. */

	// the next operation is a no-op, so the composition is just this
	if (other instanceof values.NO_OP)
		return this;

	// a SET clobbers this operation
	if (other instanceof values.SET)
		return other.simplify();

	// APPLY followed by a REM clobbers this operation
	if (other instanceof exports.PROP && this.key == other.old_key && other.new_key == null)
		return other.simplify();

	// two APPLYs to the same key in a row
	if (other instanceof exports.APPLY && this.key == other.key) {
		var op2 = this.op.compose(other.op);
		if (op2)
			return exports.APPLY(this.key, op2);
	}

	// No composition possible.
	return null;
}

exports.APPLY.prototype.rebase = function (other) {
	/* Transforms this operation so that it can be composed *after* the other
	   operation to yield the same logical effect. Returns null on conflict. */

	if (other instanceof values.NO_OP)
		return this;
	
	if (other instanceof exports.PROP) {
		// other operated on some other key that doesn't affect this
		if (other.old_key != this.key)
			return this;
		
		// other renamed the key this was working on, so revise this to use the new name
		if (other.old_key != other.new_key)
			return new exports.APPLY(other.new_key, this.op);
	}
	
	if (other instanceof exports.APPLY) {
		if (this.key != other.key) {
			// Changes to different keys are independent.
			return this;
		}

		// Operated on the same key. Rebase the sub-operations.
		var op2 = this.op.rebase(other.op);
		if (op2)
			return new exports.APPLY(this.key, op2);
	}

	return null;
}
