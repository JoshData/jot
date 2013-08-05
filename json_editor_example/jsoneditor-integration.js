String.prototype.splice = function( idx, rem, s ) {
    return (this.slice(0,idx) + s + this.slice(idx + Math.abs(rem)));
};

function setup_editor(doc) {
	var container = document.getElementById("jsoneditor");
	var editor = new jsoneditor.JSONEditor(container);
	editor.set(doc);
	return editor;
}
		
function setup_editor_hook(event_loop) {
	// must run before setup_editor
	
	var ot_base = require("ot/base.js");
	var ot_obj = require("ot/objects.js");
	var ot_seqs = require("ot/sequences.js");
	var ot_values = require("ot/values.js");
	
	var TreeEditor = jsoneditor.JSONEditor.modes["tree"].editor;
	var _onAction = TreeEditor.prototype._onAction;
	
	function get_path(node) {
		var path = [ ];
		while (node.parent) { // the root node does not have a parent and does not contribute to the path
			if (node.parent.type == "object")
				path.splice(0, 0, node.tmp_field_name ? node.tmp_field_name : node.field);
			else
				path.splice(0, 0, node.parent.childs.indexOf(node));
			node = node.parent;
		}
		return path;
	}
	
	function has_child_already(node, except, field) {
		for (var i in node.childs)
			if (node.childs[i] != except && node.childs[i].field == field)
				return true;
		return false;
	}
	
	function getValue(node, type) {
		if (!type) type = node.type;
		if (type == "auto") {
			// guessing what the editor does
			if (node.value == "true") return true;
			if (node.value == "false") return false;
			if (node.value == "null") return null;
			return node.value; // string
		} else if (type == "string") {
			return node.value;
		} else if (type == "array") {
			var ret = [];
			for (var i in node.childs)
				ret.push(getValue(node.childs[i]));
			return ret;
		} else if (type == "object") {
			var ret = { };
			for (var i in node.childs)
				ret[node.childs[i].field] = getValue(node.childs[i]);
			return ret;
		}
	}
	
	function intercept_on_action(action, params) {
		_onAction.call(this, action, params);
		
		try {
			var op;
			
			if (action == "editValue") {
				var op = ot_values.REP(params.oldValue, params.newValue);
				if (typeof params.oldValue == 'string' && typeof params.newValue == 'string') {
					// if this is a single simple string edit, pass that as the operation
					var op2 = ot_seqs.from_string_rep(op); // converts this to an array
					if (op2.length == 1)
						op = op2[0];
				}
				op = ot_obj.access(get_path(params.node), op);
			}
				
			else if (action == "changeType")
				op = ot_obj.access(get_path(params.node), "values.js",
					"REP",
					getValue(params.node, params.oldType), // this is a little tricky because the old value
					getValue(params.node, params.newType)); // isn't stored anywhere, yet information isn't lost
					
			else if (action == "editField") { // i.e. field name
				var oldValue = params.oldValue;
				if (params.node.tmp_field_name) {
					oldValue = params.node.tmp_field_name;
					delete params.node.tmp_field_name;
				}
				
				// the editor allows names to clash...
				var newValue = params.newValue;
				if (has_child_already(params.node.parent, params.node, newValue)) {
					newValue = make_guid();
					params.node.tmp_field_name = newValue;
				}
				
				op = ot_obj.access(get_path(params.node.parent), "objects.js",
					"REN", oldValue, newValue);
			}
				
			else if (action == "removeNode") {
				if (params.parent.type == "object") {
					op = ot_obj.access(get_path(params.node.parent), "objects.js",
						"DEL", params.node.field, getValue(params.node));
				} else {
					op = ot_obj.access(get_path(params.parent), "sequences.js",
						"DEL", params.index, [getValue(params.node)]);
				}
			}
				
			else if (action == "appendNode" || action == "insertBeforeNode")
				if (params.parent.type == "object") {
					// append/insertBefore/insertAfter all have the same effect on
					// objects because they are unordered in the document model.
					params.node.tmp_field_name = make_guid();
					op = ot_obj.access(get_path(params.parent), "objects.js",
						"PUT", params.node.tmp_field_name, params.node.value);
				} else {
					// array
					var index;
					if (action == "appendNode")
						index = params.parent.childs.length;
					else if (action == "insertBeforeNode")
						index = params.beforeNode.parent.childs.indexOf(params.beforeNode) - 1; // it's already been inserted

					op = ot_obj.access(get_path(params.parent), "sequences.js",
						"INS", index, [getValue(params.node)]);
				}

			else if (action == "duplicateNode") {
				if (params.parent.type == "object") {
					// in an object, duplicate works like creating a new key
					// we'd definitely get a name clash if we didn't set our own name
					params.clone.tmp_field_name = make_guid();
					op = ot_obj.access(get_path(params.parent), "objects.js",
						"PUT", params.clone.tmp_field_name, getValue(params.clone));
				} else { // array
					// in an array, duplicate works like an insert-after
					index = params.parent.childs.indexOf(params.clone); // it's already been inserted
					op = ot_obj.access(get_path(params.parent), "sequences.js",
						"INS", index, [getValue(params.clone)]);
				}
			}

			// TODO : sort, move not yet handled
				
			else {
				console.log(action);
				console.log(params);
				alert("Operation not implemented.");
				return;
			}

			event_loop.push_local_change(op);
		} catch (e) {
			alert(e);
		}
	}
	TreeEditor.prototype._onAction = intercept_on_action;
}

