var fs = require('fs');
var zpipe = require('../dist/zpipe');

function toUint8Array(buffer) {
  var n = buffer.length;
  var ret = new Uint8Array(n);
  for (var i = 0; i < n; ++i) {
    ret[i] = buffer.readUInt8(i);
  }
  return ret;
}

var original = toUint8Array(fs.readFileSync('./test/Alice\'s_Adventure_in_Wonderland.txt'));
var compressed = toUint8Array(fs.readFileSync('./test/Alice\'s_Adventure_in_Wonderland.txt.zlib'));

function areAllElementsSame(a, b) {
  for (var i = 0, n = a.length; i < n; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

exports.testExported = function(test) {
  test.ok(zpipe.deflate, 'zpipe.deflate should be exported');
  test.ok(zpipe.inflate, 'zpipe.inflate should be exported');
  test.ok(zpipe.gc, 'zpipe.gc should be exported');
  test.done();
}

exports.testInflate = function(test) {
  var bytes = zpipe.inflate(compressed, true);
  test.equal(bytes.length, original.length, 'lengths of both should be same');
  test.ok(areAllElementsSame(bytes, original), 'all elements of both and the original should be same');
  test.done();
}

exports.testDeflate = function(test) {
  var bytes, n = 9;
  for (var level = 0; level <= 9; ++level) {
    bytes = zpipe.inflate(zpipe.deflate(original, level, true, true), true);
    test.equal(bytes.length, original.length, 'lengths of both should be same (compression level is ' + level + ')');
    test.ok(areAllElementsSame(bytes, original), 'all elements of both and the original should be same (compression level is ' + level + ')');
  }
  test.done();
}