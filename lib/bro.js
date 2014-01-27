'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');

var pkg = require('../package.json');
var inquirer = require('inquirer');
var chalk = require('chalk');
var state = require('./state');
var request = require('request');
var editor = require('editor');

var bro = module.exports = {};

bro.URL = process.env['BROPAGES_URL'] || 'http://bropages.org';
bro.VERSION = (pkg && pkg.version) ? pkg.version : '';

function promptEmail (cb) {

  console.log(chalk.yellow('Bropages.org requires an email address verification to do this'));

  inquirer.prompt([{
    'name': 'email',
    'message': 'What\'s your email address?',
    'validate': function(input) {
      return !!input.match(/^[a-zA-Z0-9_.+\-]+@[a-zA-Z0-9\-]+\.[a-zA-Z0-9\-.]+$/);
    }
  }], function (answers) {
    request.post(bro.URL + '/users.json', {json: {user: {email : answers.email}}, multipart: true}, function(error, res, body) {
      if (error != null || res.statusCode !== 201) {
        console.log(chalk.yellow.bgRed('There was an error delivering to your email address. Please try again later'));
      }
      else {
        console.log(chalk.bold.green('Great! We\'re sending an email to ' + answers.email));
        var email = answers.email;
        inquirer.prompt([{
          'name': 'code',
          'message': 'Please enter the verification code:',
          'validate': function (input) {
            return input.trim().length > 0;
          }
        }], function (answers) {
          isInvalidCode(answers.code, email, function() {
            console.log(chalk.bold.green('Great! You\'re verified! FYI, your email and code are stored locally in ~/.bro'));
            state.write({'email': email, 'code': answers.code});
          }, function() {
            console.log(chalk.yellow.bgRed('Woops, there was a problem verifying your email. Please try again'));
          });
        });
      }
    });
  });
};

function isInvalidCode (code, email, success, failure) {
  if ((typeof code !== 'undefined') && (typeof email !== undefined)) {
    request.get(bro.URL + '/users/verify?code='+code+'&email='+email, function(error, res, body) {
      if (error != null || res.statusCode === 404) {
        failure();
      }
      else {
        success();
      }
    });
  }
  else {
    failure();
  }
};

/* Uses the system editor to prompt the user for some input, the contents of the editor are returned
 * in the callback function
 */
function promptEditor(prompt, cb) {
  var tmp = path.join(os.tmpDir(), Date.now() + '.bro');
  fs.writeFile(tmp, prompt, function(err) {
    if (err) {
      cb(err);
    }
    else {
      editor(tmp, function (code) {
        if (code) {
          cb(new Error('Editor didn\t close normally'));
        }
        else {
          fs.readFile(tmp, {encoding: 'utf8'}, function (err, data) {
            if (err) {
              cb(err);
            }
            else {
              fs.unlink(tmp, function (err) {
                cb(null, data);
              });
            }
          })
        }
      });
    }
  });
};

bro.checkEmail = function(success) {
  var brostate = state.read();
  // Check if the code and email matches up
  isInvalidCode(brostate['code'], brostate['email'], success, function() {
    // A proper code and email pair is needed
    promptEmail();
  });
};

bro.commands = {};

bro.commands.add = function (args) {
  bro.checkEmail(function() {
    var cmd = state.getArgOrLastCommand(args.splice(1));
    if (cmd === null || cmd.trim().length === 0) {
      console.log('\nYou must enter a command after '+chalk.yellow('bro add') +'.\n\nFor example: '+chalk.bold.green('bro add')+' '+chalk.underline('curl')+'\n\n');
    }
    else {
      var promptText = '#~ Bro entry for command \''+cmd+'\'\n' +
          '#~ Provide a useful example for how to use \''+cmd+'\'\n' +
          '#~ Comments starting with #~ are removed\n' +
          '#~\n'+
          '#~ Example for command \'man\':\n'+
          '#~ # Opens up the manual page for the command \'ls\'\n'+
          '#~ man ls\n' +
          '\n\n' +
          '# your_comment_here\n' +
          'your_command_here';
      promptEditor(promptText, function(err, contents) {
        if (!err) {
          if (contents.replace(promptText, '').trim().length > 0) {
            inquirer.prompt([{
              'name': 'submit',
              'message': 'Submit this entry for '+ cmd +'?',
              'type': 'confirm',
              'default': true
            }], function (answers) {
              if (answers.submit) {
                console.log(chalk.yellow('All right, sending your entry...'));
                var brostate = state.read();
                var file = 'stupid';

                request.post(bro.URL + '/', {json: {email: brostate['email'], code: brostate['code'], entry: { cmd: cmd, msg: contents}}, multipart: true}, function(error, res, body) {
                  if (error !== null || res.statusCode !== 201) {
                    console.log(chalk.yellow.bgRed.bold('Woops. There was an error! Your entry was saved to ' + file));
                  }
                  else {
                    console.log(chalk.green.bold('Successfully submitted.'));
                  }
                });
              }
              else {
                console.log(chalk.yellow('Canceled. Did not submit entry for \''+ cmd +'\''));
              }
            });
          }
          else {
            console.log(chalk.yellow('Canceled. Did not submit entry for \''+ cmd +'\''));
          }
        }
      });
    }
  });
};
bro.commands.add.summary = 'Add an entry, bro';

