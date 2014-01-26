#!/usr/bin/env node

'use strict';
var bro = require('../lib/bro');
var chalk = require('chalk');

var remaining = process.argv.slice(2);

if (remaining.length === 0) {
  console.log(chalk.red('Bro! Specify a command first!') + '\n\t* For example try ' + chalk.green('"bro curl"') + '\n\t* Use ' + chalk.yellow('"bro help"') + ' for more info');
}
else {
  var action = remaining[0];
  var action = bro.commands[action] || bro.commands.lookup;
  if (typeof action === 'function') {
    action(remaining);
  }
}
