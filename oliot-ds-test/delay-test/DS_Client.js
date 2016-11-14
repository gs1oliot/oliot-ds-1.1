var util = require('util');

var rest = require('../rest')

var totalFailResponse=0;
var totalSuccessResponse=0;
var delta;

var username;
var password;
var token = "dcdebe3afb25eee9b95ec9297465fed9d771c358";
var ds_api_address;
var delta ;


var random = require("node-random");

username = 'kaist';
password = 'password';
ds_api_address = 'http://143.248.56.222:3001';




var thingname= "urn:epc:id:sgtin:8800000.300025."+Date.now()%10;
var start = Date.now();

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