/* Utility code for running the library within a browser. */

function require(module_name) {
	module_name = module_name.replace(/^(\.\/)?jot\//, "");
	if (module_name in jot_modules)
		return jot_modules[module_name].exports;
	throw module_name + " not available!";
}

jot_modules['platform.js'] = {
	exports: {
		load_module: require
	}
};

