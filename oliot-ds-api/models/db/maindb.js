var MongoClient = require('mongodb').MongoClient
  , assert = require('assert')
  , config = require('../../config/conf.json')
  , cachedb = require('./cachedb')
  ,	Thing = require('../acc/thing')
  , qs = require('querystring');

// Connection URL
var url = 'mongodb://'+config.MONGO_ADDRESS+'/'+config.MONGO_DBNAME;
var collections = [];

// Use connect method to connect to the Server
MongoClient.connect(url, function(err, db) {
	if(err){
		console.log(err);
	}
	// Get the documents collection
	collections[config.MONGO_COLLECTION] = db.collection(config.MONGO_COLLECTION);
	collections[config.MONGO_COLLECTION+'_latest'] = db.collection(config.MONGO_COLLECTION+'_latest');
	
	console.log("Connected correctly to server");
});

module.exports.getCollection= function (name){
	return collections[name];
};

module.exports.insertData=function(collection, data, callback) {
		var thingname =  data.thingname;
		//cachedb.cacheData(data.thingname, JSON.stringify(data));
		// Insert some documents
		collection.ensureIndex({location: "2dsphere"}, function(err, result) {
		    if(err) {
		    	return callback(err);
		    }
			//console.log(data);
			/*var query ={"thingname": data.thingname};
			query["from"] = {"$lte": new Date(data.timestamp)};
			query["to"] = { "$gt": new Date(data.timestamp)};					
			
			var thingname =  data.thingname;
			
			delete data.thingname;
			
			var update = {"$push": {"dataset": data}};
			
			//console.log(sum);
			
			collection.findAndModify(query,{"thingname":1} ,update, function(err, result){
				if(err) {
					return callback(err);
				}
				//console.log(result);
				if(result.value === null){
					var newData = {"thingname": thingname};
					
					newData["from"] = new Date(data.timestamp);
					newData["to"] = new Date(Date.parse(new Date(data.timestamp)) + 60 * 1000 * 60);
					newData["dataset"] = [data];
					collection.insert(newData, function(err, result){
						if(err) {
							return callback(err);
						}
						return callback(null, {result:"success"});
					});
				}
				return callback(null, {result:"success"});
			});*/
		    

		    collection.insert(data, function(err, result){
					if(err) {
						return callback(err);
					}
					if(result.result.n!==1){
						return callback("result.n is not 1");
					}
					if(result.ops.length!==1){
						return callback("result.ops.length is not 1");
					}
					//console.log(qs.stringify({"thingname":thingname}));
					//cachedb.deleteData(qs.stringify({"thingname":thingname}));
					return callback(null, {result:"success"});
			});
		});
};


module.exports.updateLatestData=function(collection, data, callback) {
	cachedb.cacheData(data.thingname, JSON.stringify(data));
	
	
	collection.ensureIndex({location:"2dsphere"}, function(err, result) {
	    if(err) {
			return callback(err);
	    }
		if(data._id){
			delete data._id;
		}
		//console.log(data);
	    collection.update({"thingname": data.thingname}, data, {upsert:true}, function(err, result){
			if(err) {
				return callback(err);
			}
			return callback(null, {result:"success"});
	    });
	});
};


module.exports.getDatabyTime=function(collection, query, query_url, callback) {
	if(!query.from || !query.to){
		return callback(null, "parameters missing!");	
	}
	var from = query.from;
	var to = query.to;
	
	/*cachedb.loadCachedData(query_url, function(err, result){
		if (result) {	
			//console.log("cache hit for :"+query_url);
			cachedb.setExpire(query_url, config.REDIS_DEFAULT_EXPIRE);
			return callback(null, result);
		} 
	});*/

	/*var aggregates=[];
	var match = {
			"$match": {
				"thingname":query.thingname,
				"$and": [
				        {from: {$lte: new Date(to)}},
				        {to: {$gte: new Date(from)}}
				]
			}
	};
	
	var unwind = {
			"$unwind": "$dataset"
	};
	
	var redact = {
		"$redact":{
			"$cond":{ 
				"if": {"$and": [{"$lte":["$dataset.timestamp", new Date(to)]}, {"$gte":["$dataset.timestamp", new Date(from)]}]},
				"then": "$$KEEP",
				"else": "$$PRUNE"
			}
		}	
	};
	

	var group = {
			"$group":{
				"_id": "$thingname",
				"from": {$min: "$dataset.timestamp"},
				"to": {$max: "$dataset.timestamp"},
				"dataset": { $addToSet:"$dataset" }
			}
	};
	
	aggregates.push(match);
	aggregates.push(unwind);
	aggregates.push(redact);
	aggregates.push(group);
	
	//console.log(JSON.stringify(aggregates,null,4));
	
	collection.aggregate(aggregates).toArray(function(err, docs) {
		if(err) {
			return callback(err);
		}
		//console.log(JSON.stringify(docs,null, 4));
		callback(null, docs);
		cachedb.cacheDataWithExpire(query_url,  JSON.stringify(docs), config.REDIS_DEFAULT_EXPIRE);
	});*/

	
	var findQuery = {
		"thingname":query.thingname
	};
	
	if(from && to){
		findQuery["timestamp"] = {
			$gt: new Date(from),
			$lt: new Date(to)
		};
	}
	
	collection.find(findQuery).sort({"timestamp":1}).toArray(function(err, docs) {
		if(err) {
			return callback(err);
		}
		callback(null, docs);
		//cachedb.cacheDataWithExpire(query_url,  JSON.stringify(docs), config.REDIS_DEFAULT_EXPIRE);
	});
};


