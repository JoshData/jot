/* Utility code for running the library within a browser. */

function require(module_name) {
	function endswith(string, suffix) {
	    return string.indexOf(suffix, string.length - suffix.length) !== -1;
	};
	if (module_name.indexOf("./") == 0) module_name = module_name.substring(2);
	for (var filename in jot_modules) {
		if (endswith(filename, "/" + module_name) || endswith(filename, "/" + module_name + ".js") || endswith(filename, module_name + "/index.js"))
			return jot_modules[filename].exports;
	}
	throw module_name + " not available!";
}

jot_modules['platform.js'] = {
	exports: {
		load_module: require
	}
};

