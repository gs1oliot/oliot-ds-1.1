
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , auth = require('./auth')
  , http = require('http')
  , path = require('path');

var assert = require('assert');

var app = express();


var	passport = require('passport');

var config = require('./config/conf.json');

// all environments
app.set('port', process.env.PORT || config.PORT);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.cookieParser());
app.use(express.bodyParser());
app.use(express.session({ secret: auth.randomString() }));
app.use(express.methodOverride());
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' === app.get('env')) {
  app.use(express.errorHandler());
}


//Initialize the auth layer
auth.configure('/login', '/logout', app);

routes.configure(app);

var httpServer = http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});


var io = require('socket.io').listen(httpServer);

/*io.sockets.on('connection',function(socket){
   socket.emit('toclient',{msg:'Welcome !'});
   socket.on('fromclient',function(data){
       socket.broadcast.emit('toclient',data);
       socket.emit('toclient',data);
       console.log('Message from client :'+data.msg);
   })
});*/