var empty_node;

function apply_to_document(op, node) {
	if (op instanceof Array) {
		for (var i = 0; i < op.length; i++)
			apply_to_document(op[i], node);
		return;
	}
	
	if (!empty_node) {
		// we don't have access to the Node constructor so we have
		// to go about making new nodes a round-about way.
		empty_node = node.editor.node.clone();
		empty_node.type = "auto";
		empty_node.field = null;
		empty_node.childs = undefined;
	}
	
	if (op.module_name == "objects.js") {
		if (op.type == "prop") {
			if (op.old_key) {
				// delete or rename a key
				for (var i in node.childs) {
					if (node.childs[i].field == op.old_key) {
						if (op.new_key)
							node.childs[i].updateField(op.new_key);
						else
							node.removeChild(node.childs[i]);
						return;
					}
				}
			} else {
				// creation of a key
				var k = empty_node.clone();
				k.field = op.new_key;
				k.value = op.new_value; // must transform
				node.appendChild(k);
				return;
			}
		}
		
		if (op.type == "apply") {
			for (var i in node.childs)
				if (node.childs[i].field == op.key)
					apply_to_document(op.op, node.childs[i]);
			return;
		}
	}

	if (op.module_name == "sequences.js" && node.type == "array") {
		if (op.type == "splice") {
			// (Firebase doesn't store empty properties, so we have to check if
			// op.old_value and op.new_value are null before getting length. (?) )
		
			// remove
			for (var i = 0; i < (op.old_value ? op.old_value.length : 0); i++)
				node.removeChild(node.childs[op.pos]);
				
			// insert
			for (var i = 0; i < (op.new_value ? op.new_value.length : 0); i++) {
				var elem = empty_node.clone();
				elem.value = op.new_value[i]; // must transform
				if (node.childs.length == 0)
					node.appendChild(elem);
				else
					node.insertBefore(elem, node.childs[op.pos+i]);
			}
			return;						
		}
		
		if (op.type == "apply") {
			apply_to_document(op.op, node.childs[op.pos]);
			return;
		}
		
	} 

	if (op.module_name == "sequences.js" && (node.type == "string" || node.type == "auto")) {
		if (op.type == "splice") {
			v = node.value.splice(op.pos, op.old_value.length, op.new_value);
			node.updateValue(v);
			return;						
		}
	}
	
	if (op.module_name == "values.js") {
		if (op.type == "rep") {
			node.updateValue(op.new_value);
			return;
		}
	}
	
	alert("Not handled: " + op.module_name + "#" + op.type);
	console.log(op);
	console.log(node);
}

