'use strict';

var pkg = require('../package.json');
var inquirer = require('inquirer');
var chalk = require('chalk');
var state = require('./state');
var request = require('request');

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

};

bro.commands.thanks = function (args) {
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