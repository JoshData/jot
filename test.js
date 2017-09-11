var jot = require("./jot");
var deepEqual = require("deep-equal");
var createRandomOp = jot.createRandomOp; // require('./jot/values.js').createRandomOp;

// Create two complex simultaneous edits.
var opsize = 1;

while (true) {
	var initial_value = jot.createRandomValue();
	var op1 = jot.createRandomOpSequence(initial_value, opsize);
	var op2 = jot.createRandomOpSequence(initial_value, opsize);

	/*
	var initial_value = false;
	var op1 = jot.opFromJSON({"_type":"meta.LIST","ops":[{"_type":"values.SET","new_value":-226.62491332471424},{"_type":"values.NO_OP"}]});
	var op2 = jot.opFromJSON({"_type":"meta.LIST","ops":[{"_type":"values.MATH","operator":"and","operand":true},{"_type":"values.MATH","operator":"and","operand":false}]});
	*/
	//console.log(initial_value)
	//console.log(op1)
	//console.log(op2)

	try {

		// Compute the end results.
		var val1 = op1.apply(initial_value);
		var val2 = op2.apply(initial_value);

		// Check that the parallel rebases match.
		var op2r = op2.rebase(op1, { document: initial_value });
		var val1b = op2r ? op2r.apply(val1) : null;

		var op1r = op1.rebase(op2, { document: initial_value });
		var val2b = op1r ? op1r.apply(val2) : null;

		// Check that they also match using composition.
		var val1c = op2r ? op1.compose(op2r).apply(initial_value) : null;
		var val2c = op1r ? op2.compose(op1r).apply(initial_value) : null;

		// Check that we can compute a diff.
		var d = jot.diff(initial_value, val1b);

		if (op2r === null || op1r === null
		 || !deepEqual(val1b, val2b, { strict: true })
		 ) {
		  console.log("rebase failed or did not have same result");
		  console.log("init", initial_value)
		  console.log();
		  console.log("op1", JSON.stringify(op1.toJSON()));
		  console.log("val", val1);
		  console.log("op2r", op2r);
		  console.log("val", val1b);
		  console.log();
		  console.log("op2", JSON.stringify(op2.toJSON()));
		  console.log("val", val2);
		  console.log("op1r", op1r);
		  console.log("val", val2b);
		  break;
		} else if (!deepEqual(val1b, val1c, { strict: true }) || !deepEqual(val1c, val2c, { strict: true })) {
		  console.log("composition did not have same result");
		  console.log("init", initial_value)
		  console.log();
		  console.log("op1", JSON.stringify(op1.toJSON()));
		  console.log("val", val1);
		  console.log("op2r", op2r);
		  console.log("val", val1c);
		  console.log();
		  console.log("op2", JSON.stringify(op2.toJSON()));
		  console.log("val", val2);
		  console.log("op1r", op1r);
		  console.log("val", val2c);
		  break;
		}
	} catch (e) {
		console.error(e);
		console.log("init", initial_value)
		console.log("op1", JSON.stringify(op1.toJSON()));
		console.log("op2", JSON.stringify(op2.toJSON()));
		break;
	}
}