/* Base functions for the operational transformation library. */

var values = require("./values.js");
var sequences = require("./sequences.js");
var objects = require("./objects.js");
var meta = require("./meta.js");


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
