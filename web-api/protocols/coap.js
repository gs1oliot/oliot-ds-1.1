/**
 * New node file
 */
var coap        = require('coap'),
	maindb		= require('../models/db/maindb'), 
	//tdt			= require('../tdt/tdt'),
	socket = require('../ds_socket'),
	config = require('../config/conf.json');

var rest = require('../rest.js');
var tdt_address = config.TDT_ADDRESS;

var res_array = [],
	observe_array = [],
	dataSet = [];
var KalmanFilter = require('kalmanjs').default;

var kalmanFilter = new KalmanFilter({R: 0.01, Q: 0.5});


/**
 * data: Uint8Array. They are sequence of bytes without any delimiter
 *
 * Returns: parsed payload whose type is array
 * **/
function parseFloats(data){

    //console.log("parsePayload(): data type = " + (typeof data) + " data.byteLength = " + data.length);
    //var payload = new Array((data.length-1)/5);
    var payload = new Array(data.length/4);
    //var payload = (Array)(new Float32Array(data));
    var byte_buffer = new Uint8Array(4);
    //var byte_buffer = new ArrayBuffer(4);

    var b = 0;
    for (b = 0; b < data.length; b++) {

        byte_buffer[0] = data[b++];
        byte_buffer[1] = data[b++];
        byte_buffer[2] = data[b++];
        byte_buffer[3] = data[b];

        var parsed_float = new Float32Array(byte_buffer.buffer);
        //console.log("parsed float is " + parsed_float);
        if(dataSet.length === 80){
        	dataSet.splice(0,data.length/4);
        }
        dataSet.push(parsed_float[0]);
    }
    
    var dataKalman = dataSet.map(function(v){
    	return kalmanFilter.filter(v);
    });
    
    payload = dataKalman.slice(dataKalman.length-data.length/4, dataKalman.length);
    
    return payload;
}




module.exports.observe_on =  function(servicename, callback){
	console.log(observe_array.indexOf(servicename));
	if(observe_array.indexOf(servicename)!==-1){
		console.log("already opened socket:"+servicename);
		return callback(null, {result: "success"});
	}
	var strArray = servicename.split(':');
	rest.getSimpleOperation(tdt_address,"thingname/"+strArray[0]+"/type/PURE_IDENTITY", function (error, response) {
		if(error){
			console.log(error);
			return callback(error);
		}
		var pi = response.result;
		//var pi = tdt.convertString(strArray[0], 'PURE_IDENTITY');
		maindb.getData(pi, null, null, null, null, function(err, results){
			if(err){
				console.log(err);
				return callback(err);
			}
			if(results.length === 1){
				coap_req = coap.request({
					host: results[0].thing_address,
					pathname: strArray[1],
					observe: true
				})
						
				
				coap_req.on('response', function(res) {
				  //res.pipe(process.stdout)
				  observe_array.push(servicename);	
				  res_array.push(res);
				  res.on('data', function(data){
					  //var arr = [];
					  //for(i = 0; i < data.length; ++i){
					  //	  arr.push(data[i]);
					  //}
				  	  //console.log(arr.length);
					  var floatArr = parseFloats(data);
					  //console.log(dataKalman);
					  socket.sendData(servicename, floatArr);
				  });
				  return callback(null, {result: "success"});
				});
				
				coap_req.end()
			}
		});
	});
}

module.exports.observe_off = function(servicename, callback){
	var indexOfObserve = observe_array.indexOf(servicename)
	if(indexOfObserve!==-1){
		observe_array.splice(indexOfObserve, 1);
		res_array[indexOfObserve].close();
		res_array.splice(indexOfObserve, 1);
		dataSet.splice(0,dataSet.length);
	}
	return callback(null, {result: "success"});
}