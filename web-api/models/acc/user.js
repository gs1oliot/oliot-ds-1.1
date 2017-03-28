// user.js
// User model logic.

var neo4j = require('neo4j');
var errors = require('./errors');
var Thing = require('./thing');
var Group = require('./group');
var config = require('../../config/conf.json');
var neo4j_url = "http://"+config.NEO_ID+":"+config.NEO_PW+"@"+config.NEO_ADDRESS;


var db = new neo4j.GraphDatabase({
    // Support specifying database info via environment variables,
    // but assume Neo4j installation defaults.
    url: process.env['NEO4J_URL'] || process.env['GRAPHENEDB_URL'] ||
    	neo4j_url,
    auth: process.env['NEO4J_AUTH'],
});

// Private constructor:

var User = module.exports = function User(_node) {
    // All we'll really store is the node; the rest of our properties will be
    // derivable or just pass-through properties (see below).
    this._node = _node;
};

// Public constants:

User.VALIDATION_INFO = {
    'username': {
        required: true,
        minLength: 2,
        maxLength: 25,
        pattern: /^[A-Za-z0-9_@.]+$/,
        message: '2-25 characters; letters, numbers, underscores, \'.\', and \'@\' only.'
    },
};

// Public instance properties:

// The user's username, e.g. 'aseemk'.
Object.defineProperty(User.prototype, 'username', {
    get: function () { return this._node.properties['username']; }
});

// Private helpers:

//Validates the given property based on the validation info above.
//By default, ignores null/undefined/empty values, but you can pass `true` for
//the `required` param to enforce that any required properties are present.
function validateProp(prop, val, required) {
 var info = User.VALIDATION_INFO[prop];
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
// (This allows `User.prototype.patch` to not require any.)
// You can pass `true` for `required` to validate that all required properties
// are present too. (Useful for `User.create`.)
function validate(props, required) {
    var safeProps = {};

    for (var prop in User.VALIDATION_INFO) {
    	if(User.VALIDATION_INFO.hasOwnProperty(prop)){
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

// Atomically updates this user, both locally and remotely in the db, with the
// given property updates.
User.prototype.patch = function (props, callback) {
    var safeProps = validate(props);

    var query = [
        'MATCH (user:User {username: {username}})',
        'SET user += {props}',
        'RETURN user',
    ].join('\n');

    var params = {
        username: this.username,
        props: safeProps,
    };

    var self = this;

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (isConstraintViolation(err)) {
            // TODO: This assumes username is the only relevant constraint.
            // We could parse the constraint property out of the error message,
            // but it'd be nicer if Neo4j returned this data semantically.
            // Alternately, we could tweak our query to explicitly check first
            // whether the username is taken or not.
            err = new errors.ValidationError(
                'The username ‘' + props.username + '’ is taken.');
        }
        if (err) {
        	return callback(err);
        }

        if (!results.length) {
            err = new Error('User has been deleted! Username: ' + self.username);
            return callback(err);
        }

        // Update our node with this updated+latest data from the server:
        self._node = results[0]['user'];

        callback(null);
    });
};

User.prototype.del = function (callback) {
    // Use a Cypher query to delete both this user and his/her following
    // relationships in one query and one network request:
    // (Note that this'll still fail if there are any relationships attached
    // of any other types, which is good because we don't expect any.)
    
	var query = [
	   'MATCH (user:User {username: {thisUsername}})',
	   'MATCH (user)-[:own]->(thing)',
	   'MATCH (thing)-[:have]->(service)',
	   'MATCH (user)-[:manage]->(group)',
	   'DETACH DELETE user, thing, service, group'
	   
	].join('\n');

    var params = {
        thisUsername: this.username,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err) {
        callback(err);
    });
};

User.prototype.manage = function (other, callback) {
    var query = [
        'MATCH (user:User {username: {thisUsername}})',
        'MATCH (other:Group {groupname: {otherGroupname}})',
        'MERGE (user) -[rel:manage]-> (other)',
    ].join('\n');

    var params = {
        thisUsername: this.username,
        otherGroupname: other.groupname,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err) {
        callback(err);
    });
};

User.prototype.unmanage = function (other, callback) {
    var query = [
        'MATCH (user:User {username: {thisUsername}})',
        'MATCH (group:Group {groupname: {otherGroupname}})',
        'MATCH (user)-[:manage]->(group)',
        'DETACH DELETE group',
    ].join('\n');

    var params = {
    	thisUsername: this.username,
        otherGroupname: other.groupname,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err) {
        callback(err);
    });
};


