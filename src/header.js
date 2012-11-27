(function() {

var zpipe_buffer = new Uint8Array(1);

function run(zpipe_input, zpipe_isInflate, zpipe_level, zlib_header) {
  var zpipe_i = -1;
  var zpipe_j = -1;
  var zpipe_output = zpipe_buffer;
  var Module = {};
  Module['arguments'] = zpipe_isInflate ? ['-d'] : ['-c', '' + zpipe_level];
  Module['arguments'].push('-header=' + (zlib_header ? 1 : 0));
  Module['stdin'] = function() {
    return ++zpipe_i < zpipe_input.length ? zpipe_input[zpipe_i] : null;
  };
  Module['stdout'] = function(x) {
    if (x !== null) {
      if (++zpipe_j === zpipe_output.length) {
        zpipe_buffer = new Uint8Array(zpipe_output.length * 2);
        zpipe_buffer.set(zpipe_output);
        zpipe_output = zpipe_buffer;
      }
      zpipe_output[zpipe_j] = x;
    }
  };

