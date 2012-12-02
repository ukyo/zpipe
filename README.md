# Z'PIPE!

zpipe is **not** a pipe.

!["Ceci n'est pas une pipe"](http://upload.wikimedia.org/wikipedia/en/thumb/b/b9/MagrittePipe.jpg/300px-MagrittePipe.jpg "Ceci n'est pas une pipe")

>The famous pipe. How people reproached me for it! And yet, could you stuff my pipe? No, it's just a representation, is it not? So if I had written on my picture "This is a pipe," I'd have been lying!

## About

zpipe exposes an interface to the [DEFLATE](http://www.ietf.org/rfc/rfc1951.txt) algorithm of the [ZLib](http://zlib.net/) compression library, it has been cross-compiled to JavaScript with [Emscripten](https://github.com/kripken/emscripten).

## Motivation

* Currently no compression API exposed in browsers
* Help users suffering from poor upload bandwidth

## Usage

Regular `<script>` include ...

``` html
<script type="text/javascript" src="zpipe.min.js"></script>

<script>
	var deflated = zpipe.deflate(byteArray, level, zlibHeader, copy);

	var inflated = zpipe.inflate(deflated, zlibHeader, copy);
</script>
```

## Browser support

zpipe is supported in the following browsers:

* Internet Explorer 10+
* Google Chrome
* Mozilla Firefox
* Opera
* Safari

## Build

Install [emscripten](https://github.com/kripken/emscripten) and set the path to config.js.

Example([config.js.sample](https://github.com/ukyo/zpipe/config.js.sample)):

```
module.exports = {
  EMSCRIPTEN: 'path/to/emscripten/'
};
```

Install grunt.

```
npm install -g grunt
```

Initialize zlib (already inialized).

```
grunt exec:zlib-init
```

Compile the zpipe.c

```
grunt compile
```

Concat header.js, compiled file(zpipe.raw.js) and footer.js.

```
grunt concat
```

Minify concated file with UglifyJS and Closure Compiler.

```
grunt minify
```

Full build

```
grunt
```

## Develop

Test

```
grunt test
```

Watch update files (zpipe.c, header.js, zpipe.funcs.js, footer.js).

```
grunt watch
```