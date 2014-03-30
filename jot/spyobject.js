var ot = require("./base.js");
var objects = require("./objects.js");

function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

function SpyObject(doc, observer, path) {
	if (!doc) doc = { };
	if (!observer) observer = this;
	if (!path) path = [];
	
	this.doc = doc;
	this.observer = observer;
	this.path = path;
	
	if (this.observer == this)
		this.op_history = [];
	
	// arrays and objects
	
	this.get = function(key) {
		if (this.doc[key] instanceof Object || this.doc[key] instanceof Array)
			return new SpyObject(this.doc[key], this.observer, this.path.concat([key]));
		return this.doc[key];
	};

	this.set = function(key, value) {
		if (key in this.doc) {
			observer.op_history.push(
				objects.access(
					this.path.concat([key]),
					"values", "SET",
					this.doc[key], clone(value)));
		} else {
			observer.op_history.push(
				objects.access(
					this.path,
					"objects", "PROP",
					null, key, null, clone(value)));
		}
		
		this.doc[key] = value;
	};
	
	this.inc = function(key, amount) {
		observer.op_history.push(
			objects.access(
				this.path.concat([key]),
				"values", "MAP",
				"add", clone(amount)));
		
		this.doc[key] += amount;
	};
	
	// objects
	
	this.del = function(key) {
		observer.op_history.push(
			objects.access(
				this.path,
				"objects", "PROP",
				key, null, clone(this.doc[key]), null));
		delete this.doc[key];
	};
	
	this.rename = function(old_key, new_key) {
		observer.op_history.push(
			objects.access(
				this.path,
				"objects", "REN",
				old_key, new_key));
		
		var value = this.doc[old_key];
		delete this.doc[old_key];
		this.doc[new_key] = value;
	};
	
	// arrays
	
	this.push = function(value) {
		observer.op_history.push(
			objects.access(
				this.path,
				"sequences", "SPLICE",
				this.doc.length, [], [clone(value)]));
		this.doc.push(value);
	};
	this.pop = function() {
		var value = this.doc.pop();
		observer.op_history.push(
			objects.access(
				this.path,
				"sequences", "SPLICE",
				this.doc.length+1, [clone(value)], []));
		return value;
	};
	
	// utilities

	this.get_history = function() {
		return this.op_history;
	};

	this.clear_history = function() {
		this.op_history = [];
	};

	this.pop_history = function() {
		var h = this.op_history;
		this.op_history = [];
		return h;
	};
};

exports.SpyObject = SpyObject;

