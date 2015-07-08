/* Base functions for the operational transformation library. */

var util = require('util');

// Must define this ahead of any imports below so that this function
// is available to the operation classes.
exports.BaseOperation = function() {
}
exports.BaseOperation.prototype.inspect = function(depth) {
	var repr = [ ];
	var keys = Object.keys(this);
	for (var i = 0; i < keys.length; i++) {
		var v;
		if (this[keys[i]] instanceof exports.BaseOperation)
			v = this[keys[i]].inspect(depth-1);
		else if (typeof this[keys[i]] != 'undefined')
			v = util.format("%j", this[keys[i]]);
		else
			continue;
		repr.push(keys[i] + ":" + v);
	}
	return util.format("<%s.%s {%s}>",
		this.type[0],
		this.type[1],
		repr.join(", "));
}

// Imports.
var values = require("./values.js");
var sequences = require("./sequences.js");
var objects = require("./objects.js");
var meta = require("./meta.js");

// Define aliases.
exports.NO_OP = values.NO_OP;
exports.SET = values.SET;
exports.MATH = values.MATH;
exports.SPLICE = sequences.SPLICE;
exports.INS = sequences.INS;
exports.DEL = sequences.DEL;
exports.ARRAY_APPLY = sequences.APPLY;
exports.PROP = objects.PROP;
exports.PUT = objects.PUT;
exports.REN = objects.REN;
exports.REM = objects.REM;
exports.OBJECT_APPLY = objects.APPLY;
exports.LIST = meta.LIST;
