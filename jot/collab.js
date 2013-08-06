var ot = require(__dirname + "/base.js");

exports.TwoWayCollaboration = function(document_updater, the_wire, asymmetric, id) {
	/* The TwoWayCollaboration class is a shared state between you and another editor.
	It runs synchronously with your local changes but asynchronously with remote changes.
	
	What synchronously means here is that when the local user makes a
	change to the document, local_revision() must be called with that operation
	(or an array of operations) before any further calls to process_remote_message().
	
	document_updater is a method  which takes an array of operation objects and
	a dict of metadata as its argument, and it is responsible for
	updating the local document with changes from the remote end.
	
	the_wire is an method responsible for putting messages
	on the wire to the remote user. It accepts any object to be sent over the wire."""
	*/
	
	this.id = id || "";
	this.document_updater = document_updater;
	this.to_the_wire = the_wire;
	this.asymmetric = asymmetric || false;
		
	this.our_hist_start = 0;
	this.our_history = [];
	this.rolled_back = 0;
	
	this.remote_hist_start = 0;
	this.remote_history = [];
	this.needs_ack = 0; // 0=do nothing, 1=send no-op, 2=send ping
	
	// symmetric mode
	this.remote_conflict_pending_undo = false;
	
	// asymmetric mode
	this.remote_conflicted_operations = [];
	
	// public methods

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
		this.needs_ack = 0;
		
		this.log_queue_sizes();		
	}
	
	this.send_ping = function(as_no_op) {
		if (this.needs_ack == 1) {
			this.local_revision({ type: "no-op" });
		} else if (this.needs_ack == 2) {
			this.to_the_wire({
				base_rev: this.remote_hist_start + this.remote_history.length - 1,
				op: "PING"
			});
			this.needs_ack = 0;
		}
	};
	
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
		
		// This might just be a ping that allows us to clear buffers knowing that the
		// other end has received and applied our base_revision revision.
		if (operation == "PING") {
			this.log_queue_sizes();
			return;
		}
			
		// Get the remote operations we've already applied (the 2nd elements in this.remote_history).
		var remote_ops = [];
		for (var i = 0; i < this.remote_history.length; i++)
			remote_ops.push(this.remote_history[i][1]);
		
		// Get the current operations coming in, appended to any held-back operations from a conflict (asymmetric).
		if (!(operation instanceof Array)) operation = [operation];
		var original_operation = operation;
		operation = this.remote_conflicted_operations.concat(operation);
		operation = ot.normalize_array(operation);
		
		// Rebase against (our recent changes rebased against the remote operations we've already applied).
		var local_ops = ot.normalize_array(this.our_history.slice(this.rolled_back));
		var r1 = ot.rebase_array(remote_ops, local_ops);
		if (r1 == null)
			operation = null; // flag conflict
		else
			operation = ot.rebase_array(r1, operation); // may also be null, returns array
		
		if (operation == null) {
			if (!asymmetric) {
				// Symmetric Mode
				// --------------
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
				
			} else {
				// Asymmetric Mode
				// ---------------
				// In asymmetric mode, one side (this side!) is privileged. The other side
				// runs with asymmetric=false, and it will still blow away its own changes
				// and send undo-operations when there is a conflict.
				//
				// The privileged side (this side) will not blow away its own changes. Instead,
				// we wait for the remote end to send enough undo operations so that there's
				// no longer a conflict.
				for (var i = 0; i < original_operation.length; i++)
					this.remote_conflicted_operations.push(original_operation[i]);
				return;
			}
		}
		
		// Apply.
		
		if (operation_metadata["type"] == "conflict-undo")
			this.remote_conflict_pending_undo = false; // reset flag
		else if (operation_metadata["type"] == "normal" && this.remote_conflict_pending_undo)
			// turn "normal" into "conflicted" from the point of first conflict
			// until a conflict-undo is received.
			operation_metadata["type"] = "conflicted";
			
		operation_metadata["type"] = "remote-" + operation_metadata["type"];
				
		// we may get a no-op as a ping, don't pass that along
		operation = ot.normalize_array(operation);
		if (operation.length > 0)
			this.document_updater(operation, operation_metadata);
		
		// Append this operation to the remote_history.
		this.remote_history.push( [base_revision, operation] );
		this.needs_ack = (operation.length > 0 ? 1 : 2); // will send a no-op, unless this operation was a no-op in which case we'll just ping
		
		// Conflict resolved (asymmetric mode).
		this.remote_conflicted_operations = []
		
		this.log_queue_sizes();
	};
	
	this.log_queue_sizes = function() {
		console.log(this.id + " | queue sizes: " + this.our_history.length + "/" + this.remote_history.length);
	};
};

