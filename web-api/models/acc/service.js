// service.js
// service model logic.

var neo4j = require('neo4j');
var errors = require('./errors');
var Thing = require('./thing');
var User = require('./user');
var Group = require('./group');
var config = require('../../config/conf.json');
var neo4j_url = "http://"+config.NEO_ID+":"+config.NEO_PW+"@"+config.NEO_ADDRESS;
var dns = require('native-dns');
var tdt = require('../../tdt/tdt');
var cachedb = require('../db/cachedb.js');

var db = new neo4j.GraphDatabase({
    // Support specifying database info via environment variables,
    // but assume Neo4j installation defaults.
    url: process.env['NEO4J_URL'] || process.env['GRAPHENEDB_URL'] ||
    	neo4j_url,
    auth: process.env['NEO4J_AUTH'],
});

// Private constructor:

var Service = module.exports = function Service(_node) {
    // All we'll really store is the node; the rest of our properties will be
    // derivable or just pass-through properties (see below).
    this._node = _node;
};

// Public constants:

Service.VALIDATION_INFO = {
    'servicename': {
        required: true,
        minLength: 2,
        maxLength: 100,
        pattern: /^[A-Za-z0-9_@.:/]+$/,
        message: '2-25 characters; letters, numbers, underscores, \'.\', \':\', \'/\', and \'@\' only.'
    },
};

// Public instance properties:

// The service's servicename, e.g. 'aseemk'.
Object.defineProperty(Service.prototype, 'servicename', {
    get: function () { return this._node.properties['servicename']; }
});

// Private helpers:

//Validates the given property based on the validation info above.
//By default, ignores null/undefined/empty values, but you can pass `true` for
//the `required` param to enforce that any required properties are present.

function validateProp(prop, val, required) {
 var info = Service.VALIDATION_INFO[prop];
 var message = info.message;

 if (!val) {
     if (info.required && required) {
         throw new errors.ValidationError(
             'Missing ' + prop + ' (required).');
     } else {
         return;
     }
 }

 if (info.minLength && val.length < info.minLength) {
     throw new errors.ValidationError(
         'Invalid ' + prop + ' (too short). Requirements: ' + message);
 }

 if (info.maxLength && val.length > info.maxLength) {
     throw new errors.ValidationError(
         'Invalid ' + prop + ' (too long). Requirements: ' + message);
 }

 if (info.pattern && !info.pattern.test(val)) {
     throw new errors.ValidationError(
         'Invalid ' + prop + ' (format). Requirements: ' + message);
 }
}

// Takes the given caller-provided properties, selects only known ones,
// validates them, and returns the known subset.
// By default, only validates properties that are present.
// (This allows `service.prototype.patch` to not require any.)
// You can pass `true` for `required` to validate that all required properties
// are present too. (Useful for `service.create`.)
function validate(props, required) {
    var safeProps = {};

    for (var prop in Service.VALIDATION_INFO) {
    	if(Service.VALIDATION_INFO.hasOwnProperty(prop)){
    		var val = props[prop];
    		validateProp(prop, val, required);
    		safeProps[prop] = val;
    	}
    }

    return safeProps;
}


function isConstraintViolation(err) {
    return err instanceof neo4j.ClientError &&
        err.neo4j.code === 'Neo.ClientError.Schema.ConstraintViolation';
}

// Public instance methods:

// Atomically updates this service, both locally and remotely in the db, with the
// given property updates.
Service.prototype.patch = function (props, callback) {
    var safeProps = validate(props);

    var query = [
        'MATCH (service:Service {servicename: {servicename}})',
        'SET service += {props}',
        'RETURN service',
    ].join('\n');

    var params = {
        servicename: this.servicename,
        props: safeProps,
    };

    var self = this;

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (isConstraintViolation(err)) {
            // TODO: This assumes servicename is the only relevant constraint.
            // We could parse the constraint property out of the error message,
            // but it'd be nicer if Neo4j returned this data semantically.
            // Alternately, we could tweak our query to explicitly check first
            // whether the servicename is taken or not.
            err = new errors.ValidationError(
                'The servicename ' + props.servicename + 'is taken.');
        }
        if (err) {
        	return callback(err);
        }

        if (!results.length) {
            err = new Error('service has been deleted! Servicename: ' + self.servicename);
            return callback(err);
        }

        // Update our node with this updated+latest data from the server:
        self._node = results[0]['service'];

        callback(null);
    });
};

