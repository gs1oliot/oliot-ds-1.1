var rest = require('./rest.js');
var config = require('./conf.json');
var fs = require('fs');

var ds_api_address = config.DS_API_ADDRESS;
var username = config.DS_ID;
var password = config.DS_PW;

var args = 'username='+username+'&password='+password;

rest.postOperation(ds_api_address, "signup", null, null, null, args ,function(error, response){
	if(error){
		console.log('signup: '+error);
	}
	else
	{
		console.log('signup: '+response);
	}
	
	rest.authenticate(username, password, function(err, token){
		if(err){
			console.log('token: '+err);
		} else{
			if (token === null) {
				console.log('token: '+"no token");
			} else {
				console.log('token: '+token);
				fs.writeFile('./token.txt', token, function(err) {
					if(err){
						console.log('file: '+err);
					} else{
						var thingname = config.DS_THING
						var args = "{\"thingname\":\""+thingname+"\"}";
						rest.postOperation(ds_api_address, "user/"+username+"/own", null, token, null, args, function (error, result) {
							if (error) {
								console.log('own: '+error.message);
							} else {
								console.log('own: '+result.result);
							}
						});
					}
				});
			}
		}
	});
});
	