var mongoose = require( 'mongoose' );
var Behaviour = mongoose.model('Behaviour');
var Actor = mongoose.model('Actor');

var behaviour_helpers = {};

// this entire module is designed to allow the execution of behaviours by any other part of the hub

behaviour_helpers.condition_list_string = [
  "equal",
  "not equal",
  "greater",
  "less",
  "greater or equal",
  "less or equal",
];

behaviour_helpers.condition_list_functions = [
  // equal
  function (value, state) {
    if (state === value) {
      return true;
    }
    return false;
  },
  // not equal
  function (value, state) {
    if (state !== value) {
      return true;
    }
    return false;
  },
  // greater
  function (value, state) {
    if (state > value) {
      return true;
    }
    return false;
  },
  // less
  function (value, state) {
    if (state < value) {
      return true;
    }
    return false;
  },
  // greater or equal
  function (value, state) {
    if (state >= value) {
      return true;
    }
    return false;
  },
  // less or equal
  function (value, state) {
    if (state <= value) {
      return true;
    }
    return false;
  },
];

// takes in a string in the format above
behaviour_helpers.StringToConditional = function (string) {
  for (i=0; i < behaviour_helpers.condition_list_string.length; i++) {
    if (string === behaviour_helpers.condition_list_string[i]) {
      return i;
    }
  }
};

behaviour_helpers.ConditionalToString = function (condition_num) {
  return behaviour_helpers.condition_list_string[condition_num];
};

behaviour_helpers.EvaluateCondition = function (conditional, value, state) {
  console.log("Conditional was: "+conditional);

  var tmp_function = behaviour_helpers.condition_list_functions[conditional];
  console.log("Typeof was: ");
  console.log(typeof(tmp_function));
  var result = tmp_function(value, state);
  return result;
};

// run an action as found in a behaviour, TODO: Complete
behaviour_helpers.PerformAction = function (action, actor) {
  console.log("Action " + action + " to be performed by "+actor);
};

behaviour_helpers.Validate = function (behaviour){
  // check that number of the conditional type is within available options
  if (behaviour.condition > behaviour_helpers.condition_list_functions.length) {return false;}

  return true;
};

behaviour_helpers.CheckBehaviour = function(sensor_id,last_sensor_state) {
  Behaviour.find({sensor:sensor_id}).lean().populate('actor').exec( function(err,behaviours){
    if (err || behaviours.length === 0) {
      console.log("Unable to find matching behaviour: " + err + "data was: ");
      console.log(behaviours);
      return;
    } else {
      for (behaviour of behaviours) {
        console.log("Behaviour was: ");
        console.log(behaviour);
        console.log("Found a matching behaviour, validating");
        // validate the behaviour first
        if (behaviour_helpers.Validate(behaviour)) {
          console.log("Passed, testing");
          if (behaviour_helpers.EvaluateCondition(behaviour.condition,behaviour.value,last_sensor_state) ) {
            console.log("Passed, running action");
            behaviour_helpers.PerformAction(behaviour.action,behaviour.actor);
          }
        }
      }
    }
  });
};


module.exports = behaviour_helpers;