Service.prototype.del = function (callback) {
    // Use a Cypher query to delete both this service and his/her following
    // relationships in one query and one network request:
    // (Note that this'll still fail if there are any relationships attached
    // of any other types, which is good because we don't expect any.)
    var query = [
        'MATCH (service:Service {servicename: {servicename}})',
        'DETACH DELETE service',
    ].join('\n');

    var params = {
        servicename: this.servicename,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err) {
        callback(err);
    });
};



Service.prototype.ungrant = function (other, callback) {
    var query;
	var name;
	if(other.groupname){
		name = other.groupname;
		query = [
		         'MATCH (service:Service {servicename: {thisServicename}})',
		         'MATCH (other:Group {groupname: {otherName}})',
		         'MATCH (service) <-[rel]- (other)',
		         'DELETE rel',
		     ].join('\n');
	} else{
		name = other.username;
		query = [
		         'MATCH (service:Service {servicename: {thisServicename}})',
		         'MATCH (other:User {username: {otherName}})',
		         'MATCH (service) <-[rel]- (other)',
		         'DELETE rel',
		     ].join('\n');
	}

    var params = {
        thisServicename: this.servicename,
        otherName: name,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err) {
        callback(err);
    });
};

Service.prototype.readbyGroup = function (other, callback) {
	var strArray = other.groupname.split(':');
	var servicename = this.servicename;
	Service.isOwner(strArray[0], servicename, function(err, results){
		if(err){
			return callback(err);
		}
		if(results.result === "no"){
			return callback("Don't make reading relationship with the group because group owner is not matched");
		}
		var name = other.groupname;
		var query = [
		         'MATCH (service:Service {servicename: {thisServicename}})',
		         'MATCH (other:Group {groupname: {otherName}})',
		         'MERGE (service) <-[rel:read]- (other)',
		         ].join('\n');
		
	    var params = {
	    	thisServicename: servicename,
	        otherName: name,
	    };
	
	    db.cypher({
	        query: query,
	        params: params,
	    }, function (err) {
	        callback(err);
	    });
	});
};


Service.prototype.readbyUser = function (other, callback) {
	var servicename = this.servicename;
	Service.isOwner(other.username, servicename, function(err, results){
		if(err){
			return callback(err);
		}
		if(results.result === "yes"){
			return callback("Don't make reading relationship with owner because it already has reading capability");
		}
		var name = other.username;
		var query = [
		         'MATCH (service:Service {servicename: {thisServicename}})',
		         'MATCH (other:User {username: {otherName}})',
		         'MERGE (service) <-[rel:read]- (other)',
		         ].join('\n');
	
	    var params = {
	        thisServicename: servicename,
	        otherName: name,
	    };
	
	    db.cypher({
	        query: query,
	        params: params,
	    }, function (err) {
	        callback(err);
	    });
    });
};

Service.prototype.unread = function (other, callback) {
    var query;
	var name;
	if(other.groupname){
		name = other.groupname;
		query = [
		         'MATCH (service:Service {servicename: {thisServicename}})',
		         'MATCH (other:Group {groupname: {otherName}})',
		         'MATCH (service) <-[rel:read]- (other)',
		         'DELETE rel',
		     ].join('\n');
	} else{
		name = other.username;
		query = [
		         'MATCH (service:Service {servicename: {thisServicename}})',
		         'MATCH (other:User {username: {otherName}})',
		         'MATCH (service) <-[rel:read]- (other)',
		         'DELETE rel',
		     ].join('\n');
	}

    var params = {
        thisServicename: this.servicename,
        otherName: name,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err) {
        callback(err);
    });
};


