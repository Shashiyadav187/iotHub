var express = require('express');
var router = express.Router();
var mongoose = require( 'mongoose' );
var behaviour_helpers = require('../behaviour_helpers'); // add helpers for conditional support

// include models
var Sensor = mongoose.model('Sensor');
var Data = mongoose.model('Data');
var Overview = mongoose.model('Overview');

// shared functions
// this function should take in a large amount of data and return averages optimised for the number of points visible on the client device
function decimateData(data,number_points) {
  let data_length = data.length;
  let multiples_over = Math.floor(data_length / number_points);
  let averaged_data = [];

  for (let i = 0; i < number_points; i++) {
    let point_average_value;
    let point_average_time;
    for(let j = 0; i < multiples_over; j++) {
      point_average_value += data[i+j].value;
      point_average_time += data[i+j].collection_time;
    }
    averaged_data.push({value: point_average_value / multiples_over, collection_time:point_average_time / multiples_over});
  }
  return averaged_data;
}

function checkSensorExists(sensor_id,callback,res) {
  Sensor.findById(sensor_id, function(err,sensor){
    if (err || !sensor) {
      console.error("Sensor not registered err: "+err);
      if (res) res.status(404).json({success:false,error:"Sensor not registered"});
    } else {
      callback(sensor._id);
    }
  });
}

function getCompareDateFromString(filter_date_string) {
  let compare_date = new Date();

  // determine type of filter date, and calculate time period
  if (filter_date_string === "hour") {
    compare_date.setHours(compare_date.getHours() - 1);
  }
  if (filter_date_string === "day") {
    compare_date.setDate(compare_date.getDate()-1);
  }
  if (filter_date_string === "week") {
    compare_date.setDate(compare_date.getDate()-7);
  }
  if (filter_date_string === "month") {
    compare_date.setMonth(compare_date.getMonth() - 1);
  }
  if (filter_date_string === "sixmonth") {
    compare_date.setMonth(compare_date.getMonth() - 6);
  }
  return compare_date;
}

router

// return a list of sensor ids and names
.get('/', function(req, res, next) {
    Sensor.find({},function (err, sensors) {
      if (err) return console.error(err);
      console.log(sensors);
      res.json(sensors);
    });
})

// add a sensor to the database
.post('/', function(req, res, next) {
  var sensor = new Sensor();
  sensor.name = req.body.name;
  sensor.description = req.body.description;
  sensor.data_type = req.body.data_type;
  console.log("Tried to add a new sensor: " + sensor.id + ", name: " +sensor.name + ", description: " +sensor.description );

  // handle issues with conversion
  sensor.save(function(err,sensor) {
    if (err) {
      console.error("Failed to add sensor err: "+err);
      res.json({success:false});
    } else {
      res.json({success:true, id:sensor.id});
    }
  });
})

// update an existing sensor based on an id
.post('/:sensor_id', function(req, res, next) {

  Sensor.findById(req.params.sensor_id, function(err,sensor){
    if (err) {
      console.error("Sensor not registered err: "+err);
      res.status(404).json({success:false});
    } else {
      console.log("Updating sensor: ", sensor._id);
      sensor.name = req.body.name;
      sensor.description = req.body.description;
      console.log(" New name: "+sensor.name + " description: "+sensor.description );
      // handle issues with conversion
      sensor.save(function(err,sensor) {
        if (err) {
          console.error("Failed to update sensor err: "+err);
          res.json({success:false});
        } else {
          res.json({success:true, request:req.body });
        }
      });
    }
  });
})

// get information about a specific sensor
.get('/:sensor_id', function(req, res, next){
  Sensor.findById(req.params.sensor_id,'-__v', function(err,sensor){
    if (err) {
      console.error("Sensor not registered err: "+err);
      res.status(404).json({success:false});
    } else {
      console.log("Retrieved Sensor: ");
      console.log(JSON.stringify(sensor) );
      res.json(sensor);
    }
  });
})

// delete an existing sensor by Id
.delete('/:sensor_id', function(req, res, next){
  Sensor.findById(req.params.sensor_id).remove().exec( function(err,sensor){
    if (err) {
      console.error("Failed to delete sensor err: "+err);
      res.json({success:false});
    } else {
      // delete overview if it has one too
      Overview.find({sensor: req.params.sensor_id}).remove().exec( function(err){
        if (err) {
          console.log("Failed to remove matching overview (maybe it didn't exist) err: "+err);
        }
      });
      // delete associated data
      if (sensor.data > 0) {
        var i = sensor.data.length;
        while (i--) {
          var point = sensor.data[i];
          sensor.data.remove(point);
        }
        sensor.save();
      } else {
        console.log("No sensor data found to delete");
      }

      res.json({success:true});
    }
  });
})

