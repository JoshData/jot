var fs = require('fs');


process.stdout.write("var jot_modules = { }\n");

process.stdout.write(fs.readFileSync("jot/browser_platform.js"));

add_lib("./jot/values.js");
add_lib("./jot/sequences.js");
add_lib("./jot/objects.js");
add_lib("./jot/collab.js");

function add_lib(module_name) {
	// how does 'require' know this module?
	var filename = require.resolve(module_name);

	process.stdout.write("// " + filename + "\n");

	// handle dependencies
	require(module_name);
	for (var child in require.cache[filename].children) {
		add_lib(require.cache[filename].children[child].filename);
	}

	process.stdout.write("jot_modules['" + filename + "'] =  (function(module) {\n");
	process.stdout.write("module.exports = { };\n");
	process.stdout.write("var exports = module.exports;\n");
	process.stdout.write("var __dirname = 'jot';\n");
	var body = fs.readFileSync(filename);
	process.stdout.write(body);
	process.stdout.write("return module;");
	process.stdout.write("}( {} ));\n");
	process.stdout.write("\n");
}