Service.prototype.write = function (other, callback) {
    var query;
	var name;
	
	if(other.groupname){
		name = other.groupname;
		query = [
		         'MATCH (service:Service {servicename: {thisServicename}})',
		         'MATCH (other:Group {groupname: {otherName}})',
		         'MERGE (service) <-[rel:write]- (other)',
		         ].join('\n');
	} else{
		name = other.username;
		query = [
		         'MATCH (service:Service {servicename: {thisServicename}})',
		         'MATCH (other:User {username: {otherName}})',
		         'MERGE (service) <-[rel:write]- (other)',
		         ].join('\n');
	}

    var params = {
        thisServicename: this.servicename,
        otherName: name,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err) {
        callback(err);
    });
};

Service.prototype.unwrite = function (other, callback) {
    var query;
	var name;
	if(other.groupname){
		name = other.groupname;
		query = [
		         'MATCH (service:Service {servicename: {thisServicename}})',
		         'MATCH (other:Group {groupname: {otherName}})',
		         'MATCH (service) <-[rel:write]- (other)',
		         'DELETE rel',
		     ].join('\n');
	} else{
		name = other.username;
		query = [
		         'MATCH (service:Service {servicename: {thisServicename}})',
		         'MATCH (other:User {username: {otherName}})',
		         'MATCH (service) <-[rel:write]- (other)',
		         'DELETE rel',
		     ].join('\n');
	}

    var params = {
        thisServicename: this.servicename,
        otherName: name,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err) {
        callback(err);
    });
};



// Calls callback w/ (err, following, others), where following is an array of
// services this service follows, and others is all other services minus him/herself.
Service.prototype.getGrantAndOthers = function (callback) {
    // Query all services and whether we follow each one or not:
	var servicename = this.servicename;
	Service.getUser(servicename, function (err, username){
		if(err) {
			return callback(err);
		}
		
		var query = [
		  'MATCH (service:Service {servicename: {thisServicename}})',           
		  'MATCH (user:User {username: {thisUsername}})-[:manage]->(group:Group)',
	      'OPTIONAL MATCH (service)<-[rel]-(group)',   
		  'RETURN group, COUNT(rel)', 
		].join('\n');
		
	    var params = {
		        thisServicename: servicename,
		        thisUsername: username,
		};

		db.cypher({
		    query: query,
		    params: params,
		}, function (err, results) {
		        if (err) {
		        	return callback(err);
		        }

		        var reads = [];
		        var others = [];

		        for (var i = 0; i < results.length; i++) {
		            var group = new Group(results[i]['group']);
		            var read = results[i]['COUNT(rel)'];
		            
		            if (read) {
		                reads.push(group.groupname);
		            } else {
		                others.push(group.groupname);
		            }
		        }

		        callback(null, reads, others);
		        
		});
	});

};



Service.prototype.getGrantAndOtherUsers= function (callback) {
	var servicename = this.servicename;
	Service.getUser(servicename, function (err, username){
		if(err) {
			return callback(err);
			}
	    // Query all services and whether we follow each one or not:
		var query = [
			  'MATCH (service:Service {servicename: {thisServicename}})',           
			  'MATCH (user:User)',
		      'OPTIONAL MATCH (service)<-[rel]-(user)',   
			  'RETURN user, COUNT(rel)', 
			].join('\n');
			
		var params = {
				thisServicename: servicename,
		};
	
		db.cypher({
			query: query,
			params: params,
		}, function (err, results) {
			if (err) {
				return callback(err);
			}
	
			var reads = [];
			var others = [];
	
			for (var i = 0; i < results.length; i++) {
				var user = new User(results[i]['user']);
				var read = results[i]['COUNT(rel)'];
				if(user.username != username){
					if (read) {
						reads.push(user.username);
					} else {
						others.push(user.username);
					}
				}
			}
			callback(null, reads, others);
		});
	});
};


