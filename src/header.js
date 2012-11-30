(function() {

var zpipeInput;
var zpipeOutput = new Uint8Array(1);
var zpipeTemp;
var zpipeInputIndex;
var zpipeOutputIndex;

var Module = {
  'stdin': function() {
    return ++zpipeInputIndex < zpipeInput.length ?
      zpipeInput[zpipeInputIndex] :
      null;
  },

  'stdout': function(x) {
    if (x !== null) {
      if (++zpipeOutputIndex === zpipeOutput.length) {
        zpipeTemp = new Uint8Array(zpipeOutput.length * 2);
        zpipeTemp.set(zpipeOutput);
        zpipeOutput = zpipeTemp;
      }
      zpipeOutput[zpipeOutputIndex] = x;
    }
  }
};

