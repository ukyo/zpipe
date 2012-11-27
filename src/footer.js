  return new Uint8Array(zpipe_output.subarray(0, ++zpipe_j));
};

function deflate(input, level, zlib_header) {
  return run.call({}, input, false, typeof level === 'number' ? level : 6, zlib_header);
}

function inflate(input, zlib_header) {
  return run.call({}, input, true, null, zlib_header);
}

function gc() {
  zpipe_buffer = new Uint8Array(1);
}


// export

var global = (function() {return this})();

global['zpipe'] = global['zpipe'] || {};
global['zpipe']['deflate'] = deflate;
global['zpipe']['inflate'] = inflate;
global['zpipe']['gc'] = gc;

})();