// add sensor data to the database
// note that Content-Type MUST be set to application/json for data to be accepted
.post('/:sensor_id/data',function(req, res, next){
  console.log("value was: "+req.body.value + " from sensor: "+req.params.sensor_id);
  // check that the data point sent is valid
  if (req.params.sensor_id === null || req.body.value === null) {
    console.log("Sensor id or value was empty");
    res.status(404).json({success:false,error:"data value or sensor id empty"});
    return;
  }

  // then check that a sensor with the specified id actually exists
  Sensor.findById(req.params.sensor_id, function(err,sensor){
    if (err || !sensor) {
      console.error("Sensor not registered err: "+err);
      res.status(404).json({success:false,error:"Sensor not registered"});
    } else {
      var point;
      if (req.body.collection_time !== null) {
        point = {sensor_id:sensor._id, value: req.body.value,collection_time:req.body.collection_time};
      } else {
        point = {sensor_id:sensor._id, value: req.body.value};
      }

      Data.create(point, function (err, point) {
        if (err) {
          console.error("Failed to add data point: "+err);
          res.status(404).json({success:false,error:err});
        } else {
          console.log("Success: "+err);
          console.log(" Added: "+point);
          behaviour_helpers.CheckBehaviour(sensor._id, req.body.value);
          res.json({success:true});
        }
      });
    }
  });
})

.delete('/:sensor_id/data',function(req, res, next){
  Sensor.findById(req.params.sensor_id, function(err,sensor){
    if (err) {
      console.error("Sensor not registered err: "+err);
      res.status(404).json({success:false});
    } else {
      // empty the array
      var i = sensor.data.length;
      while (i--) {
        var point = sensor.data[i];
        sensor.data.remove(point);
      }
      sensor.save();
      res.json({success:true});
    }
  });
})

// return all data provided by the sensor with the given id
.get('/:sensor_id/data',function(req, res, next){
  Data.find({sensor_id:req.params.sensor_id},'-_id -sensor_id -__v').lean().exec( function(err,data){
    if (err) {
      console.error("Sensor not registered err: "+err);
      res.status(404).json({success:false});
    } else {
      console.log("ALL data requested for sensor: "+ req.params.sensor_id );
      res.json(data);
    }
  });
})

// return the last point added to db by a sensor
.get('/:sensor_id/data/latest',function(req, res, next){
  console.log("Requested the last point from"+ req.params.sensor_id);
  Sensor.findById(req.params.sensor_id,"data", function(err,sensor){
    if (err) {
      console.error("Sensor not registered err: "+err);
      res.status(404).json({success:false});
    } else {
      Data.findOne({ sensor_id:sensor._id },'-_id -sensor_id -__v',{ sort: { 'collection_time' : -1 } } ,function(err,data){
        if (err) {
          console.error("Failed to get data err: "+err);
          res.status(404).json({success:false});
        } else {
          console.log("Returned data was: ");
          console.log(JSON.stringify(data, null, 4));
          res.json(data);
        }
      }
    );
    }
  });
})

// return all data provided by the sensor with the given id within the the time period selected
.get('/:sensor_id/data/:time_period',function(req, res, next){
  console.log("Getting days sensor data for id:"+req.params.sensor_id);
  console.log("Requested sensor data from the last: "+ req.params.time_period);
  Sensor.findById(req.params.sensor_id, function(err,sensor){
    if (err) {
      console.error("Sensor not registered err: "+err);
      res.status(404).json({success:false});
    } else {
      var from_time = getCompareDateFromString(req.params.time_period);

      Data.find({ sensor_id:sensor._id ,collection_time: { $gt: from_time } },'-_id -sensor_id -__v').lean().exec(function(err,data){
        if (err) {
          console.error("Failed to get data err: "+err);
          res.status(404).json({success:false});
        } else {
          console.log("Returned data was: ");
          console.log(JSON.stringify(data, null, 4));
          res.json(data);
        }
      }
    );
    }
  });
})


// return all data with a collection_time later than that Requested
.get('/:sensor_id/data/after/:time',function(req, res, next){
  console.log("Requested all sensor data from "+ req.params.sensor_id + " collected after "+ req.params.time);
  Sensor.findById(req.params.sensor_id,"data", function(err,sensor){
    if (err) {
      console.error("Sensor not registered err: "+err);
      res.status(404).json({success:false});
    } else {
      Data.find({ sensor_id:sensor._id ,collection_time: { $gt: req.params.time } },'-_id -sensor_id -__v').lean().exec(function(err,data){
        if (err) {
          console.error("Failed to get data err: "+err);
          res.status(404).json({success:false});
        } else {
          console.log("Returned data was: ");
          console.log(JSON.stringify(data, null, 4));
          res.json(data);
        }
      }
    );
    }
  });
})

// if none of these, 404
.get('*', function(req, res){
  res.status(404).send("No endpoint found");
})
;

module.exports = router;
