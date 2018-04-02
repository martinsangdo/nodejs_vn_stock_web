/**
 * author: Martin
 * modified: Nhan
 * @type {*}
 */
var express = require('express');
var Constant = require('../common/constant.js');

var Common = require('../common/common.js');
var common = new Common();

var global = require('../global.js');

module.exports = function (io) {

		io.on('connection', function (client) { // clients (Android/iOS/Web) connected to system automatically
				common.dlog('-- Socket connected -- ' + client.id);

		});
};
