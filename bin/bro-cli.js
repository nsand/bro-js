#!/usr/bin/env node

'use strict';
var bro = require('../lib/bro');
var chalk = require('chalk');
var state = require('../lib/state');
var request = require('request');

var remaining = process.argv.slice(2);

if (remaining.length === 0) {
  console.log(chalk.red('Bro! Specify a command first!') + '\n\t* For example try ' + chalk.green('"bro curl"') + '\n\t* Use ' + chalk.yellow('"bro help"') + ' for more info');
}
else {
  var action = remaining[0];
  var action = bro.commands[action];
  if (typeof action === 'function') {
    action(remaining);
  }
  else {
    request.get(bro.URL + '/' + remaining.join('%20') + '.json', function(error, res, body) {
      if (error != null || res.statusCode === 404) {
        missingCommand(remaining.join(' '));
      }
      else {
        display(body);
      }
    });
  }
}


var display = function(data) {
  var list = JSON.parse(data);
  var separator = Array(process.stdout.columns - 5).join('.') + '\n';
  console.log(chalk.underline(list.length + ' entr' + (list.length == 1 ? 'y' : 'ies') + ' for ' + remaining) + chalk.yellow(' -- submit your own example with "bro add '+ remaining +'"'));
  var i = 0;
  var isDefault = true;

  // server argument for the command
  var cmd = remaining.join('%20');

  // the display string for the command
  var cmd_display = remaining.join(' ');

  state.reset();

  // write to ~/.bro file with last command
  var cmdObj = {};
  cmdObj['cmd'] = cmd_display;
  state.write(cmdObj);

  list.forEach(function(entry) {
    i++;

    var obj = {};
    obj[i] = entry['id'];
    state.write(obj);

    var body = entry.msg;
    body = body.replace(/^([^#]*)$/mg, function (match) { return chalk.magenta(match); });

    // Output the next example
    if (i > 1) {
      console.log(separator);
    }
    console.log(body + '\n\n');

    // Upvote / Downvote
    var upmsg = 'bro thanks';
    if (i > 1) upmsg += ' ' + i;
    var downmsg = 'bro ...no';
    if (i > 1) downmsg += ' ' + i;

    console.log('\t' + chalk.green(upmsg) +'\tto upvote (' + entry['up'] + ')\n\t' + chalk.red(downmsg) + '\tto downvote (' + entry['down'] + ')\n\n');
  });

};


var missingCommand = function(cmd) {
  console.log('The ' + chalk.yellow(cmd) + ' command isn\'t in our database.');
  console.log('\t* Typing '+chalk.underline.green('"bro add"') +' will let you add ' + chalk.yellow(cmd) + ' to our database!');
  console.log('\t* There\'s nothing to lose by typing ' + chalk.underline.red('"bro add"') + ', it will just launch an editor with instructions.');
  console.log('\t* Need help? Visit ' + chalk.underline('"http://bropages.org/help"'));
};