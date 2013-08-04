function setup_connection(my_name) {
	var firebase_name = window.location.hash.substring(1).split(".")[0];
	var firebase_object_name = window.location.hash.split(".")[1];
	var firebase_object_reset = window.location.hash.split(".")[2];
	var firebase_root = new Firebase('https://' + firebase_name + '.firebaseIO.com/');
	var firebase_object = firebase_root.child(firebase_object_name);

	function to_the_wire_func(msg) {
		firebase_object.child("edits").push({
			author: my_name,
			msg: msg}
			);
	}
	
	function register_from_the_wire(callback) {
		firebase_object.child("edits").on('child_added', function(childSnapshot, prevChildName) {
			var v = childSnapshot.val();
			if (v.author == my_name) return;
			// prevent recursive fail (process_remote_message->to_the_wire->child_added) by running async
			setTimeout(function () {
				callback(v.msg);
			}, 0); 
		});
	}

	firebase_object.child('doc').once('value', function(dataSnapshot) {
		var doc = dataSnapshot.val();
		if (!doc || firebase_object_reset) {
			doc = {
				"array": [1, 2, 3],
				"boolean": true,
				"null": null,
				"number": 123,
				"object": {"a": "b", "c": "d"},
				"string": "Hello World"
			};
			firebase_object.child('doc').set(doc);
			firebase_object.child('edits').remove(function() {
				setup_rest(doc, to_the_wire_func, register_from_the_wire) 
			});
		} else {
			setup_rest(doc, to_the_wire_func, register_from_the_wire)
		}
	});
}