module.exports.getDataAll=function(collection, query, query_url, callback) {
	if(!query.thingname){
		return callback(null, "parameters missing!");	
	}
	//console.log(query_url);
	cachedb.loadCachedData(query_url, function(err, result){
		if (result) {	
			//console.log("cache hit for :"+query_url);
			cachedb.setExpire(query_url, config.REDIS_DEFAULT_EXPIRE);
			return callback(null, result);
		} 
	});
	
	var findQuery = {
			"thingname":query.thingname
	};
	collection.find(findQuery).sort({"timestamp":1}).toArray(function(err, docs) {
		if(err) {
			return callback(err);
		}
		callback(null, docs);
		//cachedb.cacheDataWithExpire(query_url,  JSON.stringify(docs), config.REDIS_DEFAULT_EXPIRE);
	});
};



module.exports.getDatabyLocation=function(username, collection, query, query_url, callback) {
	if(!query.where || !query.range){
		return callback(null, "parameters missing!");	
	}
	

	/*cachedb.loadCachedData(query_url, function(err, result){
		if (result) {	
			//console.log("cache hit for :"+query_url);
			cachedb.setExpire(query_url, config.REDIS_DEFAULT_EXPIRE);
			return callback(null, result);
		} 
	});*/
	
	
	var where = JSON.parse(query.where);
	var range = Number(query.range);
	
	var aggregates=[];
	
	
	var geoNear = {
			"$geoNear":{
				"near":{
					"type":"Point",
					"coordinates": where
				},
                "distanceField": "distance",
                "maxDistance": range,
                "spherical": true,
                "query": { "location.type": "Point" }
			}
	};
	var option = {
			"$sort":{"distance":-1}
	};
	
	/*var group = {
			"$group": {
				"_id":"$thingname",
				"latest": {$max: "$timestamp"},
				"data": { 
					$addToSet:{
						"epcis_address": "$epcis_address",
						"thing_address": "$thing_address",
						"timestamp" : "$timestamp",
						"location" : "$location",
						"distance" : "$distance"
					} 
				}
			}
	};
	
	var unwind = { "$unwind":"$data"};
	
	var redact = {
			"$redact":{
				"$cond":{ 
					"if": {"$eq":["$data.timestamp", "$latest"]},
					"then": "$$KEEP",
					"else": "$$PRUNE"
				}
			}	
		};
	
	var project = {
			"$project": {
				"data": {
					"epcis_address": 1,
					"thing_address": 1,
					"timestamp" : 1,
					"location" : 1,
					"distance" : 1
				}
			}
	};*/
	
	
	
	aggregates.push(geoNear);
	aggregates.push(option);
	/*aggregates.push(group);
	aggregates.push(unwind);
	aggregates.push(redact);
	aggregates.push(project);*/
	
	//console.log(JSON.stringify(aggregates,null, 4));
	
	collection.aggregate(aggregates).toArray(function(err, docs){
		if(err) {
			return callback(err);
		}
		//console.log(JSON.stringify(docs,null, 4));
		//console.log(docs);
		/*var delete_element = [];
		var callback_count = 0;
		var doc_length = docs.length;
		docs.forEach(function(currentValue, index, arr){
			Thing.isAuthority(username, currentValue.thingname, function(err, results){
				++callback_count;
				if (err){
					console.log(err);
					return callback(err);
				}
				if(results.result !== 'success'){
					delete_element.push(results.thingname);
				}
				if(callback_count === doc_length){
					if(delete_element.length !== 0){
						var j = 0;
						for(var i=0; i<doc_length;++i){
							if(delete_element.indexOf(docs[j].thingname)>=0){
								docs.splice(j,1);
							} else {
								++j;
							}
						}
					}
					//console.log(docs);
					callback(null, docs);
				}
			});
			
		});*/
		
		//cachedb.cacheDataWithExpire(query_url,  JSON.stringify(docs), config.REDIS_DEFAULT_EXPIRE);
		callback(null, docs);
	});
};

module.exports.getLatestData=function(collection, thingname, callback) {
	
	cachedb.loadCachedData(thingname, function(err, result){
		if (result) {
			//console.log("cache hit for :"+thingname);
			//cachedb.setExpire(thingname, config.REDIS_DEFAULT_EXPIRE);
			return callback(null, result);
		}
	});
	
	var findQuery = {
		"thingname":thingname
	};
	//console.log(findQuery);
	
	collection.find(findQuery).limit(1).sort({"timestamp":-1}).toArray(function(err, docs) {
		if(err) {
			return callback(err);
		}
		callback(null, docs[0]);
		cachedb.cacheData(thingname,  JSON.stringify(docs[0]));
	});
};
