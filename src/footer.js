    return output.subarray(0, ++j);
  },

  deflate: function(input) {
    return this.run(input);
  },

  inflate: function (input) {
    return this.run(input, true);
  }
};