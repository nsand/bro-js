'use strict';

var pkg = require('../package.json');

var bro = module.exports = {};

bro.URL = process.env['BROPAGES_URL'] || 'http://bropages.org';
bro.FILE = process.env['HOME'] + '/.bro';
bro.VERSION = (pkg && pkg.version) ? pkg.version : '';
