var java = require("java");
var path = require("path");

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
