/**
 * http://usejsdoc.org/
 */
var	Redis = require('ioredis');

var redis = new Redis();

module.exports.cacheData=function(id, data) {
	redis.set(id, data);
};

module.exports.deleteData = function(id) {
	redis.del(id);
};
module.exports.cacheDataWithExpire=function(id, data, expire){
	redis.multi().set(id, data).expire(id, expire).exec(function (err, results) {
		 if(err) {
			 console.log(err);
		 }
		 //console.log(results);
	});
};

module.exports.setExpire = function(id, expire) {
	redis.expire(id, expire);
};

module.exports.loadCachedData = function(id, callback){
	redis.get(id, function(err, result){
		if (err){
			return callback(err);
		}
		callback(null, result);
	});
};


