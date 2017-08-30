// thing.js
// Thing model logic.

var neo4j = require('neo4j');
var errors = require('./errors');
var User = require('./user');
var rest = require('../../rest');
var config = require('../../config/conf.json');
var neo4j_url = "http://"+config.NEO_ID+":"+config.NEO_PW+"@"+config.NEO_ADDRESS;
var cachedb = require('../db/cachedb');

var db = new neo4j.GraphDatabase({
    // Support specifying database info via environment variables,
    // but assume Neo4j installation defaults.
    url: process.env['NEO4J_URL'] || process.env['GRAPHENEDB_URL'] ||
        neo4j_url,
    auth: process.env['NEO4J_AUTH'],
});

// Private constructor:

var Thing = module.exports = function Thing(_node) {
    // All we'll really store is the node; the rest of our properties will be
    // derivable or just pass-through properties (see below).
    this._node = _node;
};

// Public constants:

Thing.VALIDATION_INFO = {
    'thingname': {
        required: true,
        minLength: 2,
        maxLength: 50,
        pattern: /^[A-Za-z0-9.:]+$/,
        message: '2-25 characters; letters, numbers, and \'.\' only.'
    },
};

// Public instance properties:

// The thing's gs1code, e.g. 'aseemk'.
Object.defineProperty(Thing.prototype, 'thingname', {
    get: function () { return this._node.properties['thingname']; }
});

// Private helpers:

//Validates the given property based on the validation info above.
//By default, ignores null/undefined/empty values, but you can pass `true` for
//the `required` param to enforce that any required properties are present.
function validateProp(prop, val, required) {
 var info = Thing.VALIDATION_INFO[prop];
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
// (This allows `Thing.prototype.patch` to not require any.)
// You can pass `true` for `required` to validate that all required properties
// are present too. (Useful for `Thing.create`.)
function validate(props, required) {
    var safeProps = {};

    for (var prop in Thing.VALIDATION_INFO) {
    	if(Thing.VALIDATION_INFO.hasOwnProperty(prop)){
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

// Atomically updates this thing, both locally and remotely in the db, with the
// given property updates.
Thing.prototype.patch = function (props, callback) {
    var safeProps = validate(props);

    var query = [
        'MATCH (thing:Thing {thingname: {thingname}})',
        'SET thing += {props}',
        'RETURN thing',
    ].join('\n');

    var params = {
        thingname: this.thingname,
        props: safeProps,
    };

    var self = this;

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (isConstraintViolation(err)) {
            // TODO: This assumes gs1code is the only relevant constraint.
            // We could parse the constraint property out of the error message,
            // but it'd be nicer if Neo4j returned this data semantically.
            // Alternately, we could tweak our query to explicitly check first
            // whether the gs1code is taken or not.
            err = new errors.ValidationError(
                'The thingname ‘' + props.thingname + '’ is taken.');
        }
        if (err) {
        	return callback(err);
        }

        if (!results.length) {
            err = new Error('Thing has been deleted! thingname: ' + self.thingname);
            return callback(err);
        }

        // Update our node with this updated+latest data from the server:
        self._node = results[0]['thing'];

        callback(null);
    });
};

Thing.prototype.del = function (callback) {
    // Use a Cypher query to delete both this thing and his/her following
    // relationships in one query and one network request:
    // (Note that this'll still fail if there are any relationships attached
    // of any other types, which is good because we don't expect any.)
    var query = [
          'MATCH (thing:Thing {thingname: {thingname}})',
          'OPTIONAL MATCH (thing)-[:have]->(service:Service)',
          'DETACH DELETE thing, service',
    ].join('\n');

    var params = {
        thingname: this.thingname,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err) {
        callback(err);
    });
};



Thing.prototype.have = function (other, callback) {
    var query = [
        'MATCH (thing:Thing {thingname: {thisThingname}})',
        'MATCH (other:Service {servicename: {otherServicename}})',
        'MERGE (thing) -[rel:have]-> (other)',
    ].join('\n');

    var params = {
        thisThingname: this.thingname,
        otherServicename: other.servicename,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err) {
        callback(err);
    });
};

Thing.prototype.unhave = function (other, callback) {
    var query = [
        'MATCH (thing:Thing {thingname: {thisThingname}})',
        'MATCH (other:Service {servicename: {otherServicename}})',
        'MATCH (thing) -[rel:have]-> (other)',
        'DELETE rel',
    ].join('\n');

    var params = {
        thisThingname: this.thingname,
        otherServicename: other.servicename,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err) {
        callback(err);
    });
};

// Static methods:

Thing.get = function (thingname, callback) {
    var query = [
        'MATCH (thing:Thing {thingname: {thingname}})',
        'RETURN thing',
    ].join('\n');

    var params = {
        thingname: thingname,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }
        if (!results.length) {
            err = new Error('No such thing with thingname: ' + thingname);
            return callback(err);
        }
        var thing = new Thing(results[0]['thing']);
        callback(null, thing);
    });
};


Thing.getHave = function (thingname, callback) {
    var query = [
        'MATCH (thing:Thing {thingname: {thisThingname}})',
        'MATCH (thing)-[:have]->(service:Service)',
        'RETURN service.servicename',
    ].join('\n');

    var params = {
        thisThingname: thingname,
    };

    db.cypher({
       query: query,
       params: params,
    }, function (err, results) {
       if (err) {
    	   return callback(err);
       }
       /*if (!results.length) {
          err = new Error('No such service with thingname: ' + thingname);
          return callback(err);
       }*/
       var services = [];
       for(var i =0; i< results.length; i++){
    	   var service = results[i]['service.servicename'];
       	   if(!service){
    		    return callback("Service exists, but its servicename does not exist");
       	   }
    	   services.push(service);
       }
       callback(null, services);
    });
	
};