User.prototype.own = function (other, callback) {
    var query = [
        'MATCH (user:User {username: {thisUsername}})',
        'MATCH (other:Thing{thingname: {otherThingname}})',
        'MERGE (user) -[rel:own]-> (other)',
    ].join('\n');

    var params = {
        thisUsername: this.username,
        otherThingname: other.thingname,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err) {
        callback(err);
    });
};

User.prototype.unown = function (other, callback) {
    var query = [
        'MATCH (user:User {username: {thisUsername}})',
        'MATCH (other:Thing {thingname: {otherThingname}})',
        'MATCH (user) -[rel:own]-> (other)',
        'DELETE rel',
    ].join('\n');

    var params = {
    	thisUsername: this.username,
        otherThingname: other.thingname,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err) {
        callback(err);
    });
};


User.get = function (username, callback) {
    var query = [
        'MATCH (user:User {username: {username}})',
        'RETURN user',
    ].join('\n');

    var params = {
        username: username,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }
        if (!results.length) {
            err = new Error('No such user with username: ' + username);
            return callback(err);
        }
        var user = new User(results[0]['user']);
        callback(null, user);
    });
};



User.getOwn = function (username, callback) {

    // Query all users and whether we follow each one or not:
    var query = [
        'MATCH (user:User {username: {thisUsername}})-[:own]->(thing:Thing)',
        'RETURN thing', // COUNT(rel) is a hack for 1 or 0
    ].join('\n');

    var params = {
        thisUsername: username,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }

        var things = [];

        for (var i = 0; i < results.length; i++) {
            //, function(err,thing){
            //	if(thing)
        	var thing = new Thing(results[i]['thing']);
        	if(!thing.thingname) {
        		return callback("Thing exists, but its thingname does not exist");
        	}
        	things.push(thing.thingname);
        	//var things = new thing.Thing(results[i]['thing']);
            //ownerships.push(things.gs1code);
        	//var users = new User(results[i]['thing']);
        	//ownerships.push(users.username);
        }
        //if (owns.length == 0)
        //	callback(null,null);
        callback(null, things);
    });
};

User.getManage = function (username, callback) {

    // Query all users and whether we follow each one or not:
    var query = [
        'MATCH (user:User {username: {thisUsername}})-[:manage]->(group:Group)',
        'RETURN group', // COUNT(rel) is a hack for 1 or 0
    ].join('\n');

    var params = {
        thisUsername: username,
    };

    var user = this;
    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }

        var groups = [];

        for (var i = 0; i < results.length; i++) {
            //, function(err,thing){
            //	if(thing)
        	var group = new Group(results[i]['group']);
        	if(!group.groupname){
        		return callback("Group exists, but its groupname does not exist");
        	}
        	groups.push(group.groupname);
        	//var things = new thing.Thing(results[i]['thing']);
            //ownerships.push(things.gs1code);
        	//var users = new User(results[i]['thing']);
        	//ownerships.push(users.username);
        }
        //if (manages.length == 0)
        //	callback(null,null);
        callback(null, groups);
    });
};


User.getJoin = function (username, callback) {

    // Query all users and whether we follow each one or not:
    var query = [
        'MATCH (user:User {username: {thisUsername}})-[:join]->(group:Group)',
        'RETURN group', // COUNT(rel) is a hack for 1 or 0
    ].join('\n');

    var params = {
        thisUsername: username,
    };

    var user = this;
    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }

        var groups = [];

        for (var i = 0; i < results.length; i++) {
            //, function(err,thing){
            //	if(thing)
        	var group = new Group(results[i]['group']);
        	if(!group.groupname){
        		return callback("Group exists, but its groupname does not exist");
        	}
        	groups.push(group.groupname);
        	//var things = new thing.Thing(results[i]['thing']);
            //ownerships.push(things.gs1code);
        	//var users = new User(results[i]['thing']);
        	//ownerships.push(users.username);
        }
        //if (manages.length == 0)
        //	callback(null,null);
        callback(null, groups);
    });
};

// Creates the user and persists (saves) it to the db, incl. indexing it:
User.create = function (props, callback) {
    var query = [
        'CREATE (user:User {props})',
        'RETURN user',
    ].join('\n');

    var params = {
        props: validate(props)
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (isConstraintViolation(err)) {
            // TODO: This assumes username is the only relevant constraint.
            // We could parse the constraint property out of the error message,
            // but it'd be nicer if Neo4j returned this data semantically.
            // Alternately, we could tweak our query to explicitly check first
            // whether the username is taken or not.
            err = new errors.ValidationError(
                'The username ‘' + props.username + '’ is taken.');
        }
        if (err) {
        	return callback(err);
        }
        var user = new User(results[0]['user']);
        callback(null, user);
    });
};