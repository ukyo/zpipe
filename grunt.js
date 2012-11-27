var EMSCRIPTEN;

try {
  EMSCRIPTEN = require('./config').EMSCRIPTEN;
} catch (e) {
  EMSCRIPTEN = '~/emscripten/';
}

var CLOSURE = EMSCRIPTEN + 'third_party/closure-compiler/compiler.jar';
var JS_FILES = ['src/header.js', 'dist/zpipe.raw.js', 'src/footer.js'];

module.exports = function(grunt) {
  grunt.initConfig({
    meta: {},

    concat: {
      dist: {
        src: JS_FILES,
        dest: 'dist/zpipe.js'
      }
    },
    
    exec: {
      'zlib-init': {
        command: 'cd zlib && ' + EMSCRIPTEN + 'emconfigure ./configure && make',
        stdout: true
      },

      'zlib-clean': {
        command: 'cd zlib && make clean',
        stdout: true
      },

      'compile': {
        command: EMSCRIPTEN + 'emcc -O2 src/zpipe.c zlib/libz.a -o dist/zpipe.raw.js --closure 0',
        stdout: true
      },

      'minify': {
        command: 'java -jar ' + CLOSURE + ' --compilation_level ADVANCED_OPTIMIZATIONS --js dist/zpipe.js --js_output_file dist/zpipe.min.js',
        stdout: true
      }
    },
    
    // PhantomJS does not support Float64Array. See in the browser.
    qunit: {
      all: ['test/*.html']
    },

    watch: {
      js: {
        files: JS_FILES,
        task: 'concat'
      }
    }
  });

  grunt.loadNpmTasks('grunt-exec');

  grunt.registerTask('default', 'exec:compile concat exec:minify');
};