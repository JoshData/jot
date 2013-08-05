var collab = require("./ot/collab.js");

var server = new collab.CollaborationServer();
server.start_socketio_server(8080, "json_editor_example/");

