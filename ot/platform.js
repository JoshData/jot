// load the module named in an operation object
exports.load_module = function(module_name) {
	return require(__dirname + "/" + module_name);
}

