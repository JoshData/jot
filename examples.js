var ot = require("./ot/base.js");
var values = require("./ot/values.js");
var sequences = require("./ot/sequences.js");
var objects = require("./ot/objects.js");

var doc = {
	key1: "Hello World!",
	key2: 10,
};

var rename_key = objects.REN("key1", "title");

var change_property = objects.access(
	["key1"],
	"values", "REP",
	"Hello World!", "My Program");

change_property = ot.rebase(rename_key, change_property);

ot.apply(rename_key, doc)
ot.apply(change_property, doc)
console.log(doc);

