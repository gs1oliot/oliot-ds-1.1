var 	auth = require('./auth');
var		rest = require('./rest');
var		config = require('./config/conf.json');
var		ds_api_address = config.DS_API_ADDRESS;
//var		tdt =  require('./tdt/tdt');
var     tdt_address = config.TDT_ADDRESS;

exports.configure = function (app) {	
	app.get('/css/', function (req, res) {
		res.contentType('text/css');
		res.sendfile(__dirname + '/css/DiscoveryService.css');
	});
	
	app.get('/chart/', function (req, res) {
		res.contentType('text/javascript');
		res.sendfile(__dirname + '/public/live_chart.js');
	});
	
	app.get('/addthing', auth.ensureAuthenticated, function(req, res){
		res.render('addthing.jade', {user: req.user, thingname:"", error:null});
	});
	
	app.post('/addthing', auth.ensureAuthenticated, function(req, res){
		var thingname = req.body.thingname;
		var args = "{\"thingname\":\""+thingname+"\"}";
		
		rest.postOperation(ds_api_address, "user/"+req.user.email+"/own", null, req.user.token, null, args, function (error, response) {
			if (error) {
				res.render('addthing.jade', { user: req.user, thingname: thingname, error: error });
			} else {
				res.redirect('/index');
			}
		});
	});
	
	app.get('/delthing/:thingname', auth.ensureAuthenticated, function(req, res){
		var thingname = req.params.thingname;
		var args = "{\"thingname\":\""+thingname+"\"}";
		rest.delOperation(ds_api_address, "thing/"+thingname, null, req.user.token, null, args, function (error, response) {
			if (error) {
				res.render('error.jade', { user: req.user, thingname: thingname, error: error });
			} else {
				res.redirect('/index');
			}
		});
	});
	

	app.get('/thing/:thingname', auth.ensureAuthenticated, function(req, res){
		rest.getOperation(tdt_address,"thingname/"+req.params.thingname+"/type/PURE_IDENTITY", null, null, null ,null, function (error, response) {
			if(error){
				res.render('error.jade', { user: req.user, thingname: req.params.thingname, error: error });
			} else {
				var thingname = response.result;
				//var thingname = tdt.convertString(req.params.thingname, 'PURE_IDENTITY');
				rest.getOperation (ds_api_address, "user/"+req.user.email+"/thing/"+thingname+"/have", null, req.user.token, null, null, function (error, response) {
					if (error) {
						res.render('error.jade', { user: req.user, thingname: thingname, error: error });
					} else {
						var encodeServices = [];
						if(response.services){
							for(var i=0; i < response.services.length; i++){
								encodeServices.push(encodeURIComponent(response.services[i]));
							}
						}
						if(response.owner === 'yes'){
							res.render('editthing.jade', { user: req.user, thingname: thingname, services: response.services, encodeservices: encodeServices, owner: response.owner, error: error });
						} else {
							res.render('editthing.jade', { user: req.user, thingname: thingname, services: response.services, encodeservices: encodeServices, error: error });
							
						}
					}
				});
			}
		});
	});
	
	app.get('/thing/:thingname/servicetype/:servicetype', auth.ensureAuthenticated, function(req, res){
		var thingname = req.params.thingname;
		var servicetype = req.params.servicetype;
		rest.getOperation (tdt_address, "thingname/"+thingname+"/servicetype/"+servicetype, null, null, null, null, function (error, services) {
			if (error) {
				return res.send(error)
			} else {
				res.send(services);
			}
		});
		/*tdt.getServices(thingname, servicetype, function(err, services){
			if(err){
				return res.send(err)
			}
			res.send(services);
		});*/
	});
	
	app.get('/addgroup', auth.ensureAuthenticated, function(req, res){
		res.render('addgroup.jade', {user: req.user, groupname:"", error:null});
	});
	

	app.post('/addgroup', auth.ensureAuthenticated, function(req, res){
		var groupname = req.body.groupname;
		var args = "{\"groupname\":\""+groupname+"\"}";
		
		rest.postOperation(ds_api_address, "user/"+req.user.email+"/manage", null, req.user.token, null, args, function (error, response) {
			if (error) {
				res.render('addgroup.jade', {user: req.user, groupname:"", error: error});
			} else {
				res.redirect('/index');
			}
		});
		
	
	});
	
	app.get('/delgroup/:groupname', auth.ensureAuthenticated, function(req, res){
		var groupname = req.params.groupname;
		var args = "{\"groupname\":\""+groupname+"\"}";
		rest.postOperation(ds_api_address, "user/"+req.user.email+"/unmanage", null, req.user.token, null, args, function (error, response) {
			if (error) {
				res.render('error.jade', { user: req.user, groupname: groupname, error: error });
			} else {
				res.redirect('/index');
			}
		});
	});
	
	app.get('/group/:groupname', auth.ensureAuthenticated, function(req, res){
		var groupname = req.params.groupname;
		rest.getOperation(ds_api_address, "group/"+groupname+"/join", null, req.user.token, null, null, function (error, response) {
			res.render('editgroup.jade', { user: req.user, groupname: groupname, users: response.users, error: error });
		});
	});
	

	app.get('/group/:groupname/join', auth.ensureAuthenticated, function(req, res){
		var groupname = req.params.groupname;
		rest.getOperation(ds_api_address, "group/"+groupname+"/other", null, req.user.token, null, null, function (error, response) {
			res.render('adduser.jade', { user: req.user, groupname: groupname, others: response.others, error: error });
		});
	});
	
	app.post('/group/:groupname/join', auth.ensureAuthenticated, function(req, res){
		var groupname = req.params.groupname;
		var username = req.body.username;
		var args = "{\"username\":\""+username+"\"}";
		rest.postOperation(ds_api_address, "group/"+groupname+"/join", null, req.user.token, null, args, function (error, response) {
			if (error) {
				res.render('error.jade', { user: req.user, groupname: groupname, error: error });
			} else {
				res.redirect('/group/'+groupname);
			}
		});
	});
	
	app.get('/group/:groupname/unjoin/:username', auth.ensureAuthenticated, function(req, res){
		var groupname = req.params.groupname;
		var username = req.params.username;
		var args = "{\"username\":\""+username+"\"}";
		rest.postOperation(ds_api_address, "group/"+groupname+"/unjoin", null, req.user.token, null, args, function (error, response) {
			if (error) {
				res.render('error.jade', { user: req.user, groupname: groupname, error: error });
			} else {
				res.redirect('/group/'+groupname);
			}
		});
	});
	
	app.get('/service/:servicename', auth.ensureAuthenticated, function(req, res){
		var servicename = req.params.servicename;
		rest.getOperation(ds_api_address, "service/"+encodeURIComponent(req.params.servicename)+"/grant", null, req.user.token, null, null, function (error, response) {
			var strArray = servicename.split(':');
			rest.getOperation(tdt_address,"thingname/"+strArray[0]+"/type/PURE_IDENTITY", null, null, null ,null, function (error, response) {
				if(error){
					res.render('error.jade', { user: req.user, thingname: strArray[0], servicename: servicename, encodeServicename: encodeURIComponent(servicename), groups: response.groups, users: response.users, error: error });
				} else {
					var pi = response.result;
					//var pi = tdt.convertString(strArray[0], 'PURE_IDENTITY');
					res.render('editservice.jade', { user: req.user,  thingname: pi, servicename: servicename, encodeServicename: encodeURIComponent(servicename), groups: response.groups, users: response.users, error: error });
				}
			});
		});
	});


	app.get('/service/:servicename/view', auth.ensureAuthenticated, function(req, res){
		var servicename = req.params.servicename;
		rest.getOperation(ds_api_address, "authority/service/"+encodeURIComponent(servicename), null, req.user.token, null, null, function (error, response) {
			if(error){
				res.render('error.jade', { user: req.user, servicename: servicename, error: error });
			} else {
				var strArray = servicename.split(':');
				rest.getOperation(tdt_address,"thingname/"+strArray[0]+"/type/PURE_IDENTITY", null, null, null ,null, function (error, response) {
					if(error){
						res.render('error.jade', { user: req.user, servicename: servicename, error: error });
					} else {
						var pi = response.result;
						//var pi = tdt.convertString(strArray[0], 'PURE_IDENTITY');
						res.render('chart.jade', { user: req.user, thingname: pi,  servicename: servicename, encodeServicename: encodeURIComponent(servicename), observe_on: 'false' });
					}
				});
			} 
		});
	});
	
	app.post('/service/:servicename/observeOn', auth.ensureAuthenticated, function(req, res){
		var servicename = req.params.servicename;
		var args = "{\"username\":\""+req.user.email+"\"}";
		rest.postOperation(ds_api_address, "service/"+encodeURIComponent(servicename)+"/observe_on", null, req.user.token, null, args, function (error, response) {
			if(error){
				res.render('error.jade', { user: req.user, servicename: servicename, error: error });
			}
			res.send(response);
		});
	});
	
	app.post('/service/:servicename/observeOff', auth.ensureAuthenticated, function(req, res){
		var servicename = req.params.servicename;
		var args = "{\"username\":\""+req.user.email+"\"}";
		rest.postOperation(ds_api_address, "service/"+encodeURIComponent(servicename)+"/observe_off", null, req.user.token, null, args, function (error, response) {
			if(error){
				res.render('error.jade', { user: req.user, servicename: servicename, error: error });
			}
			res.send(response);
		});
	});
	
	app.get('/service/:servicename/grant', auth.ensureAuthenticated, function(req, res){
		var servicename = req.params.servicename;
		rest.getOperation(ds_api_address, "service/"+encodeURIComponent(servicename)+"/other", null, req.user.token, null, null, function (error, response) {
			res.render('grantgroup.jade', { user: req.user,  servicename: servicename, encodeServicename: encodeURIComponent(servicename), otherGroups: response.otherGroups, otherUsers: response.otherUsers, error: error });
		});
	});
	

	app.post('/service/:servicename/grant', auth.ensureAuthenticated, function(req, res){
		var servicename = req.params.servicename;
		var grantname = req.body.grantname
		var args;
		
		if(grantname.search(req.user.email+":")=== -1){
			args = "{\"username\":\""+grantname+"\"}";
		} else {
			args = "{\"groupname\":\""+grantname+"\"}";
		}
		
		rest.postOperation(ds_api_address, "service/"+encodeURIComponent(servicename)+"/read", null, req.user.token, null, args, function (error, response) {
			if (error) {
				res.render('error.jade', { user: req.user, grantname: grantname, error: error });
			} else {
				res.redirect('/service/'+encodeURIComponent(servicename));
			}
		});
	});

	app.get('/service/:servicename/grant/:grantname/capability', auth.ensureAuthenticated, function(req, res){
		var servicename = req.params.servicename;
		var grantname = req.params.grantname;
		rest.getOperation(ds_api_address, "service/"+encodeURIComponent(servicename)+"/grant/"+grantname+"/capability", null, req.user.token, null, null, function (error, response) {
			res.render('editcapa.jade', { user: req.user, grantname: grantname, encodeGrantname: encodeURIComponent(grantname), servicename: servicename, encodeServicename: encodeURIComponent(servicename), read: response.read, write: response.write, error: error });
		});
	});
	
	app.get('/service/:servicename/ungrant/:grantname', auth.ensureAuthenticated, function(req, res){
		var servicename = req.params.servicename;
		var grantname = req.params.grantname;
		var args;
		
		if(grantname.search(req.user.email+":")=== -1){
			args = "{\"username\":\""+grantname+"\"}";
		} else {
			args = "{\"groupname\":\""+grantname+"\"}";
		}
		
		rest.postOperation(ds_api_address, "service/"+encodeURIComponent(servicename)+"/ungrant", null, req.user.token, null, args, function (error, response) {
			if (error) {
				res.render('error.jade', { user: req.user, servicename: servicename, error: error });
			} else {
				res.redirect('/service/'+encodeURIComponent(servicename));
			}
		});
	});
	

	app.get('/service/:servicename/read/:grantname', auth.ensureAuthenticated, function(req, res){
		var servicename = req.params.servicename;
		var grantname = req.params.grantname
		var args;
		
		if(grantname.search(req.user.email+":")=== -1){
			args = "{\"username\":\""+grantname+"\"}";
		} else {
			args = "{\"groupname\":\""+grantname+"\"}";
		}
		
		rest.postOperation(ds_api_address, "service/"+encodeURIComponent(servicename)+"/read", null, req.user.token, null, args, function (error, response) {
			if (error) {
				res.render('error.jade', { user: req.user, grantname: grantname, error: error });
			} else {
				res.redirect('/service/'+encodeURIComponent(servicename)+'/grant/'+grantname+'/capability');
			}
		});
	});

	app.get('/service/:servicename/unread/:grantname', auth.ensureAuthenticated, function(req, res){
		var servicename = req.params.servicename;
		var grantname = req.params.grantname;
		var args;
		
		if(grantname.search(req.user.email+":")=== -1){
			args = "{\"username\":\""+grantname+"\"}";
		} else {
			args = "{\"groupname\":\""+grantname+"\"}";
		}
		
		rest.postOperation(ds_api_address, "service/"+encodeURIComponent(servicename)+"/unread", null, req.user.token, null, args, function (error, response) {
			if (error) {
				res.render('error.jade', { user: req.user, servicename: servicename, error: error });
			} else {
				res.redirect('/service/'+encodeURIComponent(servicename)+'/grant/'+grantname+'/capability');
			}
		});
	});
	

	app.get('/service/:servicename/write/:grantname', auth.ensureAuthenticated, function(req, res){
		var servicename = req.params.servicename;
		var grantname = req.params.grantname
		var args;
		
		if(grantname.search(req.user.email+":")=== -1){
			args = "{\"username\":\""+grantname+"\"}";
		} else {
			args = "{\"groupname\":\""+grantname+"\"}";
		}
		
		rest.postOperation(ds_api_address, "service/"+encodeURIComponent(servicename)+"/write", null, req.user.token, null, args, function (error, response) {
			if (error) {
				res.render('error.jade', { user: req.user, grantname: grantname, error: error });
			} else {
				res.redirect('/service/'+encodeURIComponent(servicename)+'/grant/'+grantname+'/capability');
			}
		});
	});

	app.get('/service/:servicename/unwrite/:grantname', auth.ensureAuthenticated, function(req, res){
		var servicename = req.params.servicename;
		var grantname = req.params.grantname;
		var args;
		
		if(grantname.search(req.user.email+":")=== -1){
			args = "{\"username\":\""+grantname+"\"}";
		} else {
			args = "{\"groupname\":\""+grantname+"\"}";
		}
		
		rest.postOperation(ds_api_address, "service/"+encodeURIComponent(servicename)+"/unwrite", null, req.user.token, null, args, function (error, response) {
			if (error) {
				res.render('error.jade', { user: req.user, servicename: servicename, error: error });
			} else {
				res.redirect('/service/'+encodeURIComponent(servicename)+'/grant/'+grantname+'/capability');
			}
		});
	});
		
	app.get('/index', auth.ensureAuthenticated, function(req, res){
		var offset = req.param('offset', 0);
		var count = req.param('count', 10);
		rest.getOperation(ds_api_address, "user/"+req.user.email+"/own", null, req.user.token, null, null, function (error, response) {
			var total = null;
			var things = null;
			if (!error && response !== null && response.things.length !== null && response.things !== null) { 
				total = response.things.length;
				things = response.things;
			} else if (!error) {
				error = "invalid JSON returned from FindZones";
			}
			rest.getOperation (ds_api_address, "user/"+req.user.email+"/manage", null, req.user.token, null, null, function (error, response) {
				var groups = null;
				if (!error && response !== null && response.groups.length !== null && response.groups !== null) { 
					groups = response.groups;
				} else if (!error) {
					error = "invalid JSON returned from FindZones";
				}
				res.render('index.jade', { user: req.user, total: total, offset: offset, count: count, things: things, groups: groups, error: error });
			});
		});
	});
	
	app.get('/:offset?/:count?', auth.ensureAuthenticated, function(req, res){
		res.render('switch.jade', { user: req.user });
	});
	

};
