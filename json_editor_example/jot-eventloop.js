function setup_event_loop(collab) {
	var ot_base = require("jot/base.js");
	
	// use a two-stage queue so that operations are guaranteed
	// to wait before getting sent in the wire, in case they
	// are pushed just before an event fires
	//
	// we queue operations and not messages because we can
	// compose operaitons but we can't compose messages
	var localChanges1 = [];
	var localChanges2 = [];
	
	var event_loop = {
		push_local_change: function(op) {
			localChanges1.push(op);
		},
		flush_local_changes: function() {
			var ops = localChanges2.concat(localChanges1);
			var ops = ot_base.normalize_array(ops);
			if (ops.length > 0) collab.local_revision(ops);
			localChanges1 = [];
			localChanges2 = [];
		}
	};
	
	// send localChanges2 and then move localChanges1 to localChanges2, and then
	// schedule the next firing of the function.
	function queue_send_changes() {
		window.setTimeout("jot_send_changes_over_the_wire()", 150);
	}
	window.jot_send_changes_over_the_wire = function() {
		var ops = ot_base.normalize_array(localChanges2);
		if (ops.length > 0) collab.local_revision(ops); // send whole arrays
		localChanges2 = localChanges1;
		localChanges1 = [];
		queue_send_changes();
	}
	queue_send_changes();
	
	return event_loop;
}

