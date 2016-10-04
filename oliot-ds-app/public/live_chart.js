var observe_result=0;

var chart;

var ds_address;

var socket;

var servicename = document.getElementById("servicename").innerHTML;

var strArray = servicename.split(':');

var sensorType = strArray[1].split('/').pop();

var is_observe = 0;

/**
 * point_time_interval: time interval between points in milli seconds.
 * **/
function feedData(points, seriesNo) {
    var index=0;
    var point_time_interval = 1000 / points.length;
    
    //console.log("point_interval_as_ms = " + point_interval_as_ms);
    //var point_time_interval = point_interval_as_ms;
    var series = chart.series[seriesNo];
    var shift = series.data.length > points.length*2; // shift if the series is longer than 3 seconds
    //var shift = series.data.length > points.length * pointsTimeWindow; // shift if the series is longer than 3 seconds
    var time = (new Date()).getTime() - (points.length-1)*point_time_interval;

    for(index=0; index<points.length; index++){
    	//if(sensorType === 'ecg' || sensorType === 'emg')
            series.addPoint({x:time, y:parseFloat(points[index].toFixed(1))}, true, shift);
    	//else
    	//	series.addPoint({x:time, y:points[index]}, true, true);
        //chart.series[seriesNo].addPoint({y:points[index]}, true, shift);
        time += point_time_interval;
    }
    
    var dataMin = series.dataMin;
    var dataMax = series.dataMax;
    chart.yAxis[0].setExtremes(dataMin-((dataMax-dataMin)),dataMax+((dataMax-dataMin)));
}

$("#observe_on").click(function() {
	if(is_observe==0) {
		$.post("/service/"+encodeURIComponent(servicename)+"/observeOn", function(data, status){
			console.log('data:'+data+', status:'+status)
			if(!data.error){
				is_observe = 1;
			}
		});
	}
});

$("#observe_off").click(function() {
	if(is_observe==1) {
		$.post("/service/"+encodeURIComponent(servicename)+"/observeOff", function(data, status){
			console.log('data:'+data+', status:'+status)
			if(!data.error){
				is_observe = 0;
			}
		});
	}
});

$("#back").click(function() {
	if(is_observe==1) {
		$.post("/service/"+encodeURIComponent(servicename)+"/observeOff", function(data, status){
			console.log('data:'+data+', status:'+status)
			if(!data.error){
				is_observe = 0;
			}
		});
	}
});




$.get("/thing/"+strArray[0]+"/servicetype/ds", function(data){
	//todo: deal multiple elements of data
	var serviceArray = data[0].regexp.split('!');
	
	ds_address = serviceArray[2];
	
	socket = io.connect(ds_address);

	socket.on(servicename,function(data){
		//var arr = parseFloats(data);
		feedData(data, 0);
	});
})


$(function () {
    $(document).ready(function () {
        Highcharts.setOptions({
            global: {
                useUTC: false
            }
        });
        
        //if(sensorType === "ecg" || sensorType === "emg"){

            chart =  new Highcharts.Chart({
	            chart: {
	            	renderTo: 'container',
	                type: 'spline',
	                //animation: Highcharts.svg, // don't animate in old IE
	                marginRight: 10
	            },
	            title: {
	                text: 'Live Sensor Data'
	            },
	            xAxis: {
	                type: 'datetime',
	                tickPixelInterval: 150
	            },
	            yAxis: {
	                title: {
	                    text: 'Value'
	                },
	                plotLines: [{
	                    value: 0,
	                    width: 1,
	                    color: '#808080'
	                }]
	            },
	            tooltip: {
	                formatter: function () {
	                    return '<b>' + this.series.name + '</b><br/>' +
	                        Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x) + '<br/>' +
	                        Highcharts.numberFormat(this.y, 1);
	                }
	            },
	            legend: {
	                enabled: false
	            },
	            exporting: {
	                enabled: false
	            },
	            series: [{
	                name: 'Sensor data',
	                data: (function () {
	                    var data = [],
	                        time = (new Date()).getTime(),
	                        i;
	
	                    for (i = -10; i <= 0; i += 1) {
	                        data.push({
	                            x: time,
	                            y: 0
	                        });
	                    }
	                    return data;
	                }())
	            }]
            });
        /*}else{
            chart =  new Highcharts.StockChart({
                chart: {
                	renderTo: 'container',
                },

                rangeSelector: {
                    buttons: [{
                        count: 1,
                        type: 'minute',
                        text: '1M'
                    }, {
                        count: 5,
                        type: 'minute',
                        text: '5M'
                    }, {
                        type: 'all',
                        text: 'All'
                    }],
                    inputEnabled: false,
                    selected: 0
                },
                title: {
                    text: 'Live Sensor Data'
                },
                exporting: {
                    enabled: false
                },
                series: [{
                    name: 'Sensor data',
                    data: (function () {
                        // generate an array of random data
                        var data = [],
                            time = (new Date()).getTime(),
                            i;

                        for (i = -999; i <= 0; i += 1) {
                            data.push({
                                x: time,
                                y: 0
                            });
                        }
                        return data;
                    }()),
                    tooltip: {
                        valueDecimals: 1
                    }
                }]
            });
        	
        }*/
    });
});


/*$(function () {
    $(document).ready(function () {
        Highcharts.setOptions({
            global: {
                useUTC: false
            }
        });

        	
        chart =  new Highcharts.StockChart({
            chart: {
            	renderTo: 'container',
            },

            rangeSelector: {
                buttons: [{
                    count: 1,
                    type: 'minute',
                    text: '1M'
                }, {
                    count: 5,
                    type: 'minute',
                    text: '5M'
                }, {
                    type: 'all',
                    text: 'All'
                }],
                inputEnabled: false,
                selected: 0
            },
            title: {
                text: 'Live Sensor Data'
            },
            exporting: {
                enabled: false
            },
            series: [{
                name: 'Sensor data',
                data: (function () {
                    // generate an array of random data
                    var data = [],
                        time = (new Date()).getTime(),
                        i;

                    for (i = -999; i <= 0; i += 1) {
                        data.push({
                            x: time,
                            y: 0
                        });
                    }
                    return data;
                }()),
                tooltip: {
                    valueDecimals: 1,
                    valueSuffix: '°C'
                }
            }]
        });
    });
});*/