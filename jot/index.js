/* Base functions for the operational transformation library. */

var values = require("./values.js");
var sequences = require("./sequences.js");
var objects = require("./objects.js");
var meta = require("./meta.js");

// Pull in the operations into the main namespace and wrap
// in helper constructor functions.
function make_obj(type, args) {
	var obj = Object.create(type.prototype);
	type.apply(obj, args);
	return obj;
}
exports.NO_OP = function() { return make_obj(values.NO_OP, arguments); };
exports.SET = function() { return make_obj(values.SET, arguments) };
exports.MATH = function() { return make_obj(values.MATH, arguments) };
exports.SPLICE = function() { return make_obj(sequences.SPLICE, arguments) };
exports.INS = function() { return make_obj(sequences.INS, arguments) };
exports.DEL = function() { return make_obj(sequences.DEL, arguments) };
exports.ARRAY_APPLY = function() { return make_obj(sequences.ARRAY_APPLY, arguments) };
exports.PROP = function() { return make_obj(objects.PROP, arguments) };
exports.PUT = function() { return make_obj(objects.PUT, arguments) };
exports.REN = function() { return make_obj(objects.REN, arguments) };
exports.REM = function() { return make_obj(objects.REM, arguments) };
exports.OBJECT_APPLY = function() { return make_obj(objects.APPLY, arguments) };
exports.LIST = function() { return make_obj(meta.LIST, arguments) };