/*Thing.getThingname = function (_node) {
	
	var thing = new Thing(_node);
	if(!thing.thingname){
		return null;
	}
	return thing.thingname;
};


Thing.getAll = function (callback) {
    var query = [
        'MATCH (thing:Thing)',
        'RETURN thing',
    ].join('\n');

    db.cypher({
        query: query,
    }, function (err, results) {
        if (err) return callback(err);
        var things = results.map(function (result) {
            return new Thing(result['thing']);
        });
        callback(null, things);
    });
};*/

// Creates the thing and persists (saves) it to the db, incl. indexing it:
Thing.create = function (props, callback) {
    var query = [
        'CREATE (thing:Thing {props})',
        'RETURN thing',
    ].join('\n');

    var params = {
        props: validate(props)
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (isConstraintViolation(err)) {
            // TODO: This assumes gs1code is the only relevant constraint.
            // We could parse the constraint property out of the error message,
            // but it'd be nicer if Neo4j returned this data semantically.
            // Alternately, we could tweak our query to explicitly check first
            // whether the gs1code is taken or not.
            err = new errors.ValidationError(
                'The thingname ‘' + props.thingname + '’ is taken.');
        }
        if (err) {
        	return callback(err);
        }
        var thing = new Thing(results[0]['thing']);
        callback(null, thing);
    });
};

Thing.isOwner = function(username, thingname, callback){
    var query = [
        'MATCH (thing:Thing {thingname: {thisThingname}})',
        'MATCH (thing)<-[:own]-(user:User {username: {thisUsername}})',
        'RETURN user',
    ].join('\n');

    var params = {
        thisThingname: thingname,
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

Thing.isAuthority = function(username, thingname, callback){
	if(username === config.SUPER_USER){
    	return callback(null, {result: "success", thingname: thingname});
	};
	cachedb.loadCachedData(username+':'+thingname, function(err, results){
		if(results && JSON.parse(results).authority){
			//console.log("cache hit for :"+username+":"+thingname);
			cachedb.setExpire(username+':'+thingname, config.REDIS_DEFAULT_EXPIRE);
			if(JSON.parse(results).authority === 'true'){
		    	return callback(null, {result: "success", thingname: thingname});
			} else{
				return callback(null, {result: "You are not authorized for the thing: "+thingname });
			}
		}
		
		Thing.isOwner(username, thingname, function(err, results){
			if(err) {
				return callback(err);
			}
			if(results.result === "no"){
			    var query = [
			        //'MATCH (thing:Thing {thingname: {thisThingname}})',
			        //'MATCH (thing)-[:have]->service<-[:read]-group<-[:join]-(user:User {username: {thisUsername}})',
			        //'RETURN user',
			        'MATCH (thing:Thing {thingname: {thisThingname}}),(service:Service),(user:User)',
			        'WHERE user.username = {thisUsername} AND (thing-[:have]->service<-[:read]-()<-[:join]-user OR service<-[:read]-user)',
			        'RETURN user',
			    ].join('\n');
			
			    var params = {
			    	thisThingname: thingname,
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
			    	   cachedb.cacheDataWithExpire(username+':'+thingname, JSON.stringify({authority:"true"}), config.REDIS_DEFAULT_EXPIRE);
			    	   return callback(null, {result: "success", thingname: thingname});
			       }
			       callback(null, {result: "You are not authorized for the thing: "+thingname });
			       cachedb.cacheDataWithExpire(username+':'+thingname, JSON.stringify({authority:"false"}), config.REDIS_DEFAULT_EXPIRE);
			       
			    });
			} else {
				callback(null, {result: "success", thingname: thingname});
				cachedb.cacheDataWithExpire(username+':'+thingname, JSON.stringify({authority:"true"}), config.REDIS_DEFAULT_EXPIRE);
			}
		});
	});	
};


Thing.isAuthoritybyTraversal = function(username, thingname, callback){
	Thing.get(thingname, function(err, thing){
		if (err) {
			//console.log(err);
			return callback(err);
		}
		thing.isNeighbor(username, function(err, result){
			if(err){
				return callback(err);
			}
			if(result.result === 'success') {
				return callback(null, {result: "success"});
			}

			var operation = 'db/data/node/'+thing._node._id+'/traverse/node';
			
			var argJson = {
				"order" : "breadth_first",
				"return_filter" : {
					"body" : "position.endNode().hasProperty(\'username\')&&position.endNode().getProperty(\'username\') == \'"+username+"\'",
					"language" : "javascript"
				},
				"prune_evaluator" : {
					"body" : "position.endNode().hasProperty(\'username\')&&position.endNode().getProperty(\'username\') == \'"+username+"\'",
					"language" : "javascript"
				},
				"uniqueness" : "node_global",
				"relationships" : {
					"direction" : "out",
					"type" : "familyship"
				},
				"max_depth" : 7
			};
			var args = JSON.stringify(argJson);
						
			rest.postOperation('http://'+config.NEO_ADDRESS, operation, args, function(err, results){
				if (err){
					console.log(err);
					return callback(err);
				}
				//console.log(results.length);
				if(results.length>0){
					return callback(null, {result: "success"});
				}
				return callback("You are not authorized for the thing: "+thingname);
			});
		});
	});
};


