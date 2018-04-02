/**
 * common functions are served PUSH notification
 * author: Martin 2017
 */
//
var http = require('http');
var config = require('../config/setting')();
var Constant = require('../common/constant.js');
var Common = require('../common/common.js');
var common = new Common();

process.setMaxListeners(0);

//begin class

function PushNotif(){}
/**
 * compose data package of Firebase Push based on Android
 * @param: jsd: json data
 */
PushNotif.prototype.composeFirebaseDataPackage = function(arr_token, click_action, jsd, title, content){
	if (common.isEmpty(arr_token) || common.isEmpty(click_action)){
		return {};      //do nothing
	}
	var result = {
			registration_ids: arr_token,	//one or multiple devices
			priority: 'high'        //send immediately
	};
    result['data'] = {
        jsd: common.isNotEmpty(jsd)?jsd:'{}',       //json data
        click_action: click_action,
        body: content,     //message to receive in title
        badge: '1',
        title: title,
        sound: ''
    };
	return result;
};
//send push notification to device(s)
PushNotif.prototype.sendPushNotification_Firebase = function(data, server_key, callback) {
	if (common.isEmpty(server_key))
		server_key = config['firebase_server_key'];

	if (server_key.indexOf('key=') != 0)
		server_key = 'key='+server_key; //Firebase requires "key=xxx"

	var options = {
		    host: 'fcm.googleapis.com',
		    path: '/fcm/send',
		    method: 'POST',
		    headers: {
		      'Content-Type': 'application/json', 		//'application/x-www-form-urlencoded',
		      'Content-Length': Buffer.byteLength(data),
		      'Authorization' : server_key
		    },
		    agent: false		//20170324: disable connection polling which caused DNS not found
	};
	var httpreq = http.request(options, function (response) {
        response.setEncoding(Constant.UTF_8);
        response.on('data', function (chunk) {
            // common.xlog('sent Push', chunk);
            // {"multicast_id":6088317343383889337,"success":1,"failure":0,"canonical_ids":0,"results":[{"message_id":"0:1499849408576082%03259149f9fd7ecd"}]}
            //after sending
            if (callback)
                callback(chunk);
        });
        response.on('error', function(e){
            console.log(e);
            callback(null);
        });
        response.on('end', function () {		//finish
            // common.xlog('finish sending Push');
            // {"multicast_id":9094626980120865624,"success":0,"failure":1,"canonical_ids":0,"results":[{"error":"InvalidRegistration"}]}
            //do nothing
        });
	});
	httpreq.write(data);
	httpreq.end();
};
/**
 * send notification to receiver in chat
 */
PushNotif.prototype.send_push_new_message = function(tokens, str_json_data, title, content) {
    var token_arr_len = tokens.length;
    var page_num, offset, token_patch;
    if (token_arr_len > 0){     //
        if (token_arr_len <= Constant.MAX_TOKEN_NUM){
            var data_package = pushNotif.composeFirebaseDataPackage(tokens, Constant.PUSH_CATEGORY.MESSAGE, str_json_data, title, content);
            pushNotif.sendPushNotification_Firebase(JSON.stringify(data_package));
        } else {
            //paging tokens, because Firebase allows to push max 1000 devices at once
            page_num = Math.ceil(token_arr_len / Constant.MAX_TOKEN_NUM);
            for (var i=0; i<page_num; i++){
                offset = i * Constant.MAX_TOKEN_NUM;
                token_patch = new Array();
                for (var j=offset; j<offset+Constant.MAX_TOKEN_NUM; j++){
                    if (!common.isEmpty(token_arr[j])){
                        token_patch.push(token_arr[j]);
                    } else {
                        break;		//finish data
                    }
                }
                var data_package = pushNotif.composeFirebaseDataPackage(token_patch, Constant.PUSH_CATEGORY.MESSAGE, str_json_data, title, content);
                pushNotif.sendPushNotification_Firebase(JSON.stringify(data_package));
            }
        }
    }
};
/**
 * send Push in general purpose
 * @param tokens
 * @param str_json_data
 * @param content
 */
PushNotif.prototype.send_push_basic = function(tokens, category, str_json_data, title, content) {
    var token_arr_len = tokens.length;
    var page_num, offset, token_patch;
    if (token_arr_len > 0){     //
        if (token_arr_len <= Constant.MAX_TOKEN_NUM){
            var data_package = pushNotif.composeFirebaseDataPackage(tokens, category, str_json_data, title, content);
            pushNotif.sendPushNotification_Firebase(JSON.stringify(data_package));
        } else {
            //paging tokens, because Firebase allows to push max 1000 devices at once
            page_num = Math.ceil(token_arr_len / Constant.MAX_TOKEN_NUM);
            for (var i=0; i<page_num; i++){
                offset = i * Constant.MAX_TOKEN_NUM;
                token_patch = new Array();
                for (var j=offset; j<offset+Constant.MAX_TOKEN_NUM; j++){
                    if (!common.isEmpty(token_arr[j])){
                        token_patch.push(token_arr[j]);
                    } else {
                        break;		//finish data
                    }
                }
                var data_package = pushNotif.composeFirebaseDataPackage(token_patch, category, str_json_data, title, content);
                pushNotif.sendPushNotification_Firebase(JSON.stringify(data_package));
            }
        }
    }
};
/**
 * send push after creation new post
 * @param tokens
 * @param str_json_data
 * @param content
 */
PushNotif.prototype.send_push_new_created_post = function(tokens, str_json_data, title, content) {
    pushNotif.send_push_basic(tokens, Constant.PUSH_CATEGORY.CREATED_NEW_RECORD, str_json_data, title, content);
};
/**
 * send push after creation new comment
 * @param tokens
 * @param str_json_data
 * @param content
 */
PushNotif.prototype.send_push_new_created_comment = function(tokens, str_json_data, title, content) {
    pushNotif.send_push_basic(tokens, Constant.PUSH_CATEGORY.CREATED_NEW_COMMENT, str_json_data, title, content);
};
//========== global variable
var pushNotif = new PushNotif();

module.exports = PushNotif;