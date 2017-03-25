
/**
 * Module dependencies.
 */

var rest = require('../rest')
  , qs = require('querystring');

var random = require("node-random");

var qs = require('querystring');

var rest = require('../rest');

var config = require('../conf.json');


var argv =  require('optimist')
		.usage('Usage: $0 -n [num] -a [string]')
		.default({n:1, a:'127.0.0.1'})
		.argv;

var totalFailResponse=0;
var totalSuccessResponse=0;
var delta;

var num = argv.n;
var address = argv.a;

var ds_api_address = 'http://'+address+':3001';
var tzoffset = (new Date()).getTimezoneOffset() * 60000;
var interval_hour = 100*3600000;

var thingname= config.DS_THING;

var start = new Date(2016, 10, 15, 18, 1, 9, 0);

var fs = require('fs');
var token;

fs.readFile('./token.txt', 'utf8', function (err, data) {
	if (err){
		console.log(err);
	} else{
		token = data;
	}

	for(var i= 0; i< num; ++i){
		
		var body;
			
		var rand = randomInt(0, interval_hour);
			
		var now = new Date(start - (tzoffset-rand)).toISOString();
			
			
		body = {
			epcis_address: 'onsepc.kr',
			timestamp: now,
			thing_address:'2002:8ff8:35e7:0023:a8cc:00ff:fe00:0004',
			location: [127.384462, 36.350377]
		};
			
		var args = {"thingname": thingname,
				"data": body};
		var str = JSON.stringify(args);
		console.log(str);
		rest.postOperation(ds_api_address, "register", null, token, null, str, function (error, response) {
			if (error) {
				console.log(error)
			} else {
				console.log(response.result);
			}
		});	
	}
});

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}



// all environments
/*app.set('port', process.env.PORT || 3002);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' === app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);

app.post('/', function(req, res){
	var thingname;
	
	if(req.body.thingname){
		thingname = req.body.thingname;
	}
	else{
		thingname= "urn:epc:id:sgtin:8800000.300025.111";
	}
	
	if(req.body.set === "Set"){
		var data;
		if(req.body.data){
			data=req.body.data;
		}
		else{
			var now = new Date(new Date() - tzoffset).toISOString();
			//console.log(now.toString())
			data = {
				epcis_address: 'onsepc.kr',
				timestamp: now,
				thing_address:'2002:8ff8:35e7:0023:a8cc:00ff:fe00:0004',
				location: [127.384462, 36.350377]
			};
		}
		var args = {"thingname": thingname,
				"data": data};
		var str = JSON.stringify(args);
		rest.postOperation(ds_api_address, "register", null, token, null, str, function (error, response) {
			if (error) {
				res.render('error.jade', { user: req.user, error: error });
			} else {
				res.render('index.jade', {auth: token});
			}
		});
	}
	else if(req.body.get === "Get"){
		
		var fromtime, totime
		var localfromtime, localtotime;
		
		//console.log(req.body.fromyear+req.body.toyear);
		console.log(req.body.frommonth+req.body.tomonth);
		//console.log(req.body.fromday+req.body.today);
		if(req.body.fromyear && req.body.frommonth && req.body.fromday && req.body.fromhour && req.body.frommin){
			//fromtime = req.body.fromyear+'-'+req.body.frommonth+'-'+req.body.fromday+'T'+req.body.fromhour+':'+req.body.frommin+':00.000Z';
			fromtime = new Date(req.body.fromyear, req.body.frommonth, req.body.fromday, req.body.fromhour, req.body.frommin, 0, 0);
			localfromtime = (new Date(fromtime - tzoffset)).toISOString()
		}	
		if(req.body.toyear && req.body.tomonth && req.body.today && req.body.tohour && req.body.tomin){
			//totime = req.body.toyear+'-'+req.body.tomonth+'-'+req.body.today+'T'+req.body.tohour+':'+req.body.tomin+':00.000Z';
			totime = new Date(req.body.toyear, req.body.tomonth, req.body.today, req.body.tohour, req.body.tomin, 0, 0);
			localtotime = (new Date(totime - tzoffset)).toISOString()
		}

		
		var queryJson={};
		
		queryJson["thingname"] = thingname;
		
		if(fromtime)
			queryJson["from"]=localfromtime;
		if(totime)
			queryJson["to"]=localtotime;
		if(req.body.where)
			queryJson["where"]=req.body.where;
		if(req.body.range)
			queryJson["range"]=req.body.range;
		console.log(queryJson);
		var queryStr = qs.stringify(queryJson)
		console.log(queryStr);
		
		rest.getOperation(ds_api_address, "query?"+queryStr,null, token, null, null, function(error, response){
			if (error) {
				res.render('error.jade', { user: req.user, error: error });
			} else {
				console.log(response.length);
				//console.log(JSON.stringify(response,null, 4));
				//console.log(response);
				res.render('index.jade', {auth: token});
			}
		});
		
		/*rest.getOperation(ds_api_address, "thing/"+thingname+"/latest",null, token, null, null, function(error, response){
			if (error) {
				res.render('error.jade', { user: req.user, error: error });
			} else {
				console.log(response);
				res.render('index.jade', {auth: token});
			}
		});*/
			
		//console.log(fromtime+','+totime)	
		/*if(req.body.gs1code && !req.body.from && !req.body.to && req.body.where && req.body.range){
			var queryStr = qs.stringify({where:req.body.where, range: req.body.range})
			console.log(queryStr);
			
			rest.getOperation(ds_api_address, req.body.gs1code+"/epcis?"+queryStr,null, token, null, null, function(error, response){
				if (error) {
					res.render('error.jade', { user: req.user, gs1code: gs1code, error: error });
				} else {
					res.redirect('/');
				}
			});
		}*/
	/*} else if (req.body.auth === "Auth"){
		rest.authenticate(username, password, function(error, authtoken) {
			if (error) {
				res.render('error.jade', { user: req.user, error: error });
			} else {
				if (authtoken == null) {
					res.render('error.jade', { user: req.user, error: "token is null" });
				} else {
					token = authtoken;
					console.log(token)
					res.render('index.jade', {auth:token});
				}
			}

		});
	}
});*/


/*app.get('/users', user.list);


var httpServer = http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

var io = require('socket.io').listen(httpServer);

io.sockets.on('connection',function(socket){
   socket.emit('toclient',{msg:'Welcome !'});
   socket.on('fromclient',function(data){
       socket.broadcast.emit('toclient',data);
       socket.emit('toclient',data);
       console.log('Message from client :'+data.msg);
   })
});*/