Service.prototype.getCapability = function (grantname, callback) {
	var servicename = this.servicename;
	Service.getUser(servicename, function (err, username){
		if(err) {
			return callback(err);
		}

		var query
	    // Query all services and whether we follow each one or not:
		if(grantname.search(username+":")=== -1){
			query = [
			         'MATCH (service:Service {servicename: {thisServicename}})',   
			         'MATCH (grant:User {username: {thisName}})',
			         'OPTIONAL MATCH (service)<-[rel1:read]-(grant)', 
			         'OPTIONAL MATCH (service)<-[rel2:write]-(grant)',  
			         'RETURN grant, COUNT(rel1), COUNT(rel2)',
			         ].join('\n');
		} else {
			query = [
			         'MATCH (service:Service {servicename: {thisServicename}})',           
			         'MATCH (grant:Group {groupname: {thisName}})',
			         'OPTIONAL MATCH (service)<-[rel1:read]-(grant)', 
			         'OPTIONAL MATCH (service)<-[rel2:write]-(grant)',  
			         'RETURN grant, COUNT(rel1), COUNT(rel2)',
					 ].join('\n');
		}
		
		var params = {
				thisServicename: servicename,
				thisName: grantname,
		};
	
		db.cypher({
			query: query,
			params: params,
		}, function (err, results) {
			if (err) {
				return callback(err);
			}
			
			callback(null, results[0]['COUNT(rel1)'], results[0]['COUNT(rel2)']);
		});
	});
};

// Static methods:


Service.getUser = function (servicename, callback) {
	
	var query = [
	    'MATCH (service:Service {servicename: {thisServicename}})<-[:have]-(thing:Thing)',
	    'MATCH (thing) <-[:own]-(user:User)',
        'RETURN user.username', // COUNT(rel) is a hack for 1 or 0
    ].join('\n');

    var params = {
        thisServicename: servicename,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }
        
        if (results.length!==1) {
        	return callback('Mutlple owners for this service! servicename: '+ servicename );
        }
        
        var username = results[0]['user.username'];

        callback(null, username);
    });
	
};

Service.get = function (servicename, callback) {
    var query = [
        'MATCH (service:Service {servicename: {servicename}})',
        'RETURN service',
    ].join('\n');

    var params = {
    	servicename: servicename,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }
        if (!results.length) {
            err = new Error('No such service with servicename: ' + servicename);
            return callback(err);
        }
        var service = new Service(results[0]['service']);
        callback(null, service);
    });
};

Service.getNAPTR = function (FQDN, callback){
	cachedb.loadCachedData(FQDN, function(err, results){
		if(results){
			console.log("cache hit for :"+FQDN);
			cachedb.setExpire(FQDN, config.REDIS_DEFAULT_EXPIRE);
			return callback(err, JSON.parse(results));
		} 
		
		var question = dns.Question({
		  name: FQDN,
		  type: 'NAPTR',
		});
		var req = dns.Request({
		  question: question,
		  server: { address: config.DNS_ADDRESS, port: 53, type: 'udp' },
		  timeout: 5000,
		  cache: false,
		});
	
		req.on('timeout', function () {
			return callback('Timeout in making request');
		});
	
		req.on('message', function (err, answer) {
			if(err) {
				return callback(err);
			}
			cachedb.cacheDataWithExpire(FQDN, JSON.stringify(answer.answer), config.REDIS_DEFAULT_EXPIRE);
			return callback(null, answer.answer);
		});
		
		req.send();
	});
};


