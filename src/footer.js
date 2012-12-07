// export

function exportFunction(s, func) {
  var paths = s.split('.');
  var funcName = paths.pop();
  var object = exports;
  paths.forEach(function(path) {
    object[path] = object[path] || {};
    object = object[path];
  });
  object[funcName] = func;
}

function deflate(input, level, copy) {
  return zDeflate(input, level, true, copy);
}

function rawDeflate(input, level, copy) {
  return zDeflate(input, level, false, copy);
}

function inflate(input, copy) {
  return zInflate(input, true, copy);
}

function rawInflate(input, copy) {
  return zInflate(input, false, copy);
}

if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  exportFunction('zpipe.deflate', deflate);
  exportFunction('zpipe.inflate', inflate);
  exportFunction('zpipe.rawDeflate', rawDeflate);
  exportFunction('zpipe.rawInflate', rawInflate);
  exportFunction('zpipe.gc', zGC);
}

if (ENVIRONMENT_IS_NODE) {
  exportFunction('deflate', deflate);
  exportFunction('inflate', inflate);
  exportFunction('rawDeflate', rawDeflate);
  exportFunction('rawInflate', rawInflate);
  exportFunction('gc', zGC);
}

}).call({}, typeof exports !== 'undefined' ? exports : this);