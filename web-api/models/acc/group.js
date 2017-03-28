// group.js
// group model logic.

var neo4j = require('neo4j');
var errors = require('./errors');
var Thing = require('./thing');
var User = require('./user');
var config = require('../../config/conf.json');
var neo4j_url = "http://"+config.NEO_ID+":"+config.NEO_PW+"@"+config.NEO_ADDRESS;

global.config = require('../../config/conf.json');

var db = new neo4j.GraphDatabase({
    // Support specifying database info via environment variables,
    // but assume Neo4j installation defaults.
    url: process.env['NEO4J_URL'] || process.env['GRAPHENEDB_URL'] ||
    	neo4j_url,
    auth: process.env['NEO4J_AUTH'],
});

// Private constructor:

var Group = module.exports = function Group(_node) {
    // All we'll really store is the node; the rest of our properties will be
    // derivable or just pass-through properties (see below).
    this._node = _node;
};

// Public constants:

Group.VALIDATION_INFO = {
    'groupname': {
        required: true,
        minLength: 2,
        maxLength: 50,
        pattern: /^[A-Za-z0-9_@.:]+$/,
        message: '2-50 characters; letters, numbers, underscores, \'.\', \':\', and \'@\' only.'
    },
};

// Public instance properties:

// The group's groupname, e.g. 'aseemk'.
Object.defineProperty(Group.prototype, 'groupname', {
    get: function () { return this._node.properties['groupname']; }
});

// Private helpers:

//Validates the given property based on the validation info above.
//By default, ignores null/undefined/empty values, but you can pass `true` for
//the `required` param to enforce that any required properties are present.
function validateProp(prop, val, required) {
 var info = Group.VALIDATION_INFO[prop];
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
// (This allows `Group.prototype.patch` to not require any.)
// You can pass `true` for `required` to validate that all required properties
// are present too. (Useful for `Group.create`.)
function validate(props, required) {
    var safeProps = {};

    for (var prop in Group.VALIDATION_INFO) {
    	if(Group.VALIDATION_INFO.hasOwnProperty(prop)){
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

// Atomically updates this group, both locally and remotely in the db, with the
// given property updates.
Group.prototype.patch = function (props, callback) {
    var safeProps = validate(props);

    var query = [
        'MATCH (group:Group {groupname: {groupname}})',
        'SET group += {props}',
        'RETURN group',
    ].join('\n');

    var params = {
        groupname: this.groupname,
        props: safeProps,
    };

    var self = this;

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (isConstraintViolation(err)) {
            // TODO: This assumes groupname is the only relevant constraint.
            // We could parse the constraint property out of the error message,
            // but it'd be nicer if Neo4j returned this data semantically.
            // Alternately, we could tweak our query to explicitly check first
            // whether the groupname is taken or not.
            err = new errors.ValidationError(
                'The groupname ‘' + props.groupname + '’ is taken.');
        }
        if (err) {
        	return callback(err);
        }

        if (!results.length) {
            err = new Error('Group has been deleted! Groupname: ' + self.groupname);
            return callback(err);
        }

        // Update our node with this updated+latest data from the server:
        self._node = results[0]['group'];

        callback(null);
    });
};

Group.prototype.del = function (callback) {
    // Use a Cypher query to delete both this group and his/her following
    // relationships in one query and one network request:
    // (Note that this'll still fail if there are any relationships attached
    // of any other types, which is good because we don't expect any.)
    var query = [
      'MATCH (group:Group {groupname: {thisGroupname}})',
      'DETACH DELETE group',
    ].join('\n');

    var params = {
        thisGroupname: this.groupname,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err) {
        callback(err);
    });
};

Group.prototype.join = function (other, callback) {
    var query = [
        'MATCH (group:Group{groupname: {thisGroupname}})',
        'MATCH (other:User {username: {otherUsername}})',
        'MERGE (group) <-[rel:join]- (other)',
    ].join('\n');

    var params = {
        thisGroupname: this.groupname,
        otherUsername: other.username,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err) {
        callback(err);
    });
};

Group.prototype.unjoin = function (other, callback) {
    var query = [
        'MATCH (group:Group{groupname: {thisGroupname}})',
        'MATCH (other:User {username: {otherUsername}})',
        'MATCH (group) <-[rel:join]- (other)',
        'DELETE rel',
    ].join('\n');

    var params = {
    	thisGroupname: this.groupname,
    	otherUsername: other.username,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err) {
        callback(err);
    });
};


// Calls callback w/ (err, following, others), where following is an array of
// groups this group follows, and others is all other groups minus him/herself.
Group.prototype.getMemberAndOthers = function (callback) {
    // Query all groups and whether we follow each one or not:
    var query = [
        'MATCH (group:Group {groupname: {thisGroupname}})',
        'MATCH (other:User)',
        'OPTIONAL MATCH (group) <-[rel:join]- (other)',
        'OPTIONAL MATCH (group) <-[rel1:manage]- (other)',
        'RETURN other.username, COUNT(rel), COUNT(rel1)', // COUNT(rel) is a hack for 1 or 0
    ].join('\n');

    var params = {
        thisGroupname: this.groupname,
    };
    
    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }

        var members = [];
        var others = [];

        for (var i = 0; i < results.length; i++) {
            var other = results[i]['other.username'];
            var member = results[i]['COUNT(rel)'];
            var owner = results[i]['COUNT(rel1)'];
            if (owner){
            	continue;
            }
            else if (member) {
                members.push(other);
            } else {
                others.push(other);
            }
        }

        callback(null, members, others);
    });
};



// Static methods:

Group.get = function (groupname, callback) {
    var query = [
        'MATCH (group:Group {groupname: {groupname}})',
        'RETURN group',
    ].join('\n');

    var params = {
        groupname: groupname,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }
        if (!results.length) {
            err = new Error('No such group with groupname: ' + groupname);
            return callback(err);
        }
        var group = new Group(results[0]['group']);
        callback(null, group);
    });
};

// Creates the group and persists (saves) it to the db, incl. indexing it:
Group.create = function (props, callback) {
    var query = [
        'CREATE (group:Group {props})',
        'RETURN group',
    ].join('\n');

    var params = {
        props: validate(props)
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (isConstraintViolation(err)) {
            // TODO: This assumes groupname is the only relevant constraint.
            // We could parse the constraint property out of the error message,
            // but it'd be nicer if Neo4j returned this data semantically.
            // Alternately, we could tweak our query to explicitly check first
            // whether the groupname is taken or not.
            err = new errors.ValidationError(
                'The groupname ‘' + props.groupname + '’ is taken.');
        }
        if (err) {
        	return callback(err);
        }
        var group = new Group(results[0]['group']);
        callback(null, group);
    });
};