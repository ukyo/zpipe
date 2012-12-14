// monkey patchs
function _read(fildes, buf, nbyte) {
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
        bytesRead = Math.min(zInput.length - zInputOffset, nbyte);
        HEAPU8.set(zInput.subarray(zInputOffset, zInputOffset + bytesRead), buf);
        zInputOffset += bytesRead;
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
}

function _write(fildes, buf, nbyte) {
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
        if (nbyte === 0) return nbyte;
        zExpandOutput(nbyte);
        zOutput.set(HEAPU8.subarray(buf, buf + nbyte), zOutputOffset);
        zOutputOffset += nbyte;
        
        stream.object.timestamp = Date.now();
        return nbyte;
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
}


var zInput;
var zOutput = new Uint8Array(1);
var zInputOffset;
var zOutputOffset;


function zExpandOutput(expandWidth) {
  var n = zOutputOffset + expandWidth;
  var buffer;
  while (zOutput.length < n) {
    buffer = new Uint8Array(zOutput.length * 2);
    buffer.set(zOutput);
    zOutput = buffer;
  }
}

function zInit(input) {
  zInputOffset = 0;
  zOutputOffset = 0;
  zInput = zValidateInput(input);
  // reset eof and error flag of the stdio stream.
  FS.streams[1].eof = false;
  FS.streams[1].error = false;
}

function zExit() {
  zInput = null;
}

function zGetOutput(copy) {
  if (copy) {
    var buffer = new Uint8Array(zOutputOffset);
    buffer.set(zOutput.subarray(0, zOutputOffset));
    return buffer;
  }
  return zOutput.subarray(0, zOutputOffset);
}

function zDeflate(input, level, zlibHeader, copy) {
  zInit(input);

  level = typeof level === 'number' ? level : 6;
  level = Math.min(Math.max(level, 0), 9);
  zlibHeader = zlibHeader ? 1 : -1;

  zValidateOutput(_def_stdio(level, zlibHeader));
  zExit();
  return zGetOutput(copy);
}

function zInflate(input, zlibHeader, copy) {
  zInit(input);
  zlibHeader = zlibHeader ? 1 : -1;
  zValidateOutput(_inf_stdio(zlibHeader));
  zExit();
  return zGetOutput(copy);
}

function zValidateInput(input) {
  if (Array.isArray(input)) {
    input = new Uint8Array(input);
  }

  switch (input.constructor) {
    case Uint8Array: break;
    default:
      throw new Error('zpipe: input is not a byte array.');
  }

  if (input.length === 0) {
    throw new Error('zpipe: input length is 0');
  }

  return input;
}

function zValidateOutput(ret) {
  // see zlib.h
  var Z_ERRNO = -1;
  var Z_STREAM_ERROR = -2;
  var Z_DATA_ERROR = -3;
  var Z_MEM_ERROR = -4;
  var Z_VERSION_ERROR = -6;

  switch (ret) {
    case Z_ERRNO:
      if (_ferror(1)) throw new Error('zpipe: error reading stdin');
      if (_ferror(2)) throw new Error('zpipe: error writing stdout');
    case Z_STREAM_ERROR:
      throw new Error('zpipe: invalid compression level');
    case Z_DATA_ERROR:
      throw new Error('zpipe: invalid or incomplete deflate date');
    case Z_MEM_ERROR:
      throw new Error('zpipe: out of memory');
    case Z_VERSION_ERROR:
      throw new Error('zpipe: zlib version mismatch!');
  }
}

function zGC() {
  zInput = new Uint8Array(1);
}