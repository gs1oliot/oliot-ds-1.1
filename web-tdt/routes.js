var		tdt =  require('./tdt/tdt');

exports.configure = function (app) {	
	app.get('/thingname/:thingname/type/:type', function(req, res){
		res.send({result:tdt.convertString(req.params.thingname, req.params.type)});
	});

	app.get('/thingname/:thingname/servicetype/:servicetype', function(req, res){
		var thingname = req.params.thingname;
		var servicetype = req.params.servicetype;
		tdt.getServices(thingname, servicetype, function(err, services){
			if(err){
				return res.send(err)
			}
			res.send(services);
		});
	});
};
