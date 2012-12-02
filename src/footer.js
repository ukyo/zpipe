// export

function exportFunction (s, func) {
  var paths = s.split('.');
  var funcName = paths.pop();
  var object = exports;
  paths.forEach(function(path) {
    object[path] = object[path] || {};
    object = object[path];
  });
  object[funcName] = func;
}

if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  exportFunction('zpipe.deflate', zDeflate);
  exportFunction('zpipe.inflate', zInflate);
  exportFunction('zpipe.gc', zGC);
}

if (ENVIRONMENT_IS_NODE) {
  exportFunction('deflate', zDeflate);
  exportFunction('inflate', zInflate);
  exportFunction('gc', zGC);
}

}).call({}, typeof exports !== 'undefined' ? exports : this);