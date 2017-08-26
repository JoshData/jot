var jot = require("./jot");
var deepEqual = require("deep-equal");
var createRandomOp = jot.createRandomOp; // require('./jot/values.js').createRandomOp;

var doc = "my text string";

function createRandomOpSequence(value, count) {
  var ops = [];
  while (Math.random() > (.4**(Math.sqrt(count)+1))) {
    // Create random operation.
    try {
	    var op = createRandomOp(value);
	  } catch (e) {
	  	console.log("error creating random operation for", value);
	  	console.error(e);
	  	throw e;
	  }

    // Check that it is valid.
    try {
      value = op.apply(value);
    } catch (ex) {
      continue;
    }

    ops.push(op);
  }
  return new jot.LIST(ops);
}

// Create two complex simultaneous edits.
var initial_value = jot.createRandomValue();
var op1 = createRandomOpSequence(initial_value, 10);
var op2 = createRandomOpSequence(initial_value, 10);

//var initial_value = -1000;
//var op1 = jot.opFromJSON({"_type":"meta.LIST","ops":[{"_type":"values.MATH","operator":"xor","operand":241}]}).simplify();
//var op2 = jot.opFromJSON({"_type":"meta.LIST","ops":[{"_type":"values.MATH","operator":"and","operand":241},{"_type":"values.MATH","operator":"or","operand":241}]});

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
	}
} catch (e) {
	console.error(e);
}