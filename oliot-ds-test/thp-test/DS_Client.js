var util = require('util');
var argv =  require('optimist')
		.usage('Usage: $0 -n [num] -a [string]')
		.default({n:1000, a:'143.248.53.222'})
		.argv;


var random = require("node-random");

var rest = require('../rest')

var totalFailResponse=0;
var totalSuccessResponse=0;

var num = argv.n; 
var time = argv.t;
var address = argv.a;

var username;
var password;
var token = "dcdebe3afb25eee9b95ec9297465fed9d771c358";
var ds_api_address;
var delta 

username = 'kaist';
password = 'password';
ds_api_address = 'http://143.248.56.222:3001';




random.integers({
	"number": num,
	"minimum": 0,
	"maximum": 9
}, function(error, data) {

var start = Date.now();
for(var i = 0; i< num; ++i){

	thingname= "urn:epc:id:sgtin:8800000.300025."+data[i];
	
	rest.getOperation(ds_api_address, "thing/"+thingname+"/latest",null, token, null, null, function(error, response){
		if (error) {
			totalFailResponse++; 
			if(totalFailResponse + totalSuccessResponse === num){
				delta = (Date.now()) - start;
				console.log("Success: "+totalSuccessResponse+", Fail: " + totalFailResponse);
				console.log("Finished time: "+delta+"ms");
			}
		} else {
			totalSuccessResponse++;
			if(totalFailResponse + totalSuccessResponse === num){
				delta = (Date.now()) - start;
				console.log("Success: "+totalSuccessResponse+", Fail: " + totalFailResponse);
				console.log("Finished time: "+delta+"ms");
			}	
		}
	});
}

var delta = (Date.now()) - start;
console.log('Finished processing request: ' + delta.toString() + 'ms');
});