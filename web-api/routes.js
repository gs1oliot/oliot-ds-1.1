var bodyParser = require('body-parser'),
	oauthserver = require('oauth2-server'),
	md5 =  require('md5'),
	auth = require('./models/acc/auth'),
	User = require('./models/acc/user'),
	Thing = require('./models/acc/thing'),
	Group = require('./models/acc/group'),
	Service = require('./models/acc/service'),
	rest = require('./rest'),
	maindb = require('./models/db/maindb'),
	qs = require('querystring'),
	Coap = require('./protocols/coap'),
	dns = require('native-dns');

var config = require('./config/conf.json');


exports.configure = function (app) {	
	 
	app.use(bodyParser.urlencoded({ extended: true }));
	 
	app.use(bodyParser.json());
	 
	app.oauth = oauthserver({
	  model: require('./models/acc/auth'), 
	  grants: ['password', 'refresh_token'],
	  debug: true,
	  accessTokenLifetime: 3600/*,
	  refreshTokenLifetime: 999999999*/
	});

	app.all('/oauth/token', app.oauth.grant()); 
	
	app.use(app.oauth.errorHandler());
	
	app.del('/thing'/*, app.oauth.authorise()*/, function (req, res){
		
		Thing.delall(function(err){
			if(err) {
				return err;
			}
			res.send({result: "success"});
			
		});
		
	});
	
	app.del('/user'/*, app.oauth.authorise()*/, function (req, res){
		
		User.delall(function(err){
			if(err) {
				return err;
			}
			res.send({result: "success"});
			
		});
		
	});
	
	app.get('/delall',function (req, res){
		
		Thing.delall(function(err){
			if(err) {
				return err;
			}
			
		});
		
		User.delall(function(err){
			if(err) {
				return err;
			}
			res.send({result: "success"});
			
		});
		
	});
	
	app.get('/delthing',function (req, res){
		
		Thing.delall(function(err){
			if(err) {
				return err;
			}
			res.send({result: "success"});
			
		});
		
	});
	
	
	app.del('/thing/:thingname', app.oauth.authorise(), function (req, res){
		Thing.get(req.params.thingname, function (err, thing){
			if (err) {
				return res.send({error: err});
			}
			thing.del(function(err){
				if (err) {
					return res.send({error: err});
				}
				res.send({result: "success"});
			});
		});
	});
	
	app.get('/user/:username/thing/:thingname/have', app.oauth.authorise(), function (req, res){
		Thing.isOwner(req.params.username, req.params.thingname, function(err, results){
			if(err) {
				return res.send({error:err});
			}
			Thing.getHave(req.params.thingname, function (err, services){
				if(err) {
					return res.send({error:err});
				}
				res.send({owner: results.result, services:services});
			});
		});
	});

	app.get('/user/:username/own', app.oauth.authorise(), function (req, res){
		User.getOwn(req.params.username, function (err, things){
			if(err) {
				return res.send({error:err});
			}
			res.send({things:things});
		});
	});
	
	app.post('/user/:username/own', app.oauth.authorise(), function (req, res){
		Thing.create({'thingname':req.body.thingname}, function(err1, thing){
			if(err1){
				res.send({ error : err1});
				return;
			}
			User.get(req.params.username, function(err2, user){
				if(err2) {
					return res.send({ error : err2});
				}
				user.own(thing, function(err3){
					if(err3) {
						return res.send({ error : err3});
					}
					Service.setServices(req.body.thingname, function(err4){
						if(err4) {
							return res.send({error :  err4});
						}
						res.send({result: "success"});
					});
				});
			});
		});
	});
	
	app.get('/user/:username/manage', app.oauth.authorise(), function (req, res){
		User.getManage(req.params.username, function (err, groups){
			if(err) {
				return res.send({error:err});
			}
			res.send({groups:groups});
		});
	});
	

	app.post('/user/:username/manage', app.oauth.authorise(), function (req, res){
		var groupname = req.body.groupname;
		if(groupname.indexOf(req.params.username+':') !== 0){
			groupname = req.params.username+':'+req.body.groupname;
		}	
		Group.create({'groupname':groupname}, function(err1, group){
			if(err1){
				res.send({ error : err1.message});
				return;
			}
			User.get(req.params.username, function(err2, user){
				if(err2) {
					return res.send({ error : err2});
				}
				user.manage(group, function(err3){
					if(err3) {
						return res.send({ error : err3});
					}
			    	res.send({result: "success"});
				});
			});
		});
		
	});
	
	app.post('/user/:username/unmanage', app.oauth.authorise(), function (req, res){
		var groupname = req.body.groupname;
		if(groupname.indexOf(req.params.username+':') !== 0){
			groupname = req.params.username+':'+req.body.groupname;
		}
		
		User.get(req.params.username, function (err1, user) {
			if(err1){
				return res.send({ error : err1});
			}
			Group.get(groupname, function (err2, group) {
				if(err2) {
					return res.send({error : err2});
				}
				user.unmanage(group, function (err3){
					if(err3) {
						return res.send({error : err3});
					}
			    	res.send({result: "success"});
				});
			});
		});
	});


	app.get('/group/:groupname/join', app.oauth.authorise(), function (req, res){
		Group.get(req.params.groupname, function (err, group){
			group.getMemberAndOthers(function (err, users, others){
				if(err) {
					return res.sent({error: err});
				}
				res.send({users:users});
			});
		});
	});
	
	app.get('/group/:groupname/other', app.oauth.authorise(), function (req, res){
		Group.get(req.params.groupname, function (err, group){
			group.getMemberAndOthers(function (err, users, others){
				if(err) {
					return res.sent({error: err});
				}
				res.send({others:others});
			});
		});
	});

	app.post('/group/:groupname/join', app.oauth.authorise(), function (req, res){
		Group.get(req.params.groupname, function(err1, group){
			if(err1) {
				return res.send({ error : err1});
			}
			User.get(req.body.username, function(err2, user){
				if(err2) {
					return res.send({ error : err2});
				}
				group.join(user, function(err3){
					if(err3) {
						return res.send({ error : err3});
					}
			    	res.send({result: "success"});
				});
			});
		});
		
	});
	
	app.post('/group/:groupname/unjoin', app.oauth.authorise(), function (req, res){

		Group.get(req.params.groupname, function(err1, group){
			if(err1) {
				return res.send({ error : err1});
			}
			User.get(req.body.username, function(err2, user){
				if(err2) {
					return res.send({ error : err2});
				}
				group.unjoin(user, function(err3){
					if(err3) {
						return res.send({ error : err3});
					}
			    	res.send({result: "success"});
				});
			});
		});
	});
	

	app.get('/service/:servicename/grant', app.oauth.authorise(), function (req, res){
		Service.get(req.params.servicename, function (err, service){
			service.getGrantAndOthers(function (err, groups, otherGroups){
				if(err) {
					return res.send({error: err});
				}
				service.getGrantAndOtherUsers(function (err, users, otherUsers){
					if(err) {
						return res.send({error: err});
					}
					res.send({groups:groups, users:users});
				});
			});
		});
	});

	app.get('/service/:servicename/grant/:grantname/capability', app.oauth.authorise(), function (req, res){
		Service.get(req.params.servicename, function (err, service){
			service.getCapability(req.params.grantname, function (err, read, write){
				if(err) {
					return res.send({error: err});
				}
				res.send({read: read, write: write});
			});
		});
	});
	
	
	
	app.get('/service/:servicename/other', app.oauth.authorise(), function (req, res){
		Service.get(req.params.servicename, function (err, service){
			service.getGrantAndOthers(function (err, groups, otherGroups){
				if(err) {
					return res.send({error: err});
				}
				service.getGrantAndOtherUsers(function (err, users, otherUsers){
					if(err) {
						return res.send({error: err});
					}
					res.send({otherGroups:otherGroups, otherUsers: otherUsers});
				});
			});
		});
	});
	
	app.post('/service/:servicename/ungrant', app.oauth.authorise(), function (req, res){
		Service.get(req.params.servicename, function(err1, service){
			if(err1) {
				return res.send({ error : err1});
			}
			if(req.body.groupname){
				Group.get(req.body.groupname, function(err2, group){
					if(err2) {
						return res.send({ error : err2});
					}
					service.ungrant(group, function(err3){
						if(err3) {
							return res.send({ error : err3});
						}
				    	res.send({result: "success"});
					});
				});
			} else {
				User.get(req.body.username, function(err2, user){
					if(err2) {
						return res.send({ error : err2});
					}
					service.ungrant(user, function(err3){
						if(err3) {
							return res.send({ error : err3});
						}
				    	res.send({result: "success"});
					});
				});
			}
		});
		
	});

	app.post('/service/:servicename/read', app.oauth.authorise(), function (req, res){
		Service.get(req.params.servicename, function(err1, service){
			if(err1) {
				return res.send({ error : err1});
			}
			if(req.body.groupname){
				Group.get(req.body.groupname, function(err2, group){
					if(err2) {
						return res.send({ error : err2});
					}
					service.readbyGroup(group, function(err3){
						if(err3) {
							console.log(err3);
							return res.send({ error : err3});
						}
				    	res.send({result: "success"});
					});
				});
			} else {
				User.get(req.body.username, function(err2, user){
					if(err2) {
						return res.send({ error : err2});
					}
					service.readbyUser(user, function(err3){
						if(err3) {
							return res.send({ error : err3});
						}
				    	res.send({result: "success"});
					});
				});
			}
			
		});
		
	});
	
	app.post('/service/:servicename/unread', app.oauth.authorise(), function (req, res){
		Service.get(req.params.servicename, function(err1, service){
			if(err1) {
				return res.send({ error : err1});
			}
			if(req.body.groupname){
				Group.get(req.body.groupname, function(err2, group){
					if(err2) {
						return res.send({ error : err2});
					}
					service.unread(group, function(err3){
						if(err3) {
							return res.send({ error : err3});
						}
				    	res.send({result: "success"});
					});
				});
			} else {
				User.get(req.body.username, function(err2, user){
					if(err2) {
						return res.send({ error : err2});
					}
					service.unread(user, function(err3){
						if(err3) {
							return res.send({ error : err3});
						}
				    	res.send({result: "success"});
					});
				});
			}
		});
	});
	

	app.post('/service/:servicename/write', app.oauth.authorise(), function (req, res){
		Service.get(req.params.servicename, function(err1, service){
			if(err1) {
				return res.send({ error : err1});
			}
			if(req.body.groupname){
				Group.get(req.body.groupname, function(err2, group){
					if(err2) {
						return res.send({ error : err2});
					}
					service.write(group, function(err3){
						if(err3) {
							return res.send({ error : err3});
						}
				    	res.send({result: "success"});
					});
				});
			} else {
				User.get(req.body.username, function(err2, user){
					if(err2) {
						return res.send({ error : err2});
					}
					service.write(user, function(err3){
						if(err3) {
							return res.send({ error : err3});
						}
				    	res.send({result: "success"});
					});
				});
			}
		});
		
	});
	
	app.post('/service/:servicename/unwrite', app.oauth.authorise(), function (req, res){
		Service.get(req.params.servicename, function(err1, service){
			if(err1) {
				return res.send({ error : err1});
			}
			if(req.body.groupname){
				Group.get(req.body.groupname, function(err2, group){
					if(err2) {
						return res.send({ error : err2});
					}
					service.unwrite(group, function(err3){
						if(err3) {
							return res.send({ error : err3});
						}
				    	res.send({result: "success"});
					});
				});
			} else {
				User.get(req.body.username, function(err2, user){
					if(err2) {
						return res.send({ error : err2});
					}
					service.unwrite(user, function(err3){
						if(err3) {
							return res.send({ error : err3});
						}
				    	res.send({result: "success"});
					});
				});
			}
		});
	});
	

	app.post('/service/:servicename/observe_on', app.oauth.authorise(), function (req, res){
		Service.isAuthority(req.body.username, req.params.servicename,function(err, results){
			if (err){
				console.log(err);
				return res.send({error: err});
			}
			Coap.observe_on(req.params.servicename, function(err, results){
				if(err){
					return res.send({error:err});
				}
				res.send({result: "success"});
			}); 
		});
	});
	
	app.post('/service/:servicename/observe_off', app.oauth.authorise(), function (req, res){
		Service.isAuthority(req.body.username, req.params.servicename,function(err, results){
			if (err){
				console.log(err);
				return res.send({error: err});
			}
			Coap.observe_off(req.params.servicename, function(err, results){
				if(err){
					return res.send({error:err});
				}
				res.send({result: "success"});
			});
		});
	});
	
	app.get('/authority/service/:servicename', app.oauth.authorise(), function(req, res){
		auth.getUserbyToken(req.oauth.bearerToken.accessToken, function(err, results){
			if(err){
				console.log(err);
				return res.send({error: err});
			}
			if(results){
				Service.isAuthority(results.username, req.params.servicename, function(err, results){
					if (err){
						console.log(err);
						return res.send({error: err});
					}
					res.send(results);
				});
			} else{
				res.send({error: "there is no matched user"});
			}
		});
	});
	
	app.post('/register', app.oauth.authorise(), function(req, res){
		auth.getUserbyToken(req.oauth.bearerToken.accessToken, function(err, results){
			if(err){
				console.log(err);
				return res.status(500).send({error: err});
			}
			Thing.isAuthority(results.username, req.body.thingname, function(err, results){
				if (err){
					console.log(err);
					return res.status(500).send({error: err});
				}
				/*redis.get(req.body.thingname, function(err,result){
					if(result !== null){
						//console.log(result);
						//do something more (send something to EPCIS)
					}*/
				if(results.result !== 'success'){
					return res.send(results);
				}

				var storedData = {
					thingname: req.body.thingname,
					epcis_address: req.body.data.epcis_address,
					thing_address: req.body.data.thing_address,
					timestamp: new Date(req.body.data.timestamp),
					location: {
						type:"Point",
						coordinates: req.body.data.location
					}
				};
				maindb.insertData(maindb.getCollection(config.MONGO_COLLECTION), storedData, function(err, result){
					if (err){
						console.log("insert:"+err);
						return res.status(500).send({error: err});
					}
					console.log(result);
					//storedData["thingname"] = req.body.thingname;
				});
				maindb.updateLatestData(maindb.getCollection(config.MONGO_COLLECTION+"_latest"), storedData, function(err, result){
					if (err){
						console.log("update:"+err);
						return res.status(500).send({error: err});
					}
					console.log(result);
				});
				return res.send({result:"success"});
			//});
				
			});
		});
	});
	app.get('/thing/:thingname/latest', app.oauth.authorise(), function(req, res){
		console.log("latest");
		auth.getUserbyToken(req.oauth.bearerToken.accessToken, function(err, results){
			if(err){
				console.log(err);
				return res.status(500).send({error: err});
			}
			Thing.isAuthority(results.username, req.params.thingname, function(err, results){
				if (err){
					console.log(err);
					return res.status(500).send({error: err});
				}
				if(results.result !== 'success'){
					return res.send(results);
				} 
				maindb.getLatestData(maindb.getCollection(config.MONGO_COLLECTION+"_latest"), req.params.thingname,  function(err, results){
					if (err){
						console.log(err);
						return res.status(500).send({error: err});
					}
					//console.log(results);
					return res.send(results);
				});
			});
		});
		
	});
	app.get('/user/map', app.oauth.authorise(), function(req, res){
		auth.getUserbyToken(req.oauth.bearerToken.accessToken, function(err, results){
			if(err){
				console.log(err);
				return res.status(500).send({error: err});
			}
			maindb.getUserMapping(maindb.getCollection(config.USER_COLLECTION), results.username,  function(err, results){
				if (err){
					console.log(err);
					return res.status(500).send({error: err});
				}
				//console.log(results);
				return res.send(results);
			}); 
		});
	});
	app.post('/user/map', app.oauth.authorise(), function(req, res){
		auth.getUserbyToken(req.oauth.bearerToken.accessToken, function(err, results){
			if(err){
				console.log(err);
				return res.status(500).send({error: err});
			}
			var username = results.username;
			Thing.isAuthority(username, req.body.thingname, function(err, results){
				if (err){
					console.log(err);
					return res.status(500).send({error: err});
				}
				if(results.result !== 'success'){
					return res.send(results);
				}
				var storedData = {
					thingname: req.body.thingname,
					username: username
				};
				maindb.updateUserMapping(maindb.getCollection(config.USER_COLLECTION), storedData, function(err, result){
					if (err){
						console.log("insert:"+err);
						return res.status(500).send({error: err});
					}
					console.log(result);
					return res.send({result:result.result});
					//storedData["thingname"] = req.body.thingname;
				});
			});
		});
	});
	
	app.get('/thing/:thingname/latest', app.oauth.authorise(), function(req, res){
		console.log("latest");
		auth.getUserbyToken(req.oauth.bearerToken.accessToken, function(err, results){
			if(err){
				console.log(err);
				return res.status(500).send({error: err});
			}
			Thing.isAuthority(results.username, req.params.thingname, function(err, results){
				if (err){
					console.log(err);
					return res.status(500).send({error: err});
				}
				if(results.result !== 'success'){
					return res.send(results);
				} 
				maindb.getLatestData(maindb.getCollection(config.MONGO_COLLECTION+"_latest"), req.params.thingname,  function(err, results){
					if (err){
						console.log(err);
						return res.status(500).send({error: err});
					}
					//console.log(results);
					return res.send(results);
				});
			});
		});
		
	});
	app.get('/query?:queryStr', app.oauth.authorise(), function(req, res){
		var extractedQuery = req.url.slice(req.url.lastIndexOf('?')+1);
		
		if(req.query.thingname){	
			auth.getUserbyToken(req.oauth.bearerToken.accessToken, function(err, results){
				if(err){
					console.log(err);
					return res.status(500).send({error: err});
				}
				Thing.isAuthority(results.username, req.query.thingname, function(err, results){
					if (err){
						console.log(err);
						return res.status(500).send({error: err});
					}
					if(results.result!=='success'){
						return res.send(results);
					} 
	
					
					maindb.getDatabyTime(maindb.getCollection(config.MONGO_COLLECTION), req.query, extractedQuery,  function(err, results){
						if (err){
							console.log(err);
							return res.status(500).send({error: err});
						}
						if(results !== "parameters missing!"){
							return res.send(results);
						}
						maindb.getDataAll(maindb.getCollection(config.MONGO_COLLECTION), req.query, extractedQuery,  function(err, results){
							if (err){
								console.log(err);
								return res.status(500).send({error: err});
							}
							return res.send(results);
						});
					});
				});
			});
		} else{
			auth.getUserbyToken(req.oauth.bearerToken.accessToken, function(err, results){
				if(err){
					console.log(err);
					return res.status(500).send({error: err});
				}
				
				maindb.getDatabyLocation(results.username, maindb.getCollection(config.MONGO_COLLECTION+"_latest"), req.query, extractedQuery,  function(err, results){
					if (err){
						console.log(err);
						return res.status(500).send({error: err});
					}
					if(results === "parameters missing!"){
						return res.status(500).send({error: results});
					}
					return res.send(results);
				});
			});
		}
	});

	
	app.get('/test/authority/:username/:thingname', function(req, res){
		Thing.isAuthority(req.params.username, req.params.thingname, function(err, results){
			if (err){
				console.log(err);
				return res.send({error: err});
			}
			return res.send(results);
		});
	});
	
	app.get('/getClientidAndToken', function(req, res){
		auth.getClientidAndToken(function (err, results){
			if (err){
				console.log(err);
				return res.send({error: err});
			}
			return res.send(results);
			
		});
	});
	
	app.post('/signup', function (req, res){
		
		auth.getUserbyUsername(req.body.username, function(err, result){
			if(err || result){
				res.send(err? { error : err }: { error : "user already exists"});
				return;
			} 
			auth.saveUser(req.body.username, req.body.password, function(err){
				if(err){
					res.send({ error : err });
					return;
				}
				auth.saveOauthClient(req.body.username.replace(/\./gi,"").replace(/@/gi,""), req.body.password, '/', function(err, result){
					if(err){
						res.send({ error : err });
						return;
					}
					User.create({'username':req.body.username}, function(err, user){
		    			if(err){
							res.send({ error : err });
							return;
		    			}
		    			Group.create({'groupname':req.body.username+':public'}, function(err, group){
			    			if(err){
								res.send({ error : err });
								return;
			    			}
			    			user.manage(group, function(err){
			    				if(err) {
			    					return res.send({ error : err});
			    				}
			    			    res.send({result: "success"});
			    			});
		    			});
		    		});
				});
			});
		});
	});
};
	
