// Construct JOT operations by performing a diff on
// standard data types.

var deepEqual = require("deep-equal");

var jot = require("./index.js");

function diff(a, b, options) {
	// Compares two JSON-able data instances and returns
	// information about the difference:
	//
	// {
	//   op:   a JOT operation representing the change from a to b
	//   pct:  a number from 0 to 1 representing the proportion
	//         of content that is different
	//   size: an integer representing the approximate size of the
	//         content in characters, which is used for weighting
	// }


	// Run the diff method appropriate for the pair of data types.
	// Do a type-check for valid types early, before deepEqual is called.
	// We can't call JSON.stringify below if we get a non-JSONable
	// data type.

	function typename(val) {
		if (typeof val == "undefined")
			throw new Error("Illegal argument: undefined passed to diff");
		if (val === null)
			return "null";
		if (typeof val == "string" || typeof val == "number" || typeof val == "boolean")
			return typeof val;
		if (Array.isArray(val))
			return "array";
		if (typeof val != "object")
			throw new Error("Illegal argument: " + typeof val + " passed to diff");
		return "object";
	}

	var ta = typename(a);
	var tb = typename(b);

	// Return fast if the objects are equal. This is muuuuuch
	// faster than doing our stuff recursively.

	if (deepEqual(a, b, { strict: true })) {
		return {
			op: new jot.NO_OP(),
			pct: 0.0,
			size: JSON.stringify(a).length
		};
	}
	
	if (ta == "string" && tb == "string")
		return diff_strings(a, b, options);

	if (ta == "array" && tb == "array")
		return diff_arrays(a, b, options);
	
	if (ta == "object" && tb == "object")
		return diff_objects(a, b, options);

	// If the data types of the two values are different,
	// or if we don't recognize the data type (which is
	// not good), then only an atomic SET operation is possible.
	return {
		op: new jot.SET(b),
		pct: 1.0,
		size: (JSON.stringify(a)+JSON.stringify(b)).length / 2
	}
}

exports.diff = function(a, b, options) {
	// Ensure options are defined.
	options = options || { };

	// Call diff() and just return the operation.
	return diff(a, b, options).op;
}

function diff_strings(a, b, options) {
	// Use the 'diff' package to compare two strings and convert
	// the output to a jot.LIST.
	var diff = require("diff");
	
	var method = "Chars";
	if (options.words)
		method = "Words";
	if (options.lines)
		method = "Lines";
	if (options.sentences)
		method = "Sentences";
	
	var total_content = 0;
	var changed_content = 0;

	var offset = 0;
	var hunks = diff["diff" + method](a, b)
		.map(function(change) {
			// Increment counter of total characters encountered.
			total_content += change.value.length;
			
			if (change.added || change.removed) {
				// Increment counter of changed characters.
				changed_content += change.value.length;

				// Create a hunk for this change.
				var length = 0, new_value = "";
				if (change.removed) length = change.value.length;
				if (change.added) new_value = change.value;
				var ret = { offset: offset, length: length, op: new jot.SET(new_value) };
				offset = 0;
				return ret;
			} else {
				// Advance character position index. Don't generate a hunk here.
				offset += change.value.length;
				return null;
			}
		})
		.filter(function(item) { return item != null; });

	// Form the PATCH operation.
	var op = new jot.PATCH(hunks).simplify();
	return {
		op: op,
		pct: (changed_content+1)/(total_content+1), // avoid divizion by zero
		size: total_content
	};
}

