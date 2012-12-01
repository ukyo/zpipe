test('test zpipe.js', function() {
	ok(zpipe, 'zpipe is exported');
	ok(zpipe.deflate, 'zpipe.deflate is exported');
	ok(zpipe.inflate, 'zpipe.inflate is exported');
	ok(zpipe.gc, 'zpipe.gc is exported');

	var n = 50000;
	var bytes = new Uint8Array(n);
	for (var i = 0; i < n; ++i) bytes[i] = Math.floor(Math.random() * 255);

	for (var level = 0; level <= 9; ++level) {
		var def = zpipe.deflate(bytes, level);
		var inf = zpipe.inflate(def);
		equal(inf.length, bytes.length, 'byte lengths are same: compress level = ' + level);
		for (var i = 0; i < n; ++i) if (inf[i] !== bytes[i]) break;
		equal(i, n, 'all elements are same: compress level = ' + level);
	}

	for (var level = 0; level <= 9; ++level) {
		var def = zpipe.deflate(bytes, level, true);
		var inf = zpipe.inflate(def, true);
		equal(inf.length, bytes.length, 'byte lengths are same (add zlib header): compress level = ' + level);
		for (var i = 0; i < n; ++i) if (inf[i] !== bytes[i]) break;
		equal(i, n, 'all elements are same (add zlib header): compress level = ' + level);
	}
});

start();