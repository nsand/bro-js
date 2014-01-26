'use strict';

var fs = require('fs');
var bro = require('./bro');
var state = module.exports;


state.write = function (obj, overwrite) {
  var saved = state.read();
  if ((typeof overwrite === 'undefined') || !overwrite) {
    Object.getOwnPropertyNames(saved).forEach(function(k) {
      if ((typeof obj[k] === 'undefined') && (typeof saved[k] !== 'undefined')) {
        obj[k] = saved[k];
      }
    });
  }
  var contents = '';
  Object.getOwnPropertyNames(obj).forEach(function(k) {
    contents += (k + '=' + obj[k]) + ';';
  });

  fs.writeFileSync(bro.FILE, contents + '\n', {encoding: 'utf8'});
};

state.read = function() {
  var obj = {};

  if (fs.existsSync(bro.FILE)) {
    // Check the contents of the bro file for key-value pairs
    var contents = fs.readFileSync(bro.FILE, {encoding: 'utf8'});
    contents.trim().split(';').forEach(function (pair) {
      var chunk = pair.split('=');
      obj[chunk[0]] = chunk[1];
    });
  }
  return obj;
};

state.reset = function() {
  var obj = state.read();
  Object.getOwnPropertyNames(obj).forEach(function(k) {
    if (k.match(/^[\d+]/)) {
      delete obj[k];
    }
  });
  state.write(obj, true);
}