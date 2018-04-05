/**
 * author: Martin
 * @type {*}
 */
var express = require('express');
var Constant = require('../common/constant.js');

var Common = require('../common/common.js');
var common = new Common();

var global = require('../global.js');

module.exports = function (io) {
		io.on('connection', function (client) { // clients (Android/iOS/Web) connected to system automatically
				// common.dlog('-- Socket connected -- ' + (i++) + ': ' + client.id + " length: " + common.get_obj_len(io.sockets.sockets));
				common.dlog('-- Socket connected -- ' + client.id);
				client.emit('test', 'rrr');
				/**
				 * register into socket list after login or open app again
				 */
				client.on('join', function (options) { // add to Stream

				});
				/**
				 * close or logout app
				 */
				client.on('disconnect', function (options) {
						console.log('disconnect');
				});
				client.on('leave', function (options) {
						console.log('leave');
				});

				//========== ADDITIONAL FUNCTIONS
			});
};