exports.CollaborationServer = function (){
	/* The CollaborationServer class manages a collaboration between two or more
	   remote participants. The server handles all message passing between participants. */
	   
	this.collaborator_count = 0;
	this.collaborators = { };
	this.doc = { };
	this.ack_interval = 3000;
	this.max_ack_time = 6000;
	
	var me = this;
	
	// send no-ops to each collaborator like pings so that buffers can be
	// cleared when everyone gets on the same page.
	function send_acks_around() {
		for (var c in me.collaborators) {
		  var cb = me.collaborators[c].collab;
		  if (cb.needs_ack) {
			  if (cb.last_ack_time >= me.max_ack_time) {
				  cb.send_ping();
				  cb.last_ack_time = 0;
			  } else {
				  cb.last_ack_time += me.ack_interval;
			  }
		  }
		}
	}
	var timerid = setInterval(send_acks_around, this.ack_interval);
	   
	this.destroy = function() {
		clearInterval(timerid); // ?
	}
	
	this.add_collaborator = function(the_wire) {
		// Registers a new collaborator who can be sent messages through
		// the_wire(msg). Returns an object with properties id and document
		// which holds the current document state.
		
		var id = this.collaborator_count;
		this.collaborator_count += 1;
		console.log("collaborator " + id + " added.");
		
		function doc_updatr(op, op_metadata) {
		   me.document_updated(id, op, op_metadata);
		}
		
		this.collaborators[id] = {
		   // create an asynchronous collaborator
		   collab: new exports.TwoWayCollaboration(doc_updatr, the_wire, true, "c:"+id)
		};
		
		this.collaborators[id].collab.last_ack_time = 0;
		
		return {
		   id: id,
		   document: this.doc
		};
	};
	
	this.remove_collaborator = function(id) {
		console.log("collaborator " + id + " removed.");
		delete this.collaborators[id];
	};
	
	this.process_remote_message = function(id, msg) {
		// We've received a message from a particular collaborator. Pass the message
		// to the TwoWayCollaboration instance, which in turn will lead to
		// document_updated being called.
		this.collaborators[id].collab.process_remote_message(msg);
	};
	
	this.document_updated = function(collaborator_id, operation, operation_metadata) {
		// Apply the operation to our local copy of the document.
		if (!(operation instanceof Array)) operation = [operation];
		ot.apply_array(operation, this.doc);
		
		// Send the operation to every other collaborator.
		for (var c in this.collaborators) {
			if (c != collaborator_id) {
				this.collaborators[c].collab.local_revision(operation, operation_metadata);
				this.collaborators[c].collab.last_ack_time = 0;
			}
		}
	};
	
	this.start_socketio_server = function(port, with_examples) {
		var me = this;
		
		var app = require('http').createServer(handler);
		var io = require('socket.io').listen(app, { log: false });
		
		app.listen(port);
		
		function handler (req, res) {
		  if (with_examples) {
		  	  var cs = require("connect").static(with_examples, {});
		  	  return cs(req, res, function () { res.end(); });
		  }
		  
		  res.writeHead(403);
		  res.end("Nothing here but a socket.io server.");
		}

		//var io = require('socket.io').listen(port);
		
		io.sockets.on('connection', function (socket) {
			var collab_info = me.add_collaborator(function(msg) { socket.emit("op", msg); });

			socket.emit("doc", collab_info.document); // send current state
			
			socket.on("op", function(msg) {
				// message received from client
				me.process_remote_message(collab_info.id, msg);
			});
			socket.on("disconnect", function() {
				me.remove_collaborator(collab_info.id);
			});
		});   	   
	};
};

