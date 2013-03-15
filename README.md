# Another ZPIPE

forked frome [richardassar/zpipe](https://github.com/richardassar/zpipe)

* Use TypedArray
* Optimize IO (patch _read, _write functions)

## Usage

Regular `<script>` include ...

``` html
<script type="text/javascript" src="zpipe.min.js"></script>

<script>
  // add zlib header
	var deflated = zpipe.deflate(byteArray, level, copy);
	var inflated = zpipe.inflate(deflated, copy);

  // compress only
  var rawDeflated = zpipe.rawDeflate(byteArray, level, copy);
  var rawInflated = zpipe.rawInflate(rawDeflated, copy);

  // gc
  zpipe.gc();
</script>
```

## Browser support

zpipe is supported in the following browsers:

* Internet Explorer 10+
* Google Chrome
* Mozilla Firefox
* Opera
* Safari

## Ready to Build

Clone this repository

```
git clone git://github.com/ukyo/zpipe.git
```

Install [emscripten](https://github.com/kripken/emscripten) and set the path to config.js.

Example:

```
module.exports = {
  EMSCRIPTEN: 'path/to/emscripten/'
};
```

Install grunt.

```
npm install -g grunt-cli
```

Install npm packages.

```
npm install
```

## How to Build

Full build

```
grunt
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

## Develop

Test

```
grunt test
```

Watch to update files (zpipe.c, header.js, zpipe.funcs.js, footer.js).

```
grunt watch
```