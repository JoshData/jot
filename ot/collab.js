var ot = require("./ot/base.js");

exports.Collaboration = function(document_updater, the_wire) {
	/* The Collaboration class is a shared state between you and another editor.
	It runs synchronously with your local changes but asynchronously
	with remote changes.
	
	What synchronously means here is that when the local user makes a
	change to the document, local_revision() must be called with that operation
	(or an array of operations) before any further calls to process_remote_message().
	
	document_updater is a method  which takes an array of operation objects and
	a dict of metadata as its argument, and it is responsible for
	updating the local document with changes from the remote end.
	
	the_wire is an method responsible for putting messages
	on the wire to the remote user. It accepts any object to be sent over the wire."""
	*/
	
	this.document_updater = document_updater;
	this.to_the_wire = the_wire;
	
	this.our_hist_start = 0;
	this.our_history = [];
	this.rolled_back = 0;
	
	this.remote_hist_start = 0;
	this.remote_history = [];
	this.remote_conflict_pending_undo = false;
		
	this.local_revision = function(operation, operation_metadata) {
		/* The user calls this to indicate they made a local change to
		   the document. */
		
		if (operation instanceof Array)
			this.our_history = this.our_history.concat(operation);
		else
			this.our_history.push(operation);
		
		if (!operation_metadata) operation_metadata = { };
		if (!("type" in operation_metadata)) operation_metadata["type"] = "normal";
		
		this.to_the_wire({
			base_rev: this.remote_hist_start + this.remote_history.length - 1,
			op: operation,
			metadata: operation_metadata});
	}
	
	this.process_remote_message = function(msg) {
		/* The user calls this when they receive a message over the wire. */
		return this.remote_revision(msg.base_rev, msg.op, msg.metadata);
	}
		
	this.remote_revision = function(base_revision, operation, operation_metadata) {
		/*
		 * Our remote collaborator sends us an operation and the
		 * number of the last operation they received from us.

		 * Imaging this scenario:
		 *
		 * remote: X -> A -> B 
		 * local:  X -> Y -> A -> Z [ -> B]
		 *
		 * X is a base revision (say, zero). We've already received
		 * A, and the remote end is now sending us B. But they haven't
		 * yet applied our local changes Y or Z. (Y and Z are applied
		 * locally and are on the wire.)
		 *
		 * In remote_history, we track the remote revisions that we've
		 * already applied to our tree (and their corresponding base
		 * revision).
		 *
		 * remote_history = [ (0, A) ]
		 * base_revision = 0
		 * operation = B
		 *
		 * our_history = [ X, Y, Z ]
		 *
		 * To apply B, we rebase it against (Y+Z) rebased against (A).
		 */
		
		// Clear previous entries in remote_history we no longer need.
		while (this.remote_history.length > 0 && this.remote_history[0][0] < base_revision) {
			this.remote_history.shift();
			this.remote_hist_start += 1;
		}

		// Clear previous entries in local_history we no longer need
		// (everything *through* base_revision).
		if (base_revision >= this.our_hist_start) {
			this.our_history = this.our_history.slice(base_revision-this.our_hist_start+1);
			this.rolled_back -= base_revision-this.our_hist_start+1;
			if (this.rolled_back < 0) this.rolled_back = 0;
			this.our_hist_start = base_revision+1;
		}
			
		// Get the remote operations we've already applied (the 2nd elements in this.remote_history).
		var remote_ops = [];
		for (var i = 0; i < this.remote_history.length; i++)
			remote_ops.push(this.remote_history[i][1]);
		
		// Rebase
		if (!(operation instanceof Array)) operation = [operation];
		var original_operation = operation;
		var local_ops = ot.normalize_array(this.our_history.slice(this.rolled_back));
		var r1 = ot.rebase_array(remote_ops, local_ops);
		if (r1 == null)
			operation = null; // flag conflict
		else
			operation = ot.rebase_array(r1, operation); // may also be null, returns array
		
		if (operation == null) {
			// Both sides will experience a similar conflict. Since each side has
			// committed to the document a different set of changes since the last
			// point the documents were sort of in sync, each side has to roll
			// back their changes independently.
			//
			// Once we've rolled back our_history, there is no need to rebase the incoming
			// remote operation. So we can just continue below. But we'll note that it's
			// a conflict.
			var undo = ot.normalize_array( ot.invert_array(this.our_history.slice(this.rolled_back)) );
			this.rolled_back = this.our_history.length;
			if (undo.length > 0) {
				this.document_updater(undo, { "type": "local-conflict-undo" }); // send to local user
				for (var i = 0; i < undo.length; i++) {
					this.local_revision(undo[i], { "type" : "conflict-undo" }); // send to remote user
					this.rolled_back += 1; // because we just put the undo on the history inside local_revision
				}
			}
			operation_metadata["type"] = "conflicted"; // flag that this is probably going to be reset
			this.remote_conflict_pending_undo = true;
			
			operation = original_operation;
		}
		
		// Apply.
		
		if (operation_metadata["type"] == "conflict-undo")
			this.remote_conflict_pending_undo = false; // reset flag
		else if (operation_metadata["type"] == "normal" && this.remote_conflict_pending_undo)
			// turn "normal" into "conflicted" from the point of first conflict
			// until a conflict-undo is received.
			operation_metadata["type"] = "conflicted";
			
		operation_metadata["type"] = "remote-" + operation_metadata["type"];
			
		this.document_updater(operation, operation_metadata);
		
		// Append this operation to the remote_history.
		this.remote_history.push( [base_revision, operation] );
	}
};

