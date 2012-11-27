// Note: For maximum-speed code, see "Optimizing Code" on the Emscripten wiki, https://github.com/kripken/emscripten/wiki/Optimizing-Code
// Note: Some Emscripten settings may limit the speed of the generated code.
// TODO: " u s e   s t r i c t ";

try {
  this['Module'] = Module;
} catch(e) {
  this['Module'] = Module = {};
}

// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function';
var ENVIRONMENT_IS_WEB = typeof window === 'object';
var ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  Module['print'] = function(x) {
    process['stdout'].write(x + '\n');
  };
  Module['printErr'] = function(x) {
    process['stderr'].write(x + '\n');
  };

  var nodeFS = require('fs');
  var nodePath = require('path');

  Module['read'] = function(filename) {
    filename = nodePath['normalize'](filename);
    var ret = nodeFS['readFileSync'](filename).toString();
    // The path is absolute if the normalized version is the same as the resolved.
    if (!ret && filename != nodePath['resolve'](filename)) {
      filename = path.join(__dirname, '..', 'src', filename);
      ret = nodeFS['readFileSync'](filename).toString();
    }
    return ret;
  };

  Module['load'] = function(f) {
    globalEval(read(f));
  };

  if (!Module['arguments']) {
    Module['arguments'] = process['argv'].slice(2);
  }
}

if (ENVIRONMENT_IS_SHELL) {
  Module['print'] = print;
  if (typeof printErr != 'undefined') Module['printErr'] = printErr; // not present in v8 or older sm

  // Polyfill over SpiderMonkey/V8 differences
  if (typeof read != 'undefined') {
    Module['read'] = read;
  } else {
    Module['read'] = function(f) { snarf(f) };
  }

  if (!Module['arguments']) {
    if (typeof scriptArgs != 'undefined') {
      Module['arguments'] = scriptArgs;
    } else if (typeof arguments != 'undefined') {
      Module['arguments'] = arguments;
    }
  }
}

if (ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER) {
  if (!Module['print']) {
    Module['print'] = function(x) {
      console.log(x);
    };
  }

  if (!Module['printErr']) {
    Module['printErr'] = function(x) {
      console.log(x);
    };
  }
}

if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    return xhr.responseText;
  };

  if (!Module['arguments']) {
    if (typeof arguments != 'undefined') {
      Module['arguments'] = arguments;
    }
  }
}

if (ENVIRONMENT_IS_WORKER) {
  // We can do very little here...
  var TRY_USE_DUMP = false;
  if (!Module['print']) {
    Module['print'] = (TRY_USE_DUMP && (typeof(dump) !== "undefined") ? (function(x) {
      dump(x);
    }) : (function(x) {
      // self.postMessage(x); // enable this if you want stdout to be sent as messages
    }));
  }

  Module['load'] = importScripts;
}

if (!ENVIRONMENT_IS_WORKER && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_SHELL) {
  // Unreachable because SHELL is dependant on the others
  throw 'Unknown runtime environment. Where are we?';
}

function globalEval(x) {
  eval.call(null, x);
}
if (!Module['load'] == 'undefined' && Module['read']) {
  Module['load'] = function(f) {
    globalEval(Module['read'](f));
  };
}
if (!Module['print']) {
  Module['print'] = function(){};
}
if (!Module['printErr']) {
  Module['printErr'] = Module['print'];
}
if (!Module['arguments']) {
  Module['arguments'] = [];
}
// *** Environment setup code ***

// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];

// Callbacks
if (!Module['preRun']) Module['preRun'] = [];
if (!Module['postRun']) Module['postRun'] = [];

  
// === Auto-generated preamble library stuff ===

//========================================
// Runtime code shared with compiler
//========================================

var Runtime = {
  stackSave: function () {
    return STACKTOP;
  },
  stackRestore: function (stackTop) {
    STACKTOP = stackTop;
  },
  forceAlign: function (target, quantum) {
    quantum = quantum || 4;
    if (quantum == 1) return target;
    if (isNumber(target) && isNumber(quantum)) {
      return Math.ceil(target/quantum)*quantum;
    } else if (isNumber(quantum) && isPowerOfTwo(quantum)) {
      var logg = log2(quantum);
      return '((((' +target + ')+' + (quantum-1) + ')>>' + logg + ')<<' + logg + ')';
    }
    return 'Math.ceil((' + target + ')/' + quantum + ')*' + quantum;
  },
  isNumberType: function (type) {
    return type in Runtime.INT_TYPES || type in Runtime.FLOAT_TYPES;
  },
  isPointerType: function isPointerType(type) {
  return type[type.length-1] == '*';
},
  isStructType: function isStructType(type) {
  if (isPointerType(type)) return false;
  if (/^\[\d+\ x\ (.*)\]/.test(type)) return true; // [15 x ?] blocks. Like structs
  if (/<?{ ?[^}]* ?}>?/.test(type)) return true; // { i32, i8 } etc. - anonymous struct types
  // See comment in isStructPointerType()
  return type[0] == '%';
},
  INT_TYPES: {"i1":0,"i8":0,"i16":0,"i32":0,"i64":0},
  FLOAT_TYPES: {"float":0,"double":0},
  bitshift64: function (low, high, op, bits) {
    var ander = Math.pow(2, bits)-1;
    if (bits < 32) {
      switch (op) {
        case 'shl':
          return [low << bits, (high << bits) | ((low&(ander << (32 - bits))) >>> (32 - bits))];
        case 'ashr':
          return [(((low >>> bits ) | ((high&ander) << (32 - bits))) >> 0) >>> 0, (high >> bits) >>> 0];
        case 'lshr':
          return [((low >>> bits) | ((high&ander) << (32 - bits))) >>> 0, high >>> bits];
      }
    } else if (bits == 32) {
      switch (op) {
        case 'shl':
          return [0, low];
        case 'ashr':
          return [high, (high|0) < 0 ? ander : 0];
        case 'lshr':
          return [high, 0];
      }
    } else { // bits > 32
      switch (op) {
        case 'shl':
          return [0, low << (bits - 32)];
        case 'ashr':
          return [(high >> (bits - 32)) >>> 0, (high|0) < 0 ? ander : 0];
        case 'lshr':
          return [high >>>  (bits - 32) , 0];
      }
    }
    abort('unknown bitshift64 op: ' + [value, op, bits]);
  },
  or64: function (x, y) {
    var l = (x | 0) | (y | 0);
    var h = (Math.round(x / 4294967296) | Math.round(y / 4294967296)) * 4294967296;
    return l + h;
  },
  and64: function (x, y) {
    var l = (x | 0) & (y | 0);
    var h = (Math.round(x / 4294967296) & Math.round(y / 4294967296)) * 4294967296;
    return l + h;
  },
  xor64: function (x, y) {
    var l = (x | 0) ^ (y | 0);
    var h = (Math.round(x / 4294967296) ^ Math.round(y / 4294967296)) * 4294967296;
    return l + h;
  },
  getNativeTypeSize: function (type, quantumSize) {
    if (Runtime.QUANTUM_SIZE == 1) return 1;
    var size = {
      '%i1': 1,
      '%i8': 1,
      '%i16': 2,
      '%i32': 4,
      '%i64': 8,
      "%float": 4,
      "%double": 8
    }['%'+type]; // add '%' since float and double confuse Closure compiler as keys, and also spidermonkey as a compiler will remove 's from '_i8' etc
    if (!size) {
      if (type.charAt(type.length-1) == '*') {
        size = Runtime.QUANTUM_SIZE; // A pointer
      } else if (type[0] == 'i') {
        var bits = parseInt(type.substr(1));
        assert(bits % 8 == 0);
        size = bits/8;
      }
    }
    return size;
  },
  getNativeFieldSize: function (type) {
    return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
  },
  dedup: function dedup(items, ident) {
  var seen = {};
  if (ident) {
    return items.filter(function(item) {
      if (seen[item[ident]]) return false;
      seen[item[ident]] = true;
      return true;
    });
  } else {
    return items.filter(function(item) {
      if (seen[item]) return false;
      seen[item] = true;
      return true;
    });
  }
},
  set: function set() {
  var args = typeof arguments[0] === 'object' ? arguments[0] : arguments;
  var ret = {};
  for (var i = 0; i < args.length; i++) {
    ret[args[i]] = 0;
  }
  return ret;
},
  calculateStructAlignment: function calculateStructAlignment(type) {
    type.flatSize = 0;
    type.alignSize = 0;
    var diffs = [];
    var prev = -1;
    type.flatIndexes = type.fields.map(function(field) {
      var size, alignSize;
      if (Runtime.isNumberType(field) || Runtime.isPointerType(field)) {
        size = Runtime.getNativeTypeSize(field); // pack char; char; in structs, also char[X]s.
        alignSize = size;
      } else if (Runtime.isStructType(field)) {
        size = Types.types[field].flatSize;
        alignSize = Types.types[field].alignSize;
      } else {
        throw 'Unclear type in struct: ' + field + ', in ' + type.name_ + ' :: ' + dump(Types.types[type.name_]);
      }
      alignSize = type.packed ? 1 : Math.min(alignSize, Runtime.QUANTUM_SIZE);
      type.alignSize = Math.max(type.alignSize, alignSize);
      var curr = Runtime.alignMemory(type.flatSize, alignSize); // if necessary, place this on aligned memory
      type.flatSize = curr + size;
      if (prev >= 0) {
        diffs.push(curr-prev);
      }
      prev = curr;
      return curr;
    });
    type.flatSize = Runtime.alignMemory(type.flatSize, type.alignSize);
    if (diffs.length == 0) {
      type.flatFactor = type.flatSize;
    } else if (Runtime.dedup(diffs).length == 1) {
      type.flatFactor = diffs[0];
    }
    type.needsFlattening = (type.flatFactor != 1);
    return type.flatIndexes;
  },
  generateStructInfo: function (struct, typeName, offset) {
    var type, alignment;
    if (typeName) {
      offset = offset || 0;
      type = (typeof Types === 'undefined' ? Runtime.typeInfo : Types.types)[typeName];
      if (!type) return null;
      if (type.fields.length != struct.length) {
        printErr('Number of named fields must match the type for ' + typeName + ': possibly duplicate struct names. Cannot return structInfo');
        return null;
      }
      alignment = type.flatIndexes;
    } else {
      var type = { fields: struct.map(function(item) { return item[0] }) };
      alignment = Runtime.calculateStructAlignment(type);
    }
    var ret = {
      __size__: type.flatSize
    };
    if (typeName) {
      struct.forEach(function(item, i) {
        if (typeof item === 'string') {
          ret[item] = alignment[i] + offset;
        } else {
          // embedded struct
          var key;
          for (var k in item) key = k;
          ret[key] = Runtime.generateStructInfo(item[key], type.fields[i], alignment[i]);
        }
      });
    } else {
      struct.forEach(function(item, i) {
        ret[item[1]] = alignment[i];
      });
    }
    return ret;
  },
  addFunction: function (func) {
    var ret = FUNCTION_TABLE.length;
    FUNCTION_TABLE.push(func);
    FUNCTION_TABLE.push(0);
    return ret;
  },
  warnOnce: function (text) {
    if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
    if (!Runtime.warnOnce.shown[text]) {
      Runtime.warnOnce.shown[text] = 1;
      Module.printErr(text);
    }
  },
  funcWrappers: {},
  getFuncWrapper: function (func) {
    if (!Runtime.funcWrappers[func]) {
      Runtime.funcWrappers[func] = function() {
        FUNCTION_TABLE[func].apply(null, arguments);
      };
    }
    return Runtime.funcWrappers[func];
  },
  UTF8Processor: function () {
    var buffer = [];
    var needed = 0;
    this.processCChar = function (code) {
      code = code & 0xff;
      if (needed) {
        buffer.push(code);
        needed--;
      }
      if (buffer.length == 0) {
        if (code < 128) return String.fromCharCode(code);
        buffer.push(code);
        if (code > 191 && code < 224) {
          needed = 1;
        } else {
          needed = 2;
        }
        return '';
      }
      if (needed > 0) return '';
      var c1 = buffer[0];
      var c2 = buffer[1];
      var c3 = buffer[2];
      var ret;
      if (c1 > 191 && c1 < 224) {
        ret = String.fromCharCode(((c1 & 31) << 6) | (c2 & 63));
      } else {
        ret = String.fromCharCode(((c1 & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
      }
      buffer.length = 0;
      return ret;
    }
    this.processJSString = function(string) {
      string = unescape(encodeURIComponent(string));
      var ret = [];
      for (var i = 0; i < string.length; i++) {
        ret.push(string.charCodeAt(i));
      }
      return ret;
    }
  },
  stackAlloc: function stackAlloc(size) { var ret = STACKTOP;STACKTOP += size;STACKTOP = ((((STACKTOP)+3)>>2)<<2); return ret; },
  staticAlloc: function staticAlloc(size) { var ret = STATICTOP;STATICTOP += size;STATICTOP = ((((STATICTOP)+3)>>2)<<2); if (STATICTOP >= TOTAL_MEMORY) enlargeMemory();; return ret; },
  alignMemory: function alignMemory(size,quantum) { var ret = size = Math.ceil((size)/(quantum ? quantum : 4))*(quantum ? quantum : 4); return ret; },
  makeBigInt: function makeBigInt(low,high,unsigned) { var ret = (unsigned ? (((low)>>>0)+(((high)>>>0)*4294967296)) : (((low)>>>0)+(((high)|0)*4294967296))); return ret; },
  QUANTUM_SIZE: 4,
  __dummy__: 0
}



var CorrectionsMonitor = {
  MAX_ALLOWED: 0, // XXX
  corrections: 0,
  sigs: {},

  note: function(type, succeed, sig) {
    if (!succeed) {
      this.corrections++;
      if (this.corrections >= this.MAX_ALLOWED) abort('\n\nToo many corrections!');
    }
  },

  print: function() {
  }
};





//========================================
// Runtime essentials
//========================================

var __THREW__ = false; // Used in checking for thrown exceptions.

var ABORT = false;

var undef = 0;
// tempInt is used for 32-bit signed values or smaller. tempBigInt is used
// for 32-bit unsigned values or more than 32 bits. TODO: audit all uses of tempInt
var tempValue, tempInt, tempBigInt, tempInt2, tempBigInt2, tempPair, tempBigIntI, tempBigIntR, tempBigIntS, tempBigIntP, tempBigIntD;
var tempI64, tempI64b;

function abort(text) {
  Module.print(text + ':\n' + (new Error).stack);
  ABORT = true;
  throw "Assertion: " + text;
}

function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// C calling interface. A convenient way to call C functions (in C files, or
// defined with extern "C").
//
// Note: LLVM optimizations can inline and remove functions, after which you will not be
//       able to call them. Adding
//
//         __attribute__((used))
//
//       to the function definition will prevent that.
//
// Note: Closure optimizations will minify function names, making
//       functions no longer callable. If you run closure (on by default
//       in -O2 and above), you should export the functions you will call
//       by calling emcc with something like
//
//         -s EXPORTED_FUNCTIONS='["_func1","_func2"]'
//
// @param ident      The name of the C function (note that C++ functions will be name-mangled - use extern "C")
// @param returnType The return type of the function, one of the JS types 'number', 'string' or 'array' (use 'number' for any C pointer, and
//                   'array' for JavaScript arrays and typed arrays).
// @param argTypes   An array of the types of arguments for the function (if there are no arguments, this can be ommitted). Types are as in returnType,
//                   except that 'array' is not possible (there is no way for us to know the length of the array)
// @param args       An array of the arguments to the function, as native JS values (as in returnType)
//                   Note that string arguments will be stored on the stack (the JS string will become a C string on the stack).
// @return           The return value, as a native JS value (as in returnType)
function ccall(ident, returnType, argTypes, args) {
  return ccallFunc(getCFunc(ident), returnType, argTypes, args);
}
Module["ccall"] = ccall;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  try {
    var func = eval('_' + ident);
  } catch(e) {
    try {
      func = globalScope['Module']['_' + ident]; // closure exported function
    } catch(e) {}
  }
  assert(func, 'Cannot call unknown function ' + ident + ' (perhaps LLVM optimizations or closure removed it?)');
  return func;
}

// Internal function that does a C call using a function, not an identifier
function ccallFunc(func, returnType, argTypes, args) {
  var stack = 0;
  function toC(value, type) {
    if (type == 'string') {
      if (value === null || value === undefined || value === 0) return 0; // null string
      if (!stack) stack = Runtime.stackSave();
      var ret = Runtime.stackAlloc(value.length+1);
      writeStringToMemory(value, ret);
      return ret;
    } else if (type == 'array') {
      if (!stack) stack = Runtime.stackSave();
      var ret = Runtime.stackAlloc(value.length);
      writeArrayToMemory(value, ret);
      return ret;
    }
    return value;
  }
  function fromC(value, type) {
    if (type == 'string') {
      return Pointer_stringify(value);
    }
    assert(type != 'array');
    return value;
  }
  var i = 0;
  var cArgs = args ? args.map(function(arg) {
    return toC(arg, argTypes[i++]);
  }) : [];
  var ret = fromC(func.apply(null, cArgs), returnType);
  if (stack) Runtime.stackRestore(stack);
  return ret;
}

// Returns a native JS wrapper for a C function. This is similar to ccall, but
// returns a function you can call repeatedly in a normal way. For example:
//
//   var my_function = cwrap('my_c_function', 'number', ['number', 'number']);
//   alert(my_function(5, 22));
//   alert(my_function(99, 12));
//
function cwrap(ident, returnType, argTypes) {
  var func = getCFunc(ident);
  return function() {
    return ccallFunc(func, returnType, argTypes, Array.prototype.slice.call(arguments));
  }
}
Module["cwrap"] = cwrap;

// Sets a value in memory in a dynamic way at run-time. Uses the
// type data. This is the same as makeSetValue, except that
// makeSetValue is done at compile-time and generates the needed
// code then, whereas this function picks the right code at
// run-time.
// Note that setValue and getValue only do *aligned* writes and reads!
// Note that ccall uses JS types as for defining types, while setValue and
// getValue need LLVM types ('i8', 'i32') - this is a lower-level operation
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[(ptr)]=value; break;
      case 'i8': HEAP8[(ptr)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,Math.min(Math.floor((value)/4294967296), 4294967295)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': (tempDoubleF64[0]=value,HEAP32[((ptr)>>2)]=tempDoubleI32[0],HEAP32[(((ptr)+(4))>>2)]=tempDoubleI32[1]); break;
      default: abort('invalid type for setValue: ' + type);
    }
}
Module['setValue'] = setValue;

// Parallel to setValue.
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[(ptr)];
      case 'i8': return HEAP8[(ptr)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return (tempDoubleI32[0]=HEAP32[((ptr)>>2)],tempDoubleI32[1]=HEAP32[(((ptr)+(4))>>2)],tempDoubleF64[0]);
      default: abort('invalid type for setValue: ' + type);
    }
  return null;
}
Module['getValue'] = getValue;

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
Module['ALLOC_NORMAL'] = ALLOC_NORMAL;
Module['ALLOC_STACK'] = ALLOC_STACK;
Module['ALLOC_STATIC'] = ALLOC_STATIC;

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
function allocate(slab, types, allocator) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret = [_malloc, Runtime.stackAlloc, Runtime.staticAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));

  if (zeroinit) {
      _memset(ret, 0, size);
      return ret;
  }
  
  var i = 0, type;
  while (i < size) {
    var curr = slab[i];

    if (typeof curr === 'function') {
      curr = Runtime.getFunctionIndex(curr);
    }

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);
    i += Runtime.getNativeTypeSize(type);
  }

  return ret;
}
Module['allocate'] = allocate;

function Pointer_stringify(ptr, /* optional */ length) {
  var utf8 = new Runtime.UTF8Processor();
  var nullTerminated = typeof(length) == "undefined";
  var ret = "";
  var i = 0;
  var t;
  while (1) {
    t = HEAPU8[((ptr)+(i))];
    if (nullTerminated && t == 0) break;
    ret += utf8.processCChar(t);
    i += 1;
    if (!nullTerminated && i == length) break;
  }
  return ret;
}
Module['Pointer_stringify'] = Pointer_stringify;

function Array_stringify(array) {
  var ret = "";
  for (var i = 0; i < array.length; i++) {
    ret += String.fromCharCode(array[i]);
  }
  return ret;
}
Module['Array_stringify'] = Array_stringify;

// Memory management

var FUNCTION_TABLE; // XXX: In theory the indexes here can be equal to pointers to stacked or malloced memory. Such comparisons should
                    //      be false, but can turn out true. We should probably set the top bit to prevent such issues.

var PAGE_SIZE = 4096;
function alignMemoryPage(x) {
  return ((x+4095)>>12)<<12;
}

var HEAP;
var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

var STACK_ROOT, STACKTOP, STACK_MAX;
var STATICTOP;
function enlargeMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with -s TOTAL_MEMORY=X with X higher than the current value ( ' + TOTAL_MEMORY + '), (2) compile with ALLOW_MEMORY_GROWTH which adjusts the size at runtime but prevents some optimizations, or (3) set Module.TOTAL_MEMORY before the program runs.');
}

var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 10485760;
var FAST_MEMORY = Module['FAST_MEMORY'] || 2097152;

// Initialize the runtime's memory
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
  assert(!!Int32Array && !!Float64Array && !!(new Int32Array(1)['subarray']) && !!(new Int32Array(1)['set']),
         'Cannot fallback to non-typed array case: Code is too specialized');

  var buffer = new ArrayBuffer(TOTAL_MEMORY);
  HEAP8 = new Int8Array(buffer);
  HEAP16 = new Int16Array(buffer);
  HEAP32 = new Int32Array(buffer);
  HEAPU8 = new Uint8Array(buffer);
  HEAPU16 = new Uint16Array(buffer);
  HEAPU32 = new Uint32Array(buffer);
  HEAPF32 = new Float32Array(buffer);
  HEAPF64 = new Float64Array(buffer);

  // Endianness check (note: assumes compiler arch was little-endian)
  HEAP32[0] = 255;
  assert(HEAPU8[0] === 255 && HEAPU8[3] === 0, 'Typed arrays 2 must be run on a little-endian system');

Module['HEAP'] = HEAP;
Module['HEAP8'] = HEAP8;
Module['HEAP16'] = HEAP16;
Module['HEAP32'] = HEAP32;
Module['HEAPU8'] = HEAPU8;
Module['HEAPU16'] = HEAPU16;
Module['HEAPU32'] = HEAPU32;
Module['HEAPF32'] = HEAPF32;
Module['HEAPF64'] = HEAPF64;

STACK_ROOT = STACKTOP = Runtime.alignMemory(1);
STACK_MAX = STACK_ROOT + TOTAL_STACK;

var tempDoublePtr = Runtime.alignMemory(STACK_MAX, 8);
var tempDoubleI8  = HEAP8.subarray(tempDoublePtr);
var tempDoubleI32 = HEAP32.subarray(tempDoublePtr >> 2);
var tempDoubleF32 = HEAPF32.subarray(tempDoublePtr >> 2);
var tempDoubleF64 = HEAPF64.subarray(tempDoublePtr >> 3);
function copyTempFloat(ptr) { // functions, because inlining this code is increases code size too much
  tempDoubleI8[0] = HEAP8[ptr];
  tempDoubleI8[1] = HEAP8[ptr+1];
  tempDoubleI8[2] = HEAP8[ptr+2];
  tempDoubleI8[3] = HEAP8[ptr+3];
}
function copyTempDouble(ptr) {
  tempDoubleI8[0] = HEAP8[ptr];
  tempDoubleI8[1] = HEAP8[ptr+1];
  tempDoubleI8[2] = HEAP8[ptr+2];
  tempDoubleI8[3] = HEAP8[ptr+3];
  tempDoubleI8[4] = HEAP8[ptr+4];
  tempDoubleI8[5] = HEAP8[ptr+5];
  tempDoubleI8[6] = HEAP8[ptr+6];
  tempDoubleI8[7] = HEAP8[ptr+7];
}
STACK_MAX = tempDoublePtr + 8;

STATICTOP = alignMemoryPage(STACK_MAX);

assert(STATICTOP < TOTAL_MEMORY); // Stack must fit in TOTAL_MEMORY; allocations from here on may enlarge TOTAL_MEMORY

var nullString = allocate(intArrayFromString('(null)'), 'i8', ALLOC_STATIC);

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    var func = callback.func;
    if (typeof func === 'number') {
      func = FUNCTION_TABLE[func];
    }
    func(callback.arg === undefined ? null : callback.arg);
  }
}

var __ATINIT__ = []; // functions called during startup
var __ATMAIN__ = []; // functions called when main() is to be run
var __ATEXIT__ = []; // functions called during shutdown

function initRuntime() {
  callRuntimeCallbacks(__ATINIT__);
}
function preMain() {
  callRuntimeCallbacks(__ATMAIN__);
}
function exitRuntime() {
  callRuntimeCallbacks(__ATEXIT__);

  // Print summary of correction activity
  CorrectionsMonitor.print();
}

function String_len(ptr) {
  var i = ptr;
  while (HEAP8[(i++)]) {}; // Note: should be |!= 0|, technically. But this helps catch bugs with undefineds
  return i - ptr - 1;
}
Module['String_len'] = String_len;

// Tools

// This processes a JS string into a C-line array of numbers, 0-terminated.
// For LLVM-originating strings, see parser.js:parseLLVMString function
function intArrayFromString(stringy, dontAddNull, length /* optional */) {
  var ret = (new Runtime.UTF8Processor()).processJSString(stringy);
  if (length) {
    ret.length = length;
  }
  if (!dontAddNull) {
    ret.push(0);
  }
  return ret;
}
Module['intArrayFromString'] = intArrayFromString;

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}
Module['intArrayToString'] = intArrayToString;

// Write a Javascript array to somewhere in the heap
function writeStringToMemory(string, buffer, dontAddNull) {
  var array = intArrayFromString(string, dontAddNull);
  var i = 0;
  while (i < array.length) {
    var chr = array[i];
    HEAP8[((buffer)+(i))]=chr
    i = i + 1;
  }
}
Module['writeStringToMemory'] = writeStringToMemory;

function writeArrayToMemory(array, buffer) {
  for (var i = 0; i < array.length; i++) {
    HEAP8[((buffer)+(i))]=array[i];
  }
}
Module['writeArrayToMemory'] = writeArrayToMemory;

var STRING_TABLE = [];

function unSign(value, bits, ignore, sig) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
  // TODO: clean up previous line
}
function reSign(value, bits, ignore, sig) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyTracking = {};
var calledRun = false;
var runDependencyWatcher = null;
function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            Module.printErr('still waiting on run dependencies:');
          }
          Module.printErr('dependency: ' + dep);
        }
        if (shown) {
          Module.printErr('(end of list)');
        }
      }, 6000);
    }
  } else {
    Module.printErr('warning: run dependency added without ID');
  }
}
Module['addRunDependency'] = addRunDependency;
function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    Module.printErr('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    } 
    if (!calledRun) run();
  }
}
Module['removeRunDependency'] = removeRunDependency;

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data

// === Body ===










var _stderr;
var _stdin;

var _stdout;









var _crc_table;
var _configuration_table;
var _inflate_order;


















var _fixedtables_lenfix80;
var _fixedtables_distfix81;
var _inflate_table_lbase;
var _inflate_table_lext;
var _inflate_table_dbase;
var _inflate_table_dext;


var _static_l_desc;
var _static_d_desc;
var _static_bl_desc;
var _static_ltree;
var _static_dtree;
var _extra_lbits;
var _base_length;
var _extra_dbits;
var _base_dist;

var _extra_blbits;



var __gm_;
var _mparams;
STRING_TABLE.__str1=allocate([115,114,99,47,122,112,105,112,101,46,99,0] /* src/zpipe.c\00 */, "i8", ALLOC_STATIC);
STRING_TABLE.___func___def=allocate([100,101,102,0] /* def\00 */, "i8", ALLOC_STATIC);
STRING_TABLE.__str2=allocate([114,101,116,32,33,61,32,90,95,83,84,82,69,65,77,95,69,82,82,79,82,0] /* ret != Z_STREAM_ERRO */, "i8", ALLOC_STATIC);
STRING_TABLE.__str3=allocate([115,116,114,109,46,97,118,97,105,108,95,105,110,32,61,61,32,48,0] /* strm.avail_in == 0\0 */, "i8", ALLOC_STATIC);
STRING_TABLE.__str4=allocate([114,101,116,32,61,61,32,90,95,83,84,82,69,65,77,95,69,78,68,0] /* ret == Z_STREAM_END\ */, "i8", ALLOC_STATIC);
STRING_TABLE.___func___inf=allocate([105,110,102,0] /* inf\00 */, "i8", ALLOC_STATIC);
STRING_TABLE.__str5=allocate([122,112,105,112,101,58,32,0] /* zpipe: \00 */, "i8", ALLOC_STATIC);
STRING_TABLE.__str6=allocate([101,114,114,111,114,32,114,101,97,100,105,110,103,32,115,116,100,105,110,10,0] /* error reading stdin\ */, "i8", ALLOC_STATIC);
STRING_TABLE.__str7=allocate([101,114,114,111,114,32,119,114,105,116,105,110,103,32,115,116,100,111,117,116,10,0] /* error writing stdout */, "i8", ALLOC_STATIC);
STRING_TABLE.__str8=allocate([105,110,118,97,108,105,100,32,99,111,109,112,114,101,115,115,105,111,110,32,108,101,118,101,108,10,0] /* invalid compression  */, "i8", ALLOC_STATIC);
STRING_TABLE.__str9=allocate([105,110,118,97,108,105,100,32,111,114,32,105,110,99,111,109,112,108,101,116,101,32,100,101,102,108,97,116,101,32,100,97,116,97,10,0] /* invalid or incomplet */, "i8", ALLOC_STATIC);
STRING_TABLE.__str10=allocate([111,117,116,32,111,102,32,109,101,109,111,114,121,10,0] /* out of memory\0A\00 */, "i8", ALLOC_STATIC);
STRING_TABLE.__str11=allocate([122,108,105,98,32,118,101,114,115,105,111,110,32,109,105,115,109,97,116,99,104,33,10,0] /* zlib version mismatc */, "i8", ALLOC_STATIC);
STRING_TABLE.__str12=allocate([45,99,0] /* -c\00 */, "i8", ALLOC_STATIC);
STRING_TABLE.__str13=allocate([45,104,101,97,100,101,114,61,49,0] /* -header=1\00 */, "i8", ALLOC_STATIC);
STRING_TABLE.__str14=allocate([45,100,0] /* -d\00 */, "i8", ALLOC_STATIC);
STRING_TABLE.__str15=allocate([122,112,105,112,101,32,117,115,97,103,101,58,32,122,112,105,112,101,32,91,45,100,93,32,60,32,115,111,117,114,99,101,32,62,32,100,101,115,116,10,0] /* zpipe usage: zpipe [ */, "i8", ALLOC_STATIC);
_crc_table=allocate([0, 0, 0, 0, 1996959894, 0, 0, 0, -301047508, 0, 0, 0, -1727442502, 0, 0, 0, 124634137, 0, 0, 0, 1886057615, 0, 0, 0, -379345611, 0, 0, 0, -1637575261, 0, 0, 0, 249268274, 0, 0, 0, 2044508324, 0, 0, 0, -522852066, 0, 0, 0, -1747789432, 0, 0, 0, 162941995, 0, 0, 0, 2125561021, 0, 0, 0, -407360249, 0, 0, 0, -1866523247, 0, 0, 0, 498536548, 0, 0, 0, 1789927666, 0, 0, 0, -205950648, 0, 0, 0, -2067906082, 0, 0, 0, 450548861, 0, 0, 0, 1843258603, 0, 0, 0, -187386543, 0, 0, 0, -2083289657, 0, 0, 0, 325883990, 0, 0, 0, 1684777152, 0, 0, 0, -43845254, 0, 0, 0, -1973040660, 0, 0, 0, 335633487, 0, 0, 0, 1661365465, 0, 0, 0, -99664541, 0, 0, 0, -1928851979, 0, 0, 0, 997073096, 0, 0, 0, 1281953886, 0, 0, 0, -715111964, 0, 0, 0, -1570279054, 0, 0, 0, 1006888145, 0, 0, 0, 1258607687, 0, 0, 0, -770865667, 0, 0, 0, -1526024853, 0, 0, 0, 901097722, 0, 0, 0, 1119000684, 0, 0, 0, -608450090, 0, 0, 0, -1396901568, 0, 0, 0, 853044451, 0, 0, 0, 1172266101, 0, 0, 0, -589951537, 0, 0, 0, -1412350631, 0, 0, 0, 651767980, 0, 0, 0, 1373503546, 0, 0, 0, -925412992, 0, 0, 0, -1076862698, 0, 0, 0, 565507253, 0, 0, 0, 1454621731, 0, 0, 0, -809855591, 0, 0, 0, -1195530993, 0, 0, 0, 671266974, 0, 0, 0, 1594198024, 0, 0, 0, -972236366, 0, 0, 0, -1324619484, 0, 0, 0, 795835527, 0, 0, 0, 1483230225, 0, 0, 0, -1050600021, 0, 0, 0, -1234817731, 0, 0, 0, 1994146192, 0, 0, 0, 31158534, 0, 0, 0, -1731059524, 0, 0, 0, -271249366, 0, 0, 0, 1907459465, 0, 0, 0, 112637215, 0, 0, 0, -1614814043, 0, 0, 0, -390540237, 0, 0, 0, 2013776290, 0, 0, 0, 251722036, 0, 0, 0, -1777751922, 0, 0, 0, -519137256, 0, 0, 0, 2137656763, 0, 0, 0, 141376813, 0, 0, 0, -1855689577, 0, 0, 0, -429695999, 0, 0, 0, 1802195444, 0, 0, 0, 476864866, 0, 0, 0, -2056965928, 0, 0, 0, -228458418, 0, 0, 0, 1812370925, 0, 0, 0, 453092731, 0, 0, 0, -2113342271, 0, 0, 0, -183516073, 0, 0, 0, 1706088902, 0, 0, 0, 314042704, 0, 0, 0, -1950435094, 0, 0, 0, -54949764, 0, 0, 0, 1658658271, 0, 0, 0, 366619977, 0, 0, 0, -1932296973, 0, 0, 0, -69972891, 0, 0, 0, 1303535960, 0, 0, 0, 984961486, 0, 0, 0, -1547960204, 0, 0, 0, -725929758, 0, 0, 0, 1256170817, 0, 0, 0, 1037604311, 0, 0, 0, -1529756563, 0, 0, 0, -740887301, 0, 0, 0, 1131014506, 0, 0, 0, 879679996, 0, 0, 0, -1385723834, 0, 0, 0, -631195440, 0, 0, 0, 1141124467, 0, 0, 0, 855842277, 0, 0, 0, -1442165665, 0, 0, 0, -586318647, 0, 0, 0, 1342533948, 0, 0, 0, 654459306, 0, 0, 0, -1106571248, 0, 0, 0, -921952122, 0, 0, 0, 1466479909, 0, 0, 0, 544179635, 0, 0, 0, -1184443383, 0, 0, 0, -832445281, 0, 0, 0, 1591671054, 0, 0, 0, 702138776, 0, 0, 0, -1328506846, 0, 0, 0, -942167884, 0, 0, 0, 1504918807, 0, 0, 0, 783551873, 0, 0, 0, -1212326853, 0, 0, 0, -1061524307, 0, 0, 0, -306674912, 0, 0, 0, -1698712650, 0, 0, 0, 62317068, 0, 0, 0, 1957810842, 0, 0, 0, -355121351, 0, 0, 0, -1647151185, 0, 0, 0, 81470997, 0, 0, 0, 1943803523, 0, 0, 0, -480048366, 0, 0, 0, -1805370492, 0, 0, 0, 225274430, 0, 0, 0, 2053790376, 0, 0, 0, -468791541, 0, 0, 0, -1828061283, 0, 0, 0, 167816743, 0, 0, 0, 2097651377, 0, 0, 0, -267414716, 0, 0, 0, -2029476910, 0, 0, 0, 503444072, 0, 0, 0, 1762050814, 0, 0, 0, -144550051, 0, 0, 0, -2140837941, 0, 0, 0, 426522225, 0, 0, 0, 1852507879, 0, 0, 0, -19653770, 0, 0, 0, -1982649376, 0, 0, 0, 282753626, 0, 0, 0, 1742555852, 0, 0, 0, -105259153, 0, 0, 0, -1900089351, 0, 0, 0, 397917763, 0, 0, 0, 1622183637, 0, 0, 0, -690576408, 0, 0, 0, -1580100738, 0, 0, 0, 953729732, 0, 0, 0, 1340076626, 0, 0, 0, -776247311, 0, 0, 0, -1497606297, 0, 0, 0, 1068828381, 0, 0, 0, 1219638859, 0, 0, 0, -670225446, 0, 0, 0, -1358292148, 0, 0, 0, 906185462, 0, 0, 0, 1090812512, 0, 0, 0, -547295293, 0, 0, 0, -1469587627, 0, 0, 0, 829329135, 0, 0, 0, 1181335161, 0, 0, 0, -882789492, 0, 0, 0, -1134132454, 0, 0, 0, 628085408, 0, 0, 0, 1382605366, 0, 0, 0, -871598187, 0, 0, 0, -1156888829, 0, 0, 0, 570562233, 0, 0, 0, 1426400815, 0, 0, 0, -977650754, 0, 0, 0, -1296233688, 0, 0, 0, 733239954, 0, 0, 0, 1555261956, 0, 0, 0, -1026031705, 0, 0, 0, -1244606671, 0, 0, 0, 752459403, 0, 0, 0, 1541320221, 0, 0, 0, -1687895376, 0, 0, 0, -328994266, 0, 0, 0, 1969922972, 0, 0, 0, 40735498, 0, 0, 0, -1677130071, 0, 0, 0, -351390145, 0, 0, 0, 1913087877, 0, 0, 0, 83908371, 0, 0, 0, -1782625662, 0, 0, 0, -491226604, 0, 0, 0, 2075208622, 0, 0, 0, 213261112, 0, 0, 0, -1831694693, 0, 0, 0, -438977011, 0, 0, 0, 2094854071, 0, 0, 0, 198958881, 0, 0, 0, -2032938284, 0, 0, 0, -237706686, 0, 0, 0, 1759359992, 0, 0, 0, 534414190, 0, 0, 0, -2118248755, 0, 0, 0, -155638181, 0, 0, 0, 1873836001, 0, 0, 0, 414664567, 0, 0, 0, -2012718362, 0, 0, 0, -15766928, 0, 0, 0, 1711684554, 0, 0, 0, 285281116, 0, 0, 0, -1889165569, 0, 0, 0, -127750551, 0, 0, 0, 1634467795, 0, 0, 0, 376229701, 0, 0, 0, -1609899400, 0, 0, 0, -686959890, 0, 0, 0, 1308918612, 0, 0, 0, 956543938, 0, 0, 0, -1486412191, 0, 0, 0, -799009033, 0, 0, 0, 1231636301, 0, 0, 0, 1047427035, 0, 0, 0, -1362007478, 0, 0, 0, -640263460, 0, 0, 0, 1088359270, 0, 0, 0, 936918000, 0, 0, 0, -1447252397, 0, 0, 0, -558129467, 0, 0, 0, 1202900863, 0, 0, 0, 817233897, 0, 0, 0, -1111625188, 0, 0, 0, -893730166, 0, 0, 0, 1404277552, 0, 0, 0, 615818150, 0, 0, 0, -1160759803, 0, 0, 0, -841546093, 0, 0, 0, 1423857449, 0, 0, 0, 601450431, 0, 0, 0, -1285129682, 0, 0, 0, -1000256840, 0, 0, 0, 1567103746, 0, 0, 0, 711928724, 0, 0, 0, -1274298825, 0, 0, 0, -1022587231, 0, 0, 0, 1510334235, 0, 0, 0, 755167117, 0, 0, 0, 0, 0, 0, 0, 421212481, 0, 0, 0, 842424962, 0, 0, 0, 724390851, 0, 0, 0, 1684849924, 0, 0, 0, 2105013317, 0, 0, 0, 1448781702, 0, 0, 0, 1329698503, 0, 0, 0, -925267448, 0, 0, 0, -775767223, 0, 0, 0, -84940662, 0, 0, 0, -470492725, 0, 0, 0, -1397403892, 0, 0, 0, -1246855603, 0, 0, 0, -1635570290, 0, 0, 0, -2020074289, 0, 0, 0, 1254232657, 0, 0, 0, 1406739216, 0, 0, 0, 2029285587, 0, 0, 0, 1643069842, 0, 0, 0, 783210325, 0, 0, 0, 934667796, 0, 0, 0, 479770071, 0, 0, 0, 92505238, 0, 0, 0, -2112120743, 0, 0, 0, -1694455528, 0, 0, 0, -1339163941, 0, 0, 0, -1456026726, 0, 0, 0, -428384931, 0, 0, 0, -9671652, 0, 0, 0, -733921313, 0, 0, 0, -849736034, 0, 0, 0, -1786501982, 0, 0, 0, -1935731229, 0, 0, 0, -1481488864, 0, 0, 0, -1096190111, 0, 0, 0, -236396122, 0, 0, 0, -386674457, 0, 0, 0, -1008827612, 0, 0, 0, -624577947, 0, 0, 0, 1566420650, 0, 0, 0, 1145479147, 0, 0, 0, 1869335592, 0, 0, 0, 1987116393, 0, 0, 0, 959540142, 0, 0, 0, 539646703, 0, 0, 0, 185010476, 0, 0, 0, 303839341, 0, 0, 0, -549046541, 0, 0, 0, -966981710, 0, 0, 0, -311405455, 0, 0, 0, -194288336, 0, 0, 0, -1154812937, 0, 0, 0, -1573797194, 0, 0, 0, -1994616459, 0, 0, 0, -1878548428, 0, 0, 0, 396344571, 0, 0, 0, 243568058, 0, 0, 0, 631889529, 0, 0, 0, 1018359608, 0, 0, 0, 1945336319, 0, 0, 0, 1793607870, 0, 0, 0, 1103436669, 0, 0, 0, 1490954812, 0, 0, 0, -260485371, 0, 0, 0, -379421116, 0, 0, 0, -1034998393, 0, 0, 0, -615244602, 0, 0, 0, -1810527743, 0, 0, 0, -1928414400, 0, 0, 0, -1507596157, 0, 0, 0, -1086793278, 0, 0, 0, 950060301, 0, 0, 0, 565965900, 0, 0, 0, 177645455, 0, 0, 0, 328046286, 0, 0, 0, 1556873225, 0, 0, 0, 1171730760, 0, 0, 0, 1861902987, 0, 0, 0, 2011255754, 0, 0, 0, -1162125996, 0, 0, 0, -1549767659, 0, 0, 0, -2004009002, 0, 0, 0, -1852436841, 0, 0, 0, -556296112, 0, 0, 0, -942888687, 0, 0, 0, -320734510, 0, 0, 0, -168113261, 0, 0, 0, 1919080284, 0, 0, 0, 1803150877, 0, 0, 0, 1079293406, 0, 0, 0, 1498383519, 0, 0, 0, 370020952, 0, 0, 0, 253043481, 0, 0, 0, 607678682, 0, 0, 0, 1025720731, 0, 0, 0, 1711106983, 0, 0, 0, 2095471334, 0, 0, 0, 1472923941, 0, 0, 0, 1322268772, 0, 0, 0, 26324643, 0, 0, 0, 411738082, 0, 0, 0, 866634785, 0, 0, 0, 717028704, 0, 0, 0, -1390091857, 0, 0, 0, -1270886162, 0, 0, 0, -1626176723, 0, 0, 0, -2046184852, 0, 0, 0, -918018901, 0, 0, 0, -799861270, 0, 0, 0, -75610583, 0, 0, 0, -496666776, 0, 0, 0, 792689142, 0, 0, 0, 908347575, 0, 0, 0, 487136116, 0, 0, 0, 68299317, 0, 0, 0, 1263779058, 0, 0, 0, 1380486579, 0, 0, 0, 2036719216, 0, 0, 0, 1618931505, 0, 0, 0, -404294658, 0, 0, 0, -16923969, 0, 0, 0, -707751556, 0, 0, 0, -859070403, 0, 0, 0, -2088093958, 0, 0, 0, -1701771333, 0, 0, 0, -1313057672, 0, 0, 0, -1465424583, 0, 0, 0, 998479947, 0, 0, 0, 580430090, 0, 0, 0, 162921161, 0, 0, 0, 279890824, 0, 0, 0, 1609522511, 0, 0, 0, 1190423566, 0, 0, 0, 1842954189, 0, 0, 0, 1958874764, 0, 0, 0, -212200893, 0, 0, 0, -364829950, 0, 0, 0, -1049857855, 0, 0, 0, -663273088, 0, 0, 0, -1758013625, 0, 0, 0, -1909594618, 0, 0, 0, -1526680123, 0, 0, 0, -1139047292, 0, 0, 0, 1900120602, 0, 0, 0, 1750776667, 0, 0, 0, 1131931800, 0, 0, 0, 1517083097, 0, 0, 0, 355290910, 0, 0, 0, 204897887, 0, 0, 0, 656092572, 0, 0, 0, 1040194781, 0, 0, 0, -1181220846, 0, 0, 0, -1602014893, 0, 0, 0, -1951505776, 0, 0, 0, -1833610287, 0, 0, 0, -571161322, 0, 0, 0, -990907305, 0, 0, 0, -272455788, 0, 0, 0, -153512235, 0, 0, 0, -1375224599, 0, 0, 0, -1222865496, 0, 0, 0, -1674453397, 0, 0, 0, -2060783830, 0, 0, 0, -898926099, 0, 0, 0, -747616084, 0, 0, 0, -128115857, 0, 0, 0, -515495378, 0, 0, 0, 1725839073, 0, 0, 0, 2143618976, 0, 0, 0, 1424512099, 0, 0, 0, 1307796770, 0, 0, 0, 45282277, 0, 0, 0, 464110244, 0, 0, 0, 813994343, 0, 0, 0, 698327078, 0, 0, 0, -456806728, 0, 0, 0, -35741703, 0, 0, 0, -688665542, 0, 0, 0, -806814341, 0, 0, 0, -2136380484, 0, 0, 0, -1716364547, 0, 0, 0, -1298200258, 0, 0, 0, -1417398145, 0, 0, 0, 740041904, 0, 0, 0, 889656817, 0, 0, 0, 506086962, 0, 0, 0, 120682355, 0, 0, 0, 1215357364, 0, 0, 0, 1366020341, 0, 0, 0, 2051441462, 0, 0, 0, 1667084919, 0, 0, 0, -872753330, 0, 0, 0, -756947441, 0, 0, 0, -104024628, 0, 0, 0, -522746739, 0, 0, 0, -1349119414, 0, 0, 0, -1232264437, 0, 0, 0, -1650429752, 0, 0, 0, -2068102775, 0, 0, 0, 52649286, 0, 0, 0, 439905287, 0, 0, 0, 823476164, 0, 0, 0, 672009861, 0, 0, 0, 1733269570, 0, 0, 0, 2119477507, 0, 0, 0, 1434057408, 0, 0, 0, 1281543041, 0, 0, 0, -2126985953, 0, 0, 0, -1742474146, 0, 0, 0, -1290885219, 0, 0, 0, -1441425700, 0, 0, 0, -447479781, 0, 0, 0, -61918886, 0, 0, 0, -681418087, 0, 0, 0, -830909480, 0, 0, 0, 1239502615, 0, 0, 0, 1358593622, 0, 0, 0, 2077699477, 0, 0, 0, 1657543892, 0, 0, 0, 764250643, 0, 0, 0, 882293586, 0, 0, 0, 532408465, 0, 0, 0, 111204816, 0, 0, 0, 1585378284, 0, 0, 0, 1197851309, 0, 0, 0, 1816695150, 0, 0, 0, 1968414767, 0, 0, 0, 974272232, 0, 0, 0, 587794345, 0, 0, 0, 136598634, 0, 0, 0, 289367339, 0, 0, 0, -1767409180, 0, 0, 0, -1883486043, 0, 0, 0, -1533994138, 0, 0, 0, -1115018713, 0, 0, 0, -221528864, 0, 0, 0, -338653791, 0, 0, 0, -1057104286, 0, 0, 0, -639176925, 0, 0, 0, 347922877, 0, 0, 0, 229101820, 0, 0, 0, 646611775, 0, 0, 0, 1066513022, 0, 0, 0, 1892689081, 0, 0, 0, 1774917112, 0, 0, 0, 1122387515, 0, 0, 0, 1543337850, 0, 0, 0, -597333067, 0, 0, 0, -981574924, 0, 0, 0, -296548041, 0, 0, 0, -146261898, 0, 0, 0, -1207325007, 0, 0, 0, -1592614928, 0, 0, 0, -1975530445, 0, 0, 0, -1826292366, 0, 0, 0, 0, 0, 0, 0, 29518391, 0, 0, 0, 59036782, 0, 0, 0, 38190681, 0, 0, 0, 118073564, 0, 0, 0, 114017003, 0, 0, 0, 76381362, 0, 0, 0, 89069189, 0, 0, 0, 236147128, 0, 0, 0, 265370511, 0, 0, 0, 228034006, 0, 0, 0, 206958561, 0, 0, 0, 152762724, 0, 0, 0, 148411219, 0, 0, 0, 178138378, 0, 0, 0, 190596925, 0, 0, 0, 472294256, 0, 0, 0, 501532999, 0, 0, 0, 530741022, 0, 0, 0, 509615401, 0, 0, 0, 456068012, 0, 0, 0, 451764635, 0, 0, 0, 413917122, 0, 0, 0, 426358261, 0, 0, 0, 305525448, 0, 0, 0, 334993663, 0, 0, 0, 296822438, 0, 0, 0, 275991697, 0, 0, 0, 356276756, 0, 0, 0, 352202787, 0, 0, 0, 381193850, 0, 0, 0, 393929805, 0, 0, 0, 944588512, 0, 0, 0, 965684439, 0, 0, 0, 1003065998, 0, 0, 0, 973863097, 0, 0, 0, 1061482044, 0, 0, 0, 1049003019, 0, 0, 0, 1019230802, 0, 0, 0, 1023561829, 0, 0, 0, 912136024, 0, 0, 0, 933002607, 0, 0, 0, 903529270, 0, 0, 0, 874031361, 0, 0, 0, 827834244, 0, 0, 0, 815125939, 0, 0, 0, 852716522, 0, 0, 0, 856752605, 0, 0, 0, 611050896, 0, 0, 0, 631869351, 0, 0, 0, 669987326, 0, 0, 0, 640506825, 0, 0, 0, 593644876, 0, 0, 0, 580921211, 0, 0, 0, 551983394, 0, 0, 0, 556069653, 0, 0, 0, 712553512, 0, 0, 0, 733666847, 0, 0, 0, 704405574, 0, 0, 0, 675154545, 0, 0, 0, 762387700, 0, 0, 0, 749958851, 0, 0, 0, 787859610, 0, 0, 0, 792175277, 0, 0, 0, 1889177024, 0, 0, 0, 1901651959, 0, 0, 0, 1931368878, 0, 0, 0, 1927033753, 0, 0, 0, 2006131996, 0, 0, 0, 1985040171, 0, 0, 0, 1947726194, 0, 0, 0, 1976933189, 0, 0, 0, 2122964088, 0, 0, 0, 2135668303, 0, 0, 0, 2098006038, 0, 0, 0, 2093965857, 0, 0, 0, 2038461604, 0, 0, 0, 2017599123, 0, 0, 0, 2047123658, 0, 0, 0, 2076625661, 0, 0, 0, 1824272048, 0, 0, 0, 1836991623, 0, 0, 0, 1866005214, 0, 0, 0, 1861914857, 0, 0, 0, 1807058540, 0, 0, 0, 1786244187, 0, 0, 0, 1748062722, 0, 0, 0, 1777547317, 0, 0, 0, 1655668488, 0, 0, 0, 1668093247, 0, 0, 0, 1630251878, 0, 0, 0, 1625932113, 0, 0, 0, 1705433044, 0, 0, 0, 1684323811, 0, 0, 0, 1713505210, 0, 0, 0, 1742760333, 0, 0, 0, 1222101792, 0, 0, 0, 1226154263, 0, 0, 0, 1263738702, 0, 0, 0, 1251046777, 0, 0, 0, 1339974652, 0, 0, 0, 1310460363, 0, 0, 0, 1281013650, 0, 0, 0, 1301863845, 0, 0, 0, 1187289752, 0, 0, 0, 1191637167, 0, 0, 0, 1161842422, 0, 0, 0, 1149379777, 0, 0, 0, 1103966788, 0, 0, 0, 1074747507, 0, 0, 0, 1112139306, 0, 0, 0, 1133218845, 0, 0, 0, 1425107024, 0, 0, 0, 1429406311, 0, 0, 0, 1467333694, 0, 0, 0, 1454888457, 0, 0, 0, 1408811148, 0, 0, 0, 1379576507, 0, 0, 0, 1350309090, 0, 0, 0, 1371438805, 0, 0, 0, 1524775400, 0, 0, 0, 1528845279, 0, 0, 0, 1499917702, 0, 0, 0, 1487177649, 0, 0, 0, 1575719220, 0, 0, 0, 1546255107, 0, 0, 0, 1584350554, 0, 0, 0, 1605185389, 0, 0, 0, -516613248, 0, 0, 0, -520654409, 0, 0, 0, -491663378, 0, 0, 0, -478960167, 0, 0, 0, -432229540, 0, 0, 0, -402728597, 0, 0, 0, -440899790, 0, 0, 0, -461763323, 0, 0, 0, -282703304, 0, 0, 0, -287039473, 0, 0, 0, -324886954, 0, 0, 0, -312413087, 0, 0, 0, -399514908, 0, 0, 0, -370308909, 0, 0, 0, -341100918, 0, 0, 0, -362193731, 0, 0, 0, -49039120, 0, 0, 0, -53357881, 0, 0, 0, -23630690, 0, 0, 0, -11204951, 0, 0, 0, -98955220, 0, 0, 0, -69699045, 0, 0, 0, -107035582, 0, 0, 0, -128143755, 0, 0, 0, -218044088, 0, 0, 0, -222133377, 0, 0, 0, -259769050, 0, 0, 0, -247048431, 0, 0, 0, -200719980, 0, 0, 0, -171234397, 0, 0, 0, -141715974, 0, 0, 0, -162529331, 0, 0, 0, -646423200, 0, 0, 0, -658884777, 0, 0, 0, -620984050, 0, 0, 0, -616635591, 0, 0, 0, -562956868, 0, 0, 0, -541876341, 0, 0, 0, -571137582, 0, 0, 0, -600355867, 0, 0, 0, -680850216, 0, 0, 0, -693541137, 0, 0, 0, -722478922, 0, 0, 0, -718425471, 0, 0, 0, -798841852, 0, 0, 0, -777990605, 0, 0, 0, -739872662, 0, 0, 0, -769385891, 0, 0, 0, -983630320, 0, 0, 0, -996371417, 0, 0, 0, -958780802, 0, 0, 0, -954711991, 0, 0, 0, -1034463540, 0, 0, 0, -1013629701, 0, 0, 0, -1043103070, 0, 0, 0, -1072568171, 0, 0, 0, -884101208, 0, 0, 0, -896547425, 0, 0, 0, -926319674, 0, 0, 0, -922021391, 0, 0, 0, -867956876, 0, 0, 0, -846828221, 0, 0, 0, -809446630, 0, 0, 0, -838682323, 0, 0, 0, -1850763712, 0, 0, 0, -1871840137, 0, 0, 0, -1842658770, 0, 0, 0, -1813436391, 0, 0, 0, -1767489892, 0, 0, 0, -1755032405, 0, 0, 0, -1792873742, 0, 0, 0, -1797226299, 0, 0, 0, -1615017992, 0, 0, 0, -1635865137, 0, 0, 0, -1674046570, 0, 0, 0, -1644529247, 0, 0, 0, -1732939996, 0, 0, 0, -1720253165, 0, 0, 0, -1691239606, 0, 0, 0, -1695297155, 0, 0, 0, -1920387792, 0, 0, 0, -1941217529, 0, 0, 0, -1911692962, 0, 0, 0, -1882223767, 0, 0, 0, -1971282452, 0, 0, 0, -1958545445, 0, 0, 0, -1996207742, 0, 0, 0, -2000280651, 0, 0, 0, -2087033720, 0, 0, 0, -2108158273, 0, 0, 0, -2145472282, 0, 0, 0, -2116232495, 0, 0, 0, -2070688684, 0, 0, 0, -2058246557, 0, 0, 0, -2028529606, 0, 0, 0, -2032831987, 0, 0, 0, -1444753248, 0, 0, 0, -1474250089, 0, 0, 0, -1436154674, 0, 0, 0, -1415287047, 0, 0, 0, -1360299908, 0, 0, 0, -1356262837, 0, 0, 0, -1385190382, 0, 0, 0, -1397897691, 0, 0, 0, -1477345000, 0, 0, 0, -1506546897, 0, 0, 0, -1535814282, 0, 0, 0, -1514717375, 0, 0, 0, -1594349116, 0, 0, 0, -1590017037, 0, 0, 0, -1552089686, 0, 0, 0, -1564567651, 0, 0, 0, -1245416496, 0, 0, 0, -1274668569, 0, 0, 0, -1237276738, 0, 0, 0, -1216164471, 0, 0, 0, -1295131892, 0, 0, 0, -1290817221, 0, 0, 0, -1320611998, 0, 0, 0, -1333041835, 0, 0, 0, -1143528856, 0, 0, 0, -1173010337, 0, 0, 0, -1202457082, 0, 0, 0, -1181639631, 0, 0, 0, -1126266188, 0, 0, 0, -1122180989, 0, 0, 0, -1084596518, 0, 0, 0, -1097321235, 0, 0, 0, 0, 0, 0, 0, -1195612315, 0, 0, 0, -1442199413, 0, 0, 0, 313896942, 0, 0, 0, -1889364137, 0, 0, 0, 937357362, 0, 0, 0, 627793884, 0, 0, 0, -1646839623, 0, 0, 0, -978048785, 0, 0, 0, 2097696650, 0, 0, 0, 1874714724, 0, 0, 0, -687765759, 0, 0, 0, 1255587768, 0, 0, 0, -227878691, 0, 0, 0, -522225869, 0, 0, 0, 1482887254, 0, 0, 0, 1343838111, 0, 0, 0, -391827206, 0, 0, 0, -99573996, 0, 0, 0, 1118632049, 0, 0, 0, -545537848, 0, 0, 0, 1741137837, 0, 0, 0, 1970407491, 0, 0, 0, -842109146, 0, 0, 0, -1783791760, 0, 0, 0, 756094997, 0, 0, 0, 1067759611, 0, 0, 0, -2028416866, 0, 0, 0, 449832999, 0, 0, 0, -1569484990, 0, 0, 0, -1329192788, 0, 0, 0, 142231497, 0, 0, 0, -1607291074, 0, 0, 0, 412010587, 0, 0, 0, 171665333, 0, 0, 0, -1299775280, 0, 0, 0, 793786473, 0, 0, 0, -1746116852, 0, 0, 0, -2057703198, 0, 0, 0, 1038456711, 0, 0, 0, 1703315409, 0, 0, 0, -583343948, 0, 0, 0, -812691622, 0, 0, 0, 1999841343, 0, 0, 0, -354152314, 0, 0, 0, 1381529571, 0, 0, 0, 1089329165, 0, 0, 0, -128860312, 0, 0, 0, -265553759, 0, 0, 0, 1217896388, 0, 0, 0, 1512189994, 0, 0, 0, -492939441, 0, 0, 0, 2135519222, 0, 0, 0, -940242797, 0, 0, 0, -717183107, 0, 0, 0, 1845280792, 0, 0, 0, 899665998, 0, 0, 0, -1927039189, 0, 0, 0, -1617553211, 0, 0, 0, 657096608, 0, 0, 0, -1157806311, 0, 0, 0, 37822588, 0, 0, 0, 284462994, 0, 0, 0, -1471616777, 0, 0, 0, -1693165507, 0, 0, 0, 598228824, 0, 0, 0, 824021174, 0, 0, 0, -1985873965, 0, 0, 0, 343330666, 0, 0, 0, -1396004849, 0, 0, 0, -1098971167, 0, 0, 0, 113467524, 0, 0, 0, 1587572946, 0, 0, 0, -434366537, 0, 0, 0, -190203815, 0, 0, 0, 1276501820, 0, 0, 0, -775755899, 0, 0, 0, 1769898208, 0, 0, 0, 2076913422, 0, 0, 0, -1015592853, 0, 0, 0, -888336478, 0, 0, 0, 1941006535, 0, 0, 0, 1627703081, 0, 0, 0, -642211764, 0, 0, 0, 1148164341, 0, 0, 0, -53215344, 0, 0, 0, -295284610, 0, 0, 0, 1457141531, 0, 0, 0, 247015245, 0, 0, 0, -1241169880, 0, 0, 0, -1531908154, 0, 0, 0, 470583459, 0, 0, 0, -2116308966, 0, 0, 0, 963106687, 0, 0, 0, 735213713, 0, 0, 0, -1821499404, 0, 0, 0, 992409347, 0, 0, 0, -2087022490, 0, 0, 0, -1859174520, 0, 0, 0, 697522413, 0, 0, 0, -1270587308, 0, 0, 0, 217581361, 0, 0, 0, 508405983, 0, 0, 0, -1494102086, 0, 0, 0, -23928852, 0, 0, 0, 1177467017, 0, 0, 0, 1419450215, 0, 0, 0, -332959742, 0, 0, 0, 1911572667, 0, 0, 0, -917753890, 0, 0, 0, -604405712, 0, 0, 0, 1665525589, 0, 0, 0, 1799331996, 0, 0, 0, -746338311, 0, 0, 0, -1053399017, 0, 0, 0, 2039091058, 0, 0, 0, -463652917, 0, 0, 0, 1558270126, 0, 0, 0, 1314193216, 0, 0, 0, -152528859, 0, 0, 0, -1366587277, 0, 0, 0, 372764438, 0, 0, 0, 75645176, 0, 0, 0, -1136777315, 0, 0, 0, 568925988, 0, 0, 0, -1722451903, 0, 0, 0, -1948198993, 0, 0, 0, 861712586, 0, 0, 0, -312887749, 0, 0, 0, 1441124702, 0, 0, 0, 1196457648, 0, 0, 0, -1304107, 0, 0, 0, 1648042348, 0, 0, 0, -628668919, 0, 0, 0, -936187417, 0, 0, 0, 1888390786, 0, 0, 0, 686661332, 0, 0, 0, -1873675855, 0, 0, 0, -2098964897, 0, 0, 0, 978858298, 0, 0, 0, -1483798141, 0, 0, 0, 523464422, 0, 0, 0, 226935048, 0, 0, 0, -1254447507, 0, 0, 0, -1119821404, 0, 0, 0, 100435649, 0, 0, 0, 390670639, 0, 0, 0, -1342878134, 0, 0, 0, 841119475, 0, 0, 0, -1969352298, 0, 0, 0, -1741963656, 0, 0, 0, 546822429, 0, 0, 0, 2029308235, 0, 0, 0, -1068978642, 0, 0, 0, -755170880, 0, 0, 0, 1782671013, 0, 0, 0, -141140452, 0, 0, 0, 1328167289, 0, 0, 0, 1570739863, 0, 0, 0, -450629134, 0, 0, 0, 1298864389, 0, 0, 0, -170426784, 0, 0, 0, -412954226, 0, 0, 0, 1608431339, 0, 0, 0, -1039561134, 0, 0, 0, 2058742071, 0, 0, 0, 1744848601, 0, 0, 0, -792976964, 0, 0, 0, -1998638614, 0, 0, 0, 811816591, 0, 0, 0, 584513889, 0, 0, 0, -1704288764, 0, 0, 0, 129869501, 0, 0, 0, -1090403880, 0, 0, 0, -1380684234, 0, 0, 0, 352848211, 0, 0, 0, 494030490, 0, 0, 0, -1513215489, 0, 0, 0, -1216641519, 0, 0, 0, 264757620, 0, 0, 0, -1844389427, 0, 0, 0, 715964072, 0, 0, 0, 941166918, 0, 0, 0, -2136639965, 0, 0, 0, -658086283, 0, 0, 0, 1618608400, 0, 0, 0, 1926213374, 0, 0, 0, -898381413, 0, 0, 0, 1470427426, 0, 0, 0, -283601337, 0, 0, 0, -38979159, 0, 0, 0, 1158766284, 0, 0, 0, 1984818694, 0, 0, 0, -823031453, 0, 0, 0, -599513459, 0, 0, 0, 1693991400, 0, 0, 0, -114329263, 0, 0, 0, 1100160564, 0, 0, 0, 1395044826, 0, 0, 0, -342174017, 0, 0, 0, -1275476247, 0, 0, 0, 189112716, 0, 0, 0, 435162722, 0, 0, 0, -1588827897, 0, 0, 0, 1016811966, 0, 0, 0, -2077804837, 0, 0, 0, -1768777419, 0, 0, 0, 774831696, 0, 0, 0, 643086745, 0, 0, 0, -1628905732, 0, 0, 0, -1940033262, 0, 0, 0, 887166583, 0, 0, 0, -1456066866, 0, 0, 0, 294275499, 0, 0, 0, 54519365, 0, 0, 0, -1149009632, 0, 0, 0, -471821962, 0, 0, 0, 1532818963, 0, 0, 0, 1240029693, 0, 0, 0, -246071656, 0, 0, 0, 1820460577, 0, 0, 0, -734109372, 0, 0, 0, -963916118, 0, 0, 0, 2117577167, 0, 0, 0, -696303304, 0, 0, 0, 1858283101, 0, 0, 0, 2088143283, 0, 0, 0, -993333546, 0, 0, 0, 1495127663, 0, 0, 0, -509497078, 0, 0, 0, -216785180, 0, 0, 0, 1269332353, 0, 0, 0, 332098007, 0, 0, 0, -1418260814, 0, 0, 0, -1178427044, 0, 0, 0, 25085497, 0, 0, 0, -1666580864, 0, 0, 0, 605395429, 0, 0, 0, 916469259, 0, 0, 0, -1910746770, 0, 0, 0, -2040129881, 0, 0, 0, 1054503362, 0, 0, 0, 745528876, 0, 0, 0, -1798063799, 0, 0, 0, 151290352, 0, 0, 0, -1313282411, 0, 0, 0, -1559410309, 0, 0, 0, 464596510, 0, 0, 0, 1137851976, 0, 0, 0, -76654291, 0, 0, 0, -371460413, 0, 0, 0, 1365741990, 0, 0, 0, -860837601, 0, 0, 0, 1946996346, 0, 0, 0, 1723425172, 0, 0, 0, -570095887, 0, 0, 0, 0, 0, 0, 0, -1775237257, 0, 0, 0, 744558318, 0, 0, 0, -1169094247, 0, 0, 0, 432303367, 0, 0, 0, -1879807376, 0, 0, 0, 900031465, 0, 0, 0, -1550490466, 0, 0, 0, 847829774, 0, 0, 0, -1531388807, 0, 0, 0, 518641120, 0, 0, 0, -1998990697, 0, 0, 0, 726447625, 0, 0, 0, -1115901570, 0, 0, 0, 120436967, 0, 0, 0, -1860321392, 0, 0, 0, 1678817053, 0, 0, 0, -232738710, 0, 0, 0, 1215412723, 0, 0, 0, -566116732, 0, 0, 0, 2111101466, 0, 0, 0, -337322643, 0, 0, 0, 1370871028, 0, 0, 0, -947530877, 0, 0, 0, 1452829715, 0, 0, 0, -1062704284, 0, 0, 0, 2063164157, 0, 0, 0, -322345590, 0, 0, 0, 1331429652, 0, 0, 0, -647231901, 0, 0, 0, 1664946170, 0, 0, 0, -183695219, 0, 0, 0, -937398725, 0, 0, 0, 1578133836, 0, 0, 0, -465477419, 0, 0, 0, 1920034722, 0, 0, 0, -773586116, 0, 0, 0, 1205077067, 0, 0, 0, -41611822, 0, 0, 0, 1807026853, 0, 0, 0, -89606859, 0, 0, 0, 1821946434, 0, 0, 0, -691422245, 0, 0, 0, 1090108588, 0, 0, 0, -479406030, 0, 0, 0, 1969020741, 0, 0, 0, -821176612, 0, 0, 0, 1497223595, 0, 0, 0, -1406084826, 0, 0, 0, 973135441, 0, 0, 0, -2142119992, 0, 0, 0, 375509183, 0, 0, 0, -1242254303, 0, 0, 0, 600093526, 0, 0, 0, -1718240561, 0, 0, 0, 262520248, 0, 0, 0, -1632107992, 0, 0, 0, 143131999, 0, 0, 0, -1294398266, 0, 0, 0, 619252657, 0, 0, 0, -2021888209, 0, 0, 0, 290220120, 0, 0, 0, -1424137791, 0, 0, 0, 1026385590, 0, 0, 0, -1874731914, 0, 0, 0, 108124929, 0, 0, 0, -1138699624, 0, 0, 0, 705746415, 0, 0, 0, -1987726991, 0, 0, 0, 532002310, 0, 0, 0, -1511735393, 0, 0, 0, 869578984, 0, 0, 0, -1563883656, 0, 0, 0, 888733711, 0, 0, 0, -1901590122, 0, 0, 0, 412618465, 0, 0, 0, -1156748673, 0, 0, 0, 759000328, 0, 0, 0, -1754504047, 0, 0, 0, 22832102, 0, 0, 0, -195990677, 0, 0, 0, 1650551836, 0, 0, 0, -667916923, 0, 0, 0, 1308648178, 0, 0, 0, -309000596, 0, 0, 0, 2074411291, 0, 0, 0, -1040971646, 0, 0, 0, 1472466933, 0, 0, 0, -958812059, 0, 0, 0, 1357494034, 0, 0, 0, -356991349, 0, 0, 0, 2089335292, 0, 0, 0, -551690910, 0, 0, 0, 1227741717, 0, 0, 0, -209923188, 0, 0, 0, 1699534075, 0, 0, 0, 1482797645, 0, 0, 0, -833505990, 0, 0, 0, 1946205347, 0, 0, 0, -500122668, 0, 0, 0, 1101389642, 0, 0, 0, -678045635, 0, 0, 0, 1841615268, 0, 0, 0, -67840301, 0, 0, 0, 1793681731, 0, 0, 0, -52859340, 0, 0, 0, 1183344557, 0, 0, 0, -793222950, 0, 0, 0, 1932330052, 0, 0, 0, -451083469, 0, 0, 0, 1598818986, 0, 0, 0, -914616867, 0, 0, 0, 1014039888, 0, 0, 0, -1438580185, 0, 0, 0, 269487038, 0, 0, 0, -2044719927, 0, 0, 0, 632645719, 0, 0, 0, -1283100896, 0, 0, 0, 164914873, 0, 0, 0, -1612422706, 0, 0, 0, 251256414, 0, 0, 0, -1731602135, 0, 0, 0, 580440240, 0, 0, 0, -1264003129, 0, 0, 0, 389919577, 0, 0, 0, -2129808338, 0, 0, 0, 995933623, 0, 0, 0, -1385383232, 0, 0, 0, 545503469, 0, 0, 0, -1229733990, 0, 0, 0, 216184323, 0, 0, 0, -1697468044, 0, 0, 0, 961009130, 0, 0, 0, -1351101795, 0, 0, 0, 354867972, 0, 0, 0, -2095653773, 0, 0, 0, 302736355, 0, 0, 0, -2076482412, 0, 0, 0, 1047162125, 0, 0, 0, -1470469510, 0, 0, 0, 198119140, 0, 0, 0, -1644230253, 0, 0, 0, 665714698, 0, 0, 0, -1315043459, 0, 0, 0, 1150488560, 0, 0, 0, -761067385, 0, 0, 0, 1760690462, 0, 0, 0, -20838807, 0, 0, 0, 1566008055, 0, 0, 0, -882416256, 0, 0, 0, 1899392025, 0, 0, 0, -419009682, 0, 0, 0, 1981535486, 0, 0, 0, -533998711, 0, 0, 0, 1518000656, 0, 0, 0, -867508889, 0, 0, 0, 1876933113, 0, 0, 0, -101728626, 0, 0, 0, 1136572183, 0, 0, 0, -712069024, 0, 0, 0, -391915818, 0, 0, 0, 2123616673, 0, 0, 0, -993863624, 0, 0, 0, 1391648591, 0, 0, 0, -244859951, 0, 0, 0, 1733803174, 0, 0, 0, -586762945, 0, 0, 0, 1261875784, 0, 0, 0, -634712616, 0, 0, 0, 1276840623, 0, 0, 0, -162921674, 0, 0, 0, 1618609217, 0, 0, 0, -1007722273, 0, 0, 0, 1440704424, 0, 0, 0, -275878351, 0, 0, 0, 2042521926, 0, 0, 0, -1934401077, 0, 0, 0, 444819132, 0, 0, 0, -1596821723, 0, 0, 0, 920807506, 0, 0, 0, -1787360052, 0, 0, 0, 54987707, 0, 0, 0, -1189739998, 0, 0, 0, 791020885, 0, 0, 0, -1103381819, 0, 0, 0, 671858098, 0, 0, 0, -1839549397, 0, 0, 0, 74101596, 0, 0, 0, -1476405310, 0, 0, 0, 835702965, 0, 0, 0, -1952523988, 0, 0, 0, 497999451, 0, 0, 0, -1329437541, 0, 0, 0, 653419500, 0, 0, 0, -1667011979, 0, 0, 0, 177433858, 0, 0, 0, -1459222116, 0, 0, 0, 1060507371, 0, 0, 0, -2056845454, 0, 0, 0, 324468741, 0, 0, 0, -2109030507, 0, 0, 0, 343587042, 0, 0, 0, -1372868229, 0, 0, 0, 941340172, 0, 0, 0, -1685138798, 0, 0, 0, 230610405, 0, 0, 0, -1209017220, 0, 0, 0, 568318731, 0, 0, 0, -724380794, 0, 0, 0, 1122161905, 0, 0, 0, -122430104, 0, 0, 0, 1854134815, 0, 0, 0, -854147455, 0, 0, 0, 1529264630, 0, 0, 0, -512249745, 0, 0, 0, 2001188632, 0, 0, 0, -430307192, 0, 0, 0, 1885999103, 0, 0, 0, -902101402, 0, 0, 0, 1544225041, 0, 0, 0, -6396529, 0, 0, 0, 1773036280, 0, 0, 0, -738235551, 0, 0, 0, 1171221526, 0, 0, 0, 2028079776, 0, 0, 0, -288223785, 0, 0, 0, 1417872462, 0, 0, 0, -1028455623, 0, 0, 0, 1629906855, 0, 0, 0, -149528368, 0, 0, 0, 1296525641, 0, 0, 0, -612929986, 0, 0, 0, 1248514478, 0, 0, 0, -598026535, 0, 0, 0, 1712054080, 0, 0, 0, -264513481, 0, 0, 0, 1403960489, 0, 0, 0, -979452962, 0, 0, 0, 2144318023, 0, 0, 0, -369117904, 0, 0, 0, 485670333, 0, 0, 0, -1966949686, 0, 0, 0, 814986067, 0, 0, 0, -1499220956, 0, 0, 0, 87478458, 0, 0, 0, -1828268083, 0, 0, 0, 693624404, 0, 0, 0, -1083713245, 0, 0, 0, 779773619, 0, 0, 0, -1203084860, 0, 0, 0, 35350621, 0, 0, 0, -1809092822, 0, 0, 0, 935201716, 0, 0, 0, -1584526141, 0, 0, 0, 467600730, 0, 0, 0, -1913716179, 0, 0, 0, 0, 0, 0, 0, 1093737241, 0, 0, 0, -2107492814, 0, 0, 0, -1017959125, 0, 0, 0, 80047204, 0, 0, 0, 1173649277, 0, 0, 0, -2035852714, 0, 0, 0, -946454193, 0, 0, 0, 143317448, 0, 0, 0, 1237041873, 0, 0, 0, -1964445702, 0, 0, 0, -874908445, 0, 0, 0, 206550444, 0, 0, 0, 1300147893, 0, 0, 0, -1909619810, 0, 0, 0, -820209529, 0, 0, 0, 1360183882, 0, 0, 0, 270784851, 0, 0, 0, -747572104, 0, 0, 0, -1841172639, 0, 0, 0, 1440198190, 0, 0, 0, 350663991, 0, 0, 0, -675964900, 0, 0, 0, -1769700603, 0, 0, 0, 1503140738, 0, 0, 0, 413728923, 0, 0, 0, -604361296, 0, 0, 0, -1697958231, 0, 0, 0, 1566406630, 0, 0, 0, 476867839, 0, 0, 0, -549502508, 0, 0, 0, -1643226419, 0, 0, 0, -1574665067, 0, 0, 0, -485122164, 0, 0, 0, 541504167, 0, 0, 0, 1635232190, 0, 0, 0, -1495144207, 0, 0, 0, -405736472, 0, 0, 0, 612622019, 0, 0, 0, 1706214874, 0, 0, 0, -1431413411, 0, 0, 0, -341883324, 0, 0, 0, 684485487, 0, 0, 0, 1778217078, 0, 0, 0, -1368706759, 0, 0, 0, -279303648, 0, 0, 0, 738789131, 0, 0, 0, 1832393746, 0, 0, 0, -214546721, 0, 0, 0, -1308140090, 0, 0, 0, 1901359341, 0, 0, 0, 811953140, 0, 0, 0, -135058757, 0, 0, 0, -1228787294, 0, 0, 0, 1972444297, 0, 0, 0, 882902928, 0, 0, 0, -71524585, 0, 0, 0, -1165130738, 0, 0, 0, 2044635429, 0, 0, 0, 955232828, 0, 0, 0, -8785037, 0, 0, 0, -1102518166, 0, 0, 0, 2098971969, 0, 0, 0, 1009442392, 0, 0, 0, 89094640, 0, 0, 0, 1149133545, 0, 0, 0, -2027073598, 0, 0, 0, -971221797, 0, 0, 0, 25826708, 0, 0, 0, 1086000781, 0, 0, 0, -2081938522, 0, 0, 0, -1025951553, 0, 0, 0, 231055416, 0, 0, 0, 1291107105, 0, 0, 0, -1884842486, 0, 0, 0, -828994285, 0, 0, 0, 151047260, 0, 0, 0, 1211225925, 0, 0, 0, -1956447634, 0, 0, 0, -900472457, 0, 0, 0, 1415429050, 0, 0, 0, 359440547, 0, 0, 0, -700478072, 0, 0, 0, -1760651631, 0, 0, 0, 1352194014, 0, 0, 0, 296340679, 0, 0, 0, -755310100, 0, 0, 0, -1815348491, 0, 0, 0, 1557619314, 0, 0, 0, 501643627, 0, 0, 0, -558541760, 0, 0, 0, -1618718887, 0, 0, 0, 1477578262, 0, 0, 0, 421729551, 0, 0, 0, -630179804, 0, 0, 0, -1690229955, 0, 0, 0, -1486095003, 0, 0, 0, -430250372, 0, 0, 0, 621398871, 0, 0, 0, 1681444942, 0, 0, 0, -1548840703, 0, 0, 0, -492860904, 0, 0, 0, 567060275, 0, 0, 0, 1627241514, 0, 0, 0, -1344199507, 0, 0, 0, -288342092, 0, 0, 0, 763564703, 0, 0, 0, 1823607174, 0, 0, 0, -1423685431, 0, 0, 0, -367701040, 0, 0, 0, 692485883, 0, 0, 0, 1752655330, 0, 0, 0, -159826129, 0, 0, 0, -1220008906, 0, 0, 0, 1947928861, 0, 0, 0, 891949572, 0, 0, 0, -222538933, 0, 0, 0, -1282586542, 0, 0, 0, 1893623161, 0, 0, 0, 837779040, 0, 0, 0, -17570073, 0, 0, 0, -1077740034, 0, 0, 0, 2089930965, 0, 0, 0, 1033948108, 0, 0, 0, -97088893, 0, 0, 0, -1157131878, 0, 0, 0, 2018819249, 0, 0, 0, 962963368, 0, 0, 0, 1268286267, 0, 0, 0, 178886690, 0, 0, 0, -906316535, 0, 0, 0, -1999917552, 0, 0, 0, 1331556191, 0, 0, 0, 242021446, 0, 0, 0, -851453587, 0, 0, 0, -1945189772, 0, 0, 0, 1125276403, 0, 0, 0, 35865066, 0, 0, 0, -1049596735, 0, 0, 0, -2143193128, 0, 0, 0, 1205286551, 0, 0, 0, 115748238, 0, 0, 0, -977993563, 0, 0, 0, -2071716932, 0, 0, 0, 445268337, 0, 0, 0, 1539005032, 0, 0, 0, -1729595581, 0, 0, 0, -640062374, 0, 0, 0, 508505365, 0, 0, 0, 1602106892, 0, 0, 0, -1674765529, 0, 0, 0, -585367490, 0, 0, 0, 302028985, 0, 0, 0, 1395753888, 0, 0, 0, -1872580981, 0, 0, 0, -783043182, 0, 0, 0, 382072029, 0, 0, 0, 1475669956, 0, 0, 0, -1800944913, 0, 0, 0, -711534090, 0, 0, 0, -373553234, 0, 0, 0, -1467147081, 0, 0, 0, 1809723804, 0, 0, 0, 720317061, 0, 0, 0, -310809654, 0, 0, 0, -1404538669, 0, 0, 0, 1864064504, 0, 0, 0, 774522593, 0, 0, 0, -516497818, 0, 0, 0, -1610103425, 0, 0, 0, 1666508884, 0, 0, 0, 577106765, 0, 0, 0, -437014014, 0, 0, 0, -1530746597, 0, 0, 0, 1737589808, 0, 0, 0, 648060713, 0, 0, 0, -1196505628, 0, 0, 0, -106963203, 0, 0, 0, 986510294, 0, 0, 0, 2080237775, 0, 0, 0, -1133794944, 0, 0, 0, -44387687, 0, 0, 0, 1040818098, 0, 0, 0, 2134410411, 0, 0, 0, -1339810772, 0, 0, 0, -250280139, 0, 0, 0, 843459102, 0, 0, 0, 1937191175, 0, 0, 0, -1260294072, 0, 0, 0, -170890415, 0, 0, 0, 914572922, 0, 0, 0, 2008178019, 0, 0, 0, 1322777291, 0, 0, 0, 266789330, 0, 0, 0, -860500743, 0, 0, 0, -1920673824, 0, 0, 0, 1242732207, 0, 0, 0, 186879414, 0, 0, 0, -932142947, 0, 0, 0, -1992180860, 0, 0, 0, 1180508931, 0, 0, 0, 124532762, 0, 0, 0, -1002498767, 0, 0, 0, -2062676440, 0, 0, 0, 1117278055, 0, 0, 0, 61428862, 0, 0, 0, -1057326763, 0, 0, 0, -2117377460, 0, 0, 0, 533018753, 0, 0, 0, 1593058200, 0, 0, 0, -1649996109, 0, 0, 0, -594143830, 0, 0, 0, 453006565, 0, 0, 0, 1513181180, 0, 0, 0, -1721605417, 0, 0, 0, -665617970, 0, 0, 0, 391110985, 0, 0, 0, 1451162192, 0, 0, 0, -1792157829, 0, 0, 0, -736310174, 0, 0, 0, 327847213, 0, 0, 0, 1388025396, 0, 0, 0, -1847018721, 0, 0, 0, -791044090, 0, 0, 0, -319586722, 0, 0, 0, -1379769017, 0, 0, 0, 1855015020, 0, 0, 0, 799036277, 0, 0, 0, -399109574, 0, 0, 0, -1459156701, 0, 0, 0, 1783899144, 0, 0, 0, 728055569, 0, 0, 0, -461789290, 0, 0, 0, -1521959793, 0, 0, 0, 1713082788, 0, 0, 0, 657099453, 0, 0, 0, -524497934, 0, 0, 0, -1584541461, 0, 0, 0, 1658781120, 0, 0, 0, 602924761, 0, 0, 0, -1109279724, 0, 0, 0, -53434611, 0, 0, 0, 1065585190, 0, 0, 0, 2125631807, 0, 0, 0, -1188769680, 0, 0, 0, -132789399, 0, 0, 0, 994502210, 0, 0, 0, 2054683995, 0, 0, 0, -1251252772, 0, 0, 0, -195395899, 0, 0, 0, 923358190, 0, 0, 0, 1983400183, 0, 0, 0, -1313994312, 0, 0, 0, -258010463, 0, 0, 0, 869023626, 0, 0, 0, 1929192595, 0, 0, 0, 0, 0, 0, 0, 929743361, 0, 0, 0, 1859421187, 0, 0, 0, 1505641986, 0, 0, 0, -592967417, 0, 0, 0, -339555578, 0, 0, 0, -1300460284, 0, 0, 0, -2062135547, 0, 0, 0, -1202646258, 0, 0, 0, -1891905265, 0, 0, 0, -695888115, 0, 0, 0, -504408820, 0, 0, 0, 1694046729, 0, 0, 0, 1402198024, 0, 0, 0, 170761738, 0, 0, 0, 1028086795, 0, 0, 0, 1889740316, 0, 0, 0, 1204413469, 0, 0, 0, 511156767, 0, 0, 0, 689791006, 0, 0, 0, -1408553189, 0, 0, 0, -1688081126, 0, 0, 0, -1025529064, 0, 0, 0, -172660455, 0, 0, 0, -923650798, 0, 0, 0, -6752493, 0, 0, 0, -1507413743, 0, 0, 0, -1857260784, 0, 0, 0, 341457941, 0, 0, 0, 590413332, 0, 0, 0, 2056173590, 0, 0, 0, 1306819095, 0, 0, 0, -532263624, 0, 0, 0, -684945607, 0, 0, 0, -1902982853, 0, 0, 0, -1174926534, 0, 0, 0, 1022247999, 0, 0, 0, 193234494, 0, 0, 0, 1379582012, 0, 0, 0, 1699742269, 0, 0, 0, 1477926454, 0, 0, 0, 1870502967, 0, 0, 0, 918805045, 0, 0, 0, 27858996, 0, 0, 0, -2067835087, 0, 0, 0, -1277848272, 0, 0, 0, -362032334, 0, 0, 0, -587132621, 0, 0, 0, -1864013020, 0, 0, 0, -1483757275, 0, 0, 0, -30281945, 0, 0, 0, -916771546, 0, 0, 0, 1280139811, 0, 0, 0, 2066194466, 0, 0, 0, 580511264, 0, 0, 0, 368256033, 0, 0, 0, 682915882, 0, 0, 0, 534690347, 0, 0, 0, 1180761129, 0, 0, 0, 1896496680, 0, 0, 0, -199462611, 0, 0, 0, -1015631060, 0, 0, 0, -1698106066, 0, 0, 0, -1381877969, 0, 0, 0, -1064461712, 0, 0, 0, -135833487, 0, 0, 0, -1369891213, 0, 0, 0, -1724654478, 0, 0, 0, 472224631, 0, 0, 0, 726618486, 0, 0, 0, 1928402804, 0, 0, 0, 1167840629, 0, 0, 0, 2027719038, 0, 0, 0, 1337346943, 0, 0, 0, 369626493, 0, 0, 0, 560123772, 0, 0, 0, -1535868807, 0, 0, 0, -1826733448, 0, 0, 0, -895482758, 0, 0, 0, -37042565, 0, 0, 0, -1339114388, 0, 0, 0, -2025554323, 0, 0, 0, -554026897, 0, 0, 0, -376374674, 0, 0, 0, 1820767595, 0, 0, 0, 1542223722, 0, 0, 0, 38941032, 0, 0, 0, 892924777, 0, 0, 0, 142585698, 0, 0, 0, 1058368867, 0, 0, 0, 1722493793, 0, 0, 0, 1371662688, 0, 0, 0, -724064667, 0, 0, 0, -474127260, 0, 0, 0, -1174199706, 0, 0, 0, -1922441113, 0, 0, 0, 550229832, 0, 0, 0, 396432713, 0, 0, 0, 1310675787, 0, 0, 0, 2037748042, 0, 0, 0, -60563889, 0, 0, 0, -888595378, 0, 0, 0, -1833477556, 0, 0, 0, -1512204211, 0, 0, 0, -1734687674, 0, 0, 0, -1343224249, 0, 0, 0, -162643899, 0, 0, 0, -1054571964, 0, 0, 0, 1144180033, 0, 0, 0, 1935150912, 0, 0, 0, 719735106, 0, 0, 0, 495749955, 0, 0, 0, 1349054804, 0, 0, 0, 1728197461, 0, 0, 0, 1052538199, 0, 0, 0, 165066582, 0, 0, 0, -1933510573, 0, 0, 0, -1146471854, 0, 0, 0, -501973936, 0, 0, 0, -713114031, 0, 0, 0, -398859686, 0, 0, 0, -548200357, 0, 0, 0, -2031262119, 0, 0, 0, -1316510632, 0, 0, 0, 881978205, 0, 0, 0, 66791772, 0, 0, 0, 1514499934, 0, 0, 0, 1831841119, 0, 0, 0, -2145700383, 0, 0, 0, -1217267744, 0, 0, 0, -288378398, 0, 0, 0, -643468317, 0, 0, 0, 1555250406, 0, 0, 0, 1809448679, 0, 0, 0, 845658341, 0, 0, 0, 84769508, 0, 0, 0, 944383727, 0, 0, 0, 253813998, 0, 0, 0, 1453236972, 0, 0, 0, 1643405549, 0, 0, 0, -454938648, 0, 0, 0, -746000919, 0, 0, 0, -1976128533, 0, 0, 0, -1118017046, 0, 0, 0, -256371715, 0, 0, 0, -942484996, 0, 0, 0, -1637050370, 0, 0, 0, -1459202561, 0, 0, 0, 739252986, 0, 0, 0, 461035771, 0, 0, 0, 1120182009, 0, 0, 0, 1974361336, 0, 0, 0, 1223229683, 0, 0, 0, 2139341554, 0, 0, 0, 641565936, 0, 0, 0, 290932465, 0, 0, 0, -1807676940, 0, 0, 0, -1557410827, 0, 0, 0, -90862089, 0, 0, 0, -838905866, 0, 0, 0, 1616738521, 0, 0, 0, 1463270104, 0, 0, 0, 243924186, 0, 0, 0, 971194075, 0, 0, 0, -1124765218, 0, 0, 0, -1952468001, 0, 0, 0, -769526307, 0, 0, 0, -448055332, 0, 0, 0, -670274601, 0, 0, 0, -278484522, 0, 0, 0, -1227296812, 0, 0, 0, -2119029291, 0, 0, 0, 77882064, 0, 0, 0, 869179601, 0, 0, 0, 1785784019, 0, 0, 0, 1561994450, 0, 0, 0, 285105861, 0, 0, 0, 664050884, 0, 0, 0, 2116737734, 0, 0, 0, 1228937415, 0, 0, 0, -866756670, 0, 0, 0, -79915581, 0, 0, 0, -1568484415, 0, 0, 0, -1779953216, 0, 0, 0, -1464906293, 0, 0, 0, -1614442550, 0, 0, 0, -964965944, 0, 0, 0, -250541111, 0, 0, 0, 1946633420, 0, 0, 0, 1131251405, 0, 0, 0, 450085071, 0, 0, 0, 767099598, 0, 0, 0, 1083617169, 0, 0, 0, 2013031824, 0, 0, 0, 776088466, 0, 0, 0, 422111635, 0, 0, 0, -1673615722, 0, 0, 0, -1420532585, 0, 0, 0, -219536747, 0, 0, 0, -981409644, 0, 0, 0, -121127777, 0, 0, 0, -810713442, 0, 0, 0, -1777125220, 0, 0, 0, -1585841507, 0, 0, 0, 611300760, 0, 0, 0, 319125401, 0, 0, 0, 1253781915, 0, 0, 0, 2110911386, 0, 0, 0, 808814989, 0, 0, 0, 123685772, 0, 0, 0, 1591807374, 0, 0, 0, 1770770319, 0, 0, 0, -325222262, 0, 0, 0, -604552565, 0, 0, 0, -2109143927, 0, 0, 0, -1255946616, 0, 0, 0, -2006672765, 0, 0, 0, -1089578878, 0, 0, 0, -424665472, 0, 0, 0, -774185855, 0, 0, 0, 1422693252, 0, 0, 0, 1671844229, 0, 0, 0, 974657415, 0, 0, 0, 225629574, 0, 0, 0, -1596923223, 0, 0, 0, -1749409624, 0, 0, 0, -838572374, 0, 0, 0, -110189397, 0, 0, 0, 2088299438, 0, 0, 0, 1259481519, 0, 0, 0, 313290669, 0, 0, 0, 633777580, 0, 0, 0, 411169191, 0, 0, 0, 803943334, 0, 0, 0, 1985312164, 0, 0, 0, 1094694821, 0, 0, 0, -1003882336, 0, 0, 0, -213697887, 0, 0, 0, -1426228061, 0, 0, 0, -1650999646, 0, 0, 0, -797719371, 0, 0, 0, -417790284, 0, 0, 0, -1096335178, 0, 0, 0, -1983020361, 0, 0, 0, 215731634, 0, 0, 0, 1001459635, 0, 0, 0, 1645169073, 0, 0, 0, 1432718256, 0, 0, 0, 1747113915, 0, 0, 0, 1598559674, 0, 0, 0, 116806584, 0, 0, 0, 832344505, 0, 0, 0, -1265967428, 0, 0, 0, -2082464579, 0, 0, 0, -631350593, 0, 0, 0, -315320130, 0, 0, 0, 0, 0, 0, 0, 1701297336, 0, 0, 0, -1949824598, 0, 0, 0, -290474734, 0, 0, 0, 1469538959, 0, 0, 0, 854646327, 0, 0, 0, -597726427, 0, 0, 0, -1187457123, 0, 0, 0, -282544955, 0, 0, 0, -1974531971, 0, 0, 0, 1692450159, 0, 0, 0, 25625047, 0, 0, 0, -1195387318, 0, 0, 0, -573019406, 0, 0, 0, 863494112, 0, 0, 0, 1443914584, 0, 0, 0, -1621681840, 0, 0, 0, -97475096, 0, 0, 0, 345968890, 0, 0, 0, 1912122434, 0, 0, 0, -926909473, 0, 0, 0, -1381513369, 0, 0, 0, 1124627061, 0, 0, 0, 644861645, 0, 0, 0, 1887415701, 0, 0, 0, 353898797, 0, 0, 0, -71850945, 0, 0, 0, -1630529401, 0, 0, 0, 669568794, 0, 0, 0, 1116697506, 0, 0, 0, -1407138128, 0, 0, 0, -918062584, 0, 0, 0, 1051669152, 0, 0, 0, 1539870232, 0, 0, 0, -1251525878, 0, 0, 0, -805271630, 0, 0, 0, 1765298223, 0, 0, 0, 207613079, 0, 0, 0, -487564923, 0, 0, 0, -2020088515, 0, 0, 0, -779647387, 0, 0, 0, -1260373283, 0, 0, 0, 1515163599, 0, 0, 0, 1059599223, 0, 0, 0, -2045713174, 0, 0, 0, -478717870, 0, 0, 0, 232320320, 0, 0, 0, 1757368824, 0, 0, 0, -1577571344, 0, 0, 0, -996174008, 0, 0, 0, 707797594, 0, 0, 0, 1331142370, 0, 0, 0, -160478849, 0, 0, 0, -1828129337, 0, 0, 0, 2108113109, 0, 0, 0, 415300717, 0, 0, 0, 1322295093, 0, 0, 0, 733422477, 0, 0, 0, -988244321, 0, 0, 0, -1602278873, 0, 0, 0, 424148410, 0, 0, 0, 2082488578, 0, 0, 0, -1836059632, 0, 0, 0, -135771992, 0, 0, 0, 1029182619, 0, 0, 0, 1480566819, 0, 0, 0, -1232069327, 0, 0, 0, -738745975, 0, 0, 0, 1791981076, 0, 0, 0, 262720172, 0, 0, 0, -519602242, 0, 0, 0, -2074033402, 0, 0, 0, -764370850, 0, 0, 0, -1223222042, 0, 0, 0, 1505274356, 0, 0, 0, 1021252940, 0, 0, 0, -2048408879, 0, 0, 0, -528449943, 0, 0, 0, 238013307, 0, 0, 0, 1799911363, 0, 0, 0, -1576071733, 0, 0, 0, -949440141, 0, 0, 0, 700908641, 0, 0, 0, 1285601497, 0, 0, 0, -174559420, 0, 0, 0, -1862282244, 0, 0, 0, 2119198446, 0, 0, 0, 456645206, 0, 0, 0, 1294448910, 0, 0, 0, 675284406, 0, 0, 0, -957370204, 0, 0, 0, -1551365092, 0, 0, 0, 447798145, 0, 0, 0, 2144823097, 0, 0, 0, -1854352853, 0, 0, 0, -199266669, 0, 0, 0, 66528827, 0, 0, 0, 1720752771, 0, 0, 0, -2009124975, 0, 0, 0, -312962263, 0, 0, 0, 1415595188, 0, 0, 0, 822605836, 0, 0, 0, -542618338, 0, 0, 0, -1160777306, 0, 0, 0, -320892162, 0, 0, 0, -1984418234, 0, 0, 0, 1729600340, 0, 0, 0, 40904684, 0, 0, 0, -1152847759, 0, 0, 0, -567325495, 0, 0, 0, 813758939, 0, 0, 0, 1441219939, 0, 0, 0, -1667219605, 0, 0, 0, -104365101, 0, 0, 0, 392705729, 0, 0, 0, 1913621113, 0, 0, 0, -885563932, 0, 0, 0, -1370431140, 0, 0, 0, 1090475086, 0, 0, 0, 630778102, 0, 0, 0, 1938328494, 0, 0, 0, 384775958, 0, 0, 0, -129990140, 0, 0, 0, -1658372420, 0, 0, 0, 606071073, 0, 0, 0, 1098405273, 0, 0, 0, -1344806773, 0, 0, 0, -894411725, 0, 0, 0, 1001806317, 0, 0, 0, 1590814037, 0, 0, 0, -1333899193, 0, 0, 0, -719721217, 0, 0, 0, 1814117218, 0, 0, 0, 155617242, 0, 0, 0, -404147512, 0, 0, 0, -2104586640, 0, 0, 0, -727782104, 0, 0, 0, -1309060720, 0, 0, 0, 1599530114, 0, 0, 0, 976312378, 0, 0, 0, -2096525401, 0, 0, 0, -428985569, 0, 0, 0, 146900493, 0, 0, 0, 1839610549, 0, 0, 0, -1528741699, 0, 0, 0, -1048118267, 0, 0, 0, 791234839, 0, 0, 0, 1246688687, 0, 0, 0, -210361806, 0, 0, 0, -1777230198, 0, 0, 0, 2025728920, 0, 0, 0, 500799264, 0, 0, 0, 1271526520, 0, 0, 0, 783173824, 0, 0, 0, -1073611310, 0, 0, 0, -1520025238, 0, 0, 0, 475961079, 0, 0, 0, 2033789519, 0, 0, 0, -1751736483, 0, 0, 0, -219077659, 0, 0, 0, 85551949, 0, 0, 0, 1618925557, 0, 0, 0, -1898880281, 0, 0, 0, -340337057, 0, 0, 0, 1385040322, 0, 0, 0, 938063226, 0, 0, 0, -649723800, 0, 0, 0, -1138639664, 0, 0, 0, -365830264, 0, 0, 0, -1890163920, 0, 0, 0, 1643763234, 0, 0, 0, 77490842, 0, 0, 0, -1113146105, 0, 0, 0, -658439745, 0, 0, 0, 913224877, 0, 0, 0, 1393100821, 0, 0, 0, -1706135011, 0, 0, 0, -14037339, 0, 0, 0, 294026167, 0, 0, 0, 1960953615, 0, 0, 0, -841412462, 0, 0, 0, -1463899094, 0, 0, 0, 1175525688, 0, 0, 0, 594978176, 0, 0, 0, 1969669848, 0, 0, 0, 268532320, 0, 0, 0, -22098062, 0, 0, 0, -1681296438, 0, 0, 0, 586261591, 0, 0, 0, 1201019119, 0, 0, 0, -1455837699, 0, 0, 0, -866250427, 0, 0, 0, 116280694, 0, 0, 0, 1669984718, 0, 0, 0, -1926871844, 0, 0, 0, -398329756, 0, 0, 0, 1366896633, 0, 0, 0, 874419009, 0, 0, 0, -625924525, 0, 0, 0, -1076454677, 0, 0, 0, -372835917, 0, 0, 0, -1935588085, 0, 0, 0, 1645146137, 0, 0, 0, 124341409, 0, 0, 0, -1101948100, 0, 0, 0, -617207932, 0, 0, 0, 899256982, 0, 0, 0, 1358835246, 0, 0, 0, -1715907546, 0, 0, 0, -52500322, 0, 0, 0, 309419404, 0, 0, 0, 1997988148, 0, 0, 0, -835832151, 0, 0, 0, -1421243887, 0, 0, 0, 1172717315, 0, 0, 0, 545358779, 0, 0, 0, 1989271779, 0, 0, 0, 334912603, 0, 0, 0, -44439223, 0, 0, 0, -1740745231, 0, 0, 0, 554074732, 0, 0, 0, 1147223764, 0, 0, 0, -1429304378, 0, 0, 0, -810993794, 0, 0, 0, 943816662, 0, 0, 0, 1562821486, 0, 0, 0, -1282836868, 0, 0, 0, -688993596, 0, 0, 0, 1876303193, 0, 0, 0, 179413473, 0, 0, 0, -467790605, 0, 0, 0, -2122733493, 0, 0, 0, -680932589, 0, 0, 0, -1307674709, 0, 0, 0, 1554105017, 0, 0, 0, 969309697, 0, 0, 0, -2130794084, 0, 0, 0, -442952412, 0, 0, 0, 188129334, 0, 0, 0, 1850809486, 0, 0, 0, -1491704186, 0, 0, 0, -1032725954, 0, 0, 0, 752774956, 0, 0, 0, 1236915092, 0, 0, 0, -259980279, 0, 0, 0, -1780041551, 0, 0, 0, 2068385187, 0, 0, 0, 506376475, 0, 0, 0, 1212076611, 0, 0, 0, 760835835, 0, 0, 0, -1007232023, 0, 0, 0, -1500420271, 0, 0, 0, 531214540, 0, 0, 0, 2060323956, 0, 0, 0, -1805534874, 0, 0, 0, -251263522, 0, 0, 0], ["i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0], ALLOC_STATIC);
_configuration_table=allocate([0, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0, 4, 0, 4, 0, 8, 0, 4, 0, 2, 0, 0, 0, 4, 0, 5, 0, 16, 0, 8, 0, 2, 0, 0, 0, 4, 0, 6, 0, 32, 0, 32, 0, 2, 0, 0, 0, 4, 0, 4, 0, 16, 0, 16, 0, 6, 0, 0, 0, 8, 0, 16, 0, 32, 0, 32, 0, 6, 0, 0, 0, 8, 0, 16, 0, 128, 0, 128, 0, 6, 0, 0, 0, 8, 0, 32, 0, 128, 0, 256, 0, 6, 0, 0, 0, 32, 0, 128, 0, 258, 0, 1024, 0, 6, 0, 0, 0, 32, 0, 258, 0, 258, 0, 4096, 0, 6, 0, 0, 0], ["i16",0,"i16",0,"i16",0,"i16",0,"*",0,0,0,"i16",0,"i16",0,"i16",0,"i16",0,"*",0,0,0,"i16",0,"i16",0,"i16",0,"i16",0,"*",0,0,0,"i16",0,"i16",0,"i16",0,"i16",0,"*",0,0,0,"i16",0,"i16",0,"i16",0,"i16",0,"*",0,0,0,"i16",0,"i16",0,"i16",0,"i16",0,"*",0,0,0,"i16",0,"i16",0,"i16",0,"i16",0,"*",0,0,0,"i16",0,"i16",0,"i16",0,"i16",0,"*",0,0,0,"i16",0,"i16",0,"i16",0,"i16",0,"*",0,0,0,"i16",0,"i16",0,"i16",0,"i16",0,"*",0,0,0], ALLOC_STATIC);
_inflate_order=allocate([16, 0, 17, 0, 18, 0, 0, 0, 8, 0, 7, 0, 9, 0, 6, 0, 10, 0, 5, 0, 11, 0, 4, 0, 12, 0, 3, 0, 13, 0, 2, 0, 14, 0, 1, 0, 15, 0], ["i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0], ALLOC_STATIC);
STRING_TABLE.__str164=allocate([105,110,99,111,114,114,101,99,116,32,104,101,97,100,101,114,32,99,104,101,99,107,0] /* incorrect header che */, "i8", ALLOC_STATIC);
STRING_TABLE.__str265=allocate([117,110,107,110,111,119,110,32,99,111,109,112,114,101,115,115,105,111,110,32,109,101,116,104,111,100,0] /* unknown compression  */, "i8", ALLOC_STATIC);
STRING_TABLE.__str366=allocate([105,110,118,97,108,105,100,32,119,105,110,100,111,119,32,115,105,122,101,0] /* invalid window size\ */, "i8", ALLOC_STATIC);
STRING_TABLE.__str467=allocate([117,110,107,110,111,119,110,32,104,101,97,100,101,114,32,102,108,97,103,115,32,115,101,116,0] /* unknown header flags */, "i8", ALLOC_STATIC);
STRING_TABLE.__str568=allocate([104,101,97,100,101,114,32,99,114,99,32,109,105,115,109,97,116,99,104,0] /* header crc mismatch\ */, "i8", ALLOC_STATIC);
STRING_TABLE.__str669=allocate([105,110,118,97,108,105,100,32,98,108,111,99,107,32,116,121,112,101,0] /* invalid block type\0 */, "i8", ALLOC_STATIC);
STRING_TABLE.__str770=allocate([105,110,118,97,108,105,100,32,115,116,111,114,101,100,32,98,108,111,99,107,32,108,101,110,103,116,104,115,0] /* invalid stored block */, "i8", ALLOC_STATIC);
STRING_TABLE.__str871=allocate([116,111,111,32,109,97,110,121,32,108,101,110,103,116,104,32,111,114,32,100,105,115,116,97,110,99,101,32,115,121,109,98,111,108,115,0] /* too many length or d */, "i8", ALLOC_STATIC);
STRING_TABLE.__str972=allocate([105,110,118,97,108,105,100,32,99,111,100,101,32,108,101,110,103,116,104,115,32,115,101,116,0] /* invalid code lengths */, "i8", ALLOC_STATIC);
STRING_TABLE.__str1073=allocate([105,110,118,97,108,105,100,32,98,105,116,32,108,101,110,103,116,104,32,114,101,112,101,97,116,0] /* invalid bit length r */, "i8", ALLOC_STATIC);
STRING_TABLE.__str1174=allocate([105,110,118,97,108,105,100,32,99,111,100,101,32,45,45,32,109,105,115,115,105,110,103,32,101,110,100,45,111,102,45,98,108,111,99,107,0] /* invalid code -- miss */, "i8", ALLOC_STATIC);
STRING_TABLE.__str1275=allocate([105,110,118,97,108,105,100,32,108,105,116,101,114,97,108,47,108,101,110,103,116,104,115,32,115,101,116,0] /* invalid literal/leng */, "i8", ALLOC_STATIC);
STRING_TABLE.__str1376=allocate([105,110,118,97,108,105,100,32,100,105,115,116,97,110,99,101,115,32,115,101,116,0] /* invalid distances se */, "i8", ALLOC_STATIC);
STRING_TABLE.__str1477=allocate([105,110,118,97,108,105,100,32,108,105,116,101,114,97,108,47,108,101,110,103,116,104,32,99,111,100,101,0] /* invalid literal/leng */, "i8", ALLOC_STATIC);
STRING_TABLE.__str1578=allocate([105,110,118,97,108,105,100,32,100,105,115,116,97,110,99,101,32,99,111,100,101,0] /* invalid distance cod */, "i8", ALLOC_STATIC);
STRING_TABLE.__str1679=allocate([105,110,118,97,108,105,100,32,100,105,115,116,97,110,99,101,32,116,111,111,32,102,97,114,32,98,97,99,107,0] /* invalid distance too */, "i8", ALLOC_STATIC);
STRING_TABLE.__str17=allocate([105,110,99,111,114,114,101,99,116,32,100,97,116,97,32,99,104,101,99,107,0] /* incorrect data check */, "i8", ALLOC_STATIC);
STRING_TABLE.__str18=allocate([105,110,99,111,114,114,101,99,116,32,108,101,110,103,116,104,32,99,104,101,99,107,0] /* incorrect length che */, "i8", ALLOC_STATIC);
_fixedtables_lenfix80=allocate([96, 7, 0, 0, 0, 8, 80, 0, 0, 8, 16, 0, 20, 8, 115, 0, 18, 7, 31, 0, 0, 8, 112, 0, 0, 8, 48, 0, 0, 9, 192, 0, 16, 7, 10, 0, 0, 8, 96, 0, 0, 8, 32, 0, 0, 9, 160, 0, 0, 8, 0, 0, 0, 8, 128, 0, 0, 8, 64, 0, 0, 9, 224, 0, 16, 7, 6, 0, 0, 8, 88, 0, 0, 8, 24, 0, 0, 9, 144, 0, 19, 7, 59, 0, 0, 8, 120, 0, 0, 8, 56, 0, 0, 9, 208, 0, 17, 7, 17, 0, 0, 8, 104, 0, 0, 8, 40, 0, 0, 9, 176, 0, 0, 8, 8, 0, 0, 8, 136, 0, 0, 8, 72, 0, 0, 9, 240, 0, 16, 7, 4, 0, 0, 8, 84, 0, 0, 8, 20, 0, 21, 8, 227, 0, 19, 7, 43, 0, 0, 8, 116, 0, 0, 8, 52, 0, 0, 9, 200, 0, 17, 7, 13, 0, 0, 8, 100, 0, 0, 8, 36, 0, 0, 9, 168, 0, 0, 8, 4, 0, 0, 8, 132, 0, 0, 8, 68, 0, 0, 9, 232, 0, 16, 7, 8, 0, 0, 8, 92, 0, 0, 8, 28, 0, 0, 9, 152, 0, 20, 7, 83, 0, 0, 8, 124, 0, 0, 8, 60, 0, 0, 9, 216, 0, 18, 7, 23, 0, 0, 8, 108, 0, 0, 8, 44, 0, 0, 9, 184, 0, 0, 8, 12, 0, 0, 8, 140, 0, 0, 8, 76, 0, 0, 9, 248, 0, 16, 7, 3, 0, 0, 8, 82, 0, 0, 8, 18, 0, 21, 8, 163, 0, 19, 7, 35, 0, 0, 8, 114, 0, 0, 8, 50, 0, 0, 9, 196, 0, 17, 7, 11, 0, 0, 8, 98, 0, 0, 8, 34, 0, 0, 9, 164, 0, 0, 8, 2, 0, 0, 8, 130, 0, 0, 8, 66, 0, 0, 9, 228, 0, 16, 7, 7, 0, 0, 8, 90, 0, 0, 8, 26, 0, 0, 9, 148, 0, 20, 7, 67, 0, 0, 8, 122, 0, 0, 8, 58, 0, 0, 9, 212, 0, 18, 7, 19, 0, 0, 8, 106, 0, 0, 8, 42, 0, 0, 9, 180, 0, 0, 8, 10, 0, 0, 8, 138, 0, 0, 8, 74, 0, 0, 9, 244, 0, 16, 7, 5, 0, 0, 8, 86, 0, 0, 8, 22, 0, 64, 8, 0, 0, 19, 7, 51, 0, 0, 8, 118, 0, 0, 8, 54, 0, 0, 9, 204, 0, 17, 7, 15, 0, 0, 8, 102, 0, 0, 8, 38, 0, 0, 9, 172, 0, 0, 8, 6, 0, 0, 8, 134, 0, 0, 8, 70, 0, 0, 9, 236, 0, 16, 7, 9, 0, 0, 8, 94, 0, 0, 8, 30, 0, 0, 9, 156, 0, 20, 7, 99, 0, 0, 8, 126, 0, 0, 8, 62, 0, 0, 9, 220, 0, 18, 7, 27, 0, 0, 8, 110, 0, 0, 8, 46, 0, 0, 9, 188, 0, 0, 8, 14, 0, 0, 8, 142, 0, 0, 8, 78, 0, 0, 9, 252, 0, 96, 7, 0, 0, 0, 8, 81, 0, 0, 8, 17, 0, 21, 8, 131, 0, 18, 7, 31, 0, 0, 8, 113, 0, 0, 8, 49, 0, 0, 9, 194, 0, 16, 7, 10, 0, 0, 8, 97, 0, 0, 8, 33, 0, 0, 9, 162, 0, 0, 8, 1, 0, 0, 8, 129, 0, 0, 8, 65, 0, 0, 9, 226, 0, 16, 7, 6, 0, 0, 8, 89, 0, 0, 8, 25, 0, 0, 9, 146, 0, 19, 7, 59, 0, 0, 8, 121, 0, 0, 8, 57, 0, 0, 9, 210, 0, 17, 7, 17, 0, 0, 8, 105, 0, 0, 8, 41, 0, 0, 9, 178, 0, 0, 8, 9, 0, 0, 8, 137, 0, 0, 8, 73, 0, 0, 9, 242, 0, 16, 7, 4, 0, 0, 8, 85, 0, 0, 8, 21, 0, 16, 8, 258, 0, 19, 7, 43, 0, 0, 8, 117, 0, 0, 8, 53, 0, 0, 9, 202, 0, 17, 7, 13, 0, 0, 8, 101, 0, 0, 8, 37, 0, 0, 9, 170, 0, 0, 8, 5, 0, 0, 8, 133, 0, 0, 8, 69, 0, 0, 9, 234, 0, 16, 7, 8, 0, 0, 8, 93, 0, 0, 8, 29, 0, 0, 9, 154, 0, 20, 7, 83, 0, 0, 8, 125, 0, 0, 8, 61, 0, 0, 9, 218, 0, 18, 7, 23, 0, 0, 8, 109, 0, 0, 8, 45, 0, 0, 9, 186, 0, 0, 8, 13, 0, 0, 8, 141, 0, 0, 8, 77, 0, 0, 9, 250, 0, 16, 7, 3, 0, 0, 8, 83, 0, 0, 8, 19, 0, 21, 8, 195, 0, 19, 7, 35, 0, 0, 8, 115, 0, 0, 8, 51, 0, 0, 9, 198, 0, 17, 7, 11, 0, 0, 8, 99, 0, 0, 8, 35, 0, 0, 9, 166, 0, 0, 8, 3, 0, 0, 8, 131, 0, 0, 8, 67, 0, 0, 9, 230, 0, 16, 7, 7, 0, 0, 8, 91, 0, 0, 8, 27, 0, 0, 9, 150, 0, 20, 7, 67, 0, 0, 8, 123, 0, 0, 8, 59, 0, 0, 9, 214, 0, 18, 7, 19, 0, 0, 8, 107, 0, 0, 8, 43, 0, 0, 9, 182, 0, 0, 8, 11, 0, 0, 8, 139, 0, 0, 8, 75, 0, 0, 9, 246, 0, 16, 7, 5, 0, 0, 8, 87, 0, 0, 8, 23, 0, 64, 8, 0, 0, 19, 7, 51, 0, 0, 8, 119, 0, 0, 8, 55, 0, 0, 9, 206, 0, 17, 7, 15, 0, 0, 8, 103, 0, 0, 8, 39, 0, 0, 9, 174, 0, 0, 8, 7, 0, 0, 8, 135, 0, 0, 8, 71, 0, 0, 9, 238, 0, 16, 7, 9, 0, 0, 8, 95, 0, 0, 8, 31, 0, 0, 9, 158, 0, 20, 7, 99, 0, 0, 8, 127, 0, 0, 8, 63, 0, 0, 9, 222, 0, 18, 7, 27, 0, 0, 8, 111, 0, 0, 8, 47, 0, 0, 9, 190, 0, 0, 8, 15, 0, 0, 8, 143, 0, 0, 8, 79, 0, 0, 9, 254, 0, 96, 7, 0, 0, 0, 8, 80, 0, 0, 8, 16, 0, 20, 8, 115, 0, 18, 7, 31, 0, 0, 8, 112, 0, 0, 8, 48, 0, 0, 9, 193, 0, 16, 7, 10, 0, 0, 8, 96, 0, 0, 8, 32, 0, 0, 9, 161, 0, 0, 8, 0, 0, 0, 8, 128, 0, 0, 8, 64, 0, 0, 9, 225, 0, 16, 7, 6, 0, 0, 8, 88, 0, 0, 8, 24, 0, 0, 9, 145, 0, 19, 7, 59, 0, 0, 8, 120, 0, 0, 8, 56, 0, 0, 9, 209, 0, 17, 7, 17, 0, 0, 8, 104, 0, 0, 8, 40, 0, 0, 9, 177, 0, 0, 8, 8, 0, 0, 8, 136, 0, 0, 8, 72, 0, 0, 9, 241, 0, 16, 7, 4, 0, 0, 8, 84, 0, 0, 8, 20, 0, 21, 8, 227, 0, 19, 7, 43, 0, 0, 8, 116, 0, 0, 8, 52, 0, 0, 9, 201, 0, 17, 7, 13, 0, 0, 8, 100, 0, 0, 8, 36, 0, 0, 9, 169, 0, 0, 8, 4, 0, 0, 8, 132, 0, 0, 8, 68, 0, 0, 9, 233, 0, 16, 7, 8, 0, 0, 8, 92, 0, 0, 8, 28, 0, 0, 9, 153, 0, 20, 7, 83, 0, 0, 8, 124, 0, 0, 8, 60, 0, 0, 9, 217, 0, 18, 7, 23, 0, 0, 8, 108, 0, 0, 8, 44, 0, 0, 9, 185, 0, 0, 8, 12, 0, 0, 8, 140, 0, 0, 8, 76, 0, 0, 9, 249, 0, 16, 7, 3, 0, 0, 8, 82, 0, 0, 8, 18, 0, 21, 8, 163, 0, 19, 7, 35, 0, 0, 8, 114, 0, 0, 8, 50, 0, 0, 9, 197, 0, 17, 7, 11, 0, 0, 8, 98, 0, 0, 8, 34, 0, 0, 9, 165, 0, 0, 8, 2, 0, 0, 8, 130, 0, 0, 8, 66, 0, 0, 9, 229, 0, 16, 7, 7, 0, 0, 8, 90, 0, 0, 8, 26, 0, 0, 9, 149, 0, 20, 7, 67, 0, 0, 8, 122, 0, 0, 8, 58, 0, 0, 9, 213, 0, 18, 7, 19, 0, 0, 8, 106, 0, 0, 8, 42, 0, 0, 9, 181, 0, 0, 8, 10, 0, 0, 8, 138, 0, 0, 8, 74, 0, 0, 9, 245, 0, 16, 7, 5, 0, 0, 8, 86, 0, 0, 8, 22, 0, 64, 8, 0, 0, 19, 7, 51, 0, 0, 8, 118, 0, 0, 8, 54, 0, 0, 9, 205, 0, 17, 7, 15, 0, 0, 8, 102, 0, 0, 8, 38, 0, 0, 9, 173, 0, 0, 8, 6, 0, 0, 8, 134, 0, 0, 8, 70, 0, 0, 9, 237, 0, 16, 7, 9, 0, 0, 8, 94, 0, 0, 8, 30, 0, 0, 9, 157, 0, 20, 7, 99, 0, 0, 8, 126, 0, 0, 8, 62, 0, 0, 9, 221, 0, 18, 7, 27, 0, 0, 8, 110, 0, 0, 8, 46, 0, 0, 9, 189, 0, 0, 8, 14, 0, 0, 8, 142, 0, 0, 8, 78, 0, 0, 9, 253, 0, 96, 7, 0, 0, 0, 8, 81, 0, 0, 8, 17, 0, 21, 8, 131, 0, 18, 7, 31, 0, 0, 8, 113, 0, 0, 8, 49, 0, 0, 9, 195, 0, 16, 7, 10, 0, 0, 8, 97, 0, 0, 8, 33, 0, 0, 9, 163, 0, 0, 8, 1, 0, 0, 8, 129, 0, 0, 8, 65, 0, 0, 9, 227, 0, 16, 7, 6, 0, 0, 8, 89, 0, 0, 8, 25, 0, 0, 9, 147, 0, 19, 7, 59, 0, 0, 8, 121, 0, 0, 8, 57, 0, 0, 9, 211, 0, 17, 7, 17, 0, 0, 8, 105, 0, 0, 8, 41, 0, 0, 9, 179, 0, 0, 8, 9, 0, 0, 8, 137, 0, 0, 8, 73, 0, 0, 9, 243, 0, 16, 7, 4, 0, 0, 8, 85, 0, 0, 8, 21, 0, 16, 8, 258, 0, 19, 7, 43, 0, 0, 8, 117, 0, 0, 8, 53, 0, 0, 9, 203, 0, 17, 7, 13, 0, 0, 8, 101, 0, 0, 8, 37, 0, 0, 9, 171, 0, 0, 8, 5, 0, 0, 8, 133, 0, 0, 8, 69, 0, 0, 9, 235, 0, 16, 7, 8, 0, 0, 8, 93, 0, 0, 8, 29, 0, 0, 9, 155, 0, 20, 7, 83, 0, 0, 8, 125, 0, 0, 8, 61, 0, 0, 9, 219, 0, 18, 7, 23, 0, 0, 8, 109, 0, 0, 8, 45, 0, 0, 9, 187, 0, 0, 8, 13, 0, 0, 8, 141, 0, 0, 8, 77, 0, 0, 9, 251, 0, 16, 7, 3, 0, 0, 8, 83, 0, 0, 8, 19, 0, 21, 8, 195, 0, 19, 7, 35, 0, 0, 8, 115, 0, 0, 8, 51, 0, 0, 9, 199, 0, 17, 7, 11, 0, 0, 8, 99, 0, 0, 8, 35, 0, 0, 9, 167, 0, 0, 8, 3, 0, 0, 8, 131, 0, 0, 8, 67, 0, 0, 9, 231, 0, 16, 7, 7, 0, 0, 8, 91, 0, 0, 8, 27, 0, 0, 9, 151, 0, 20, 7, 67, 0, 0, 8, 123, 0, 0, 8, 59, 0, 0, 9, 215, 0, 18, 7, 19, 0, 0, 8, 107, 0, 0, 8, 43, 0, 0, 9, 183, 0, 0, 8, 11, 0, 0, 8, 139, 0, 0, 8, 75, 0, 0, 9, 247, 0, 16, 7, 5, 0, 0, 8, 87, 0, 0, 8, 23, 0, 64, 8, 0, 0, 19, 7, 51, 0, 0, 8, 119, 0, 0, 8, 55, 0, 0, 9, 207, 0, 17, 7, 15, 0, 0, 8, 103, 0, 0, 8, 39, 0, 0, 9, 175, 0, 0, 8, 7, 0, 0, 8, 135, 0, 0, 8, 71, 0, 0, 9, 239, 0, 16, 7, 9, 0, 0, 8, 95, 0, 0, 8, 31, 0, 0, 9, 159, 0, 20, 7, 99, 0, 0, 8, 127, 0, 0, 8, 63, 0, 0, 9, 223, 0, 18, 7, 27, 0, 0, 8, 111, 0, 0, 8, 47, 0, 0, 9, 191, 0, 0, 8, 15, 0, 0, 8, 143, 0, 0, 8, 79, 0, 0, 9, 255, 0], ["i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0], ALLOC_STATIC);
_fixedtables_distfix81=allocate([16, 5, 1, 0, 23, 5, 257, 0, 19, 5, 17, 0, 27, 5, 4097, 0, 17, 5, 5, 0, 25, 5, 1025, 0, 21, 5, 65, 0, 29, 5, 16385, 0, 16, 5, 3, 0, 24, 5, 513, 0, 20, 5, 33, 0, 28, 5, 8193, 0, 18, 5, 9, 0, 26, 5, 2049, 0, 22, 5, 129, 0, 64, 5, 0, 0, 16, 5, 2, 0, 23, 5, 385, 0, 19, 5, 25, 0, 27, 5, 6145, 0, 17, 5, 7, 0, 25, 5, 1537, 0, 21, 5, 97, 0, 29, 5, 24577, 0, 16, 5, 4, 0, 24, 5, 769, 0, 20, 5, 49, 0, 28, 5, 12289, 0, 18, 5, 13, 0, 26, 5, 3073, 0, 22, 5, 193, 0, 64, 5, 0, 0], ["i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0,"i8","i8","i16",0], ALLOC_STATIC);
_inflate_table_lbase=allocate([3, 0, 4, 0, 5, 0, 6, 0, 7, 0, 8, 0, 9, 0, 10, 0, 11, 0, 13, 0, 15, 0, 17, 0, 19, 0, 23, 0, 27, 0, 31, 0, 35, 0, 43, 0, 51, 0, 59, 0, 67, 0, 83, 0, 99, 0, 115, 0, 131, 0, 163, 0, 195, 0, 227, 0, 258, 0, 0, 0, 0, 0], ["i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0], ALLOC_STATIC);
_inflate_table_lext=allocate([16, 0, 16, 0, 16, 0, 16, 0, 16, 0, 16, 0, 16, 0, 16, 0, 17, 0, 17, 0, 17, 0, 17, 0, 18, 0, 18, 0, 18, 0, 18, 0, 19, 0, 19, 0, 19, 0, 19, 0, 20, 0, 20, 0, 20, 0, 20, 0, 21, 0, 21, 0, 21, 0, 21, 0, 16, 0, 78, 0, 68, 0], ["i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0], ALLOC_STATIC);
_inflate_table_dbase=allocate([1, 0, 2, 0, 3, 0, 4, 0, 5, 0, 7, 0, 9, 0, 13, 0, 17, 0, 25, 0, 33, 0, 49, 0, 65, 0, 97, 0, 129, 0, 193, 0, 257, 0, 385, 0, 513, 0, 769, 0, 1025, 0, 1537, 0, 2049, 0, 3073, 0, 4097, 0, 6145, 0, 8193, 0, 12289, 0, 16385, 0, 24577, 0, 0, 0, 0, 0], ["i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0], ALLOC_STATIC);
_inflate_table_dext=allocate([16, 0, 16, 0, 16, 0, 16, 0, 17, 0, 17, 0, 18, 0, 18, 0, 19, 0, 19, 0, 20, 0, 20, 0, 21, 0, 21, 0, 22, 0, 22, 0, 23, 0, 23, 0, 24, 0, 24, 0, 25, 0, 25, 0, 26, 0, 26, 0, 27, 0, 27, 0, 28, 0, 28, 0, 29, 0, 29, 0, 64, 0, 64, 0], ["i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0], ALLOC_STATIC);
STRING_TABLE.__dist_code=allocate([0,1,2,3,4,4,5,5,6,6,6,6,7,7,7,7,8,8,8,8,8,8,8,8,9,9,9,9,9,9,9,9,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,0,0,16,17,18,18,19,19,20,20,20,20,21,21,21,21,22,22,22,22,22,22,22,22,23,23,23,23,23,23,23,23,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29] /* \00\01\02\03\04\04\0 */, "i8", ALLOC_STATIC);
STRING_TABLE.__length_code=allocate([0,1,2,3,4,5,6,7,8,8,9,9,10,10,11,11,12,12,12,12,13,13,13,13,14,14,14,14,15,15,15,15,16,16,16,16,16,16,16,16,17,17,17,17,17,17,17,17,18,18,18,18,18,18,18,18,19,19,19,19,19,19,19,19,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,28] /* \00\01\02\03\04\05\0 */, "i8", ALLOC_STATIC);
_static_l_desc=allocate([0, 0, 0, 0, 0, 0, 0, 0, 257, 0, 0, 0, 286, 0, 0, 0, 15, 0, 0, 0], ["*",0,0,0,"*",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0], ALLOC_STATIC);
_static_d_desc=allocate([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 30, 0, 0, 0, 15, 0, 0, 0], ["*",0,0,0,"*",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0], ALLOC_STATIC);
_static_bl_desc=allocate([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 19, 0, 0, 0, 7, 0, 0, 0], ["*",0,0,0,"*",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0], ALLOC_STATIC);
_static_ltree=allocate([12, 0, 8, 0, 140, 0, 8, 0, 76, 0, 8, 0, 204, 0, 8, 0, 44, 0, 8, 0, 172, 0, 8, 0, 108, 0, 8, 0, 236, 0, 8, 0, 28, 0, 8, 0, 156, 0, 8, 0, 92, 0, 8, 0, 220, 0, 8, 0, 60, 0, 8, 0, 188, 0, 8, 0, 124, 0, 8, 0, 252, 0, 8, 0, 2, 0, 8, 0, 130, 0, 8, 0, 66, 0, 8, 0, 194, 0, 8, 0, 34, 0, 8, 0, 162, 0, 8, 0, 98, 0, 8, 0, 226, 0, 8, 0, 18, 0, 8, 0, 146, 0, 8, 0, 82, 0, 8, 0, 210, 0, 8, 0, 50, 0, 8, 0, 178, 0, 8, 0, 114, 0, 8, 0, 242, 0, 8, 0, 10, 0, 8, 0, 138, 0, 8, 0, 74, 0, 8, 0, 202, 0, 8, 0, 42, 0, 8, 0, 170, 0, 8, 0, 106, 0, 8, 0, 234, 0, 8, 0, 26, 0, 8, 0, 154, 0, 8, 0, 90, 0, 8, 0, 218, 0, 8, 0, 58, 0, 8, 0, 186, 0, 8, 0, 122, 0, 8, 0, 250, 0, 8, 0, 6, 0, 8, 0, 134, 0, 8, 0, 70, 0, 8, 0, 198, 0, 8, 0, 38, 0, 8, 0, 166, 0, 8, 0, 102, 0, 8, 0, 230, 0, 8, 0, 22, 0, 8, 0, 150, 0, 8, 0, 86, 0, 8, 0, 214, 0, 8, 0, 54, 0, 8, 0, 182, 0, 8, 0, 118, 0, 8, 0, 246, 0, 8, 0, 14, 0, 8, 0, 142, 0, 8, 0, 78, 0, 8, 0, 206, 0, 8, 0, 46, 0, 8, 0, 174, 0, 8, 0, 110, 0, 8, 0, 238, 0, 8, 0, 30, 0, 8, 0, 158, 0, 8, 0, 94, 0, 8, 0, 222, 0, 8, 0, 62, 0, 8, 0, 190, 0, 8, 0, 126, 0, 8, 0, 254, 0, 8, 0, 1, 0, 8, 0, 129, 0, 8, 0, 65, 0, 8, 0, 193, 0, 8, 0, 33, 0, 8, 0, 161, 0, 8, 0, 97, 0, 8, 0, 225, 0, 8, 0, 17, 0, 8, 0, 145, 0, 8, 0, 81, 0, 8, 0, 209, 0, 8, 0, 49, 0, 8, 0, 177, 0, 8, 0, 113, 0, 8, 0, 241, 0, 8, 0, 9, 0, 8, 0, 137, 0, 8, 0, 73, 0, 8, 0, 201, 0, 8, 0, 41, 0, 8, 0, 169, 0, 8, 0, 105, 0, 8, 0, 233, 0, 8, 0, 25, 0, 8, 0, 153, 0, 8, 0, 89, 0, 8, 0, 217, 0, 8, 0, 57, 0, 8, 0, 185, 0, 8, 0, 121, 0, 8, 0, 249, 0, 8, 0, 5, 0, 8, 0, 133, 0, 8, 0, 69, 0, 8, 0, 197, 0, 8, 0, 37, 0, 8, 0, 165, 0, 8, 0, 101, 0, 8, 0, 229, 0, 8, 0, 21, 0, 8, 0, 149, 0, 8, 0, 85, 0, 8, 0, 213, 0, 8, 0, 53, 0, 8, 0, 181, 0, 8, 0, 117, 0, 8, 0, 245, 0, 8, 0, 13, 0, 8, 0, 141, 0, 8, 0, 77, 0, 8, 0, 205, 0, 8, 0, 45, 0, 8, 0, 173, 0, 8, 0, 109, 0, 8, 0, 237, 0, 8, 0, 29, 0, 8, 0, 157, 0, 8, 0, 93, 0, 8, 0, 221, 0, 8, 0, 61, 0, 8, 0, 189, 0, 8, 0, 125, 0, 8, 0, 253, 0, 8, 0, 19, 0, 9, 0, 275, 0, 9, 0, 147, 0, 9, 0, 403, 0, 9, 0, 83, 0, 9, 0, 339, 0, 9, 0, 211, 0, 9, 0, 467, 0, 9, 0, 51, 0, 9, 0, 307, 0, 9, 0, 179, 0, 9, 0, 435, 0, 9, 0, 115, 0, 9, 0, 371, 0, 9, 0, 243, 0, 9, 0, 499, 0, 9, 0, 11, 0, 9, 0, 267, 0, 9, 0, 139, 0, 9, 0, 395, 0, 9, 0, 75, 0, 9, 0, 331, 0, 9, 0, 203, 0, 9, 0, 459, 0, 9, 0, 43, 0, 9, 0, 299, 0, 9, 0, 171, 0, 9, 0, 427, 0, 9, 0, 107, 0, 9, 0, 363, 0, 9, 0, 235, 0, 9, 0, 491, 0, 9, 0, 27, 0, 9, 0, 283, 0, 9, 0, 155, 0, 9, 0, 411, 0, 9, 0, 91, 0, 9, 0, 347, 0, 9, 0, 219, 0, 9, 0, 475, 0, 9, 0, 59, 0, 9, 0, 315, 0, 9, 0, 187, 0, 9, 0, 443, 0, 9, 0, 123, 0, 9, 0, 379, 0, 9, 0, 251, 0, 9, 0, 507, 0, 9, 0, 7, 0, 9, 0, 263, 0, 9, 0, 135, 0, 9, 0, 391, 0, 9, 0, 71, 0, 9, 0, 327, 0, 9, 0, 199, 0, 9, 0, 455, 0, 9, 0, 39, 0, 9, 0, 295, 0, 9, 0, 167, 0, 9, 0, 423, 0, 9, 0, 103, 0, 9, 0, 359, 0, 9, 0, 231, 0, 9, 0, 487, 0, 9, 0, 23, 0, 9, 0, 279, 0, 9, 0, 151, 0, 9, 0, 407, 0, 9, 0, 87, 0, 9, 0, 343, 0, 9, 0, 215, 0, 9, 0, 471, 0, 9, 0, 55, 0, 9, 0, 311, 0, 9, 0, 183, 0, 9, 0, 439, 0, 9, 0, 119, 0, 9, 0, 375, 0, 9, 0, 247, 0, 9, 0, 503, 0, 9, 0, 15, 0, 9, 0, 271, 0, 9, 0, 143, 0, 9, 0, 399, 0, 9, 0, 79, 0, 9, 0, 335, 0, 9, 0, 207, 0, 9, 0, 463, 0, 9, 0, 47, 0, 9, 0, 303, 0, 9, 0, 175, 0, 9, 0, 431, 0, 9, 0, 111, 0, 9, 0, 367, 0, 9, 0, 239, 0, 9, 0, 495, 0, 9, 0, 31, 0, 9, 0, 287, 0, 9, 0, 159, 0, 9, 0, 415, 0, 9, 0, 95, 0, 9, 0, 351, 0, 9, 0, 223, 0, 9, 0, 479, 0, 9, 0, 63, 0, 9, 0, 319, 0, 9, 0, 191, 0, 9, 0, 447, 0, 9, 0, 127, 0, 9, 0, 383, 0, 9, 0, 255, 0, 9, 0, 511, 0, 9, 0, 0, 0, 7, 0, 64, 0, 7, 0, 32, 0, 7, 0, 96, 0, 7, 0, 16, 0, 7, 0, 80, 0, 7, 0, 48, 0, 7, 0, 112, 0, 7, 0, 8, 0, 7, 0, 72, 0, 7, 0, 40, 0, 7, 0, 104, 0, 7, 0, 24, 0, 7, 0, 88, 0, 7, 0, 56, 0, 7, 0, 120, 0, 7, 0, 4, 0, 7, 0, 68, 0, 7, 0, 36, 0, 7, 0, 100, 0, 7, 0, 20, 0, 7, 0, 84, 0, 7, 0, 52, 0, 7, 0, 116, 0, 7, 0, 3, 0, 8, 0, 131, 0, 8, 0, 67, 0, 8, 0, 195, 0, 8, 0, 35, 0, 8, 0, 163, 0, 8, 0, 99, 0, 8, 0, 227, 0, 8, 0], ["i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0], ALLOC_STATIC);
_static_dtree=allocate([0, 0, 5, 0, 16, 0, 5, 0, 8, 0, 5, 0, 24, 0, 5, 0, 4, 0, 5, 0, 20, 0, 5, 0, 12, 0, 5, 0, 28, 0, 5, 0, 2, 0, 5, 0, 18, 0, 5, 0, 10, 0, 5, 0, 26, 0, 5, 0, 6, 0, 5, 0, 22, 0, 5, 0, 14, 0, 5, 0, 30, 0, 5, 0, 1, 0, 5, 0, 17, 0, 5, 0, 9, 0, 5, 0, 25, 0, 5, 0, 5, 0, 5, 0, 21, 0, 5, 0, 13, 0, 5, 0, 29, 0, 5, 0, 3, 0, 5, 0, 19, 0, 5, 0, 11, 0, 5, 0, 27, 0, 5, 0, 7, 0, 5, 0, 23, 0, 5, 0], ["i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0,"i16",0], ALLOC_STATIC);
_extra_lbits=allocate([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0], ["i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0], ALLOC_STATIC);
_base_length=allocate([0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 4, 0, 0, 0, 5, 0, 0, 0, 6, 0, 0, 0, 7, 0, 0, 0, 8, 0, 0, 0, 10, 0, 0, 0, 12, 0, 0, 0, 14, 0, 0, 0, 16, 0, 0, 0, 20, 0, 0, 0, 24, 0, 0, 0, 28, 0, 0, 0, 32, 0, 0, 0, 40, 0, 0, 0, 48, 0, 0, 0, 56, 0, 0, 0, 64, 0, 0, 0, 80, 0, 0, 0, 96, 0, 0, 0, 112, 0, 0, 0, 128, 0, 0, 0, 160, 0, 0, 0, 192, 0, 0, 0, 224, 0, 0, 0, 0, 0, 0, 0], ["i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0], ALLOC_STATIC);
_extra_dbits=allocate([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 6, 0, 0, 0, 6, 0, 0, 0, 7, 0, 0, 0, 7, 0, 0, 0, 8, 0, 0, 0, 8, 0, 0, 0, 9, 0, 0, 0, 9, 0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 11, 0, 0, 0, 11, 0, 0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 13, 0, 0, 0, 13, 0, 0, 0], ["i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0], ALLOC_STATIC);
_base_dist=allocate([0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 4, 0, 0, 0, 6, 0, 0, 0, 8, 0, 0, 0, 12, 0, 0, 0, 16, 0, 0, 0, 24, 0, 0, 0, 32, 0, 0, 0, 48, 0, 0, 0, 64, 0, 0, 0, 96, 0, 0, 0, 128, 0, 0, 0, 192, 0, 0, 0, 256, 0, 0, 0, 384, 0, 0, 0, 512, 0, 0, 0, 768, 0, 0, 0, 1024, 0, 0, 0, 1536, 0, 0, 0, 2048, 0, 0, 0, 3072, 0, 0, 0, 4096, 0, 0, 0, 6144, 0, 0, 0, 8192, 0, 0, 0, 12288, 0, 0, 0, 16384, 0, 0, 0, 24576, 0, 0, 0], ["i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0], ALLOC_STATIC);
STRING_TABLE._bl_order=allocate([16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15] /* \10\11\12\00\08\07\0 */, "i8", ALLOC_STATIC);
_extra_blbits=allocate([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 7, 0, 0, 0], ["i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0,"i32",0,0,0], ALLOC_STATIC);
STRING_TABLE.__str4112=allocate([115,116,114,101,97,109,32,101,114,114,111,114,0] /* stream error\00 */, "i8", ALLOC_STATIC);
STRING_TABLE.__str6114=allocate([105,110,115,117,102,102,105,99,105,101,110,116,32,109,101,109,111,114,121,0] /* insufficient memory\ */, "i8", ALLOC_STATIC);
STRING_TABLE.__str7115=allocate([98,117,102,102,101,114,32,101,114,114,111,114,0] /* buffer error\00 */, "i8", ALLOC_STATIC);
__gm_=allocate(468, "i8", ALLOC_STATIC);
_mparams=allocate(24, "i8", ALLOC_STATIC);
HEAP32[((_static_l_desc)>>2)]=((_static_ltree)|0);
HEAP32[(((_static_l_desc)+(4))>>2)]=((_extra_lbits)|0);
HEAP32[((_static_d_desc)>>2)]=((_static_dtree)|0);
HEAP32[(((_static_d_desc)+(4))>>2)]=((_extra_dbits)|0);
HEAP32[(((_static_bl_desc)+(4))>>2)]=((_extra_blbits)|0);

  
  
  var ERRNO_CODES={E2BIG:7,EACCES:13,EADDRINUSE:98,EADDRNOTAVAIL:99,EAFNOSUPPORT:97,EAGAIN:11,EALREADY:114,EBADF:9,EBADMSG:74,EBUSY:16,ECANCELED:125,ECHILD:10,ECONNABORTED:103,ECONNREFUSED:111,ECONNRESET:104,EDEADLK:35,EDESTADDRREQ:89,EDOM:33,EDQUOT:122,EEXIST:17,EFAULT:14,EFBIG:27,EHOSTUNREACH:113,EIDRM:43,EILSEQ:84,EINPROGRESS:115,EINTR:4,EINVAL:22,EIO:5,EISCONN:106,EISDIR:21,ELOOP:40,EMFILE:24,EMLINK:31,EMSGSIZE:90,EMULTIHOP:72,ENAMETOOLONG:36,ENETDOWN:100,ENETRESET:102,ENETUNREACH:101,ENFILE:23,ENOBUFS:105,ENODATA:61,ENODEV:19,ENOENT:2,ENOEXEC:8,ENOLCK:37,ENOLINK:67,ENOMEM:12,ENOMSG:42,ENOPROTOOPT:92,ENOSPC:28,ENOSR:63,ENOSTR:60,ENOSYS:38,ENOTCONN:107,ENOTDIR:20,ENOTEMPTY:39,ENOTRECOVERABLE:131,ENOTSOCK:88,ENOTSUP:95,ENOTTY:25,ENXIO:6,EOVERFLOW:75,EOWNERDEAD:130,EPERM:1,EPIPE:32,EPROTO:71,EPROTONOSUPPORT:93,EPROTOTYPE:91,ERANGE:34,EROFS:30,ESPIPE:29,ESRCH:3,ESTALE:116,ETIME:62,ETIMEDOUT:110,ETXTBSY:26,EWOULDBLOCK:11,EXDEV:18};
  
  function ___setErrNo(value) {
      // For convenient setting and returning of errno.
      if (!___setErrNo.ret) ___setErrNo.ret = allocate([0], 'i32', ALLOC_STATIC);
      HEAP32[((___setErrNo.ret)>>2)]=value
      return value;
    }
  
  var _stdin=0;
  
  var _stdout=0;
  
  var _stderr=0;
  
  var __impure_ptr=0;var FS={currentPath:"/",nextInode:2,streams:[null],ignorePermissions:true,joinPath:function (parts, forceRelative) {
        var ret = parts[0];
        for (var i = 1; i < parts.length; i++) {
          if (ret[ret.length-1] != '/') ret += '/';
          ret += parts[i];
        }
        if (forceRelative && ret[0] == '/') ret = ret.substr(1);
        return ret;
      },absolutePath:function (relative, base) {
        if (typeof relative !== 'string') return null;
        if (base === undefined) base = FS.currentPath;
        if (relative && relative[0] == '/') base = '';
        var full = base + '/' + relative;
        var parts = full.split('/').reverse();
        var absolute = [''];
        while (parts.length) {
          var part = parts.pop();
          if (part == '' || part == '.') {
            // Nothing.
          } else if (part == '..') {
            if (absolute.length > 1) absolute.pop();
          } else {
            absolute.push(part);
          }
        }
        return absolute.length == 1 ? '/' : absolute.join('/');
      },analyzePath:function (path, dontResolveLastLink, linksVisited) {
        var ret = {
          isRoot: false,
          exists: false,
          error: 0,
          name: null,
          path: null,
          object: null,
          parentExists: false,
          parentPath: null,
          parentObject: null
        };
        path = FS.absolutePath(path);
        if (path == '/') {
          ret.isRoot = true;
          ret.exists = ret.parentExists = true;
          ret.name = '/';
          ret.path = ret.parentPath = '/';
          ret.object = ret.parentObject = FS.root;
        } else if (path !== null) {
          linksVisited = linksVisited || 0;
          path = path.slice(1).split('/');
          var current = FS.root;
          var traversed = [''];
          while (path.length) {
            if (path.length == 1 && current.isFolder) {
              ret.parentExists = true;
              ret.parentPath = traversed.length == 1 ? '/' : traversed.join('/');
              ret.parentObject = current;
              ret.name = path[0];
            }
            var target = path.shift();
            if (!current.isFolder) {
              ret.error = ERRNO_CODES.ENOTDIR;
              break;
            } else if (!current.read) {
              ret.error = ERRNO_CODES.EACCES;
              break;
            } else if (!current.contents.hasOwnProperty(target)) {
              ret.error = ERRNO_CODES.ENOENT;
              break;
            }
            current = current.contents[target];
            if (current.link && !(dontResolveLastLink && path.length == 0)) {
              if (linksVisited > 40) { // Usual Linux SYMLOOP_MAX.
                ret.error = ERRNO_CODES.ELOOP;
                break;
              }
              var link = FS.absolutePath(current.link, traversed.join('/'));
              ret = FS.analyzePath([link].concat(path).join('/'),
                                   dontResolveLastLink, linksVisited + 1);
              return ret;
            }
            traversed.push(target);
            if (path.length == 0) {
              ret.exists = true;
              ret.path = traversed.join('/');
              ret.object = current;
            }
          }
        }
        return ret;
      },findObject:function (path, dontResolveLastLink) {
        FS.ensureRoot();
        var ret = FS.analyzePath(path, dontResolveLastLink);
        if (ret.exists) {
          return ret.object;
        } else {
          ___setErrNo(ret.error);
          return null;
        }
      },createObject:function (parent, name, properties, canRead, canWrite) {
        if (!parent) parent = '/';
        if (typeof parent === 'string') parent = FS.findObject(parent);
  
        if (!parent) {
          ___setErrNo(ERRNO_CODES.EACCES);
          throw new Error('Parent path must exist.');
        }
        if (!parent.isFolder) {
          ___setErrNo(ERRNO_CODES.ENOTDIR);
          throw new Error('Parent must be a folder.');
        }
        if (!parent.write && !FS.ignorePermissions) {
          ___setErrNo(ERRNO_CODES.EACCES);
          throw new Error('Parent folder must be writeable.');
        }
        if (!name || name == '.' || name == '..') {
          ___setErrNo(ERRNO_CODES.ENOENT);
          throw new Error('Name must not be empty.');
        }
        if (parent.contents.hasOwnProperty(name)) {
          ___setErrNo(ERRNO_CODES.EEXIST);
          throw new Error("Can't overwrite object.");
        }
  
        parent.contents[name] = {
          read: canRead === undefined ? true : canRead,
          write: canWrite === undefined ? false : canWrite,
          timestamp: Date.now(),
          inodeNumber: FS.nextInode++
        };
        for (var key in properties) {
          if (properties.hasOwnProperty(key)) {
            parent.contents[name][key] = properties[key];
          }
        }
  
        return parent.contents[name];
      },createFolder:function (parent, name, canRead, canWrite) {
        var properties = {isFolder: true, isDevice: false, contents: {}};
        return FS.createObject(parent, name, properties, canRead, canWrite);
      },createPath:function (parent, path, canRead, canWrite) {
        var current = FS.findObject(parent);
        if (current === null) throw new Error('Invalid parent.');
        path = path.split('/').reverse();
        while (path.length) {
          var part = path.pop();
          if (!part) continue;
          if (!current.contents.hasOwnProperty(part)) {
            FS.createFolder(current, part, canRead, canWrite);
          }
          current = current.contents[part];
        }
        return current;
      },createFile:function (parent, name, properties, canRead, canWrite) {
        properties.isFolder = false;
        return FS.createObject(parent, name, properties, canRead, canWrite);
      },createDataFile:function (parent, name, data, canRead, canWrite) {
        if (typeof data === 'string') {
          var dataArray = new Array(data.length);
          for (var i = 0, len = data.length; i < len; ++i) dataArray[i] = data.charCodeAt(i);
          data = dataArray;
        }
        var properties = {
          isDevice: false,
          contents: data.subarray ? data.subarray(0) : data // as an optimization, create a new array wrapper (not buffer) here, to help JS engines understand this object
        };
        return FS.createFile(parent, name, properties, canRead, canWrite);
      },createLazyFile:function (parent, name, url, canRead, canWrite) {
  
        if (typeof XMLHttpRequest !== 'undefined') {
          if (!ENVIRONMENT_IS_WORKER) throw 'Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc';
          // Lazy chunked Uint8Array (implements get and length from Uint8Array). Actual getting is abstracted away for eventual reuse.
          var LazyUint8Array = function(chunkSize, length) {
            this.length = length;
            this.chunkSize = chunkSize;
            this.chunks = []; // Loaded chunks. Index is the chunk number
          }
          LazyUint8Array.prototype.get = function(idx) {
            if (idx > this.length-1 || idx < 0) {
              return undefined;
            }
            var chunkOffset = idx % chunkSize;
            var chunkNum = Math.floor(idx / chunkSize);
            return this.getter(chunkNum)[chunkOffset];
          }
          LazyUint8Array.prototype.setDataGetter = function(getter) {
            this.getter = getter;
          }
    
          // Find length
          var xhr = new XMLHttpRequest();
          xhr.open('HEAD', url, false);
          xhr.send(null);
          if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
          var datalength = Number(xhr.getResponseHeader("Content-length"));
          var header;
          var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
          var chunkSize = 1024*1024; // Chunk size in bytes
          if (!hasByteServing) chunkSize = datalength;
    
          // Function to get a range from the remote URL.
          var doXHR = (function(from, to) {
            if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
            if (to > datalength-1) throw new Error("only " + datalength + " bytes available! programmer error!");
    
            // TODO: Use mozResponseArrayBuffer, responseStream, etc. if available.
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, false);
            if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
    
            // Some hints to the browser that we want binary data.
            if (typeof Uint8Array != 'undefined') xhr.responseType = 'arraybuffer';
            if (xhr.overrideMimeType) {
              xhr.overrideMimeType('text/plain; charset=x-user-defined');
            }
    
            xhr.send(null);
            if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
            if (xhr.response !== undefined) {
              return new Uint8Array(xhr.response || []);
            } else {
              return intArrayFromString(xhr.responseText || '', true);
            }
          });
    
          var lazyArray = new LazyUint8Array(chunkSize, datalength);
          lazyArray.setDataGetter(function(chunkNum) {
            var start = chunkNum * lazyArray.chunkSize;
            var end = (chunkNum+1) * lazyArray.chunkSize - 1; // including this byte
            end = Math.min(end, datalength-1); // if datalength-1 is selected, this is the last block
            if (typeof(lazyArray.chunks[chunkNum]) === "undefined") {
              lazyArray.chunks[chunkNum] = doXHR(start, end);
            }
            if (typeof(lazyArray.chunks[chunkNum]) === "undefined") throw new Error("doXHR failed!");
            return lazyArray.chunks[chunkNum];
          });
          var properties = { isDevice: false, contents: lazyArray };
        } else {
          var properties = { isDevice: false, url: url };
        }
  
        return FS.createFile(parent, name, properties, canRead, canWrite);
      },createPreloadedFile:function (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile) {
        Browser.ensureObjects();
        var fullname = FS.joinPath([parent, name], true);
        function processData(byteArray) {
          function finish(byteArray) {
            if (!dontCreateFile) {
              FS.createDataFile(parent, name, byteArray, canRead, canWrite);
            }
            if (onload) onload();
            removeRunDependency('cp ' + fullname);
          }
          var handled = false;
          Module['preloadPlugins'].forEach(function(plugin) {
            if (handled) return;
            if (plugin['canHandle'](fullname)) {
              plugin['handle'](byteArray, fullname, finish, function() {
                if (onerror) onerror();
                removeRunDependency('cp ' + fullname);
              });
              handled = true;
            }
          });
          if (!handled) finish(byteArray);
        }
        addRunDependency('cp ' + fullname);
        if (typeof url == 'string') {
          Browser.asyncLoad(url, function(byteArray) {
            processData(byteArray);
          }, onerror);
        } else {
          processData(url);
        }
      },createLink:function (parent, name, target, canRead, canWrite) {
        var properties = {isDevice: false, link: target};
        return FS.createFile(parent, name, properties, canRead, canWrite);
      },createDevice:function (parent, name, input, output) {
        if (!(input || output)) {
          throw new Error('A device must have at least one callback defined.');
        }
        var ops = {isDevice: true, input: input, output: output};
        return FS.createFile(parent, name, ops, Boolean(input), Boolean(output));
      },forceLoadFile:function (obj) {
        if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
        var success = true;
        if (typeof XMLHttpRequest !== 'undefined') {
          throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
        } else if (Module['read']) {
          // Command-line.
          try {
            // WARNING: Can't read binary files in V8's d8 or tracemonkey's js, as
            //          read() will try to parse UTF8.
            obj.contents = intArrayFromString(Module['read'](obj.url), true);
          } catch (e) {
            success = false;
          }
        } else {
          throw new Error('Cannot load without read() or XMLHttpRequest.');
        }
        if (!success) ___setErrNo(ERRNO_CODES.EIO);
        return success;
      },ensureRoot:function () {
        if (FS.root) return;
        // The main file system tree. All the contents are inside this.
        FS.root = {
          read: true,
          write: true,
          isFolder: true,
          isDevice: false,
          timestamp: Date.now(),
          inodeNumber: 1,
          contents: {}
        };
      },init:function (input, output, error) {
        // Make sure we initialize only once.
        assert(!FS.init.initialized, 'FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)');
        FS.init.initialized = true;
  
        FS.ensureRoot();
  
        // Allow Module.stdin etc. to provide defaults, if none explicitly passed to us here
        input = input || Module['stdin'];
        output = output || Module['stdout'];
        error = error || Module['stderr'];
  
        // Default handlers.
        var stdinOverridden = true, stdoutOverridden = true, stderrOverridden = true;
        if (!input) {
          stdinOverridden = false;
          input = function() {
            if (!input.cache || !input.cache.length) {
              var result;
              if (typeof window != 'undefined' &&
                  typeof window.prompt == 'function') {
                // Browser.
                result = window.prompt('Input: ');
                if (result === null) result = String.fromCharCode(0); // cancel ==> EOF
              } else if (typeof readline == 'function') {
                // Command line.
                result = readline();
              }
              if (!result) result = '';
              input.cache = intArrayFromString(result + '\n', true);
            }
            return input.cache.shift();
          };
        }
        var utf8 = new Runtime.UTF8Processor();
        function simpleOutput(val) {
          if (val === null || val === '\n'.charCodeAt(0)) {
            output.printer(output.buffer.join(''));
            output.buffer = [];
          } else {
            output.buffer.push(utf8.processCChar(val));
          }
        }
        if (!output) {
          stdoutOverridden = false;
          output = simpleOutput;
        }
        if (!output.printer) output.printer = Module['print'];
        if (!output.buffer) output.buffer = [];
        if (!error) {
          stderrOverridden = false;
          error = simpleOutput;
        }
        if (!error.printer) error.printer = Module['print'];
        if (!error.buffer) error.buffer = [];
  
        // Create the temporary folder, if not already created
        try {
          FS.createFolder('/', 'tmp', true, true);
        } catch(e) {}
  
        // Create the I/O devices.
        var devFolder = FS.createFolder('/', 'dev', true, true);
        var stdin = FS.createDevice(devFolder, 'stdin', input);
        var stdout = FS.createDevice(devFolder, 'stdout', null, output);
        var stderr = FS.createDevice(devFolder, 'stderr', null, error);
        FS.createDevice(devFolder, 'tty', input, output);
  
        // Create default streams.
        FS.streams[1] = {
          path: '/dev/stdin',
          object: stdin,
          position: 0,
          isRead: true,
          isWrite: false,
          isAppend: false,
          isTerminal: !stdinOverridden,
          error: false,
          eof: false,
          ungotten: []
        };
        FS.streams[2] = {
          path: '/dev/stdout',
          object: stdout,
          position: 0,
          isRead: false,
          isWrite: true,
          isAppend: false,
          isTerminal: !stdoutOverridden,
          error: false,
          eof: false,
          ungotten: []
        };
        FS.streams[3] = {
          path: '/dev/stderr',
          object: stderr,
          position: 0,
          isRead: false,
          isWrite: true,
          isAppend: false,
          isTerminal: !stderrOverridden,
          error: false,
          eof: false,
          ungotten: []
        };
        // Allocate these on the stack (and never free, we are called from ATINIT or earlier), to keep their locations low
        _stdin = allocate([1], 'void*', ALLOC_STACK);
        _stdout = allocate([2], 'void*', ALLOC_STACK);
        _stderr = allocate([3], 'void*', ALLOC_STACK);
  
        // Other system paths
        FS.createPath('/', 'dev/shm/tmp', true, true); // temp files
  
        // Newlib initialization
        for (var i = FS.streams.length; i < Math.max(_stdin, _stdout, _stderr) + 4; i++) {
          FS.streams[i] = null; // Make sure to keep FS.streams dense
        }
        FS.streams[_stdin] = FS.streams[1];
        FS.streams[_stdout] = FS.streams[2];
        FS.streams[_stderr] = FS.streams[3];
        __impure_ptr = allocate([ allocate(
          [0, 0, 0, 0, _stdin, 0, 0, 0, _stdout, 0, 0, 0, _stderr, 0, 0, 0],
          'void*', ALLOC_STATIC) ], 'void*', ALLOC_STATIC);
      },quit:function () {
        if (!FS.init.initialized) return;
        // Flush any partially-printed lines in stdout and stderr. Careful, they may have been closed
        if (FS.streams[2] && FS.streams[2].object.output.buffer.length > 0) FS.streams[2].object.output('\n'.charCodeAt(0));
        if (FS.streams[3] && FS.streams[3].object.output.buffer.length > 0) FS.streams[3].object.output('\n'.charCodeAt(0));
      },standardizePath:function (path) {
        if (path.substr(0, 2) == './') path = path.substr(2);
        return path;
      },deleteFile:function (path) {
        var path = FS.analyzePath(path);
        if (!path.parentExists || !path.exists) {
          throw 'Invalid path ' + path;
        }
        delete path.parentObject.contents[path.name];
      }};
  
  
  function _pread(fildes, buf, nbyte, offset) {
      // ssize_t pread(int fildes, void *buf, size_t nbyte, off_t offset);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/read.html
      var stream = FS.streams[fildes];
      if (!stream || stream.object.isDevice) {
        ___setErrNo(ERRNO_CODES.EBADF);
        return -1;
      } else if (!stream.isRead) {
        ___setErrNo(ERRNO_CODES.EACCES);
        return -1;
      } else if (stream.object.isFolder) {
        ___setErrNo(ERRNO_CODES.EISDIR);
        return -1;
      } else if (nbyte < 0 || offset < 0) {
        ___setErrNo(ERRNO_CODES.EINVAL);
        return -1;
      } else {
        var bytesRead = 0;
        while (stream.ungotten.length && nbyte > 0) {
          HEAP8[(buf++)]=stream.ungotten.pop()
          nbyte--;
          bytesRead++;
        }
        var contents = stream.object.contents;
        var size = Math.min(contents.length - offset, nbyte);
        if (contents.subarray || contents.slice) { // typed array or normal array
          for (var i = 0; i < size; i++) {
            HEAP8[((buf)+(i))]=contents[offset + i]
          }
        } else {
          for (var i = 0; i < size; i++) { // LazyUint8Array from sync binary XHR
            HEAP8[((buf)+(i))]=contents.get(offset + i)
          }
        }
        bytesRead += size;
        return bytesRead;
      }
    }function _read(fildes, buf, nbyte) {
      // ssize_t read(int fildes, void *buf, size_t nbyte);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/read.html
      var stream = FS.streams[fildes];
      if (!stream) {
        ___setErrNo(ERRNO_CODES.EBADF);
        return -1;
      } else if (!stream.isRead) {
        ___setErrNo(ERRNO_CODES.EACCES);
        return -1;
      } else if (nbyte < 0) {
        ___setErrNo(ERRNO_CODES.EINVAL);
        return -1;
      } else {
        var bytesRead;
        if (stream.object.isDevice) {
          if (stream.object.input) {
            bytesRead = 0;
            while (stream.ungotten.length && nbyte > 0) {
              HEAP8[(buf++)]=stream.ungotten.pop()
              nbyte--;
              bytesRead++;
            }
            for (var i = 0; i < nbyte; i++) {
              try {
                var result = stream.object.input();
              } catch (e) {
                ___setErrNo(ERRNO_CODES.EIO);
                return -1;
              }
              if (result === null || result === undefined) break;
              bytesRead++;
              HEAP8[((buf)+(i))]=result
            }
            return bytesRead;
          } else {
            ___setErrNo(ERRNO_CODES.ENXIO);
            return -1;
          }
        } else {
          var ungotSize = stream.ungotten.length;
          bytesRead = _pread(fildes, buf, nbyte, stream.position);
          if (bytesRead != -1) {
            stream.position += (stream.ungotten.length - ungotSize) + bytesRead;
          }
          return bytesRead;
        }
      }
    }function _fread(ptr, size, nitems, stream) {
      // size_t fread(void *restrict ptr, size_t size, size_t nitems, FILE *restrict stream);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/fread.html
      var bytesToRead = nitems * size;
      if (bytesToRead == 0) return 0;
      var bytesRead = _read(stream, ptr, bytesToRead);
      var streamObj = FS.streams[stream];
      if (bytesRead == -1) {
        if (streamObj) streamObj.error = true;
        return 0;
      } else {
        if (bytesRead < bytesToRead) streamObj.eof = true;
        return Math.floor(bytesRead / size);
      }
    }

  function _ferror(stream) {
      // int ferror(FILE *stream);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/ferror.html
      return Number(FS.streams[stream] && FS.streams[stream].error);
    }

  function _feof(stream) {
      // int feof(FILE *stream);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/feof.html
      return Number(FS.streams[stream] && FS.streams[stream].eof);
    }

  function ___assert_func(filename, line, func, condition) {
      throw 'Assertion failed: ' + (condition ? Pointer_stringify(condition) : 'unknown condition') + ', at: ' + [filename ? Pointer_stringify(filename) : 'unknown filename', line, func ? Pointer_stringify(func) : 'unknown function'];
    }

  
  
  function _pwrite(fildes, buf, nbyte, offset) {
      // ssize_t pwrite(int fildes, const void *buf, size_t nbyte, off_t offset);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/write.html
      var stream = FS.streams[fildes];
      if (!stream || stream.object.isDevice) {
        ___setErrNo(ERRNO_CODES.EBADF);
        return -1;
      } else if (!stream.isWrite) {
        ___setErrNo(ERRNO_CODES.EACCES);
        return -1;
      } else if (stream.object.isFolder) {
        ___setErrNo(ERRNO_CODES.EISDIR);
        return -1;
      } else if (nbyte < 0 || offset < 0) {
        ___setErrNo(ERRNO_CODES.EINVAL);
        return -1;
      } else {
        var contents = stream.object.contents;
        while (contents.length < offset) contents.push(0);
        for (var i = 0; i < nbyte; i++) {
          contents[offset + i] = HEAPU8[((buf)+(i))];
        }
        stream.object.timestamp = Date.now();
        return i;
      }
    }function _write(fildes, buf, nbyte) {
      // ssize_t write(int fildes, const void *buf, size_t nbyte);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/write.html
      var stream = FS.streams[fildes];
      if (!stream) {
        ___setErrNo(ERRNO_CODES.EBADF);
        return -1;
      } else if (!stream.isWrite) {
        ___setErrNo(ERRNO_CODES.EACCES);
        return -1;
      } else if (nbyte < 0) {
        ___setErrNo(ERRNO_CODES.EINVAL);
        return -1;
      } else {
        if (stream.object.isDevice) {
          if (stream.object.output) {
            for (var i = 0; i < nbyte; i++) {
              try {
                stream.object.output(HEAP8[((buf)+(i))]);
              } catch (e) {
                ___setErrNo(ERRNO_CODES.EIO);
                return -1;
              }
            }
            stream.object.timestamp = Date.now();
            return i;
          } else {
            ___setErrNo(ERRNO_CODES.ENXIO);
            return -1;
          }
        } else {
          var bytesWritten = _pwrite(fildes, buf, nbyte, stream.position);
          if (bytesWritten != -1) stream.position += bytesWritten;
          return bytesWritten;
        }
      }
    }function _fwrite(ptr, size, nitems, stream) {
      // size_t fwrite(const void *restrict ptr, size_t size, size_t nitems, FILE *restrict stream);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/fwrite.html
      var bytesToWrite = nitems * size;
      if (bytesToWrite == 0) return 0;
      var bytesWritten = _write(stream, ptr, bytesToWrite);
      if (bytesWritten == -1) {
        if (FS.streams[stream]) FS.streams[stream].error = true;
        return 0;
      } else {
        return Math.floor(bytesWritten / size);
      }
    }

  
  function _strncmp(px, py, n) {
      var i = 0;
      while (i < n) {
        var x = HEAPU8[((px)+(i))];
        var y = HEAPU8[((py)+(i))];
        if (x == y && x == 0) return 0;
        if (x == 0) return -1;
        if (y == 0) return 1;
        if (x == y) {
          i ++;
          continue;
        } else {
          return x > y ? 1 : -1;
        }
      }
      return 0;
    }function _strcmp(px, py) {
      return _strncmp(px, py, TOTAL_MEMORY);
    }

  
  function _memset(ptr, value, num, align) {
      // TODO: make these settings, and in memcpy, {{'s
      if (num >= 20) {
        // This is unaligned, but quite large, so work hard to get to aligned settings
        var stop = ptr + num;
        while (ptr % 4) { // no need to check for stop, since we have large num
          HEAP8[ptr++] = value;
        }
        if (value < 0) value += 256; // make it unsigned
        var ptr4 = ptr >> 2, stop4 = stop >> 2, value4 = value | (value << 8) | (value << 16) | (value << 24);
        while (ptr4 < stop4) {
          HEAP32[ptr4++] = value4;
        }
        ptr = ptr4 << 2;
        while (ptr < stop) {
          HEAP8[ptr++] = value;
        }
      } else {
        while (num--) {
          HEAP8[ptr++] = value;
        }
      }
    }var _llvm_memset_p0i8_i32=_memset;

  
  function _memcpy(dest, src, num, align) {
      if (num >= 20 && src % 2 == dest % 2) {
        // This is unaligned, but quite large, and potentially alignable, so work hard to get to aligned settings
        if (src % 4 == dest % 4) {
          var stop = src + num;
          while (src % 4) { // no need to check for stop, since we have large num
            HEAP8[dest++] = HEAP8[src++];
          }
          var src4 = src >> 2, dest4 = dest >> 2, stop4 = stop >> 2;
          while (src4 < stop4) {
            HEAP32[dest4++] = HEAP32[src4++];
          }
          src = src4 << 2;
          dest = dest4 << 2;
          while (src < stop) {
            HEAP8[dest++] = HEAP8[src++];
          }
        } else {
          var stop = src + num;
          if (src % 2) { // no need to check for stop, since we have large num
            HEAP8[dest++] = HEAP8[src++];
          }
          var src2 = src >> 1, dest2 = dest >> 1, stop2 = stop >> 1;
          while (src2 < stop2) {
            HEAP16[dest2++] = HEAP16[src2++];
          }
          src = src2 << 1;
          dest = dest2 << 1;
          if (src < stop) {
            HEAP8[dest++] = HEAP8[src++];
          }
        }
      } else {
        while (num--) {
          HEAP8[dest++] = HEAP8[src++];
        }
      }
    }var _llvm_memcpy_p0i8_p0i8_i32=_memcpy;

  function _abort() {
      ABORT = true;
      throw 'abort() at ' + (new Error().stack);
    }

  function _sysconf(name) {
      // long sysconf(int name);
      // http://pubs.opengroup.org/onlinepubs/009695399/functions/sysconf.html
      switch(name) {
        case 8: return PAGE_SIZE;
        case 54:
        case 56:
        case 21:
        case 61:
        case 63:
        case 22:
        case 67:
        case 23:
        case 24:
        case 25:
        case 26:
        case 27:
        case 69:
        case 28:
        case 101:
        case 70:
        case 71:
        case 29:
        case 30:
        case 199:
        case 75:
        case 76:
        case 32:
        case 43:
        case 44:
        case 80:
        case 46:
        case 47:
        case 45:
        case 48:
        case 49:
        case 42:
        case 82:
        case 33:
        case 7:
        case 108:
        case 109:
        case 107:
        case 112:
        case 119:
        case 121:
          return 200809;
        case 13:
        case 104:
        case 94:
        case 95:
        case 34:
        case 35:
        case 77:
        case 81:
        case 83:
        case 84:
        case 85:
        case 86:
        case 87:
        case 88:
        case 89:
        case 90:
        case 91:
        case 94:
        case 95:
        case 110:
        case 111:
        case 113:
        case 114:
        case 115:
        case 116:
        case 117:
        case 118:
        case 120:
        case 40:
        case 16:
        case 79:
        case 19:
          return -1;
        case 92:
        case 93:
        case 5:
        case 72:
        case 6:
        case 74:
        case 92:
        case 93:
        case 96:
        case 97:
        case 98:
        case 99:
        case 102:
        case 103:
        case 105:
          return 1;
        case 38:
        case 66:
        case 50:
        case 51:
        case 4:
          return 1024;
        case 15:
        case 64:
        case 41:
          return 32;
        case 55:
        case 37:
        case 17:
          return 2147483647;
        case 18:
        case 1:
          return 47839;
        case 59:
        case 57:
          return 99;
        case 68:
        case 58:
          return 2048;
        case 0: return 2097152;
        case 3: return 65536;
        case 14: return 32768;
        case 73: return 32767;
        case 39: return 16384;
        case 60: return 1000;
        case 106: return 700;
        case 52: return 256;
        case 62: return 255;
        case 2: return 100;
        case 65: return 64;
        case 36: return 20;
        case 100: return 16;
        case 20: return 6;
        case 53: return 4;
      }
      ___setErrNo(ERRNO_CODES.EINVAL);
      return -1;
    }

  function _time(ptr) {
      var ret = Math.floor(Date.now()/1000);
      if (ptr) {
        HEAP32[((ptr)>>2)]=ret
      }
      return ret;
    }

  
  function ___errno_location() {
      return ___setErrNo.ret;
    }var ___errno=___errno_location;

  function _sbrk(bytes) {
      // Implement a Linux-like 'memory area' for our 'process'.
      // Changes the size of the memory area by |bytes|; returns the
      // address of the previous top ('break') of the memory area
  
      // We need to make sure no one else allocates unfreeable memory!
      // We must control this entirely. So we don't even need to do
      // unfreeable allocations - the HEAP is ours, from STATICTOP up.
      // TODO: We could in theory slice off the top of the HEAP when
      //       sbrk gets a negative increment in |bytes|...
      var self = _sbrk;
      if (!self.called) {
        STATICTOP = alignMemoryPage(STATICTOP); // make sure we start out aligned
        self.called = true;
        _sbrk.DYNAMIC_START = STATICTOP;
      }
      var ret = STATICTOP;
      if (bytes != 0) Runtime.staticAlloc(bytes);
      return ret;  // Previous break location.
    }

  function _llvm_bswap_i32(x) {
      return ((x&0xff)<<24) | (((x>>8)&0xff)<<16) | (((x>>16)&0xff)<<8) | (x>>>24);
    }





  var Browser={mainLoop:{scheduler:null,shouldPause:false,paused:false,queue:[],pause:function () {
          Browser.mainLoop.shouldPause = true;
        },resume:function () {
          if (Browser.mainLoop.paused) {
            Browser.mainLoop.paused = false;
            Browser.mainLoop.scheduler();
          }
          Browser.mainLoop.shouldPause = false;
        },updateStatus:function () {
          if (Module['setStatus']) {
            var message = Module['statusMessage'] || 'Please wait...';
            var remaining = Browser.mainLoop.remainingBlockers;
            var expected = Browser.mainLoop.expectedBlockers;
            if (remaining) {
              if (remaining < expected) {
                Module['setStatus'](message + ' (' + (expected - remaining) + '/' + expected + ')');
              } else {
                Module['setStatus'](message);
              }
            } else {
              Module['setStatus']('');
            }
          }
        }},pointerLock:false,moduleContextCreatedCallbacks:[],workers:[],ensureObjects:function () {
        if (Browser.ensured) return;
        Browser.ensured = true;
        try {
          new Blob();
          Browser.hasBlobConstructor = true;
        } catch(e) {
          Browser.hasBlobConstructor = false;
          console.log("warning: no blob constructor, cannot create blobs with mimetypes");
        }
        Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : (typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : (!Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null));
        Browser.URLObject = typeof window != "undefined" ? (window.URL ? window.URL : window.webkitURL) : console.log("warning: cannot create object URLs");
  
        // Support for plugins that can process preloaded files. You can add more of these to
        // your app by creating and appending to Module.preloadPlugins.
        //
        // Each plugin is asked if it can handle a file based on the file's name. If it can,
        // it is given the file's raw data. When it is done, it calls a callback with the file's
        // (possibly modified) data. For example, a plugin might decompress a file, or it
        // might create some side data structure for use later (like an Image element, etc.).
  
        function getMimetype(name) {
          return {
            'jpg': 'image/jpeg',
            'png': 'image/png',
            'bmp': 'image/bmp',
            'ogg': 'audio/ogg',
            'wav': 'audio/wav',
            'mp3': 'audio/mpeg'
          }[name.substr(-3)];
          return ret;
        }
  
        if (!Module["preloadPlugins"]) Module["preloadPlugins"] = [];
  
        var imagePlugin = {};
        imagePlugin['canHandle'] = function(name) {
          return name.substr(-4) in { '.jpg': 1, '.png': 1, '.bmp': 1 };
        };
        imagePlugin['handle'] = function(byteArray, name, onload, onerror) {
          var b = null;
          if (Browser.hasBlobConstructor) {
            try {
              b = new Blob([byteArray], { type: getMimetype(name) });
            } catch(e) {
              Runtime.warnOnce('Blob constructor present but fails: ' + e + '; falling back to blob builder');
            }
          }
          if (!b) {
            var bb = new Browser.BlobBuilder();
            bb.append((new Uint8Array(byteArray)).buffer); // we need to pass a buffer, and must copy the array to get the right data range
            b = bb.getBlob();
          }
          var url = Browser.URLObject.createObjectURL(b);
          assert(typeof url == 'string', 'createObjectURL must return a url as a string');
          var img = new Image();
          img.onload = function() {
            assert(img.complete, 'Image ' + name + ' could not be decoded');
            var canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            Module["preloadedImages"][name] = canvas;
            Browser.URLObject.revokeObjectURL(url);
            if (onload) onload(byteArray);
          };
          img.onerror = function(event) {
            console.log('Image ' + url + ' could not be decoded');
            if (onerror) onerror();
          };
          img.src = url;
        };
        Module['preloadPlugins'].push(imagePlugin);
  
        var audioPlugin = {};
        audioPlugin['canHandle'] = function(name) {
          return name.substr(-4) in { '.ogg': 1, '.wav': 1, '.mp3': 1 };
        };
        audioPlugin['handle'] = function(byteArray, name, onload, onerror) {
          var done = false;
          function finish(audio) {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = audio;
            if (onload) onload(byteArray);
          }
          function fail() {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = new Audio(); // empty shim
            if (onerror) onerror();
          }
          if (Browser.hasBlobConstructor) {
            try {
              var b = new Blob([byteArray], { type: getMimetype(name) });
            } catch(e) {
              return fail();
            }
            var url = Browser.URLObject.createObjectURL(b); // XXX we never revoke this!
            assert(typeof url == 'string', 'createObjectURL must return a url as a string');
            var audio = new Audio();
            audio.addEventListener('canplaythrough', function() { finish(audio) }, false); // use addEventListener due to chromium bug 124926
            audio.onerror = function(event) {
              if (done) return;
              console.log('warning: browser could not fully decode audio ' + name + ', trying slower base64 approach');
              function encode64(data) {
                var BASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
                var PAD = '=';
                var ret = '';
                var leftchar = 0;
                var leftbits = 0;
                for (var i = 0; i < data.length; i++) {
                  leftchar = (leftchar << 8) | data[i];
                  leftbits += 8;
                  while (leftbits >= 6) {
                    var curr = (leftchar >> (leftbits-6)) & 0x3f;
                    leftbits -= 6;
                    ret += BASE[curr];
                  }
                }
                if (leftbits == 2) {
                  ret += BASE[(leftchar&3) << 4];
                  ret += PAD + PAD;
                } else if (leftbits == 4) {
                  ret += BASE[(leftchar&0xf) << 2];
                  ret += PAD;
                }
                return ret;
              }
              audio.src = 'data:audio/x-' + name.substr(-3) + ';base64,' + encode64(byteArray);
              finish(audio); // we don't wait for confirmation this worked - but it's worth trying
            };
            audio.src = url;
            // workaround for chrome bug 124926 - we do not always get oncanplaythrough or onerror
            setTimeout(function() {
              finish(audio); // try to use it even though it is not necessarily ready to play
            }, 10000);
          } else {
            return fail();
          }
        };
        Module['preloadPlugins'].push(audioPlugin);
      },createContext:function (canvas, useWebGL, setInModule) {
        try {
          var ctx = canvas.getContext(useWebGL ? 'experimental-webgl' : '2d');
          if (!ctx) throw ':(';
        } catch (e) {
          Module.print('Could not create canvas - ' + e);
          return null;
        }
        if (useWebGL) {
          // Set the background of the WebGL canvas to black
          canvas.style.backgroundColor = "black";
  
          // Warn on context loss
          canvas.addEventListener('webglcontextlost', function(event) {
            alert('WebGL context lost. You will need to reload the page.');
          }, false);
        }
        if (setInModule) {
          Module.ctx = ctx;
          Module.useWebGL = useWebGL;
          Browser.moduleContextCreatedCallbacks.forEach(function(callback) { callback() });
        }
        return ctx;
      },requestFullScreen:function () {
        var canvas = Module['canvas'];
        function fullScreenChange() {
          var isFullScreen = false;
          if ((document['webkitFullScreenElement'] || document['webkitFullscreenElement'] ||
               document['mozFullScreenElement'] || document['mozFullscreenElement'] ||
               document['fullScreenElement'] || document['fullscreenElement']) === canvas) {
            canvas.requestPointerLock = canvas['requestPointerLock'] ||
                                        canvas['mozRequestPointerLock'] ||
                                        canvas['webkitRequestPointerLock'];
            canvas.requestPointerLock();
            isFullScreen = true;
          }
          if (Module['onFullScreen']) Module['onFullScreen'](isFullScreen);
        }
  
        document.addEventListener('fullscreenchange', fullScreenChange, false);
        document.addEventListener('mozfullscreenchange', fullScreenChange, false);
        document.addEventListener('webkitfullscreenchange', fullScreenChange, false);
  
        function pointerLockChange() {
          Browser.pointerLock = document['pointerLockElement'] === canvas ||
                                document['mozPointerLockElement'] === canvas ||
                                document['webkitPointerLockElement'] === canvas;
        }
  
        document.addEventListener('pointerlockchange', pointerLockChange, false);
        document.addEventListener('mozpointerlockchange', pointerLockChange, false);
        document.addEventListener('webkitpointerlockchange', pointerLockChange, false);
  
        canvas.requestFullScreen = canvas['requestFullScreen'] ||
                                   canvas['mozRequestFullScreen'] ||
                                   (canvas['webkitRequestFullScreen'] ? function() { canvas['webkitRequestFullScreen'](Element['ALLOW_KEYBOARD_INPUT']) } : null);
        canvas.requestFullScreen(); 
      },requestAnimationFrame:function (func) {
        if (!window.requestAnimationFrame) {
          window.requestAnimationFrame = window['requestAnimationFrame'] ||
                                         window['mozRequestAnimationFrame'] ||
                                         window['webkitRequestAnimationFrame'] ||
                                         window['msRequestAnimationFrame'] ||
                                         window['oRequestAnimationFrame'] ||
                                         window['setTimeout'];
        }
        window.requestAnimationFrame(func);
      },getMovementX:function (event) {
        return event['movementX'] ||
               event['mozMovementX'] ||
               event['webkitMovementX'] ||
               0;
      },getMovementY:function (event) {
        return event['movementY'] ||
               event['mozMovementY'] ||
               event['webkitMovementY'] ||
               0;
      },xhrLoad:function (url, onload, onerror) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = function() {
          if (xhr.status == 200) {
            onload(xhr.response);
          } else {
            onerror();
          }
        };
        xhr.onerror = onerror;
        xhr.send(null);
      },asyncLoad:function (url, onload, onerror) {
        Browser.xhrLoad(url, function(arrayBuffer) {
          assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
          onload(new Uint8Array(arrayBuffer));
          removeRunDependency('al ' + url);
        }, function(event) {
          if (onerror) {
            onerror();
          } else {
            throw 'Loading data file "' + url + '" failed.';
          }
        });
        addRunDependency('al ' + url);
      },resizeListeners:[],updateResizeListeners:function () {
        var canvas = Module['canvas'];
        Browser.resizeListeners.forEach(function(listener) {
          listener(canvas.width, canvas.height);
        });
      },setCanvasSize:function (width, height, noUpdates) {
        var canvas = Module['canvas'];
        canvas.width = width;
        canvas.height = height;
        if (!noUpdates) Browser.updateResizeListeners();
      }};
__ATINIT__.unshift({ func: function() { if (!Module["noFSInit"] && !FS.init.initialized) FS.init() } });__ATMAIN__.push({ func: function() { FS.ignorePermissions = false } });__ATEXIT__.push({ func: function() { FS.quit() } });Module["FS_createFolder"] = FS.createFolder;Module["FS_createPath"] = FS.createPath;Module["FS_createDataFile"] = FS.createDataFile;Module["FS_createPreloadedFile"] = FS.createPreloadedFile;Module["FS_createLazyFile"] = FS.createLazyFile;Module["FS_createLink"] = FS.createLink;Module["FS_createDevice"] = FS.createDevice;
___setErrNo(0);
Module["requestFullScreen"] = function() { Browser.requestFullScreen() };
  Module["requestAnimationFrame"] = function(func) { Browser.requestAnimationFrame(func) };
  Module["pauseMainLoop"] = function() { Browser.mainLoop.pause() };
  Module["resumeMainLoop"] = function() { Browser.mainLoop.resume() };
  

// Note: For maximum-speed code, see "Optimizing Code" on the Emscripten wiki, https://github.com/kripken/emscripten/wiki/Optimizing-Code
// Note: Some Emscripten settings may limit the speed of the generated code.

function _adler32($adler, $buf, $len) {
  var label;
  var $1 = $adler >>> 16;
  var $2 = $adler & 65535;
  if (($len | 0) == 1) {
    var $7 = (HEAP8[$buf] & 255) + $2 | 0;
    var $_ = $7 >>> 0 > 65520 ? $7 - 65521 | 0 : $7;
    var $10 = $_ + $1 | 0;
    var $_0 = ($10 >>> 0 > 65520 ? $10 + 15 | 0 : $10) << 16 | $_;
    var $_0;
    return $_0;
  }
  if (($buf | 0) == 0) {
    var $_0 = 1;
    var $_0;
    return $_0;
  }
  if ($len >>> 0 < 16) {
    var $19 = ($len | 0) == 0;
    L10 : do {
      if ($19) {
        var $sum2_1_lcssa = $1;
        var $_1_lcssa = $2;
      } else {
        var $sum2_140 = $1;
        var $_0741 = $len;
        var $_0242 = $buf;
        var $_143 = $2;
        while (1) {
          var $_143;
          var $_0242;
          var $_0741;
          var $sum2_140;
          var $21 = $_0741 - 1 | 0;
          var $25 = (HEAP8[$_0242] & 255) + $_143 | 0;
          var $26 = $25 + $sum2_140 | 0;
          if (($21 | 0) == 0) {
            var $sum2_1_lcssa = $26;
            var $_1_lcssa = $25;
            break L10;
          } else {
            var $sum2_140 = $26;
            var $_0741 = $21;
            var $_0242 = $_0242 + 1 | 0;
            var $_143 = $25;
          }
        }
      }
    } while (0);
    var $_1_lcssa;
    var $sum2_1_lcssa;
    var $_0 = ($sum2_1_lcssa >>> 0) % 65521 << 16 | ($_1_lcssa >>> 0 > 65520 ? $_1_lcssa - 65521 | 0 : $_1_lcssa);
    var $_0;
    return $_0;
  }
  do {
    if ($len >>> 0 > 5551) {
      var $sum2_229 = $1;
      var $_1830 = $len;
      var $_1331 = $buf;
      var $_332 = $2;
      while (1) {
        var $_332;
        var $_1331;
        var $_1830;
        var $sum2_229;
        var $33 = $_1830 - 5552 | 0;
        var $_4 = $_332;
        var $_24 = $_1331;
        var $sum2_3 = $sum2_229;
        var $n_0 = 347;
        while (1) {
          var $n_0;
          var $sum2_3;
          var $_24;
          var $_4;
          var $37 = (HEAP8[$_24] & 255) + $_4 | 0;
          var $41 = $37 + (HEAP8[$_24 + 1 | 0] & 255) | 0;
          var $45 = $41 + (HEAP8[$_24 + 2 | 0] & 255) | 0;
          var $49 = $45 + (HEAP8[$_24 + 3 | 0] & 255) | 0;
          var $53 = $49 + (HEAP8[$_24 + 4 | 0] & 255) | 0;
          var $57 = $53 + (HEAP8[$_24 + 5 | 0] & 255) | 0;
          var $61 = $57 + (HEAP8[$_24 + 6 | 0] & 255) | 0;
          var $65 = $61 + (HEAP8[$_24 + 7 | 0] & 255) | 0;
          var $69 = $65 + (HEAP8[$_24 + 8 | 0] & 255) | 0;
          var $73 = $69 + (HEAP8[$_24 + 9 | 0] & 255) | 0;
          var $77 = $73 + (HEAP8[$_24 + 10 | 0] & 255) | 0;
          var $81 = $77 + (HEAP8[$_24 + 11 | 0] & 255) | 0;
          var $85 = $81 + (HEAP8[$_24 + 12 | 0] & 255) | 0;
          var $89 = $85 + (HEAP8[$_24 + 13 | 0] & 255) | 0;
          var $93 = $89 + (HEAP8[$_24 + 14 | 0] & 255) | 0;
          var $97 = $93 + (HEAP8[$_24 + 15 | 0] & 255) | 0;
          var $113 = $37 + $sum2_3 + $41 + $45 + $49 + $53 + $57 + $61 + $65 + $69 + $73 + $77 + $81 + $85 + $89 + $93 + $97 | 0;
          var $115 = $n_0 - 1 | 0;
          if (($115 | 0) == 0) {
            break;
          } else {
            var $_4 = $97;
            var $_24 = $_24 + 16 | 0;
            var $sum2_3 = $113;
            var $n_0 = $115;
          }
        }
        var $scevgep = $_1331 + 5552 | 0;
        var $118 = ($97 >>> 0) % 65521;
        var $119 = ($113 >>> 0) % 65521;
        if ($33 >>> 0 > 5551) {
          var $sum2_229 = $119;
          var $_1830 = $33;
          var $_1331 = $scevgep;
          var $_332 = $118;
        } else {
          break;
        }
      }
      if (($33 | 0) == 0) {
        var $_7 = $118;
        var $sum2_6 = $119;
        break;
      }
      if ($33 >>> 0 > 15) {
        var $sum2_417 = $119;
        var $_2918 = $33;
        var $_3519 = $scevgep;
        var $_520 = $118;
        label = 15;
        break;
      } else {
        var $sum2_511 = $119;
        var $_31012 = $33;
        var $_4613 = $scevgep;
        var $_614 = $118;
        label = 16;
        break;
      }
    } else {
      var $sum2_417 = $1;
      var $_2918 = $len;
      var $_3519 = $buf;
      var $_520 = $2;
      label = 15;
    }
  } while (0);
  do {
    if (label == 15) {
      while (1) {
        label = 0;
        var $_520;
        var $_3519;
        var $_2918;
        var $sum2_417;
        var $124 = $_2918 - 16 | 0;
        var $127 = (HEAP8[$_3519] & 255) + $_520 | 0;
        var $131 = $127 + (HEAP8[$_3519 + 1 | 0] & 255) | 0;
        var $135 = $131 + (HEAP8[$_3519 + 2 | 0] & 255) | 0;
        var $139 = $135 + (HEAP8[$_3519 + 3 | 0] & 255) | 0;
        var $143 = $139 + (HEAP8[$_3519 + 4 | 0] & 255) | 0;
        var $147 = $143 + (HEAP8[$_3519 + 5 | 0] & 255) | 0;
        var $151 = $147 + (HEAP8[$_3519 + 6 | 0] & 255) | 0;
        var $155 = $151 + (HEAP8[$_3519 + 7 | 0] & 255) | 0;
        var $159 = $155 + (HEAP8[$_3519 + 8 | 0] & 255) | 0;
        var $163 = $159 + (HEAP8[$_3519 + 9 | 0] & 255) | 0;
        var $167 = $163 + (HEAP8[$_3519 + 10 | 0] & 255) | 0;
        var $171 = $167 + (HEAP8[$_3519 + 11 | 0] & 255) | 0;
        var $175 = $171 + (HEAP8[$_3519 + 12 | 0] & 255) | 0;
        var $179 = $175 + (HEAP8[$_3519 + 13 | 0] & 255) | 0;
        var $183 = $179 + (HEAP8[$_3519 + 14 | 0] & 255) | 0;
        var $187 = $183 + (HEAP8[$_3519 + 15 | 0] & 255) | 0;
        var $203 = $127 + $sum2_417 + $131 + $135 + $139 + $143 + $147 + $151 + $155 + $159 + $163 + $167 + $171 + $175 + $179 + $183 + $187 | 0;
        var $204 = $_3519 + 16 | 0;
        if ($124 >>> 0 > 15) {
          var $sum2_417 = $203;
          var $_2918 = $124;
          var $_3519 = $204;
          var $_520 = $187;
          label = 15;
        } else {
          break;
        }
      }
      if (($124 | 0) == 0) {
        var $sum2_5_lcssa = $203;
        var $_6_lcssa = $187;
        label = 17;
        break;
      } else {
        var $sum2_511 = $203;
        var $_31012 = $124;
        var $_4613 = $204;
        var $_614 = $187;
        label = 16;
        break;
      }
    }
  } while (0);
  L28 : do {
    if (label == 16) {
      while (1) {
        label = 0;
        var $_614;
        var $_4613;
        var $_31012;
        var $sum2_511;
        var $206 = $_31012 - 1 | 0;
        var $210 = (HEAP8[$_4613] & 255) + $_614 | 0;
        var $211 = $210 + $sum2_511 | 0;
        if (($206 | 0) == 0) {
          var $sum2_5_lcssa = $211;
          var $_6_lcssa = $210;
          label = 17;
          break L28;
        } else {
          var $sum2_511 = $211;
          var $_31012 = $206;
          var $_4613 = $_4613 + 1 | 0;
          var $_614 = $210;
          label = 16;
        }
      }
    }
  } while (0);
  if (label == 17) {
    var $_6_lcssa;
    var $sum2_5_lcssa;
    var $_7 = ($_6_lcssa >>> 0) % 65521;
    var $sum2_6 = ($sum2_5_lcssa >>> 0) % 65521;
  }
  var $sum2_6;
  var $_7;
  var $_0 = $_7 | $sum2_6 << 16;
  var $_0;
  return $_0;
}
_adler32["X"] = 1;
function _crc32_little($crc, $buf, $len) {
  var $buf4_011$s2;
  var label;
  var $_0 = $buf;
  var $_01 = $len;
  var $c_0 = $crc ^ -1;
  while (1) {
    var $c_0;
    var $_01;
    var $_0;
    if (($_01 | 0) == 0) {
      var $c_4 = $c_0;
      label = 37;
      break;
    }
    if (($_0 & 3 | 0) == 0) {
      break;
    }
    var $16 = HEAP32[_crc_table + ((HEAP8[$_0] & 255 ^ $c_0 & 255) << 2) >> 2] ^ $c_0 >>> 8;
    var $_0 = $_0 + 1 | 0;
    var $_01 = $_01 - 1 | 0;
    var $c_0 = $16;
  }
  if (label == 37) {
    var $c_4;
    var $218 = $c_4 ^ -1;
    return $218;
  }
  var $18 = $_0;
  var $19 = $_01 >>> 0 > 31;
  L43 : do {
    if ($19) {
      var $c_19 = $c_0;
      var $_1210 = $_01;
      var $buf4_011 = $18, $buf4_011$s2 = $buf4_011 >> 2;
      while (1) {
        var $buf4_011;
        var $_1210;
        var $c_19;
        var $23 = HEAP32[$buf4_011$s2] ^ $c_19;
        var $43 = HEAP32[_crc_table + (($23 >>> 8 & 255) << 2) + 2048 >> 2] ^ HEAP32[_crc_table + (($23 & 255) << 2) + 3072 >> 2] ^ HEAP32[_crc_table + (($23 >>> 16 & 255) << 2) + 1024 >> 2] ^ HEAP32[_crc_table + ($23 >>> 24 << 2) >> 2] ^ HEAP32[$buf4_011$s2 + 1];
        var $63 = HEAP32[_crc_table + (($43 >>> 8 & 255) << 2) + 2048 >> 2] ^ HEAP32[_crc_table + (($43 & 255) << 2) + 3072 >> 2] ^ HEAP32[_crc_table + (($43 >>> 16 & 255) << 2) + 1024 >> 2] ^ HEAP32[_crc_table + ($43 >>> 24 << 2) >> 2] ^ HEAP32[$buf4_011$s2 + 2];
        var $83 = HEAP32[_crc_table + (($63 >>> 8 & 255) << 2) + 2048 >> 2] ^ HEAP32[_crc_table + (($63 & 255) << 2) + 3072 >> 2] ^ HEAP32[_crc_table + (($63 >>> 16 & 255) << 2) + 1024 >> 2] ^ HEAP32[_crc_table + ($63 >>> 24 << 2) >> 2] ^ HEAP32[$buf4_011$s2 + 3];
        var $103 = HEAP32[_crc_table + (($83 >>> 8 & 255) << 2) + 2048 >> 2] ^ HEAP32[_crc_table + (($83 & 255) << 2) + 3072 >> 2] ^ HEAP32[_crc_table + (($83 >>> 16 & 255) << 2) + 1024 >> 2] ^ HEAP32[_crc_table + ($83 >>> 24 << 2) >> 2] ^ HEAP32[$buf4_011$s2 + 4];
        var $123 = HEAP32[_crc_table + (($103 >>> 8 & 255) << 2) + 2048 >> 2] ^ HEAP32[_crc_table + (($103 & 255) << 2) + 3072 >> 2] ^ HEAP32[_crc_table + (($103 >>> 16 & 255) << 2) + 1024 >> 2] ^ HEAP32[_crc_table + ($103 >>> 24 << 2) >> 2] ^ HEAP32[$buf4_011$s2 + 5];
        var $143 = HEAP32[_crc_table + (($123 >>> 8 & 255) << 2) + 2048 >> 2] ^ HEAP32[_crc_table + (($123 & 255) << 2) + 3072 >> 2] ^ HEAP32[_crc_table + (($123 >>> 16 & 255) << 2) + 1024 >> 2] ^ HEAP32[_crc_table + ($123 >>> 24 << 2) >> 2] ^ HEAP32[$buf4_011$s2 + 6];
        var $158 = $buf4_011 + 32 | 0;
        var $163 = HEAP32[_crc_table + (($143 >>> 8 & 255) << 2) + 2048 >> 2] ^ HEAP32[_crc_table + (($143 & 255) << 2) + 3072 >> 2] ^ HEAP32[_crc_table + (($143 >>> 16 & 255) << 2) + 1024 >> 2] ^ HEAP32[_crc_table + ($143 >>> 24 << 2) >> 2] ^ HEAP32[$buf4_011$s2 + 7];
        var $180 = HEAP32[_crc_table + (($163 >>> 8 & 255) << 2) + 2048 >> 2] ^ HEAP32[_crc_table + (($163 & 255) << 2) + 3072 >> 2] ^ HEAP32[_crc_table + (($163 >>> 16 & 255) << 2) + 1024 >> 2] ^ HEAP32[_crc_table + ($163 >>> 24 << 2) >> 2];
        var $181 = $_1210 - 32 | 0;
        if ($181 >>> 0 > 31) {
          var $c_19 = $180;
          var $_1210 = $181;
          var $buf4_011 = $158, $buf4_011$s2 = $buf4_011 >> 2;
        } else {
          var $c_1_lcssa = $180;
          var $_12_lcssa = $181;
          var $buf4_0_lcssa = $158;
          break L43;
        }
      }
    } else {
      var $c_1_lcssa = $c_0;
      var $_12_lcssa = $_01;
      var $buf4_0_lcssa = $18;
    }
  } while (0);
  var $buf4_0_lcssa;
  var $_12_lcssa;
  var $c_1_lcssa;
  var $20 = $_12_lcssa >>> 0 > 3;
  L47 : do {
    if ($20) {
      var $c_24 = $c_1_lcssa;
      var $_25 = $_12_lcssa;
      var $buf4_16 = $buf4_0_lcssa;
      while (1) {
        var $buf4_16;
        var $_25;
        var $c_24;
        var $183 = $buf4_16 + 4 | 0;
        var $185 = HEAP32[$buf4_16 >> 2] ^ $c_24;
        var $202 = HEAP32[_crc_table + (($185 >>> 8 & 255) << 2) + 2048 >> 2] ^ HEAP32[_crc_table + (($185 & 255) << 2) + 3072 >> 2] ^ HEAP32[_crc_table + (($185 >>> 16 & 255) << 2) + 1024 >> 2] ^ HEAP32[_crc_table + ($185 >>> 24 << 2) >> 2];
        var $203 = $_25 - 4 | 0;
        if ($203 >>> 0 > 3) {
          var $c_24 = $202;
          var $_25 = $203;
          var $buf4_16 = $183;
        } else {
          var $c_2_lcssa = $202;
          var $_2_lcssa = $203;
          var $buf4_1_lcssa = $183;
          break L47;
        }
      }
    } else {
      var $c_2_lcssa = $c_1_lcssa;
      var $_2_lcssa = $_12_lcssa;
      var $buf4_1_lcssa = $buf4_0_lcssa;
    }
  } while (0);
  var $buf4_1_lcssa;
  var $_2_lcssa;
  var $c_2_lcssa;
  if (($_2_lcssa | 0) == 0) {
    var $c_4 = $c_2_lcssa;
    var $c_4;
    var $218 = $c_4 ^ -1;
    return $218;
  }
  var $_1 = $buf4_1_lcssa;
  var $_3 = $_2_lcssa;
  var $c_3 = $c_2_lcssa;
  while (1) {
    var $c_3;
    var $_3;
    var $_1;
    var $215 = HEAP32[_crc_table + ((HEAP8[$_1] & 255 ^ $c_3 & 255) << 2) >> 2] ^ $c_3 >>> 8;
    var $216 = $_3 - 1 | 0;
    if (($216 | 0) == 0) {
      var $c_4 = $215;
      break;
    } else {
      var $_1 = $_1 + 1 | 0;
      var $_3 = $216;
      var $c_3 = $215;
    }
  }
  var $c_4;
  var $218 = $c_4 ^ -1;
  return $218;
}
_crc32_little["X"] = 1;
function _def($source, $dest, $level, $zlib_header) {
  var $11$s2;
  var $strm$s2;
  var __stackBase__ = STACKTOP;
  STACKTOP += 32824;
  var label;
  var $strm = __stackBase__, $strm$s2 = $strm >> 2;
  HEAP32[$strm$s2 + 8] = 0;
  HEAP32[$strm$s2 + 9] = 0;
  HEAP32[$strm$s2 + 10] = 0;
  var $5 = $strm;
  var $6 = _deflateInit2_($5, $level, $zlib_header * 15 | 0);
  if (($6 | 0) != 0) {
    var $_0 = $6;
    var $_0;
    STACKTOP = __stackBase__;
    return $_0;
  }
  var $8 = __stackBase__ + 56 | 0;
  var $9 = $strm + 4 | 0;
  var $10 = $strm | 0;
  var $11$s2 = ($strm + 16 | 0) >> 2;
  var $12 = __stackBase__ + 16440 | 0;
  var $13 = $strm + 12 | 0;
  L61 : while (1) {
    HEAP32[$9 >> 2] = _fread($8, 1, 16384, $source);
    if ((_ferror($source) | 0) != 0) {
      label = 42;
      break;
    }
    var $21 = (_feof($source) | 0) != 0;
    var $22 = $21 ? 4 : 0;
    HEAP32[$10 >> 2] = $8;
    while (1) {
      HEAP32[$11$s2] = 16384;
      HEAP32[$13 >> 2] = $12;
      var $24 = _deflate($5, $22);
      if (($24 | 0) == -2) {
        ___assert_func(STRING_TABLE.__str1 | 0, 73, STRING_TABLE.___func___def | 0, STRING_TABLE.__str2 | 0);
      }
      var $29 = 16384 - HEAP32[$11$s2] | 0;
      if ((_fwrite($12, 1, $29, $dest) | 0) != ($29 | 0)) {
        label = 48;
        break L61;
      }
      if ((_ferror($dest) | 0) != 0) {
        label = 48;
        break L61;
      }
      if ((HEAP32[$11$s2] | 0) != 0) {
        break;
      }
    }
    if ((HEAP32[$9 >> 2] | 0) != 0) {
      ___assert_func(STRING_TABLE.__str1 | 0, 80, STRING_TABLE.___func___def | 0, STRING_TABLE.__str3 | 0);
    }
    if ($21) {
      label = 53;
      break;
    }
  }
  if (label == 42) {
    _deflateEnd($5);
    var $_0 = -1;
    var $_0;
    STACKTOP = __stackBase__;
    return $_0;
  } else if (label == 48) {
    _deflateEnd($5);
    var $_0 = -1;
    var $_0;
    STACKTOP = __stackBase__;
    return $_0;
  } else if (label == 53) {
    if (($24 | 0) != 1) {
      ___assert_func(STRING_TABLE.__str1 | 0, 84, STRING_TABLE.___func___def | 0, STRING_TABLE.__str4 | 0);
    }
    _deflateEnd($5);
    var $_0 = 0;
    var $_0;
    STACKTOP = __stackBase__;
    return $_0;
  }
}
_def["X"] = 1;
function _inf($source, $dest, $zlib_header) {
  var $11$s2;
  var $strm$s2;
  var __stackBase__ = STACKTOP;
  STACKTOP += 32824;
  var label;
  var $strm = __stackBase__, $strm$s2 = $strm >> 2;
  HEAP32[$strm$s2 + 8] = 0;
  HEAP32[$strm$s2 + 9] = 0;
  HEAP32[$strm$s2 + 10] = 0;
  var $4 = $strm + 4 | 0;
  HEAP32[$4 >> 2] = 0;
  var $5 = $strm | 0;
  HEAP32[$5 >> 2] = 0;
  var $7 = $strm;
  var $8 = _inflateInit2_($7, $zlib_header * 15 | 0);
  if (($8 | 0) != 0) {
    var $_0 = $8;
    var $_0;
    STACKTOP = __stackBase__;
    return $_0;
  }
  var $10 = __stackBase__ + 56 | 0;
  var $11$s2 = ($strm + 16 | 0) >> 2;
  var $12 = __stackBase__ + 16440 | 0;
  var $13 = $strm + 12 | 0;
  var $ret_0 = 0;
  L89 : while (1) {
    var $ret_0;
    var $15 = _fread($10, 1, 16384, $source);
    HEAP32[$4 >> 2] = $15;
    if ((_ferror($source) | 0) != 0) {
      label = 64;
      break;
    }
    if (($15 | 0) == 0) {
      var $ret_2 = $ret_0;
      label = 76;
      break;
    }
    HEAP32[$5 >> 2] = $10;
    while (1) {
      HEAP32[$11$s2] = 16384;
      HEAP32[$13 >> 2] = $12;
      var $23 = _inflate($7);
      if (($23 | 0) == -2) {
        ___assert_func(STRING_TABLE.__str1 | 0, 131, STRING_TABLE.___func___inf | 0, STRING_TABLE.__str2 | 0);
      } else if (($23 | 0) == 2) {
        label = 69;
        break L89;
      } else if (($23 | 0) == -3 || ($23 | 0) == -4) {
        var $ret_1 = $23;
        break L89;
      }
      var $27 = 16384 - HEAP32[$11$s2] | 0;
      if ((_fwrite($12, 1, $27, $dest) | 0) != ($27 | 0)) {
        label = 73;
        break L89;
      }
      if ((_ferror($dest) | 0) != 0) {
        label = 73;
        break L89;
      }
      if ((HEAP32[$11$s2] | 0) != 0) {
        break;
      }
    }
    if (($23 | 0) == 1) {
      var $ret_2 = 1;
      label = 76;
      break;
    } else {
      var $ret_0 = $23;
    }
  }
  if (label == 64) {
    _inflateEnd($7);
    var $_0 = -1;
    var $_0;
    STACKTOP = __stackBase__;
    return $_0;
  } else if (label == 69) {
    var $ret_1 = -3;
  } else if (label == 73) {
    _inflateEnd($7);
    var $_0 = -1;
    var $_0;
    STACKTOP = __stackBase__;
    return $_0;
  } else if (label == 76) {
    var $ret_2;
    _inflateEnd($7);
    var $_0 = ($ret_2 | 0) == 1 ? 0 : -3;
    var $_0;
    STACKTOP = __stackBase__;
    return $_0;
  }
  var $ret_1;
  _inflateEnd($7);
  var $_0 = $ret_1;
  var $_0;
  STACKTOP = __stackBase__;
  return $_0;
}
_inf["X"] = 1;
function _zerr($ret) {
  _fwrite(STRING_TABLE.__str5 | 0, 7, 1, HEAP32[_stderr >> 2]);
  if (($ret | 0) == -1) {
    if ((_ferror(HEAP32[_stdin >> 2]) | 0) != 0) {
      _fwrite(STRING_TABLE.__str6 | 0, 20, 1, HEAP32[_stderr >> 2]);
    }
    if ((_ferror(HEAP32[_stdout >> 2]) | 0) == 0) {
      return;
    }
    _fwrite(STRING_TABLE.__str7 | 0, 21, 1, HEAP32[_stderr >> 2]);
    return;
  } else if (($ret | 0) == -2) {
    _fwrite(STRING_TABLE.__str8 | 0, 26, 1, HEAP32[_stderr >> 2]);
    return;
  } else if (($ret | 0) == -3) {
    _fwrite(STRING_TABLE.__str9 | 0, 35, 1, HEAP32[_stderr >> 2]);
    return;
  } else if (($ret | 0) == -4) {
    _fwrite(STRING_TABLE.__str10 | 0, 14, 1, HEAP32[_stderr >> 2]);
    return;
  } else if (($ret | 0) == -6) {
    _fwrite(STRING_TABLE.__str11 | 0, 23, 1, HEAP32[_stderr >> 2]);
    return;
  } else {
    return;
  }
}
function _main($argc, $argv) {
  var $argv$s2 = $argv >> 2;
  do {
    if (($argc | 0) == 3) {
      if ((_strcmp(HEAP32[$argv$s2 + 1], STRING_TABLE.__str14 | 0) | 0) != 0) {
        break;
      }
      var $35 = (_strcmp(HEAP32[$argv$s2 + 2], STRING_TABLE.__str13 | 0) | 0) == 0 ? 1 : -1;
      var $38 = _inf(HEAP32[_stdin >> 2], HEAP32[_stdout >> 2], $35);
      if (($38 | 0) == 0) {
        var $_0 = 0;
        var $_0;
        return $_0;
      }
      _zerr($38);
      var $_0 = $38;
      var $_0;
      return $_0;
    } else if (($argc | 0) == 4) {
      if ((_strcmp(HEAP32[$argv$s2 + 1], STRING_TABLE.__str12 | 0) | 0) != 0) {
        break;
      }
      var $11 = (_strcmp(HEAP32[$argv$s2 + 3], STRING_TABLE.__str13 | 0) | 0) == 0 ? 1 : -1;
      var $15 = HEAP8[HEAP32[$argv$s2 + 2]] - 48 & 255;
      var $level_0 = $15 << 24 >> 24 < 0 ? 0 : $15;
      var $22 = _def(HEAP32[_stdin >> 2], HEAP32[_stdout >> 2], $level_0 << 24 >> 24 > 9 ? 9 : $level_0 << 24 >> 24, $11);
      if (($22 | 0) == 0) {
        var $_0 = 0;
        var $_0;
        return $_0;
      }
      _zerr($22);
      var $_0 = $22;
      var $_0;
      return $_0;
    }
  } while (0);
  _fwrite(STRING_TABLE.__str15 | 0, 40, 1, HEAP32[_stderr >> 2]);
  var $_0 = 1;
  var $_0;
  return $_0;
}
Module["_main"] = _main;
function _crc32($crc, $buf, $len) {
  if (($buf | 0) == 0) {
    var $_0 = 0;
  } else {
    var $_0 = _crc32_little($crc, $buf, $len);
  }
  var $_0;
  return $_0;
}
function _deflateInit2_($strm, $level, $windowBits) {
  var $31$s2;
  var $29$s2;
  var $4$s2;
  if (($strm | 0) == 0) {
    var $_0 = -2;
    var $_0;
    return $_0;
  }
  var $3 = $strm + 24 | 0;
  HEAP32[$3 >> 2] = 0;
  var $4$s2 = ($strm + 32 | 0) >> 2;
  var $5 = HEAP32[$4$s2];
  if (($5 | 0) == 0) {
    HEAP32[$4$s2] = 4;
    HEAP32[$strm + 40 >> 2] = 0;
    var $10 = 4;
  } else {
    var $10 = $5;
  }
  var $10;
  var $11 = $strm + 36 | 0;
  if ((HEAP32[$11 >> 2] | 0) == 0) {
    HEAP32[$11 >> 2] = 10;
  }
  var $_08 = ($level | 0) == -1 ? 6 : $level;
  do {
    if (($windowBits | 0) < 0) {
      var $wrap_0 = 0;
      var $_09 = -$windowBits | 0;
    } else {
      var $22 = ($windowBits | 0) > 15;
      var $_windowBits = $22 ? $windowBits - 16 | 0 : $windowBits;
      if (!$22) {
        var $wrap_0 = 1;
        var $_09 = $_windowBits;
        break;
      }
      var $wrap_0 = 2;
      var $_09 = $_windowBits;
    }
  } while (0);
  var $_09;
  var $wrap_0;
  if (($_09 - 8 | 0) >>> 0 > 7 | $_08 >>> 0 > 9) {
    var $_0 = -2;
    var $_0;
    return $_0;
  }
  var $_1 = ($_09 | 0) == 8 ? 9 : $_09;
  var $29$s2 = ($strm + 40 | 0) >> 2;
  var $31 = FUNCTION_TABLE[$10](HEAP32[$29$s2], 1, 5828), $31$s2 = $31 >> 2;
  if (($31 | 0) == 0) {
    var $_0 = -4;
    var $_0;
    return $_0;
  }
  HEAP32[$strm + 28 >> 2] = $31;
  HEAP32[$31$s2] = $strm;
  HEAP32[$31$s2 + 6] = $wrap_0;
  HEAP32[$31$s2 + 7] = 0;
  HEAP32[$31$s2 + 12] = $_1;
  var $43 = 1 << $_1;
  var $45 = $31 + 44 | 0;
  HEAP32[$45 >> 2] = $43;
  HEAP32[$31$s2 + 13] = $43 - 1 | 0;
  HEAP32[$31$s2 + 20] = 16;
  var $52 = $31 + 76 | 0;
  HEAP32[$52 >> 2] = 65536;
  HEAP32[$31$s2 + 21] = 65535;
  HEAP32[$31$s2 + 22] = 6;
  var $61 = $31 + 56 | 0;
  HEAP32[$61 >> 2] = FUNCTION_TABLE[HEAP32[$4$s2]](HEAP32[$29$s2], $43, 2);
  var $68 = $31 + 64 | 0;
  HEAP32[$68 >> 2] = FUNCTION_TABLE[HEAP32[$4$s2]](HEAP32[$29$s2], HEAP32[$45 >> 2], 2);
  var $75 = $31 + 68 | 0;
  HEAP32[$75 >> 2] = FUNCTION_TABLE[HEAP32[$4$s2]](HEAP32[$29$s2], HEAP32[$52 >> 2], 2);
  HEAP32[$31$s2 + 1456] = 0;
  var $79 = $31 + 5788 | 0;
  HEAP32[$79 >> 2] = 32768;
  var $82 = FUNCTION_TABLE[HEAP32[$4$s2]](HEAP32[$29$s2], 32768, 4);
  var $83 = $82;
  HEAP32[$31$s2 + 2] = $82;
  var $86 = HEAP32[$79 >> 2];
  HEAP32[$31$s2 + 3] = $86 << 2;
  do {
    if ((HEAP32[$61 >> 2] | 0) != 0) {
      if ((HEAP32[$68 >> 2] | 0) == 0) {
        break;
      }
      if ((HEAP32[$75 >> 2] | 0) == 0 | ($82 | 0) == 0) {
        break;
      }
      HEAP32[$31$s2 + 1449] = ($86 >>> 1 << 1) + $83 | 0;
      HEAP32[$31$s2 + 1446] = $82 + $86 * 3 | 0;
      HEAP32[$31$s2 + 33] = $_08;
      HEAP32[$31$s2 + 34] = 0;
      HEAP8[$31 + 36 | 0] = 8;
      var $_0 = _deflateReset($strm);
      var $_0;
      return $_0;
    }
  } while (0);
  HEAP32[$31$s2 + 1] = 666;
  HEAP32[$3 >> 2] = STRING_TABLE.__str6114 | 0;
  _deflateEnd($strm);
  var $_0 = -4;
  var $_0;
  return $_0;
}
_deflateInit2_["X"] = 1;
function _deflateEnd($strm) {
  var $_pre15_pre$s2;
  var $3$s2;
  var $strm$s2 = $strm >> 2;
  if (($strm | 0) == 0) {
    return;
  }
  var $3$s2 = ($strm + 28 | 0) >> 2;
  var $4 = HEAP32[$3$s2];
  if (($4 | 0) == 0) {
    return;
  }
  var $8 = HEAP32[$4 + 4 >> 2];
  if (!(($8 | 0) == 666 || ($8 | 0) == 113 || ($8 | 0) == 103 || ($8 | 0) == 91 || ($8 | 0) == 73 || ($8 | 0) == 69 || ($8 | 0) == 42)) {
    return;
  }
  var $11 = HEAP32[$4 + 8 >> 2];
  if (($11 | 0) == 0) {
    var $19 = $4;
  } else {
    FUNCTION_TABLE[HEAP32[$strm$s2 + 9]](HEAP32[$strm$s2 + 10], $11);
    var $19 = HEAP32[$3$s2];
  }
  var $19;
  var $21 = HEAP32[$19 + 68 >> 2];
  if (($21 | 0) == 0) {
    var $30 = $19;
  } else {
    FUNCTION_TABLE[HEAP32[$strm$s2 + 9]](HEAP32[$strm$s2 + 10], $21);
    var $30 = HEAP32[$3$s2];
  }
  var $30;
  var $32 = HEAP32[$30 + 64 >> 2];
  var $_pre15_pre$s2 = ($strm + 36 | 0) >> 2;
  if (($32 | 0) == 0) {
    var $39 = $30;
  } else {
    FUNCTION_TABLE[HEAP32[$_pre15_pre$s2]](HEAP32[$strm$s2 + 10], $32);
    var $39 = HEAP32[$3$s2];
  }
  var $39;
  var $41 = HEAP32[$39 + 56 >> 2];
  if (($41 | 0) == 0) {
    var $48 = $39;
    var $_pre_phi17 = $strm + 40 | 0;
  } else {
    var $45 = $strm + 40 | 0;
    FUNCTION_TABLE[HEAP32[$_pre15_pre$s2]](HEAP32[$45 >> 2], $41);
    var $48 = HEAP32[$3$s2];
    var $_pre_phi17 = $45;
  }
  var $_pre_phi17;
  var $48;
  FUNCTION_TABLE[HEAP32[$_pre15_pre$s2]](HEAP32[$_pre_phi17 >> 2], $48);
  HEAP32[$3$s2] = 0;
  return;
}
_deflateEnd["X"] = 1;
function _deflateReset($strm) {
  var $1 = _deflateResetKeep($strm);
  if (($1 | 0) != 0) {
    return $1;
  }
  _lm_init(HEAP32[$strm + 28 >> 2]);
  return $1;
}
function _fill_window($s) {
  var $137$s2;
  var $13$s2;
  var $10$s2;
  var $9$s2;
  var $8$s2;
  var $5$s2;
  var $4$s2;
  var $1 = $s + 44 | 0;
  var $2 = HEAP32[$1 >> 2];
  var $3 = $s + 60 | 0;
  var $4$s2 = ($s + 116 | 0) >> 2;
  var $5$s2 = ($s + 108 | 0) >> 2;
  var $6 = $2 - 262 | 0;
  var $7 = $s | 0;
  var $8$s2 = ($s + 56 | 0) >> 2;
  var $9$s2 = ($s + 5812 | 0) >> 2;
  var $10$s2 = ($s + 72 | 0) >> 2;
  var $11 = $s + 88 | 0;
  var $12 = $s + 84 | 0;
  var $13$s2 = ($s + 68 | 0) >> 2;
  var $14 = $s + 52 | 0;
  var $15 = $s + 64 | 0;
  var $16 = $s + 112 | 0;
  var $17 = $s + 92 | 0;
  var $18 = $s + 76 | 0;
  var $21 = HEAP32[$4$s2];
  var $20 = $2;
  while (1) {
    var $20;
    var $21;
    var $24 = HEAP32[$5$s2];
    var $25 = HEAP32[$3 >> 2] - $21 - $24 | 0;
    if ($24 >>> 0 < ($6 + $20 | 0) >>> 0) {
      var $more_0 = $25;
    } else {
      var $29 = HEAP32[$8$s2];
      _memcpy($29, $29 + $2 | 0, $2, 1);
      HEAP32[$16 >> 2] = HEAP32[$16 >> 2] - $2 | 0;
      HEAP32[$5$s2] = HEAP32[$5$s2] - $2 | 0;
      HEAP32[$17 >> 2] = HEAP32[$17 >> 2] - $2 | 0;
      var $37 = HEAP32[$18 >> 2];
      var $n_0 = $37;
      var $p_0 = ($37 << 1) + HEAP32[$13$s2] | 0;
      while (1) {
        var $p_0;
        var $n_0;
        var $41 = $p_0 - 2 | 0;
        var $43 = HEAP16[$41 >> 1] & 65535;
        if ($43 >>> 0 < $2 >>> 0) {
          var $48 = 0;
        } else {
          var $48 = $43 - $2 & 65535;
        }
        var $48;
        HEAP16[$41 >> 1] = $48;
        var $49 = $n_0 - 1 | 0;
        if (($49 | 0) == 0) {
          break;
        } else {
          var $n_0 = $49;
          var $p_0 = $41;
        }
      }
      var $n_1 = $2;
      var $p_1 = ($2 << 1) + HEAP32[$15 >> 2] | 0;
      while (1) {
        var $p_1;
        var $n_1;
        var $55 = $p_1 - 2 | 0;
        var $57 = HEAP16[$55 >> 1] & 65535;
        if ($57 >>> 0 < $2 >>> 0) {
          var $62 = 0;
        } else {
          var $62 = $57 - $2 & 65535;
        }
        var $62;
        HEAP16[$55 >> 1] = $62;
        var $63 = $n_1 - 1 | 0;
        if (($63 | 0) == 0) {
          break;
        } else {
          var $n_1 = $63;
          var $p_1 = $55;
        }
      }
      var $more_0 = $25 + $2 | 0;
    }
    var $more_0;
    var $67 = HEAP32[$7 >> 2];
    if ((HEAP32[$67 + 4 >> 2] | 0) == 0) {
      break;
    }
    var $78 = _read_buf($67, HEAP32[$8$s2] + HEAP32[$4$s2] + HEAP32[$5$s2] | 0, $more_0) + HEAP32[$4$s2] | 0;
    HEAP32[$4$s2] = $78;
    var $79 = HEAP32[$9$s2];
    var $81 = ($78 + $79 | 0) >>> 0 > 2;
    L226 : do {
      if ($81) {
        var $84 = HEAP32[$5$s2] - $79 | 0;
        var $85 = HEAP32[$8$s2];
        var $88 = HEAP8[$85 + $84 | 0] & 255;
        HEAP32[$10$s2] = $88;
        HEAP32[$10$s2] = (HEAP8[$84 + ($85 + 1) | 0] & 255 ^ $88 << HEAP32[$11 >> 2]) & HEAP32[$12 >> 2];
        var $str_0 = $84;
        var $99 = $79;
        var $_pr2 = $78;
        while (1) {
          var $_pr2;
          var $99;
          var $str_0;
          if (($99 | 0) == 0) {
            var $130 = $_pr2;
            break L226;
          }
          var $112 = (HEAP8[HEAP32[$8$s2] + $str_0 + 2 | 0] & 255 ^ HEAP32[$10$s2] << HEAP32[$11 >> 2]) & HEAP32[$12 >> 2];
          HEAP32[$10$s2] = $112;
          HEAP16[HEAP32[$15 >> 2] + ((HEAP32[$14 >> 2] & $str_0) << 1) >> 1] = HEAP16[HEAP32[$13$s2] + ($112 << 1) >> 1];
          HEAP16[HEAP32[$13$s2] + (HEAP32[$10$s2] << 1) >> 1] = $str_0 & 65535;
          var $126 = HEAP32[$9$s2] - 1 | 0;
          HEAP32[$9$s2] = $126;
          var $127 = HEAP32[$4$s2];
          if (($127 + $126 | 0) >>> 0 < 3) {
            var $130 = $127;
            break L226;
          } else {
            var $str_0 = $str_0 + 1 | 0;
            var $99 = $126;
            var $_pr2 = $127;
          }
        }
      } else {
        var $130 = $78;
      }
    } while (0);
    var $130;
    if ($130 >>> 0 >= 262) {
      break;
    }
    if ((HEAP32[HEAP32[$7 >> 2] + 4 >> 2] | 0) == 0) {
      break;
    }
    var $21 = $130;
    var $20 = HEAP32[$1 >> 2];
  }
  var $137$s2 = ($s + 5824 | 0) >> 2;
  var $138 = HEAP32[$137$s2];
  var $139 = HEAP32[$3 >> 2];
  if ($138 >>> 0 >= $139 >>> 0) {
    return;
  }
  var $144 = HEAP32[$4$s2] + HEAP32[$5$s2] | 0;
  if ($138 >>> 0 < $144 >>> 0) {
    var $147 = $139 - $144 | 0;
    var $init_0 = $147 >>> 0 > 258 ? 258 : $147;
    _memset(HEAP32[$8$s2] + $144 | 0, 0, $init_0, 1);
    HEAP32[$137$s2] = $init_0 + $144 | 0;
    return;
  }
  var $153 = $144 + 258 | 0;
  if ($138 >>> 0 >= $153 >>> 0) {
    return;
  }
  var $156 = $153 - $138 | 0;
  var $157 = $139 - $138 | 0;
  var $init_1 = $156 >>> 0 > $157 >>> 0 ? $157 : $156;
  _memset(HEAP32[$8$s2] + $138 | 0, 0, $init_1, 1);
  HEAP32[$137$s2] = HEAP32[$137$s2] + $init_1 | 0;
  return;
}
_fill_window["X"] = 1;
function _deflateResetKeep($strm) {
  var $4$s2;
  var $strm$s2 = $strm >> 2;
  if (($strm | 0) == 0) {
    var $_0 = -2;
    var $_0;
    return $_0;
  }
  var $4 = HEAP32[$strm$s2 + 7], $4$s2 = $4 >> 2;
  if (($4 | 0) == 0) {
    var $_0 = -2;
    var $_0;
    return $_0;
  }
  if ((HEAP32[$strm$s2 + 8] | 0) == 0) {
    var $_0 = -2;
    var $_0;
    return $_0;
  }
  if ((HEAP32[$strm$s2 + 9] | 0) == 0) {
    var $_0 = -2;
    var $_0;
    return $_0;
  }
  HEAP32[$strm$s2 + 5] = 0;
  HEAP32[$strm$s2 + 2] = 0;
  HEAP32[$strm$s2 + 6] = 0;
  HEAP32[$strm$s2 + 11] = 2;
  HEAP32[$4$s2 + 5] = 0;
  HEAP32[$4$s2 + 4] = HEAP32[$4$s2 + 2];
  var $23 = $4 + 24 | 0;
  var $24 = HEAP32[$23 >> 2];
  if (($24 | 0) < 0) {
    var $27 = -$24 | 0;
    HEAP32[$23 >> 2] = $27;
    var $29 = $27;
  } else {
    var $29 = $24;
  }
  var $29;
  HEAP32[$4$s2 + 1] = ($29 | 0) != 0 ? 42 : 113;
  if (($29 | 0) == 2) {
    var $39 = _crc32(0, 0, 0);
  } else {
    var $39 = _adler32(0, 0, 0);
  }
  var $39;
  HEAP32[$strm$s2 + 12] = $39;
  HEAP32[$4$s2 + 10] = 0;
  __tr_init($4);
  var $_0 = 0;
  var $_0;
  return $_0;
}
_deflateResetKeep["X"] = 1;
function _lm_init($s) {
  var $s$s2 = $s >> 2;
  HEAP32[$s$s2 + 15] = HEAP32[$s$s2 + 11] << 1;
  var $5 = $s + 76 | 0;
  var $8 = $s + 68 | 0;
  HEAP16[HEAP32[$8 >> 2] + (HEAP32[$5 >> 2] - 1 << 1) >> 1] = 0;
  _memset(HEAP32[$8 >> 2], 0, (HEAP32[$5 >> 2] << 1) - 2 | 0, 1);
  var $17 = HEAP32[$s$s2 + 33];
  HEAP32[$s$s2 + 32] = HEAP16[(_configuration_table + 2 >> 1) + ($17 * 6 | 0)] & 65535;
  HEAP32[$s$s2 + 35] = HEAP16[(_configuration_table >> 1) + ($17 * 6 | 0)] & 65535;
  HEAP32[$s$s2 + 36] = HEAP16[(_configuration_table + 4 >> 1) + ($17 * 6 | 0)] & 65535;
  HEAP32[$s$s2 + 31] = HEAP16[(_configuration_table + 6 >> 1) + ($17 * 6 | 0)] & 65535;
  HEAP32[$s$s2 + 27] = 0;
  HEAP32[$s$s2 + 23] = 0;
  HEAP32[$s$s2 + 29] = 0;
  HEAP32[$s$s2 + 1453] = 0;
  HEAP32[$s$s2 + 30] = 2;
  HEAP32[$s$s2 + 24] = 2;
  HEAP32[$s$s2 + 26] = 0;
  HEAP32[$s$s2 + 18] = 0;
  return;
}
_lm_init["X"] = 1;
function _deflate($strm, $flush) {
  var $616$s2;
  var $592$s2;
  var $586$s2;
  var $581$s2;
  var $492$s2;
  var $476$s2;
  var $463$s2;
  var $403$s2;
  var $402$s2;
  var $399$s2;
  var $339$s2;
  var $338$s2;
  var $337$s2;
  var $334$s2;
  var $_pre_phi61$s2;
  var $329$s2;
  var $266$s2;
  var $265$s2;
  var $263$s2;
  var $261$s2;
  var $_pre_phi$s2;
  var $59$s2;
  var $58$s2;
  var $47$s2;
  var $44$s2;
  var $43$s2;
  var $_pre65$s2;
  var $34$s2;
  var $27$s2;
  var $20$s2;
  var $4$s2;
  var $strm$s2 = $strm >> 2;
  var label;
  if (($strm | 0) == 0) {
    var $_0 = -2;
    var $_0;
    return $_0;
  }
  var $4 = HEAP32[$strm$s2 + 7], $4$s2 = $4 >> 2;
  if (($4 | 0) == 0 | $flush >>> 0 > 5) {
    var $_0 = -2;
    var $_0;
    return $_0;
  }
  do {
    if ((HEAP32[$strm$s2 + 3] | 0) != 0) {
      if ((HEAP32[$strm$s2] | 0) == 0) {
        if ((HEAP32[$strm$s2 + 1] | 0) != 0) {
          break;
        }
      }
      var $20$s2 = ($4 + 4 | 0) >> 2;
      var $21 = HEAP32[$20$s2];
      var $23 = ($flush | 0) == 4;
      if (!(($21 | 0) != 666 | $23)) {
        break;
      }
      var $27$s2 = ($strm + 16 | 0) >> 2;
      if ((HEAP32[$27$s2] | 0) == 0) {
        HEAP32[$strm$s2 + 6] = STRING_TABLE.__str7115 | 0;
        var $_0 = -5;
        var $_0;
        return $_0;
      }
      HEAP32[$4$s2] = $strm;
      var $34$s2 = ($4 + 40 | 0) >> 2;
      var $35 = HEAP32[$34$s2];
      HEAP32[$34$s2] = $flush;
      do {
        if (($21 | 0) == 42) {
          if ((HEAP32[$4$s2 + 6] | 0) != 2) {
            var $223 = (HEAP32[$4$s2 + 12] << 12) - 30720 | 0;
            do {
              if ((HEAP32[$4$s2 + 34] | 0) > 1) {
                var $level_flags_0 = 0;
              } else {
                var $229 = HEAP32[$4$s2 + 33];
                if (($229 | 0) < 2) {
                  var $level_flags_0 = 0;
                  break;
                }
                if (($229 | 0) < 6) {
                  var $level_flags_0 = 64;
                  break;
                }
                var $level_flags_0 = ($229 | 0) == 6 ? 128 : 192;
              }
            } while (0);
            var $level_flags_0;
            var $236 = $level_flags_0 | $223;
            var $237 = $4 + 108 | 0;
            var $header_0 = (HEAP32[$237 >> 2] | 0) == 0 ? $236 : $236 | 32;
            HEAP32[$20$s2] = 113;
            _putShortMSB($4, $header_0 | 31 - ($header_0 >>> 0) % 31);
            var $_pre65$s2 = ($strm + 48 | 0) >> 2;
            if ((HEAP32[$237 >> 2] | 0) != 0) {
              _putShortMSB($4, HEAP32[$_pre65$s2] >>> 16);
              _putShortMSB($4, HEAP32[$_pre65$s2] & 65535);
            }
            HEAP32[$_pre65$s2] = _adler32(0, 0, 0);
            var $253 = HEAP32[$20$s2];
            label = 239;
            break;
          }
          var $43$s2 = ($strm + 48 | 0) >> 2;
          HEAP32[$43$s2] = _crc32(0, 0, 0);
          var $44$s2 = ($4 + 20 | 0) >> 2;
          var $45 = HEAP32[$44$s2];
          HEAP32[$44$s2] = $45 + 1 | 0;
          var $47$s2 = ($4 + 8 | 0) >> 2;
          HEAP8[HEAP32[$47$s2] + $45 | 0] = 31;
          var $50 = HEAP32[$44$s2];
          HEAP32[$44$s2] = $50 + 1 | 0;
          HEAP8[HEAP32[$47$s2] + $50 | 0] = -117;
          var $54 = HEAP32[$44$s2];
          HEAP32[$44$s2] = $54 + 1 | 0;
          HEAP8[HEAP32[$47$s2] + $54 | 0] = 8;
          var $58 = $4 + 28 | 0, $58$s2 = $58 >> 2;
          var $59 = HEAP32[$58$s2], $59$s2 = $59 >> 2;
          if (($59 | 0) == 0) {
            var $62 = HEAP32[$44$s2];
            HEAP32[$44$s2] = $62 + 1 | 0;
            HEAP8[HEAP32[$47$s2] + $62 | 0] = 0;
            var $66 = HEAP32[$44$s2];
            HEAP32[$44$s2] = $66 + 1 | 0;
            HEAP8[HEAP32[$47$s2] + $66 | 0] = 0;
            var $70 = HEAP32[$44$s2];
            HEAP32[$44$s2] = $70 + 1 | 0;
            HEAP8[HEAP32[$47$s2] + $70 | 0] = 0;
            var $74 = HEAP32[$44$s2];
            HEAP32[$44$s2] = $74 + 1 | 0;
            HEAP8[HEAP32[$47$s2] + $74 | 0] = 0;
            var $78 = HEAP32[$44$s2];
            HEAP32[$44$s2] = $78 + 1 | 0;
            HEAP8[HEAP32[$47$s2] + $78 | 0] = 0;
            var $83 = HEAP32[$4$s2 + 33];
            do {
              if (($83 | 0) == 9) {
                var $91 = 2;
              } else {
                if ((HEAP32[$4$s2 + 34] | 0) > 1) {
                  var $91 = 4;
                  break;
                }
                var $91 = ($83 | 0) < 2 ? 4 : 0;
              }
            } while (0);
            var $91;
            var $92 = HEAP32[$44$s2];
            HEAP32[$44$s2] = $92 + 1 | 0;
            HEAP8[HEAP32[$47$s2] + $92 | 0] = $91;
            var $96 = HEAP32[$44$s2];
            HEAP32[$44$s2] = $96 + 1 | 0;
            HEAP8[HEAP32[$47$s2] + $96 | 0] = 3;
            HEAP32[$20$s2] = 113;
            break;
          }
          var $124 = ((HEAP32[$59$s2 + 11] | 0) != 0 ? 2 : 0) | (HEAP32[$59$s2] | 0) != 0 & 1 | ((HEAP32[$59$s2 + 4] | 0) == 0 ? 0 : 4) | ((HEAP32[$59$s2 + 7] | 0) == 0 ? 0 : 8) | ((HEAP32[$59$s2 + 9] | 0) == 0 ? 0 : 16);
          var $125 = HEAP32[$44$s2];
          HEAP32[$44$s2] = $125 + 1 | 0;
          HEAP8[HEAP32[$47$s2] + $125 | 0] = $124;
          var $132 = HEAP32[HEAP32[$58$s2] + 4 >> 2] & 255;
          var $133 = HEAP32[$44$s2];
          HEAP32[$44$s2] = $133 + 1 | 0;
          HEAP8[HEAP32[$47$s2] + $133 | 0] = $132;
          var $141 = HEAP32[HEAP32[$58$s2] + 4 >> 2] >>> 8 & 255;
          var $142 = HEAP32[$44$s2];
          HEAP32[$44$s2] = $142 + 1 | 0;
          HEAP8[HEAP32[$47$s2] + $142 | 0] = $141;
          var $150 = HEAP32[HEAP32[$58$s2] + 4 >> 2] >>> 16 & 255;
          var $151 = HEAP32[$44$s2];
          HEAP32[$44$s2] = $151 + 1 | 0;
          HEAP8[HEAP32[$47$s2] + $151 | 0] = $150;
          var $159 = HEAP32[HEAP32[$58$s2] + 4 >> 2] >>> 24 & 255;
          var $160 = HEAP32[$44$s2];
          HEAP32[$44$s2] = $160 + 1 | 0;
          HEAP8[HEAP32[$47$s2] + $160 | 0] = $159;
          var $165 = HEAP32[$4$s2 + 33];
          do {
            if (($165 | 0) == 9) {
              var $174 = 2;
            } else {
              if ((HEAP32[$4$s2 + 34] | 0) > 1) {
                var $174 = 4;
                break;
              }
              var $174 = ($165 | 0) < 2 ? 4 : 0;
            }
          } while (0);
          var $174;
          var $175 = HEAP32[$44$s2];
          HEAP32[$44$s2] = $175 + 1 | 0;
          HEAP8[HEAP32[$47$s2] + $175 | 0] = $174;
          var $182 = HEAP32[HEAP32[$58$s2] + 12 >> 2] & 255;
          var $183 = HEAP32[$44$s2];
          HEAP32[$44$s2] = $183 + 1 | 0;
          HEAP8[HEAP32[$47$s2] + $183 | 0] = $182;
          var $187 = HEAP32[$58$s2];
          if ((HEAP32[$187 + 16 >> 2] | 0) == 0) {
            var $209 = $187;
          } else {
            var $194 = HEAP32[$187 + 20 >> 2] & 255;
            var $195 = HEAP32[$44$s2];
            HEAP32[$44$s2] = $195 + 1 | 0;
            HEAP8[HEAP32[$47$s2] + $195 | 0] = $194;
            var $203 = HEAP32[HEAP32[$58$s2] + 20 >> 2] >>> 8 & 255;
            var $204 = HEAP32[$44$s2];
            HEAP32[$44$s2] = $204 + 1 | 0;
            HEAP8[HEAP32[$47$s2] + $204 | 0] = $203;
            var $209 = HEAP32[$58$s2];
          }
          var $209;
          if ((HEAP32[$209 + 44 >> 2] | 0) != 0) {
            HEAP32[$43$s2] = _crc32(HEAP32[$43$s2], HEAP32[$47$s2], HEAP32[$44$s2]);
          }
          HEAP32[$4$s2 + 8] = 0;
          HEAP32[$20$s2] = 69;
          var $_pre_phi = $58, $_pre_phi$s2 = $_pre_phi >> 2;
          label = 241;
          break;
        } else {
          var $253 = $21;
          label = 239;
        }
      } while (0);
      do {
        if (label == 239) {
          var $253;
          if (($253 | 0) != 69) {
            var $_pr13_pr = $253;
            label = 258;
            break;
          }
          var $_pre_phi = $4 + 28 | 0, $_pre_phi$s2 = $_pre_phi >> 2;
          label = 241;
          break;
        }
      } while (0);
      do {
        if (label == 241) {
          var $_pre_phi;
          var $256 = HEAP32[$_pre_phi$s2];
          if ((HEAP32[$256 + 16 >> 2] | 0) == 0) {
            HEAP32[$20$s2] = 73;
            var $328 = $256;
            label = 260;
            break;
          }
          var $261$s2 = ($4 + 20 | 0) >> 2;
          var $263$s2 = ($4 + 32 | 0) >> 2;
          var $264 = $4 + 12 | 0;
          var $265$s2 = ($strm + 48 | 0) >> 2;
          var $266$s2 = ($4 + 8 | 0) >> 2;
          var $beg_0 = HEAP32[$261$s2];
          var $269 = HEAP32[$263$s2];
          var $268 = $256;
          while (1) {
            var $268;
            var $269;
            var $beg_0;
            if ($269 >>> 0 >= (HEAP32[$268 + 20 >> 2] & 65535) >>> 0) {
              var $beg_2 = $beg_0;
              var $306 = $268;
              break;
            }
            var $275 = HEAP32[$261$s2];
            if (($275 | 0) == (HEAP32[$264 >> 2] | 0)) {
              if ((HEAP32[$268 + 44 >> 2] | 0) != 0 & $275 >>> 0 > $beg_0 >>> 0) {
                HEAP32[$265$s2] = _crc32(HEAP32[$265$s2], HEAP32[$266$s2] + $beg_0 | 0, $275 - $beg_0 | 0);
              }
              _flush_pending($strm);
              var $290 = HEAP32[$261$s2];
              if (($290 | 0) == (HEAP32[$264 >> 2] | 0)) {
                label = 249;
                break;
              }
              var $beg_1 = $290;
              var $296 = $290;
              var $295 = HEAP32[$263$s2];
              var $294 = HEAP32[$_pre_phi$s2];
            } else {
              var $beg_1 = $beg_0;
              var $296 = $275;
              var $295 = $269;
              var $294 = $268;
            }
            var $294;
            var $295;
            var $296;
            var $beg_1;
            var $300 = HEAP8[HEAP32[$294 + 16 >> 2] + $295 | 0];
            HEAP32[$261$s2] = $296 + 1 | 0;
            HEAP8[HEAP32[$266$s2] + $296 | 0] = $300;
            var $305 = HEAP32[$263$s2] + 1 | 0;
            HEAP32[$263$s2] = $305;
            var $beg_0 = $beg_1;
            var $269 = $305;
            var $268 = HEAP32[$_pre_phi$s2];
          }
          if (label == 249) {
            var $beg_2 = $290;
            var $306 = HEAP32[$_pre_phi$s2];
          }
          var $306;
          var $beg_2;
          do {
            if ((HEAP32[$306 + 44 >> 2] | 0) == 0) {
              var $319 = $306;
            } else {
              var $311 = HEAP32[$261$s2];
              if ($311 >>> 0 <= $beg_2 >>> 0) {
                var $319 = $306;
                break;
              }
              HEAP32[$265$s2] = _crc32(HEAP32[$265$s2], HEAP32[$266$s2] + $beg_2 | 0, $311 - $beg_2 | 0);
              var $319 = HEAP32[$_pre_phi$s2];
            }
          } while (0);
          var $319;
          if ((HEAP32[$263$s2] | 0) == (HEAP32[$319 + 20 >> 2] | 0)) {
            HEAP32[$263$s2] = 0;
            HEAP32[$20$s2] = 73;
            var $328 = $319;
            label = 260;
            break;
          } else {
            var $_pr13_pr = HEAP32[$20$s2];
            label = 258;
            break;
          }
        }
      } while (0);
      do {
        if (label == 258) {
          var $_pr13_pr;
          if (($_pr13_pr | 0) != 73) {
            var $392 = $_pr13_pr;
            label = 275;
            break;
          }
          var $328 = HEAP32[$4$s2 + 7];
          label = 260;
          break;
        }
      } while (0);
      do {
        if (label == 260) {
          var $328;
          var $329 = $4 + 28 | 0, $329$s2 = $329 >> 2;
          if ((HEAP32[$328 + 28 >> 2] | 0) == 0) {
            HEAP32[$20$s2] = 91;
            var $_pre_phi61 = $329, $_pre_phi61$s2 = $_pre_phi61 >> 2;
            label = 277;
            break;
          }
          var $334$s2 = ($4 + 20 | 0) >> 2;
          var $335 = HEAP32[$334$s2];
          var $336 = $4 + 12 | 0;
          var $337$s2 = ($strm + 48 | 0) >> 2;
          var $338$s2 = ($4 + 8 | 0) >> 2;
          var $339$s2 = ($4 + 32 | 0) >> 2;
          var $beg1_0 = $335;
          var $341 = $335;
          while (1) {
            var $341;
            var $beg1_0;
            if (($341 | 0) == (HEAP32[$336 >> 2] | 0)) {
              if ((HEAP32[HEAP32[$329$s2] + 44 >> 2] | 0) != 0 & $341 >>> 0 > $beg1_0 >>> 0) {
                HEAP32[$337$s2] = _crc32(HEAP32[$337$s2], HEAP32[$338$s2] + $beg1_0 | 0, $341 - $beg1_0 | 0);
              }
              _flush_pending($strm);
              var $357 = HEAP32[$334$s2];
              if (($357 | 0) == (HEAP32[$336 >> 2] | 0)) {
                var $val_0 = 1;
                var $beg1_2 = $357;
                break;
              } else {
                var $beg1_1 = $357;
                var $360 = $357;
              }
            } else {
              var $beg1_1 = $beg1_0;
              var $360 = $341;
            }
            var $360;
            var $beg1_1;
            var $361 = HEAP32[$339$s2];
            HEAP32[$339$s2] = $361 + 1 | 0;
            var $367 = HEAP8[HEAP32[HEAP32[$329$s2] + 28 >> 2] + $361 | 0];
            HEAP32[$334$s2] = $360 + 1 | 0;
            HEAP8[HEAP32[$338$s2] + $360 | 0] = $367;
            if ($367 << 24 >> 24 == 0) {
              var $val_0 = $367 & 255;
              var $beg1_2 = $beg1_1;
              break;
            }
            var $beg1_0 = $beg1_1;
            var $341 = HEAP32[$334$s2];
          }
          var $beg1_2;
          var $val_0;
          do {
            if ((HEAP32[HEAP32[$329$s2] + 44 >> 2] | 0) != 0) {
              var $379 = HEAP32[$334$s2];
              if ($379 >>> 0 <= $beg1_2 >>> 0) {
                break;
              }
              HEAP32[$337$s2] = _crc32(HEAP32[$337$s2], HEAP32[$338$s2] + $beg1_2 | 0, $379 - $beg1_2 | 0);
            }
          } while (0);
          if (($val_0 | 0) == 0) {
            HEAP32[$339$s2] = 0;
            HEAP32[$20$s2] = 91;
            var $_pre_phi61 = $329, $_pre_phi61$s2 = $_pre_phi61 >> 2;
            label = 277;
            break;
          } else {
            var $392 = HEAP32[$20$s2];
            label = 275;
            break;
          }
        }
      } while (0);
      do {
        if (label == 275) {
          var $392;
          if (($392 | 0) != 91) {
            var $_pr19_pr = $392;
            label = 292;
            break;
          }
          var $_pre_phi61 = $4 + 28 | 0, $_pre_phi61$s2 = $_pre_phi61 >> 2;
          label = 277;
          break;
        }
      } while (0);
      do {
        if (label == 277) {
          var $_pre_phi61;
          if ((HEAP32[HEAP32[$_pre_phi61$s2] + 36 >> 2] | 0) == 0) {
            HEAP32[$20$s2] = 103;
            var $_pre_phi63 = $_pre_phi61;
            label = 294;
            break;
          }
          var $399$s2 = ($4 + 20 | 0) >> 2;
          var $400 = HEAP32[$399$s2];
          var $401 = $4 + 12 | 0;
          var $402$s2 = ($strm + 48 | 0) >> 2;
          var $403$s2 = ($4 + 8 | 0) >> 2;
          var $404 = $4 + 32 | 0;
          var $beg2_0 = $400;
          var $406 = $400;
          while (1) {
            var $406;
            var $beg2_0;
            if (($406 | 0) == (HEAP32[$401 >> 2] | 0)) {
              if ((HEAP32[HEAP32[$_pre_phi61$s2] + 44 >> 2] | 0) != 0 & $406 >>> 0 > $beg2_0 >>> 0) {
                HEAP32[$402$s2] = _crc32(HEAP32[$402$s2], HEAP32[$403$s2] + $beg2_0 | 0, $406 - $beg2_0 | 0);
              }
              _flush_pending($strm);
              var $422 = HEAP32[$399$s2];
              if (($422 | 0) == (HEAP32[$401 >> 2] | 0)) {
                var $val3_0 = 1;
                var $beg2_2 = $422;
                break;
              } else {
                var $beg2_1 = $422;
                var $425 = $422;
              }
            } else {
              var $beg2_1 = $beg2_0;
              var $425 = $406;
            }
            var $425;
            var $beg2_1;
            var $426 = HEAP32[$404 >> 2];
            HEAP32[$404 >> 2] = $426 + 1 | 0;
            var $432 = HEAP8[HEAP32[HEAP32[$_pre_phi61$s2] + 36 >> 2] + $426 | 0];
            HEAP32[$399$s2] = $425 + 1 | 0;
            HEAP8[HEAP32[$403$s2] + $425 | 0] = $432;
            if ($432 << 24 >> 24 == 0) {
              var $val3_0 = $432 & 255;
              var $beg2_2 = $beg2_1;
              break;
            }
            var $beg2_0 = $beg2_1;
            var $406 = HEAP32[$399$s2];
          }
          var $beg2_2;
          var $val3_0;
          do {
            if ((HEAP32[HEAP32[$_pre_phi61$s2] + 44 >> 2] | 0) != 0) {
              var $444 = HEAP32[$399$s2];
              if ($444 >>> 0 <= $beg2_2 >>> 0) {
                break;
              }
              HEAP32[$402$s2] = _crc32(HEAP32[$402$s2], HEAP32[$403$s2] + $beg2_2 | 0, $444 - $beg2_2 | 0);
            }
          } while (0);
          if (($val3_0 | 0) == 0) {
            HEAP32[$20$s2] = 103;
            var $_pre_phi63 = $_pre_phi61;
            label = 294;
            break;
          } else {
            var $_pr19_pr = HEAP32[$20$s2];
            label = 292;
            break;
          }
        }
      } while (0);
      do {
        if (label == 292) {
          var $_pr19_pr;
          if (($_pr19_pr | 0) != 103) {
            break;
          }
          var $_pre_phi63 = $4 + 28 | 0;
          label = 294;
          break;
        }
      } while (0);
      do {
        if (label == 294) {
          var $_pre_phi63;
          if ((HEAP32[HEAP32[$_pre_phi63 >> 2] + 44 >> 2] | 0) == 0) {
            HEAP32[$20$s2] = 113;
            break;
          }
          var $463$s2 = ($4 + 20 | 0) >> 2;
          var $464 = HEAP32[$463$s2];
          var $466 = $4 + 12 | 0;
          var $467 = HEAP32[$466 >> 2];
          if (($464 + 2 | 0) >>> 0 > $467 >>> 0) {
            _flush_pending($strm);
            var $472 = HEAP32[$463$s2];
            var $471 = HEAP32[$466 >> 2];
          } else {
            var $472 = $464;
            var $471 = $467;
          }
          var $471;
          var $472;
          if (($472 + 2 | 0) >>> 0 > $471 >>> 0) {
            break;
          }
          var $476$s2 = ($strm + 48 | 0) >> 2;
          var $478 = HEAP32[$476$s2] & 255;
          HEAP32[$463$s2] = $472 + 1 | 0;
          var $480 = $4 + 8 | 0;
          HEAP8[HEAP32[$480 >> 2] + $472 | 0] = $478;
          var $485 = HEAP32[$476$s2] >>> 8 & 255;
          var $486 = HEAP32[$463$s2];
          HEAP32[$463$s2] = $486 + 1 | 0;
          HEAP8[HEAP32[$480 >> 2] + $486 | 0] = $485;
          HEAP32[$476$s2] = _crc32(0, 0, 0);
          HEAP32[$20$s2] = 113;
        }
      } while (0);
      var $492$s2 = ($4 + 20 | 0) >> 2;
      do {
        if ((HEAP32[$492$s2] | 0) == 0) {
          var $501 = HEAP32[$strm$s2 + 1];
          if (($501 | 0) != 0) {
            var $515 = $501;
            break;
          }
          if ((($flush << 1) - (($flush | 0) > 4 ? 9 : 0) | 0) > (($35 << 1) - (($35 | 0) > 4 ? 9 : 0) | 0) | $23) {
            var $515 = $501;
            break;
          }
          HEAP32[$strm$s2 + 6] = STRING_TABLE.__str7115 | 0;
          var $_0 = -5;
          var $_0;
          return $_0;
        } else {
          _flush_pending($strm);
          if ((HEAP32[$27$s2] | 0) != 0) {
            var $515 = HEAP32[$strm$s2 + 1];
            break;
          }
          HEAP32[$34$s2] = -1;
          var $_0 = 0;
          var $_0;
          return $_0;
        }
      } while (0);
      var $515;
      var $517 = (HEAP32[$20$s2] | 0) == 666;
      var $518 = ($515 | 0) == 0;
      do {
        if ($517) {
          if ($518) {
            label = 311;
            break;
          }
          HEAP32[$strm$s2 + 6] = STRING_TABLE.__str7115 | 0;
          var $_0 = -5;
          var $_0;
          return $_0;
        } else {
          if ($518) {
            label = 311;
            break;
          } else {
            label = 314;
            break;
          }
        }
      } while (0);
      do {
        if (label == 311) {
          if ((HEAP32[$4$s2 + 29] | 0) != 0) {
            label = 314;
            break;
          }
          if (($flush | 0) == 0) {
            var $_0 = 0;
            var $_0;
            return $_0;
          } else {
            if ($517) {
              break;
            } else {
              label = 314;
              break;
            }
          }
        }
      } while (0);
      do {
        if (label == 314) {
          var $530 = HEAP32[$4$s2 + 34];
          if (($530 | 0) == 2) {
            var $542 = _deflate_huff($4, $flush);
          } else if (($530 | 0) == 3) {
            var $542 = _deflate_rle($4, $flush);
          } else {
            var $542 = FUNCTION_TABLE[HEAP32[(_configuration_table + 8 >> 2) + (HEAP32[$4$s2 + 33] * 3 | 0)]]($4, $flush);
          }
          var $542;
          if (($542 - 2 | 0) >>> 0 < 2) {
            HEAP32[$20$s2] = 666;
          }
          if (($542 | 0) == 2 || ($542 | 0) == 0) {
            if ((HEAP32[$27$s2] | 0) != 0) {
              var $_0 = 0;
              var $_0;
              return $_0;
            }
            HEAP32[$34$s2] = -1;
            var $_0 = 0;
            var $_0;
            return $_0;
          } else if (($542 | 0) != 1) {
            break;
          }
          do {
            if (($flush | 0) == 1) {
              __tr_align($4);
            } else if (($flush | 0) != 5) {
              __tr_stored_block($4, 0, 0, 0);
              if (($flush | 0) != 3) {
                break;
              }
              var $557 = $4 + 76 | 0;
              var $560 = $4 + 68 | 0;
              HEAP16[HEAP32[$560 >> 2] + (HEAP32[$557 >> 2] - 1 << 1) >> 1] = 0;
              _memset(HEAP32[$560 >> 2], 0, (HEAP32[$557 >> 2] << 1) - 2 | 0, 1);
              if ((HEAP32[$4$s2 + 29] | 0) != 0) {
                break;
              }
              HEAP32[$4$s2 + 27] = 0;
              HEAP32[$4$s2 + 23] = 0;
              HEAP32[$4$s2 + 1453] = 0;
            }
          } while (0);
          _flush_pending($strm);
          if ((HEAP32[$27$s2] | 0) != 0) {
            break;
          }
          HEAP32[$34$s2] = -1;
          var $_0 = 0;
          var $_0;
          return $_0;
        }
      } while (0);
      if (!$23) {
        var $_0 = 0;
        var $_0;
        return $_0;
      }
      var $581$s2 = ($4 + 24 | 0) >> 2;
      var $582 = HEAP32[$581$s2];
      if (($582 | 0) < 1) {
        var $_0 = 1;
        var $_0;
        return $_0;
      }
      var $586$s2 = ($strm + 48 | 0) >> 2;
      var $587 = HEAP32[$586$s2];
      if (($582 | 0) == 2) {
        var $590 = HEAP32[$492$s2];
        HEAP32[$492$s2] = $590 + 1 | 0;
        var $592$s2 = ($4 + 8 | 0) >> 2;
        HEAP8[HEAP32[$592$s2] + $590 | 0] = $587 & 255;
        var $597 = HEAP32[$586$s2] >>> 8 & 255;
        var $598 = HEAP32[$492$s2];
        HEAP32[$492$s2] = $598 + 1 | 0;
        HEAP8[HEAP32[$592$s2] + $598 | 0] = $597;
        var $604 = HEAP32[$586$s2] >>> 16 & 255;
        var $605 = HEAP32[$492$s2];
        HEAP32[$492$s2] = $605 + 1 | 0;
        HEAP8[HEAP32[$592$s2] + $605 | 0] = $604;
        var $611 = HEAP32[$586$s2] >>> 24 & 255;
        var $612 = HEAP32[$492$s2];
        HEAP32[$492$s2] = $612 + 1 | 0;
        HEAP8[HEAP32[$592$s2] + $612 | 0] = $611;
        var $616$s2 = ($strm + 8 | 0) >> 2;
        var $618 = HEAP32[$616$s2] & 255;
        var $619 = HEAP32[$492$s2];
        HEAP32[$492$s2] = $619 + 1 | 0;
        HEAP8[HEAP32[$592$s2] + $619 | 0] = $618;
        var $625 = HEAP32[$616$s2] >>> 8 & 255;
        var $626 = HEAP32[$492$s2];
        HEAP32[$492$s2] = $626 + 1 | 0;
        HEAP8[HEAP32[$592$s2] + $626 | 0] = $625;
        var $632 = HEAP32[$616$s2] >>> 16 & 255;
        var $633 = HEAP32[$492$s2];
        HEAP32[$492$s2] = $633 + 1 | 0;
        HEAP8[HEAP32[$592$s2] + $633 | 0] = $632;
        var $639 = HEAP32[$616$s2] >>> 24 & 255;
        var $640 = HEAP32[$492$s2];
        HEAP32[$492$s2] = $640 + 1 | 0;
        HEAP8[HEAP32[$592$s2] + $640 | 0] = $639;
      } else {
        _putShortMSB($4, $587 >>> 16);
        _putShortMSB($4, HEAP32[$586$s2] & 65535);
      }
      _flush_pending($strm);
      var $649 = HEAP32[$581$s2];
      if (($649 | 0) > 0) {
        HEAP32[$581$s2] = -$649 | 0;
      }
      var $_0 = (HEAP32[$492$s2] | 0) == 0 & 1;
      var $_0;
      return $_0;
    }
  } while (0);
  HEAP32[$strm$s2 + 6] = STRING_TABLE.__str4112 | 0;
  var $_0 = -2;
  var $_0;
  return $_0;
}
_deflate["X"] = 1;
function _putShortMSB($s, $b) {
  var $3$s2;
  var $3$s2 = ($s + 20 | 0) >> 2;
  var $4 = HEAP32[$3$s2];
  HEAP32[$3$s2] = $4 + 1 | 0;
  var $6 = $s + 8 | 0;
  HEAP8[HEAP32[$6 >> 2] + $4 | 0] = $b >>> 8 & 255;
  var $10 = HEAP32[$3$s2];
  HEAP32[$3$s2] = $10 + 1 | 0;
  HEAP8[HEAP32[$6 >> 2] + $10 | 0] = $b & 255;
  return;
}
function _flush_pending($strm) {
  var $13$s2;
  var $11$s2;
  var $6$s2;
  var $4$s2;
  var $2 = HEAP32[$strm + 28 >> 2];
  __tr_flush_bits($2);
  var $4$s2 = ($2 + 20 | 0) >> 2;
  var $5 = HEAP32[$4$s2];
  var $6$s2 = ($strm + 16 | 0) >> 2;
  var $7 = HEAP32[$6$s2];
  var $len_0 = $5 >>> 0 > $7 >>> 0 ? $7 : $5;
  if (($len_0 | 0) == 0) {
    return;
  }
  var $11$s2 = ($strm + 12 | 0) >> 2;
  var $13$s2 = ($2 + 16 | 0) >> 2;
  _memcpy(HEAP32[$11$s2], HEAP32[$13$s2], $len_0, 1);
  HEAP32[$11$s2] = HEAP32[$11$s2] + $len_0 | 0;
  HEAP32[$13$s2] = HEAP32[$13$s2] + $len_0 | 0;
  var $19 = $strm + 20 | 0;
  HEAP32[$19 >> 2] = HEAP32[$19 >> 2] + $len_0 | 0;
  HEAP32[$6$s2] = HEAP32[$6$s2] - $len_0 | 0;
  var $24 = HEAP32[$4$s2];
  HEAP32[$4$s2] = $24 - $len_0 | 0;
  if (($24 | 0) != ($len_0 | 0)) {
    return;
  }
  HEAP32[$13$s2] = HEAP32[$2 + 8 >> 2];
  return;
}
function _deflate_huff($s, $flush) {
  var $11$s2;
  var $9$s2;
  var $5$s2;
  var $4$s2;
  var $3$s2;
  var $1$s2;
  var label;
  var $1$s2 = ($s + 116 | 0) >> 2;
  var $2 = $s + 96 | 0;
  var $3$s2 = ($s + 108 | 0) >> 2;
  var $4$s2 = ($s + 56 | 0) >> 2;
  var $5$s2 = ($s + 5792 | 0) >> 2;
  var $6 = $s + 5796 | 0;
  var $7 = $s + 5784 | 0;
  var $8 = $s + 5788 | 0;
  var $9$s2 = ($s + 92 | 0) >> 2;
  var $10 = $s;
  var $11$s2 = ($s | 0) >> 2;
  while (1) {
    if ((HEAP32[$1$s2] | 0) == 0) {
      _fill_window($s);
      if ((HEAP32[$1$s2] | 0) == 0) {
        break;
      }
    }
    HEAP32[$2 >> 2] = 0;
    var $22 = HEAP8[HEAP32[$4$s2] + HEAP32[$3$s2] | 0];
    HEAP16[HEAP32[$6 >> 2] + (HEAP32[$5$s2] << 1) >> 1] = 0;
    var $26 = HEAP32[$5$s2];
    HEAP32[$5$s2] = $26 + 1 | 0;
    HEAP8[HEAP32[$7 >> 2] + $26 | 0] = $22;
    var $31 = (($22 & 255) << 2) + $s + 148 | 0;
    HEAP16[$31 >> 1] = HEAP16[$31 >> 1] + 1 & 65535;
    var $37 = (HEAP32[$5$s2] | 0) == (HEAP32[$8 >> 2] - 1 | 0);
    HEAP32[$1$s2] = HEAP32[$1$s2] - 1 | 0;
    var $41 = HEAP32[$3$s2] + 1 | 0;
    HEAP32[$3$s2] = $41;
    if (!$37) {
      continue;
    }
    var $43 = HEAP32[$9$s2];
    if (($43 | 0) > -1) {
      var $49 = HEAP32[$4$s2] + $43 | 0;
    } else {
      var $49 = 0;
    }
    var $49;
    __tr_flush_block($10, $49, $41 - $43 | 0, 0);
    HEAP32[$9$s2] = HEAP32[$3$s2];
    _flush_pending(HEAP32[$11$s2]);
    if ((HEAP32[HEAP32[$11$s2] + 16 >> 2] | 0) == 0) {
      var $_0 = 0;
      label = 383;
      break;
    }
  }
  if (label == 383) {
    var $_0;
    return $_0;
  }
  if (($flush | 0) == 0) {
    var $_0 = 0;
    var $_0;
    return $_0;
  }
  HEAP32[$s + 5812 >> 2] = 0;
  if (($flush | 0) == 4) {
    var $61 = HEAP32[$9$s2];
    if (($61 | 0) > -1) {
      var $67 = HEAP32[$4$s2] + $61 | 0;
    } else {
      var $67 = 0;
    }
    var $67;
    __tr_flush_block($10, $67, HEAP32[$3$s2] - $61 | 0, 1);
    HEAP32[$9$s2] = HEAP32[$3$s2];
    _flush_pending(HEAP32[$11$s2]);
    var $_0 = (HEAP32[HEAP32[$11$s2] + 16 >> 2] | 0) == 0 ? 2 : 3;
    var $_0;
    return $_0;
  }
  do {
    if ((HEAP32[$5$s2] | 0) != 0) {
      var $80 = HEAP32[$9$s2];
      if (($80 | 0) > -1) {
        var $86 = HEAP32[$4$s2] + $80 | 0;
      } else {
        var $86 = 0;
      }
      var $86;
      __tr_flush_block($10, $86, HEAP32[$3$s2] - $80 | 0, 0);
      HEAP32[$9$s2] = HEAP32[$3$s2];
      _flush_pending(HEAP32[$11$s2]);
      if ((HEAP32[HEAP32[$11$s2] + 16 >> 2] | 0) == 0) {
        var $_0 = 0;
      } else {
        break;
      }
      var $_0;
      return $_0;
    }
  } while (0);
  var $_0 = 1;
  var $_0;
  return $_0;
}
_deflate_huff["X"] = 1;
function _deflate_rle($s, $flush) {
  var $13$s2;
  var $11$s2;
  var $10$s2;
  var $5$s2;
  var $4$s2;
  var $3$s2;
  var $1$s2;
  var label;
  var $1$s2 = ($s + 116 | 0) >> 2;
  var $2 = ($flush | 0) == 0;
  var $3$s2 = ($s + 96 | 0) >> 2;
  var $4$s2 = ($s + 108 | 0) >> 2;
  var $5$s2 = ($s + 5792 | 0) >> 2;
  var $6 = $s + 5796 | 0;
  var $7 = $s + 5784 | 0;
  var $8 = $s + 2440 | 0;
  var $9 = $s + 5788 | 0;
  var $10$s2 = ($s + 56 | 0) >> 2;
  var $11$s2 = ($s + 92 | 0) >> 2;
  var $12 = $s;
  var $13$s2 = ($s | 0) >> 2;
  L511 : while (1) {
    var $14 = HEAP32[$1$s2];
    do {
      if ($14 >>> 0 < 259) {
        _fill_window($s);
        var $17 = HEAP32[$1$s2];
        if ($17 >>> 0 < 259 & $2) {
          var $_0 = 0;
          label = 421;
          break L511;
        }
        if (($17 | 0) == 0) {
          label = 411;
          break L511;
        }
        HEAP32[$3$s2] = 0;
        if ($17 >>> 0 > 2) {
          var $23 = $17;
          label = 391;
          break;
        }
        var $113 = HEAP32[$4$s2];
        label = 406;
        break;
      } else {
        HEAP32[$3$s2] = 0;
        var $23 = $14;
        label = 391;
        break;
      }
    } while (0);
    do {
      if (label == 391) {
        label = 0;
        var $23;
        var $24 = HEAP32[$4$s2];
        if (($24 | 0) == 0) {
          var $113 = 0;
          label = 406;
          break;
        }
        var $27 = HEAP32[$10$s2];
        var $29 = HEAP8[$27 + ($24 - 1) | 0];
        if ($29 << 24 >> 24 != HEAP8[$27 + $24 | 0] << 24 >> 24) {
          var $113 = $24;
          label = 406;
          break;
        }
        if ($29 << 24 >> 24 != HEAP8[$24 + ($27 + 1) | 0] << 24 >> 24) {
          var $113 = $24;
          label = 406;
          break;
        }
        var $38 = $24 + ($27 + 2) | 0;
        if ($29 << 24 >> 24 != HEAP8[$38] << 24 >> 24) {
          var $113 = $24;
          label = 406;
          break;
        }
        var $42 = $24 + ($27 + 258) | 0;
        var $scan_0 = $38;
        while (1) {
          var $scan_0;
          var $44 = $scan_0 + 1 | 0;
          if ($29 << 24 >> 24 != HEAP8[$44] << 24 >> 24) {
            var $scan_1 = $44;
            break;
          }
          var $48 = $scan_0 + 2 | 0;
          if ($29 << 24 >> 24 != HEAP8[$48] << 24 >> 24) {
            var $scan_1 = $48;
            break;
          }
          var $52 = $scan_0 + 3 | 0;
          if ($29 << 24 >> 24 != HEAP8[$52] << 24 >> 24) {
            var $scan_1 = $52;
            break;
          }
          var $56 = $scan_0 + 4 | 0;
          if ($29 << 24 >> 24 != HEAP8[$56] << 24 >> 24) {
            var $scan_1 = $56;
            break;
          }
          var $60 = $scan_0 + 5 | 0;
          if ($29 << 24 >> 24 != HEAP8[$60] << 24 >> 24) {
            var $scan_1 = $60;
            break;
          }
          var $64 = $scan_0 + 6 | 0;
          if ($29 << 24 >> 24 != HEAP8[$64] << 24 >> 24) {
            var $scan_1 = $64;
            break;
          }
          var $68 = $scan_0 + 7 | 0;
          if ($29 << 24 >> 24 != HEAP8[$68] << 24 >> 24) {
            var $scan_1 = $68;
            break;
          }
          var $72 = $scan_0 + 8 | 0;
          if ($29 << 24 >> 24 == HEAP8[$72] << 24 >> 24 & $72 >>> 0 < $42 >>> 0) {
            var $scan_0 = $72;
          } else {
            var $scan_1 = $72;
            break;
          }
        }
        var $scan_1;
        var $79 = $scan_1 - $42 + 258 | 0;
        var $storemerge = $79 >>> 0 > $23 >>> 0 ? $23 : $79;
        HEAP32[$3$s2] = $storemerge;
        if ($storemerge >>> 0 <= 2) {
          var $113 = $24;
          label = 406;
          break;
        }
        var $83 = $storemerge + 253 | 0;
        HEAP16[HEAP32[$6 >> 2] + (HEAP32[$5$s2] << 1) >> 1] = 1;
        var $88 = HEAP32[$5$s2];
        HEAP32[$5$s2] = $88 + 1 | 0;
        HEAP8[HEAP32[$7 >> 2] + $88 | 0] = $83 & 255;
        var $98 = ((HEAP8[($83 & 255) + STRING_TABLE.__length_code | 0] & 255 | 256) + 1 << 2) + $s + 148 | 0;
        HEAP16[$98 >> 1] = HEAP16[$98 >> 1] + 1 & 65535;
        HEAP16[$8 >> 1] = HEAP16[$8 >> 1] + 1 & 65535;
        var $107 = (HEAP32[$5$s2] | 0) == (HEAP32[$9 >> 2] - 1 | 0) & 1;
        var $108 = HEAP32[$3$s2];
        HEAP32[$1$s2] = HEAP32[$1$s2] - $108 | 0;
        var $112 = HEAP32[$4$s2] + $108 | 0;
        HEAP32[$4$s2] = $112;
        HEAP32[$3$s2] = 0;
        var $bflush_0 = $107;
        var $138 = $112;
        break;
      }
    } while (0);
    if (label == 406) {
      label = 0;
      var $113;
      var $116 = HEAP8[HEAP32[$10$s2] + $113 | 0];
      HEAP16[HEAP32[$6 >> 2] + (HEAP32[$5$s2] << 1) >> 1] = 0;
      var $120 = HEAP32[$5$s2];
      HEAP32[$5$s2] = $120 + 1 | 0;
      HEAP8[HEAP32[$7 >> 2] + $120 | 0] = $116;
      var $125 = (($116 & 255) << 2) + $s + 148 | 0;
      HEAP16[$125 >> 1] = HEAP16[$125 >> 1] + 1 & 65535;
      var $132 = (HEAP32[$5$s2] | 0) == (HEAP32[$9 >> 2] - 1 | 0) & 1;
      HEAP32[$1$s2] = HEAP32[$1$s2] - 1 | 0;
      var $136 = HEAP32[$4$s2] + 1 | 0;
      HEAP32[$4$s2] = $136;
      var $bflush_0 = $132;
      var $138 = $136;
    }
    var $138;
    var $bflush_0;
    if (($bflush_0 | 0) == 0) {
      continue;
    }
    var $141 = HEAP32[$11$s2];
    if (($141 | 0) > -1) {
      var $147 = HEAP32[$10$s2] + $141 | 0;
    } else {
      var $147 = 0;
    }
    var $147;
    __tr_flush_block($12, $147, $138 - $141 | 0, 0);
    HEAP32[$11$s2] = HEAP32[$4$s2];
    _flush_pending(HEAP32[$13$s2]);
    if ((HEAP32[HEAP32[$13$s2] + 16 >> 2] | 0) == 0) {
      var $_0 = 0;
      label = 422;
      break;
    }
  }
  if (label == 411) {
    HEAP32[$s + 5812 >> 2] = 0;
    if (($flush | 0) == 4) {
      var $159 = HEAP32[$11$s2];
      if (($159 | 0) > -1) {
        var $165 = HEAP32[$10$s2] + $159 | 0;
      } else {
        var $165 = 0;
      }
      var $165;
      __tr_flush_block($12, $165, HEAP32[$4$s2] - $159 | 0, 1);
      HEAP32[$11$s2] = HEAP32[$4$s2];
      _flush_pending(HEAP32[$13$s2]);
      var $_0 = (HEAP32[HEAP32[$13$s2] + 16 >> 2] | 0) == 0 ? 2 : 3;
      var $_0;
      return $_0;
    }
    do {
      if ((HEAP32[$5$s2] | 0) != 0) {
        var $178 = HEAP32[$11$s2];
        if (($178 | 0) > -1) {
          var $184 = HEAP32[$10$s2] + $178 | 0;
        } else {
          var $184 = 0;
        }
        var $184;
        __tr_flush_block($12, $184, HEAP32[$4$s2] - $178 | 0, 0);
        HEAP32[$11$s2] = HEAP32[$4$s2];
        _flush_pending(HEAP32[$13$s2]);
        if ((HEAP32[HEAP32[$13$s2] + 16 >> 2] | 0) == 0) {
          var $_0 = 0;
        } else {
          break;
        }
        var $_0;
        return $_0;
      }
    } while (0);
    var $_0 = 1;
    var $_0;
    return $_0;
  } else if (label == 421) {
    var $_0;
    return $_0;
  } else if (label == 422) {
    var $_0;
    return $_0;
  }
}
_deflate_rle["X"] = 1;
function _read_buf($strm, $buf, $size) {
  var $7$s2;
  var $1 = $strm + 4 | 0;
  var $2 = HEAP32[$1 >> 2];
  var $len_0 = $2 >>> 0 > $size >>> 0 ? $size : $2;
  if (($len_0 | 0) == 0) {
    var $_0 = 0;
    var $_0;
    return $_0;
  }
  HEAP32[$1 >> 2] = $2 - $len_0 | 0;
  var $7$s2 = ($strm | 0) >> 2;
  _memcpy($buf, HEAP32[$7$s2], $len_0, 1);
  var $12 = HEAP32[HEAP32[$strm + 28 >> 2] + 24 >> 2];
  if (($12 | 0) == 2) {
    var $18 = $strm + 48 | 0;
    HEAP32[$18 >> 2] = _crc32(HEAP32[$18 >> 2], $buf, $len_0);
  } else if (($12 | 0) == 1) {
    var $14 = $strm + 48 | 0;
    HEAP32[$14 >> 2] = _adler32(HEAP32[$14 >> 2], $buf, $len_0);
  }
  HEAP32[$7$s2] = HEAP32[$7$s2] + $len_0 | 0;
  var $24 = $strm + 8 | 0;
  HEAP32[$24 >> 2] = HEAP32[$24 >> 2] + $len_0 | 0;
  var $_0 = $len_0;
  var $_0;
  return $_0;
}
function _deflate_stored($s, $flush) {
  var $10$s2;
  var $8$s2;
  var $6$s2;
  var $5$s2;
  var $4$s2;
  var label;
  var $2 = HEAP32[$s + 12 >> 2] - 5 | 0;
  var $max_block_size_0_ph = $2 >>> 0 < 65535 ? $2 : 65535;
  var $4$s2 = ($s + 116 | 0) >> 2;
  var $5$s2 = ($s + 108 | 0) >> 2;
  var $6$s2 = ($s + 92 | 0) >> 2;
  var $7 = $s + 44 | 0;
  var $8$s2 = ($s + 56 | 0) >> 2;
  var $9 = $s;
  var $10$s2 = ($s | 0) >> 2;
  while (1) {
    var $11 = HEAP32[$4$s2];
    if ($11 >>> 0 < 2) {
      _fill_window($s);
      var $14 = HEAP32[$4$s2];
      if (($14 | $flush | 0) == 0) {
        var $_0 = 0;
        label = 457;
        break;
      }
      if (($14 | 0) == 0) {
        label = 447;
        break;
      } else {
        var $19 = $14;
      }
    } else {
      var $19 = $11;
    }
    var $19;
    var $21 = HEAP32[$5$s2] + $19 | 0;
    HEAP32[$5$s2] = $21;
    HEAP32[$4$s2] = 0;
    var $22 = HEAP32[$6$s2];
    var $23 = $22 + $max_block_size_0_ph | 0;
    if (($21 | 0) != 0 & $21 >>> 0 < $23 >>> 0) {
      var $41 = $21;
      var $40 = $22;
    } else {
      HEAP32[$4$s2] = $21 - $23 | 0;
      HEAP32[$5$s2] = $23;
      if (($22 | 0) > -1) {
        var $33 = HEAP32[$8$s2] + $22 | 0;
      } else {
        var $33 = 0;
      }
      var $33;
      __tr_flush_block($9, $33, $max_block_size_0_ph, 0);
      HEAP32[$6$s2] = HEAP32[$5$s2];
      _flush_pending(HEAP32[$10$s2]);
      if ((HEAP32[HEAP32[$10$s2] + 16 >> 2] | 0) == 0) {
        var $_0 = 0;
        label = 458;
        break;
      }
      var $41 = HEAP32[$5$s2];
      var $40 = HEAP32[$6$s2];
    }
    var $40;
    var $41;
    var $42 = $41 - $40 | 0;
    if ($42 >>> 0 < (HEAP32[$7 >> 2] - 262 | 0) >>> 0) {
      continue;
    }
    if (($40 | 0) > -1) {
      var $52 = HEAP32[$8$s2] + $40 | 0;
    } else {
      var $52 = 0;
    }
    var $52;
    __tr_flush_block($9, $52, $42, 0);
    HEAP32[$6$s2] = HEAP32[$5$s2];
    _flush_pending(HEAP32[$10$s2]);
    if ((HEAP32[HEAP32[$10$s2] + 16 >> 2] | 0) == 0) {
      var $_0 = 0;
      label = 459;
      break;
    }
  }
  if (label == 458) {
    var $_0;
    return $_0;
  } else if (label == 447) {
    HEAP32[$s + 5812 >> 2] = 0;
    if (($flush | 0) == 4) {
      var $63 = HEAP32[$6$s2];
      if (($63 | 0) > -1) {
        var $69 = HEAP32[$8$s2] + $63 | 0;
      } else {
        var $69 = 0;
      }
      var $69;
      __tr_flush_block($9, $69, HEAP32[$5$s2] - $63 | 0, 1);
      HEAP32[$6$s2] = HEAP32[$5$s2];
      _flush_pending(HEAP32[$10$s2]);
      var $_0 = (HEAP32[HEAP32[$10$s2] + 16 >> 2] | 0) == 0 ? 2 : 3;
      var $_0;
      return $_0;
    }
    var $79 = HEAP32[$5$s2];
    var $80 = HEAP32[$6$s2];
    do {
      if (($79 | 0) > ($80 | 0)) {
        if (($80 | 0) > -1) {
          var $88 = HEAP32[$8$s2] + $80 | 0;
        } else {
          var $88 = 0;
        }
        var $88;
        __tr_flush_block($9, $88, $79 - $80 | 0, 0);
        HEAP32[$6$s2] = HEAP32[$5$s2];
        _flush_pending(HEAP32[$10$s2]);
        if ((HEAP32[HEAP32[$10$s2] + 16 >> 2] | 0) == 0) {
          var $_0 = 0;
        } else {
          break;
        }
        var $_0;
        return $_0;
      }
    } while (0);
    var $_0 = 1;
    var $_0;
    return $_0;
  } else if (label == 457) {
    var $_0;
    return $_0;
  } else if (label == 459) {
    var $_0;
    return $_0;
  }
}
_deflate_stored["X"] = 1;
function _deflate_fast($s, $flush) {
  var $21$s2;
  var $19$s2;
  var $14$s2;
  var $12$s2;
  var $8$s2;
  var $7$s2;
  var $6$s2;
  var $5$s2;
  var $4$s2;
  var $3$s2;
  var $1$s2;
  var label;
  var $1$s2 = ($s + 116 | 0) >> 2;
  var $2 = ($flush | 0) == 0;
  var $3$s2 = ($s + 72 | 0) >> 2;
  var $4$s2 = ($s + 88 | 0) >> 2;
  var $5$s2 = ($s + 108 | 0) >> 2;
  var $6$s2 = ($s + 56 | 0) >> 2;
  var $7$s2 = ($s + 84 | 0) >> 2;
  var $8$s2 = ($s + 68 | 0) >> 2;
  var $9 = $s + 52 | 0;
  var $10 = $s + 64 | 0;
  var $11 = $s + 44 | 0;
  var $12$s2 = ($s + 96 | 0) >> 2;
  var $13 = $s + 112 | 0;
  var $14$s2 = ($s + 5792 | 0) >> 2;
  var $15 = $s + 5796 | 0;
  var $16 = $s + 5784 | 0;
  var $17 = $s + 5788 | 0;
  var $18 = $s + 128 | 0;
  var $19$s2 = ($s + 92 | 0) >> 2;
  var $20 = $s;
  var $21$s2 = ($s | 0) >> 2;
  L610 : while (1) {
    do {
      if (HEAP32[$1$s2] >>> 0 < 262) {
        _fill_window($s);
        var $25 = HEAP32[$1$s2];
        if ($25 >>> 0 < 262 & $2) {
          var $_0 = 0;
          label = 499;
          break L610;
        }
        if (($25 | 0) == 0) {
          label = 485;
          break L610;
        }
        if ($25 >>> 0 > 2) {
          label = 468;
          break;
        } else {
          label = 471;
          break;
        }
      } else {
        label = 468;
      }
    } while (0);
    do {
      if (label == 468) {
        label = 0;
        var $34 = HEAP32[$5$s2];
        var $42 = (HEAP8[HEAP32[$6$s2] + $34 + 2 | 0] & 255 ^ HEAP32[$3$s2] << HEAP32[$4$s2]) & HEAP32[$7$s2];
        HEAP32[$3$s2] = $42;
        var $45 = HEAP16[HEAP32[$8$s2] + ($42 << 1) >> 1];
        HEAP16[HEAP32[$10 >> 2] + ((HEAP32[$9 >> 2] & $34) << 1) >> 1] = $45;
        var $50 = $45 & 65535;
        HEAP16[HEAP32[$8$s2] + (HEAP32[$3$s2] << 1) >> 1] = HEAP32[$5$s2] & 65535;
        if ($45 << 16 >> 16 == 0) {
          label = 471;
          break;
        }
        if ((HEAP32[$5$s2] - $50 | 0) >>> 0 > (HEAP32[$11 >> 2] - 262 | 0) >>> 0) {
          label = 471;
          break;
        }
        var $64 = _longest_match($s, $50);
        HEAP32[$12$s2] = $64;
        var $65 = $64;
        break;
      }
    } while (0);
    if (label == 471) {
      label = 0;
      var $65 = HEAP32[$12$s2];
    }
    var $65;
    do {
      if ($65 >>> 0 > 2) {
        var $68 = $65 + 253 | 0;
        var $73 = HEAP32[$5$s2] - HEAP32[$13 >> 2] & 65535;
        HEAP16[HEAP32[$15 >> 2] + (HEAP32[$14$s2] << 1) >> 1] = $73;
        var $77 = HEAP32[$14$s2];
        HEAP32[$14$s2] = $77 + 1 | 0;
        HEAP8[HEAP32[$16 >> 2] + $77 | 0] = $68 & 255;
        var $81 = $73 - 1 & 65535;
        var $88 = ((HEAP8[($68 & 255) + STRING_TABLE.__length_code | 0] & 255 | 256) + 1 << 2) + $s + 148 | 0;
        HEAP16[$88 >> 1] = HEAP16[$88 >> 1] + 1 & 65535;
        var $91 = $81 & 65535;
        if (($81 & 65535) < 256) {
          var $_pn = $91;
        } else {
          var $_pn = ($91 >>> 7) + 256 | 0;
        }
        var $_pn;
        var $98 = ((HEAP8[STRING_TABLE.__dist_code + $_pn | 0] & 255) << 2) + $s + 2440 | 0;
        HEAP16[$98 >> 1] = HEAP16[$98 >> 1] + 1 & 65535;
        var $105 = (HEAP32[$14$s2] | 0) == (HEAP32[$17 >> 2] - 1 | 0) & 1;
        var $106 = HEAP32[$12$s2];
        var $108 = HEAP32[$1$s2] - $106 | 0;
        HEAP32[$1$s2] = $108;
        if (!($106 >>> 0 <= HEAP32[$18 >> 2] >>> 0 & $108 >>> 0 > 2)) {
          var $148 = HEAP32[$5$s2] + $106 | 0;
          HEAP32[$5$s2] = $148;
          HEAP32[$12$s2] = 0;
          var $149 = HEAP32[$6$s2];
          var $152 = HEAP8[$149 + $148 | 0] & 255;
          HEAP32[$3$s2] = $152;
          HEAP32[$3$s2] = (HEAP8[$148 + ($149 + 1) | 0] & 255 ^ $152 << HEAP32[$4$s2]) & HEAP32[$7$s2];
          var $bflush_0 = $105;
          var $188 = $148;
          break;
        }
        HEAP32[$12$s2] = $106 - 1 | 0;
        while (1) {
          var $115 = HEAP32[$5$s2];
          var $116 = $115 + 1 | 0;
          HEAP32[$5$s2] = $116;
          var $127 = (HEAP8[HEAP32[$6$s2] + $115 + 3 | 0] & 255 ^ HEAP32[$3$s2] << HEAP32[$4$s2]) & HEAP32[$7$s2];
          HEAP32[$3$s2] = $127;
          HEAP16[HEAP32[$10 >> 2] + ((HEAP32[$9 >> 2] & $116) << 1) >> 1] = HEAP16[HEAP32[$8$s2] + ($127 << 1) >> 1];
          HEAP16[HEAP32[$8$s2] + (HEAP32[$3$s2] << 1) >> 1] = HEAP32[$5$s2] & 65535;
          var $141 = HEAP32[$12$s2] - 1 | 0;
          HEAP32[$12$s2] = $141;
          if (($141 | 0) == 0) {
            break;
          }
        }
        var $145 = HEAP32[$5$s2] + 1 | 0;
        HEAP32[$5$s2] = $145;
        var $bflush_0 = $105;
        var $188 = $145;
      } else {
        var $166 = HEAP8[HEAP32[$6$s2] + HEAP32[$5$s2] | 0];
        HEAP16[HEAP32[$15 >> 2] + (HEAP32[$14$s2] << 1) >> 1] = 0;
        var $170 = HEAP32[$14$s2];
        HEAP32[$14$s2] = $170 + 1 | 0;
        HEAP8[HEAP32[$16 >> 2] + $170 | 0] = $166;
        var $175 = (($166 & 255) << 2) + $s + 148 | 0;
        HEAP16[$175 >> 1] = HEAP16[$175 >> 1] + 1 & 65535;
        var $182 = (HEAP32[$14$s2] | 0) == (HEAP32[$17 >> 2] - 1 | 0) & 1;
        HEAP32[$1$s2] = HEAP32[$1$s2] - 1 | 0;
        var $186 = HEAP32[$5$s2] + 1 | 0;
        HEAP32[$5$s2] = $186;
        var $bflush_0 = $182;
        var $188 = $186;
      }
    } while (0);
    var $188;
    var $bflush_0;
    if (($bflush_0 | 0) == 0) {
      continue;
    }
    var $191 = HEAP32[$19$s2];
    if (($191 | 0) > -1) {
      var $197 = HEAP32[$6$s2] + $191 | 0;
    } else {
      var $197 = 0;
    }
    var $197;
    __tr_flush_block($20, $197, $188 - $191 | 0, 0);
    HEAP32[$19$s2] = HEAP32[$5$s2];
    _flush_pending(HEAP32[$21$s2]);
    if ((HEAP32[HEAP32[$21$s2] + 16 >> 2] | 0) == 0) {
      var $_0 = 0;
      label = 497;
      break;
    }
  }
  if (label == 499) {
    var $_0;
    return $_0;
  } else if (label == 485) {
    var $206 = HEAP32[$5$s2];
    HEAP32[$s + 5812 >> 2] = $206 >>> 0 < 2 ? $206 : 2;
    if (($flush | 0) == 4) {
      var $212 = HEAP32[$19$s2];
      if (($212 | 0) > -1) {
        var $218 = HEAP32[$6$s2] + $212 | 0;
      } else {
        var $218 = 0;
      }
      var $218;
      __tr_flush_block($20, $218, $206 - $212 | 0, 1);
      HEAP32[$19$s2] = HEAP32[$5$s2];
      _flush_pending(HEAP32[$21$s2]);
      var $_0 = (HEAP32[HEAP32[$21$s2] + 16 >> 2] | 0) == 0 ? 2 : 3;
      var $_0;
      return $_0;
    }
    do {
      if ((HEAP32[$14$s2] | 0) != 0) {
        var $230 = HEAP32[$19$s2];
        if (($230 | 0) > -1) {
          var $236 = HEAP32[$6$s2] + $230 | 0;
        } else {
          var $236 = 0;
        }
        var $236;
        __tr_flush_block($20, $236, $206 - $230 | 0, 0);
        HEAP32[$19$s2] = HEAP32[$5$s2];
        _flush_pending(HEAP32[$21$s2]);
        if ((HEAP32[HEAP32[$21$s2] + 16 >> 2] | 0) == 0) {
          var $_0 = 0;
        } else {
          break;
        }
        var $_0;
        return $_0;
      }
    } while (0);
    var $_0 = 1;
    var $_0;
    return $_0;
  } else if (label == 497) {
    var $_0;
    return $_0;
  }
}
_deflate_fast["X"] = 1;
function _deflate_slow($s, $flush) {
  var $22$s2;
  var $20$s2;
  var $19$s2;
  var $17$s2;
  var $16$s2;
  var $15$s2;
  var $14$s2;
  var $13$s2;
  var $12$s2;
  var $11$s2;
  var $8$s2;
  var $6$s2;
  var $5$s2;
  var $3$s2;
  var $1$s2;
  var label;
  var $1$s2 = ($s + 116 | 0) >> 2;
  var $2 = ($flush | 0) == 0;
  var $3$s2 = ($s + 72 | 0) >> 2;
  var $4 = $s + 88 | 0;
  var $5$s2 = ($s + 108 | 0) >> 2;
  var $6$s2 = ($s + 56 | 0) >> 2;
  var $7 = $s + 84 | 0;
  var $8$s2 = ($s + 68 | 0) >> 2;
  var $9 = $s + 52 | 0;
  var $10 = $s + 64 | 0;
  var $11$s2 = ($s + 96 | 0) >> 2;
  var $12$s2 = ($s + 120 | 0) >> 2;
  var $13$s2 = ($s + 112 | 0) >> 2;
  var $14$s2 = ($s + 100 | 0) >> 2;
  var $15$s2 = ($s + 5792 | 0) >> 2;
  var $16$s2 = ($s + 5796 | 0) >> 2;
  var $17$s2 = ($s + 5784 | 0) >> 2;
  var $18 = $s + 5788 | 0;
  var $19$s2 = ($s + 104 | 0) >> 2;
  var $20$s2 = ($s + 92 | 0) >> 2;
  var $21 = $s;
  var $22$s2 = ($s | 0) >> 2;
  var $23 = $s + 128 | 0;
  var $24 = $s + 44 | 0;
  var $25 = $s + 136 | 0;
  L660 : while (1) {
    var $26 = HEAP32[$1$s2];
    while (1) {
      var $26;
      do {
        if ($26 >>> 0 < 262) {
          _fill_window($s);
          var $29 = HEAP32[$1$s2];
          if ($29 >>> 0 < 262 & $2) {
            var $_0 = 0;
            label = 548;
            break L660;
          }
          if (($29 | 0) == 0) {
            label = 534;
            break L660;
          }
          if ($29 >>> 0 > 2) {
            label = 507;
            break;
          }
          HEAP32[$12$s2] = HEAP32[$11$s2];
          HEAP32[$14$s2] = HEAP32[$13$s2];
          HEAP32[$11$s2] = 2;
          var $88 = 2;
          label = 515;
          break;
        } else {
          label = 507;
        }
      } while (0);
      do {
        if (label == 507) {
          label = 0;
          var $40 = HEAP32[$5$s2];
          var $48 = (HEAP8[HEAP32[$6$s2] + $40 + 2 | 0] & 255 ^ HEAP32[$3$s2] << HEAP32[$4 >> 2]) & HEAP32[$7 >> 2];
          HEAP32[$3$s2] = $48;
          var $51 = HEAP16[HEAP32[$8$s2] + ($48 << 1) >> 1];
          HEAP16[HEAP32[$10 >> 2] + ((HEAP32[$9 >> 2] & $40) << 1) >> 1] = $51;
          var $56 = $51 & 65535;
          HEAP16[HEAP32[$8$s2] + (HEAP32[$3$s2] << 1) >> 1] = HEAP32[$5$s2] & 65535;
          var $62 = HEAP32[$11$s2];
          HEAP32[$12$s2] = $62;
          HEAP32[$14$s2] = HEAP32[$13$s2];
          HEAP32[$11$s2] = 2;
          if ($51 << 16 >> 16 == 0) {
            var $88 = 2;
            label = 515;
            break;
          }
          if ($62 >>> 0 >= HEAP32[$23 >> 2] >>> 0) {
            var $91 = $62;
            var $90 = 2;
            break;
          }
          if ((HEAP32[$5$s2] - $56 | 0) >>> 0 > (HEAP32[$24 >> 2] - 262 | 0) >>> 0) {
            var $88 = 2;
            label = 515;
            break;
          }
          var $75 = _longest_match($s, $56);
          HEAP32[$11$s2] = $75;
          if ($75 >>> 0 >= 6) {
            var $88 = $75;
            label = 515;
            break;
          }
          if ((HEAP32[$25 >> 2] | 0) != 1) {
            if (($75 | 0) != 3) {
              var $88 = $75;
              label = 515;
              break;
            }
            if ((HEAP32[$5$s2] - HEAP32[$13$s2] | 0) >>> 0 <= 4096) {
              var $88 = 3;
              label = 515;
              break;
            }
          }
          HEAP32[$11$s2] = 2;
          var $88 = 2;
          label = 515;
          break;
        }
      } while (0);
      if (label == 515) {
        label = 0;
        var $88;
        var $91 = HEAP32[$12$s2];
        var $90 = $88;
      }
      var $90;
      var $91;
      if (!($91 >>> 0 < 3 | $90 >>> 0 > $91 >>> 0)) {
        break;
      }
      if ((HEAP32[$19$s2] | 0) == 0) {
        HEAP32[$19$s2] = 1;
        HEAP32[$5$s2] = HEAP32[$5$s2] + 1 | 0;
        var $239 = HEAP32[$1$s2] - 1 | 0;
        HEAP32[$1$s2] = $239;
        var $26 = $239;
        continue;
      }
      var $198 = HEAP8[HEAP32[$6$s2] + (HEAP32[$5$s2] - 1) | 0];
      HEAP16[HEAP32[$16$s2] + (HEAP32[$15$s2] << 1) >> 1] = 0;
      var $202 = HEAP32[$15$s2];
      HEAP32[$15$s2] = $202 + 1 | 0;
      HEAP8[HEAP32[$17$s2] + $202 | 0] = $198;
      var $207 = (($198 & 255) << 2) + $s + 148 | 0;
      HEAP16[$207 >> 1] = HEAP16[$207 >> 1] + 1 & 65535;
      if ((HEAP32[$15$s2] | 0) == (HEAP32[$18 >> 2] - 1 | 0)) {
        var $215 = HEAP32[$20$s2];
        if (($215 | 0) > -1) {
          var $221 = HEAP32[$6$s2] + $215 | 0;
        } else {
          var $221 = 0;
        }
        var $221;
        __tr_flush_block($21, $221, HEAP32[$5$s2] - $215 | 0, 0);
        HEAP32[$20$s2] = HEAP32[$5$s2];
        _flush_pending(HEAP32[$22$s2]);
      }
      HEAP32[$5$s2] = HEAP32[$5$s2] + 1 | 0;
      var $230 = HEAP32[$1$s2] - 1 | 0;
      HEAP32[$1$s2] = $230;
      if ((HEAP32[HEAP32[$22$s2] + 16 >> 2] | 0) == 0) {
        var $_0 = 0;
        label = 546;
        break L660;
      } else {
        var $26 = $230;
      }
    }
    var $95 = HEAP32[$5$s2];
    var $98 = $95 - 3 + HEAP32[$1$s2] | 0;
    var $99 = $91 + 253 | 0;
    var $104 = $95 + 65535 - HEAP32[$14$s2] & 65535;
    HEAP16[HEAP32[$16$s2] + (HEAP32[$15$s2] << 1) >> 1] = $104;
    var $108 = HEAP32[$15$s2];
    HEAP32[$15$s2] = $108 + 1 | 0;
    HEAP8[HEAP32[$17$s2] + $108 | 0] = $99 & 255;
    var $112 = $104 - 1 & 65535;
    var $119 = ((HEAP8[($99 & 255) + STRING_TABLE.__length_code | 0] & 255 | 256) + 1 << 2) + $s + 148 | 0;
    HEAP16[$119 >> 1] = HEAP16[$119 >> 1] + 1 & 65535;
    var $122 = $112 & 65535;
    if (($112 & 65535) < 256) {
      var $_pn = $122;
    } else {
      var $_pn = ($122 >>> 7) + 256 | 0;
    }
    var $_pn;
    var $129 = ((HEAP8[STRING_TABLE.__dist_code + $_pn | 0] & 255) << 2) + $s + 2440 | 0;
    HEAP16[$129 >> 1] = HEAP16[$129 >> 1] + 1 & 65535;
    var $132 = HEAP32[$15$s2];
    var $134 = HEAP32[$18 >> 2] - 1 | 0;
    var $135 = HEAP32[$12$s2];
    HEAP32[$1$s2] = 1 - $135 + HEAP32[$1$s2] | 0;
    var $138 = $135 - 2 | 0;
    HEAP32[$12$s2] = $138;
    var $139 = $138;
    while (1) {
      var $139;
      var $140 = HEAP32[$5$s2];
      var $141 = $140 + 1 | 0;
      HEAP32[$5$s2] = $141;
      if ($141 >>> 0 > $98 >>> 0) {
        var $168 = $139;
      } else {
        var $154 = (HEAP8[HEAP32[$6$s2] + $140 + 3 | 0] & 255 ^ HEAP32[$3$s2] << HEAP32[$4 >> 2]) & HEAP32[$7 >> 2];
        HEAP32[$3$s2] = $154;
        HEAP16[HEAP32[$10 >> 2] + ((HEAP32[$9 >> 2] & $141) << 1) >> 1] = HEAP16[HEAP32[$8$s2] + ($154 << 1) >> 1];
        HEAP16[HEAP32[$8$s2] + (HEAP32[$3$s2] << 1) >> 1] = HEAP32[$5$s2] & 65535;
        var $168 = HEAP32[$12$s2];
      }
      var $168;
      var $169 = $168 - 1 | 0;
      HEAP32[$12$s2] = $169;
      if (($169 | 0) == 0) {
        break;
      } else {
        var $139 = $169;
      }
    }
    HEAP32[$19$s2] = 0;
    HEAP32[$11$s2] = 2;
    var $174 = HEAP32[$5$s2] + 1 | 0;
    HEAP32[$5$s2] = $174;
    if (($132 | 0) != ($134 | 0)) {
      continue;
    }
    var $176 = HEAP32[$20$s2];
    if (($176 | 0) > -1) {
      var $182 = HEAP32[$6$s2] + $176 | 0;
    } else {
      var $182 = 0;
    }
    var $182;
    __tr_flush_block($21, $182, $174 - $176 | 0, 0);
    HEAP32[$20$s2] = HEAP32[$5$s2];
    _flush_pending(HEAP32[$22$s2]);
    if ((HEAP32[HEAP32[$22$s2] + 16 >> 2] | 0) == 0) {
      var $_0 = 0;
      label = 551;
      break;
    }
  }
  if (label == 534) {
    if ((HEAP32[$19$s2] | 0) != 0) {
      var $248 = HEAP8[HEAP32[$6$s2] + (HEAP32[$5$s2] - 1) | 0];
      HEAP16[HEAP32[$16$s2] + (HEAP32[$15$s2] << 1) >> 1] = 0;
      var $252 = HEAP32[$15$s2];
      HEAP32[$15$s2] = $252 + 1 | 0;
      HEAP8[HEAP32[$17$s2] + $252 | 0] = $248;
      var $257 = (($248 & 255) << 2) + $s + 148 | 0;
      HEAP16[$257 >> 1] = HEAP16[$257 >> 1] + 1 & 65535;
      HEAP32[$19$s2] = 0;
    }
    var $261 = HEAP32[$5$s2];
    HEAP32[$s + 5812 >> 2] = $261 >>> 0 < 2 ? $261 : 2;
    if (($flush | 0) == 4) {
      var $267 = HEAP32[$20$s2];
      if (($267 | 0) > -1) {
        var $273 = HEAP32[$6$s2] + $267 | 0;
      } else {
        var $273 = 0;
      }
      var $273;
      __tr_flush_block($21, $273, $261 - $267 | 0, 1);
      HEAP32[$20$s2] = HEAP32[$5$s2];
      _flush_pending(HEAP32[$22$s2]);
      var $_0 = (HEAP32[HEAP32[$22$s2] + 16 >> 2] | 0) == 0 ? 2 : 3;
      var $_0;
      return $_0;
    }
    do {
      if ((HEAP32[$15$s2] | 0) != 0) {
        var $285 = HEAP32[$20$s2];
        if (($285 | 0) > -1) {
          var $291 = HEAP32[$6$s2] + $285 | 0;
        } else {
          var $291 = 0;
        }
        var $291;
        __tr_flush_block($21, $291, $261 - $285 | 0, 0);
        HEAP32[$20$s2] = HEAP32[$5$s2];
        _flush_pending(HEAP32[$22$s2]);
        if ((HEAP32[HEAP32[$22$s2] + 16 >> 2] | 0) == 0) {
          var $_0 = 0;
        } else {
          break;
        }
        var $_0;
        return $_0;
      }
    } while (0);
    var $_0 = 1;
    var $_0;
    return $_0;
  } else if (label == 546) {
    var $_0;
    return $_0;
  } else if (label == 548) {
    var $_0;
    return $_0;
  } else if (label == 551) {
    var $_0;
    return $_0;
  }
}
_deflate_slow["X"] = 1;
function _longest_match($s, $cur_match) {
  var $s$s2 = $s >> 2;
  var label;
  var $1 = HEAP32[$s$s2 + 31];
  var $3 = HEAP32[$s$s2 + 14];
  var $5 = HEAP32[$s$s2 + 27];
  var $6 = $3 + $5 | 0;
  var $8 = HEAP32[$s$s2 + 30];
  var $10 = HEAP32[$s$s2 + 36];
  var $13 = HEAP32[$s$s2 + 11] - 262 | 0;
  var $_ = $5 >>> 0 > $13 >>> 0 ? $5 - $13 | 0 : 0;
  var $17 = HEAP32[$s$s2 + 16];
  var $19 = HEAP32[$s$s2 + 13];
  var $20 = $5 + ($3 + 258) | 0;
  var $31 = HEAP32[$s$s2 + 29];
  var $nice_match_0_ph = $10 >>> 0 > $31 >>> 0 ? $31 : $10;
  var $33 = $s + 112 | 0;
  var $34 = $5 + ($3 + 1) | 0;
  var $35 = $5 + ($3 + 2) | 0;
  var $36 = $20;
  var $37 = $5 + 257 | 0;
  var $scan_end_0 = HEAP8[$3 + $8 + $5 | 0];
  var $_09 = $cur_match;
  var $chain_length_1 = $8 >>> 0 < HEAP32[$s$s2 + 35] >>> 0 ? $1 : $1 >>> 2;
  var $scan_end1_0 = HEAP8[$3 + ($5 - 1) + $8 | 0];
  var $best_len_0 = $8;
  L730 : while (1) {
    var $best_len_0;
    var $scan_end1_0;
    var $chain_length_1;
    var $_09;
    var $scan_end_0;
    var $39 = $3 + $_09 | 0;
    do {
      if (HEAP8[$3 + $_09 + $best_len_0 | 0] << 24 >> 24 == $scan_end_0 << 24 >> 24) {
        if (HEAP8[$3 + ($best_len_0 - 1) + $_09 | 0] << 24 >> 24 != $scan_end1_0 << 24 >> 24) {
          var $scan_end_1 = $scan_end_0;
          var $scan_end1_1 = $scan_end1_0;
          var $best_len_1 = $best_len_0;
          break;
        }
        if (HEAP8[$39] << 24 >> 24 != HEAP8[$6] << 24 >> 24) {
          var $scan_end_1 = $scan_end_0;
          var $scan_end1_1 = $scan_end1_0;
          var $best_len_1 = $best_len_0;
          break;
        }
        if (HEAP8[$_09 + ($3 + 1) | 0] << 24 >> 24 != HEAP8[$34] << 24 >> 24) {
          var $scan_end_1 = $scan_end_0;
          var $scan_end1_1 = $scan_end1_0;
          var $best_len_1 = $best_len_0;
          break;
        }
        var $scan_1 = $35;
        var $match_0 = $_09 + ($3 + 2) | 0;
        while (1) {
          var $match_0;
          var $scan_1;
          var $60 = $scan_1 + 1 | 0;
          if (HEAP8[$60] << 24 >> 24 != HEAP8[$match_0 + 1 | 0] << 24 >> 24) {
            var $scan_2 = $60;
            break;
          }
          var $66 = $scan_1 + 2 | 0;
          if (HEAP8[$66] << 24 >> 24 != HEAP8[$match_0 + 2 | 0] << 24 >> 24) {
            var $scan_2 = $66;
            break;
          }
          var $72 = $scan_1 + 3 | 0;
          if (HEAP8[$72] << 24 >> 24 != HEAP8[$match_0 + 3 | 0] << 24 >> 24) {
            var $scan_2 = $72;
            break;
          }
          var $78 = $scan_1 + 4 | 0;
          if (HEAP8[$78] << 24 >> 24 != HEAP8[$match_0 + 4 | 0] << 24 >> 24) {
            var $scan_2 = $78;
            break;
          }
          var $84 = $scan_1 + 5 | 0;
          if (HEAP8[$84] << 24 >> 24 != HEAP8[$match_0 + 5 | 0] << 24 >> 24) {
            var $scan_2 = $84;
            break;
          }
          var $90 = $scan_1 + 6 | 0;
          if (HEAP8[$90] << 24 >> 24 != HEAP8[$match_0 + 6 | 0] << 24 >> 24) {
            var $scan_2 = $90;
            break;
          }
          var $96 = $scan_1 + 7 | 0;
          if (HEAP8[$96] << 24 >> 24 != HEAP8[$match_0 + 7 | 0] << 24 >> 24) {
            var $scan_2 = $96;
            break;
          }
          var $102 = $scan_1 + 8 | 0;
          var $104 = $match_0 + 8 | 0;
          if (HEAP8[$102] << 24 >> 24 == HEAP8[$104] << 24 >> 24 & $102 >>> 0 < $20 >>> 0) {
            var $scan_1 = $102;
            var $match_0 = $104;
          } else {
            var $scan_2 = $102;
            break;
          }
        }
        var $scan_2;
        var $109 = $scan_2 - $36 | 0;
        var $110 = $109 + 258 | 0;
        if (($110 | 0) <= ($best_len_0 | 0)) {
          var $scan_end_1 = $scan_end_0;
          var $scan_end1_1 = $scan_end1_0;
          var $best_len_1 = $best_len_0;
          break;
        }
        HEAP32[$33 >> 2] = $_09;
        if (($110 | 0) >= ($nice_match_0_ph | 0)) {
          var $best_len_2 = $110;
          label = 572;
          break L730;
        }
        var $scan_end_1 = HEAP8[$3 + $110 + $5 | 0];
        var $scan_end1_1 = HEAP8[$3 + $37 + $109 | 0];
        var $best_len_1 = $110;
      } else {
        var $scan_end_1 = $scan_end_0;
        var $scan_end1_1 = $scan_end1_0;
        var $best_len_1 = $best_len_0;
      }
    } while (0);
    var $best_len_1;
    var $scan_end1_1;
    var $scan_end_1;
    var $123 = HEAP16[$17 + (($_09 & $19) << 1) >> 1] & 65535;
    if ($123 >>> 0 <= $_ >>> 0) {
      var $best_len_2 = $best_len_1;
      label = 573;
      break;
    }
    var $126 = $chain_length_1 - 1 | 0;
    if (($126 | 0) == 0) {
      var $best_len_2 = $best_len_1;
      label = 574;
      break;
    } else {
      var $scan_end_0 = $scan_end_1;
      var $_09 = $123;
      var $chain_length_1 = $126;
      var $scan_end1_0 = $scan_end1_1;
      var $best_len_0 = $best_len_1;
    }
  }
  if (label == 572) {
    var $best_len_2;
    var $128 = $best_len_2 >>> 0 > $31 >>> 0;
    var $_best_len_2 = $128 ? $31 : $best_len_2;
    return $_best_len_2;
  } else if (label == 573) {
    var $best_len_2;
    var $128 = $best_len_2 >>> 0 > $31 >>> 0;
    var $_best_len_2 = $128 ? $31 : $best_len_2;
    return $_best_len_2;
  } else if (label == 574) {
    var $best_len_2;
    var $128 = $best_len_2 >>> 0 > $31 >>> 0;
    var $_best_len_2 = $128 ? $31 : $best_len_2;
    return $_best_len_2;
  }
}
_longest_match["X"] = 1;
function _inflate_fast($strm, $start) {
  var $28$s2;
  var $26$s2;
  var $13$s2;
  var $3$s2;
  var $2$s2;
  var label;
  var $2 = HEAP32[$strm + 28 >> 2], $2$s2 = $2 >> 2;
  var $3 = $2, $3$s2 = $3 >> 2;
  var $4 = $strm | 0;
  var $5 = HEAP32[$4 >> 2];
  var $7 = $strm + 4 | 0;
  var $9 = $5 + (HEAP32[$7 >> 2] - 6) | 0;
  var $10 = $strm + 12 | 0;
  var $11 = HEAP32[$10 >> 2];
  var $13$s2 = ($strm + 16 | 0) >> 2;
  var $14 = HEAP32[$13$s2];
  var $17 = $11 + ($14 - 258) | 0;
  var $21 = HEAP32[$3$s2 + 11];
  var $23 = HEAP32[$3$s2 + 12];
  var $25 = HEAP32[$3$s2 + 13];
  var $26$s2 = ($3 + 56 | 0) >> 2;
  var $28$s2 = ($3 + 60 | 0) >> 2;
  var $31 = HEAP32[$3$s2 + 19];
  var $33 = HEAP32[$3$s2 + 20];
  var $37 = (1 << HEAP32[$3$s2 + 21]) - 1 | 0;
  var $41 = (1 << HEAP32[$3$s2 + 22]) - 1 | 0;
  var $42 = $11 + $14 + ($start ^ -1) | 0;
  var $43 = $3 + 7104 | 0;
  var $44 = $25 - 1 | 0;
  var $45 = ($23 | 0) == 0;
  var $46 = HEAP32[$3$s2 + 10] - 1 | 0;
  var $47 = $46 + $23 | 0;
  var $48 = $23 - 1 | 0;
  var $49 = $42 - 1 | 0;
  var $50 = $42 - $23 | 0;
  var $in_0 = $5 - 1 | 0;
  var $out_0 = $11 - 1 | 0;
  var $bits_0 = HEAP32[$28$s2];
  var $hold_0 = HEAP32[$26$s2];
  L756 : while (1) {
    var $hold_0;
    var $bits_0;
    var $out_0;
    var $in_0;
    if ($bits_0 >>> 0 < 15) {
      var $59 = $in_0 + 2 | 0;
      var $in_1 = $59;
      var $bits_1 = $bits_0 + 16 | 0;
      var $hold_1 = ((HEAP8[$in_0 + 1 | 0] & 255) << $bits_0) + ((HEAP8[$59] & 255) << $bits_0 + 8) + $hold_0 | 0;
    } else {
      var $in_1 = $in_0;
      var $bits_1 = $bits_0;
      var $hold_1 = $hold_0;
    }
    var $hold_1;
    var $bits_1;
    var $in_1;
    var $bits_2 = $bits_1;
    var $hold_2 = $hold_1;
    var $_pn = $hold_1 & $37;
    while (1) {
      var $_pn;
      var $hold_2;
      var $bits_2;
      var $here_0_0 = HEAP8[($_pn << 2) + $31 | 0];
      var $here_2_0 = HEAP16[$31 + ($_pn << 2) + 2 >> 1];
      var $69 = HEAP8[($_pn << 2) + $31 + 1 | 0] & 255;
      var $70 = $hold_2 >>> ($69 >>> 0);
      var $71 = $bits_2 - $69 | 0;
      var $72 = $here_0_0 & 255;
      if ($here_0_0 << 24 >> 24 == 0) {
        label = 580;
        break;
      }
      if (($72 & 16 | 0) != 0) {
        label = 582;
        break;
      }
      if (($72 & 64 | 0) != 0) {
        label = 629;
        break L756;
      }
      var $bits_2 = $71;
      var $hold_2 = $70;
      var $_pn = ($70 & (1 << $72) - 1) + ($here_2_0 & 65535) | 0;
    }
    do {
      if (label == 582) {
        label = 0;
        var $81 = $here_2_0 & 65535;
        var $82 = $72 & 15;
        if (($82 | 0) == 0) {
          var $len_0 = $81;
          var $in_3 = $in_1;
          var $bits_4 = $71;
          var $hold_4 = $70;
        } else {
          if ($71 >>> 0 < $82 >>> 0) {
            var $87 = $in_1 + 1 | 0;
            var $in_2 = $87;
            var $bits_3 = $71 + 8 | 0;
            var $hold_3 = ((HEAP8[$87] & 255) << $71) + $70 | 0;
          } else {
            var $in_2 = $in_1;
            var $bits_3 = $71;
            var $hold_3 = $70;
          }
          var $hold_3;
          var $bits_3;
          var $in_2;
          var $len_0 = ($hold_3 & (1 << $82) - 1) + $81 | 0;
          var $in_3 = $in_2;
          var $bits_4 = $bits_3 - $82 | 0;
          var $hold_4 = $hold_3 >>> ($82 >>> 0);
        }
        var $hold_4;
        var $bits_4;
        var $in_3;
        var $len_0;
        if ($bits_4 >>> 0 < 15) {
          var $108 = $in_3 + 2 | 0;
          var $in_4 = $108;
          var $bits_5 = $bits_4 + 16 | 0;
          var $hold_5 = ((HEAP8[$in_3 + 1 | 0] & 255) << $bits_4) + ((HEAP8[$108] & 255) << $bits_4 + 8) + $hold_4 | 0;
        } else {
          var $in_4 = $in_3;
          var $bits_5 = $bits_4;
          var $hold_5 = $hold_4;
        }
        var $hold_5;
        var $bits_5;
        var $in_4;
        var $bits_6 = $bits_5;
        var $hold_6 = $hold_5;
        var $_pn32 = $hold_5 & $41;
        while (1) {
          var $_pn32;
          var $hold_6;
          var $bits_6;
          var $here_2_1 = HEAP16[$33 + ($_pn32 << 2) + 2 >> 1];
          var $118 = HEAP8[($_pn32 << 2) + $33 + 1 | 0] & 255;
          var $119 = $hold_6 >>> ($118 >>> 0);
          var $120 = $bits_6 - $118 | 0;
          var $121 = HEAP8[($_pn32 << 2) + $33 | 0] & 255;
          if (($121 & 16 | 0) != 0) {
            break;
          }
          if (($121 & 64 | 0) != 0) {
            label = 626;
            break L756;
          }
          var $bits_6 = $120;
          var $hold_6 = $119;
          var $_pn32 = ($119 & (1 << $121) - 1) + ($here_2_1 & 65535) | 0;
        }
        var $125 = $here_2_1 & 65535;
        var $126 = $121 & 15;
        do {
          if ($120 >>> 0 < $126 >>> 0) {
            var $129 = $in_4 + 1 | 0;
            var $133 = ((HEAP8[$129] & 255) << $120) + $119 | 0;
            var $134 = $120 + 8 | 0;
            if ($134 >>> 0 >= $126 >>> 0) {
              var $in_5 = $129;
              var $bits_7 = $134;
              var $hold_7 = $133;
              break;
            }
            var $137 = $in_4 + 2 | 0;
            var $in_5 = $137;
            var $bits_7 = $120 + 16 | 0;
            var $hold_7 = ((HEAP8[$137] & 255) << $134) + $133 | 0;
          } else {
            var $in_5 = $in_4;
            var $bits_7 = $120;
            var $hold_7 = $119;
          }
        } while (0);
        var $hold_7;
        var $bits_7;
        var $in_5;
        var $146 = $hold_7 & (1 << $126) - 1;
        var $147 = $146 + $125 | 0;
        var $148 = $hold_7 >>> ($126 >>> 0);
        var $149 = $bits_7 - $126 | 0;
        var $150 = $out_0;
        var $151 = $150 - $42 | 0;
        if ($147 >>> 0 <= $151 >>> 0) {
          var $from_5 = $out_0 + -$147 | 0;
          var $len_2 = $len_0;
          var $out_6 = $out_0;
          while (1) {
            var $out_6;
            var $len_2;
            var $from_5;
            HEAP8[$out_6 + 1 | 0] = HEAP8[$from_5 + 1 | 0];
            HEAP8[$out_6 + 2 | 0] = HEAP8[$from_5 + 2 | 0];
            var $250 = $from_5 + 3 | 0;
            var $252 = $out_6 + 3 | 0;
            HEAP8[$252] = HEAP8[$250];
            var $253 = $len_2 - 3 | 0;
            if ($253 >>> 0 > 2) {
              var $from_5 = $250;
              var $len_2 = $253;
              var $out_6 = $252;
            } else {
              break;
            }
          }
          if (($253 | 0) == 0) {
            var $in_6 = $in_5;
            var $out_7 = $252;
            var $bits_8 = $149;
            var $hold_8 = $148;
            break;
          }
          var $260 = $out_6 + 4 | 0;
          HEAP8[$260] = HEAP8[$from_5 + 4 | 0];
          if ($253 >>> 0 <= 1) {
            var $in_6 = $in_5;
            var $out_7 = $260;
            var $bits_8 = $149;
            var $hold_8 = $148;
            break;
          }
          var $265 = $out_6 + 5 | 0;
          HEAP8[$265] = HEAP8[$from_5 + 5 | 0];
          var $in_6 = $in_5;
          var $out_7 = $265;
          var $bits_8 = $149;
          var $hold_8 = $148;
          break;
        }
        var $154 = $147 - $151 | 0;
        if ($154 >>> 0 > $21 >>> 0) {
          if ((HEAP32[$43 >> 2] | 0) != 0) {
            label = 596;
            break L756;
          }
        }
        do {
          if ($45) {
            var $164 = $25 + ($46 - $154) | 0;
            if ($154 >>> 0 >= $len_0 >>> 0) {
              var $from_4_ph = $164;
              var $len_1_ph = $len_0;
              var $out_5_ph = $out_0;
              break;
            }
            var $167 = $len_0 - $154 | 0;
            var $168 = $146 - $150 | 0;
            var $scevgep77_sum = $49 + $168 | 0;
            var $from_0 = $164;
            var $op_0 = $154;
            var $out_1 = $out_0;
            while (1) {
              var $out_1;
              var $op_0;
              var $from_0;
              var $170 = $from_0 + 1 | 0;
              var $172 = $out_1 + 1 | 0;
              HEAP8[$172] = HEAP8[$170];
              var $173 = $op_0 - 1 | 0;
              if (($173 | 0) == 0) {
                break;
              } else {
                var $from_0 = $170;
                var $op_0 = $173;
                var $out_1 = $172;
              }
            }
            var $from_4_ph = $out_0 + $scevgep77_sum + $125 + (1 - $147) | 0;
            var $len_1_ph = $167;
            var $out_5_ph = $out_0 + $42 + $168 + $125 | 0;
          } else {
            if ($23 >>> 0 >= $154 >>> 0) {
              var $205 = $25 + ($48 - $154) | 0;
              if ($154 >>> 0 >= $len_0 >>> 0) {
                var $from_4_ph = $205;
                var $len_1_ph = $len_0;
                var $out_5_ph = $out_0;
                break;
              }
              var $208 = $len_0 - $154 | 0;
              var $209 = $146 - $150 | 0;
              var $scevgep85_sum = $49 + $209 | 0;
              var $from_3 = $205;
              var $op_3 = $154;
              var $out_4 = $out_0;
              while (1) {
                var $out_4;
                var $op_3;
                var $from_3;
                var $211 = $from_3 + 1 | 0;
                var $213 = $out_4 + 1 | 0;
                HEAP8[$213] = HEAP8[$211];
                var $214 = $op_3 - 1 | 0;
                if (($214 | 0) == 0) {
                  break;
                } else {
                  var $from_3 = $211;
                  var $op_3 = $214;
                  var $out_4 = $213;
                }
              }
              var $from_4_ph = $out_0 + $scevgep85_sum + $125 + (1 - $147) | 0;
              var $len_1_ph = $208;
              var $out_5_ph = $out_0 + $42 + $209 + $125 | 0;
              break;
            }
            var $180 = $25 + ($47 - $154) | 0;
            var $181 = $154 - $23 | 0;
            if ($181 >>> 0 >= $len_0 >>> 0) {
              var $from_4_ph = $180;
              var $len_1_ph = $len_0;
              var $out_5_ph = $out_0;
              break;
            }
            var $184 = $len_0 - $181 | 0;
            var $185 = $146 - $150 | 0;
            var $from_1 = $180;
            var $op_1 = $181;
            var $out_2 = $out_0;
            while (1) {
              var $out_2;
              var $op_1;
              var $from_1;
              var $187 = $from_1 + 1 | 0;
              var $189 = $out_2 + 1 | 0;
              HEAP8[$189] = HEAP8[$187];
              var $190 = $op_1 - 1 | 0;
              if (($190 | 0) == 0) {
                break;
              } else {
                var $from_1 = $187;
                var $op_1 = $190;
                var $out_2 = $189;
              }
            }
            var $scevgep118 = $out_0 + $50 + $185 + $125 | 0;
            if ($23 >>> 0 >= $184 >>> 0) {
              var $from_4_ph = $44;
              var $len_1_ph = $184;
              var $out_5_ph = $scevgep118;
              break;
            }
            var $195 = $184 - $23 | 0;
            var $scevgep93_sum = $49 + $185 | 0;
            var $from_2 = $44;
            var $op_2 = $23;
            var $out_3 = $scevgep118;
            while (1) {
              var $out_3;
              var $op_2;
              var $from_2;
              var $197 = $from_2 + 1 | 0;
              var $199 = $out_3 + 1 | 0;
              HEAP8[$199] = HEAP8[$197];
              var $200 = $op_2 - 1 | 0;
              if (($200 | 0) == 0) {
                break;
              } else {
                var $from_2 = $197;
                var $op_2 = $200;
                var $out_3 = $199;
              }
            }
            var $from_4_ph = $out_0 + $scevgep93_sum + $125 + (1 - $147) | 0;
            var $len_1_ph = $195;
            var $out_5_ph = $out_0 + $42 + $185 + $125 | 0;
          }
        } while (0);
        var $out_5_ph;
        var $len_1_ph;
        var $from_4_ph;
        var $218 = $len_1_ph >>> 0 > 2;
        L820 : do {
          if ($218) {
            var $out_559 = $out_5_ph;
            var $len_160 = $len_1_ph;
            var $from_461 = $from_4_ph;
            while (1) {
              var $from_461;
              var $len_160;
              var $out_559;
              HEAP8[$out_559 + 1 | 0] = HEAP8[$from_461 + 1 | 0];
              HEAP8[$out_559 + 2 | 0] = HEAP8[$from_461 + 2 | 0];
              var $225 = $from_461 + 3 | 0;
              var $227 = $out_559 + 3 | 0;
              HEAP8[$227] = HEAP8[$225];
              var $228 = $len_160 - 3 | 0;
              if ($228 >>> 0 > 2) {
                var $out_559 = $227;
                var $len_160 = $228;
                var $from_461 = $225;
              } else {
                var $out_5_lcssa = $227;
                var $len_1_lcssa = $228;
                var $from_4_lcssa = $225;
                break L820;
              }
            }
          } else {
            var $out_5_lcssa = $out_5_ph;
            var $len_1_lcssa = $len_1_ph;
            var $from_4_lcssa = $from_4_ph;
          }
        } while (0);
        var $from_4_lcssa;
        var $len_1_lcssa;
        var $out_5_lcssa;
        if (($len_1_lcssa | 0) == 0) {
          var $in_6 = $in_5;
          var $out_7 = $out_5_lcssa;
          var $bits_8 = $149;
          var $hold_8 = $148;
          break;
        }
        var $234 = $out_5_lcssa + 1 | 0;
        HEAP8[$234] = HEAP8[$from_4_lcssa + 1 | 0];
        if ($len_1_lcssa >>> 0 <= 1) {
          var $in_6 = $in_5;
          var $out_7 = $234;
          var $bits_8 = $149;
          var $hold_8 = $148;
          break;
        }
        var $239 = $out_5_lcssa + 2 | 0;
        HEAP8[$239] = HEAP8[$from_4_lcssa + 2 | 0];
        var $in_6 = $in_5;
        var $out_7 = $239;
        var $bits_8 = $149;
        var $hold_8 = $148;
      } else if (label == 580) {
        label = 0;
        var $76 = $out_0 + 1 | 0;
        HEAP8[$76] = $here_2_0 & 255;
        var $in_6 = $in_1;
        var $out_7 = $76;
        var $bits_8 = $71;
        var $hold_8 = $70;
      }
    } while (0);
    var $hold_8;
    var $bits_8;
    var $out_7;
    var $in_6;
    if ($in_6 >>> 0 < $9 >>> 0 & $out_7 >>> 0 < $17 >>> 0) {
      var $in_0 = $in_6;
      var $out_0 = $out_7;
      var $bits_0 = $bits_8;
      var $hold_0 = $hold_8;
    } else {
      var $in_7 = $in_6;
      var $out_8 = $out_7;
      var $bits_9 = $bits_8;
      var $hold_9 = $hold_8;
      break;
    }
  }
  do {
    if (label == 626) {
      HEAP32[$strm + 24 >> 2] = STRING_TABLE.__str1578 | 0;
      HEAP32[$2$s2] = 29;
      var $in_7 = $in_4;
      var $out_8 = $out_0;
      var $bits_9 = $120;
      var $hold_9 = $119;
    } else if (label == 629) {
      if (($72 & 32 | 0) == 0) {
        HEAP32[$strm + 24 >> 2] = STRING_TABLE.__str1477 | 0;
        HEAP32[$2$s2] = 29;
        var $in_7 = $in_1;
        var $out_8 = $out_0;
        var $bits_9 = $71;
        var $hold_9 = $70;
        break;
      } else {
        HEAP32[$2$s2] = 11;
        var $in_7 = $in_1;
        var $out_8 = $out_0;
        var $bits_9 = $71;
        var $hold_9 = $70;
        break;
      }
    } else if (label == 596) {
      HEAP32[$strm + 24 >> 2] = STRING_TABLE.__str1679 | 0;
      HEAP32[$2$s2] = 29;
      var $in_7 = $in_5;
      var $out_8 = $out_0;
      var $bits_9 = $149;
      var $hold_9 = $148;
    }
  } while (0);
  var $hold_9;
  var $bits_9;
  var $out_8;
  var $in_7;
  var $298 = $bits_9 >>> 3;
  var $300 = $in_7 + -$298 | 0;
  var $301 = $bits_9 & 7;
  var $304 = (1 << $301) - 1 & $hold_9;
  HEAP32[$4 >> 2] = $in_7 + (1 - $298) | 0;
  HEAP32[$10 >> 2] = $out_8 + 1 | 0;
  if ($300 >>> 0 < $9 >>> 0) {
    var $_in24 = $9 - $300 | 0;
  } else {
    var $_in24 = $9 - $300 | 0;
  }
  var $_in24;
  HEAP32[$7 >> 2] = $_in24 + 5 | 0;
  if ($out_8 >>> 0 < $17 >>> 0) {
    var $_in = $17 - $out_8 | 0;
    var $_in;
    var $328 = $_in + 257 | 0;
    HEAP32[$13$s2] = $328;
    HEAP32[$26$s2] = $304;
    HEAP32[$28$s2] = $301;
    return;
  } else {
    var $_in = $17 - $out_8 | 0;
    var $_in;
    var $328 = $_in + 257 | 0;
    HEAP32[$13$s2] = $328;
    HEAP32[$26$s2] = $304;
    HEAP32[$28$s2] = $301;
    return;
  }
}
_inflate_fast["X"] = 1;
function _inflateResetKeep($strm) {
  var $4$s2;
  var $strm$s2 = $strm >> 2;
  if (($strm | 0) == 0) {
    var $_0 = -2;
    var $_0;
    return $_0;
  }
  var $4 = HEAP32[$strm$s2 + 7], $4$s2 = $4 >> 2;
  if (($4 | 0) == 0) {
    var $_0 = -2;
    var $_0;
    return $_0;
  }
  HEAP32[$4$s2 + 7] = 0;
  HEAP32[$strm$s2 + 5] = 0;
  HEAP32[$strm$s2 + 2] = 0;
  HEAP32[$strm$s2 + 6] = 0;
  var $12 = HEAP32[$4$s2 + 2];
  if (($12 | 0) != 0) {
    HEAP32[$strm$s2 + 12] = $12 & 1;
  }
  HEAP32[$4$s2] = 0;
  HEAP32[$4$s2 + 1] = 0;
  HEAP32[$4$s2 + 3] = 0;
  HEAP32[$4$s2 + 5] = 32768;
  HEAP32[$4$s2 + 8] = 0;
  HEAP32[$4$s2 + 14] = 0;
  HEAP32[$4$s2 + 15] = 0;
  var $_c = $4 + 1328 | 0;
  HEAP32[$4$s2 + 27] = $_c;
  HEAP32[$4$s2 + 20] = $_c;
  HEAP32[$4$s2 + 19] = $_c;
  HEAP32[$4$s2 + 1776] = 1;
  HEAP32[$4$s2 + 1777] = -1;
  var $_0 = 0;
  var $_0;
  return $_0;
}
_inflateResetKeep["X"] = 1;
function _inflateReset($strm) {
  var $4$s2;
  if (($strm | 0) == 0) {
    var $_0 = -2;
    var $_0;
    return $_0;
  }
  var $4 = HEAP32[$strm + 28 >> 2], $4$s2 = $4 >> 2;
  if (($4 | 0) == 0) {
    var $_0 = -2;
    var $_0;
    return $_0;
  }
  HEAP32[$4$s2 + 10] = 0;
  HEAP32[$4$s2 + 11] = 0;
  HEAP32[$4$s2 + 12] = 0;
  var $_0 = _inflateResetKeep($strm);
  var $_0;
  return $_0;
}
function _inflateReset2($strm, $windowBits) {
  if (($strm | 0) == 0) {
    var $_0 = -2;
    var $_0;
    return $_0;
  }
  var $4 = HEAP32[$strm + 28 >> 2];
  if (($4 | 0) == 0) {
    var $_0 = -2;
    var $_0;
    return $_0;
  }
  if (($windowBits | 0) < 0) {
    var $wrap_0 = 0;
    var $_02 = -$windowBits | 0;
  } else {
    var $wrap_0 = ($windowBits >> 4) + 1 | 0;
    var $_02 = ($windowBits | 0) < 48 ? $windowBits & 15 : $windowBits;
  }
  var $_02;
  var $wrap_0;
  if (($_02 | 0) != 0 & ($_02 - 8 | 0) >>> 0 > 7) {
    var $_0 = -2;
    var $_0;
    return $_0;
  }
  var $19 = $4 + 52 | 0;
  var $21 = HEAP32[$19 >> 2];
  var $_pre = $4 + 36 | 0;
  do {
    if (($21 | 0) != 0) {
      if ((HEAP32[$_pre >> 2] | 0) == ($_02 | 0)) {
        break;
      }
      FUNCTION_TABLE[HEAP32[$strm + 36 >> 2]](HEAP32[$strm + 40 >> 2], $21);
      HEAP32[$19 >> 2] = 0;
    }
  } while (0);
  HEAP32[$4 + 8 >> 2] = $wrap_0;
  HEAP32[$_pre >> 2] = $_02;
  var $_0 = _inflateReset($strm);
  var $_0;
  return $_0;
}
function _inflateInit2_($strm, $windowBits) {
  var $11$s2;
  if (($strm | 0) == 0) {
    var $_0 = -2;
    var $_0;
    return $_0;
  }
  HEAP32[$strm + 24 >> 2] = 0;
  var $4 = $strm + 32 | 0;
  var $5 = HEAP32[$4 >> 2];
  if (($5 | 0) == 0) {
    HEAP32[$4 >> 2] = 4;
    HEAP32[$strm + 40 >> 2] = 0;
    var $10 = 4;
  } else {
    var $10 = $5;
  }
  var $10;
  var $11$s2 = ($strm + 36 | 0) >> 2;
  if ((HEAP32[$11$s2] | 0) == 0) {
    HEAP32[$11$s2] = 10;
  }
  var $15 = $strm + 40 | 0;
  var $17 = FUNCTION_TABLE[$10](HEAP32[$15 >> 2], 1, 7116);
  if (($17 | 0) == 0) {
    var $_0 = -4;
    var $_0;
    return $_0;
  }
  var $21 = $strm + 28 | 0;
  HEAP32[$21 >> 2] = $17;
  HEAP32[$17 + 52 >> 2] = 0;
  var $24 = _inflateReset2($strm, $windowBits);
  if (($24 | 0) == 0) {
    var $_0 = 0;
    var $_0;
    return $_0;
  }
  FUNCTION_TABLE[HEAP32[$11$s2]](HEAP32[$15 >> 2], $17);
  HEAP32[$21 >> 2] = 0;
  var $_0 = $24;
  var $_0;
  return $_0;
}
function _inflate($strm) {
  var $289$s2;
  var $72$s1;
  var $70$s2;
  var $68$s2;
  var $67$s2;
  var $64$s2;
  var $63$s2;
  var $56$s2;
  var $54$s2;
  var $51$s2;
  var $50$s2;
  var $48$s2;
  var $46$s2;
  var $45$s2;
  var $42$s2;
  var $41$s2;
  var $39$s2;
  var $36$s2;
  var $35$s2;
  var $33$s2;
  var $31$s2;
  var $29$s2;
  var $27$s2;
  var $20$s2;
  var $11$s2;
  var $7$s2;
  var __stackBase__ = STACKTOP;
  STACKTOP += 4;
  var label;
  var $hbuf = __stackBase__;
  if (($strm | 0) == 0) {
    var $_0 = -2;
    var $_0;
    STACKTOP = __stackBase__;
    return $_0;
  }
  var $4 = HEAP32[$strm + 28 >> 2];
  if (($4 | 0) == 0) {
    var $_0 = -2;
    var $_0;
    STACKTOP = __stackBase__;
    return $_0;
  }
  var $7$s2 = ($strm + 12 | 0) >> 2;
  var $8 = HEAP32[$7$s2];
  if (($8 | 0) == 0) {
    var $_0 = -2;
    var $_0;
    STACKTOP = __stackBase__;
    return $_0;
  }
  var $11$s2 = ($strm | 0) >> 2;
  var $12 = HEAP32[$11$s2];
  do {
    if (($12 | 0) == 0) {
      if ((HEAP32[$strm + 4 >> 2] | 0) == 0) {
        break;
      } else {
        var $_0 = -2;
      }
      var $_0;
      STACKTOP = __stackBase__;
      return $_0;
    }
  } while (0);
  var $19 = $4;
  var $20$s2 = ($4 | 0) >> 2;
  var $21 = HEAP32[$20$s2];
  if (($21 | 0) == 11) {
    HEAP32[$20$s2] = 12;
    var $26 = HEAP32[$7$s2];
    var $25 = HEAP32[$11$s2];
    var $24 = 12;
  } else {
    var $26 = $8;
    var $25 = $12;
    var $24 = $21;
  }
  var $24;
  var $25;
  var $26;
  var $27$s2 = ($strm + 16 | 0) >> 2;
  var $28 = HEAP32[$27$s2];
  var $29$s2 = ($strm + 4 | 0) >> 2;
  var $30 = HEAP32[$29$s2];
  var $31$s2 = ($4 + 56 | 0) >> 2;
  var $33$s2 = ($4 + 60 | 0) >> 2;
  var $35$s2 = ($4 + 8 | 0) >> 2;
  var $36$s2 = ($4 + 24 | 0) >> 2;
  var $37 = $hbuf | 0;
  var $38 = $hbuf + 1 | 0;
  var $39$s2 = ($4 + 16 | 0) >> 2;
  var $41$s2 = ($4 + 32 | 0) >> 2;
  var $42$s2 = ($strm + 24 | 0) >> 2;
  var $43 = $4 + 36 | 0;
  var $44 = $4 + 20 | 0;
  var $45$s2 = ($strm + 48 | 0) >> 2;
  var $46$s2 = ($4 + 64 | 0) >> 2;
  var $47 = $4 + 12 | 0;
  var $48$s2 = ($4 + 4 | 0) >> 2;
  var $49 = $strm;
  var $50$s2 = ($4 + 7108 | 0) >> 2;
  var $51 = $4 + 84 | 0, $51$s2 = $51 >> 2;
  var $53 = $4 + 76 | 0;
  var $54$s2 = ($4 + 72 | 0) >> 2;
  var $55 = $4 + 7112 | 0;
  var $56$s2 = ($4 + 68 | 0) >> 2;
  var $57 = $4 + 44 | 0;
  var $58 = $4 + 7104 | 0;
  var $59 = $4 + 48 | 0;
  var $61 = $4 + 52 | 0;
  var $62 = $4 + 40 | 0;
  var $63$s2 = ($strm + 20 | 0) >> 2;
  var $64$s2 = ($4 + 28 | 0) >> 2;
  var $65 = $hbuf + 2 | 0;
  var $66 = $hbuf + 3 | 0;
  var $67$s2 = ($4 + 96 | 0) >> 2;
  var $68$s2 = ($4 + 100 | 0) >> 2;
  var $69 = $4 + 92 | 0;
  var $70$s2 = ($4 + 104 | 0) >> 2;
  var $71 = $4 + 112 | 0;
  var $72$s1 = $71 >> 1;
  var $74 = $4 + 108 | 0;
  var $75 = $74;
  var $76 = $74 | 0;
  var $_c45 = $4 + 1328 | 0;
  var $77 = $4 + 76 | 0;
  var $78 = $71;
  var $80 = $4 + 752 | 0;
  var $82 = $4 + 624 | 0;
  var $83 = $4 + 80 | 0;
  var $84 = $4 + 88 | 0;
  var $86 = $4 + 80 | 0;
  var $ret_0 = 0;
  var $next_0 = $25;
  var $put_0 = $26;
  var $have_0 = $30;
  var $left_0 = $28;
  var $hold_0 = HEAP32[$31$s2];
  var $bits_0 = HEAP32[$33$s2];
  var $out_0 = $28;
  var $87 = $24;
  L917 : while (1) {
    var $87;
    var $out_0;
    var $bits_0;
    var $hold_0;
    var $left_0;
    var $have_0;
    var $put_0;
    var $next_0;
    var $ret_0;
    L919 : do {
      if (($87 | 0) == 13) {
        var $483 = $bits_0 & 7;
        var $next_23 = $next_0;
        var $have_23 = $have_0;
        var $hold_19 = $hold_0 >>> ($483 >>> 0);
        var $bits_19 = $bits_0 - $483 | 0;
        while (1) {
          var $bits_19;
          var $hold_19;
          var $have_23;
          var $next_23;
          if ($bits_19 >>> 0 >= 32) {
            break;
          }
          if (($have_23 | 0) == 0) {
            var $ret_8 = $ret_0;
            var $next_57 = $next_23;
            var $have_57 = 0;
            var $hold_53 = $hold_19;
            var $bits_53 = $bits_19;
            var $out_4 = $out_0;
            break L917;
          }
          var $496 = ((HEAP8[$next_23] & 255) << $bits_19) + $hold_19 | 0;
          var $next_23 = $next_23 + 1 | 0;
          var $have_23 = $have_23 - 1 | 0;
          var $hold_19 = $496;
          var $bits_19 = $bits_19 + 8 | 0;
        }
        var $499 = $hold_19 & 65535;
        if (($499 | 0) == ($hold_19 >>> 16 ^ 65535 | 0)) {
          HEAP32[$46$s2] = $499;
          HEAP32[$20$s2] = 14;
          var $next_24 = $next_23;
          var $have_24 = $have_23;
          var $hold_20 = 0;
          var $bits_20 = 0;
          label = 826;
          break;
        } else {
          HEAP32[$42$s2] = STRING_TABLE.__str770 | 0;
          HEAP32[$20$s2] = 29;
          var $ret_0_be = $ret_0;
          var $next_0_be = $next_23;
          var $put_0_be = $put_0;
          var $have_0_be = $have_23;
          var $left_0_be = $left_0;
          var $hold_0_be = $hold_19;
          var $bits_0_be = $bits_19;
          var $out_0_be = $out_0;
          break;
        }
      } else if (($87 | 0) == 20) {
        var $ret_3 = $ret_0;
        var $next_37 = $next_0;
        var $have_37 = $have_0;
        var $hold_33 = $hold_0;
        var $bits_33 = $bits_0;
        label = 886;
      } else if (($87 | 0) == 14) {
        var $next_24 = $next_0;
        var $have_24 = $have_0;
        var $hold_20 = $hold_0;
        var $bits_20 = $bits_0;
        label = 826;
      } else if (($87 | 0) == 15) {
        var $next_25 = $next_0;
        var $have_25 = $have_0;
        var $hold_21 = $hold_0;
        var $bits_21 = $bits_0;
        label = 827;
      } else if (($87 | 0) == 11 || ($87 | 0) == 12) {
        var $next_21 = $next_0;
        var $have_21 = $have_0;
        var $hold_17 = $hold_0;
        var $bits_17 = $bits_0;
        label = 808;
      } else if (($87 | 0) == 6) {
        var $next_11 = $next_0;
        var $have_11 = $have_0;
        var $hold_9 = $hold_0;
        var $bits_9 = $bits_0;
        var $324 = HEAP32[$39$s2];
        label = 766;
        break;
      } else if (($87 | 0) == 21) {
        var $ret_4 = $ret_0;
        var $next_41 = $next_0;
        var $have_41 = $have_0;
        var $hold_37 = $hold_0;
        var $bits_37 = $bits_0;
        var $790 = HEAP32[$54$s2];
        label = 907;
        break;
      } else if (($87 | 0) == 23) {
        var $ret_6 = $ret_0;
        var $next_47 = $next_0;
        var $have_47 = $have_0;
        var $hold_43 = $hold_0;
        var $bits_43 = $bits_0;
        var $877 = HEAP32[$54$s2];
        label = 928;
        break;
      } else if (($87 | 0) == 0) {
        var $89 = HEAP32[$35$s2];
        if (($89 | 0) == 0) {
          HEAP32[$20$s2] = 12;
          var $ret_0_be = $ret_0;
          var $next_0_be = $next_0;
          var $put_0_be = $put_0;
          var $have_0_be = $have_0;
          var $left_0_be = $left_0;
          var $hold_0_be = $hold_0;
          var $bits_0_be = $bits_0;
          var $out_0_be = $out_0;
          break;
        } else {
          var $next_1 = $next_0;
          var $have_1 = $have_0;
          var $hold_1 = $hold_0;
          var $bits_1 = $bits_0;
        }
        while (1) {
          var $bits_1;
          var $hold_1;
          var $have_1;
          var $next_1;
          if ($bits_1 >>> 0 >= 16) {
            break;
          }
          if (($have_1 | 0) == 0) {
            var $ret_8 = $ret_0;
            var $next_57 = $next_1;
            var $have_57 = 0;
            var $hold_53 = $hold_1;
            var $bits_53 = $bits_1;
            var $out_4 = $out_0;
            break L917;
          }
          var $101 = ((HEAP8[$next_1] & 255) << $bits_1) + $hold_1 | 0;
          var $next_1 = $next_1 + 1 | 0;
          var $have_1 = $have_1 - 1 | 0;
          var $hold_1 = $101;
          var $bits_1 = $bits_1 + 8 | 0;
        }
        if (($89 & 2 | 0) != 0 & ($hold_1 | 0) == 35615) {
          HEAP32[$36$s2] = _crc32(0, 0, 0);
          HEAP8[$37] = 31;
          HEAP8[$38] = -117;
          HEAP32[$36$s2] = _crc32(HEAP32[$36$s2], $37, 2);
          HEAP32[$20$s2] = 1;
          var $ret_0_be = $ret_0;
          var $next_0_be = $next_1;
          var $put_0_be = $put_0;
          var $have_0_be = $have_1;
          var $left_0_be = $left_0;
          var $hold_0_be = 0;
          var $bits_0_be = 0;
          var $out_0_be = $out_0;
          break;
        }
        HEAP32[$39$s2] = 0;
        var $112 = HEAP32[$41$s2];
        if (($112 | 0) == 0) {
          var $117 = $89;
        } else {
          HEAP32[$112 + 48 >> 2] = -1;
          var $117 = HEAP32[$35$s2];
        }
        var $117;
        do {
          if (($117 & 1 | 0) != 0) {
            if ((((($hold_1 << 8 & 65280) + ($hold_1 >>> 8) | 0) >>> 0) % 31 | 0) != 0) {
              break;
            }
            if (($hold_1 & 15 | 0) != 8) {
              HEAP32[$42$s2] = STRING_TABLE.__str265 | 0;
              HEAP32[$20$s2] = 29;
              var $ret_0_be = $ret_0;
              var $next_0_be = $next_1;
              var $put_0_be = $put_0;
              var $have_0_be = $have_1;
              var $left_0_be = $left_0;
              var $hold_0_be = $hold_1;
              var $bits_0_be = $bits_1;
              var $out_0_be = $out_0;
              break L919;
            }
            var $133 = $hold_1 >>> 4;
            var $134 = $bits_1 - 4 | 0;
            var $136 = ($133 & 15) + 8 | 0;
            var $137 = HEAP32[$43 >> 2];
            do {
              if (($137 | 0) == 0) {
                HEAP32[$43 >> 2] = $136;
              } else {
                if ($136 >>> 0 <= $137 >>> 0) {
                  break;
                }
                HEAP32[$42$s2] = STRING_TABLE.__str366 | 0;
                HEAP32[$20$s2] = 29;
                var $ret_0_be = $ret_0;
                var $next_0_be = $next_1;
                var $put_0_be = $put_0;
                var $have_0_be = $have_1;
                var $left_0_be = $left_0;
                var $hold_0_be = $133;
                var $bits_0_be = $134;
                var $out_0_be = $out_0;
                break L919;
              }
            } while (0);
            HEAP32[$44 >> 2] = 1 << $136;
            var $145 = _adler32(0, 0, 0);
            HEAP32[$36$s2] = $145;
            HEAP32[$45$s2] = $145;
            HEAP32[$20$s2] = $hold_1 >>> 12 & 2 ^ 11;
            var $ret_0_be = $ret_0;
            var $next_0_be = $next_1;
            var $put_0_be = $put_0;
            var $have_0_be = $have_1;
            var $left_0_be = $left_0;
            var $hold_0_be = 0;
            var $bits_0_be = 0;
            var $out_0_be = $out_0;
            break L919;
          }
        } while (0);
        HEAP32[$42$s2] = STRING_TABLE.__str164 | 0;
        HEAP32[$20$s2] = 29;
        var $ret_0_be = $ret_0;
        var $next_0_be = $next_1;
        var $put_0_be = $put_0;
        var $have_0_be = $have_1;
        var $left_0_be = $left_0;
        var $hold_0_be = $hold_1;
        var $bits_0_be = $bits_1;
        var $out_0_be = $out_0;
        break;
      } else if (($87 | 0) == 1) {
        var $next_2 = $next_0;
        var $have_2 = $have_0;
        var $hold_2 = $hold_0;
        var $bits_2 = $bits_0;
        while (1) {
          var $bits_2;
          var $hold_2;
          var $have_2;
          var $next_2;
          if ($bits_2 >>> 0 >= 16) {
            break;
          }
          if (($have_2 | 0) == 0) {
            var $ret_8 = $ret_0;
            var $next_57 = $next_2;
            var $have_57 = 0;
            var $hold_53 = $hold_2;
            var $bits_53 = $bits_2;
            var $out_4 = $out_0;
            break L917;
          }
          var $158 = ((HEAP8[$next_2] & 255) << $bits_2) + $hold_2 | 0;
          var $next_2 = $next_2 + 1 | 0;
          var $have_2 = $have_2 - 1 | 0;
          var $hold_2 = $158;
          var $bits_2 = $bits_2 + 8 | 0;
        }
        HEAP32[$39$s2] = $hold_2;
        if (($hold_2 & 255 | 0) != 8) {
          HEAP32[$42$s2] = STRING_TABLE.__str265 | 0;
          HEAP32[$20$s2] = 29;
          var $ret_0_be = $ret_0;
          var $next_0_be = $next_2;
          var $put_0_be = $put_0;
          var $have_0_be = $have_2;
          var $left_0_be = $left_0;
          var $hold_0_be = $hold_2;
          var $bits_0_be = $bits_2;
          var $out_0_be = $out_0;
          break;
        }
        if (($hold_2 & 57344 | 0) != 0) {
          HEAP32[$42$s2] = STRING_TABLE.__str467 | 0;
          HEAP32[$20$s2] = 29;
          var $ret_0_be = $ret_0;
          var $next_0_be = $next_2;
          var $put_0_be = $put_0;
          var $have_0_be = $have_2;
          var $left_0_be = $left_0;
          var $hold_0_be = $hold_2;
          var $bits_0_be = $bits_2;
          var $out_0_be = $out_0;
          break;
        }
        var $169 = HEAP32[$41$s2];
        if (($169 | 0) == 0) {
          var $176 = $hold_2;
        } else {
          HEAP32[$169 >> 2] = $hold_2 >>> 8 & 1;
          var $176 = HEAP32[$39$s2];
        }
        var $176;
        if (($176 & 512 | 0) != 0) {
          HEAP8[$37] = $hold_2 & 255;
          HEAP8[$38] = $hold_2 >>> 8 & 255;
          HEAP32[$36$s2] = _crc32(HEAP32[$36$s2], $37, 2);
        }
        HEAP32[$20$s2] = 2;
        var $next_3 = $next_2;
        var $have_3 = $have_2;
        var $hold_3 = 0;
        var $bits_3 = 0;
        label = 729;
        break;
      } else if (($87 | 0) == 2) {
        var $next_3 = $next_0;
        var $have_3 = $have_0;
        var $hold_3 = $hold_0;
        var $bits_3 = $bits_0;
        label = 729;
      } else if (($87 | 0) == 3) {
        var $next_4 = $next_0;
        var $have_4 = $have_0;
        var $hold_4 = $hold_0;
        var $bits_4 = $bits_0;
        label = 737;
      } else if (($87 | 0) == 4) {
        var $next_5 = $next_0;
        var $have_5 = $have_0;
        var $hold_5 = $hold_0;
        var $bits_5 = $bits_0;
        label = 745;
      } else if (($87 | 0) == 5) {
        var $next_8 = $next_0;
        var $have_8 = $have_0;
        var $hold_8 = $hold_0;
        var $bits_8 = $bits_0;
        label = 756;
      } else if (($87 | 0) == 7) {
        var $next_13 = $next_0;
        var $have_13 = $have_0;
        var $hold_10 = $hold_0;
        var $bits_10 = $bits_0;
        label = 779;
      } else if (($87 | 0) == 8) {
        var $next_15 = $next_0;
        var $have_15 = $have_0;
        var $hold_11 = $hold_0;
        var $bits_11 = $bits_0;
        label = 792;
      } else if (($87 | 0) == 9) {
        var $next_18 = $next_0;
        var $have_18 = $have_0;
        var $hold_14 = $hold_0;
        var $bits_14 = $bits_0;
        while (1) {
          var $bits_14;
          var $hold_14;
          var $have_18;
          var $next_18;
          if ($bits_14 >>> 0 >= 32) {
            break;
          }
          if (($have_18 | 0) == 0) {
            var $ret_8 = $ret_0;
            var $next_57 = $next_18;
            var $have_57 = 0;
            var $hold_53 = $hold_14;
            var $bits_53 = $bits_14;
            var $out_4 = $out_0;
            break L917;
          }
          var $444 = ((HEAP8[$next_18] & 255) << $bits_14) + $hold_14 | 0;
          var $next_18 = $next_18 + 1 | 0;
          var $have_18 = $have_18 - 1 | 0;
          var $hold_14 = $444;
          var $bits_14 = $bits_14 + 8 | 0;
        }
        var $447 = _llvm_bswap_i32($hold_14);
        HEAP32[$36$s2] = $447;
        HEAP32[$45$s2] = $447;
        HEAP32[$20$s2] = 10;
        var $next_19 = $next_18;
        var $have_19 = $have_18;
        var $hold_15 = 0;
        var $bits_15 = 0;
        label = 805;
        break;
      } else if (($87 | 0) == 22) {
        var $ret_5_ph = $ret_0;
        var $next_44_ph = $next_0;
        var $have_44_ph = $have_0;
        var $hold_40_ph = $hold_0;
        var $bits_40_ph = $bits_0;
        label = 914;
      } else if (($87 | 0) == 10) {
        var $next_19 = $next_0;
        var $have_19 = $have_0;
        var $hold_15 = $hold_0;
        var $bits_15 = $bits_0;
        label = 805;
      } else if (($87 | 0) == 24) {
        var $ret_7 = $ret_0;
        var $next_50 = $next_0;
        var $have_50 = $have_0;
        var $hold_46 = $hold_0;
        var $bits_46 = $bits_0;
        label = 934;
      } else if (($87 | 0) == 16) {
        var $next_26 = $next_0;
        var $have_26 = $have_0;
        var $hold_22 = $hold_0;
        var $bits_22 = $bits_0;
        while (1) {
          var $bits_22;
          var $hold_22;
          var $have_26;
          var $next_26;
          if ($bits_22 >>> 0 >= 14) {
            break;
          }
          if (($have_26 | 0) == 0) {
            var $ret_8 = $ret_0;
            var $next_57 = $next_26;
            var $have_57 = 0;
            var $hold_53 = $hold_22;
            var $bits_53 = $bits_22;
            var $out_4 = $out_0;
            break L917;
          }
          var $529 = ((HEAP8[$next_26] & 255) << $bits_22) + $hold_22 | 0;
          var $next_26 = $next_26 + 1 | 0;
          var $have_26 = $have_26 - 1 | 0;
          var $hold_22 = $529;
          var $bits_22 = $bits_22 + 8 | 0;
        }
        var $533 = ($hold_22 & 31) + 257 | 0;
        HEAP32[$67$s2] = $533;
        var $536 = ($hold_22 >>> 5 & 31) + 1 | 0;
        HEAP32[$68$s2] = $536;
        HEAP32[$69 >> 2] = ($hold_22 >>> 10 & 15) + 4 | 0;
        var $540 = $hold_22 >>> 14;
        var $541 = $bits_22 - 14 | 0;
        if ($533 >>> 0 > 286 | $536 >>> 0 > 30) {
          HEAP32[$42$s2] = STRING_TABLE.__str871 | 0;
          HEAP32[$20$s2] = 29;
          var $ret_0_be = $ret_0;
          var $next_0_be = $next_26;
          var $put_0_be = $put_0;
          var $have_0_be = $have_26;
          var $left_0_be = $left_0;
          var $hold_0_be = $540;
          var $bits_0_be = $541;
          var $out_0_be = $out_0;
          break;
        } else {
          HEAP32[$70$s2] = 0;
          HEAP32[$20$s2] = 17;
          var $next_27 = $next_26;
          var $have_27 = $have_26;
          var $hold_23 = $540;
          var $bits_23 = $541;
          label = 837;
          break;
        }
      } else if (($87 | 0) == 19) {
        var $ret_2 = $ret_0;
        var $next_36 = $next_0;
        var $have_36 = $have_0;
        var $hold_32 = $hold_0;
        var $bits_32 = $bits_0;
        label = 885;
      } else if (($87 | 0) == 25) {
        if (($left_0 | 0) == 0) {
          var $ret_8 = $ret_0;
          var $next_57 = $next_0;
          var $have_57 = $have_0;
          var $hold_53 = $hold_0;
          var $bits_53 = $bits_0;
          var $out_4 = $out_0;
          break L917;
        }
        HEAP8[$put_0] = HEAP32[$46$s2] & 255;
        HEAP32[$20$s2] = 20;
        var $ret_0_be = $ret_0;
        var $next_0_be = $next_0;
        var $put_0_be = $put_0 + 1 | 0;
        var $have_0_be = $have_0;
        var $left_0_be = $left_0 - 1 | 0;
        var $hold_0_be = $hold_0;
        var $bits_0_be = $bits_0;
        var $out_0_be = $out_0;
        break;
      } else if (($87 | 0) == 26) {
        do {
          if ((HEAP32[$35$s2] | 0) == 0) {
            var $next_52 = $next_0;
            var $have_52 = $have_0;
            var $hold_48 = $hold_0;
            var $bits_48 = $bits_0;
            var $out_1 = $out_0;
          } else {
            var $next_51 = $next_0;
            var $have_51 = $have_0;
            var $hold_47 = $hold_0;
            var $bits_47 = $bits_0;
            while (1) {
              var $bits_47;
              var $hold_47;
              var $have_51;
              var $next_51;
              if ($bits_47 >>> 0 >= 32) {
                break;
              }
              if (($have_51 | 0) == 0) {
                var $ret_8 = $ret_0;
                var $next_57 = $next_51;
                var $have_57 = 0;
                var $hold_53 = $hold_47;
                var $bits_53 = $bits_47;
                var $out_4 = $out_0;
                break L917;
              }
              var $973 = ((HEAP8[$next_51] & 255) << $bits_47) + $hold_47 | 0;
              var $next_51 = $next_51 + 1 | 0;
              var $have_51 = $have_51 - 1 | 0;
              var $hold_47 = $973;
              var $bits_47 = $bits_47 + 8 | 0;
            }
            var $976 = $out_0 - $left_0 | 0;
            HEAP32[$63$s2] = HEAP32[$63$s2] + $976 | 0;
            HEAP32[$64$s2] = HEAP32[$64$s2] + $976 | 0;
            if (($out_0 | 0) != ($left_0 | 0)) {
              var $985 = HEAP32[$36$s2];
              var $987 = $put_0 + -$976 | 0;
              if ((HEAP32[$39$s2] | 0) == 0) {
                var $993 = _adler32($985, $987, $976);
              } else {
                var $993 = _crc32($985, $987, $976);
              }
              var $993;
              HEAP32[$36$s2] = $993;
              HEAP32[$45$s2] = $993;
            }
            if ((HEAP32[$39$s2] | 0) == 0) {
              var $1000 = _llvm_bswap_i32($hold_47);
            } else {
              var $1000 = $hold_47;
            }
            var $1000;
            if (($1000 | 0) == (HEAP32[$36$s2] | 0)) {
              var $next_52 = $next_51;
              var $have_52 = $have_51;
              var $hold_48 = 0;
              var $bits_48 = 0;
              var $out_1 = $left_0;
              break;
            }
            HEAP32[$42$s2] = STRING_TABLE.__str17 | 0;
            HEAP32[$20$s2] = 29;
            var $ret_0_be = $ret_0;
            var $next_0_be = $next_51;
            var $put_0_be = $put_0;
            var $have_0_be = $have_51;
            var $left_0_be = $left_0;
            var $hold_0_be = $hold_47;
            var $bits_0_be = $bits_47;
            var $out_0_be = $left_0;
            break L919;
          }
        } while (0);
        var $out_1;
        var $bits_48;
        var $hold_48;
        var $have_52;
        var $next_52;
        HEAP32[$20$s2] = 27;
        var $next_53 = $next_52;
        var $have_53 = $have_52;
        var $hold_49 = $hold_48;
        var $bits_49 = $bits_48;
        var $out_2 = $out_1;
        label = 966;
        break;
      } else if (($87 | 0) == 18) {
        var $ret_1_ph = $ret_0;
        var $next_29_ph = $next_0;
        var $have_29_ph = $have_0;
        var $hold_25_ph = $hold_0;
        var $bits_25_ph = $bits_0;
        label = 847;
      } else if (($87 | 0) == 17) {
        var $next_27 = $next_0;
        var $have_27 = $have_0;
        var $hold_23 = $hold_0;
        var $bits_23 = $bits_0;
        label = 837;
      } else if (($87 | 0) == 27) {
        var $next_53 = $next_0;
        var $have_53 = $have_0;
        var $hold_49 = $hold_0;
        var $bits_49 = $bits_0;
        var $out_2 = $out_0;
        label = 966;
      } else if (($87 | 0) == 29) {
        label = 974;
        break L917;
      } else if (($87 | 0) == 28) {
        var $ret_8 = 1;
        var $next_57 = $next_0;
        var $have_57 = $have_0;
        var $hold_53 = $hold_0;
        var $bits_53 = $bits_0;
        var $out_4 = $out_0;
        break L917;
      } else if (($87 | 0) == 30) {
        var $_0 = -4;
        label = 995;
        break L917;
      } else {
        label = 989;
        break L917;
      }
    } while (0);
    do {
      if (label == 826) {
        label = 0;
        var $bits_20;
        var $hold_20;
        var $have_24;
        var $next_24;
        HEAP32[$20$s2] = 15;
        var $next_25 = $next_24;
        var $have_25 = $have_24;
        var $hold_21 = $hold_20;
        var $bits_21 = $bits_20;
        label = 827;
        break;
      } else if (label == 729) {
        while (1) {
          label = 0;
          var $bits_3;
          var $hold_3;
          var $have_3;
          var $next_3;
          if ($bits_3 >>> 0 >= 32) {
            break;
          }
          if (($have_3 | 0) == 0) {
            var $ret_8 = $ret_0;
            var $next_57 = $next_3;
            var $have_57 = 0;
            var $hold_53 = $hold_3;
            var $bits_53 = $bits_3;
            var $out_4 = $out_0;
            break L917;
          }
          var $195 = ((HEAP8[$next_3] & 255) << $bits_3) + $hold_3 | 0;
          var $next_3 = $next_3 + 1 | 0;
          var $have_3 = $have_3 - 1 | 0;
          var $hold_3 = $195;
          var $bits_3 = $bits_3 + 8 | 0;
        }
        var $198 = HEAP32[$41$s2];
        if (($198 | 0) != 0) {
          HEAP32[$198 + 4 >> 2] = $hold_3;
        }
        if ((HEAP32[$39$s2] & 512 | 0) != 0) {
          HEAP8[$37] = $hold_3 & 255;
          HEAP8[$38] = $hold_3 >>> 8 & 255;
          HEAP8[$65] = $hold_3 >>> 16 & 255;
          HEAP8[$66] = $hold_3 >>> 24 & 255;
          HEAP32[$36$s2] = _crc32(HEAP32[$36$s2], $37, 4);
        }
        HEAP32[$20$s2] = 3;
        var $next_4 = $next_3;
        var $have_4 = $have_3;
        var $hold_4 = 0;
        var $bits_4 = 0;
        label = 737;
        break;
      } else if (label == 805) {
        label = 0;
        var $bits_15;
        var $hold_15;
        var $have_19;
        var $next_19;
        if ((HEAP32[$47 >> 2] | 0) == 0) {
          label = 806;
          break L917;
        }
        var $453 = _adler32(0, 0, 0);
        HEAP32[$36$s2] = $453;
        HEAP32[$45$s2] = $453;
        HEAP32[$20$s2] = 11;
        var $next_21 = $next_19;
        var $have_21 = $have_19;
        var $hold_17 = $hold_15;
        var $bits_17 = $bits_15;
        label = 808;
        break;
      } else if (label == 837) {
        while (1) {
          label = 0;
          var $bits_23;
          var $hold_23;
          var $have_27;
          var $next_27;
          var $546 = HEAP32[$70$s2];
          if ($546 >>> 0 < HEAP32[$69 >> 2] >>> 0) {
            var $next_28 = $next_27;
            var $have_28 = $have_27;
            var $hold_24 = $hold_23;
            var $bits_24 = $bits_23;
          } else {
            break;
          }
          while (1) {
            var $bits_24;
            var $hold_24;
            var $have_28;
            var $next_28;
            if ($bits_24 >>> 0 >= 3) {
              break;
            }
            if (($have_28 | 0) == 0) {
              var $ret_8 = $ret_0;
              var $next_57 = $next_28;
              var $have_57 = 0;
              var $hold_53 = $hold_24;
              var $bits_53 = $bits_24;
              var $out_4 = $out_0;
              break L917;
            }
            var $558 = ((HEAP8[$next_28] & 255) << $bits_24) + $hold_24 | 0;
            var $next_28 = $next_28 + 1 | 0;
            var $have_28 = $have_28 - 1 | 0;
            var $hold_24 = $558;
            var $bits_24 = $bits_24 + 8 | 0;
          }
          HEAP32[$70$s2] = $546 + 1 | 0;
          HEAP16[((HEAP16[_inflate_order + ($546 << 1) >> 1] & 65535) << 1 >> 1) + $72$s1] = $hold_24 & 65535 & 7;
          var $next_27 = $next_28;
          var $have_27 = $have_28;
          var $hold_23 = $hold_24 >>> 3;
          var $bits_23 = $bits_24 - 3 | 0;
        }
        var $569 = $546 >>> 0 < 19;
        L1032 : do {
          if ($569) {
            var $570 = $546;
            while (1) {
              var $570;
              HEAP32[$70$s2] = $570 + 1 | 0;
              HEAP16[((HEAP16[_inflate_order + ($570 << 1) >> 1] & 65535) << 1 >> 1) + $72$s1] = 0;
              var $_pr = HEAP32[$70$s2];
              if ($_pr >>> 0 < 19) {
                var $570 = $_pr;
              } else {
                break L1032;
              }
            }
          }
        } while (0);
        HEAP32[$76 >> 2] = $_c45;
        HEAP32[$77 >> 2] = $_c45;
        HEAP32[$51$s2] = 7;
        var $577 = _inflate_table(0, $78, 19, $75, $51, $80);
        if (($577 | 0) == 0) {
          HEAP32[$70$s2] = 0;
          HEAP32[$20$s2] = 18;
          var $ret_1_ph = 0;
          var $next_29_ph = $next_27;
          var $have_29_ph = $have_27;
          var $hold_25_ph = $hold_23;
          var $bits_25_ph = $bits_23;
          label = 847;
          break;
        } else {
          HEAP32[$42$s2] = STRING_TABLE.__str972 | 0;
          HEAP32[$20$s2] = 29;
          var $ret_0_be = $577;
          var $next_0_be = $next_27;
          var $put_0_be = $put_0;
          var $have_0_be = $have_27;
          var $left_0_be = $left_0;
          var $hold_0_be = $hold_23;
          var $bits_0_be = $bits_23;
          var $out_0_be = $out_0;
          break;
        }
      } else if (label == 966) {
        label = 0;
        var $out_2;
        var $bits_49;
        var $hold_49;
        var $have_53;
        var $next_53;
        if ((HEAP32[$35$s2] | 0) == 0) {
          var $next_55 = $next_53;
          var $have_55 = $have_53;
          var $hold_51 = $hold_49;
          var $bits_51 = $bits_49;
          label = 973;
          break L917;
        }
        if ((HEAP32[$39$s2] | 0) == 0) {
          var $next_55 = $next_53;
          var $have_55 = $have_53;
          var $hold_51 = $hold_49;
          var $bits_51 = $bits_49;
          label = 973;
          break L917;
        } else {
          var $next_54 = $next_53;
          var $have_54 = $have_53;
          var $hold_50 = $hold_49;
          var $bits_50 = $bits_49;
        }
        while (1) {
          var $bits_50;
          var $hold_50;
          var $have_54;
          var $next_54;
          if ($bits_50 >>> 0 >= 32) {
            break;
          }
          if (($have_54 | 0) == 0) {
            var $ret_8 = $ret_0;
            var $next_57 = $next_54;
            var $have_57 = 0;
            var $hold_53 = $hold_50;
            var $bits_53 = $bits_50;
            var $out_4 = $out_2;
            break L917;
          }
          var $1019 = ((HEAP8[$next_54] & 255) << $bits_50) + $hold_50 | 0;
          var $next_54 = $next_54 + 1 | 0;
          var $have_54 = $have_54 - 1 | 0;
          var $hold_50 = $1019;
          var $bits_50 = $bits_50 + 8 | 0;
        }
        if (($hold_50 | 0) == (HEAP32[$64$s2] | 0)) {
          var $next_55 = $next_54;
          var $have_55 = $have_54;
          var $hold_51 = 0;
          var $bits_51 = 0;
          label = 973;
          break L917;
        }
        HEAP32[$42$s2] = STRING_TABLE.__str18 | 0;
        HEAP32[$20$s2] = 29;
        var $ret_0_be = $ret_0;
        var $next_0_be = $next_54;
        var $put_0_be = $put_0;
        var $have_0_be = $have_54;
        var $left_0_be = $left_0;
        var $hold_0_be = $hold_50;
        var $bits_0_be = $bits_50;
        var $out_0_be = $out_2;
        break;
      }
    } while (0);
    do {
      if (label == 827) {
        label = 0;
        var $bits_21;
        var $hold_21;
        var $have_25;
        var $next_25;
        var $506 = HEAP32[$46$s2];
        if (($506 | 0) == 0) {
          HEAP32[$20$s2] = 11;
          var $ret_0_be = $ret_0;
          var $next_0_be = $next_25;
          var $put_0_be = $put_0;
          var $have_0_be = $have_25;
          var $left_0_be = $left_0;
          var $hold_0_be = $hold_21;
          var $bits_0_be = $bits_21;
          var $out_0_be = $out_0;
          break;
        }
        var $copy_3 = $506 >>> 0 > $have_25 >>> 0 ? $have_25 : $506;
        var $copy_4 = $copy_3 >>> 0 > $left_0 >>> 0 ? $left_0 : $copy_3;
        if (($copy_4 | 0) == 0) {
          var $ret_8 = $ret_0;
          var $next_57 = $next_25;
          var $have_57 = $have_25;
          var $hold_53 = $hold_21;
          var $bits_53 = $bits_21;
          var $out_4 = $out_0;
          break L917;
        }
        _memcpy($put_0, $next_25, $copy_4, 1);
        HEAP32[$46$s2] = HEAP32[$46$s2] - $copy_4 | 0;
        var $ret_0_be = $ret_0;
        var $next_0_be = $next_25 + $copy_4 | 0;
        var $put_0_be = $put_0 + $copy_4 | 0;
        var $have_0_be = $have_25 - $copy_4 | 0;
        var $left_0_be = $left_0 - $copy_4 | 0;
        var $hold_0_be = $hold_21;
        var $bits_0_be = $bits_21;
        var $out_0_be = $out_0;
        break;
      } else if (label == 808) {
        label = 0;
        var $bits_17;
        var $hold_17;
        var $have_21;
        var $next_21;
        if ((HEAP32[$48$s2] | 0) == 0) {
          var $next_22 = $next_21;
          var $have_22 = $have_21;
          var $hold_18 = $hold_17;
          var $bits_18 = $bits_17;
        } else {
          var $457 = $bits_17 & 7;
          HEAP32[$20$s2] = 26;
          var $ret_0_be = $ret_0;
          var $next_0_be = $next_21;
          var $put_0_be = $put_0;
          var $have_0_be = $have_21;
          var $left_0_be = $left_0;
          var $hold_0_be = $hold_17 >>> ($457 >>> 0);
          var $bits_0_be = $bits_17 - $457 | 0;
          var $out_0_be = $out_0;
          break;
        }
        while (1) {
          var $bits_18;
          var $hold_18;
          var $have_22;
          var $next_22;
          if ($bits_18 >>> 0 >= 3) {
            break;
          }
          if (($have_22 | 0) == 0) {
            var $ret_8 = $ret_0;
            var $next_57 = $next_22;
            var $have_57 = 0;
            var $hold_53 = $hold_18;
            var $bits_53 = $bits_18;
            var $out_4 = $out_0;
            break L917;
          }
          var $469 = ((HEAP8[$next_22] & 255) << $bits_18) + $hold_18 | 0;
          var $next_22 = $next_22 + 1 | 0;
          var $have_22 = $have_22 - 1 | 0;
          var $hold_18 = $469;
          var $bits_18 = $bits_18 + 8 | 0;
        }
        HEAP32[$48$s2] = $hold_18 & 1;
        var $474 = $hold_18 >>> 1 & 3;
        if (($474 | 0) == 0) {
          HEAP32[$20$s2] = 13;
        } else if (($474 | 0) == 1) {
          _fixedtables88($19);
          HEAP32[$20$s2] = 19;
        } else if (($474 | 0) == 2) {
          HEAP32[$20$s2] = 16;
        } else if (($474 | 0) == 3) {
          HEAP32[$42$s2] = STRING_TABLE.__str669 | 0;
          HEAP32[$20$s2] = 29;
        }
        var $ret_0_be = $ret_0;
        var $next_0_be = $next_22;
        var $put_0_be = $put_0;
        var $have_0_be = $have_22;
        var $left_0_be = $left_0;
        var $hold_0_be = $hold_18 >>> 3;
        var $bits_0_be = $bits_18 - 3 | 0;
        var $out_0_be = $out_0;
        break;
      } else if (label == 737) {
        while (1) {
          label = 0;
          var $bits_4;
          var $hold_4;
          var $have_4;
          var $next_4;
          if ($bits_4 >>> 0 >= 16) {
            break;
          }
          if (($have_4 | 0) == 0) {
            var $ret_8 = $ret_0;
            var $next_57 = $next_4;
            var $have_57 = 0;
            var $hold_53 = $hold_4;
            var $bits_53 = $bits_4;
            var $out_4 = $out_0;
            break L917;
          }
          var $225 = ((HEAP8[$next_4] & 255) << $bits_4) + $hold_4 | 0;
          var $next_4 = $next_4 + 1 | 0;
          var $have_4 = $have_4 - 1 | 0;
          var $hold_4 = $225;
          var $bits_4 = $bits_4 + 8 | 0;
        }
        var $228 = HEAP32[$41$s2];
        if (($228 | 0) != 0) {
          HEAP32[$228 + 8 >> 2] = $hold_4 & 255;
          HEAP32[HEAP32[$41$s2] + 12 >> 2] = $hold_4 >>> 8;
        }
        if ((HEAP32[$39$s2] & 512 | 0) != 0) {
          HEAP8[$37] = $hold_4 & 255;
          HEAP8[$38] = $hold_4 >>> 8 & 255;
          HEAP32[$36$s2] = _crc32(HEAP32[$36$s2], $37, 2);
        }
        HEAP32[$20$s2] = 4;
        var $next_5 = $next_4;
        var $have_5 = $have_4;
        var $hold_5 = 0;
        var $bits_5 = 0;
        label = 745;
        break;
      } else if (label == 847) {
        label = 0;
        var $bits_25_ph;
        var $hold_25_ph;
        var $have_29_ph;
        var $next_29_ph;
        var $ret_1_ph;
        var $next_29 = $next_29_ph;
        var $have_29 = $have_29_ph;
        var $hold_25 = $hold_25_ph;
        var $bits_25 = $bits_25_ph;
        L1079 : while (1) {
          var $bits_25;
          var $hold_25;
          var $have_29;
          var $next_29;
          var $581 = HEAP32[$70$s2];
          var $582 = HEAP32[$67$s2];
          var $584 = HEAP32[$68$s2] + $582 | 0;
          if ($581 >>> 0 >= $584 >>> 0) {
            label = 877;
            break;
          }
          var $588 = (1 << HEAP32[$51$s2]) - 1 | 0;
          var $589 = HEAP32[$53 >> 2];
          var $next_30 = $next_29;
          var $have_30 = $have_29;
          var $hold_26 = $hold_25;
          var $bits_26 = $bits_25;
          while (1) {
            var $bits_26;
            var $hold_26;
            var $have_30;
            var $next_30;
            var $591 = $588 & $hold_26;
            var $592 = HEAP8[($591 << 2) + $589 + 1 | 0] & 255;
            if ($592 >>> 0 <= $bits_26 >>> 0) {
              break;
            }
            if (($have_30 | 0) == 0) {
              var $ret_8 = $ret_1_ph;
              var $next_57 = $next_30;
              var $have_57 = 0;
              var $hold_53 = $hold_26;
              var $bits_53 = $bits_26;
              var $out_4 = $out_0;
              break L917;
            }
            var $602 = ((HEAP8[$next_30] & 255) << $bits_26) + $hold_26 | 0;
            var $next_30 = $next_30 + 1 | 0;
            var $have_30 = $have_30 - 1 | 0;
            var $hold_26 = $602;
            var $bits_26 = $bits_26 + 8 | 0;
          }
          var $tmp41 = HEAP16[$589 + ($591 << 2) + 2 >> 1];
          if (($tmp41 & 65535) < 16) {
            HEAP32[$70$s2] = $581 + 1 | 0;
            HEAP16[($581 << 1 >> 1) + $72$s1] = $tmp41;
            var $next_29 = $next_30;
            var $have_29 = $have_30;
            var $hold_25 = $hold_26 >>> ($592 >>> 0);
            var $bits_25 = $bits_26 - $592 | 0;
            continue;
          }
          if ($tmp41 << 16 >> 16 == 17) {
            var $614 = $592 + 3 | 0;
            var $next_32 = $next_30;
            var $have_32 = $have_30;
            var $hold_28 = $hold_26;
            var $bits_28 = $bits_26;
            while (1) {
              var $bits_28;
              var $hold_28;
              var $have_32;
              var $next_32;
              if ($bits_28 >>> 0 >= $614 >>> 0) {
                break;
              }
              if (($have_32 | 0) == 0) {
                var $ret_8 = $ret_1_ph;
                var $next_57 = $next_32;
                var $have_57 = 0;
                var $hold_53 = $hold_28;
                var $bits_53 = $bits_28;
                var $out_4 = $out_0;
                break L917;
              }
              var $650 = ((HEAP8[$next_32] & 255) << $bits_28) + $hold_28 | 0;
              var $next_32 = $next_32 + 1 | 0;
              var $have_32 = $have_32 - 1 | 0;
              var $hold_28 = $650;
              var $bits_28 = $bits_28 + 8 | 0;
            }
            var $653 = $hold_28 >>> ($592 >>> 0);
            var $len_0 = 0;
            var $next_34 = $next_32;
            var $have_34 = $have_32;
            var $hold_30 = $653 >>> 3;
            var $bits_30 = -3 - $592 + $bits_28 | 0;
            var $copy_5 = ($653 & 7) + 3 | 0;
          } else if ($tmp41 << 16 >> 16 == 16) {
            var $612 = $592 + 2 | 0;
            var $next_31 = $next_30;
            var $have_31 = $have_30;
            var $hold_27 = $hold_26;
            var $bits_27 = $bits_26;
            while (1) {
              var $bits_27;
              var $hold_27;
              var $have_31;
              var $next_31;
              if ($bits_27 >>> 0 >= $612 >>> 0) {
                break;
              }
              if (($have_31 | 0) == 0) {
                var $ret_8 = $ret_1_ph;
                var $next_57 = $next_31;
                var $have_57 = 0;
                var $hold_53 = $hold_27;
                var $bits_53 = $bits_27;
                var $out_4 = $out_0;
                break L917;
              }
              var $625 = ((HEAP8[$next_31] & 255) << $bits_27) + $hold_27 | 0;
              var $next_31 = $next_31 + 1 | 0;
              var $have_31 = $have_31 - 1 | 0;
              var $hold_27 = $625;
              var $bits_27 = $bits_27 + 8 | 0;
            }
            var $628 = $hold_27 >>> ($592 >>> 0);
            var $629 = $bits_27 - $592 | 0;
            if (($581 | 0) == 0) {
              label = 863;
              break;
            }
            var $len_0 = HEAP16[($581 - 1 << 1 >> 1) + $72$s1];
            var $next_34 = $next_31;
            var $have_34 = $have_31;
            var $hold_30 = $628 >>> 2;
            var $bits_30 = $629 - 2 | 0;
            var $copy_5 = ($628 & 3) + 3 | 0;
          } else {
            var $613 = $592 + 7 | 0;
            var $next_33 = $next_30;
            var $have_33 = $have_30;
            var $hold_29 = $hold_26;
            var $bits_29 = $bits_26;
            while (1) {
              var $bits_29;
              var $hold_29;
              var $have_33;
              var $next_33;
              if ($bits_29 >>> 0 >= $613 >>> 0) {
                break;
              }
              if (($have_33 | 0) == 0) {
                var $ret_8 = $ret_1_ph;
                var $next_57 = $next_33;
                var $have_57 = 0;
                var $hold_53 = $hold_29;
                var $bits_53 = $bits_29;
                var $out_4 = $out_0;
                break L917;
              }
              var $669 = ((HEAP8[$next_33] & 255) << $bits_29) + $hold_29 | 0;
              var $next_33 = $next_33 + 1 | 0;
              var $have_33 = $have_33 - 1 | 0;
              var $hold_29 = $669;
              var $bits_29 = $bits_29 + 8 | 0;
            }
            var $672 = $hold_29 >>> ($592 >>> 0);
            var $len_0 = 0;
            var $next_34 = $next_33;
            var $have_34 = $have_33;
            var $hold_30 = $672 >>> 7;
            var $bits_30 = -7 - $592 + $bits_29 | 0;
            var $copy_5 = ($672 & 127) + 11 | 0;
          }
          var $copy_5;
          var $bits_30;
          var $hold_30;
          var $have_34;
          var $next_34;
          var $len_0;
          if (($581 + $copy_5 | 0) >>> 0 > $584 >>> 0) {
            label = 874;
            break;
          } else {
            var $copy_6167 = $copy_5;
            var $682 = $581;
          }
          while (1) {
            var $682;
            var $copy_6167;
            var $683 = $copy_6167 - 1 | 0;
            HEAP32[$70$s2] = $682 + 1 | 0;
            HEAP16[($682 << 1 >> 1) + $72$s1] = $len_0;
            if (($683 | 0) == 0) {
              var $next_29 = $next_34;
              var $have_29 = $have_34;
              var $hold_25 = $hold_30;
              var $bits_25 = $bits_30;
              continue L1079;
            }
            var $copy_6167 = $683;
            var $682 = HEAP32[$70$s2];
          }
        }
        if (label == 874) {
          label = 0;
          HEAP32[$42$s2] = STRING_TABLE.__str1073 | 0;
          HEAP32[$20$s2] = 29;
          var $ret_0_be = $ret_1_ph;
          var $next_0_be = $next_34;
          var $put_0_be = $put_0;
          var $have_0_be = $have_34;
          var $left_0_be = $left_0;
          var $hold_0_be = $hold_30;
          var $bits_0_be = $bits_30;
          var $out_0_be = $out_0;
          break;
        } else if (label == 877) {
          label = 0;
          if ((HEAP32[$20$s2] | 0) == 29) {
            var $ret_0_be = $ret_1_ph;
            var $next_0_be = $next_29;
            var $put_0_be = $put_0;
            var $have_0_be = $have_29;
            var $left_0_be = $left_0;
            var $hold_0_be = $hold_25;
            var $bits_0_be = $bits_25;
            var $out_0_be = $out_0;
            break;
          }
          if (HEAP16[$82 >> 1] << 16 >> 16 == 0) {
            HEAP32[$42$s2] = STRING_TABLE.__str1174 | 0;
            HEAP32[$20$s2] = 29;
            var $ret_0_be = $ret_1_ph;
            var $next_0_be = $next_29;
            var $put_0_be = $put_0;
            var $have_0_be = $have_29;
            var $left_0_be = $left_0;
            var $hold_0_be = $hold_25;
            var $bits_0_be = $bits_25;
            var $out_0_be = $out_0;
            break;
          }
          HEAP32[$76 >> 2] = $_c45;
          HEAP32[$77 >> 2] = $_c45;
          HEAP32[$51$s2] = 9;
          var $694 = _inflate_table(1, $78, $582, $75, $51, $80);
          if (($694 | 0) != 0) {
            HEAP32[$42$s2] = STRING_TABLE.__str1275 | 0;
            HEAP32[$20$s2] = 29;
            var $ret_0_be = $694;
            var $next_0_be = $next_29;
            var $put_0_be = $put_0;
            var $have_0_be = $have_29;
            var $left_0_be = $left_0;
            var $hold_0_be = $hold_25;
            var $bits_0_be = $bits_25;
            var $out_0_be = $out_0;
            break;
          }
          HEAP32[$83 >> 2] = HEAP32[$75 >> 2];
          HEAP32[$84 >> 2] = 6;
          var $702 = _inflate_table(2, (HEAP32[$67$s2] << 1) + $78 | 0, HEAP32[$68$s2], $75, $84, $80);
          if (($702 | 0) == 0) {
            HEAP32[$20$s2] = 19;
            var $ret_2 = 0;
            var $next_36 = $next_29;
            var $have_36 = $have_29;
            var $hold_32 = $hold_25;
            var $bits_32 = $bits_25;
            label = 885;
            break;
          } else {
            HEAP32[$42$s2] = STRING_TABLE.__str1376 | 0;
            HEAP32[$20$s2] = 29;
            var $ret_0_be = $702;
            var $next_0_be = $next_29;
            var $put_0_be = $put_0;
            var $have_0_be = $have_29;
            var $left_0_be = $left_0;
            var $hold_0_be = $hold_25;
            var $bits_0_be = $bits_25;
            var $out_0_be = $out_0;
            break;
          }
        } else if (label == 863) {
          label = 0;
          HEAP32[$42$s2] = STRING_TABLE.__str1073 | 0;
          HEAP32[$20$s2] = 29;
          var $ret_0_be = $ret_1_ph;
          var $next_0_be = $next_31;
          var $put_0_be = $put_0;
          var $have_0_be = $have_31;
          var $left_0_be = $left_0;
          var $hold_0_be = $628;
          var $bits_0_be = $629;
          var $out_0_be = $out_0;
          break;
        }
      }
    } while (0);
    do {
      if (label == 745) {
        label = 0;
        var $bits_5;
        var $hold_5;
        var $have_5;
        var $next_5;
        var $246 = HEAP32[$39$s2];
        do {
          if (($246 & 1024 | 0) == 0) {
            var $276 = HEAP32[$41$s2];
            if (($276 | 0) == 0) {
              var $next_7 = $next_5;
              var $have_7 = $have_5;
              var $hold_7 = $hold_5;
              var $bits_7 = $bits_5;
              break;
            }
            HEAP32[$276 + 16 >> 2] = 0;
            var $next_7 = $next_5;
            var $have_7 = $have_5;
            var $hold_7 = $hold_5;
            var $bits_7 = $bits_5;
          } else {
            var $next_6 = $next_5;
            var $have_6 = $have_5;
            var $hold_6 = $hold_5;
            var $bits_6 = $bits_5;
            while (1) {
              var $bits_6;
              var $hold_6;
              var $have_6;
              var $next_6;
              if ($bits_6 >>> 0 >= 16) {
                break;
              }
              if (($have_6 | 0) == 0) {
                var $ret_8 = $ret_0;
                var $next_57 = $next_6;
                var $have_57 = 0;
                var $hold_53 = $hold_6;
                var $bits_53 = $bits_6;
                var $out_4 = $out_0;
                break L917;
              }
              var $258 = ((HEAP8[$next_6] & 255) << $bits_6) + $hold_6 | 0;
              var $next_6 = $next_6 + 1 | 0;
              var $have_6 = $have_6 - 1 | 0;
              var $hold_6 = $258;
              var $bits_6 = $bits_6 + 8 | 0;
            }
            HEAP32[$46$s2] = $hold_6;
            var $261 = HEAP32[$41$s2];
            if (($261 | 0) == 0) {
              var $266 = $246;
            } else {
              HEAP32[$261 + 20 >> 2] = $hold_6;
              var $266 = HEAP32[$39$s2];
            }
            var $266;
            if (($266 & 512 | 0) == 0) {
              var $next_7 = $next_6;
              var $have_7 = $have_6;
              var $hold_7 = 0;
              var $bits_7 = 0;
              break;
            }
            HEAP8[$37] = $hold_6 & 255;
            HEAP8[$38] = $hold_6 >>> 8 & 255;
            HEAP32[$36$s2] = _crc32(HEAP32[$36$s2], $37, 2);
            var $next_7 = $next_6;
            var $have_7 = $have_6;
            var $hold_7 = 0;
            var $bits_7 = 0;
          }
        } while (0);
        var $bits_7;
        var $hold_7;
        var $have_7;
        var $next_7;
        HEAP32[$20$s2] = 5;
        var $next_8 = $next_7;
        var $have_8 = $have_7;
        var $hold_8 = $hold_7;
        var $bits_8 = $bits_7;
        label = 756;
        break;
      } else if (label == 885) {
        label = 0;
        var $bits_32;
        var $hold_32;
        var $have_36;
        var $next_36;
        var $ret_2;
        HEAP32[$20$s2] = 20;
        var $ret_3 = $ret_2;
        var $next_37 = $next_36;
        var $have_37 = $have_36;
        var $hold_33 = $hold_32;
        var $bits_33 = $bits_32;
        label = 886;
        break;
      }
    } while (0);
    do {
      if (label == 886) {
        label = 0;
        var $bits_33;
        var $hold_33;
        var $have_37;
        var $next_37;
        var $ret_3;
        if ($have_37 >>> 0 > 5 & $left_0 >>> 0 > 257) {
          HEAP32[$7$s2] = $put_0;
          HEAP32[$27$s2] = $left_0;
          HEAP32[$11$s2] = $next_37;
          HEAP32[$29$s2] = $have_37;
          HEAP32[$31$s2] = $hold_33;
          HEAP32[$33$s2] = $bits_33;
          _inflate_fast($49, $out_0);
          var $711 = HEAP32[$7$s2];
          var $712 = HEAP32[$27$s2];
          var $713 = HEAP32[$11$s2];
          var $714 = HEAP32[$29$s2];
          var $715 = HEAP32[$31$s2];
          var $716 = HEAP32[$33$s2];
          if ((HEAP32[$20$s2] | 0) != 11) {
            var $ret_0_be = $ret_3;
            var $next_0_be = $713;
            var $put_0_be = $711;
            var $have_0_be = $714;
            var $left_0_be = $712;
            var $hold_0_be = $715;
            var $bits_0_be = $716;
            var $out_0_be = $out_0;
            break;
          }
          HEAP32[$50$s2] = -1;
          var $ret_0_be = $ret_3;
          var $next_0_be = $713;
          var $put_0_be = $711;
          var $have_0_be = $714;
          var $left_0_be = $712;
          var $hold_0_be = $715;
          var $bits_0_be = $716;
          var $out_0_be = $out_0;
          break;
        }
        HEAP32[$50$s2] = 0;
        var $723 = (1 << HEAP32[$51$s2]) - 1 | 0;
        var $724 = HEAP32[$53 >> 2];
        var $next_38 = $next_37;
        var $have_38 = $have_37;
        var $hold_34 = $hold_33;
        var $bits_34 = $bits_33;
        while (1) {
          var $bits_34;
          var $hold_34;
          var $have_38;
          var $next_38;
          var $726 = $723 & $hold_34;
          var $tmp33 = HEAP8[($726 << 2) + $724 + 1 | 0];
          var $727 = $tmp33 & 255;
          if ($727 >>> 0 <= $bits_34 >>> 0) {
            break;
          }
          if (($have_38 | 0) == 0) {
            var $ret_8 = $ret_3;
            var $next_57 = $next_38;
            var $have_57 = 0;
            var $hold_53 = $hold_34;
            var $bits_53 = $bits_34;
            var $out_4 = $out_0;
            break L917;
          }
          var $737 = ((HEAP8[$next_38] & 255) << $bits_34) + $hold_34 | 0;
          var $next_38 = $next_38 + 1 | 0;
          var $have_38 = $have_38 - 1 | 0;
          var $hold_34 = $737;
          var $bits_34 = $bits_34 + 8 | 0;
        }
        var $tmp31 = HEAP8[($726 << 2) + $724 | 0];
        var $tmp35 = HEAP16[$724 + ($726 << 2) + 2 >> 1];
        var $740 = $tmp31 & 255;
        do {
          if ($tmp31 << 24 >> 24 == 0) {
            var $next_40 = $next_38;
            var $have_40 = $have_38;
            var $hold_36 = $hold_34;
            var $bits_36 = $bits_34;
            var $here_011_0 = 0;
            var $here_112_0 = $tmp33;
            var $here_213_0 = $tmp35;
            var $770 = 0;
          } else {
            if (($740 & 240 | 0) != 0) {
              var $next_40 = $next_38;
              var $have_40 = $have_38;
              var $hold_36 = $hold_34;
              var $bits_36 = $bits_34;
              var $here_011_0 = $tmp31;
              var $here_112_0 = $tmp33;
              var $here_213_0 = $tmp35;
              var $770 = 0;
              break;
            }
            var $745 = $tmp35 & 65535;
            var $748 = (1 << $727 + $740) - 1 | 0;
            var $next_39 = $next_38;
            var $have_39 = $have_38;
            var $hold_35 = $hold_34;
            var $bits_35 = $bits_34;
            while (1) {
              var $bits_35;
              var $hold_35;
              var $have_39;
              var $next_39;
              var $752 = (($hold_35 & $748) >>> ($727 >>> 0)) + $745 | 0;
              var $tmp27 = HEAP8[($752 << 2) + $724 + 1 | 0];
              if ((($tmp27 & 255) + $727 | 0) >>> 0 <= $bits_35 >>> 0) {
                break;
              }
              if (($have_39 | 0) == 0) {
                var $ret_8 = $ret_3;
                var $next_57 = $next_39;
                var $have_57 = 0;
                var $hold_53 = $hold_35;
                var $bits_53 = $bits_35;
                var $out_4 = $out_0;
                break L917;
              }
              var $764 = ((HEAP8[$next_39] & 255) << $bits_35) + $hold_35 | 0;
              var $next_39 = $next_39 + 1 | 0;
              var $have_39 = $have_39 - 1 | 0;
              var $hold_35 = $764;
              var $bits_35 = $bits_35 + 8 | 0;
            }
            var $tmp29 = HEAP16[$724 + ($752 << 2) + 2 >> 1];
            var $tmp25 = HEAP8[($752 << 2) + $724 | 0];
            HEAP32[$50$s2] = $727;
            var $next_40 = $next_39;
            var $have_40 = $have_39;
            var $hold_36 = $hold_35 >>> ($727 >>> 0);
            var $bits_36 = $bits_35 - $727 | 0;
            var $here_011_0 = $tmp25;
            var $here_112_0 = $tmp27;
            var $here_213_0 = $tmp29;
            var $770 = $727;
          }
        } while (0);
        var $770;
        var $here_213_0;
        var $here_112_0;
        var $here_011_0;
        var $bits_36;
        var $hold_36;
        var $have_40;
        var $next_40;
        var $771 = $here_112_0 & 255;
        var $772 = $hold_36 >>> ($771 >>> 0);
        var $773 = $bits_36 - $771 | 0;
        HEAP32[$50$s2] = $770 + $771 | 0;
        HEAP32[$46$s2] = $here_213_0 & 65535;
        var $776 = $here_011_0 & 255;
        if ($here_011_0 << 24 >> 24 == 0) {
          HEAP32[$20$s2] = 25;
          var $ret_0_be = $ret_3;
          var $next_0_be = $next_40;
          var $put_0_be = $put_0;
          var $have_0_be = $have_40;
          var $left_0_be = $left_0;
          var $hold_0_be = $772;
          var $bits_0_be = $773;
          var $out_0_be = $out_0;
          break;
        }
        if (($776 & 32 | 0) != 0) {
          HEAP32[$50$s2] = -1;
          HEAP32[$20$s2] = 11;
          var $ret_0_be = $ret_3;
          var $next_0_be = $next_40;
          var $put_0_be = $put_0;
          var $have_0_be = $have_40;
          var $left_0_be = $left_0;
          var $hold_0_be = $772;
          var $bits_0_be = $773;
          var $out_0_be = $out_0;
          break;
        }
        if (($776 & 64 | 0) == 0) {
          var $788 = $776 & 15;
          HEAP32[$54$s2] = $788;
          HEAP32[$20$s2] = 21;
          var $ret_4 = $ret_3;
          var $next_41 = $next_40;
          var $have_41 = $have_40;
          var $hold_37 = $772;
          var $bits_37 = $773;
          var $790 = $788;
          label = 907;
          break;
        } else {
          HEAP32[$42$s2] = STRING_TABLE.__str1477 | 0;
          HEAP32[$20$s2] = 29;
          var $ret_0_be = $ret_3;
          var $next_0_be = $next_40;
          var $put_0_be = $put_0;
          var $have_0_be = $have_40;
          var $left_0_be = $left_0;
          var $hold_0_be = $772;
          var $bits_0_be = $773;
          var $out_0_be = $out_0;
          break;
        }
      } else if (label == 756) {
        label = 0;
        var $bits_8;
        var $hold_8;
        var $have_8;
        var $next_8;
        var $281 = HEAP32[$39$s2];
        if (($281 & 1024 | 0) == 0) {
          var $next_10 = $next_8;
          var $have_10 = $have_8;
          var $322 = $281;
        } else {
          var $285 = HEAP32[$46$s2];
          var $copy_0 = $285 >>> 0 > $have_8 >>> 0 ? $have_8 : $285;
          if (($copy_0 | 0) == 0) {
            var $next_9 = $next_8;
            var $have_9 = $have_8;
            var $319 = $285;
            var $318 = $281;
          } else {
            var $289 = HEAP32[$41$s2], $289$s2 = $289 >> 2;
            do {
              if (($289 | 0) == 0) {
                var $307 = $281;
              } else {
                var $293 = HEAP32[$289$s2 + 4];
                if (($293 | 0) == 0) {
                  var $307 = $281;
                  break;
                }
                var $298 = HEAP32[$289$s2 + 5] - $285 | 0;
                var $302 = HEAP32[$289$s2 + 6];
                _memcpy($293 + $298 | 0, $next_8, ($298 + $copy_0 | 0) >>> 0 > $302 >>> 0 ? $302 - $298 | 0 : $copy_0, 1);
                var $307 = HEAP32[$39$s2];
              }
            } while (0);
            var $307;
            if (($307 & 512 | 0) != 0) {
              HEAP32[$36$s2] = _crc32(HEAP32[$36$s2], $next_8, $copy_0);
            }
            var $316 = HEAP32[$46$s2] - $copy_0 | 0;
            HEAP32[$46$s2] = $316;
            var $next_9 = $next_8 + $copy_0 | 0;
            var $have_9 = $have_8 - $copy_0 | 0;
            var $319 = $316;
            var $318 = $307;
          }
          var $318;
          var $319;
          var $have_9;
          var $next_9;
          if (($319 | 0) == 0) {
            var $next_10 = $next_9;
            var $have_10 = $have_9;
            var $322 = $318;
          } else {
            var $ret_8 = $ret_0;
            var $next_57 = $next_9;
            var $have_57 = $have_9;
            var $hold_53 = $hold_8;
            var $bits_53 = $bits_8;
            var $out_4 = $out_0;
            break L917;
          }
        }
        var $322;
        var $have_10;
        var $next_10;
        HEAP32[$46$s2] = 0;
        HEAP32[$20$s2] = 6;
        var $next_11 = $next_10;
        var $have_11 = $have_10;
        var $hold_9 = $hold_8;
        var $bits_9 = $bits_8;
        var $324 = $322;
        label = 766;
        break;
      }
    } while (0);
    do {
      if (label == 766) {
        label = 0;
        var $324;
        var $bits_9;
        var $hold_9;
        var $have_11;
        var $next_11;
        do {
          if (($324 & 2048 | 0) == 0) {
            var $360 = HEAP32[$41$s2];
            if (($360 | 0) == 0) {
              var $next_12 = $next_11;
              var $have_12 = $have_11;
              break;
            }
            HEAP32[$360 + 28 >> 2] = 0;
            var $next_12 = $next_11;
            var $have_12 = $have_11;
          } else {
            if (($have_11 | 0) == 0) {
              var $ret_8 = $ret_0;
              var $next_57 = $next_11;
              var $have_57 = 0;
              var $hold_53 = $hold_9;
              var $bits_53 = $bits_9;
              var $out_4 = $out_0;
              break L917;
            } else {
              var $copy_1 = 0;
            }
            while (1) {
              var $copy_1;
              var $329 = $copy_1 + 1 | 0;
              var $331 = HEAP8[$next_11 + $copy_1 | 0];
              var $332 = HEAP32[$41$s2];
              do {
                if (($332 | 0) != 0) {
                  var $335 = $332 + 28 | 0;
                  if ((HEAP32[$335 >> 2] | 0) == 0) {
                    break;
                  }
                  var $339 = HEAP32[$46$s2];
                  if ($339 >>> 0 >= HEAP32[$332 + 32 >> 2] >>> 0) {
                    break;
                  }
                  HEAP32[$46$s2] = $339 + 1 | 0;
                  HEAP8[HEAP32[$335 >> 2] + $339 | 0] = $331;
                }
              } while (0);
              var $348 = $331 << 24 >> 24 != 0;
              if ($348 & $329 >>> 0 < $have_11 >>> 0) {
                var $copy_1 = $329;
              } else {
                break;
              }
            }
            if ((HEAP32[$39$s2] & 512 | 0) != 0) {
              HEAP32[$36$s2] = _crc32(HEAP32[$36$s2], $next_11, $329);
            }
            var $357 = $have_11 - $329 | 0;
            var $358 = $next_11 + $329 | 0;
            if ($348) {
              var $ret_8 = $ret_0;
              var $next_57 = $358;
              var $have_57 = $357;
              var $hold_53 = $hold_9;
              var $bits_53 = $bits_9;
              var $out_4 = $out_0;
              break L917;
            } else {
              var $next_12 = $358;
              var $have_12 = $357;
            }
          }
        } while (0);
        var $have_12;
        var $next_12;
        HEAP32[$46$s2] = 0;
        HEAP32[$20$s2] = 7;
        var $next_13 = $next_12;
        var $have_13 = $have_12;
        var $hold_10 = $hold_9;
        var $bits_10 = $bits_9;
        label = 779;
        break;
      } else if (label == 907) {
        label = 0;
        var $790;
        var $bits_37;
        var $hold_37;
        var $have_41;
        var $next_41;
        var $ret_4;
        if (($790 | 0) == 0) {
          var $next_43 = $next_41;
          var $have_43 = $have_41;
          var $hold_39 = $hold_37;
          var $bits_39 = $bits_37;
          var $814 = HEAP32[$46$s2];
        } else {
          var $next_42 = $next_41;
          var $have_42 = $have_41;
          var $hold_38 = $hold_37;
          var $bits_38 = $bits_37;
          while (1) {
            var $bits_38;
            var $hold_38;
            var $have_42;
            var $next_42;
            if ($bits_38 >>> 0 >= $790 >>> 0) {
              break;
            }
            if (($have_42 | 0) == 0) {
              var $ret_8 = $ret_4;
              var $next_57 = $next_42;
              var $have_57 = 0;
              var $hold_53 = $hold_38;
              var $bits_53 = $bits_38;
              var $out_4 = $out_0;
              break L917;
            }
            var $801 = ((HEAP8[$next_42] & 255) << $bits_38) + $hold_38 | 0;
            var $next_42 = $next_42 + 1 | 0;
            var $have_42 = $have_42 - 1 | 0;
            var $hold_38 = $801;
            var $bits_38 = $bits_38 + 8 | 0;
          }
          var $808 = HEAP32[$46$s2] + ((1 << $790) - 1 & $hold_38) | 0;
          HEAP32[$46$s2] = $808;
          HEAP32[$50$s2] = HEAP32[$50$s2] + $790 | 0;
          var $next_43 = $next_42;
          var $have_43 = $have_42;
          var $hold_39 = $hold_38 >>> ($790 >>> 0);
          var $bits_39 = $bits_38 - $790 | 0;
          var $814 = $808;
        }
        var $814;
        var $bits_39;
        var $hold_39;
        var $have_43;
        var $next_43;
        HEAP32[$55 >> 2] = $814;
        HEAP32[$20$s2] = 22;
        var $ret_5_ph = $ret_4;
        var $next_44_ph = $next_43;
        var $have_44_ph = $have_43;
        var $hold_40_ph = $hold_39;
        var $bits_40_ph = $bits_39;
        label = 914;
        break;
      }
    } while (0);
    do {
      if (label == 779) {
        label = 0;
        var $bits_10;
        var $hold_10;
        var $have_13;
        var $next_13;
        do {
          if ((HEAP32[$39$s2] & 4096 | 0) == 0) {
            var $401 = HEAP32[$41$s2];
            if (($401 | 0) == 0) {
              var $next_14 = $next_13;
              var $have_14 = $have_13;
              break;
            }
            HEAP32[$401 + 36 >> 2] = 0;
            var $next_14 = $next_13;
            var $have_14 = $have_13;
          } else {
            if (($have_13 | 0) == 0) {
              var $ret_8 = $ret_0;
              var $next_57 = $next_13;
              var $have_57 = 0;
              var $hold_53 = $hold_10;
              var $bits_53 = $bits_10;
              var $out_4 = $out_0;
              break L917;
            } else {
              var $copy_2 = 0;
            }
            while (1) {
              var $copy_2;
              var $370 = $copy_2 + 1 | 0;
              var $372 = HEAP8[$next_13 + $copy_2 | 0];
              var $373 = HEAP32[$41$s2];
              do {
                if (($373 | 0) != 0) {
                  var $376 = $373 + 36 | 0;
                  if ((HEAP32[$376 >> 2] | 0) == 0) {
                    break;
                  }
                  var $380 = HEAP32[$46$s2];
                  if ($380 >>> 0 >= HEAP32[$373 + 40 >> 2] >>> 0) {
                    break;
                  }
                  HEAP32[$46$s2] = $380 + 1 | 0;
                  HEAP8[HEAP32[$376 >> 2] + $380 | 0] = $372;
                }
              } while (0);
              var $389 = $372 << 24 >> 24 != 0;
              if ($389 & $370 >>> 0 < $have_13 >>> 0) {
                var $copy_2 = $370;
              } else {
                break;
              }
            }
            if ((HEAP32[$39$s2] & 512 | 0) != 0) {
              HEAP32[$36$s2] = _crc32(HEAP32[$36$s2], $next_13, $370);
            }
            var $398 = $have_13 - $370 | 0;
            var $399 = $next_13 + $370 | 0;
            if ($389) {
              var $ret_8 = $ret_0;
              var $next_57 = $399;
              var $have_57 = $398;
              var $hold_53 = $hold_10;
              var $bits_53 = $bits_10;
              var $out_4 = $out_0;
              break L917;
            } else {
              var $next_14 = $399;
              var $have_14 = $398;
            }
          }
        } while (0);
        var $have_14;
        var $next_14;
        HEAP32[$20$s2] = 8;
        var $next_15 = $next_14;
        var $have_15 = $have_14;
        var $hold_11 = $hold_10;
        var $bits_11 = $bits_10;
        label = 792;
        break;
      } else if (label == 914) {
        label = 0;
        var $bits_40_ph;
        var $hold_40_ph;
        var $have_44_ph;
        var $next_44_ph;
        var $ret_5_ph;
        var $817 = (1 << HEAP32[$84 >> 2]) - 1 | 0;
        var $818 = HEAP32[$86 >> 2];
        var $next_44 = $next_44_ph;
        var $have_44 = $have_44_ph;
        var $hold_40 = $hold_40_ph;
        var $bits_40 = $bits_40_ph;
        while (1) {
          var $bits_40;
          var $hold_40;
          var $have_44;
          var $next_44;
          var $820 = $817 & $hold_40;
          var $tmp21 = HEAP8[($820 << 2) + $818 + 1 | 0];
          var $821 = $tmp21 & 255;
          if ($821 >>> 0 <= $bits_40 >>> 0) {
            break;
          }
          if (($have_44 | 0) == 0) {
            var $ret_8 = $ret_5_ph;
            var $next_57 = $next_44;
            var $have_57 = 0;
            var $hold_53 = $hold_40;
            var $bits_53 = $bits_40;
            var $out_4 = $out_0;
            break L917;
          }
          var $831 = ((HEAP8[$next_44] & 255) << $bits_40) + $hold_40 | 0;
          var $next_44 = $next_44 + 1 | 0;
          var $have_44 = $have_44 - 1 | 0;
          var $hold_40 = $831;
          var $bits_40 = $bits_40 + 8 | 0;
        }
        var $tmp19 = HEAP8[($820 << 2) + $818 | 0];
        var $tmp23 = HEAP16[$818 + ($820 << 2) + 2 >> 1];
        var $834 = $tmp19 & 255;
        if (($834 & 240 | 0) == 0) {
          var $837 = $tmp23 & 65535;
          var $840 = (1 << $821 + $834) - 1 | 0;
          var $next_45 = $next_44;
          var $have_45 = $have_44;
          var $hold_41 = $hold_40;
          var $bits_41 = $bits_40;
          while (1) {
            var $bits_41;
            var $hold_41;
            var $have_45;
            var $next_45;
            var $844 = (($hold_41 & $840) >>> ($821 >>> 0)) + $837 | 0;
            var $tmp16 = HEAP8[($844 << 2) + $818 + 1 | 0];
            if ((($tmp16 & 255) + $821 | 0) >>> 0 <= $bits_41 >>> 0) {
              break;
            }
            if (($have_45 | 0) == 0) {
              var $ret_8 = $ret_5_ph;
              var $next_57 = $next_45;
              var $have_57 = 0;
              var $hold_53 = $hold_41;
              var $bits_53 = $bits_41;
              var $out_4 = $out_0;
              break L917;
            }
            var $856 = ((HEAP8[$next_45] & 255) << $bits_41) + $hold_41 | 0;
            var $next_45 = $next_45 + 1 | 0;
            var $have_45 = $have_45 - 1 | 0;
            var $hold_41 = $856;
            var $bits_41 = $bits_41 + 8 | 0;
          }
          var $tmp17 = HEAP16[$818 + ($844 << 2) + 2 >> 1];
          var $tmp15 = HEAP8[($844 << 2) + $818 | 0];
          var $862 = HEAP32[$50$s2] + $821 | 0;
          HEAP32[$50$s2] = $862;
          var $next_46 = $next_45;
          var $have_46 = $have_45;
          var $hold_42 = $hold_41 >>> ($821 >>> 0);
          var $bits_42 = $bits_41 - $821 | 0;
          var $here_011_1 = $tmp15;
          var $here_112_1 = $tmp16;
          var $here_213_1 = $tmp17;
          var $864 = $862;
        } else {
          var $next_46 = $next_44;
          var $have_46 = $have_44;
          var $hold_42 = $hold_40;
          var $bits_42 = $bits_40;
          var $here_011_1 = $tmp19;
          var $here_112_1 = $tmp21;
          var $here_213_1 = $tmp23;
          var $864 = HEAP32[$50$s2];
        }
        var $864;
        var $here_213_1;
        var $here_112_1;
        var $here_011_1;
        var $bits_42;
        var $hold_42;
        var $have_46;
        var $next_46;
        var $865 = $here_112_1 & 255;
        var $866 = $hold_42 >>> ($865 >>> 0);
        var $867 = $bits_42 - $865 | 0;
        HEAP32[$50$s2] = $864 + $865 | 0;
        var $869 = $here_011_1 & 255;
        if (($869 & 64 | 0) == 0) {
          HEAP32[$56$s2] = $here_213_1 & 65535;
          var $875 = $869 & 15;
          HEAP32[$54$s2] = $875;
          HEAP32[$20$s2] = 23;
          var $ret_6 = $ret_5_ph;
          var $next_47 = $next_46;
          var $have_47 = $have_46;
          var $hold_43 = $866;
          var $bits_43 = $867;
          var $877 = $875;
          label = 928;
          break;
        } else {
          HEAP32[$42$s2] = STRING_TABLE.__str1578 | 0;
          HEAP32[$20$s2] = 29;
          var $ret_0_be = $ret_5_ph;
          var $next_0_be = $next_46;
          var $put_0_be = $put_0;
          var $have_0_be = $have_46;
          var $left_0_be = $left_0;
          var $hold_0_be = $866;
          var $bits_0_be = $867;
          var $out_0_be = $out_0;
          break;
        }
      }
    } while (0);
    L1250 : do {
      if (label == 792) {
        label = 0;
        var $bits_11;
        var $hold_11;
        var $have_15;
        var $next_15;
        var $406 = HEAP32[$39$s2];
        do {
          if (($406 & 512 | 0) == 0) {
            var $next_17 = $next_15;
            var $have_17 = $have_15;
            var $hold_13 = $hold_11;
            var $bits_13 = $bits_11;
          } else {
            var $next_16 = $next_15;
            var $have_16 = $have_15;
            var $hold_12 = $hold_11;
            var $bits_12 = $bits_11;
            while (1) {
              var $bits_12;
              var $hold_12;
              var $have_16;
              var $next_16;
              if ($bits_12 >>> 0 >= 16) {
                break;
              }
              if (($have_16 | 0) == 0) {
                var $ret_8 = $ret_0;
                var $next_57 = $next_16;
                var $have_57 = 0;
                var $hold_53 = $hold_12;
                var $bits_53 = $bits_12;
                var $out_4 = $out_0;
                break L917;
              }
              var $418 = ((HEAP8[$next_16] & 255) << $bits_12) + $hold_12 | 0;
              var $next_16 = $next_16 + 1 | 0;
              var $have_16 = $have_16 - 1 | 0;
              var $hold_12 = $418;
              var $bits_12 = $bits_12 + 8 | 0;
            }
            if (($hold_12 | 0) == (HEAP32[$36$s2] & 65535 | 0)) {
              var $next_17 = $next_16;
              var $have_17 = $have_16;
              var $hold_13 = 0;
              var $bits_13 = 0;
              break;
            }
            HEAP32[$42$s2] = STRING_TABLE.__str568 | 0;
            HEAP32[$20$s2] = 29;
            var $ret_0_be = $ret_0;
            var $next_0_be = $next_16;
            var $put_0_be = $put_0;
            var $have_0_be = $have_16;
            var $left_0_be = $left_0;
            var $hold_0_be = $hold_12;
            var $bits_0_be = $bits_12;
            var $out_0_be = $out_0;
            break L1250;
          }
        } while (0);
        var $bits_13;
        var $hold_13;
        var $have_17;
        var $next_17;
        var $425 = HEAP32[$41$s2];
        if (($425 | 0) != 0) {
          HEAP32[$425 + 44 >> 2] = $406 >>> 9 & 1;
          HEAP32[HEAP32[$41$s2] + 48 >> 2] = 1;
        }
        var $434 = _crc32(0, 0, 0);
        HEAP32[$36$s2] = $434;
        HEAP32[$45$s2] = $434;
        HEAP32[$20$s2] = 11;
        var $ret_0_be = $ret_0;
        var $next_0_be = $next_17;
        var $put_0_be = $put_0;
        var $have_0_be = $have_17;
        var $left_0_be = $left_0;
        var $hold_0_be = $hold_13;
        var $bits_0_be = $bits_13;
        var $out_0_be = $out_0;
        break;
      } else if (label == 928) {
        label = 0;
        var $877;
        var $bits_43;
        var $hold_43;
        var $have_47;
        var $next_47;
        var $ret_6;
        if (($877 | 0) == 0) {
          var $next_49 = $next_47;
          var $have_49 = $have_47;
          var $hold_45 = $hold_43;
          var $bits_45 = $bits_43;
        } else {
          var $next_48 = $next_47;
          var $have_48 = $have_47;
          var $hold_44 = $hold_43;
          var $bits_44 = $bits_43;
          while (1) {
            var $bits_44;
            var $hold_44;
            var $have_48;
            var $next_48;
            if ($bits_44 >>> 0 >= $877 >>> 0) {
              break;
            }
            if (($have_48 | 0) == 0) {
              var $ret_8 = $ret_6;
              var $next_57 = $next_48;
              var $have_57 = 0;
              var $hold_53 = $hold_44;
              var $bits_53 = $bits_44;
              var $out_4 = $out_0;
              break L917;
            }
            var $888 = ((HEAP8[$next_48] & 255) << $bits_44) + $hold_44 | 0;
            var $next_48 = $next_48 + 1 | 0;
            var $have_48 = $have_48 - 1 | 0;
            var $hold_44 = $888;
            var $bits_44 = $bits_44 + 8 | 0;
          }
          HEAP32[$56$s2] = HEAP32[$56$s2] + ((1 << $877) - 1 & $hold_44) | 0;
          HEAP32[$50$s2] = HEAP32[$50$s2] + $877 | 0;
          var $next_49 = $next_48;
          var $have_49 = $have_48;
          var $hold_45 = $hold_44 >>> ($877 >>> 0);
          var $bits_45 = $bits_44 - $877 | 0;
        }
        var $bits_45;
        var $hold_45;
        var $have_49;
        var $next_49;
        HEAP32[$20$s2] = 24;
        var $ret_7 = $ret_6;
        var $next_50 = $next_49;
        var $have_50 = $have_49;
        var $hold_46 = $hold_45;
        var $bits_46 = $bits_45;
        label = 934;
        break;
      }
    } while (0);
    L1271 : do {
      if (label == 934) {
        label = 0;
        var $bits_46;
        var $hold_46;
        var $have_50;
        var $next_50;
        var $ret_7;
        if (($left_0 | 0) == 0) {
          var $ret_8 = $ret_7;
          var $next_57 = $next_50;
          var $have_57 = $have_50;
          var $hold_53 = $hold_46;
          var $bits_53 = $bits_46;
          var $out_4 = $out_0;
          break L917;
        }
        var $904 = $out_0 - $left_0 | 0;
        var $905 = HEAP32[$56$s2];
        do {
          if ($905 >>> 0 > $904 >>> 0) {
            var $908 = $905 - $904 | 0;
            do {
              if ($908 >>> 0 > HEAP32[$57 >> 2] >>> 0) {
                if ((HEAP32[$58 >> 2] | 0) == 0) {
                  break;
                }
                HEAP32[$42$s2] = STRING_TABLE.__str1679 | 0;
                HEAP32[$20$s2] = 29;
                var $ret_0_be = $ret_7;
                var $next_0_be = $next_50;
                var $put_0_be = $put_0;
                var $have_0_be = $have_50;
                var $left_0_be = $left_0;
                var $hold_0_be = $hold_46;
                var $bits_0_be = $bits_46;
                var $out_0_be = $out_0;
                break L1271;
              }
            } while (0);
            var $916 = HEAP32[$59 >> 2];
            if ($908 >>> 0 > $916 >>> 0) {
              var $919 = $908 - $916 | 0;
              var $from_0 = HEAP32[$61 >> 2] + (HEAP32[$62 >> 2] - $919) | 0;
              var $copy_7 = $919;
            } else {
              var $from_0 = HEAP32[$61 >> 2] + ($916 - $908) | 0;
              var $copy_7 = $908;
            }
            var $copy_7;
            var $from_0;
            var $929 = HEAP32[$46$s2];
            if ($copy_7 >>> 0 <= $929 >>> 0) {
              var $from_1 = $from_0;
              var $copy_8 = $copy_7;
              var $937 = $929;
              break;
            }
            var $from_1 = $from_0;
            var $copy_8 = $929;
            var $937 = $929;
          } else {
            var $935 = HEAP32[$46$s2];
            var $from_1 = $put_0 + -$905 | 0;
            var $copy_8 = $935;
            var $937 = $935;
          }
        } while (0);
        var $937;
        var $copy_8;
        var $from_1;
        var $copy_9 = $copy_8 >>> 0 > $left_0 >>> 0 ? $left_0 : $copy_8;
        HEAP32[$46$s2] = $937 - $copy_9 | 0;
        var $940 = $copy_8 ^ -1;
        var $941 = $left_0 ^ -1;
        var $umax = $940 >>> 0 > $941 >>> 0 ? $940 : $941;
        var $from_2 = $from_1;
        var $put_1 = $put_0;
        var $copy_10 = $copy_9;
        while (1) {
          var $copy_10;
          var $put_1;
          var $from_2;
          HEAP8[$put_1] = HEAP8[$from_2];
          var $947 = $copy_10 - 1 | 0;
          if (($947 | 0) == 0) {
            break;
          } else {
            var $from_2 = $from_2 + 1 | 0;
            var $put_1 = $put_1 + 1 | 0;
            var $copy_10 = $947;
          }
        }
        var $950 = $left_0 - $copy_9 | 0;
        var $scevgep672 = $put_0 + ($umax ^ -1) | 0;
        if ((HEAP32[$46$s2] | 0) != 0) {
          var $ret_0_be = $ret_7;
          var $next_0_be = $next_50;
          var $put_0_be = $scevgep672;
          var $have_0_be = $have_50;
          var $left_0_be = $950;
          var $hold_0_be = $hold_46;
          var $bits_0_be = $bits_46;
          var $out_0_be = $out_0;
          break;
        }
        HEAP32[$20$s2] = 20;
        var $ret_0_be = $ret_7;
        var $next_0_be = $next_50;
        var $put_0_be = $scevgep672;
        var $have_0_be = $have_50;
        var $left_0_be = $950;
        var $hold_0_be = $hold_46;
        var $bits_0_be = $bits_46;
        var $out_0_be = $out_0;
      }
    } while (0);
    var $out_0_be;
    var $bits_0_be;
    var $hold_0_be;
    var $left_0_be;
    var $have_0_be;
    var $put_0_be;
    var $next_0_be;
    var $ret_0_be;
    var $ret_0 = $ret_0_be;
    var $next_0 = $next_0_be;
    var $put_0 = $put_0_be;
    var $have_0 = $have_0_be;
    var $left_0 = $left_0_be;
    var $hold_0 = $hold_0_be;
    var $bits_0 = $bits_0_be;
    var $out_0 = $out_0_be;
    var $87 = HEAP32[$20$s2];
  }
  if (label == 806) {
    HEAP32[$7$s2] = $put_0;
    HEAP32[$27$s2] = $left_0;
    HEAP32[$11$s2] = $next_19;
    HEAP32[$29$s2] = $have_19;
    HEAP32[$31$s2] = $hold_15;
    HEAP32[$33$s2] = $bits_15;
    var $_0 = 2;
    var $_0;
    STACKTOP = __stackBase__;
    return $_0;
  } else if (label == 973) {
    var $bits_51;
    var $hold_51;
    var $have_55;
    var $next_55;
    HEAP32[$20$s2] = 28;
    var $ret_8 = 1;
    var $next_57 = $next_55;
    var $have_57 = $have_55;
    var $hold_53 = $hold_51;
    var $bits_53 = $bits_51;
    var $out_4 = $out_2;
  } else if (label == 974) {
    var $ret_8 = -3;
    var $next_57 = $next_0;
    var $have_57 = $have_0;
    var $hold_53 = $hold_0;
    var $bits_53 = $bits_0;
    var $out_4 = $out_0;
  } else if (label == 989) {
    var $_0 = -2;
    var $_0;
    STACKTOP = __stackBase__;
    return $_0;
  } else if (label == 995) {
    var $_0;
    STACKTOP = __stackBase__;
    return $_0;
  }
  var $out_4;
  var $bits_53;
  var $hold_53;
  var $have_57;
  var $next_57;
  var $ret_8;
  HEAP32[$7$s2] = $put_0;
  HEAP32[$27$s2] = $left_0;
  HEAP32[$11$s2] = $next_57;
  HEAP32[$29$s2] = $have_57;
  HEAP32[$31$s2] = $hold_53;
  HEAP32[$33$s2] = $bits_53;
  do {
    if ((HEAP32[$62 >> 2] | 0) == 0) {
      var $1029 = HEAP32[$27$s2];
      if (($out_4 | 0) == ($1029 | 0)) {
        var $1039 = $1029;
        break;
      }
      if (HEAP32[$20$s2] >>> 0 < 29) {
        label = 978;
        break;
      } else {
        var $1039 = $1029;
        break;
      }
    } else {
      label = 978;
    }
  } while (0);
  do {
    if (label == 978) {
      if ((_updatewindow($strm, $out_4) | 0) == 0) {
        var $1039 = HEAP32[$27$s2];
        break;
      }
      HEAP32[$20$s2] = 30;
      var $_0 = -4;
      var $_0;
      STACKTOP = __stackBase__;
      return $_0;
    }
  } while (0);
  var $1039;
  var $1040 = HEAP32[$29$s2];
  var $1041 = $out_4 - $1039 | 0;
  var $1042 = $strm + 8 | 0;
  HEAP32[$1042 >> 2] = $30 - $1040 + HEAP32[$1042 >> 2] | 0;
  HEAP32[$63$s2] = HEAP32[$63$s2] + $1041 | 0;
  HEAP32[$64$s2] = HEAP32[$64$s2] + $1041 | 0;
  var $1052 = ($out_4 | 0) == ($1039 | 0);
  if (!((HEAP32[$35$s2] | 0) == 0 | $1052)) {
    var $1056 = HEAP32[$36$s2];
    var $1059 = HEAP32[$7$s2] + -$1041 | 0;
    if ((HEAP32[$39$s2] | 0) == 0) {
      var $1065 = _adler32($1056, $1059, $1041);
    } else {
      var $1065 = _crc32($1056, $1059, $1041);
    }
    var $1065;
    HEAP32[$36$s2] = $1065;
    HEAP32[$45$s2] = $1065;
  }
  var $1071 = HEAP32[$20$s2];
  if (($1071 | 0) == 19) {
    var $1078 = 256;
  } else {
    var $1078 = ($1071 | 0) == 14 ? 256 : 0;
  }
  var $1078;
  HEAP32[$strm + 44 >> 2] = ((HEAP32[$48$s2] | 0) != 0 ? 64 : 0) + HEAP32[$33$s2] + (($1071 | 0) == 11 ? 128 : 0) + $1078 | 0;
  var $_0 = ($30 | 0) == ($1040 | 0) & $1052 & ($ret_8 | 0) == 0 ? -5 : $ret_8;
  var $_0;
  STACKTOP = __stackBase__;
  return $_0;
}
_inflate["X"] = 1;
function _fixedtables88($state) {
  HEAP32[$state + 76 >> 2] = _fixedtables_lenfix80 | 0;
  HEAP32[$state + 84 >> 2] = 9;
  HEAP32[$state + 80 >> 2] = _fixedtables_distfix81 | 0;
  HEAP32[$state + 88 >> 2] = 5;
  return;
}
function _init_block($s) {
  var $n_04 = 0;
  while (1) {
    var $n_04;
    HEAP16[$s + ($n_04 << 2) + 148 >> 1] = 0;
    var $57 = $n_04 + 1 | 0;
    if (($57 | 0) == 286) {
      break;
    } else {
      var $n_04 = $57;
    }
  }
  HEAP16[$s + 2440 >> 1] = 0;
  HEAP16[$s + 2444 >> 1] = 0;
  HEAP16[$s + 2448 >> 1] = 0;
  HEAP16[$s + 2452 >> 1] = 0;
  HEAP16[$s + 2456 >> 1] = 0;
  HEAP16[$s + 2460 >> 1] = 0;
  HEAP16[$s + 2464 >> 1] = 0;
  HEAP16[$s + 2468 >> 1] = 0;
  HEAP16[$s + 2472 >> 1] = 0;
  HEAP16[$s + 2476 >> 1] = 0;
  HEAP16[$s + 2480 >> 1] = 0;
  HEAP16[$s + 2484 >> 1] = 0;
  HEAP16[$s + 2488 >> 1] = 0;
  HEAP16[$s + 2492 >> 1] = 0;
  HEAP16[$s + 2496 >> 1] = 0;
  HEAP16[$s + 2500 >> 1] = 0;
  HEAP16[$s + 2504 >> 1] = 0;
  HEAP16[$s + 2508 >> 1] = 0;
  HEAP16[$s + 2512 >> 1] = 0;
  HEAP16[$s + 2516 >> 1] = 0;
  HEAP16[$s + 2520 >> 1] = 0;
  HEAP16[$s + 2524 >> 1] = 0;
  HEAP16[$s + 2528 >> 1] = 0;
  HEAP16[$s + 2532 >> 1] = 0;
  HEAP16[$s + 2536 >> 1] = 0;
  HEAP16[$s + 2540 >> 1] = 0;
  HEAP16[$s + 2544 >> 1] = 0;
  HEAP16[$s + 2548 >> 1] = 0;
  HEAP16[$s + 2552 >> 1] = 0;
  HEAP16[$s + 2556 >> 1] = 0;
  HEAP16[$s + 2684 >> 1] = 0;
  HEAP16[$s + 2688 >> 1] = 0;
  HEAP16[$s + 2692 >> 1] = 0;
  HEAP16[$s + 2696 >> 1] = 0;
  HEAP16[$s + 2700 >> 1] = 0;
  HEAP16[$s + 2704 >> 1] = 0;
  HEAP16[$s + 2708 >> 1] = 0;
  HEAP16[$s + 2712 >> 1] = 0;
  HEAP16[$s + 2716 >> 1] = 0;
  HEAP16[$s + 2720 >> 1] = 0;
  HEAP16[$s + 2724 >> 1] = 0;
  HEAP16[$s + 2728 >> 1] = 0;
  HEAP16[$s + 2732 >> 1] = 0;
  HEAP16[$s + 2736 >> 1] = 0;
  HEAP16[$s + 2740 >> 1] = 0;
  HEAP16[$s + 2744 >> 1] = 0;
  HEAP16[$s + 2748 >> 1] = 0;
  HEAP16[$s + 2752 >> 1] = 0;
  HEAP16[$s + 2756 >> 1] = 0;
  HEAP16[$s + 1172 >> 1] = 1;
  HEAP32[$s + 5804 >> 2] = 0;
  HEAP32[$s + 5800 >> 2] = 0;
  HEAP32[$s + 5808 >> 2] = 0;
  HEAP32[$s + 5792 >> 2] = 0;
  return;
}
_init_block["X"] = 1;
function _bi_flush($s) {
  var $24$s1;
  var $8$s2;
  var $5$s1;
  var $1$s2;
  var $1$s2 = ($s + 5820 | 0) >> 2;
  var $2 = HEAP32[$1$s2];
  if (($2 | 0) == 16) {
    var $5$s1 = ($s + 5816 | 0) >> 1;
    var $7 = HEAP16[$5$s1] & 255;
    var $8$s2 = ($s + 20 | 0) >> 2;
    var $9 = HEAP32[$8$s2];
    HEAP32[$8$s2] = $9 + 1 | 0;
    var $11 = $s + 8 | 0;
    HEAP8[HEAP32[$11 >> 2] + $9 | 0] = $7;
    var $16 = (HEAP16[$5$s1] & 65535) >>> 8 & 255;
    var $17 = HEAP32[$8$s2];
    HEAP32[$8$s2] = $17 + 1 | 0;
    HEAP8[HEAP32[$11 >> 2] + $17 | 0] = $16;
    HEAP16[$5$s1] = 0;
    HEAP32[$1$s2] = 0;
    return;
  }
  if (($2 | 0) <= 7) {
    return;
  }
  var $24$s1 = ($s + 5816 | 0) >> 1;
  var $26 = HEAP16[$24$s1] & 255;
  var $27 = $s + 20 | 0;
  var $28 = HEAP32[$27 >> 2];
  HEAP32[$27 >> 2] = $28 + 1 | 0;
  HEAP8[HEAP32[$s + 8 >> 2] + $28 | 0] = $26;
  HEAP16[$24$s1] = (HEAP16[$24$s1] & 65535) >>> 8;
  HEAP32[$1$s2] = HEAP32[$1$s2] - 8 | 0;
  return;
}
function _updatewindow($strm, $out) {
  var $44$s2;
  var $20$s2;
  var $2$s2;
  var $strm$s2 = $strm >> 2;
  var $2 = HEAP32[$strm$s2 + 7], $2$s2 = $2 >> 2;
  var $3 = $2 + 52 | 0;
  var $4 = $3;
  var $5 = HEAP32[$4 >> 2];
  do {
    if (($5 | 0) == 0) {
      var $15 = FUNCTION_TABLE[HEAP32[$strm$s2 + 8]](HEAP32[$strm$s2 + 10], 1 << HEAP32[$2$s2 + 9], 1);
      HEAP32[$3 >> 2] = $15;
      if (($15 | 0) == 0) {
        var $_0 = 1;
      } else {
        var $19 = $15;
        break;
      }
      var $_0;
      return $_0;
    } else {
      var $19 = $5;
    }
  } while (0);
  var $19;
  var $20$s2 = ($2 + 40 | 0) >> 2;
  var $21 = HEAP32[$20$s2];
  if (($21 | 0) == 0) {
    var $26 = 1 << HEAP32[$2$s2 + 9];
    HEAP32[$20$s2] = $26;
    HEAP32[$2$s2 + 12] = 0;
    HEAP32[$2$s2 + 11] = 0;
    var $30 = $26;
  } else {
    var $30 = $21;
  }
  var $30;
  var $33 = $out - HEAP32[$strm$s2 + 4] | 0;
  if ($33 >>> 0 >= $30 >>> 0) {
    _memcpy($19, HEAP32[$strm$s2 + 3] + -$30 | 0, $30, 1);
    HEAP32[$2$s2 + 12] = 0;
    HEAP32[$2$s2 + 11] = HEAP32[$20$s2];
    var $_0 = 0;
    var $_0;
    return $_0;
  }
  var $44$s2 = ($2 + 48 | 0) >> 2;
  var $45 = HEAP32[$44$s2];
  var $46 = $30 - $45 | 0;
  var $dist_0 = $46 >>> 0 > $33 >>> 0 ? $33 : $46;
  var $49 = $strm + 12 | 0;
  _memcpy($19 + $45 | 0, HEAP32[$49 >> 2] + -$33 | 0, $dist_0, 1);
  var $53 = $33 - $dist_0 | 0;
  if (($33 | 0) != ($dist_0 | 0)) {
    _memcpy(HEAP32[$4 >> 2], HEAP32[$49 >> 2] + -$53 | 0, $53, 1);
    HEAP32[$44$s2] = $53;
    HEAP32[$2$s2 + 11] = HEAP32[$20$s2];
    var $_0 = 0;
    var $_0;
    return $_0;
  }
  var $64 = HEAP32[$44$s2] + $dist_0 | 0;
  HEAP32[$44$s2] = $64;
  var $65 = HEAP32[$20$s2];
  if (($64 | 0) == ($65 | 0)) {
    HEAP32[$44$s2] = 0;
  }
  var $69 = $2 + 44 | 0;
  var $70 = HEAP32[$69 >> 2];
  if ($70 >>> 0 >= $65 >>> 0) {
    var $_0 = 0;
    var $_0;
    return $_0;
  }
  HEAP32[$69 >> 2] = $70 + $dist_0 | 0;
  var $_0 = 0;
  var $_0;
  return $_0;
}
_updatewindow["X"] = 1;
function _inflateEnd($strm) {
  var $3$s2;
  if (($strm | 0) == 0) {
    return;
  }
  var $3$s2 = ($strm + 28 | 0) >> 2;
  var $4 = HEAP32[$3$s2];
  if (($4 | 0) == 0) {
    return;
  }
  var $7 = $strm + 36 | 0;
  var $8 = HEAP32[$7 >> 2];
  if (($8 | 0) == 0) {
    return;
  }
  var $13 = HEAP32[$4 + 52 >> 2];
  var $_pre2 = $strm + 40 | 0;
  if (($13 | 0) == 0) {
    var $18 = $8;
    var $17 = $4;
  } else {
    FUNCTION_TABLE[$8](HEAP32[$_pre2 >> 2], $13);
    var $18 = HEAP32[$7 >> 2];
    var $17 = HEAP32[$3$s2];
  }
  var $17;
  var $18;
  FUNCTION_TABLE[$18](HEAP32[$_pre2 >> 2], $17);
  HEAP32[$3$s2] = 0;
  return;
}
function _inflate_table($type, $lens, $codes, $table, $bits, $work) {
  var $offs$s1;
  var $count$s1;
  var $table$s2 = $table >> 2;
  var __stackBase__ = STACKTOP;
  STACKTOP += 32;
  var label;
  var $count = __stackBase__, $count$s1 = $count >> 1;
  var $offs = STACKTOP, $offs$s1 = $offs >> 1;
  STACKTOP += 32;
  _memset($count, 0, 32, 2);
  var $0 = ($codes | 0) == 0;
  L1374 : do {
    if (!$0) {
      var $sym_057 = 0;
      while (1) {
        var $sym_057;
        var $4 = ((HEAP16[$lens + ($sym_057 << 1) >> 1] & 65535) << 1) + $count | 0;
        HEAP16[$4 >> 1] = HEAP16[$4 >> 1] + 1 & 65535;
        var $7 = $sym_057 + 1 | 0;
        if (($7 | 0) == ($codes | 0)) {
          break L1374;
        } else {
          var $sym_057 = $7;
        }
      }
    }
  } while (0);
  var $8 = HEAP32[$bits >> 2];
  var $max_0 = 15;
  while (1) {
    var $max_0;
    if (($max_0 | 0) == 0) {
      label = 1048;
      break;
    }
    if (HEAP16[($max_0 << 1 >> 1) + $count$s1] << 16 >> 16 != 0) {
      break;
    }
    var $max_0 = $max_0 - 1 | 0;
  }
  if (label == 1048) {
    var $20 = HEAP32[$table$s2];
    HEAP32[$table$s2] = $20 + 4 | 0;
    HEAP8[$20 | 0] = 64;
    HEAP8[$20 + 1 | 0] = 1;
    HEAP16[$20 + 2 >> 1] = 0;
    var $22 = HEAP32[$table$s2];
    HEAP32[$table$s2] = $22 + 4 | 0;
    HEAP8[$22 | 0] = 64;
    HEAP8[$22 + 1 | 0] = 1;
    HEAP16[$22 + 2 >> 1] = 0;
    HEAP32[$bits >> 2] = 1;
    var $_0 = 0;
    var $_0;
    STACKTOP = __stackBase__;
    return $_0;
  }
  var $root_0 = $8 >>> 0 > $max_0 >>> 0 ? $max_0 : $8;
  var $min_0 = 1;
  while (1) {
    var $min_0;
    if ($min_0 >>> 0 >= $max_0 >>> 0) {
      break;
    }
    if (HEAP16[($min_0 << 1 >> 1) + $count$s1] << 16 >> 16 != 0) {
      break;
    }
    var $min_0 = $min_0 + 1 | 0;
  }
  var $root_1 = $root_0 >>> 0 < $min_0 >>> 0 ? $min_0 : $root_0;
  var $len_1 = 1;
  var $left_0 = 1;
  while (1) {
    var $left_0;
    var $len_1;
    if ($len_1 >>> 0 >= 16) {
      break;
    }
    var $41 = ($left_0 << 1) - (HEAP16[($len_1 << 1 >> 1) + $count$s1] & 65535) | 0;
    if (($41 | 0) < 0) {
      var $_0 = -1;
      label = 1097;
      break;
    }
    var $len_1 = $len_1 + 1 | 0;
    var $left_0 = $41;
  }
  if (label == 1097) {
    var $_0;
    STACKTOP = __stackBase__;
    return $_0;
  }
  do {
    if (($left_0 | 0) > 0) {
      if (($type | 0) != 0 & ($max_0 | 0) == 1) {
        break;
      } else {
        var $_0 = -1;
      }
      var $_0;
      STACKTOP = __stackBase__;
      return $_0;
    }
  } while (0);
  HEAP16[$offs$s1 + 1] = 0;
  var $52 = HEAP16[$count$s1 + 1];
  HEAP16[$offs$s1 + 2] = $52;
  var $56 = HEAP16[$count$s1 + 2] + $52 & 65535;
  HEAP16[$offs$s1 + 3] = $56;
  var $60 = HEAP16[$count$s1 + 3] + $56 & 65535;
  HEAP16[$offs$s1 + 4] = $60;
  var $64 = HEAP16[$count$s1 + 4] + $60 & 65535;
  HEAP16[$offs$s1 + 5] = $64;
  var $68 = HEAP16[$count$s1 + 5] + $64 & 65535;
  HEAP16[$offs$s1 + 6] = $68;
  var $72 = HEAP16[$count$s1 + 6] + $68 & 65535;
  HEAP16[$offs$s1 + 7] = $72;
  var $76 = HEAP16[$count$s1 + 7] + $72 & 65535;
  HEAP16[$offs$s1 + 8] = $76;
  var $80 = HEAP16[$count$s1 + 8] + $76 & 65535;
  HEAP16[$offs$s1 + 9] = $80;
  var $84 = HEAP16[$count$s1 + 9] + $80 & 65535;
  HEAP16[$offs$s1 + 10] = $84;
  var $88 = HEAP16[$count$s1 + 10] + $84 & 65535;
  HEAP16[$offs$s1 + 11] = $88;
  var $92 = HEAP16[$count$s1 + 11] + $88 & 65535;
  HEAP16[$offs$s1 + 12] = $92;
  var $96 = HEAP16[$count$s1 + 12] + $92 & 65535;
  HEAP16[$offs$s1 + 13] = $96;
  var $100 = HEAP16[$count$s1 + 13] + $96 & 65535;
  HEAP16[$offs$s1 + 14] = $100;
  HEAP16[$offs$s1 + 15] = HEAP16[$count$s1 + 14] + $100 & 65535;
  L1402 : do {
    if (!$0) {
      var $sym_149 = 0;
      while (1) {
        var $sym_149;
        var $107 = HEAP16[$lens + ($sym_149 << 1) >> 1];
        if ($107 << 16 >> 16 != 0) {
          var $112 = (($107 & 65535) << 1) + $offs | 0;
          var $113 = HEAP16[$112 >> 1];
          HEAP16[$112 >> 1] = $113 + 1 & 65535;
          HEAP16[$work + (($113 & 65535) << 1) >> 1] = $sym_149 & 65535;
        }
        var $118 = $sym_149 + 1 | 0;
        if (($118 | 0) == ($codes | 0)) {
          break L1402;
        } else {
          var $sym_149 = $118;
        }
      }
    }
  } while (0);
  do {
    if (($type | 0) == 0) {
      var $_ph39 = 0;
      var $_ph38_in = 1 << $root_1;
      var $end_03134_ph = 19;
      var $extra_03035_ph = $work;
      var $base_02936_ph = $work;
      var $_ph = 0;
      break;
    } else if (($type | 0) == 1) {
      var $end_0 = 256;
      var $extra_0 = _inflate_table_lext + 4294966782 | 0;
      var $base_0 = _inflate_table_lbase + 4294966782 | 0;
      label = 1065;
    } else {
      var $end_0 = -1;
      var $extra_0 = _inflate_table_dext | 0;
      var $base_0 = _inflate_table_dbase | 0;
      label = 1065;
      break;
    }
  } while (0);
  do {
    if (label == 1065) {
      var $base_0;
      var $extra_0;
      var $end_0;
      var $122 = 1 << $root_1;
      var $123 = ($type | 0) == 1;
      if ($123 & $122 >>> 0 > 851) {
        var $_0 = 1;
        var $_0;
        STACKTOP = __stackBase__;
        return $_0;
      }
      var $126 = ($type | 0) == 2;
      if ($126 & $122 >>> 0 > 591) {
        var $_0 = 1;
      } else {
        var $_ph39 = $123;
        var $_ph38_in = $122;
        var $end_03134_ph = $end_0;
        var $extra_03035_ph = $extra_0;
        var $base_02936_ph = $base_0;
        var $_ph = $126;
        break;
      }
      var $_0;
      STACKTOP = __stackBase__;
      return $_0;
    }
  } while (0);
  var $_ph;
  var $base_02936_ph;
  var $extra_03035_ph;
  var $end_03134_ph;
  var $_ph38_in;
  var $_ph39;
  var $_ph38 = $_ph38_in - 1 | 0;
  var $128 = $root_1 & 255;
  var $next_0_ph41 = HEAP32[$table$s2];
  var $low_0_ph = -1;
  var $len_3_ph = $min_0;
  var $sym_2_ph = 0;
  var $curr_0_ph = $root_1;
  var $drop_0_ph = 0;
  var $used_0_ph40 = $_ph38_in;
  var $huff_0_ph = 0;
  L1419 : while (1) {
    var $huff_0_ph;
    var $used_0_ph40;
    var $drop_0_ph;
    var $curr_0_ph;
    var $sym_2_ph;
    var $len_3_ph;
    var $low_0_ph;
    var $next_0_ph41;
    var $129 = 1 << $curr_0_ph;
    var $len_3 = $len_3_ph;
    var $sym_2 = $sym_2_ph;
    var $huff_0 = $huff_0_ph;
    while (1) {
      var $huff_0;
      var $sym_2;
      var $len_3;
      var $130 = $len_3 - $drop_0_ph | 0;
      var $131 = $130 & 255;
      var $133 = HEAP16[$work + ($sym_2 << 1) >> 1];
      var $134 = $133 & 65535;
      do {
        if (($134 | 0) < ($end_03134_ph | 0)) {
          var $here_0_0 = 0;
          var $here_2_0 = $133;
        } else {
          if (($134 | 0) <= ($end_03134_ph | 0)) {
            var $here_0_0 = 96;
            var $here_2_0 = 0;
            break;
          }
          var $here_0_0 = HEAP16[$extra_03035_ph + ($134 << 1) >> 1] & 255;
          var $here_2_0 = HEAP16[$base_02936_ph + ($134 << 1) >> 1];
        }
      } while (0);
      var $here_2_0;
      var $here_0_0;
      var $145 = 1 << $130;
      var $146 = $huff_0 >>> ($drop_0_ph >>> 0);
      var $fill_0 = $129;
      while (1) {
        var $fill_0;
        var $148 = $fill_0 - $145 | 0;
        var $149 = $148 + $146 | 0;
        HEAP8[($149 << 2) + $next_0_ph41 | 0] = $here_0_0;
        HEAP8[($149 << 2) + $next_0_ph41 + 1 | 0] = $131;
        HEAP16[$next_0_ph41 + ($149 << 2) + 2 >> 1] = $here_2_0;
        if (($fill_0 | 0) == ($145 | 0)) {
          break;
        } else {
          var $fill_0 = $148;
        }
      }
      var $153 = 1 << $len_3 - 1;
      do {
        if (($153 & $huff_0 | 0) == 0) {
          var $incr_0_lcssa78 = $153;
          label = 1077;
        } else {
          var $incr_037 = $153;
          while (1) {
            var $incr_037;
            var $156 = $incr_037 >>> 1;
            if (($156 & $huff_0 | 0) == 0) {
              break;
            } else {
              var $incr_037 = $156;
            }
          }
          if (($156 | 0) == 0) {
            var $huff_1 = 0;
            break;
          } else {
            var $incr_0_lcssa78 = $156;
            label = 1077;
            break;
          }
        }
      } while (0);
      if (label == 1077) {
        label = 0;
        var $incr_0_lcssa78;
        var $huff_1 = ($incr_0_lcssa78 - 1 & $huff_0) + $incr_0_lcssa78 | 0;
      }
      var $huff_1;
      var $164 = $sym_2 + 1 | 0;
      var $165 = ($len_3 << 1) + $count | 0;
      var $167 = HEAP16[$165 >> 1] - 1 & 65535;
      HEAP16[$165 >> 1] = $167;
      if ($167 << 16 >> 16 == 0) {
        if (($len_3 | 0) == ($max_0 | 0)) {
          break L1419;
        }
        var $len_4 = HEAP16[$lens + ((HEAP16[$work + ($164 << 1) >> 1] & 65535) << 1) >> 1] & 65535;
      } else {
        var $len_4 = $len_3;
      }
      var $len_4;
      if ($len_4 >>> 0 <= $root_1 >>> 0) {
        var $len_3 = $len_4;
        var $sym_2 = $164;
        var $huff_0 = $huff_1;
        continue;
      }
      var $181 = $huff_1 & $_ph38;
      if (($181 | 0) == ($low_0_ph | 0)) {
        var $len_3 = $len_4;
        var $sym_2 = $164;
        var $huff_0 = $huff_1;
      } else {
        break;
      }
    }
    var $drop_1 = ($drop_0_ph | 0) == 0 ? $root_1 : $drop_0_ph;
    var $185 = ($129 << 2) + $next_0_ph41 | 0;
    var $186 = $len_4 - $drop_1 | 0;
    var $curr_1 = $186;
    var $left_1 = 1 << $186;
    while (1) {
      var $left_1;
      var $curr_1;
      var $189 = $curr_1 + $drop_1 | 0;
      if ($189 >>> 0 >= $max_0 >>> 0) {
        break;
      }
      var $195 = $left_1 - (HEAP16[($189 << 1 >> 1) + $count$s1] & 65535) | 0;
      if (($195 | 0) < 1) {
        break;
      }
      var $curr_1 = $curr_1 + 1 | 0;
      var $left_1 = $195 << 1;
    }
    var $202 = (1 << $curr_1) + $used_0_ph40 | 0;
    if ($_ph39 & $202 >>> 0 > 851 | $_ph & $202 >>> 0 > 591) {
      var $_0 = 1;
      label = 1094;
      break;
    }
    HEAP8[($181 << 2) + HEAP32[$table$s2] | 0] = $curr_1 & 255;
    HEAP8[($181 << 2) + HEAP32[$table$s2] + 1 | 0] = $128;
    var $211 = HEAP32[$table$s2];
    HEAP16[$211 + ($181 << 2) + 2 >> 1] = ($185 - $211 | 0) >>> 2 & 65535;
    var $next_0_ph41 = $185;
    var $low_0_ph = $181;
    var $len_3_ph = $len_4;
    var $sym_2_ph = $164;
    var $curr_0_ph = $curr_1;
    var $drop_0_ph = $drop_1;
    var $used_0_ph40 = $202;
    var $huff_0_ph = $huff_1;
  }
  if (label == 1094) {
    var $_0;
    STACKTOP = __stackBase__;
    return $_0;
  }
  if (($huff_1 | 0) != 0) {
    HEAP8[($huff_1 << 2) + $next_0_ph41 | 0] = 64;
    HEAP8[($huff_1 << 2) + $next_0_ph41 + 1 | 0] = $131;
    HEAP16[$next_0_ph41 + ($huff_1 << 2) + 2 >> 1] = 0;
  }
  HEAP32[$table$s2] = ($used_0_ph40 << 2) + HEAP32[$table$s2] | 0;
  HEAP32[$bits >> 2] = $root_1;
  var $_0 = 0;
  var $_0;
  STACKTOP = __stackBase__;
  return $_0;
}
_inflate_table["X"] = 1;
function __tr_init($s) {
  HEAP32[$s + 2840 >> 2] = $s + 148 | 0;
  HEAP32[$s + 2848 >> 2] = _static_l_desc;
  HEAP32[$s + 2852 >> 2] = $s + 2440 | 0;
  HEAP32[$s + 2860 >> 2] = _static_d_desc;
  HEAP32[$s + 2864 >> 2] = $s + 2684 | 0;
  HEAP32[$s + 2872 >> 2] = _static_bl_desc;
  HEAP16[$s + 5816 >> 1] = 0;
  HEAP32[$s + 5820 >> 2] = 0;
  _init_block($s);
  return;
}
function __tr_stored_block($s, $buf, $stored_len, $last) {
  var $13$s2;
  var $6$s1;
  var $1$s2;
  var $1$s2 = ($s + 5820 | 0) >> 2;
  var $2 = HEAP32[$1$s2];
  var $4 = $last & 65535;
  var $6$s1 = ($s + 5816 | 0) >> 1;
  var $9 = HEAP16[$6$s1] & 65535 | $4 << $2;
  HEAP16[$6$s1] = $9 & 65535;
  if (($2 | 0) > 13) {
    var $13$s2 = ($s + 20 | 0) >> 2;
    var $14 = HEAP32[$13$s2];
    HEAP32[$13$s2] = $14 + 1 | 0;
    var $16 = $s + 8 | 0;
    HEAP8[HEAP32[$16 >> 2] + $14 | 0] = $9 & 255;
    var $21 = (HEAP16[$6$s1] & 65535) >>> 8 & 255;
    var $22 = HEAP32[$13$s2];
    HEAP32[$13$s2] = $22 + 1 | 0;
    HEAP8[HEAP32[$16 >> 2] + $22 | 0] = $21;
    var $26 = HEAP32[$1$s2];
    HEAP16[$6$s1] = $4 >>> ((16 - $26 | 0) >>> 0) & 65535;
    var $storemerge = $26 - 13 | 0;
    var $storemerge;
    HEAP32[$1$s2] = $storemerge;
    _copy_block($s, $buf, $stored_len);
    return;
  } else {
    var $storemerge = $2 + 3 | 0;
    var $storemerge;
    HEAP32[$1$s2] = $storemerge;
    _copy_block($s, $buf, $stored_len);
    return;
  }
}
function _copy_block($s, $buf, $len) {
  var $5$s2;
  var $2$s2;
  _bi_windup($s);
  var $2$s2 = ($s + 20 | 0) >> 2;
  var $3 = HEAP32[$2$s2];
  HEAP32[$2$s2] = $3 + 1 | 0;
  var $5$s2 = ($s + 8 | 0) >> 2;
  HEAP8[HEAP32[$5$s2] + $3 | 0] = $len & 255;
  var $10 = HEAP32[$2$s2];
  HEAP32[$2$s2] = $10 + 1 | 0;
  HEAP8[HEAP32[$5$s2] + $10 | 0] = $len >>> 8 & 255;
  var $15 = $len & 65535 ^ 65535;
  var $17 = HEAP32[$2$s2];
  HEAP32[$2$s2] = $17 + 1 | 0;
  HEAP8[HEAP32[$5$s2] + $17 | 0] = $15 & 255;
  var $23 = HEAP32[$2$s2];
  HEAP32[$2$s2] = $23 + 1 | 0;
  HEAP8[HEAP32[$5$s2] + $23 | 0] = $15 >>> 8 & 255;
  if (($len | 0) == 0) {
    return;
  } else {
    var $_011 = $buf;
    var $_02 = $len;
  }
  while (1) {
    var $_02;
    var $_011;
    var $28 = $_02 - 1 | 0;
    var $30 = HEAP8[$_011];
    var $31 = HEAP32[$2$s2];
    HEAP32[$2$s2] = $31 + 1 | 0;
    HEAP8[HEAP32[$5$s2] + $31 | 0] = $30;
    if (($28 | 0) == 0) {
      break;
    } else {
      var $_011 = $_011 + 1 | 0;
      var $_02 = $28;
    }
  }
  return;
}
_copy_block["X"] = 1;
function __tr_flush_bits($s) {
  _bi_flush($s);
  return;
}
function _detect_data_type($s) {
  var $s$s1 = $s >> 1;
  var label;
  var $n_0 = 0;
  var $black_mask_0 = -201342849;
  while (1) {
    var $black_mask_0;
    var $n_0;
    if (($n_0 | 0) >= 32) {
      break;
    }
    if (($black_mask_0 & 1 | 0) != 0) {
      if (HEAP16[(($n_0 << 2) + 148 >> 1) + $s$s1] << 16 >> 16 != 0) {
        var $_0 = 0;
        label = 1125;
        break;
      }
    }
    var $n_0 = $n_0 + 1 | 0;
    var $black_mask_0 = $black_mask_0 >>> 1;
  }
  if (label == 1125) {
    var $_0;
    return $_0;
  }
  if (HEAP16[$s$s1 + 92] << 16 >> 16 != 0) {
    var $_0 = 1;
    var $_0;
    return $_0;
  }
  if (HEAP16[$s$s1 + 94] << 16 >> 16 != 0) {
    var $_0 = 1;
    var $_0;
    return $_0;
  }
  if (HEAP16[$s$s1 + 100] << 16 >> 16 == 0) {
    var $n_1 = 32;
  } else {
    var $_0 = 1;
    var $_0;
    return $_0;
  }
  while (1) {
    var $n_1;
    if (($n_1 | 0) >= 256) {
      var $_0 = 0;
      label = 1128;
      break;
    }
    if (HEAP16[(($n_1 << 2) + 148 >> 1) + $s$s1] << 16 >> 16 != 0) {
      var $_0 = 1;
      label = 1127;
      break;
    }
    var $n_1 = $n_1 + 1 | 0;
  }
  if (label == 1127) {
    var $_0;
    return $_0;
  } else if (label == 1128) {
    var $_0;
    return $_0;
  }
}
function _compress_block($s, $ltree, $dtree) {
  var $240$s2;
  var $234$s1;
  var $227$s2;
  var $9$s2;
  var $8$s2;
  var $7$s1;
  var $6$s2;
  var $ltree$s1 = $ltree >> 1;
  var $1 = $s + 5792 | 0;
  var $3 = (HEAP32[$1 >> 2] | 0) == 0;
  L1496 : do {
    if ($3) {
      var $223 = HEAP32[$s + 5820 >> 2];
      var $222 = HEAP16[$s + 5816 >> 1];
    } else {
      var $4 = $s + 5796 | 0;
      var $5 = $s + 5784 | 0;
      var $6$s2 = ($s + 5820 | 0) >> 2;
      var $7$s1 = ($s + 5816 | 0) >> 1;
      var $8$s2 = ($s + 20 | 0) >> 2;
      var $9$s2 = ($s + 8 | 0) >> 2;
      var $lx_0 = 0;
      while (1) {
        var $lx_0;
        var $12 = HEAP16[HEAP32[$4 >> 2] + ($lx_0 << 1) >> 1];
        var $13 = $12 & 65535;
        var $14 = $lx_0 + 1 | 0;
        var $18 = HEAP8[HEAP32[$5 >> 2] + $lx_0 | 0] & 255;
        do {
          if ($12 << 16 >> 16 == 0) {
            var $23 = HEAP16[(($18 << 2) + 2 >> 1) + $ltree$s1] & 65535;
            var $24 = HEAP32[$6$s2];
            var $29 = HEAP16[($18 << 2 >> 1) + $ltree$s1] & 65535;
            var $33 = HEAP16[$7$s1] & 65535 | $29 << $24;
            var $34 = $33 & 65535;
            HEAP16[$7$s1] = $34;
            if (($24 | 0) > (16 - $23 | 0)) {
              var $37 = HEAP32[$8$s2];
              HEAP32[$8$s2] = $37 + 1 | 0;
              HEAP8[HEAP32[$9$s2] + $37 | 0] = $33 & 255;
              var $43 = (HEAP16[$7$s1] & 65535) >>> 8 & 255;
              var $44 = HEAP32[$8$s2];
              HEAP32[$8$s2] = $44 + 1 | 0;
              HEAP8[HEAP32[$9$s2] + $44 | 0] = $43;
              var $48 = HEAP32[$6$s2];
              var $51 = $29 >>> ((16 - $48 | 0) >>> 0) & 65535;
              HEAP16[$7$s1] = $51;
              var $53 = $23 - 16 + $48 | 0;
              HEAP32[$6$s2] = $53;
              var $219 = $53;
              var $218 = $51;
              break;
            } else {
              var $55 = $24 + $23 | 0;
              HEAP32[$6$s2] = $55;
              var $219 = $55;
              var $218 = $34;
              break;
            }
          } else {
            var $59 = HEAP8[STRING_TABLE.__length_code + $18 | 0] & 255;
            var $61 = ($59 | 256) + 1 | 0;
            var $64 = HEAP16[(($61 << 2) + 2 >> 1) + $ltree$s1] & 65535;
            var $65 = HEAP32[$6$s2];
            var $70 = HEAP16[($61 << 2 >> 1) + $ltree$s1] & 65535;
            var $74 = HEAP16[$7$s1] & 65535 | $70 << $65;
            var $75 = $74 & 65535;
            HEAP16[$7$s1] = $75;
            if (($65 | 0) > (16 - $64 | 0)) {
              var $78 = HEAP32[$8$s2];
              HEAP32[$8$s2] = $78 + 1 | 0;
              HEAP8[HEAP32[$9$s2] + $78 | 0] = $74 & 255;
              var $84 = (HEAP16[$7$s1] & 65535) >>> 8 & 255;
              var $85 = HEAP32[$8$s2];
              HEAP32[$8$s2] = $85 + 1 | 0;
              HEAP8[HEAP32[$9$s2] + $85 | 0] = $84;
              var $89 = HEAP32[$6$s2];
              var $92 = $70 >>> ((16 - $89 | 0) >>> 0) & 65535;
              HEAP16[$7$s1] = $92;
              var $99 = $64 - 16 + $89 | 0;
              var $98 = $92;
            } else {
              var $99 = $65 + $64 | 0;
              var $98 = $75;
            }
            var $98;
            var $99;
            HEAP32[$6$s2] = $99;
            var $101 = HEAP32[_extra_lbits + ($59 << 2) >> 2];
            do {
              if (($59 - 8 | 0) >>> 0 < 20) {
                var $110 = $18 - HEAP32[_base_length + ($59 << 2) >> 2] & 65535;
                var $113 = $110 << $99 | $98 & 65535;
                var $114 = $113 & 65535;
                HEAP16[$7$s1] = $114;
                if (($99 | 0) > (16 - $101 | 0)) {
                  var $117 = HEAP32[$8$s2];
                  HEAP32[$8$s2] = $117 + 1 | 0;
                  HEAP8[HEAP32[$9$s2] + $117 | 0] = $113 & 255;
                  var $123 = (HEAP16[$7$s1] & 65535) >>> 8 & 255;
                  var $124 = HEAP32[$8$s2];
                  HEAP32[$8$s2] = $124 + 1 | 0;
                  HEAP8[HEAP32[$9$s2] + $124 | 0] = $123;
                  var $128 = HEAP32[$6$s2];
                  var $131 = $110 >>> ((16 - $128 | 0) >>> 0) & 65535;
                  HEAP16[$7$s1] = $131;
                  var $133 = $101 - 16 + $128 | 0;
                  HEAP32[$6$s2] = $133;
                  var $138 = $133;
                  var $137 = $131;
                  break;
                } else {
                  var $135 = $99 + $101 | 0;
                  HEAP32[$6$s2] = $135;
                  var $138 = $135;
                  var $137 = $114;
                  break;
                }
              } else {
                var $138 = $99;
                var $137 = $98;
              }
            } while (0);
            var $137;
            var $138;
            var $139 = $13 - 1 | 0;
            if ($139 >>> 0 < 256) {
              var $_pn = $139;
            } else {
              var $_pn = ($139 >>> 7) + 256 | 0;
            }
            var $_pn;
            var $145 = HEAP8[STRING_TABLE.__dist_code + $_pn | 0] & 255;
            var $148 = HEAP16[$dtree + ($145 << 2) + 2 >> 1] & 65535;
            var $153 = HEAP16[$dtree + ($145 << 2) >> 1] & 65535;
            var $156 = $137 & 65535 | $153 << $138;
            var $157 = $156 & 65535;
            HEAP16[$7$s1] = $157;
            if (($138 | 0) > (16 - $148 | 0)) {
              var $160 = HEAP32[$8$s2];
              HEAP32[$8$s2] = $160 + 1 | 0;
              HEAP8[HEAP32[$9$s2] + $160 | 0] = $156 & 255;
              var $166 = (HEAP16[$7$s1] & 65535) >>> 8 & 255;
              var $167 = HEAP32[$8$s2];
              HEAP32[$8$s2] = $167 + 1 | 0;
              HEAP8[HEAP32[$9$s2] + $167 | 0] = $166;
              var $171 = HEAP32[$6$s2];
              var $174 = $153 >>> ((16 - $171 | 0) >>> 0) & 65535;
              HEAP16[$7$s1] = $174;
              var $181 = $148 - 16 + $171 | 0;
              var $180 = $174;
            } else {
              var $181 = $138 + $148 | 0;
              var $180 = $157;
            }
            var $180;
            var $181;
            HEAP32[$6$s2] = $181;
            var $183 = HEAP32[_extra_dbits + ($145 << 2) >> 2];
            if (($145 - 4 | 0) >>> 0 >= 26) {
              var $219 = $181;
              var $218 = $180;
              break;
            }
            var $192 = $139 - HEAP32[_base_dist + ($145 << 2) >> 2] & 65535;
            var $195 = $192 << $181 | $180 & 65535;
            var $196 = $195 & 65535;
            HEAP16[$7$s1] = $196;
            if (($181 | 0) > (16 - $183 | 0)) {
              var $199 = HEAP32[$8$s2];
              HEAP32[$8$s2] = $199 + 1 | 0;
              HEAP8[HEAP32[$9$s2] + $199 | 0] = $195 & 255;
              var $205 = (HEAP16[$7$s1] & 65535) >>> 8 & 255;
              var $206 = HEAP32[$8$s2];
              HEAP32[$8$s2] = $206 + 1 | 0;
              HEAP8[HEAP32[$9$s2] + $206 | 0] = $205;
              var $210 = HEAP32[$6$s2];
              var $213 = $192 >>> ((16 - $210 | 0) >>> 0) & 65535;
              HEAP16[$7$s1] = $213;
              var $215 = $183 - 16 + $210 | 0;
              HEAP32[$6$s2] = $215;
              var $219 = $215;
              var $218 = $213;
              break;
            } else {
              var $217 = $181 + $183 | 0;
              HEAP32[$6$s2] = $217;
              var $219 = $217;
              var $218 = $196;
              break;
            }
          }
        } while (0);
        var $218;
        var $219;
        if ($14 >>> 0 < HEAP32[$1 >> 2] >>> 0) {
          var $lx_0 = $14;
        } else {
          var $223 = $219;
          var $222 = $218;
          break L1496;
        }
      }
    }
  } while (0);
  var $222;
  var $223;
  var $226 = HEAP16[$ltree$s1 + 513] & 65535;
  var $227$s2 = ($s + 5820 | 0) >> 2;
  var $232 = HEAP16[$ltree$s1 + 512] & 65535;
  var $234$s1 = ($s + 5816 | 0) >> 1;
  var $236 = $222 & 65535 | $232 << $223;
  HEAP16[$234$s1] = $236 & 65535;
  if (($223 | 0) > (16 - $226 | 0)) {
    var $240$s2 = ($s + 20 | 0) >> 2;
    var $241 = HEAP32[$240$s2];
    HEAP32[$240$s2] = $241 + 1 | 0;
    var $243 = $s + 8 | 0;
    HEAP8[HEAP32[$243 >> 2] + $241 | 0] = $236 & 255;
    var $248 = (HEAP16[$234$s1] & 65535) >>> 8 & 255;
    var $249 = HEAP32[$240$s2];
    HEAP32[$240$s2] = $249 + 1 | 0;
    HEAP8[HEAP32[$243 >> 2] + $249 | 0] = $248;
    var $253 = HEAP32[$227$s2];
    HEAP16[$234$s1] = $232 >>> ((16 - $253 | 0) >>> 0) & 65535;
    var $storemerge = $226 - 16 + $253 | 0;
    var $storemerge;
    HEAP32[$227$s2] = $storemerge;
    return;
  } else {
    var $storemerge = $223 + $226 | 0;
    var $storemerge;
    HEAP32[$227$s2] = $storemerge;
    return;
  }
}
_compress_block["X"] = 1;
function __tr_align($s) {
  var $37$s2;
  var $12$s2;
  var $5$s1;
  var $1$s2;
  var $1$s2 = ($s + 5820 | 0) >> 2;
  var $2 = HEAP32[$1$s2];
  var $5$s1 = ($s + 5816 | 0) >> 1;
  var $8 = HEAP16[$5$s1] & 65535 | 2 << $2;
  var $9 = $8 & 65535;
  HEAP16[$5$s1] = $9;
  if (($2 | 0) > 13) {
    var $12$s2 = ($s + 20 | 0) >> 2;
    var $13 = HEAP32[$12$s2];
    HEAP32[$12$s2] = $13 + 1 | 0;
    var $15 = $s + 8 | 0;
    HEAP8[HEAP32[$15 >> 2] + $13 | 0] = $8 & 255;
    var $20 = (HEAP16[$5$s1] & 65535) >>> 8 & 255;
    var $21 = HEAP32[$12$s2];
    HEAP32[$12$s2] = $21 + 1 | 0;
    HEAP8[HEAP32[$15 >> 2] + $21 | 0] = $20;
    var $25 = HEAP32[$1$s2];
    var $28 = 2 >>> ((16 - $25 | 0) >>> 0) & 65535;
    HEAP16[$5$s1] = $28;
    var $storemerge = $25 - 13 | 0;
    var $33 = $28;
  } else {
    var $storemerge = $2 + 3 | 0;
    var $33 = $9;
  }
  var $33;
  var $storemerge;
  HEAP32[$1$s2] = $storemerge;
  if (($storemerge | 0) > 9) {
    var $37$s2 = ($s + 20 | 0) >> 2;
    var $38 = HEAP32[$37$s2];
    HEAP32[$37$s2] = $38 + 1 | 0;
    var $40 = $s + 8 | 0;
    HEAP8[HEAP32[$40 >> 2] + $38 | 0] = $33 & 255;
    var $45 = (HEAP16[$5$s1] & 65535) >>> 8 & 255;
    var $46 = HEAP32[$37$s2];
    HEAP32[$37$s2] = $46 + 1 | 0;
    HEAP8[HEAP32[$40 >> 2] + $46 | 0] = $45;
    HEAP16[$5$s1] = 0;
    var $storemerge1 = HEAP32[$1$s2] - 9 | 0;
    var $storemerge1;
    HEAP32[$1$s2] = $storemerge1;
    _bi_flush($s);
    return;
  } else {
    var $storemerge1 = $storemerge + 7 | 0;
    var $storemerge1;
    HEAP32[$1$s2] = $storemerge1;
    _bi_flush($s);
    return;
  }
}
__tr_align["X"] = 1;
function __tr_flush_block($s, $buf, $stored_len, $last) {
  var $84$s2;
  var $77$s1;
  var $52$s2;
  var $45$s1;
  var $38$s2;
  var $s$s2 = $s >> 2;
  do {
    if ((HEAP32[$s$s2 + 33] | 0) > 0) {
      var $7 = HEAP32[$s$s2] + 44 | 0;
      if ((HEAP32[$7 >> 2] | 0) == 2) {
        HEAP32[$7 >> 2] = _detect_data_type($s);
      }
      _build_tree($s, $s + 2840 | 0);
      _build_tree($s, $s + 2852 | 0);
      var $15 = _build_bl_tree($s);
      var $19 = (HEAP32[$s$s2 + 1450] + 10 | 0) >>> 3;
      var $23 = (HEAP32[$s$s2 + 1451] + 10 | 0) >>> 3;
      if ($23 >>> 0 > $19 >>> 0) {
        var $max_blindex_0 = $15;
        var $static_lenb_0 = $23;
        var $opt_lenb_0 = $19;
        break;
      }
      var $max_blindex_0 = $15;
      var $static_lenb_0 = $23;
      var $opt_lenb_0 = $23;
    } else {
      var $27 = $stored_len + 5 | 0;
      var $max_blindex_0 = 0;
      var $static_lenb_0 = $27;
      var $opt_lenb_0 = $27;
    }
  } while (0);
  var $opt_lenb_0;
  var $static_lenb_0;
  var $max_blindex_0;
  do {
    if (($stored_len + 4 | 0) >>> 0 > $opt_lenb_0 >>> 0 | ($buf | 0) == 0) {
      var $38$s2 = ($s + 5820 | 0) >> 2;
      var $39 = HEAP32[$38$s2];
      var $40 = ($39 | 0) > 13;
      if ((HEAP32[$s$s2 + 34] | 0) == 4 | ($static_lenb_0 | 0) == ($opt_lenb_0 | 0)) {
        var $43 = $last + 2 & 65535;
        var $45$s1 = ($s + 5816 | 0) >> 1;
        var $48 = HEAP16[$45$s1] & 65535 | $43 << $39;
        HEAP16[$45$s1] = $48 & 65535;
        if ($40) {
          var $52$s2 = ($s + 20 | 0) >> 2;
          var $53 = HEAP32[$52$s2];
          HEAP32[$52$s2] = $53 + 1 | 0;
          var $55 = $s + 8 | 0;
          HEAP8[HEAP32[$55 >> 2] + $53 | 0] = $48 & 255;
          var $60 = (HEAP16[$45$s1] & 65535) >>> 8 & 255;
          var $61 = HEAP32[$52$s2];
          HEAP32[$52$s2] = $61 + 1 | 0;
          HEAP8[HEAP32[$55 >> 2] + $61 | 0] = $60;
          var $65 = HEAP32[$38$s2];
          HEAP16[$45$s1] = $43 >>> ((16 - $65 | 0) >>> 0) & 65535;
          var $storemerge1 = $65 - 13 | 0;
        } else {
          var $storemerge1 = $39 + 3 | 0;
        }
        var $storemerge1;
        HEAP32[$38$s2] = $storemerge1;
        _compress_block($s, _static_ltree | 0, _static_dtree | 0);
        break;
      } else {
        var $75 = $last + 4 & 65535;
        var $77$s1 = ($s + 5816 | 0) >> 1;
        var $80 = HEAP16[$77$s1] & 65535 | $75 << $39;
        HEAP16[$77$s1] = $80 & 65535;
        if ($40) {
          var $84$s2 = ($s + 20 | 0) >> 2;
          var $85 = HEAP32[$84$s2];
          HEAP32[$84$s2] = $85 + 1 | 0;
          var $87 = $s + 8 | 0;
          HEAP8[HEAP32[$87 >> 2] + $85 | 0] = $80 & 255;
          var $92 = (HEAP16[$77$s1] & 65535) >>> 8 & 255;
          var $93 = HEAP32[$84$s2];
          HEAP32[$84$s2] = $93 + 1 | 0;
          HEAP8[HEAP32[$87 >> 2] + $93 | 0] = $92;
          var $97 = HEAP32[$38$s2];
          HEAP16[$77$s1] = $75 >>> ((16 - $97 | 0) >>> 0) & 65535;
          var $storemerge = $97 - 13 | 0;
        } else {
          var $storemerge = $39 + 3 | 0;
        }
        var $storemerge;
        HEAP32[$38$s2] = $storemerge;
        _send_all_trees($s, HEAP32[$s$s2 + 711] + 1 | 0, HEAP32[$s$s2 + 714] + 1 | 0, $max_blindex_0 + 1 | 0);
        _compress_block($s, $s + 148 | 0, $s + 2440 | 0);
        break;
      }
    } else {
      __tr_stored_block($s, $buf, $stored_len, $last);
    }
  } while (0);
  _init_block($s);
  if (($last | 0) == 0) {
    return;
  }
  _bi_windup($s);
  return;
}
__tr_flush_block["X"] = 1;
function _build_tree($s, $desc) {
  var $62$s2;
  var $14$s2;
  var $10$s2;
  var $9$s2;
  var $2$s1;
  var $s$s2 = $s >> 2;
  var label;
  var $1 = $desc | 0;
  var $2 = HEAP32[$1 >> 2], $2$s1 = $2 >> 1;
  var $3 = $desc + 8 | 0;
  var $4 = HEAP32[$3 >> 2];
  var $6 = HEAP32[$4 >> 2];
  var $8 = HEAP32[$4 + 12 >> 2];
  var $9$s2 = ($s + 5200 | 0) >> 2;
  HEAP32[$9$s2] = 0;
  var $10$s2 = ($s + 5204 | 0) >> 2;
  HEAP32[$10$s2] = 573;
  do {
    if (($8 | 0) > 0) {
      var $n_07 = 0;
      var $max_code_08 = -1;
      while (1) {
        var $max_code_08;
        var $n_07;
        if (HEAP16[($n_07 << 2 >> 1) + $2$s1] << 16 >> 16 == 0) {
          HEAP16[(($n_07 << 2) + 2 >> 1) + $2$s1] = 0;
          var $max_code_1 = $max_code_08;
        } else {
          var $34 = HEAP32[$9$s2] + 1 | 0;
          HEAP32[$9$s2] = $34;
          HEAP32[(($34 << 2) + 2908 >> 2) + $s$s2] = $n_07;
          HEAP8[$s + ($n_07 + 5208) | 0] = 0;
          var $max_code_1 = $n_07;
        }
        var $max_code_1;
        var $40 = $n_07 + 1 | 0;
        if (($40 | 0) == ($8 | 0)) {
          break;
        } else {
          var $n_07 = $40;
          var $max_code_08 = $max_code_1;
        }
      }
      var $_pre = HEAP32[$9$s2];
      if (($_pre | 0) < 2) {
        var $13 = $_pre;
        var $max_code_0_lcssa14 = $max_code_1;
        label = 1194;
        break;
      } else {
        var $max_code_2_lcssa = $max_code_1;
        break;
      }
    } else {
      var $13 = 0;
      var $max_code_0_lcssa14 = -1;
      label = 1194;
    }
  } while (0);
  L1582 : do {
    if (label == 1194) {
      var $max_code_0_lcssa14;
      var $13;
      var $14$s2 = ($s + 5800 | 0) >> 2;
      var $16 = $s + 5804 | 0;
      if (($6 | 0) == 0) {
        var $max_code_25_us = $max_code_0_lcssa14;
        var $17 = $13;
        while (1) {
          var $17;
          var $max_code_25_us;
          var $18 = ($max_code_25_us | 0) < 2;
          var $19 = $max_code_25_us + 1 | 0;
          var $max_code_3_us = $18 ? $19 : $max_code_25_us;
          var $20 = $18 ? $19 : 0;
          var $21 = $17 + 1 | 0;
          HEAP32[$9$s2] = $21;
          HEAP32[(($21 << 2) + 2908 >> 2) + $s$s2] = $20;
          HEAP16[($20 << 2 >> 1) + $2$s1] = 1;
          HEAP8[$s + ($20 + 5208) | 0] = 0;
          HEAP32[$14$s2] = HEAP32[$14$s2] - 1 | 0;
          var $27 = HEAP32[$9$s2];
          if (($27 | 0) < 2) {
            var $max_code_25_us = $max_code_3_us;
            var $17 = $27;
          } else {
            var $max_code_2_lcssa = $max_code_3_us;
            break L1582;
          }
        }
      } else {
        var $max_code_25 = $max_code_0_lcssa14;
        var $41 = $13;
        while (1) {
          var $41;
          var $max_code_25;
          var $42 = ($max_code_25 | 0) < 2;
          var $43 = $max_code_25 + 1 | 0;
          var $max_code_3 = $42 ? $43 : $max_code_25;
          var $44 = $42 ? $43 : 0;
          var $45 = $41 + 1 | 0;
          HEAP32[$9$s2] = $45;
          HEAP32[(($45 << 2) + 2908 >> 2) + $s$s2] = $44;
          HEAP16[($44 << 2 >> 1) + $2$s1] = 1;
          HEAP8[$s + ($44 + 5208) | 0] = 0;
          HEAP32[$14$s2] = HEAP32[$14$s2] - 1 | 0;
          HEAP32[$16 >> 2] = HEAP32[$16 >> 2] - (HEAP16[$6 + ($44 << 2) + 2 >> 1] & 65535) | 0;
          var $56 = HEAP32[$9$s2];
          if (($56 | 0) < 2) {
            var $max_code_25 = $max_code_3;
            var $41 = $56;
          } else {
            var $max_code_2_lcssa = $max_code_3;
            break L1582;
          }
        }
      }
    }
  } while (0);
  var $max_code_2_lcssa;
  var $58 = $desc + 4 | 0;
  HEAP32[$58 >> 2] = $max_code_2_lcssa;
  var $59 = HEAP32[$9$s2];
  if (($59 | 0) > 1) {
    var $n_13 = ($59 | 0) / 2 & -1;
    while (1) {
      var $n_13;
      _pqdownheap($s, $2, $n_13);
      var $64 = $n_13 - 1 | 0;
      if (($64 | 0) > 0) {
        var $n_13 = $64;
      } else {
        break;
      }
    }
    var $_pre12 = HEAP32[$9$s2];
  } else {
    var $_pre12 = $59;
  }
  var $_pre12;
  var $62$s2 = ($s + 2912 | 0) >> 2;
  var $node_0 = $8;
  var $67 = $_pre12;
  while (1) {
    var $67;
    var $node_0;
    var $68 = HEAP32[$62$s2];
    HEAP32[$9$s2] = $67 - 1 | 0;
    HEAP32[$62$s2] = HEAP32[(($67 << 2) + 2908 >> 2) + $s$s2];
    _pqdownheap($s, $2, 1);
    var $72 = HEAP32[$62$s2];
    var $74 = HEAP32[$10$s2] - 1 | 0;
    HEAP32[$10$s2] = $74;
    HEAP32[(($74 << 2) + 2908 >> 2) + $s$s2] = $68;
    var $77 = HEAP32[$10$s2] - 1 | 0;
    HEAP32[$10$s2] = $77;
    HEAP32[(($77 << 2) + 2908 >> 2) + $s$s2] = $72;
    HEAP16[($node_0 << 2 >> 1) + $2$s1] = HEAP16[($72 << 2 >> 1) + $2$s1] + HEAP16[($68 << 2 >> 1) + $2$s1] & 65535;
    var $86 = HEAP8[$s + ($68 + 5208) | 0];
    var $88 = HEAP8[$s + ($72 + 5208) | 0];
    HEAP8[$s + ($node_0 + 5208) | 0] = (($86 & 255) < ($88 & 255) ? $88 : $86) + 1 & 255;
    var $92 = $node_0 & 65535;
    HEAP16[(($72 << 2) + 2 >> 1) + $2$s1] = $92;
    HEAP16[(($68 << 2) + 2 >> 1) + $2$s1] = $92;
    HEAP32[$62$s2] = $node_0;
    _pqdownheap($s, $2, 1);
    var $96 = HEAP32[$9$s2];
    if (($96 | 0) > 1) {
      var $node_0 = $node_0 + 1 | 0;
      var $67 = $96;
    } else {
      break;
    }
  }
  var $99 = HEAP32[$62$s2];
  var $101 = HEAP32[$10$s2] - 1 | 0;
  HEAP32[$10$s2] = $101;
  HEAP32[(($101 << 2) + 2908 >> 2) + $s$s2] = $99;
  _gen_bitlen($s, HEAP32[$1 >> 2], HEAP32[$58 >> 2], HEAP32[$3 >> 2]);
  _gen_codes($2, $max_code_2_lcssa, $s + 2876 | 0);
  return;
}
_build_tree["X"] = 1;
function _build_bl_tree($s) {
  _scan_tree($s, $s + 148 | 0, HEAP32[$s + 2844 >> 2]);
  _scan_tree($s, $s + 2440 | 0, HEAP32[$s + 2856 >> 2]);
  _build_tree($s, $s + 2864 | 0);
  var $max_blindex_0 = 18;
  while (1) {
    var $max_blindex_0;
    if (($max_blindex_0 | 0) <= 2) {
      break;
    }
    if (HEAP16[$s + ((HEAP8[STRING_TABLE._bl_order + $max_blindex_0 | 0] & 255) << 2) + 2686 >> 1] << 16 >> 16 != 0) {
      break;
    }
    var $max_blindex_0 = $max_blindex_0 - 1 | 0;
  }
  var $21 = $s + 5800 | 0;
  HEAP32[$21 >> 2] = $max_blindex_0 * 3 + HEAP32[$21 >> 2] + 17 | 0;
  return $max_blindex_0;
}
function _bi_windup($s) {
  var $_pre_phi$s1;
  var $8$s2;
  var $1$s2;
  var $1$s2 = ($s + 5820 | 0) >> 2;
  var $2 = HEAP32[$1$s2];
  if (($2 | 0) > 8) {
    var $5 = $s + 5816 | 0;
    var $7 = HEAP16[$5 >> 1] & 255;
    var $8$s2 = ($s + 20 | 0) >> 2;
    var $9 = HEAP32[$8$s2];
    HEAP32[$8$s2] = $9 + 1 | 0;
    var $11 = $s + 8 | 0;
    HEAP8[HEAP32[$11 >> 2] + $9 | 0] = $7;
    var $16 = (HEAP16[$5 >> 1] & 65535) >>> 8 & 255;
    var $17 = HEAP32[$8$s2];
    HEAP32[$8$s2] = $17 + 1 | 0;
    HEAP8[HEAP32[$11 >> 2] + $17 | 0] = $16;
    var $_pre_phi = $5, $_pre_phi$s1 = $_pre_phi >> 1;
    var $_pre_phi;
    HEAP16[$_pre_phi$s1] = 0;
    HEAP32[$1$s2] = 0;
    return;
  }
  var $23 = $s + 5816 | 0;
  if (($2 | 0) <= 0) {
    var $_pre_phi = $23, $_pre_phi$s1 = $_pre_phi >> 1;
    var $_pre_phi;
    HEAP16[$_pre_phi$s1] = 0;
    HEAP32[$1$s2] = 0;
    return;
  }
  var $26 = HEAP16[$23 >> 1] & 255;
  var $27 = $s + 20 | 0;
  var $28 = HEAP32[$27 >> 2];
  HEAP32[$27 >> 2] = $28 + 1 | 0;
  HEAP8[HEAP32[$s + 8 >> 2] + $28 | 0] = $26;
  var $_pre_phi = $23, $_pre_phi$s1 = $_pre_phi >> 1;
  var $_pre_phi;
  HEAP16[$_pre_phi$s1] = 0;
  HEAP32[$1$s2] = 0;
  return;
}
function _send_tree($s, $tree, $max_code) {
  var $10$s2;
  var $9$s2;
  var $8$s1;
  var $6$s2;
  var $2 = HEAP16[$tree + 2 >> 1];
  var $4 = $2 << 16 >> 16 == 0;
  var $5 = $s + 2754 | 0;
  var $6$s2 = ($s + 5820 | 0) >> 2;
  var $7 = $s + 2752 | 0;
  var $8$s1 = ($s + 5816 | 0) >> 1;
  var $9$s2 = ($s + 20 | 0) >> 2;
  var $10$s2 = ($s + 8 | 0) >> 2;
  var $11 = $s + 2758 | 0;
  var $12 = $s + 2756 | 0;
  var $13 = $s + 2750 | 0;
  var $14 = $s + 2748 | 0;
  var $min_count_1_ph = $4 ? 3 : 4;
  var $max_count_1_ph = $4 ? 138 : 7;
  var $n_0_ph = 0;
  var $prevlen_0_ph = -1;
  var $nextlen_0_ph = $2 & 65535;
  L1615 : while (1) {
    var $nextlen_0_ph;
    var $prevlen_0_ph;
    var $n_0_ph;
    var $max_count_1_ph;
    var $min_count_1_ph;
    var $count_0 = 0;
    var $n_0 = $n_0_ph;
    var $nextlen_0 = $nextlen_0_ph;
    while (1) {
      var $nextlen_0;
      var $n_0;
      var $count_0;
      if (($n_0 | 0) > ($max_code | 0)) {
        break L1615;
      }
      var $18 = $n_0 + 1 | 0;
      var $20 = HEAP16[$tree + ($18 << 2) + 2 >> 1];
      var $21 = $20 & 65535;
      var $22 = $count_0 + 1 | 0;
      var $24 = ($nextlen_0 | 0) == ($21 | 0);
      if (($22 | 0) < ($max_count_1_ph | 0) & $24) {
        var $count_0 = $22;
        var $n_0 = $18;
        var $nextlen_0 = $21;
      } else {
        break;
      }
    }
    var $26 = ($22 | 0) < ($min_count_1_ph | 0);
    L1621 : do {
      if ($26) {
        var $27 = ($nextlen_0 << 2) + $s + 2686 | 0;
        var $28 = ($nextlen_0 << 2) + $s + 2684 | 0;
        var $count_1 = $22;
        var $31 = HEAP32[$6$s2];
        var $30 = HEAP16[$8$s1];
        while (1) {
          var $30;
          var $31;
          var $count_1;
          var $33 = HEAP16[$27 >> 1] & 65535;
          var $37 = HEAP16[$28 >> 1] & 65535;
          var $40 = $30 & 65535 | $37 << $31;
          var $41 = $40 & 65535;
          HEAP16[$8$s1] = $41;
          if (($31 | 0) > (16 - $33 | 0)) {
            var $44 = HEAP32[$9$s2];
            HEAP32[$9$s2] = $44 + 1 | 0;
            HEAP8[HEAP32[$10$s2] + $44 | 0] = $40 & 255;
            var $50 = (HEAP16[$8$s1] & 65535) >>> 8 & 255;
            var $51 = HEAP32[$9$s2];
            HEAP32[$9$s2] = $51 + 1 | 0;
            HEAP8[HEAP32[$10$s2] + $51 | 0] = $50;
            var $55 = HEAP32[$6$s2];
            var $58 = $37 >>> ((16 - $55 | 0) >>> 0) & 65535;
            HEAP16[$8$s1] = $58;
            var $storemerge4 = $33 - 16 + $55 | 0;
            var $64 = $58;
          } else {
            var $storemerge4 = $31 + $33 | 0;
            var $64 = $41;
          }
          var $64;
          var $storemerge4;
          HEAP32[$6$s2] = $storemerge4;
          var $65 = $count_1 - 1 | 0;
          if (($65 | 0) == 0) {
            break L1621;
          } else {
            var $count_1 = $65;
            var $31 = $storemerge4;
            var $30 = $64;
          }
        }
      } else {
        if (($nextlen_0 | 0) != 0) {
          if (($nextlen_0 | 0) == ($prevlen_0_ph | 0)) {
            var $count_2 = $22;
            var $111 = HEAP32[$6$s2];
            var $110 = HEAP16[$8$s1];
          } else {
            var $74 = HEAP16[$s + ($nextlen_0 << 2) + 2686 >> 1] & 65535;
            var $75 = HEAP32[$6$s2];
            var $80 = HEAP16[$s + ($nextlen_0 << 2) + 2684 >> 1] & 65535;
            var $84 = HEAP16[$8$s1] & 65535 | $80 << $75;
            var $85 = $84 & 65535;
            HEAP16[$8$s1] = $85;
            if (($75 | 0) > (16 - $74 | 0)) {
              var $88 = HEAP32[$9$s2];
              HEAP32[$9$s2] = $88 + 1 | 0;
              HEAP8[HEAP32[$10$s2] + $88 | 0] = $84 & 255;
              var $94 = (HEAP16[$8$s1] & 65535) >>> 8 & 255;
              var $95 = HEAP32[$9$s2];
              HEAP32[$9$s2] = $95 + 1 | 0;
              HEAP8[HEAP32[$10$s2] + $95 | 0] = $94;
              var $99 = HEAP32[$6$s2];
              var $102 = $80 >>> ((16 - $99 | 0) >>> 0) & 65535;
              HEAP16[$8$s1] = $102;
              var $storemerge3 = $74 - 16 + $99 | 0;
              var $108 = $102;
            } else {
              var $storemerge3 = $75 + $74 | 0;
              var $108 = $85;
            }
            var $108;
            var $storemerge3;
            HEAP32[$6$s2] = $storemerge3;
            var $count_2 = $count_0;
            var $111 = $storemerge3;
            var $110 = $108;
          }
          var $110;
          var $111;
          var $count_2;
          var $113 = HEAP16[$13 >> 1] & 65535;
          var $117 = HEAP16[$14 >> 1] & 65535;
          var $120 = $110 & 65535 | $117 << $111;
          var $121 = $120 & 65535;
          HEAP16[$8$s1] = $121;
          if (($111 | 0) > (16 - $113 | 0)) {
            var $124 = HEAP32[$9$s2];
            HEAP32[$9$s2] = $124 + 1 | 0;
            HEAP8[HEAP32[$10$s2] + $124 | 0] = $120 & 255;
            var $130 = (HEAP16[$8$s1] & 65535) >>> 8 & 255;
            var $131 = HEAP32[$9$s2];
            HEAP32[$9$s2] = $131 + 1 | 0;
            HEAP8[HEAP32[$10$s2] + $131 | 0] = $130;
            var $135 = HEAP32[$6$s2];
            var $138 = $117 >>> ((16 - $135 | 0) >>> 0) & 65535;
            HEAP16[$8$s1] = $138;
            var $145 = $113 - 16 + $135 | 0;
            var $144 = $138;
          } else {
            var $145 = $111 + $113 | 0;
            var $144 = $121;
          }
          var $144;
          var $145;
          HEAP32[$6$s2] = $145;
          var $148 = $count_2 + 65533 & 65535;
          var $151 = $144 & 65535 | $148 << $145;
          HEAP16[$8$s1] = $151 & 65535;
          if (($145 | 0) > 14) {
            var $155 = HEAP32[$9$s2];
            HEAP32[$9$s2] = $155 + 1 | 0;
            HEAP8[HEAP32[$10$s2] + $155 | 0] = $151 & 255;
            var $161 = (HEAP16[$8$s1] & 65535) >>> 8 & 255;
            var $162 = HEAP32[$9$s2];
            HEAP32[$9$s2] = $162 + 1 | 0;
            HEAP8[HEAP32[$10$s2] + $162 | 0] = $161;
            var $166 = HEAP32[$6$s2];
            HEAP16[$8$s1] = $148 >>> ((16 - $166 | 0) >>> 0) & 65535;
            HEAP32[$6$s2] = $166 - 14 | 0;
            break;
          } else {
            HEAP32[$6$s2] = $145 + 2 | 0;
            break;
          }
        }
        if (($22 | 0) < 11) {
          var $177 = HEAP16[$5 >> 1] & 65535;
          var $178 = HEAP32[$6$s2];
          var $182 = HEAP16[$7 >> 1] & 65535;
          var $186 = HEAP16[$8$s1] & 65535 | $182 << $178;
          var $187 = $186 & 65535;
          HEAP16[$8$s1] = $187;
          if (($178 | 0) > (16 - $177 | 0)) {
            var $190 = HEAP32[$9$s2];
            HEAP32[$9$s2] = $190 + 1 | 0;
            HEAP8[HEAP32[$10$s2] + $190 | 0] = $186 & 255;
            var $196 = (HEAP16[$8$s1] & 65535) >>> 8 & 255;
            var $197 = HEAP32[$9$s2];
            HEAP32[$9$s2] = $197 + 1 | 0;
            HEAP8[HEAP32[$10$s2] + $197 | 0] = $196;
            var $201 = HEAP32[$6$s2];
            var $204 = $182 >>> ((16 - $201 | 0) >>> 0) & 65535;
            HEAP16[$8$s1] = $204;
            var $211 = $177 - 16 + $201 | 0;
            var $210 = $204;
          } else {
            var $211 = $178 + $177 | 0;
            var $210 = $187;
          }
          var $210;
          var $211;
          HEAP32[$6$s2] = $211;
          var $214 = $count_0 + 65534 & 65535;
          var $217 = $210 & 65535 | $214 << $211;
          HEAP16[$8$s1] = $217 & 65535;
          if (($211 | 0) > 13) {
            var $221 = HEAP32[$9$s2];
            HEAP32[$9$s2] = $221 + 1 | 0;
            HEAP8[HEAP32[$10$s2] + $221 | 0] = $217 & 255;
            var $227 = (HEAP16[$8$s1] & 65535) >>> 8 & 255;
            var $228 = HEAP32[$9$s2];
            HEAP32[$9$s2] = $228 + 1 | 0;
            HEAP8[HEAP32[$10$s2] + $228 | 0] = $227;
            var $232 = HEAP32[$6$s2];
            HEAP16[$8$s1] = $214 >>> ((16 - $232 | 0) >>> 0) & 65535;
            HEAP32[$6$s2] = $232 - 13 | 0;
            break;
          } else {
            HEAP32[$6$s2] = $211 + 3 | 0;
            break;
          }
        } else {
          var $241 = HEAP16[$11 >> 1] & 65535;
          var $242 = HEAP32[$6$s2];
          var $246 = HEAP16[$12 >> 1] & 65535;
          var $250 = HEAP16[$8$s1] & 65535 | $246 << $242;
          var $251 = $250 & 65535;
          HEAP16[$8$s1] = $251;
          if (($242 | 0) > (16 - $241 | 0)) {
            var $254 = HEAP32[$9$s2];
            HEAP32[$9$s2] = $254 + 1 | 0;
            HEAP8[HEAP32[$10$s2] + $254 | 0] = $250 & 255;
            var $260 = (HEAP16[$8$s1] & 65535) >>> 8 & 255;
            var $261 = HEAP32[$9$s2];
            HEAP32[$9$s2] = $261 + 1 | 0;
            HEAP8[HEAP32[$10$s2] + $261 | 0] = $260;
            var $265 = HEAP32[$6$s2];
            var $268 = $246 >>> ((16 - $265 | 0) >>> 0) & 65535;
            HEAP16[$8$s1] = $268;
            var $275 = $241 - 16 + $265 | 0;
            var $274 = $268;
          } else {
            var $275 = $242 + $241 | 0;
            var $274 = $251;
          }
          var $274;
          var $275;
          HEAP32[$6$s2] = $275;
          var $278 = $count_0 + 65526 & 65535;
          var $281 = $274 & 65535 | $278 << $275;
          HEAP16[$8$s1] = $281 & 65535;
          if (($275 | 0) > 9) {
            var $285 = HEAP32[$9$s2];
            HEAP32[$9$s2] = $285 + 1 | 0;
            HEAP8[HEAP32[$10$s2] + $285 | 0] = $281 & 255;
            var $291 = (HEAP16[$8$s1] & 65535) >>> 8 & 255;
            var $292 = HEAP32[$9$s2];
            HEAP32[$9$s2] = $292 + 1 | 0;
            HEAP8[HEAP32[$10$s2] + $292 | 0] = $291;
            var $296 = HEAP32[$6$s2];
            HEAP16[$8$s1] = $278 >>> ((16 - $296 | 0) >>> 0) & 65535;
            HEAP32[$6$s2] = $296 - 9 | 0;
            break;
          } else {
            HEAP32[$6$s2] = $275 + 7 | 0;
            break;
          }
        }
      }
    } while (0);
    if ($20 << 16 >> 16 == 0) {
      var $min_count_1_ph = 3;
      var $max_count_1_ph = 138;
      var $n_0_ph = $18;
      var $prevlen_0_ph = $nextlen_0;
      var $nextlen_0_ph = $21;
      continue;
    }
    var $min_count_1_ph = $24 ? 3 : 4;
    var $max_count_1_ph = $24 ? 6 : 7;
    var $n_0_ph = $18;
    var $prevlen_0_ph = $nextlen_0;
    var $nextlen_0_ph = $21;
  }
  return;
}
_send_tree["X"] = 1;
function _scan_tree($s, $tree, $max_code) {
  var $2 = HEAP16[$tree + 2 >> 1];
  var $4 = $2 << 16 >> 16 == 0;
  HEAP16[$tree + ($max_code + 1 << 2) + 2 >> 1] = -1;
  var $7 = $s + 2752 | 0;
  var $8 = $s + 2756 | 0;
  var $9 = $s + 2748 | 0;
  var $min_count_1_ph = $4 ? 3 : 4;
  var $max_count_1_ph = $4 ? 138 : 7;
  var $n_0_ph = 0;
  var $prevlen_0_ph = -1;
  var $nextlen_0_ph = $2 & 65535;
  L1669 : while (1) {
    var $nextlen_0_ph;
    var $prevlen_0_ph;
    var $n_0_ph;
    var $max_count_1_ph;
    var $min_count_1_ph;
    var $count_0 = 0;
    var $n_0 = $n_0_ph;
    var $nextlen_0 = $nextlen_0_ph;
    while (1) {
      var $nextlen_0;
      var $n_0;
      var $count_0;
      if (($n_0 | 0) > ($max_code | 0)) {
        break L1669;
      }
      var $13 = $n_0 + 1 | 0;
      var $15 = HEAP16[$tree + ($13 << 2) + 2 >> 1];
      var $16 = $15 & 65535;
      var $17 = $count_0 + 1 | 0;
      var $19 = ($nextlen_0 | 0) == ($16 | 0);
      if (($17 | 0) < ($max_count_1_ph | 0) & $19) {
        var $count_0 = $17;
        var $n_0 = $13;
        var $nextlen_0 = $16;
      } else {
        break;
      }
    }
    do {
      if (($17 | 0) < ($min_count_1_ph | 0)) {
        var $23 = ($nextlen_0 << 2) + $s + 2684 | 0;
        HEAP16[$23 >> 1] = (HEAP16[$23 >> 1] & 65535) + $17 & 65535;
      } else {
        if (($nextlen_0 | 0) == 0) {
          if (($17 | 0) < 11) {
            HEAP16[$7 >> 1] = HEAP16[$7 >> 1] + 1 & 65535;
            break;
          } else {
            HEAP16[$8 >> 1] = HEAP16[$8 >> 1] + 1 & 65535;
            break;
          }
        } else {
          if (($nextlen_0 | 0) != ($prevlen_0_ph | 0)) {
            var $33 = ($nextlen_0 << 2) + $s + 2684 | 0;
            HEAP16[$33 >> 1] = HEAP16[$33 >> 1] + 1 & 65535;
          }
          HEAP16[$9 >> 1] = HEAP16[$9 >> 1] + 1 & 65535;
          break;
        }
      }
    } while (0);
    if ($15 << 16 >> 16 == 0) {
      var $min_count_1_ph = 3;
      var $max_count_1_ph = 138;
      var $n_0_ph = $13;
      var $prevlen_0_ph = $nextlen_0;
      var $nextlen_0_ph = $16;
      continue;
    }
    var $min_count_1_ph = $19 ? 3 : 4;
    var $max_count_1_ph = $19 ? 6 : 7;
    var $n_0_ph = $13;
    var $prevlen_0_ph = $nextlen_0;
    var $nextlen_0_ph = $16;
  }
  return;
}
_scan_tree["X"] = 1;
function _pqdownheap($s, $tree, $k) {
  var $47$s2;
  var $s$s2 = $s >> 2;
  var label;
  var $2 = HEAP32[(($k << 2) + 2908 >> 2) + $s$s2];
  var $3 = $s + ($2 + 5208) | 0;
  var $4 = $s + 5200 | 0;
  var $5 = ($2 << 2) + $tree | 0;
  var $_0 = $k;
  while (1) {
    var $_0;
    var $j_0 = $_0 << 1;
    var $7 = HEAP32[$4 >> 2];
    if (($j_0 | 0) > ($7 | 0)) {
      label = 1289;
      break;
    }
    do {
      if (($j_0 | 0) < ($7 | 0)) {
        var $12 = $j_0 | 1;
        var $14 = HEAP32[(($12 << 2) + 2908 >> 2) + $s$s2];
        var $16 = HEAP16[$tree + ($14 << 2) >> 1];
        var $18 = HEAP32[(($j_0 << 2) + 2908 >> 2) + $s$s2];
        var $20 = HEAP16[$tree + ($18 << 2) >> 1];
        if (($16 & 65535) >= ($20 & 65535)) {
          if ($16 << 16 >> 16 != $20 << 16 >> 16) {
            var $j_1 = $j_0;
            break;
          }
          if ((HEAP8[$s + ($14 + 5208) | 0] & 255) > (HEAP8[$s + ($18 + 5208) | 0] & 255)) {
            var $j_1 = $j_0;
            break;
          }
        }
        var $j_1 = $12;
      } else {
        var $j_1 = $j_0;
      }
    } while (0);
    var $j_1;
    var $31 = HEAP16[$5 >> 1];
    var $33 = HEAP32[(($j_1 << 2) + 2908 >> 2) + $s$s2];
    var $35 = HEAP16[$tree + ($33 << 2) >> 1];
    if (($31 & 65535) < ($35 & 65535)) {
      label = 1290;
      break;
    }
    if ($31 << 16 >> 16 == $35 << 16 >> 16) {
      if ((HEAP8[$3] & 255) <= (HEAP8[$s + ($33 + 5208) | 0] & 255)) {
        label = 1288;
        break;
      }
    }
    HEAP32[(($_0 << 2) + 2908 >> 2) + $s$s2] = $33;
    var $_0 = $j_1;
  }
  if (label == 1290) {
    var $47 = ($_0 << 2) + $s + 2908 | 0, $47$s2 = $47 >> 2;
    HEAP32[$47$s2] = $2;
    return;
  } else if (label == 1289) {
    var $47 = ($_0 << 2) + $s + 2908 | 0, $47$s2 = $47 >> 2;
    HEAP32[$47$s2] = $2;
    return;
  } else if (label == 1288) {
    var $47 = ($_0 << 2) + $s + 2908 | 0, $47$s2 = $47 >> 2;
    HEAP32[$47$s2] = $2;
    return;
  }
}
_pqdownheap["X"] = 1;
function _send_all_trees($s, $lcodes, $dcodes, $blcodes) {
  var $101$s2;
  var $78$s2;
  var $46$s2;
  var $14$s2;
  var $7$s1;
  var $1$s2;
  var $1$s2 = ($s + 5820 | 0) >> 2;
  var $2 = HEAP32[$1$s2];
  var $5 = $lcodes + 65279 & 65535;
  var $7$s1 = ($s + 5816 | 0) >> 1;
  var $10 = HEAP16[$7$s1] & 65535 | $5 << $2;
  var $11 = $10 & 65535;
  HEAP16[$7$s1] = $11;
  if (($2 | 0) > 11) {
    var $14$s2 = ($s + 20 | 0) >> 2;
    var $15 = HEAP32[$14$s2];
    HEAP32[$14$s2] = $15 + 1 | 0;
    var $17 = $s + 8 | 0;
    HEAP8[HEAP32[$17 >> 2] + $15 | 0] = $10 & 255;
    var $22 = (HEAP16[$7$s1] & 65535) >>> 8 & 255;
    var $23 = HEAP32[$14$s2];
    HEAP32[$14$s2] = $23 + 1 | 0;
    HEAP8[HEAP32[$17 >> 2] + $23 | 0] = $22;
    var $27 = HEAP32[$1$s2];
    var $30 = $5 >>> ((16 - $27 | 0) >>> 0) & 65535;
    HEAP16[$7$s1] = $30;
    var $36 = $27 - 11 | 0;
    var $35 = $30;
  } else {
    var $36 = $2 + 5 | 0;
    var $35 = $11;
  }
  var $35;
  var $36;
  HEAP32[$1$s2] = $36;
  var $38 = $dcodes - 1 | 0;
  var $39 = $38 & 65535;
  var $42 = $35 & 65535 | $39 << $36;
  var $43 = $42 & 65535;
  HEAP16[$7$s1] = $43;
  if (($36 | 0) > 11) {
    var $46$s2 = ($s + 20 | 0) >> 2;
    var $47 = HEAP32[$46$s2];
    HEAP32[$46$s2] = $47 + 1 | 0;
    var $49 = $s + 8 | 0;
    HEAP8[HEAP32[$49 >> 2] + $47 | 0] = $42 & 255;
    var $54 = (HEAP16[$7$s1] & 65535) >>> 8 & 255;
    var $55 = HEAP32[$46$s2];
    HEAP32[$46$s2] = $55 + 1 | 0;
    HEAP8[HEAP32[$49 >> 2] + $55 | 0] = $54;
    var $59 = HEAP32[$1$s2];
    var $62 = $39 >>> ((16 - $59 | 0) >>> 0) & 65535;
    HEAP16[$7$s1] = $62;
    var $68 = $59 - 11 | 0;
    var $67 = $62;
  } else {
    var $68 = $36 + 5 | 0;
    var $67 = $43;
  }
  var $67;
  var $68;
  HEAP32[$1$s2] = $68;
  var $71 = $blcodes + 65532 & 65535;
  var $74 = $67 & 65535 | $71 << $68;
  var $75 = $74 & 65535;
  HEAP16[$7$s1] = $75;
  if (($68 | 0) > 12) {
    var $78$s2 = ($s + 20 | 0) >> 2;
    var $79 = HEAP32[$78$s2];
    HEAP32[$78$s2] = $79 + 1 | 0;
    var $81 = $s + 8 | 0;
    HEAP8[HEAP32[$81 >> 2] + $79 | 0] = $74 & 255;
    var $86 = (HEAP16[$7$s1] & 65535) >>> 8 & 255;
    var $87 = HEAP32[$78$s2];
    HEAP32[$78$s2] = $87 + 1 | 0;
    HEAP8[HEAP32[$81 >> 2] + $87 | 0] = $86;
    var $91 = HEAP32[$1$s2];
    var $94 = $71 >>> ((16 - $91 | 0) >>> 0) & 65535;
    HEAP16[$7$s1] = $94;
    var $storemerge2 = $91 - 12 | 0;
    var $99 = $94;
  } else {
    var $storemerge2 = $68 + 4 | 0;
    var $99 = $75;
  }
  var $99;
  var $storemerge2;
  HEAP32[$1$s2] = $storemerge2;
  if (($blcodes | 0) <= 0) {
    var $140 = $s + 148 | 0;
    var $141 = $lcodes - 1 | 0;
    _send_tree($s, $140, $141);
    var $142 = $s + 2440 | 0;
    _send_tree($s, $142, $38);
    return;
  }
  var $101$s2 = ($s + 20 | 0) >> 2;
  var $102 = $s + 8 | 0;
  var $rank_04 = 0;
  var $105 = $storemerge2;
  var $104 = $99;
  while (1) {
    var $104;
    var $105;
    var $rank_04;
    var $112 = HEAP16[$s + ((HEAP8[STRING_TABLE._bl_order + $rank_04 | 0] & 255) << 2) + 2686 >> 1] & 65535;
    var $115 = $104 & 65535 | $112 << $105;
    var $116 = $115 & 65535;
    HEAP16[$7$s1] = $116;
    if (($105 | 0) > 13) {
      var $119 = HEAP32[$101$s2];
      HEAP32[$101$s2] = $119 + 1 | 0;
      HEAP8[HEAP32[$102 >> 2] + $119 | 0] = $115 & 255;
      var $125 = (HEAP16[$7$s1] & 65535) >>> 8 & 255;
      var $126 = HEAP32[$101$s2];
      HEAP32[$101$s2] = $126 + 1 | 0;
      HEAP8[HEAP32[$102 >> 2] + $126 | 0] = $125;
      var $130 = HEAP32[$1$s2];
      var $133 = $112 >>> ((16 - $130 | 0) >>> 0) & 65535;
      HEAP16[$7$s1] = $133;
      var $storemerge3 = $130 - 13 | 0;
      var $138 = $133;
    } else {
      var $storemerge3 = $105 + 3 | 0;
      var $138 = $116;
    }
    var $138;
    var $storemerge3;
    HEAP32[$1$s2] = $storemerge3;
    var $139 = $rank_04 + 1 | 0;
    if (($139 | 0) == ($blcodes | 0)) {
      break;
    } else {
      var $rank_04 = $139;
      var $105 = $storemerge3;
      var $104 = $138;
    }
  }
  var $140 = $s + 148 | 0;
  var $141 = $lcodes - 1 | 0;
  _send_tree($s, $140, $141);
  var $142 = $s + 2440 | 0;
  _send_tree($s, $142, $38);
  return;
}
_send_all_trees["X"] = 1;
function _bi_reverse($code, $len) {
  var $_0 = $code;
  var $_01 = $len;
  var $res_0 = 0;
  while (1) {
    var $res_0;
    var $_01;
    var $_0;
    var $3 = $_0 & 1 | $res_0;
    var $6 = $_01 - 1 | 0;
    if (($6 | 0) > 0) {
      var $_0 = $_0 >>> 1;
      var $_01 = $6;
      var $res_0 = $3 << 1;
    } else {
      break;
    }
  }
  return $3 & 2147483647;
}
function _gen_bitlen($s, $desc_0_0_val, $desc_0_1_val, $desc_0_2_val) {
  var $16$s2;
  var $desc_0_0_val$s1 = $desc_0_0_val >> 1;
  var $2 = HEAP32[$desc_0_2_val >> 2];
  var $4 = HEAP32[$desc_0_2_val + 4 >> 2];
  var $6 = HEAP32[$desc_0_2_val + 8 >> 2];
  var $8 = HEAP32[$desc_0_2_val + 16 >> 2];
  _memset($s + 2876 | 0, 0, 32, 2);
  var $9 = $s + 5204 | 0;
  HEAP16[((HEAP32[$s + (HEAP32[$9 >> 2] << 2) + 2908 >> 2] << 2) + 2 >> 1) + $desc_0_0_val$s1] = 0;
  var $h_09 = HEAP32[$9 >> 2] + 1 | 0;
  if (($h_09 | 0) >= 573) {
    return;
  }
  var $16$s2 = ($s + 5800 | 0) >> 2;
  var $17 = ($2 | 0) == 0;
  var $18 = $s + 5804 | 0;
  L1740 : do {
    if ($17) {
      var $overflow_010_us = 0;
      var $h_011_us = $h_09;
      while (1) {
        var $h_011_us;
        var $overflow_010_us;
        var $20 = HEAP32[$s + ($h_011_us << 2) + 2908 >> 2];
        var $21 = ($20 << 2) + $desc_0_0_val + 2 | 0;
        var $27 = (HEAP16[(((HEAP16[$21 >> 1] & 65535) << 2) + 2 >> 1) + $desc_0_0_val$s1] & 65535) + 1 | 0;
        var $28 = ($27 | 0) > ($8 | 0);
        var $_overflow_0_us = ($28 & 1) + $overflow_010_us | 0;
        var $bits_1_us = $28 ? $8 : $27;
        HEAP16[$21 >> 1] = $bits_1_us & 65535;
        if (($20 | 0) <= ($desc_0_1_val | 0)) {
          var $45 = ($bits_1_us << 1) + $s + 2876 | 0;
          HEAP16[$45 >> 1] = HEAP16[$45 >> 1] + 1 & 65535;
          if (($20 | 0) < ($6 | 0)) {
            var $xbits_0_us = 0;
          } else {
            var $xbits_0_us = HEAP32[$4 + ($20 - $6 << 2) >> 2];
          }
          var $xbits_0_us;
          HEAP32[$16$s2] = (HEAP16[($20 << 2 >> 1) + $desc_0_0_val$s1] & 65535) * ($xbits_0_us + $bits_1_us) + HEAP32[$16$s2] | 0;
        }
        var $h_0_us = $h_011_us + 1 | 0;
        if (($h_0_us | 0) == 573) {
          var $overflow_0_lcssa = $_overflow_0_us;
          break L1740;
        } else {
          var $overflow_010_us = $_overflow_0_us;
          var $h_011_us = $h_0_us;
        }
      }
    } else {
      var $overflow_010 = 0;
      var $h_011 = $h_09;
      while (1) {
        var $h_011;
        var $overflow_010;
        var $50 = HEAP32[$s + ($h_011 << 2) + 2908 >> 2];
        var $51 = ($50 << 2) + $desc_0_0_val + 2 | 0;
        var $57 = (HEAP16[(((HEAP16[$51 >> 1] & 65535) << 2) + 2 >> 1) + $desc_0_0_val$s1] & 65535) + 1 | 0;
        var $58 = ($57 | 0) > ($8 | 0);
        var $_overflow_0 = ($58 & 1) + $overflow_010 | 0;
        var $bits_1 = $58 ? $8 : $57;
        HEAP16[$51 >> 1] = $bits_1 & 65535;
        if (($50 | 0) <= ($desc_0_1_val | 0)) {
          var $63 = ($bits_1 << 1) + $s + 2876 | 0;
          HEAP16[$63 >> 1] = HEAP16[$63 >> 1] + 1 & 65535;
          if (($50 | 0) < ($6 | 0)) {
            var $xbits_0 = 0;
          } else {
            var $xbits_0 = HEAP32[$4 + ($50 - $6 << 2) >> 2];
          }
          var $xbits_0;
          var $74 = HEAP16[($50 << 2 >> 1) + $desc_0_0_val$s1] & 65535;
          HEAP32[$16$s2] = $74 * ($xbits_0 + $bits_1) + HEAP32[$16$s2] | 0;
          HEAP32[$18 >> 2] = ((HEAP16[$2 + ($50 << 2) + 2 >> 1] & 65535) + $xbits_0) * $74 + HEAP32[$18 >> 2] | 0;
        }
        var $h_0 = $h_011 + 1 | 0;
        if (($h_0 | 0) == 573) {
          var $overflow_0_lcssa = $_overflow_0;
          break L1740;
        } else {
          var $overflow_010 = $_overflow_0;
          var $h_011 = $h_0;
        }
      }
    }
  } while (0);
  var $overflow_0_lcssa;
  if (($overflow_0_lcssa | 0) == 0) {
    return;
  }
  var $87 = ($8 << 1) + $s + 2876 | 0;
  var $overflow_2 = $overflow_0_lcssa;
  while (1) {
    var $overflow_2;
    var $bits_2_in = $8;
    while (1) {
      var $bits_2_in;
      var $bits_2 = $bits_2_in - 1 | 0;
      var $90 = ($bits_2 << 1) + $s + 2876 | 0;
      var $91 = HEAP16[$90 >> 1];
      if ($91 << 16 >> 16 == 0) {
        var $bits_2_in = $bits_2;
      } else {
        break;
      }
    }
    HEAP16[$90 >> 1] = $91 - 1 & 65535;
    var $95 = ($bits_2_in << 1) + $s + 2876 | 0;
    HEAP16[$95 >> 1] = HEAP16[$95 >> 1] + 2 & 65535;
    var $99 = HEAP16[$87 >> 1] - 1 & 65535;
    HEAP16[$87 >> 1] = $99;
    var $100 = $overflow_2 - 2 | 0;
    if (($100 | 0) > 0) {
      var $overflow_2 = $100;
    } else {
      break;
    }
  }
  if (($8 | 0) == 0) {
    return;
  } else {
    var $h_14 = 573;
    var $bits_35 = $8;
    var $103 = $99;
  }
  while (1) {
    var $103;
    var $bits_35;
    var $h_14;
    var $105 = $bits_35 & 65535;
    var $n_0_ph = $103 & 65535;
    var $h_2_ph = $h_14;
    while (1) {
      var $h_2_ph;
      var $n_0_ph;
      if (($n_0_ph | 0) == 0) {
        break;
      } else {
        var $h_2 = $h_2_ph;
      }
      while (1) {
        var $h_2;
        var $107 = $h_2 - 1 | 0;
        var $109 = HEAP32[$s + ($107 << 2) + 2908 >> 2];
        if (($109 | 0) > ($desc_0_1_val | 0)) {
          var $h_2 = $107;
        } else {
          break;
        }
      }
      var $111 = ($109 << 2) + $desc_0_0_val + 2 | 0;
      var $113 = HEAP16[$111 >> 1] & 65535;
      if (($113 | 0) != ($bits_35 | 0)) {
        HEAP32[$16$s2] = (HEAP16[($109 << 2 >> 1) + $desc_0_0_val$s1] & 65535) * ($bits_35 - $113) + HEAP32[$16$s2] | 0;
        HEAP16[$111 >> 1] = $105;
      }
      var $n_0_ph = $n_0_ph - 1 | 0;
      var $h_2_ph = $107;
    }
    var $125 = $bits_35 - 1 | 0;
    if (($125 | 0) == 0) {
      break;
    }
    var $h_14 = $h_2_ph;
    var $bits_35 = $125;
    var $103 = HEAP16[$s + ($125 << 1) + 2876 >> 1];
  }
  return;
}
_gen_bitlen["X"] = 1;
function _gen_codes($tree, $max_code, $bl_count) {
  var $next_code$s1;
  var $bl_count$s1 = $bl_count >> 1;
  var __stackBase__ = STACKTOP;
  STACKTOP += 32;
  var $next_code = __stackBase__, $next_code$s1 = $next_code >> 1;
  var $1 = HEAP16[$bl_count$s1] << 1;
  HEAP16[$next_code$s1 + 1] = $1;
  var $6 = (HEAP16[$bl_count$s1 + 1] + $1 & 65535) << 1;
  HEAP16[$next_code$s1 + 2] = $6;
  var $11 = (HEAP16[$bl_count$s1 + 2] + $6 & 65535) << 1;
  HEAP16[$next_code$s1 + 3] = $11;
  var $16 = (HEAP16[$bl_count$s1 + 3] + $11 & 65535) << 1;
  HEAP16[$next_code$s1 + 4] = $16;
  var $21 = (HEAP16[$bl_count$s1 + 4] + $16 & 65535) << 1;
  HEAP16[$next_code$s1 + 5] = $21;
  var $26 = (HEAP16[$bl_count$s1 + 5] + $21 & 65535) << 1;
  HEAP16[$next_code$s1 + 6] = $26;
  var $31 = (HEAP16[$bl_count$s1 + 6] + $26 & 65535) << 1;
  HEAP16[$next_code$s1 + 7] = $31;
  var $36 = (HEAP16[$bl_count$s1 + 7] + $31 & 65535) << 1;
  HEAP16[$next_code$s1 + 8] = $36;
  var $41 = (HEAP16[$bl_count$s1 + 8] + $36 & 65535) << 1;
  HEAP16[$next_code$s1 + 9] = $41;
  var $46 = (HEAP16[$bl_count$s1 + 9] + $41 & 65535) << 1;
  HEAP16[$next_code$s1 + 10] = $46;
  var $51 = (HEAP16[$bl_count$s1 + 10] + $46 & 65535) << 1;
  HEAP16[$next_code$s1 + 11] = $51;
  var $56 = (HEAP16[$bl_count$s1 + 11] + $51 & 65535) << 1;
  HEAP16[$next_code$s1 + 12] = $56;
  var $61 = (HEAP16[$bl_count$s1 + 12] + $56 & 65535) << 1;
  HEAP16[$next_code$s1 + 13] = $61;
  var $66 = (HEAP16[$bl_count$s1 + 13] + $61 & 65535) << 1;
  HEAP16[$next_code$s1 + 14] = $66;
  HEAP16[$next_code$s1 + 15] = (HEAP16[$bl_count$s1 + 14] + $66 & 65535) << 1;
  if (($max_code | 0) < 0) {
    STACKTOP = __stackBase__;
    return;
  }
  var $74 = $max_code + 1 | 0;
  var $n_01 = 0;
  while (1) {
    var $n_01;
    var $77 = HEAP16[$tree + ($n_01 << 2) + 2 >> 1];
    var $78 = $77 & 65535;
    if ($77 << 16 >> 16 != 0) {
      var $81 = ($78 << 1) + $next_code | 0;
      var $82 = HEAP16[$81 >> 1];
      HEAP16[$81 >> 1] = $82 + 1 & 65535;
      HEAP16[$tree + ($n_01 << 2) >> 1] = _bi_reverse($82 & 65535, $78) & 65535;
    }
    var $89 = $n_01 + 1 | 0;
    if (($89 | 0) == ($74 | 0)) {
      break;
    } else {
      var $n_01 = $89;
    }
  }
  STACKTOP = __stackBase__;
  return;
}
_gen_codes["X"] = 1;
function _zcalloc($opaque, $items, $size) {
  return _malloc($size * $items | 0);
}
function _zcfree($opaque, $ptr) {
  _free($ptr);
  return;
}
function _malloc($bytes) {
  do {
    if ($bytes >>> 0 < 245) {
      if ($bytes >>> 0 < 11) {
        var $8 = 16;
      } else {
        var $8 = $bytes + 11 & -8;
      }
      var $8;
      var $9 = $8 >>> 3;
      var $10 = HEAP32[__gm_ >> 2];
      var $11 = $10 >>> ($9 >>> 0);
      if (($11 & 3 | 0) != 0) {
        var $17 = ($11 & 1 ^ 1) + $9 | 0;
        var $18 = $17 << 1;
        var $20 = ($18 << 2) + __gm_ + 40 | 0;
        var $21 = ($18 + 2 << 2) + __gm_ + 40 | 0;
        var $22 = HEAP32[$21 >> 2];
        var $23 = $22 + 8 | 0;
        var $24 = HEAP32[$23 >> 2];
        do {
          if (($20 | 0) == ($24 | 0)) {
            HEAP32[__gm_ >> 2] = $10 & (1 << $17 ^ -1);
          } else {
            if ($24 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
              _abort();
            } else {
              HEAP32[$21 >> 2] = $24;
              HEAP32[$24 + 12 >> 2] = $20;
              break;
            }
          }
        } while (0);
        var $38 = $17 << 3;
        HEAP32[$22 + 4 >> 2] = $38 | 3;
        var $43 = $22 + ($38 | 4) | 0;
        HEAP32[$43 >> 2] = HEAP32[$43 >> 2] | 1;
        var $mem_0 = $23;
        var $mem_0;
        return $mem_0;
      }
      if ($8 >>> 0 <= HEAP32[__gm_ + 8 >> 2] >>> 0) {
        var $nb_0 = $8;
        break;
      }
      if (($11 | 0) == 0) {
        if ((HEAP32[__gm_ + 4 >> 2] | 0) == 0) {
          var $nb_0 = $8;
          break;
        }
        var $145 = _tmalloc_small($8);
        if (($145 | 0) == 0) {
          var $nb_0 = $8;
          break;
        } else {
          var $mem_0 = $145;
        }
        var $mem_0;
        return $mem_0;
      }
      var $54 = 2 << $9;
      var $57 = $11 << $9 & ($54 | -$54);
      var $60 = ($57 & -$57) - 1 | 0;
      var $62 = $60 >>> 12 & 16;
      var $63 = $60 >>> ($62 >>> 0);
      var $65 = $63 >>> 5 & 8;
      var $66 = $63 >>> ($65 >>> 0);
      var $68 = $66 >>> 2 & 4;
      var $69 = $66 >>> ($68 >>> 0);
      var $71 = $69 >>> 1 & 2;
      var $72 = $69 >>> ($71 >>> 0);
      var $74 = $72 >>> 1 & 1;
      var $80 = ($65 | $62 | $68 | $71 | $74) + ($72 >>> ($74 >>> 0)) | 0;
      var $81 = $80 << 1;
      var $83 = ($81 << 2) + __gm_ + 40 | 0;
      var $84 = ($81 + 2 << 2) + __gm_ + 40 | 0;
      var $85 = HEAP32[$84 >> 2];
      var $86 = $85 + 8 | 0;
      var $87 = HEAP32[$86 >> 2];
      do {
        if (($83 | 0) == ($87 | 0)) {
          HEAP32[__gm_ >> 2] = $10 & (1 << $80 ^ -1);
        } else {
          if ($87 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
            _abort();
          } else {
            HEAP32[$84 >> 2] = $87;
            HEAP32[$87 + 12 >> 2] = $83;
            break;
          }
        }
      } while (0);
      var $101 = $80 << 3;
      var $102 = $101 - $8 | 0;
      HEAP32[$85 + 4 >> 2] = $8 | 3;
      var $105 = $85;
      var $107 = $105 + $8 | 0;
      HEAP32[$105 + ($8 | 4) >> 2] = $102 | 1;
      HEAP32[$105 + $101 >> 2] = $102;
      var $113 = HEAP32[__gm_ + 8 >> 2];
      if (($113 | 0) != 0) {
        var $116 = HEAP32[__gm_ + 20 >> 2];
        var $119 = $113 >>> 2 & 1073741822;
        var $121 = ($119 << 2) + __gm_ + 40 | 0;
        var $122 = HEAP32[__gm_ >> 2];
        var $123 = 1 << ($113 >>> 3);
        do {
          if (($122 & $123 | 0) == 0) {
            HEAP32[__gm_ >> 2] = $122 | $123;
            var $F4_0 = $121;
            var $_pre_phi = ($119 + 2 << 2) + __gm_ + 40 | 0;
          } else {
            var $129 = ($119 + 2 << 2) + __gm_ + 40 | 0;
            var $130 = HEAP32[$129 >> 2];
            if ($130 >>> 0 >= HEAP32[__gm_ + 16 >> 2] >>> 0) {
              var $F4_0 = $130;
              var $_pre_phi = $129;
              break;
            }
            _abort();
          }
        } while (0);
        var $_pre_phi;
        var $F4_0;
        HEAP32[$_pre_phi >> 2] = $116;
        HEAP32[$F4_0 + 12 >> 2] = $116;
        HEAP32[$116 + 8 >> 2] = $F4_0;
        HEAP32[$116 + 12 >> 2] = $121;
      }
      HEAP32[__gm_ + 8 >> 2] = $102;
      HEAP32[__gm_ + 20 >> 2] = $107;
      var $mem_0 = $86;
      var $mem_0;
      return $mem_0;
    } else {
      if ($bytes >>> 0 > 4294967231) {
        var $nb_0 = -1;
        break;
      }
      var $151 = $bytes + 11 & -8;
      if ((HEAP32[__gm_ + 4 >> 2] | 0) == 0) {
        var $nb_0 = $151;
        break;
      }
      var $155 = _tmalloc_large($151);
      if (($155 | 0) == 0) {
        var $nb_0 = $151;
        break;
      } else {
        var $mem_0 = $155;
      }
      var $mem_0;
      return $mem_0;
    }
  } while (0);
  var $nb_0;
  var $157 = HEAP32[__gm_ + 8 >> 2];
  if ($nb_0 >>> 0 > $157 >>> 0) {
    var $186 = HEAP32[__gm_ + 12 >> 2];
    if ($nb_0 >>> 0 < $186 >>> 0) {
      var $189 = $186 - $nb_0 | 0;
      HEAP32[__gm_ + 12 >> 2] = $189;
      var $190 = HEAP32[__gm_ + 24 >> 2];
      var $191 = $190;
      HEAP32[__gm_ + 24 >> 2] = $191 + $nb_0 | 0;
      HEAP32[$nb_0 + ($191 + 4) >> 2] = $189 | 1;
      HEAP32[$190 + 4 >> 2] = $nb_0 | 3;
      var $mem_0 = $190 + 8 | 0;
      var $mem_0;
      return $mem_0;
    } else {
      var $mem_0 = _sys_alloc($nb_0);
      var $mem_0;
      return $mem_0;
    }
  } else {
    var $160 = $157 - $nb_0 | 0;
    var $161 = HEAP32[__gm_ + 20 >> 2];
    if ($160 >>> 0 > 15) {
      var $164 = $161;
      HEAP32[__gm_ + 20 >> 2] = $164 + $nb_0 | 0;
      HEAP32[__gm_ + 8 >> 2] = $160;
      HEAP32[$nb_0 + ($164 + 4) >> 2] = $160 | 1;
      HEAP32[$164 + $157 >> 2] = $160;
      HEAP32[$161 + 4 >> 2] = $nb_0 | 3;
    } else {
      HEAP32[__gm_ + 8 >> 2] = 0;
      HEAP32[__gm_ + 20 >> 2] = 0;
      HEAP32[$161 + 4 >> 2] = $157 | 3;
      var $179 = $157 + ($161 + 4) | 0;
      HEAP32[$179 >> 2] = HEAP32[$179 >> 2] | 1;
    }
    var $mem_0 = $161 + 8 | 0;
    var $mem_0;
    return $mem_0;
  }
}
Module["_malloc"] = _malloc;
_malloc["X"] = 1;
function _tmalloc_small($nb) {
  var $R_1$s2;
  var $v_0_ph$s2;
  var $1 = HEAP32[__gm_ + 4 >> 2];
  var $4 = ($1 & -$1) - 1 | 0;
  var $6 = $4 >>> 12 & 16;
  var $7 = $4 >>> ($6 >>> 0);
  var $9 = $7 >>> 5 & 8;
  var $10 = $7 >>> ($9 >>> 0);
  var $12 = $10 >>> 2 & 4;
  var $13 = $10 >>> ($12 >>> 0);
  var $15 = $13 >>> 1 & 2;
  var $16 = $13 >>> ($15 >>> 0);
  var $18 = $16 >>> 1 & 1;
  var $26 = HEAP32[__gm_ + (($9 | $6 | $12 | $15 | $18) + ($16 >>> ($18 >>> 0)) << 2) + 304 >> 2];
  var $v_0_ph = $26, $v_0_ph$s2 = $v_0_ph >> 2;
  var $rsize_0_ph = (HEAP32[$26 + 4 >> 2] & -8) - $nb | 0;
  L1852 : while (1) {
    var $rsize_0_ph;
    var $v_0_ph;
    var $t_0 = $v_0_ph;
    while (1) {
      var $t_0;
      var $33 = HEAP32[$t_0 + 16 >> 2];
      if (($33 | 0) == 0) {
        var $37 = HEAP32[$t_0 + 20 >> 2];
        if (($37 | 0) == 0) {
          break L1852;
        } else {
          var $39 = $37;
        }
      } else {
        var $39 = $33;
      }
      var $39;
      var $43 = (HEAP32[$39 + 4 >> 2] & -8) - $nb | 0;
      if ($43 >>> 0 < $rsize_0_ph >>> 0) {
        var $v_0_ph = $39, $v_0_ph$s2 = $v_0_ph >> 2;
        var $rsize_0_ph = $43;
        continue L1852;
      } else {
        var $t_0 = $39;
      }
    }
  }
  var $46 = $v_0_ph;
  var $47 = HEAP32[__gm_ + 16 >> 2];
  if ($46 >>> 0 < $47 >>> 0) {
    _abort();
  }
  var $50 = $46 + $nb | 0;
  var $51 = $50;
  if ($46 >>> 0 >= $50 >>> 0) {
    _abort();
  }
  var $55 = HEAP32[$v_0_ph$s2 + 6];
  var $57 = HEAP32[$v_0_ph$s2 + 3];
  var $58 = ($57 | 0) == ($v_0_ph | 0);
  L1866 : do {
    if ($58) {
      var $69 = $v_0_ph + 20 | 0;
      var $70 = HEAP32[$69 >> 2];
      do {
        if (($70 | 0) == 0) {
          var $73 = $v_0_ph + 16 | 0;
          var $74 = HEAP32[$73 >> 2];
          if (($74 | 0) == 0) {
            var $R_1 = 0, $R_1$s2 = $R_1 >> 2;
            break L1866;
          } else {
            var $RP_0 = $73;
            var $R_0 = $74;
            break;
          }
        } else {
          var $RP_0 = $69;
          var $R_0 = $70;
        }
      } while (0);
      while (1) {
        var $R_0;
        var $RP_0;
        var $76 = $R_0 + 20 | 0;
        var $77 = HEAP32[$76 >> 2];
        if (($77 | 0) != 0) {
          var $RP_0 = $76;
          var $R_0 = $77;
          continue;
        }
        var $80 = $R_0 + 16 | 0;
        var $81 = HEAP32[$80 >> 2];
        if (($81 | 0) == 0) {
          break;
        } else {
          var $RP_0 = $80;
          var $R_0 = $81;
        }
      }
      if ($RP_0 >>> 0 < $47 >>> 0) {
        _abort();
      } else {
        HEAP32[$RP_0 >> 2] = 0;
        var $R_1 = $R_0, $R_1$s2 = $R_1 >> 2;
        break;
      }
    } else {
      var $61 = HEAP32[$v_0_ph$s2 + 2];
      if ($61 >>> 0 < $47 >>> 0) {
        _abort();
      } else {
        HEAP32[$61 + 12 >> 2] = $57;
        HEAP32[$57 + 8 >> 2] = $61;
        var $R_1 = $57, $R_1$s2 = $R_1 >> 2;
        break;
      }
    }
  } while (0);
  var $R_1;
  var $89 = ($55 | 0) == 0;
  L1882 : do {
    if (!$89) {
      var $91 = $v_0_ph + 28 | 0;
      var $93 = (HEAP32[$91 >> 2] << 2) + __gm_ + 304 | 0;
      do {
        if (($v_0_ph | 0) == (HEAP32[$93 >> 2] | 0)) {
          HEAP32[$93 >> 2] = $R_1;
          if (($R_1 | 0) != 0) {
            break;
          }
          HEAP32[__gm_ + 4 >> 2] = HEAP32[__gm_ + 4 >> 2] & (1 << HEAP32[$91 >> 2] ^ -1);
          break L1882;
        } else {
          if ($55 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
            _abort();
          }
          var $107 = $55 + 16 | 0;
          if ((HEAP32[$107 >> 2] | 0) == ($v_0_ph | 0)) {
            HEAP32[$107 >> 2] = $R_1;
          } else {
            HEAP32[$55 + 20 >> 2] = $R_1;
          }
          if (($R_1 | 0) == 0) {
            break L1882;
          }
        }
      } while (0);
      if ($R_1 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
        _abort();
      }
      HEAP32[$R_1$s2 + 6] = $55;
      var $123 = HEAP32[$v_0_ph$s2 + 4];
      do {
        if (($123 | 0) != 0) {
          if ($123 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
            _abort();
          } else {
            HEAP32[$R_1$s2 + 4] = $123;
            HEAP32[$123 + 24 >> 2] = $R_1;
            break;
          }
        }
      } while (0);
      var $135 = HEAP32[$v_0_ph$s2 + 5];
      if (($135 | 0) == 0) {
        break;
      }
      if ($135 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
        _abort();
      } else {
        HEAP32[$R_1$s2 + 5] = $135;
        HEAP32[$135 + 24 >> 2] = $R_1;
        break;
      }
    }
  } while (0);
  if ($rsize_0_ph >>> 0 < 16) {
    var $149 = $rsize_0_ph + $nb | 0;
    HEAP32[$v_0_ph$s2 + 1] = $149 | 3;
    var $153 = $149 + ($46 + 4) | 0;
    HEAP32[$153 >> 2] = HEAP32[$153 >> 2] | 1;
    var $192 = $v_0_ph + 8 | 0;
    var $193 = $192;
    return $193;
  }
  HEAP32[$v_0_ph$s2 + 1] = $nb | 3;
  HEAP32[$nb + ($46 + 4) >> 2] = $rsize_0_ph | 1;
  HEAP32[$46 + $rsize_0_ph + $nb >> 2] = $rsize_0_ph;
  var $164 = HEAP32[__gm_ + 8 >> 2];
  if (($164 | 0) != 0) {
    var $167 = HEAP32[__gm_ + 20 >> 2];
    var $170 = $164 >>> 2 & 1073741822;
    var $172 = ($170 << 2) + __gm_ + 40 | 0;
    var $173 = HEAP32[__gm_ >> 2];
    var $174 = 1 << ($164 >>> 3);
    do {
      if (($173 & $174 | 0) == 0) {
        HEAP32[__gm_ >> 2] = $173 | $174;
        var $F1_0 = $172;
        var $_pre_phi = ($170 + 2 << 2) + __gm_ + 40 | 0;
      } else {
        var $180 = ($170 + 2 << 2) + __gm_ + 40 | 0;
        var $181 = HEAP32[$180 >> 2];
        if ($181 >>> 0 >= HEAP32[__gm_ + 16 >> 2] >>> 0) {
          var $F1_0 = $181;
          var $_pre_phi = $180;
          break;
        }
        _abort();
      }
    } while (0);
    var $_pre_phi;
    var $F1_0;
    HEAP32[$_pre_phi >> 2] = $167;
    HEAP32[$F1_0 + 12 >> 2] = $167;
    HEAP32[$167 + 8 >> 2] = $F1_0;
    HEAP32[$167 + 12 >> 2] = $172;
  }
  HEAP32[__gm_ + 8 >> 2] = $rsize_0_ph;
  HEAP32[__gm_ + 20 >> 2] = $51;
  var $192 = $v_0_ph + 8 | 0;
  var $193 = $192;
  return $193;
}
_tmalloc_small["X"] = 1;
function _tmalloc_large($nb) {
  var $R_1$s2;
  var $113$s2;
  var $t_224$s2;
  var $v_3_lcssa$s2;
  var $t_0$s2;
  var $nb$s2 = $nb >> 2;
  var label;
  var $1 = -$nb | 0;
  var $2 = $nb >>> 8;
  do {
    if (($2 | 0) == 0) {
      var $idx_0 = 0;
    } else {
      if ($nb >>> 0 > 16777215) {
        var $idx_0 = 31;
        break;
      }
      var $9 = ($2 + 1048320 | 0) >>> 16 & 8;
      var $10 = $2 << $9;
      var $13 = ($10 + 520192 | 0) >>> 16 & 4;
      var $14 = $10 << $13;
      var $17 = ($14 + 245760 | 0) >>> 16 & 2;
      var $23 = 14 - ($13 | $9 | $17) + ($14 << $17 >>> 15) | 0;
      var $idx_0 = $nb >>> (($23 + 7 | 0) >>> 0) & 1 | $23 << 1;
    }
  } while (0);
  var $idx_0;
  var $31 = HEAP32[__gm_ + ($idx_0 << 2) + 304 >> 2];
  var $32 = ($31 | 0) == 0;
  L1928 : do {
    if ($32) {
      var $v_2 = 0;
      var $rsize_2 = $1;
      var $t_1 = 0;
    } else {
      if (($idx_0 | 0) == 31) {
        var $39 = 0;
      } else {
        var $39 = 25 - ($idx_0 >>> 1) | 0;
      }
      var $39;
      var $v_0 = 0;
      var $rsize_0 = $1;
      var $t_0 = $31, $t_0$s2 = $t_0 >> 2;
      var $sizebits_0 = $nb << $39;
      var $rst_0 = 0;
      while (1) {
        var $rst_0;
        var $sizebits_0;
        var $t_0;
        var $rsize_0;
        var $v_0;
        var $44 = HEAP32[$t_0$s2 + 1] & -8;
        var $45 = $44 - $nb | 0;
        if ($45 >>> 0 < $rsize_0 >>> 0) {
          if (($44 | 0) == ($nb | 0)) {
            var $v_2 = $t_0;
            var $rsize_2 = $45;
            var $t_1 = $t_0;
            break L1928;
          } else {
            var $v_1 = $t_0;
            var $rsize_1 = $45;
          }
        } else {
          var $v_1 = $v_0;
          var $rsize_1 = $rsize_0;
        }
        var $rsize_1;
        var $v_1;
        var $51 = HEAP32[$t_0$s2 + 5];
        var $54 = HEAP32[(($sizebits_0 >>> 31 << 2) + 16 >> 2) + $t_0$s2];
        var $rst_1 = ($51 | 0) == 0 | ($51 | 0) == ($54 | 0) ? $rst_0 : $51;
        if (($54 | 0) == 0) {
          var $v_2 = $v_1;
          var $rsize_2 = $rsize_1;
          var $t_1 = $rst_1;
          break L1928;
        }
        var $v_0 = $v_1;
        var $rsize_0 = $rsize_1;
        var $t_0 = $54, $t_0$s2 = $t_0 >> 2;
        var $sizebits_0 = $sizebits_0 << 1;
        var $rst_0 = $rst_1;
      }
    }
  } while (0);
  var $t_1;
  var $rsize_2;
  var $v_2;
  do {
    if (($t_1 | 0) == 0 & ($v_2 | 0) == 0) {
      var $63 = 2 << $idx_0;
      var $67 = HEAP32[__gm_ + 4 >> 2] & ($63 | -$63);
      if (($67 | 0) == 0) {
        var $t_2_ph = $t_1;
        break;
      }
      var $72 = ($67 & -$67) - 1 | 0;
      var $74 = $72 >>> 12 & 16;
      var $75 = $72 >>> ($74 >>> 0);
      var $77 = $75 >>> 5 & 8;
      var $78 = $75 >>> ($77 >>> 0);
      var $80 = $78 >>> 2 & 4;
      var $81 = $78 >>> ($80 >>> 0);
      var $83 = $81 >>> 1 & 2;
      var $84 = $81 >>> ($83 >>> 0);
      var $86 = $84 >>> 1 & 1;
      var $t_2_ph = HEAP32[__gm_ + (($77 | $74 | $80 | $83 | $86) + ($84 >>> ($86 >>> 0)) << 2) + 304 >> 2];
    } else {
      var $t_2_ph = $t_1;
    }
  } while (0);
  var $t_2_ph;
  var $95 = ($t_2_ph | 0) == 0;
  L1944 : do {
    if ($95) {
      var $rsize_3_lcssa = $rsize_2;
      var $v_3_lcssa = $v_2, $v_3_lcssa$s2 = $v_3_lcssa >> 2;
    } else {
      var $t_224 = $t_2_ph, $t_224$s2 = $t_224 >> 2;
      var $rsize_325 = $rsize_2;
      var $v_326 = $v_2;
      while (1) {
        var $v_326;
        var $rsize_325;
        var $t_224;
        var $99 = (HEAP32[$t_224$s2 + 1] & -8) - $nb | 0;
        var $100 = $99 >>> 0 < $rsize_325 >>> 0;
        var $rsize_4 = $100 ? $99 : $rsize_325;
        var $v_4 = $100 ? $t_224 : $v_326;
        var $102 = HEAP32[$t_224$s2 + 4];
        if (($102 | 0) != 0) {
          var $t_224 = $102, $t_224$s2 = $t_224 >> 2;
          var $rsize_325 = $rsize_4;
          var $v_326 = $v_4;
          continue;
        }
        var $105 = HEAP32[$t_224$s2 + 5];
        if (($105 | 0) == 0) {
          var $rsize_3_lcssa = $rsize_4;
          var $v_3_lcssa = $v_4, $v_3_lcssa$s2 = $v_3_lcssa >> 2;
          break L1944;
        } else {
          var $t_224 = $105, $t_224$s2 = $t_224 >> 2;
          var $rsize_325 = $rsize_4;
          var $v_326 = $v_4;
        }
      }
    }
  } while (0);
  var $v_3_lcssa;
  var $rsize_3_lcssa;
  if (($v_3_lcssa | 0) == 0) {
    var $_0 = 0;
    var $_0;
    return $_0;
  }
  if ($rsize_3_lcssa >>> 0 >= (HEAP32[__gm_ + 8 >> 2] - $nb | 0) >>> 0) {
    var $_0 = 0;
    var $_0;
    return $_0;
  }
  var $113 = $v_3_lcssa, $113$s2 = $113 >> 2;
  var $114 = HEAP32[__gm_ + 16 >> 2];
  if ($113 >>> 0 < $114 >>> 0) {
    _abort();
  }
  var $117 = $113 + $nb | 0;
  var $118 = $117;
  if ($113 >>> 0 >= $117 >>> 0) {
    _abort();
  }
  var $122 = HEAP32[$v_3_lcssa$s2 + 6];
  var $124 = HEAP32[$v_3_lcssa$s2 + 3];
  var $125 = ($124 | 0) == ($v_3_lcssa | 0);
  L1961 : do {
    if ($125) {
      var $136 = $v_3_lcssa + 20 | 0;
      var $137 = HEAP32[$136 >> 2];
      do {
        if (($137 | 0) == 0) {
          var $140 = $v_3_lcssa + 16 | 0;
          var $141 = HEAP32[$140 >> 2];
          if (($141 | 0) == 0) {
            var $R_1 = 0, $R_1$s2 = $R_1 >> 2;
            break L1961;
          } else {
            var $RP_0 = $140;
            var $R_0 = $141;
            break;
          }
        } else {
          var $RP_0 = $136;
          var $R_0 = $137;
        }
      } while (0);
      while (1) {
        var $R_0;
        var $RP_0;
        var $143 = $R_0 + 20 | 0;
        var $144 = HEAP32[$143 >> 2];
        if (($144 | 0) != 0) {
          var $RP_0 = $143;
          var $R_0 = $144;
          continue;
        }
        var $147 = $R_0 + 16 | 0;
        var $148 = HEAP32[$147 >> 2];
        if (($148 | 0) == 0) {
          break;
        } else {
          var $RP_0 = $147;
          var $R_0 = $148;
        }
      }
      if ($RP_0 >>> 0 < $114 >>> 0) {
        _abort();
      } else {
        HEAP32[$RP_0 >> 2] = 0;
        var $R_1 = $R_0, $R_1$s2 = $R_1 >> 2;
        break;
      }
    } else {
      var $128 = HEAP32[$v_3_lcssa$s2 + 2];
      if ($128 >>> 0 < $114 >>> 0) {
        _abort();
      } else {
        HEAP32[$128 + 12 >> 2] = $124;
        HEAP32[$124 + 8 >> 2] = $128;
        var $R_1 = $124, $R_1$s2 = $R_1 >> 2;
        break;
      }
    }
  } while (0);
  var $R_1;
  var $156 = ($122 | 0) == 0;
  L1977 : do {
    if (!$156) {
      var $158 = $v_3_lcssa + 28 | 0;
      var $160 = (HEAP32[$158 >> 2] << 2) + __gm_ + 304 | 0;
      do {
        if (($v_3_lcssa | 0) == (HEAP32[$160 >> 2] | 0)) {
          HEAP32[$160 >> 2] = $R_1;
          if (($R_1 | 0) != 0) {
            break;
          }
          HEAP32[__gm_ + 4 >> 2] = HEAP32[__gm_ + 4 >> 2] & (1 << HEAP32[$158 >> 2] ^ -1);
          break L1977;
        } else {
          if ($122 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
            _abort();
          }
          var $174 = $122 + 16 | 0;
          if ((HEAP32[$174 >> 2] | 0) == ($v_3_lcssa | 0)) {
            HEAP32[$174 >> 2] = $R_1;
          } else {
            HEAP32[$122 + 20 >> 2] = $R_1;
          }
          if (($R_1 | 0) == 0) {
            break L1977;
          }
        }
      } while (0);
      if ($R_1 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
        _abort();
      }
      HEAP32[$R_1$s2 + 6] = $122;
      var $190 = HEAP32[$v_3_lcssa$s2 + 4];
      do {
        if (($190 | 0) != 0) {
          if ($190 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
            _abort();
          } else {
            HEAP32[$R_1$s2 + 4] = $190;
            HEAP32[$190 + 24 >> 2] = $R_1;
            break;
          }
        }
      } while (0);
      var $202 = HEAP32[$v_3_lcssa$s2 + 5];
      if (($202 | 0) == 0) {
        break;
      }
      if ($202 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
        _abort();
      } else {
        HEAP32[$R_1$s2 + 5] = $202;
        HEAP32[$202 + 24 >> 2] = $R_1;
        break;
      }
    }
  } while (0);
  do {
    if ($rsize_3_lcssa >>> 0 < 16) {
      var $216 = $rsize_3_lcssa + $nb | 0;
      HEAP32[$v_3_lcssa$s2 + 1] = $216 | 3;
      var $220 = $216 + ($113 + 4) | 0;
      HEAP32[$220 >> 2] = HEAP32[$220 >> 2] | 1;
    } else {
      HEAP32[$v_3_lcssa$s2 + 1] = $nb | 3;
      HEAP32[$nb$s2 + ($113$s2 + 1)] = $rsize_3_lcssa | 1;
      HEAP32[($rsize_3_lcssa >> 2) + $113$s2 + $nb$s2] = $rsize_3_lcssa;
      if ($rsize_3_lcssa >>> 0 < 256) {
        var $235 = $rsize_3_lcssa >>> 2 & 1073741822;
        var $237 = ($235 << 2) + __gm_ + 40 | 0;
        var $238 = HEAP32[__gm_ >> 2];
        var $239 = 1 << ($rsize_3_lcssa >>> 3);
        do {
          if (($238 & $239 | 0) == 0) {
            HEAP32[__gm_ >> 2] = $238 | $239;
            var $F5_0 = $237;
            var $_pre_phi = ($235 + 2 << 2) + __gm_ + 40 | 0;
          } else {
            var $245 = ($235 + 2 << 2) + __gm_ + 40 | 0;
            var $246 = HEAP32[$245 >> 2];
            if ($246 >>> 0 >= HEAP32[__gm_ + 16 >> 2] >>> 0) {
              var $F5_0 = $246;
              var $_pre_phi = $245;
              break;
            }
            _abort();
          }
        } while (0);
        var $_pre_phi;
        var $F5_0;
        HEAP32[$_pre_phi >> 2] = $118;
        HEAP32[$F5_0 + 12 >> 2] = $118;
        HEAP32[$nb$s2 + ($113$s2 + 2)] = $F5_0;
        HEAP32[$nb$s2 + ($113$s2 + 3)] = $237;
        break;
      }
      var $258 = $117;
      var $259 = $rsize_3_lcssa >>> 8;
      do {
        if (($259 | 0) == 0) {
          var $I7_0 = 0;
        } else {
          if ($rsize_3_lcssa >>> 0 > 16777215) {
            var $I7_0 = 31;
            break;
          }
          var $266 = ($259 + 1048320 | 0) >>> 16 & 8;
          var $267 = $259 << $266;
          var $270 = ($267 + 520192 | 0) >>> 16 & 4;
          var $271 = $267 << $270;
          var $274 = ($271 + 245760 | 0) >>> 16 & 2;
          var $280 = 14 - ($270 | $266 | $274) + ($271 << $274 >>> 15) | 0;
          var $I7_0 = $rsize_3_lcssa >>> (($280 + 7 | 0) >>> 0) & 1 | $280 << 1;
        }
      } while (0);
      var $I7_0;
      var $287 = ($I7_0 << 2) + __gm_ + 304 | 0;
      HEAP32[$nb$s2 + ($113$s2 + 7)] = $I7_0;
      HEAP32[$nb$s2 + ($113$s2 + 5)] = 0;
      HEAP32[$nb$s2 + ($113$s2 + 4)] = 0;
      var $294 = HEAP32[__gm_ + 4 >> 2];
      var $295 = 1 << $I7_0;
      if (($294 & $295 | 0) == 0) {
        HEAP32[__gm_ + 4 >> 2] = $294 | $295;
        HEAP32[$287 >> 2] = $258;
        HEAP32[$nb$s2 + ($113$s2 + 6)] = $287;
        HEAP32[$nb$s2 + ($113$s2 + 3)] = $258;
        HEAP32[$nb$s2 + ($113$s2 + 2)] = $258;
        break;
      }
      if (($I7_0 | 0) == 31) {
        var $314 = 0;
      } else {
        var $314 = 25 - ($I7_0 >>> 1) | 0;
      }
      var $314;
      var $K12_0 = $rsize_3_lcssa << $314;
      var $T_0 = HEAP32[$287 >> 2];
      while (1) {
        var $T_0;
        var $K12_0;
        if ((HEAP32[$T_0 + 4 >> 2] & -8 | 0) == ($rsize_3_lcssa | 0)) {
          break;
        }
        var $323 = ($K12_0 >>> 31 << 2) + $T_0 + 16 | 0;
        var $324 = HEAP32[$323 >> 2];
        if (($324 | 0) == 0) {
          label = 1522;
          break;
        }
        var $K12_0 = $K12_0 << 1;
        var $T_0 = $324;
      }
      if (label == 1522) {
        if ($323 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
          _abort();
        } else {
          HEAP32[$323 >> 2] = $258;
          HEAP32[$nb$s2 + ($113$s2 + 6)] = $T_0;
          HEAP32[$nb$s2 + ($113$s2 + 3)] = $258;
          HEAP32[$nb$s2 + ($113$s2 + 2)] = $258;
          break;
        }
      }
      var $341 = $T_0 + 8 | 0;
      var $342 = HEAP32[$341 >> 2];
      var $344 = HEAP32[__gm_ + 16 >> 2];
      if ($T_0 >>> 0 < $344 >>> 0) {
        _abort();
      }
      if ($342 >>> 0 < $344 >>> 0) {
        _abort();
      } else {
        HEAP32[$342 + 12 >> 2] = $258;
        HEAP32[$341 >> 2] = $258;
        HEAP32[$nb$s2 + ($113$s2 + 2)] = $342;
        HEAP32[$nb$s2 + ($113$s2 + 3)] = $T_0;
        HEAP32[$nb$s2 + ($113$s2 + 6)] = 0;
        break;
      }
    }
  } while (0);
  var $_0 = $v_3_lcssa + 8 | 0;
  var $_0;
  return $_0;
}
_tmalloc_large["X"] = 1;
function _sys_alloc($nb) {
  var $sp_0$s2;
  var label;
  if ((HEAP32[_mparams >> 2] | 0) == 0) {
    _init_mparams();
  }
  do {
    if ((HEAP32[__gm_ + 440 >> 2] & 4 | 0) == 0) {
      var $9 = HEAP32[__gm_ + 24 >> 2];
      do {
        if (($9 | 0) == 0) {
          label = 1544;
        } else {
          var $13 = _segment_holding($9);
          if (($13 | 0) == 0) {
            label = 1544;
            break;
          }
          var $41 = HEAP32[_mparams + 8 >> 2];
          var $46 = $nb + 47 - HEAP32[__gm_ + 12 >> 2] + $41 & -$41;
          if ($46 >>> 0 >= 2147483647) {
            label = 1552;
            break;
          }
          var $49 = _sbrk($46);
          if (($49 | 0) == (HEAP32[$13 >> 2] + HEAP32[$13 + 4 >> 2] | 0)) {
            var $tbase_0 = $49;
            var $asize_1 = $46;
            var $br_0 = $49;
            label = 1551;
            break;
          } else {
            var $br_08 = $49;
            var $asize_19 = $46;
            break;
          }
        }
      } while (0);
      do {
        if (label == 1544) {
          var $15 = _sbrk(0);
          if (($15 | 0) == -1) {
            label = 1552;
            break;
          }
          var $18 = HEAP32[_mparams + 8 >> 2];
          var $22 = $18 + ($nb + 47) & -$18;
          var $23 = $15;
          var $24 = HEAP32[_mparams + 4 >> 2];
          var $25 = $24 - 1 | 0;
          if (($25 & $23 | 0) == 0) {
            var $asize_0 = $22;
          } else {
            var $asize_0 = $22 - $23 + ($25 + $23 & -$24) | 0;
          }
          var $asize_0;
          if ($asize_0 >>> 0 >= 2147483647) {
            label = 1552;
            break;
          }
          var $37 = _sbrk($asize_0);
          if (($37 | 0) == ($15 | 0)) {
            var $tbase_0 = $15;
            var $asize_1 = $asize_0;
            var $br_0 = $37;
            label = 1551;
            break;
          } else {
            var $br_08 = $37;
            var $asize_19 = $asize_0;
            break;
          }
        }
      } while (0);
      if (label == 1551) {
        var $br_0;
        var $asize_1;
        var $tbase_0;
        if (($tbase_0 | 0) == -1) {
          var $br_08 = $br_0;
          var $asize_19 = $asize_1;
        } else {
          var $tsize_220 = $asize_1;
          var $tbase_221 = $tbase_0;
          label = 1564;
          break;
        }
      } else if (label == 1552) {
        HEAP32[__gm_ + 440 >> 2] = HEAP32[__gm_ + 440 >> 2] | 4;
        label = 1561;
        break;
      }
      var $asize_19;
      var $br_08;
      var $60 = -$asize_19 | 0;
      do {
        if (($br_08 | 0) != -1 & $asize_19 >>> 0 < 2147483647) {
          if ($asize_19 >>> 0 >= ($nb + 48 | 0) >>> 0) {
            var $asize_2 = $asize_19;
            label = 1559;
            break;
          }
          var $67 = HEAP32[_mparams + 8 >> 2];
          var $72 = $nb + 47 - $asize_19 + $67 & -$67;
          if ($72 >>> 0 >= 2147483647) {
            var $asize_2 = $asize_19;
            label = 1559;
            break;
          }
          if ((_sbrk($72) | 0) == -1) {
            _sbrk($60);
            break;
          } else {
            var $asize_2 = $72 + $asize_19 | 0;
            label = 1559;
            break;
          }
        } else {
          var $asize_2 = $asize_19;
          label = 1559;
        }
      } while (0);
      if (label == 1559) {
        var $asize_2;
        if (($br_08 | 0) != -1) {
          var $tsize_220 = $asize_2;
          var $tbase_221 = $br_08;
          label = 1564;
          break;
        }
      }
      HEAP32[__gm_ + 440 >> 2] = HEAP32[__gm_ + 440 >> 2] | 4;
      label = 1561;
      break;
    } else {
      label = 1561;
    }
  } while (0);
  do {
    if (label == 1561) {
      var $85 = HEAP32[_mparams + 8 >> 2];
      var $89 = $85 + ($nb + 47) & -$85;
      if ($89 >>> 0 >= 2147483647) {
        break;
      }
      var $92 = _sbrk($89);
      var $93 = _sbrk(0);
      if (!(($93 | 0) != -1 & ($92 | 0) != -1 & $92 >>> 0 < $93 >>> 0)) {
        break;
      }
      var $98 = $93 - $92 | 0;
      if ($98 >>> 0 <= ($nb + 40 | 0) >>> 0 | ($92 | 0) == -1) {
        break;
      } else {
        var $tsize_220 = $98;
        var $tbase_221 = $92;
        label = 1564;
        break;
      }
    }
  } while (0);
  do {
    if (label == 1564) {
      var $tbase_221;
      var $tsize_220;
      var $103 = HEAP32[__gm_ + 432 >> 2] + $tsize_220 | 0;
      HEAP32[__gm_ + 432 >> 2] = $103;
      if ($103 >>> 0 > HEAP32[__gm_ + 436 >> 2] >>> 0) {
        HEAP32[__gm_ + 436 >> 2] = $103;
      }
      var $108 = HEAP32[__gm_ + 24 >> 2];
      var $109 = ($108 | 0) == 0;
      L2084 : do {
        if ($109) {
          var $111 = HEAP32[__gm_ + 16 >> 2];
          if (($111 | 0) == 0 | $tbase_221 >>> 0 < $111 >>> 0) {
            HEAP32[__gm_ + 16 >> 2] = $tbase_221;
          }
          HEAP32[__gm_ + 444 >> 2] = $tbase_221;
          HEAP32[__gm_ + 448 >> 2] = $tsize_220;
          HEAP32[__gm_ + 456 >> 2] = 0;
          HEAP32[__gm_ + 36 >> 2] = HEAP32[_mparams >> 2];
          HEAP32[__gm_ + 32 >> 2] = -1;
          _init_bins();
          _init_top($tbase_221, $tsize_220 - 40 | 0);
        } else {
          var $sp_0 = __gm_ + 444 | 0, $sp_0$s2 = $sp_0 >> 2;
          while (1) {
            var $sp_0;
            if (($sp_0 | 0) == 0) {
              break;
            }
            var $122 = HEAP32[$sp_0$s2];
            var $123 = $sp_0 + 4 | 0;
            var $124 = HEAP32[$123 >> 2];
            var $125 = $122 + $124 | 0;
            if (($tbase_221 | 0) == ($125 | 0)) {
              label = 1573;
              break;
            }
            var $sp_0 = HEAP32[$sp_0$s2 + 2], $sp_0$s2 = $sp_0 >> 2;
          }
          do {
            if (label == 1573) {
              if ((HEAP32[$sp_0$s2 + 3] & 8 | 0) != 0) {
                break;
              }
              var $135 = $108;
              if (!($135 >>> 0 >= $122 >>> 0 & $135 >>> 0 < $125 >>> 0)) {
                break;
              }
              HEAP32[$123 >> 2] = $124 + $tsize_220 | 0;
              _init_top(HEAP32[__gm_ + 24 >> 2], HEAP32[__gm_ + 12 >> 2] + $tsize_220 | 0);
              break L2084;
            }
          } while (0);
          if ($tbase_221 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
            HEAP32[__gm_ + 16 >> 2] = $tbase_221;
          }
          var $146 = $tbase_221 + $tsize_220 | 0;
          var $sp_1 = __gm_ + 444 | 0;
          while (1) {
            var $sp_1;
            if (($sp_1 | 0) == 0) {
              break;
            }
            var $150 = $sp_1 | 0;
            var $151 = HEAP32[$150 >> 2];
            if (($151 | 0) == ($146 | 0)) {
              label = 1582;
              break;
            }
            var $sp_1 = HEAP32[$sp_1 + 8 >> 2];
          }
          do {
            if (label == 1582) {
              if ((HEAP32[$sp_1 + 12 >> 2] & 8 | 0) != 0) {
                break;
              }
              HEAP32[$150 >> 2] = $tbase_221;
              var $161 = $sp_1 + 4 | 0;
              HEAP32[$161 >> 2] = HEAP32[$161 >> 2] + $tsize_220 | 0;
              var $_0 = _prepend_alloc($tbase_221, $151, $nb);
              var $_0;
              return $_0;
            }
          } while (0);
          _add_segment($tbase_221, $tsize_220);
        }
      } while (0);
      var $166 = HEAP32[__gm_ + 12 >> 2];
      if ($166 >>> 0 <= $nb >>> 0) {
        break;
      }
      var $169 = $166 - $nb | 0;
      HEAP32[__gm_ + 12 >> 2] = $169;
      var $170 = HEAP32[__gm_ + 24 >> 2];
      var $171 = $170;
      HEAP32[__gm_ + 24 >> 2] = $171 + $nb | 0;
      HEAP32[$nb + ($171 + 4) >> 2] = $169 | 1;
      HEAP32[$170 + 4 >> 2] = $nb | 3;
      var $_0 = $170 + 8 | 0;
      var $_0;
      return $_0;
    }
  } while (0);
  HEAP32[___errno() >> 2] = 12;
  var $_0 = 0;
  var $_0;
  return $_0;
}
_sys_alloc["X"] = 1;
function _release_unused_segments() {
  var $sp_01 = HEAP32[__gm_ + 452 >> 2];
  var $1 = ($sp_01 | 0) == 0;
  L2116 : do {
    if (!$1) {
      var $sp_02 = $sp_01;
      while (1) {
        var $sp_02;
        var $sp_0 = HEAP32[$sp_02 + 8 >> 2];
        if (($sp_0 | 0) == 0) {
          break L2116;
        } else {
          var $sp_02 = $sp_0;
        }
      }
    }
  } while (0);
  HEAP32[__gm_ + 32 >> 2] = -1;
  return;
}
function _sys_trim() {
  var $27$s2;
  if ((HEAP32[_mparams >> 2] | 0) == 0) {
    _init_mparams();
  }
  var $5 = HEAP32[__gm_ + 24 >> 2];
  if (($5 | 0) == 0) {
    return;
  }
  var $8 = HEAP32[__gm_ + 12 >> 2];
  do {
    if ($8 >>> 0 > 40) {
      var $11 = HEAP32[_mparams + 8 >> 2];
      var $16 = (Math.floor((($8 - 41 + $11 | 0) >>> 0) / ($11 >>> 0)) - 1) * $11 | 0;
      var $18 = _segment_holding($5);
      if ((HEAP32[$18 + 12 >> 2] & 8 | 0) != 0) {
        break;
      }
      var $24 = _sbrk(0);
      var $27$s2 = ($18 + 4 | 0) >> 2;
      if (($24 | 0) != (HEAP32[$18 >> 2] + HEAP32[$27$s2] | 0)) {
        break;
      }
      var $35 = _sbrk(-($16 >>> 0 > 2147483646 ? -2147483648 - $11 | 0 : $16) | 0);
      var $36 = _sbrk(0);
      if (!(($35 | 0) != -1 & $36 >>> 0 < $24 >>> 0)) {
        break;
      }
      var $42 = $24 - $36 | 0;
      if (($24 | 0) == ($36 | 0)) {
        break;
      }
      HEAP32[$27$s2] = HEAP32[$27$s2] - $42 | 0;
      HEAP32[__gm_ + 432 >> 2] = HEAP32[__gm_ + 432 >> 2] - $42 | 0;
      _init_top(HEAP32[__gm_ + 24 >> 2], HEAP32[__gm_ + 12 >> 2] - $42 | 0);
      return;
    }
  } while (0);
  if (HEAP32[__gm_ + 12 >> 2] >>> 0 <= HEAP32[__gm_ + 28 >> 2] >>> 0) {
    return;
  }
  HEAP32[__gm_ + 28 >> 2] = -1;
  return;
}
_sys_trim["X"] = 1;
function _free($mem) {
  var $R7_1$s2;
  var $177$s2;
  var $R_1$s2;
  var $p_0$s2;
  var $165$s2;
  var $_sum2$s2;
  var $14$s2;
  var $mem$s2 = $mem >> 2;
  var label;
  if (($mem | 0) == 0) {
    return;
  }
  var $3 = $mem - 8 | 0;
  var $4 = $3;
  var $5 = HEAP32[__gm_ + 16 >> 2];
  if ($3 >>> 0 < $5 >>> 0) {
    _abort();
  }
  var $10 = HEAP32[$mem - 4 >> 2];
  var $11 = $10 & 3;
  if (($11 | 0) == 1) {
    _abort();
  }
  var $14 = $10 & -8, $14$s2 = $14 >> 2;
  var $15 = $mem + ($14 - 8) | 0;
  var $16 = $15;
  var $18 = ($10 & 1 | 0) == 0;
  L2149 : do {
    if ($18) {
      var $21 = HEAP32[$3 >> 2];
      if (($11 | 0) == 0) {
        return;
      }
      var $_sum2 = -8 - $21 | 0, $_sum2$s2 = $_sum2 >> 2;
      var $24 = $mem + $_sum2 | 0;
      var $25 = $24;
      var $26 = $21 + $14 | 0;
      if ($24 >>> 0 < $5 >>> 0) {
        _abort();
      }
      if (($25 | 0) == (HEAP32[__gm_ + 20 >> 2] | 0)) {
        var $165$s2 = ($mem + ($14 - 4) | 0) >> 2;
        if ((HEAP32[$165$s2] & 3 | 0) != 3) {
          var $p_0 = $25, $p_0$s2 = $p_0 >> 2;
          var $psize_0 = $26;
          break;
        }
        HEAP32[__gm_ + 8 >> 2] = $26;
        HEAP32[$165$s2] = HEAP32[$165$s2] & -2;
        HEAP32[$_sum2$s2 + ($mem$s2 + 1)] = $26 | 1;
        HEAP32[$15 >> 2] = $26;
        return;
      }
      var $32 = $21 >>> 3;
      if ($21 >>> 0 < 256) {
        var $37 = HEAP32[$_sum2$s2 + ($mem$s2 + 2)];
        var $40 = HEAP32[$_sum2$s2 + ($mem$s2 + 3)];
        if (($37 | 0) == ($40 | 0)) {
          HEAP32[__gm_ >> 2] = HEAP32[__gm_ >> 2] & (1 << $32 ^ -1);
          var $p_0 = $25, $p_0$s2 = $p_0 >> 2;
          var $psize_0 = $26;
          break;
        }
        var $51 = (($21 >>> 2 & 1073741822) << 2) + __gm_ + 40 | 0;
        if (($37 | 0) != ($51 | 0) & $37 >>> 0 < $5 >>> 0) {
          _abort();
        }
        if (($40 | 0) == ($51 | 0) | $40 >>> 0 >= $5 >>> 0) {
          HEAP32[$37 + 12 >> 2] = $40;
          HEAP32[$40 + 8 >> 2] = $37;
          var $p_0 = $25, $p_0$s2 = $p_0 >> 2;
          var $psize_0 = $26;
          break;
        } else {
          _abort();
        }
      }
      var $62 = $24;
      var $65 = HEAP32[$_sum2$s2 + ($mem$s2 + 6)];
      var $68 = HEAP32[$_sum2$s2 + ($mem$s2 + 3)];
      var $69 = ($68 | 0) == ($62 | 0);
      L2174 : do {
        if ($69) {
          var $82 = $_sum2 + ($mem + 20) | 0;
          var $83 = HEAP32[$82 >> 2];
          do {
            if (($83 | 0) == 0) {
              var $87 = $_sum2 + ($mem + 16) | 0;
              var $88 = HEAP32[$87 >> 2];
              if (($88 | 0) == 0) {
                var $R_1 = 0, $R_1$s2 = $R_1 >> 2;
                break L2174;
              } else {
                var $RP_0 = $87;
                var $R_0 = $88;
                break;
              }
            } else {
              var $RP_0 = $82;
              var $R_0 = $83;
            }
          } while (0);
          while (1) {
            var $R_0;
            var $RP_0;
            var $90 = $R_0 + 20 | 0;
            var $91 = HEAP32[$90 >> 2];
            if (($91 | 0) != 0) {
              var $RP_0 = $90;
              var $R_0 = $91;
              continue;
            }
            var $94 = $R_0 + 16 | 0;
            var $95 = HEAP32[$94 >> 2];
            if (($95 | 0) == 0) {
              break;
            } else {
              var $RP_0 = $94;
              var $R_0 = $95;
            }
          }
          if ($RP_0 >>> 0 < $5 >>> 0) {
            _abort();
          } else {
            HEAP32[$RP_0 >> 2] = 0;
            var $R_1 = $R_0, $R_1$s2 = $R_1 >> 2;
            break;
          }
        } else {
          var $73 = HEAP32[$_sum2$s2 + ($mem$s2 + 2)];
          if ($73 >>> 0 < $5 >>> 0) {
            _abort();
          } else {
            HEAP32[$73 + 12 >> 2] = $68;
            HEAP32[$68 + 8 >> 2] = $73;
            var $R_1 = $68, $R_1$s2 = $R_1 >> 2;
            break;
          }
        }
      } while (0);
      var $R_1;
      if (($65 | 0) == 0) {
        var $p_0 = $25, $p_0$s2 = $p_0 >> 2;
        var $psize_0 = $26;
        break;
      }
      var $106 = $_sum2 + ($mem + 28) | 0;
      var $108 = (HEAP32[$106 >> 2] << 2) + __gm_ + 304 | 0;
      do {
        if (($62 | 0) == (HEAP32[$108 >> 2] | 0)) {
          HEAP32[$108 >> 2] = $R_1;
          if (($R_1 | 0) != 0) {
            break;
          }
          HEAP32[__gm_ + 4 >> 2] = HEAP32[__gm_ + 4 >> 2] & (1 << HEAP32[$106 >> 2] ^ -1);
          var $p_0 = $25, $p_0$s2 = $p_0 >> 2;
          var $psize_0 = $26;
          break L2149;
        } else {
          if ($65 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
            _abort();
          }
          var $122 = $65 + 16 | 0;
          if ((HEAP32[$122 >> 2] | 0) == ($62 | 0)) {
            HEAP32[$122 >> 2] = $R_1;
          } else {
            HEAP32[$65 + 20 >> 2] = $R_1;
          }
          if (($R_1 | 0) == 0) {
            var $p_0 = $25, $p_0$s2 = $p_0 >> 2;
            var $psize_0 = $26;
            break L2149;
          }
        }
      } while (0);
      if ($R_1 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
        _abort();
      }
      HEAP32[$R_1$s2 + 6] = $65;
      var $139 = HEAP32[$_sum2$s2 + ($mem$s2 + 4)];
      do {
        if (($139 | 0) != 0) {
          if ($139 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
            _abort();
          } else {
            HEAP32[$R_1$s2 + 4] = $139;
            HEAP32[$139 + 24 >> 2] = $R_1;
            break;
          }
        }
      } while (0);
      var $152 = HEAP32[$_sum2$s2 + ($mem$s2 + 5)];
      if (($152 | 0) == 0) {
        var $p_0 = $25, $p_0$s2 = $p_0 >> 2;
        var $psize_0 = $26;
        break;
      }
      if ($152 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
        _abort();
      } else {
        HEAP32[$R_1$s2 + 5] = $152;
        HEAP32[$152 + 24 >> 2] = $R_1;
        var $p_0 = $25, $p_0$s2 = $p_0 >> 2;
        var $psize_0 = $26;
        break;
      }
    } else {
      var $p_0 = $4, $p_0$s2 = $p_0 >> 2;
      var $psize_0 = $14;
    }
  } while (0);
  var $psize_0;
  var $p_0;
  var $177 = $p_0, $177$s2 = $177 >> 2;
  if ($177 >>> 0 >= $15 >>> 0) {
    _abort();
  }
  var $181 = $mem + ($14 - 4) | 0;
  var $182 = HEAP32[$181 >> 2];
  if (($182 & 1 | 0) == 0) {
    _abort();
  }
  do {
    if (($182 & 2 | 0) == 0) {
      if (($16 | 0) == (HEAP32[__gm_ + 24 >> 2] | 0)) {
        var $193 = HEAP32[__gm_ + 12 >> 2] + $psize_0 | 0;
        HEAP32[__gm_ + 12 >> 2] = $193;
        HEAP32[__gm_ + 24 >> 2] = $p_0;
        HEAP32[$p_0$s2 + 1] = $193 | 1;
        if (($p_0 | 0) == (HEAP32[__gm_ + 20 >> 2] | 0)) {
          HEAP32[__gm_ + 20 >> 2] = 0;
          HEAP32[__gm_ + 8 >> 2] = 0;
        }
        if ($193 >>> 0 <= HEAP32[__gm_ + 28 >> 2] >>> 0) {
          return;
        }
        _sys_trim();
        return;
      }
      if (($16 | 0) == (HEAP32[__gm_ + 20 >> 2] | 0)) {
        var $208 = HEAP32[__gm_ + 8 >> 2] + $psize_0 | 0;
        HEAP32[__gm_ + 8 >> 2] = $208;
        HEAP32[__gm_ + 20 >> 2] = $p_0;
        HEAP32[$p_0$s2 + 1] = $208 | 1;
        HEAP32[($208 >> 2) + $177$s2] = $208;
        return;
      }
      var $215 = ($182 & -8) + $psize_0 | 0;
      var $216 = $182 >>> 3;
      var $217 = $182 >>> 0 < 256;
      L2239 : do {
        if ($217) {
          var $221 = HEAP32[$mem$s2 + $14$s2];
          var $224 = HEAP32[(($14 | 4) >> 2) + $mem$s2];
          if (($221 | 0) == ($224 | 0)) {
            HEAP32[__gm_ >> 2] = HEAP32[__gm_ >> 2] & (1 << $216 ^ -1);
            break;
          }
          var $235 = (($182 >>> 2 & 1073741822) << 2) + __gm_ + 40 | 0;
          do {
            if (($221 | 0) != ($235 | 0)) {
              if ($221 >>> 0 >= HEAP32[__gm_ + 16 >> 2] >>> 0) {
                break;
              }
              _abort();
            }
          } while (0);
          do {
            if (($224 | 0) != ($235 | 0)) {
              if ($224 >>> 0 >= HEAP32[__gm_ + 16 >> 2] >>> 0) {
                break;
              }
              _abort();
            }
          } while (0);
          HEAP32[$221 + 12 >> 2] = $224;
          HEAP32[$224 + 8 >> 2] = $221;
        } else {
          var $250 = $15;
          var $253 = HEAP32[$14$s2 + ($mem$s2 + 4)];
          var $256 = HEAP32[(($14 | 4) >> 2) + $mem$s2];
          var $257 = ($256 | 0) == ($250 | 0);
          L2241 : do {
            if ($257) {
              var $271 = $14 + ($mem + 12) | 0;
              var $272 = HEAP32[$271 >> 2];
              do {
                if (($272 | 0) == 0) {
                  var $276 = $14 + ($mem + 8) | 0;
                  var $277 = HEAP32[$276 >> 2];
                  if (($277 | 0) == 0) {
                    var $R7_1 = 0, $R7_1$s2 = $R7_1 >> 2;
                    break L2241;
                  } else {
                    var $RP9_0 = $276;
                    var $R7_0 = $277;
                    break;
                  }
                } else {
                  var $RP9_0 = $271;
                  var $R7_0 = $272;
                }
              } while (0);
              while (1) {
                var $R7_0;
                var $RP9_0;
                var $279 = $R7_0 + 20 | 0;
                var $280 = HEAP32[$279 >> 2];
                if (($280 | 0) != 0) {
                  var $RP9_0 = $279;
                  var $R7_0 = $280;
                  continue;
                }
                var $283 = $R7_0 + 16 | 0;
                var $284 = HEAP32[$283 >> 2];
                if (($284 | 0) == 0) {
                  break;
                } else {
                  var $RP9_0 = $283;
                  var $R7_0 = $284;
                }
              }
              if ($RP9_0 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
                _abort();
              } else {
                HEAP32[$RP9_0 >> 2] = 0;
                var $R7_1 = $R7_0, $R7_1$s2 = $R7_1 >> 2;
                break;
              }
            } else {
              var $261 = HEAP32[$mem$s2 + $14$s2];
              if ($261 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
                _abort();
              } else {
                HEAP32[$261 + 12 >> 2] = $256;
                HEAP32[$256 + 8 >> 2] = $261;
                var $R7_1 = $256, $R7_1$s2 = $R7_1 >> 2;
                break;
              }
            }
          } while (0);
          var $R7_1;
          if (($253 | 0) == 0) {
            break;
          }
          var $296 = $14 + ($mem + 20) | 0;
          var $298 = (HEAP32[$296 >> 2] << 2) + __gm_ + 304 | 0;
          do {
            if (($250 | 0) == (HEAP32[$298 >> 2] | 0)) {
              HEAP32[$298 >> 2] = $R7_1;
              if (($R7_1 | 0) != 0) {
                break;
              }
              HEAP32[__gm_ + 4 >> 2] = HEAP32[__gm_ + 4 >> 2] & (1 << HEAP32[$296 >> 2] ^ -1);
              break L2239;
            } else {
              if ($253 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
                _abort();
              }
              var $312 = $253 + 16 | 0;
              if ((HEAP32[$312 >> 2] | 0) == ($250 | 0)) {
                HEAP32[$312 >> 2] = $R7_1;
              } else {
                HEAP32[$253 + 20 >> 2] = $R7_1;
              }
              if (($R7_1 | 0) == 0) {
                break L2239;
              }
            }
          } while (0);
          if ($R7_1 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
            _abort();
          }
          HEAP32[$R7_1$s2 + 6] = $253;
          var $329 = HEAP32[$14$s2 + ($mem$s2 + 2)];
          do {
            if (($329 | 0) != 0) {
              if ($329 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
                _abort();
              } else {
                HEAP32[$R7_1$s2 + 4] = $329;
                HEAP32[$329 + 24 >> 2] = $R7_1;
                break;
              }
            }
          } while (0);
          var $342 = HEAP32[$14$s2 + ($mem$s2 + 3)];
          if (($342 | 0) == 0) {
            break;
          }
          if ($342 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
            _abort();
          } else {
            HEAP32[$R7_1$s2 + 5] = $342;
            HEAP32[$342 + 24 >> 2] = $R7_1;
            break;
          }
        }
      } while (0);
      HEAP32[$p_0$s2 + 1] = $215 | 1;
      HEAP32[($215 >> 2) + $177$s2] = $215;
      if (($p_0 | 0) != (HEAP32[__gm_ + 20 >> 2] | 0)) {
        var $psize_1 = $215;
        break;
      }
      HEAP32[__gm_ + 8 >> 2] = $215;
      return;
    } else {
      HEAP32[$181 >> 2] = $182 & -2;
      HEAP32[$p_0$s2 + 1] = $psize_0 | 1;
      HEAP32[($psize_0 >> 2) + $177$s2] = $psize_0;
      var $psize_1 = $psize_0;
    }
  } while (0);
  var $psize_1;
  if ($psize_1 >>> 0 < 256) {
    var $372 = $psize_1 >>> 2 & 1073741822;
    var $374 = ($372 << 2) + __gm_ + 40 | 0;
    var $375 = HEAP32[__gm_ >> 2];
    var $376 = 1 << ($psize_1 >>> 3);
    do {
      if (($375 & $376 | 0) == 0) {
        HEAP32[__gm_ >> 2] = $375 | $376;
        var $F16_0 = $374;
        var $_pre_phi = ($372 + 2 << 2) + __gm_ + 40 | 0;
      } else {
        var $382 = ($372 + 2 << 2) + __gm_ + 40 | 0;
        var $383 = HEAP32[$382 >> 2];
        if ($383 >>> 0 >= HEAP32[__gm_ + 16 >> 2] >>> 0) {
          var $F16_0 = $383;
          var $_pre_phi = $382;
          break;
        }
        _abort();
      }
    } while (0);
    var $_pre_phi;
    var $F16_0;
    HEAP32[$_pre_phi >> 2] = $p_0;
    HEAP32[$F16_0 + 12 >> 2] = $p_0;
    HEAP32[$p_0$s2 + 2] = $F16_0;
    HEAP32[$p_0$s2 + 3] = $374;
    return;
  }
  var $393 = $p_0;
  var $394 = $psize_1 >>> 8;
  do {
    if (($394 | 0) == 0) {
      var $I18_0 = 0;
    } else {
      if ($psize_1 >>> 0 > 16777215) {
        var $I18_0 = 31;
        break;
      }
      var $401 = ($394 + 1048320 | 0) >>> 16 & 8;
      var $402 = $394 << $401;
      var $405 = ($402 + 520192 | 0) >>> 16 & 4;
      var $406 = $402 << $405;
      var $409 = ($406 + 245760 | 0) >>> 16 & 2;
      var $415 = 14 - ($405 | $401 | $409) + ($406 << $409 >>> 15) | 0;
      var $I18_0 = $psize_1 >>> (($415 + 7 | 0) >>> 0) & 1 | $415 << 1;
    }
  } while (0);
  var $I18_0;
  var $422 = ($I18_0 << 2) + __gm_ + 304 | 0;
  HEAP32[$p_0$s2 + 7] = $I18_0;
  HEAP32[$p_0$s2 + 5] = 0;
  HEAP32[$p_0$s2 + 4] = 0;
  var $426 = HEAP32[__gm_ + 4 >> 2];
  var $427 = 1 << $I18_0;
  do {
    if (($426 & $427 | 0) == 0) {
      HEAP32[__gm_ + 4 >> 2] = $426 | $427;
      HEAP32[$422 >> 2] = $393;
      HEAP32[$p_0$s2 + 6] = $422;
      HEAP32[$p_0$s2 + 3] = $p_0;
      HEAP32[$p_0$s2 + 2] = $p_0;
    } else {
      if (($I18_0 | 0) == 31) {
        var $442 = 0;
      } else {
        var $442 = 25 - ($I18_0 >>> 1) | 0;
      }
      var $442;
      var $K19_0 = $psize_1 << $442;
      var $T_0 = HEAP32[$422 >> 2];
      while (1) {
        var $T_0;
        var $K19_0;
        if ((HEAP32[$T_0 + 4 >> 2] & -8 | 0) == ($psize_1 | 0)) {
          break;
        }
        var $451 = ($K19_0 >>> 31 << 2) + $T_0 + 16 | 0;
        var $452 = HEAP32[$451 >> 2];
        if (($452 | 0) == 0) {
          label = 1728;
          break;
        }
        var $K19_0 = $K19_0 << 1;
        var $T_0 = $452;
      }
      if (label == 1728) {
        if ($451 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
          _abort();
        } else {
          HEAP32[$451 >> 2] = $393;
          HEAP32[$p_0$s2 + 6] = $T_0;
          HEAP32[$p_0$s2 + 3] = $p_0;
          HEAP32[$p_0$s2 + 2] = $p_0;
          break;
        }
      }
      var $466 = $T_0 + 8 | 0;
      var $467 = HEAP32[$466 >> 2];
      var $469 = HEAP32[__gm_ + 16 >> 2];
      if ($T_0 >>> 0 < $469 >>> 0) {
        _abort();
      }
      if ($467 >>> 0 < $469 >>> 0) {
        _abort();
      } else {
        HEAP32[$467 + 12 >> 2] = $393;
        HEAP32[$466 >> 2] = $393;
        HEAP32[$p_0$s2 + 2] = $467;
        HEAP32[$p_0$s2 + 3] = $T_0;
        HEAP32[$p_0$s2 + 6] = 0;
        break;
      }
    }
  } while (0);
  var $481 = HEAP32[__gm_ + 32 >> 2] - 1 | 0;
  HEAP32[__gm_ + 32 >> 2] = $481;
  if (($481 | 0) != 0) {
    return;
  }
  _release_unused_segments();
  return;
}
Module["_free"] = _free;
_free["X"] = 1;
function _segment_holding($addr) {
  var $sp_0$s2;
  var label;
  var $sp_0 = __gm_ + 444 | 0, $sp_0$s2 = $sp_0 >> 2;
  while (1) {
    var $sp_0;
    var $3 = HEAP32[$sp_0$s2];
    if ($3 >>> 0 <= $addr >>> 0) {
      if (($3 + HEAP32[$sp_0$s2 + 1] | 0) >>> 0 > $addr >>> 0) {
        var $_0 = $sp_0;
        label = 1766;
        break;
      }
    }
    var $12 = HEAP32[$sp_0$s2 + 2];
    if (($12 | 0) == 0) {
      var $_0 = 0;
      label = 1765;
      break;
    } else {
      var $sp_0 = $12, $sp_0$s2 = $sp_0 >> 2;
    }
  }
  if (label == 1765) {
    var $_0;
    return $_0;
  } else if (label == 1766) {
    var $_0;
    return $_0;
  }
}
function _init_top($p, $psize) {
  var $1 = $p;
  var $3 = $p + 8 | 0;
  if (($3 & 7 | 0) == 0) {
    var $10 = 0;
  } else {
    var $10 = -$3 & 7;
  }
  var $10;
  var $13 = $psize - $10 | 0;
  HEAP32[__gm_ + 24 >> 2] = $1 + $10 | 0;
  HEAP32[__gm_ + 12 >> 2] = $13;
  HEAP32[$10 + ($1 + 4) >> 2] = $13 | 1;
  HEAP32[$psize + ($1 + 4) >> 2] = 40;
  HEAP32[__gm_ + 28 >> 2] = HEAP32[_mparams + 16 >> 2];
  return;
}
function _init_bins() {
  var $i_02 = 0;
  while (1) {
    var $i_02;
    var $2 = $i_02 << 1;
    var $4 = ($2 << 2) + __gm_ + 40 | 0;
    HEAP32[__gm_ + ($2 + 3 << 2) + 40 >> 2] = $4;
    HEAP32[__gm_ + ($2 + 2 << 2) + 40 >> 2] = $4;
    var $7 = $i_02 + 1 | 0;
    if (($7 | 0) == 32) {
      break;
    } else {
      var $i_02 = $7;
    }
  }
  return;
}
function _init_mparams() {
  if ((HEAP32[_mparams >> 2] | 0) != 0) {
    return;
  }
  var $4 = _sysconf(8);
  if (($4 - 1 & $4 | 0) != 0) {
    _abort();
  }
  HEAP32[_mparams + 8 >> 2] = $4;
  HEAP32[_mparams + 4 >> 2] = $4;
  HEAP32[_mparams + 12 >> 2] = -1;
  HEAP32[_mparams + 16 >> 2] = 2097152;
  HEAP32[_mparams + 20 >> 2] = 0;
  HEAP32[__gm_ + 440 >> 2] = 0;
  var $12 = _time(0) & -16 ^ 1431655768;
  HEAP32[_mparams >> 2] = $12;
  return;
}
function _prepend_alloc($newbase, $oldbase, $nb) {
  var $R_1$s2;
  var $_sum$s2;
  var $19$s2;
  var $oldbase$s2 = $oldbase >> 2;
  var $newbase$s2 = $newbase >> 2;
  var label;
  var $2 = $newbase + 8 | 0;
  if (($2 & 7 | 0) == 0) {
    var $9 = 0;
  } else {
    var $9 = -$2 & 7;
  }
  var $9;
  var $12 = $oldbase + 8 | 0;
  if (($12 & 7 | 0) == 0) {
    var $19 = 0, $19$s2 = $19 >> 2;
  } else {
    var $19 = -$12 & 7, $19$s2 = $19 >> 2;
  }
  var $19;
  var $20 = $oldbase + $19 | 0;
  var $21 = $20;
  var $_sum = $9 + $nb | 0, $_sum$s2 = $_sum >> 2;
  var $25 = $newbase + $_sum | 0;
  var $26 = $25;
  var $27 = $20 - ($newbase + $9) - $nb | 0;
  HEAP32[($9 + 4 >> 2) + $newbase$s2] = $nb | 3;
  if (($21 | 0) == (HEAP32[__gm_ + 24 >> 2] | 0)) {
    var $35 = HEAP32[__gm_ + 12 >> 2] + $27 | 0;
    HEAP32[__gm_ + 12 >> 2] = $35;
    HEAP32[__gm_ + 24 >> 2] = $26;
    HEAP32[$_sum$s2 + ($newbase$s2 + 1)] = $35 | 1;
    var $_sum1819 = $9 | 8;
    var $335 = $newbase + $_sum1819 | 0;
    return $335;
  }
  if (($21 | 0) == (HEAP32[__gm_ + 20 >> 2] | 0)) {
    var $44 = HEAP32[__gm_ + 8 >> 2] + $27 | 0;
    HEAP32[__gm_ + 8 >> 2] = $44;
    HEAP32[__gm_ + 20 >> 2] = $26;
    HEAP32[$_sum$s2 + ($newbase$s2 + 1)] = $44 | 1;
    HEAP32[($44 >> 2) + $newbase$s2 + $_sum$s2] = $44;
    var $_sum1819 = $9 | 8;
    var $335 = $newbase + $_sum1819 | 0;
    return $335;
  }
  var $53 = HEAP32[$19$s2 + ($oldbase$s2 + 1)];
  if (($53 & 3 | 0) == 1) {
    var $57 = $53 & -8;
    var $58 = $53 >>> 3;
    var $59 = $53 >>> 0 < 256;
    L2382 : do {
      if ($59) {
        var $63 = HEAP32[(($19 | 8) >> 2) + $oldbase$s2];
        var $66 = HEAP32[$19$s2 + ($oldbase$s2 + 3)];
        if (($63 | 0) == ($66 | 0)) {
          HEAP32[__gm_ >> 2] = HEAP32[__gm_ >> 2] & (1 << $58 ^ -1);
          break;
        }
        var $77 = (($53 >>> 2 & 1073741822) << 2) + __gm_ + 40 | 0;
        do {
          if (($63 | 0) != ($77 | 0)) {
            if ($63 >>> 0 >= HEAP32[__gm_ + 16 >> 2] >>> 0) {
              break;
            }
            _abort();
          }
        } while (0);
        do {
          if (($66 | 0) != ($77 | 0)) {
            if ($66 >>> 0 >= HEAP32[__gm_ + 16 >> 2] >>> 0) {
              break;
            }
            _abort();
          }
        } while (0);
        HEAP32[$63 + 12 >> 2] = $66;
        HEAP32[$66 + 8 >> 2] = $63;
      } else {
        var $92 = $20;
        var $95 = HEAP32[(($19 | 24) >> 2) + $oldbase$s2];
        var $98 = HEAP32[$19$s2 + ($oldbase$s2 + 3)];
        var $99 = ($98 | 0) == ($92 | 0);
        L2384 : do {
          if ($99) {
            var $_sum67 = $19 | 16;
            var $113 = $_sum67 + ($oldbase + 4) | 0;
            var $114 = HEAP32[$113 >> 2];
            do {
              if (($114 | 0) == 0) {
                var $118 = $oldbase + $_sum67 | 0;
                var $119 = HEAP32[$118 >> 2];
                if (($119 | 0) == 0) {
                  var $R_1 = 0, $R_1$s2 = $R_1 >> 2;
                  break L2384;
                } else {
                  var $RP_0 = $118;
                  var $R_0 = $119;
                  break;
                }
              } else {
                var $RP_0 = $113;
                var $R_0 = $114;
              }
            } while (0);
            while (1) {
              var $R_0;
              var $RP_0;
              var $121 = $R_0 + 20 | 0;
              var $122 = HEAP32[$121 >> 2];
              if (($122 | 0) != 0) {
                var $RP_0 = $121;
                var $R_0 = $122;
                continue;
              }
              var $125 = $R_0 + 16 | 0;
              var $126 = HEAP32[$125 >> 2];
              if (($126 | 0) == 0) {
                break;
              } else {
                var $RP_0 = $125;
                var $R_0 = $126;
              }
            }
            if ($RP_0 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
              _abort();
            } else {
              HEAP32[$RP_0 >> 2] = 0;
              var $R_1 = $R_0, $R_1$s2 = $R_1 >> 2;
              break;
            }
          } else {
            var $103 = HEAP32[(($19 | 8) >> 2) + $oldbase$s2];
            if ($103 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
              _abort();
            } else {
              HEAP32[$103 + 12 >> 2] = $98;
              HEAP32[$98 + 8 >> 2] = $103;
              var $R_1 = $98, $R_1$s2 = $R_1 >> 2;
              break;
            }
          }
        } while (0);
        var $R_1;
        if (($95 | 0) == 0) {
          break;
        }
        var $138 = $19 + ($oldbase + 28) | 0;
        var $140 = (HEAP32[$138 >> 2] << 2) + __gm_ + 304 | 0;
        do {
          if (($92 | 0) == (HEAP32[$140 >> 2] | 0)) {
            HEAP32[$140 >> 2] = $R_1;
            if (($R_1 | 0) != 0) {
              break;
            }
            HEAP32[__gm_ + 4 >> 2] = HEAP32[__gm_ + 4 >> 2] & (1 << HEAP32[$138 >> 2] ^ -1);
            break L2382;
          } else {
            if ($95 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
              _abort();
            }
            var $154 = $95 + 16 | 0;
            if ((HEAP32[$154 >> 2] | 0) == ($92 | 0)) {
              HEAP32[$154 >> 2] = $R_1;
            } else {
              HEAP32[$95 + 20 >> 2] = $R_1;
            }
            if (($R_1 | 0) == 0) {
              break L2382;
            }
          }
        } while (0);
        if ($R_1 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
          _abort();
        }
        HEAP32[$R_1$s2 + 6] = $95;
        var $_sum3132 = $19 | 16;
        var $171 = HEAP32[($_sum3132 >> 2) + $oldbase$s2];
        do {
          if (($171 | 0) != 0) {
            if ($171 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
              _abort();
            } else {
              HEAP32[$R_1$s2 + 4] = $171;
              HEAP32[$171 + 24 >> 2] = $R_1;
              break;
            }
          }
        } while (0);
        var $184 = HEAP32[($_sum3132 + 4 >> 2) + $oldbase$s2];
        if (($184 | 0) == 0) {
          break;
        }
        if ($184 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
          _abort();
        } else {
          HEAP32[$R_1$s2 + 5] = $184;
          HEAP32[$184 + 24 >> 2] = $R_1;
          break;
        }
      }
    } while (0);
    var $oldfirst_0 = $oldbase + ($57 | $19) | 0;
    var $qsize_0 = $57 + $27 | 0;
  } else {
    var $oldfirst_0 = $21;
    var $qsize_0 = $27;
  }
  var $qsize_0;
  var $oldfirst_0;
  var $200 = $oldfirst_0 + 4 | 0;
  HEAP32[$200 >> 2] = HEAP32[$200 >> 2] & -2;
  HEAP32[$_sum$s2 + ($newbase$s2 + 1)] = $qsize_0 | 1;
  HEAP32[($qsize_0 >> 2) + $newbase$s2 + $_sum$s2] = $qsize_0;
  if ($qsize_0 >>> 0 < 256) {
    var $212 = $qsize_0 >>> 2 & 1073741822;
    var $214 = ($212 << 2) + __gm_ + 40 | 0;
    var $215 = HEAP32[__gm_ >> 2];
    var $216 = 1 << ($qsize_0 >>> 3);
    do {
      if (($215 & $216 | 0) == 0) {
        HEAP32[__gm_ >> 2] = $215 | $216;
        var $F4_0 = $214;
        var $_pre_phi = ($212 + 2 << 2) + __gm_ + 40 | 0;
      } else {
        var $222 = ($212 + 2 << 2) + __gm_ + 40 | 0;
        var $223 = HEAP32[$222 >> 2];
        if ($223 >>> 0 >= HEAP32[__gm_ + 16 >> 2] >>> 0) {
          var $F4_0 = $223;
          var $_pre_phi = $222;
          break;
        }
        _abort();
      }
    } while (0);
    var $_pre_phi;
    var $F4_0;
    HEAP32[$_pre_phi >> 2] = $26;
    HEAP32[$F4_0 + 12 >> 2] = $26;
    HEAP32[$_sum$s2 + ($newbase$s2 + 2)] = $F4_0;
    HEAP32[$_sum$s2 + ($newbase$s2 + 3)] = $214;
    var $_sum1819 = $9 | 8;
    var $335 = $newbase + $_sum1819 | 0;
    return $335;
  }
  var $235 = $25;
  var $236 = $qsize_0 >>> 8;
  do {
    if (($236 | 0) == 0) {
      var $I7_0 = 0;
    } else {
      if ($qsize_0 >>> 0 > 16777215) {
        var $I7_0 = 31;
        break;
      }
      var $243 = ($236 + 1048320 | 0) >>> 16 & 8;
      var $244 = $236 << $243;
      var $247 = ($244 + 520192 | 0) >>> 16 & 4;
      var $248 = $244 << $247;
      var $251 = ($248 + 245760 | 0) >>> 16 & 2;
      var $257 = 14 - ($247 | $243 | $251) + ($248 << $251 >>> 15) | 0;
      var $I7_0 = $qsize_0 >>> (($257 + 7 | 0) >>> 0) & 1 | $257 << 1;
    }
  } while (0);
  var $I7_0;
  var $264 = ($I7_0 << 2) + __gm_ + 304 | 0;
  HEAP32[$_sum$s2 + ($newbase$s2 + 7)] = $I7_0;
  HEAP32[$_sum$s2 + ($newbase$s2 + 5)] = 0;
  HEAP32[$_sum$s2 + ($newbase$s2 + 4)] = 0;
  var $271 = HEAP32[__gm_ + 4 >> 2];
  var $272 = 1 << $I7_0;
  if (($271 & $272 | 0) == 0) {
    HEAP32[__gm_ + 4 >> 2] = $271 | $272;
    HEAP32[$264 >> 2] = $235;
    HEAP32[$_sum$s2 + ($newbase$s2 + 6)] = $264;
    HEAP32[$_sum$s2 + ($newbase$s2 + 3)] = $235;
    HEAP32[$_sum$s2 + ($newbase$s2 + 2)] = $235;
    var $_sum1819 = $9 | 8;
    var $335 = $newbase + $_sum1819 | 0;
    return $335;
  }
  if (($I7_0 | 0) == 31) {
    var $291 = 0;
  } else {
    var $291 = 25 - ($I7_0 >>> 1) | 0;
  }
  var $291;
  var $K8_0 = $qsize_0 << $291;
  var $T_0 = HEAP32[$264 >> 2];
  while (1) {
    var $T_0;
    var $K8_0;
    if ((HEAP32[$T_0 + 4 >> 2] & -8 | 0) == ($qsize_0 | 0)) {
      break;
    }
    var $300 = ($K8_0 >>> 31 << 2) + $T_0 + 16 | 0;
    var $301 = HEAP32[$300 >> 2];
    if (($301 | 0) == 0) {
      label = 1847;
      break;
    }
    var $K8_0 = $K8_0 << 1;
    var $T_0 = $301;
  }
  if (label == 1847) {
    if ($300 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
      _abort();
    }
    HEAP32[$300 >> 2] = $235;
    HEAP32[$_sum$s2 + ($newbase$s2 + 6)] = $T_0;
    HEAP32[$_sum$s2 + ($newbase$s2 + 3)] = $235;
    HEAP32[$_sum$s2 + ($newbase$s2 + 2)] = $235;
    var $_sum1819 = $9 | 8;
    var $335 = $newbase + $_sum1819 | 0;
    return $335;
  }
  var $318 = $T_0 + 8 | 0;
  var $319 = HEAP32[$318 >> 2];
  var $321 = HEAP32[__gm_ + 16 >> 2];
  if ($T_0 >>> 0 < $321 >>> 0) {
    _abort();
  }
  if ($319 >>> 0 < $321 >>> 0) {
    _abort();
  }
  HEAP32[$319 + 12 >> 2] = $235;
  HEAP32[$318 >> 2] = $235;
  HEAP32[$_sum$s2 + ($newbase$s2 + 2)] = $319;
  HEAP32[$_sum$s2 + ($newbase$s2 + 3)] = $T_0;
  HEAP32[$_sum$s2 + ($newbase$s2 + 6)] = 0;
  var $_sum1819 = $9 | 8;
  var $335 = $newbase + $_sum1819 | 0;
  return $335;
}
_prepend_alloc["X"] = 1;
function _add_segment($tbase, $tsize) {
  var $23$s2;
  var $1$s2;
  var label;
  var $1 = HEAP32[__gm_ + 24 >> 2], $1$s2 = $1 >> 2;
  var $2 = $1;
  var $3 = _segment_holding($2);
  var $5 = HEAP32[$3 >> 2];
  var $7 = HEAP32[$3 + 4 >> 2];
  var $8 = $5 + $7 | 0;
  var $10 = $5 + ($7 - 39) | 0;
  if (($10 & 7 | 0) == 0) {
    var $17 = 0;
  } else {
    var $17 = -$10 & 7;
  }
  var $17;
  var $18 = $5 + ($7 - 47) + $17 | 0;
  var $22 = $18 >>> 0 < ($1 + 16 | 0) >>> 0 ? $2 : $18;
  var $23 = $22 + 8 | 0, $23$s2 = $23 >> 2;
  _init_top($tbase, $tsize - 40 | 0);
  HEAP32[$22 + 4 >> 2] = 27;
  HEAP32[$23$s2] = HEAP32[__gm_ + 444 >> 2];
  HEAP32[$23$s2 + 1] = HEAP32[__gm_ + 448 >> 2];
  HEAP32[$23$s2 + 2] = HEAP32[__gm_ + 452 >> 2];
  HEAP32[$23$s2 + 3] = HEAP32[__gm_ + 456 >> 2];
  HEAP32[__gm_ + 444 >> 2] = $tbase;
  HEAP32[__gm_ + 448 >> 2] = $tsize;
  HEAP32[__gm_ + 456 >> 2] = 0;
  HEAP32[__gm_ + 452 >> 2] = $23;
  var $30 = $22 + 28 | 0;
  HEAP32[$30 >> 2] = 7;
  var $32 = ($22 + 32 | 0) >>> 0 < $8 >>> 0;
  L2482 : do {
    if ($32) {
      var $33 = $30;
      while (1) {
        var $33;
        var $34 = $33 + 4 | 0;
        HEAP32[$34 >> 2] = 7;
        if (($33 + 8 | 0) >>> 0 < $8 >>> 0) {
          var $33 = $34;
        } else {
          break L2482;
        }
      }
    }
  } while (0);
  if (($22 | 0) == ($2 | 0)) {
    return;
  }
  var $42 = $22 - $1 | 0;
  var $45 = $42 + ($2 + 4) | 0;
  HEAP32[$45 >> 2] = HEAP32[$45 >> 2] & -2;
  HEAP32[$1$s2 + 1] = $42 | 1;
  HEAP32[$2 + $42 >> 2] = $42;
  if ($42 >>> 0 < 256) {
    var $55 = $42 >>> 2 & 1073741822;
    var $57 = ($55 << 2) + __gm_ + 40 | 0;
    var $58 = HEAP32[__gm_ >> 2];
    var $59 = 1 << ($42 >>> 3);
    do {
      if (($58 & $59 | 0) == 0) {
        HEAP32[__gm_ >> 2] = $58 | $59;
        var $F_0 = $57;
        var $_pre_phi = ($55 + 2 << 2) + __gm_ + 40 | 0;
      } else {
        var $65 = ($55 + 2 << 2) + __gm_ + 40 | 0;
        var $66 = HEAP32[$65 >> 2];
        if ($66 >>> 0 >= HEAP32[__gm_ + 16 >> 2] >>> 0) {
          var $F_0 = $66;
          var $_pre_phi = $65;
          break;
        }
        _abort();
      }
    } while (0);
    var $_pre_phi;
    var $F_0;
    HEAP32[$_pre_phi >> 2] = $1;
    HEAP32[$F_0 + 12 >> 2] = $1;
    HEAP32[$1$s2 + 2] = $F_0;
    HEAP32[$1$s2 + 3] = $57;
    return;
  }
  var $76 = $1;
  var $77 = $42 >>> 8;
  do {
    if (($77 | 0) == 0) {
      var $I1_0 = 0;
    } else {
      if ($42 >>> 0 > 16777215) {
        var $I1_0 = 31;
        break;
      }
      var $84 = ($77 + 1048320 | 0) >>> 16 & 8;
      var $85 = $77 << $84;
      var $88 = ($85 + 520192 | 0) >>> 16 & 4;
      var $89 = $85 << $88;
      var $92 = ($89 + 245760 | 0) >>> 16 & 2;
      var $98 = 14 - ($88 | $84 | $92) + ($89 << $92 >>> 15) | 0;
      var $I1_0 = $42 >>> (($98 + 7 | 0) >>> 0) & 1 | $98 << 1;
    }
  } while (0);
  var $I1_0;
  var $105 = ($I1_0 << 2) + __gm_ + 304 | 0;
  HEAP32[$1$s2 + 7] = $I1_0;
  HEAP32[$1$s2 + 5] = 0;
  HEAP32[$1$s2 + 4] = 0;
  var $109 = HEAP32[__gm_ + 4 >> 2];
  var $110 = 1 << $I1_0;
  if (($109 & $110 | 0) == 0) {
    HEAP32[__gm_ + 4 >> 2] = $109 | $110;
    HEAP32[$105 >> 2] = $76;
    HEAP32[$1$s2 + 6] = $105;
    HEAP32[$1$s2 + 3] = $1;
    HEAP32[$1$s2 + 2] = $1;
    return;
  }
  if (($I1_0 | 0) == 31) {
    var $125 = 0;
  } else {
    var $125 = 25 - ($I1_0 >>> 1) | 0;
  }
  var $125;
  var $K2_0 = $42 << $125;
  var $T_0 = HEAP32[$105 >> 2];
  while (1) {
    var $T_0;
    var $K2_0;
    if ((HEAP32[$T_0 + 4 >> 2] & -8 | 0) == ($42 | 0)) {
      break;
    }
    var $134 = ($K2_0 >>> 31 << 2) + $T_0 + 16 | 0;
    var $135 = HEAP32[$134 >> 2];
    if (($135 | 0) == 0) {
      label = 1887;
      break;
    }
    var $K2_0 = $K2_0 << 1;
    var $T_0 = $135;
  }
  if (label == 1887) {
    if ($134 >>> 0 < HEAP32[__gm_ + 16 >> 2] >>> 0) {
      _abort();
    }
    HEAP32[$134 >> 2] = $76;
    HEAP32[$1$s2 + 6] = $T_0;
    HEAP32[$1$s2 + 3] = $1;
    HEAP32[$1$s2 + 2] = $1;
    return;
  }
  var $149 = $T_0 + 8 | 0;
  var $150 = HEAP32[$149 >> 2];
  var $152 = HEAP32[__gm_ + 16 >> 2];
  if ($T_0 >>> 0 < $152 >>> 0) {
    _abort();
  }
  if ($150 >>> 0 < $152 >>> 0) {
    _abort();
  }
  HEAP32[$150 + 12 >> 2] = $76;
  HEAP32[$149 >> 2] = $76;
  HEAP32[$1$s2 + 2] = $150;
  HEAP32[$1$s2 + 3] = $T_0;
  HEAP32[$1$s2 + 6] = 0;
  return;
}



_add_segment["X"]=1;

// Note: For maximum-speed code, see "Optimizing Code" on the Emscripten wiki, https://github.com/kripken/emscripten/wiki/Optimizing-Code
// Note: Some Emscripten settings may limit the speed of the generated code.
// Warning: printing of i64 values may be slightly rounded! No deep i64 math used, so precise i64 code not included
var i64Math = null;

// === Auto-generated postamble setup entry stuff ===

Module.callMain = function callMain(args) {
  var argc = args.length+1;
  function pad() {
    for (var i = 0; i < 4-1; i++) {
      argv.push(0);
    }
  }
  var argv = [allocate(intArrayFromString("/bin/this.program"), 'i8', ALLOC_STATIC) ];
  pad();
  for (var i = 0; i < argc-1; i = i + 1) {
    argv.push(allocate(intArrayFromString(args[i]), 'i8', ALLOC_STATIC));
    pad();
  }
  argv.push(0);
  argv = allocate(argv, 'i32', ALLOC_STATIC);

  return _main(argc, argv, 0);
}


FUNCTION_TABLE = [0,0,_deflate_fast,0,_zcalloc,0,_deflate_slow,0,_deflate_stored,0,_zcfree,0]; Module["FUNCTION_TABLE"] = FUNCTION_TABLE;


function run(args) {
  args = args || Module['arguments'];

  if (runDependencies > 0) {
    Module.printErr('run() called, but dependencies remain, so not running');
    return 0;
  }

  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    var toRun = Module['preRun'];
    Module['preRun'] = [];
    for (var i = toRun.length-1; i >= 0; i--) {
      toRun[i]();
    }
    if (runDependencies > 0) {
      // a preRun added a dependency, run will be called later
      return 0;
    }
  }

  function doRun() {
    var ret = 0;
    calledRun = true;
    if (Module['_main']) {
      preMain();
      ret = Module.callMain(args);
      if (!Module['noExitRuntime']) {
        exitRuntime();
      }
    }
    if (Module['postRun']) {
      if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
      while (Module['postRun'].length > 0) {
        Module['postRun'].pop()();
      }
    }
    return ret;
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
    return 0;
  } else {
    return doRun();
  }
}
Module['run'] = Module.run = run;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

initRuntime();

var shouldRunNow = true;
if (Module['noInitialRun']) {
  shouldRunNow = false;
}

if (shouldRunNow) {
  var ret = run();
}

// {{POST_RUN_ADDITIONS}}






  // {{MODULE_ADDITIONS}}


// EMSCRIPTEN_GENERATED_FUNCTIONS: ["_sys_trim","_putShortMSB","_pqdownheap","_inflateInit2_","_main","_fixedtables88","_init_bins","_adler32","_build_bl_tree","_inflate","_copy_block","_crc32_little","_deflateEnd","_tmalloc_small","__tr_init","_inflate_table","_bi_reverse","_malloc","_deflate_stored","_deflateInit2_","_send_tree","_longest_match","_init_top","_free","_tmalloc_large","_deflate","_deflateResetKeep","_inf","_inflateReset2","_zcalloc","_init_block","_init_mparams","_inflateResetKeep","_deflateReset","_gen_bitlen","__tr_flush_block","_prepend_alloc","_def","_segment_holding","_send_all_trees","_detect_data_type","_deflate_rle","_deflate_slow","__tr_flush_bits","_deflate_fast","__tr_stored_block","_gen_codes","_deflate_huff","_zcfree","_sys_alloc","_bi_windup","_compress_block","__tr_align","_add_segment","_lm_init","_inflate_fast","_bi_flush","_inflateEnd","_zerr","_crc32","_scan_tree","_read_buf","_flush_pending","_release_unused_segments","_inflateReset","_fill_window","_updatewindow","_build_tree"]


