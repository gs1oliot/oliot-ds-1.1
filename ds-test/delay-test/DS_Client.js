var util = require('util');

var argv =  require('optimist')
		.usage('Usage: $0 -n [num] -a [string]')
		.default({n:2, a:'127.0.0.1'})
		.argv;

var qs = require('querystring');

var rest = require('../rest');

var config = require('../conf.json');

var totalFailResponse=0;
var totalSuccessResponse=0;
var delta;

var num = argv.n;
var address = argv.a;
var ds_api_address = 'http://'+address+':3001';


var random = require("node-random");


var initTime = new Date(2016, 10, 15, 18, 1, 9, 0);
var tzoffset = (new Date()).getTimezoneOffset() * 60000;
var interval_hour = 100*3600000;

var thingname= config.DS_THING;
var start = Date.now(); 

var fs = require('fs');
var token;

fs.readFile('./token.txt', 'utf8', function (err, data) {
	if (err){
		console.log(err);
	} else{
		token = data;
	}

	
	if(num%5 === 0){
		//console.log("time query");
		var localfromtime, localtotime;
		var rand_offset_from = randomInt(0, interval_hour);
		
		localfromtime = (new Date(initTime - (tzoffset-rand_offset_from))).toISOString();
		
		var rand_offset_to = randomInt(rand_offset_from, rand_offset_from + 3600000);
		
		localtotime = (new Date(initTime - (tzoffset-rand_offset_to))).toISOString();
			
		var queryJson={};
		
		queryJson["thingname"] = thingname;
		queryJson["from"]=localfromtime;
		queryJson["to"]=localtotime;
		
		var queryStr = qs.stringify(queryJson);
		console.log(ds_api_address);
		rest.getOperation(ds_api_address, "query?"+queryStr,null, token, null, null, function(error, response){
			if (error) {
				delta = (Date.now()) - start;
				console.log("fail");
				console.log("time: "+delta);
			} else {
				delta = (Date.now()) - start;
				console.log("success");
				console.log("time: "+delta);
			}
		});
			
	} else{
		rest.getOperation(ds_api_address, "thing/"+thingname+"/latest",null, token, null, null, function(error, response){
			if (error) {
				delta = (Date.now()) - start;
				console.log("fail");
				console.log("time: "+delta);
			} else {
				delta = (Date.now()) - start;
				console.log("success");
				console.log("time: "+delta);
			}
		});
	}
});


function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}