Service.setServices = function (thingname, callback) {

	var FQDN = tdt.convertString(thingname, 'ONS_HOSTNAME');
	var es =  tdt.convertString(thingname, 'ELEMENT_STRING');
	
	/*var question = dns.Question({
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
		return callback('Timeout in making request');
	});

	req.on('message', function (err, answer) {
		if(err) {
			return callback(err);
		}
		var es =  tdt.convertString(thingname, 'ELEMENT_STRING');
		cachedb.cacheDataWithExpire(FQDN, JSON.stringify(answer.answer), config.REDIS_DEFAULT_EXPIRE);
		answer.answer.forEach(function (a, idx, array) {
			//console.log(a.service);
			if(a.service === 'rest.api'){
				var strArray = a.regexp.split('!');
				
				Service.create({servicename:es+':'+strArray[2]}, function (err, service){
					if(err) {
						return callback(err);
					}
					Thing.get(thingname, function(err, thing){
						thing.have(service, function(err){
							if(err) {
								return callback(err);
							}
							if(idx === array.length -1) {
								return callback(null);
							}
						});
					});
				});
			}
			return callback(null);
		});
		
	});
	req.send();*/
	
	Service.getNAPTR(FQDN, function(err, results){
		if(err) {
			return callback(err);
		}
		results.forEach(function (a, idx, array) {
			//console.log(a.service);
			if(a.service === 'rest.api'){
				var strArray = a.regexp.split('!');
				
				Service.create({servicename:es+':'+strArray[2]}, function (err, service){
					if(err) {
						return callback(err);
					}
					Thing.get(thingname, function(err, thing){
						thing.have(service, function(err){
							if(err) {
								return callback(err);
							}
							if(idx === array.length -1) {
								return callback(null);
							}
						});
					});
				});
			}
			return callback(null);
		});
	});
};


// Creates the service and persists (saves) it to the db, incl. indexing it:
Service.create = function (props, callback) {
    var query = [
        'CREATE (service:Service {props})',
        'RETURN service',
    ].join('\n');

    var params = {
        props: validate(props)
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (isConstraintViolation(err)) {
            // TODO: This assumes servicename is the only relevant constraint.
            // We could parse the constraint property out of the error message,
            // but it'd be nicer if Neo4j returned this data semantically.
            // Alternately, we could tweak our query to explicitly check first
            // whether the servicename is taken or not.
            err = new errors.ValidationError(
                'The servicename ' + props.servicename + ' is taken.');
        }
        if (err) {
        	return callback(err);
        }
        var service = new Service(results[0]['service']);
        callback(null, service);
    });
};

Service.isOwner =  function(username, servicename, callback){
    var query = [
                 'MATCH (service:Service {servicename: {thisServicename}})',
                 'MATCH (service)<-[:have]-(thing:Thing)<-[:own]-(user:User {username: {thisUsername}})',
                 'RETURN user',
             ].join('\n');

             var params = {
                 thisServicename: servicename,
                 thisUsername: username,
             };

             db.cypher({
                query: query,
                params: params,
             }, function (err, results) {
                if (err) {
             	   return callback(err);
                }
                if(results.length>0){
             	   return callback(null, {result: "yes"});
                }
                return callback(null, {result: "no"});
                
             });	
};


Service.isAuthority = function(username, servicename, callback){
	
	Service.isOwner(username, servicename, function(err, results){
		if(err) {
			return callback(err);
		}
		if(results.result === "no"){
		    var query = [
		        'MATCH (service:Service {servicename: {thisServicename}})',
		        'MATCH (service)<-[:read]-(group:Group)<-[:join]->(user:User {username: {thisUsername}})',
		        'RETURN user',
		    ].join('\n');
		
		    var params = {
		    	thisServicename: servicename,
		    	thisUsername: username,
		    };
		
		    db.cypher({
		       query: query,
		       params: params,
		    }, function (err, results) {
		       if (err) {
		    	   return callback(err);
		       }
		       if(results.length>0){
		    	   return callback(null, {result: "success"});
		       }
		       return callback("You are not authorized for the service: "+servicename);
		       
		    });
		} else {
			return callback(null, {result: "success"});
		}
	});
		
};


// Static initialization:

// Register our unique servicename constraint.
// TODO: This is done async'ly (fire and forget) here for simplicity,
// but this would be better as a formal schema migration script or similar.
db.createConstraint({
    label: 'Service',
    property: 'servicename',
}, function (err, constraint) {
    if (err) {
    	throw err;     // Failing fast for now, by crash the application.
    }
    if (constraint) {
        console.log('(Registered unique resourcnames constraint.)');
    } else {
        // Constraint already present; no need to log anything.
    }
});
