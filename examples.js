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

change_property = objects.atomic_rebase(rename_key, change_property);

objects.apply(rename_key, doc)
objects.apply(change_property, doc)
console.log(doc);