bro.commands.lookup = function(args) {
  if (args[0] === 'lookup') args.shift();
  request.get(bro.URL + '/' + args.join('%20') + '.json', function(error, res, body) {
    if (error != null || res.statusCode === 404) {
      missingCommand(args.join(' '));
    }
    else {
      display(body, args);
    }
  });
};

bro.commands.lookup.summary = 'Lookup an entry, bro. Or just call bro [COMMAND]';

bro.commands.thanks = function (args) {
  bro.commands.thanks.prototype.summary = ' Upvote an entry, bro ';
  bro.checkEmail(function() {
    // Check the email
    var brostate = state.read();
    var cmd = brostate['cmd'];
    if (typeof cmd === 'undefined') {
      console.log(chalk.bold.red("\nYou must first look up a command before thanking. For example: bro curl\n\n"));
      return;
    }

    var idkey = args[1];
    if (typeof idkey === 'undefined') {
      idkey = '1';
    }
    var id = brostate[idkey];

    if (typeof id === 'undefined') {
      console.log(chalk.bold.red('That id ('+ idkey +') does not exist for '+ cmd +', try another one'));
    }
    else {
      // Make thanks request
      request.get(bro.URL + '/thanks/' + id + '?email=' + brostate['email'] + '&code=' + brostate['code'], function(error, res, body) {
        if (error != null || res.statusCode === 404) {
          // error
          console.log(chalk.yellow.bgRed.bold('There was a problem thanking the '+ cmd +' entry. This entry may not exist or bropages.org may be down'))
        }
        else {
          // success
          console.log(chalk.yellow('"You just gave thanks to an entry for '+ cmd +'!'));
          console.log(chalk.bold.green('You rock!'));
        }
      });
    }
  });
};
bro.commands.thanks.summary = 'Upvote an entry, bro';

bro.commands['...no'] = bro.commands.no = function (args) {
  bro.checkEmail(function() {
    // Check the email
    var brostate = state.read();
    var cmd = brostate['cmd'];
    if (typeof cmd === 'undefined') {
      console.log(chalk.bold.red("\nYou must first look up a command before downvoting. For example: bro curl\n\n"));
      return;
    }

    var idkey = args[1];
    if (typeof idkey === 'undefined') {
      idkey = '1';
    }
    var id = brostate[idkey];

    if (typeof id === 'undefined') {
      console.log(chalk.bold.red('That id ('+ idkey +') does not exist for '+ cmd +', try another one'));
    }
    else {
      // Make thanks request
      request.get(bro.URL + '/no/' + id + '?email=' + brostate['email'] + '&code=' + brostate['code'], function(error, res, body) {
        if (error != null || res.statusCode === 404) {
          // error
          console.log(chalk.yellow.bgRed.bold('There was a problem downvoting the '+ cmd +' entry. This entry may not exist or bropages.org may be down'))
        }
        else {
          // success
          console.log(chalk.yellow('"You just downvoted an entry for '+ cmd +'!'));
          console.log(chalk.bold.green('You rock!'));
        }
      });
    }
  });
};
bro.commands['...no'].summary = 'Downvote an entry, bro';

bro.commands['help'] = function() {
  console.log('NAME:\n');
  console.log('\tbro\n');
  console.log('DESCRIPTION:\n');
  console.log('\tHighly readable supplement to man pages.\n\n\tShows simple, concise examples for commands.\n');
  console.log('COMMANDS:\n');
  var keys = Object.keys(bro.commands).sort();
  keys.forEach(function (key) {
    console.log('\t' + key + '\t\t' + bro.commands[key].summary);
  });
};
bro.commands['help'].summary = 'Display global or [command] help documentation.';

/* Support functions */

/* Display the bro page for the provided command */
var display = function(data, remaining) {
  var list = JSON.parse(data);
  var separator = Array(process.stdout.columns - 5).join('.') + '\n';

  // the display string for the command
  var cmd_display = remaining.join(' ');

  console.log(chalk.underline(list.length + ' entr' + (list.length == 1 ? 'y' : 'ies') + ' for ' + cmd_display) + chalk.yellow(' -- submit your own example with "bro add '+ cmd_display +'"'));

  var i = 0;
  var isDefault = true;

  // server argument for the command
  var cmd = remaining.join('%20');

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

/* Output information about how to add missing commands to the bro page listing */
var missingCommand = function(cmd) {
  console.log('The ' + chalk.yellow(cmd) + ' command isn\'t in our database.');
  console.log('\t* Typing '+chalk.underline.green('"bro add"') +' will let you add ' + chalk.yellow(cmd) + ' to our database!');
  console.log('\t* There\'s nothing to lose by typing ' + chalk.underline.red('"bro add"') + ', it will just launch an editor with instructions.');
  console.log('\t* Need help? Visit ' + chalk.underline('"http://bropages.org/help"'));
};
