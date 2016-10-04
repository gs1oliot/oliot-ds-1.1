var global_socket,
	io;

exports.configure = function (httpServer) {	
	
	io = require('socket.io').listen(httpServer);
	
	io.sockets.on('connection',function(socket){
	   global_socket = socket;
	});
}

exports.sendData =  function (toclient, data) {
	global_socket.emit(toclient,data);
}