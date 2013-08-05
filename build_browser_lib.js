var fs = require('fs');

var libs = {
	"deep-equal": "node_modules/deep-equal/index.js",
	"base.js": "jot/base.js",
	"values.js": "jot/values.js",
	"sequences.js": "jot/sequences.js",
	"objects.js": "jot/objects.js",
	"collab.js": "jot/collab.js",
};

process.stdout.write("var jot_modules = { }\n");

process.stdout.write(fs.readFileSync("jot/browser_platform.js"));

for (var name in libs) {
	process.stdout.write("jot_modules['" + name + "'] =  (function(module) {\n");
	process.stdout.write("module.exports = { };\n");
	process.stdout.write("var exports = module.exports;\n");
	process.stdout.write("var __dirname = 'jot';\n");
	var body = fs.readFileSync(libs[name]);
	process.stdout.write(body);
	process.stdout.write("return module;");
	process.stdout.write("}( {} ));\n");
	process.stdout.write("\n");
}

process.stdout.write(fs.readFileSync(__dirname+'/node_modules/googlediff/javascript/diff_match_patch_uncompressed.js'));
process.stdout.write("jot_modules['googlediff'] = { exports: diff_match_patch };\n");

