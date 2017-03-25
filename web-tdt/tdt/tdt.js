var java = require("java");
var path = require("path");
var dns = require("native-dns");
var config = require("../config/conf.json");

java.classpath.push(path.resolve(__dirname,'./lib/tdt-1.0.0.jar'));

var engine;

try{
	engine = java.newInstanceSync("org.fosstrak.tdt.TDTEngine",path.resolve(__dirname,"./"));
} catch(ex){
	console.log(ex.cause.getMessageSync());
}

exports.convertString = function(originString, type){

	var levelType = java.import("org.epcglobalinc.tdt.LevelTypeList");

	var params = java.newInstanceSync("java.util.HashMap");
	params.putSync("taglength", "96");
	params.putSync("filter", "3");
	params.putSync("gs1companyprefixlength", "7");
	var convertedString;
	if(type === 'ONS_HOSTNAME')
		convertedString = engine.convertSync(originString,params,levelType.ONS_HOSTNAME);
	else if(type === 'ELEMENT_STRING')
		convertedString = engine.convertSync(originString,params,levelType.ELEMENT_STRING);
	else if(type === 'LEGACY_AI')
		convertedString = engine.convertSync(originString,params,levelType.LEGACY_AI);
	else if(type === 'PURE_IDENTITY')
		convertedString = engine.convertSync(originString,params,levelType.PURE_IDENTITY);
	return convertedString;
};

exports.getServices =  function(thingname, servicetype, callback){

	var FQDN = exports.convertString(thingname, 'ONS_HOSTNAME');
	
	var question = dns.Question({
	  name: FQDN,
	  type: 'NAPTR',
	});
	var req = dns.Request({
	  question: question,
	  server: { address: config.DNS_ADDRESS, port: 53, type: 'udp' },
	  timeout: 1000,
	  cache: false,
	});

	req.on('timeout', function () {
		return callback('{error: Timeout in making request}');
	});

	req.on('message', function (err, answer) {
		if(err) {
			return callback('{error:'+ err+'}');
		}
		var servicesArray = [];
		answer.answer.forEach(function (a, idx, array) {
			//console.log(a.service);
			if(a.service === servicetype){
				servicesArray.push(array[idx]);
			}
		});
		if(servicesArray.length > 0)
		{
			return callback(null, servicesArray);
		} else {
			return callback('{error: There is no matched services');
		}
		
	});
	
	req.send();
};