function diff_arrays(a, b, options) {
	// Use the 'generic-diff' package to compare two arrays,
	// but using a custom equality function. This gives us
	// a relation between the elements in the arrays. Then
	// we can compute the operations for the diffs for the
	// elements that are lined up (and INS/DEL operations
	// for elements that are added/removed).
	
	var generic_diff = require("generic-diff");

	// We'll run generic_diff over an array of indices
	// into a and b, rather than on the elements themselves.
	var ai = a.map(function(item, i) { return i });
	var bi = b.map(function(item, i) { return i });

	var ops = [ ];
	var total_content = 0;
	var changed_content = 0;
	var pos = 0;

	function do_diff(ai, bi, level) {
		// Run generic-diff using a custom equality function that
		// treats two things as equal if their difference percent
		// is less than or equal to level.
		//
		// We get back a sequence of add/remove/equal operations.
		// Merge these into changed/same hunks.

		var hunks = [];
		var a_index = 0;
		var b_index = 0;
		generic_diff(
			ai, bi,
			function(ai, bi) { return diff(a[ai], b[bi], options).pct <= level; }
			).forEach(function(change) {
				if (!change.removed && !change.added) {
					// Same.
					if (a_index+change.items.length > ai.length) throw new Error("out of range");
					if (b_index+change.items.length > bi.length) throw new Error("out of range");
					hunks.push({ type: 'equal', ai: ai.slice(a_index, a_index+change.items.length), bi: bi.slice(b_index, b_index+change.items.length) })
					a_index += change.items.length;
					b_index += change.items.length;
				} else {
					if (hunks.length == 0 || hunks[hunks.length-1].type == 'equal')
						hunks.push({ type: 'unequal', ai: [], bi: [] })
					if (change.added) {
						// Added.
						hunks[hunks.length-1].bi = hunks[hunks.length-1].bi.concat(change.items);
						b_index += change.items.length;
					} else if (change.removed) {
						// Removed.
						hunks[hunks.length-1].ai = hunks[hunks.length-1].ai.concat(change.items);
						a_index += change.items.length;
					}
				}
			});

		// Process each hunk.
		hunks.forEach(function(hunk) {
			//console.log(level, hunk.type, hunk.ai.map(function(i) { return a[i]; }), hunk.bi.map(function(i) { return b[i]; }));

			if (level < 1 && hunk.ai.length > 0 && hunk.bi.length > 0
				&& (level > 0 || hunk.type == "unequal")) {
				// Recurse at a less strict comparison level to
				// tease out more correspondences. We do this both
				// for 'equal' and 'unequal' hunks because even for
				// equal the pairs may not really correspond when
				// level > 0.
				do_diff(
					hunk.ai,
					hunk.bi,
					(level+1.1)/2);
				return;
			}

			if (hunk.ai.length != hunk.bi.length) {
				// The items aren't in correspondence, so we'll just return
				// a whole SPLICE from the left subsequence to the right
				// subsequence.
				var op = new jot.SPLICE(
					pos,
					hunk.ai.length,
					hunk.bi.map(function(i) { return b[i]; }));
				ops.push(op);
				//console.log(op);

				// Increment counters.
				var dd = (JSON.stringify(hunk.ai.map(function(i) { return a[i]; }))
				         + JSON.stringify(hunk.bi.map(function(i) { return b[i]; })));
				dd = dd.length/2;
				total_content += dd;
				changed_content += dd;

			} else {
				// The items in the arrays are in correspondence.
				// They may not be identical, however, if level > 0.
				for (var i = 0; i < hunk.ai.length; i++) {
					var d = diff(a[hunk.ai[i]], b[hunk.bi[i]], options);

					// Add an operation.
					if (!d.op.isNoOp())
						ops.push(new jot.ATINDEX(hunk.bi[i], d.op));

					// Increment counters.
					total_content += d.size;
					changed_content += d.size*d.pct;
				}
			}

			pos += hunk.bi.length;
		});
	}

	// Go.

	do_diff(ai, bi, 0);

	return {
		op: new jot.LIST(ops).simplify(),
		pct: (changed_content+1)/(total_content+1), // avoid divizion by zero
		size: total_content
	};		
}

function diff_objects(a, b, options) {
	// Compare two objects.

	var ops = [ ];
	var total_content = 0;
	var changed_content = 0;
	
	// If a key exists in both objects, then assume the key
	// has not been renamed.
	for (var key in a) {
		if (key in b) {
			// Compute diff.
			d = diff(a[key], b[key], options);

			// Add operation if there were any changes.
			if (!d.op.isNoOp())
				ops.push(new jot.APPLY(key, d.op));

			// Increment counters.
			total_content += d.size;
			changed_content += d.size*d.pct;
		}
	}

	// Do comparisons between all pairs of unmatched
	// keys to see what best lines up with what. Don't
	// store pairs with nothing in common.
	var pairs = [ ];
	/*
	for (var key1 in a) {
		if (key1 in b) continue;
		for (var key2 in b) {
			if (key2 in a) continue;
			var d = diff(a[key1], b[key2], options);
			if (d.pct == 1) continue;
			pairs.push({
				a_key: key1,
				b_key: key2,
				diff: d
			});
		}
	}
	*/

	// Sort the pairs to choose the best matches first.
	// (This is a greedy approach. May not be optimal.)
	var used_a = { };
	var used_b = { };
	pairs.sort(function(a,b) { return ((a.diff.pct*a.diff.size) - (b.diff.pct*b.diff.size)); })
	pairs.forEach(function(item) {
		// Have we already generated an operation renaming
		// the key in a or renaming something to the key in b?
		// If so, this pair can't be used.
		if (item.a_key in used_a) return;
		if (item.b_key in used_b) return;
		used_a[item.a_key] = 1;
		used_b[item.b_key] = 1;

		// Use this pair.
		ops.push(new jot.REN(item.a_key, item.b_key));
		if (!item.diff.op.isNoOp())
			ops.push(new jot.APPLY(item.b_key, item.diff.op));

		// Increment counters.
		total_content += item.diff.size;
		changed_content += item.diff.size*item.diff.pct;
	})

	// Delete/create any keys that didn't match up.
	for (var key in a) {
		if (key in b || key in used_a) continue;
		ops.push(new jot.REM(key));
	}
	for (var key in b) {
		if (key in a || key in used_b) continue;
		ops.push(new jot.PUT(key, b[key]));
	}

	return {
		op: new jot.LIST(ops).simplify(),
		pct: (changed_content+1)/(total_content+1), // avoid divizion by zero
		size: total_content
	};
}

