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
    concat: {
      dist: {
        src: ['src/header.js', 'dist/zpipe.raw.js', 'src/zpipe.funcs.js', 'src/footer.js'],
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
        command: EMSCRIPTEN + 'emcc -O2 src/zpipe.c zlib/libz.a -o dist/zpipe.raw.js --closure 0 -s EXPORTED_FUNCTIONS="[\'_def_stdio\', \'_inf_stdio\']"',
        stdout: true
      },

      '_minify': {
        command: 'java -jar ' + CLOSURE + ' --compilation_level ADVANCED_OPTIMIZATIONS --js dist/zpipe.uglify.js --js_output_file dist/zpipe.min.js --output_wrapper ";(function(){%output%}).call(this);"'
      },

      'minify': {
        command: 'grunt exec:_minify --force'
      },

      'rm': {
        command: 'rm dist/zpipe.uglify.js'
      }
    },
    
    nodeunit: {
      all: ['test/test.js']
    },

    watch: {
      js: {
        files: ['<%= concat.dist.src %>'],
        tasks: ['concat', 'test']
      },

      c: {
        files: ['src/zpipe.c'],
        tasks: ['compile', 'concat', 'test']
      }
    },

    uglify: {
      compress: {
        src: 'dist/zpipe.js',
        dest: 'dist/zpipe.uglify.js'
      }
    }
  });

  grunt.loadNpmTasks('grunt-exec');
  grunt.loadNpmTasks('grunt-contrib-nodeunit');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-concat');

  grunt.registerTask('test', ['nodeunit']);
  grunt.registerTask('compile', ['exec:compile']);
  grunt.registerTask('minify', ['uglify', 'exec:minify', 'exec:rm']);
  grunt.registerTask('default', ['compile' ,'concat' ,'test' ,'minify']);
};