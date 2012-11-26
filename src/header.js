var zpipe = {
  run: function(input, isInflate) {
    var i = -1;
    var j = -1;
    var output = new Uint8Array(1);
    var temp;
    var Module = {
      arguments: isInflate ? ['-d'] : [],
      stdin: function() {
        return ++i < input.length ? input[i] : null;
      },
      stdout: function(x) {
        if (x !== null) {
          if (++j < output.length) {
            temp = output;
            output = new Uint8Array(output.length * 2);
            output.set(temp);
          } else {
            output[j] = x;
          }
        }
      }
    };

