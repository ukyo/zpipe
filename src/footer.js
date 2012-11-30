
function zpipeInit(input) {
  zpipeInputIndex = -1;
  zpipeOutputIndex = -1;
  zpipeInput = input;
  FS.streams[1].eof = false;
}

function zpipeGetOutput() {
  return new Uint8Array(zpipeOutput.subarray(0, ++zpipeOutputIndex));
}

function zpipeDeflate(input, level, zlibHeader) {
  zpipeInit(input);

  level = typeof level === 'number' ? level : 6;
  level = Math.min(Math.max(level, 0), 9);
  zlibHeader = zlibHeader ? 1 : -1;

  _def_stdio(level, zlibHeader);
  return zpipeGetOutput();
}

function zpipeInflate(input, zlibHeader) {
  zpipeInit(input);
  zlibHeader = zlibHeader ? 1 : -1;
  _inf_stdio(zlibHeader);
  return zpipeGetOutput();
}

function zpipeGC() {
  zpipeInput = new Uint8Array(1);
}


// export

var global = (function() {return this})();

global['zpipe'] = global['zpipe'] || {};
global['zpipe']['deflate'] = zpipeDeflate;
global['zpipe']['inflate'] = zpipeInflate;
global['zpipe']['gc'] = zpipeGC;

})();