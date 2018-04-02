/**
 * author: Martin
 * common functions are served in controllers & models
 */
var Constant = require('./constant.js');
var config = require('../config/setting')();
var trim = require('trim');
var MongoClient = require('mongodb').MongoClient;
var mongoose = require('mongoose');
var global = require('../global.js');

//begin class

function Common() {
}

//=========
Common.prototype.xlog = function (mess, data) {
    if (console.log) {
        console.log(mess, data);
    }
};

Common.prototype.dlog = function (mess) {
    if (console.log) {
        console.log(mess);
    }
};

Common.prototype.isNull = function (a_var) {
    return a_var == null || a_var === undefined;
};

Common.prototype.trim = function (a_var) {
    if (a_var === undefined || a_var == null){
        return a_var;
    }
    if (typeof a_var == "string"){
        return trim(a_var);
    }
    return a_var;
};

Common.prototype.dlogJSON = function (mess) {
    if (!common.isEmpty(mess))		//avoid IE
        console.log(JSON.stringify(mess));
};
//used for string only
Common.prototype.isEmpty = function (a_var) {
    if (a_var === undefined || a_var == null || common.trim(a_var) == '')
        return true;
    return false;
};

Common.prototype.isStrictEmpty = function (a_var) {
    if (a_var == 'undefined' || a_var == 'null' || a_var === undefined || a_var == null || common.trim(a_var) == '')
        return true;
    return false;
};
//used for String only
Common.prototype.isNotEmpty = function (a_var) {
    return !common.isEmpty(a_var);
};

Common.prototype.isArray = function (something) {
    return Object.prototype.toString.call(something) === '[object Array]';
};

Common.prototype.get_obj_len = function (obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

/**
 * check token of requests from client, prevent hacking
 * @param req
 * @param user_id
 */
Common.prototype.checkLLOGToken = function (req, res, next) {
    // var token = req.headers[Constant.LLOG_ACCESS_TOKEN_KEY];
    // if (token == config.llog_token){
    //client sent valid request
    next();     //continue;
    // } else {
    //     res.rest.forbidden();       //invalid request, returns error to client
    // }
};
/**
 * save id of logined user
 * @param req
 * @param user_id
 * @param db_id: Database id
 */
Common.prototype.saveSessionLogin = function (req, db_id, user_id) {
    req.session[db_id] = db_id;
    req.session[Constant.SESSION.KEY_USER_ID] = user_id;
    req.session.save();
};
/**
 * remove session after logout
 * @param req
 */
Common.prototype.removeSessionLogin = function (req, db_id) {
    req.session[db_id] = '';
    // req.session[Constant.SESSION.KEY_USER_ID] = '';      //don't need it in case same db for LLOG & system server
    req.session.save();
};
/**
 * check if user logined or not
 * @param req
 */
Common.prototype.isNotLogined = function (req, db_id) {
    // return false;        //for testing
    // common.dlog('sess db: '+req.session[db_id]);
    // common.dlog('sess id: ' + req.session[Constant.SESSION.KEY_USER_ID]);
    return !common.isNotEmpty(req.session[db_id]) ||
        !common.isNotEmpty(req.session[Constant.SESSION.KEY_USER_ID]) ||
        req.session[db_id] != db_id;
};
/**
 * get id of logined user
 * @param req
 * @returns {*}
 */
Common.prototype.getLoginedUserId = function (req) {
    return req.session[Constant.SESSION.KEY_USER_ID];
};
/**
 * check if a & b is XOR empty (one of both is empty)
 */
Common.prototype.isXorEmpty = function (a, b) {
    return (common.isEmpty(a) && common.isNotEmpty(b)) || (common.isEmpty(b) && common.isNotEmpty(a));
};
/**
 * check whether connect to DB server or not
 * @param link
 * @param db_name
 * @param username
 * @param password
 * @param callback
 */
Common.prototype.tryConnectDB = function (username, password, link, db_name, callback) {
    var mongo_link = '';
    if (common.isNotEmpty(username) && common.isNotEmpty(password)) {
        mongo_link = username + ':' + password + '@';
    }
    mongo_link += config.local_mongo_server + '/' + db_name;
    //serve for external server DB
    MongoClient.connect('mongodb://' + mongo_link, function (err, db) {
        // common.dlog(err);
        if (common.isNotEmpty(err)) {
            callback(Constant.FAILED_CODE);
        } else {
            //create sample collection inside db
            // var collection = db.collection(db_name);
            // collection.insert([{a:1, b:1}], {w:1}, function(err, result) {
            // });
            callback(Constant.OK_CODE);
        }
    });
};
//keep connections of each system dbs
Common.prototype.getSystemDatabaseConnection = function (dbServerAddress, dbName, dbUsername, dbPassword, res) {
    var db_info = {
        addr: dbServerAddress,
        name: dbName,
        username: dbUsername,
        pass: dbPassword
    };
    var db_info_key = JSON.stringify(db_info);      //to prevent any info is changed
    if (global.system_db_server_connection[db_info_key]) {
        //database connection already exist. Return connection object
        return global.system_db_server_connection[db_info_key];
    } else {
        var account = '';
        if (common.isNotEmpty(dbUsername) && common.isNotEmpty(dbPassword)) {
            account = dbUsername + ':' + dbPassword + '@';
        }
        //serve for external server DB
        // global.system_db_server_connection[db_info_key] = mongoose.createConnection('mongodb://'+account+dbServerAddress+'/' + dbName, {useMongoClient: true});
        global.system_db_server_connection[db_info_key] = mongoose.createConnection('mongodb://' + account + config.local_mongo_server + '/' + dbName, {useMongoClient: true});

        global.system_db_server_connection[db_info_key].on('error', function (err) {
            //cannot connect db
            if (res) {
                res.rest.badRequest({
                    message: Constant.SERVER_ERR
                });
            }
        });       //to prevent crash if db info is unauthenticated
        return global.system_db_server_connection[db_info_key];
    }
};

/**
 * catch system db is down
 */
Common.prototype.removeArrayItem = function (arr, item) {
    for (var i = arr.length; i--;) {
        if (arr[i] === item) {
            arr.splice(i, 1);
        }
    }
};

/**
 * catch system db is down
 */
Common.prototype.on_system_db_fail = function (abc) {
    common.dlog(abc);
};
/**
 * connect to specific DB & get DB model
 * @param req
 * @param scheme_obj
 * @param collection_name
 * @param callback
 */
Common.prototype.getSystemModel = function (req, scheme_obj, collection_name, res) {
    var system_db_address = req.headers[Constant.HEADER_PARAM.DB_ADDR];
    var system_db_name = req.headers[Constant.HEADER_PARAM.DB_NAME];
    var system_db_username = req.headers[Constant.HEADER_PARAM.DB_USERNAME];
    var system_db_password = req.headers[Constant.HEADER_PARAM.DB_PASSWORD];

    if (common.isEmpty(system_db_name) || common.isEmpty(system_db_address)) {
        return {
            result: Constant.FAILED_CODE,
            message: Constant.SYSTEM_ADDRESS_NOT_FOUND
        };
    }

    var system_db_conn = common.getSystemDatabaseConnection(system_db_address, system_db_name, system_db_username, system_db_password, res);
    // common.dlog(system_db_conn['_readyState']); 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    if (system_db_conn.models[collection_name]) {
        //model existed
        var db_model = system_db_conn.model(collection_name);
    } else {
        var schema = new mongoose.Schema(scheme_obj, {collection: collection_name});
        var db_model = system_db_conn.model(collection_name, schema);
    }
    return {
        result: Constant.OK_CODE,
        db_model: db_model
    };
};
/**
 *
 * @param req
 * @param scheme_obj
 * @param collection_name
 * @param res
 * @returns {*}
 */
Common.prototype.getSystemModelFromSysInfo = function (system_db_address, system_db_name, system_db_username, system_db_password, scheme_obj, collection_name, res) {
    if (common.isEmpty(system_db_name) || common.isEmpty(system_db_address)) {
        return {
            result: Constant.FAILED_CODE,
            message: Constant.SYSTEM_ADDRESS_NOT_FOUND
        };
    }

    var system_db_conn = common.getSystemDatabaseConnection(system_db_address, system_db_name, system_db_username, system_db_password, res);
    // common.dlog(system_db_conn['_readyState']); 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    if (system_db_conn.models[collection_name]) {
        //model existed
        var db_model = system_db_conn.model(collection_name);
    } else {
        var schema = new mongoose.Schema(scheme_obj, {collection: collection_name});
        var db_model = system_db_conn.model(collection_name, schema);
    }
    return {
        result: Constant.OK_CODE,
        db_model: db_model
    };
};
/**
 * @param req
 * @param scheme_obj
 * @param collection_name
 * @param res
 * @returns {*}
 */
Common.prototype.getSystemModelFromSocket = function (system_db_address, system_db_name, system_db_username, system_db_password, scheme_obj, collection_name) {
    if (common.isEmpty(system_db_name) || common.isEmpty(system_db_address)) {
        return {
            result: Constant.FAILED_CODE,
            message: Constant.SYSTEM_ADDRESS_NOT_FOUND
        };
    }
    var system_db_conn = common.getSystemDatabaseConnection(system_db_address, system_db_name, system_db_username, system_db_password, null);
    if (system_db_conn.models[collection_name]) {
        //model existed
        var db_model = system_db_conn.model(collection_name);
    } else {
        var schema = new mongoose.Schema(scheme_obj, {collection: collection_name});
        var db_model = system_db_conn.model(collection_name, schema);
    }
    return {
        result: Constant.OK_CODE,
        db_model: db_model
    };
};
/**
 * send emit to client
 *  find all sockes of receiver (by user id), then emit data to those
 * @param action_key
 * @param toUserIds
 * @param resp_data
 * @returns {*}
 */
Common.prototype.emit_to_clients = function (action_key, toUserIds, resp_data) {
    for (var i = 0; i < toUserIds.length; i++) {
        var user_id = toUserIds[i];
        if (common.isNotEmpty(global.online_sockets[user_id])) {
            for (var j = 0; j < global.online_sockets[user_id].length; j++) {
                var socket_id = global.online_sockets[user_id][j];
                if (global.io.sockets.connected[socket_id]) {
                    global.io.sockets.connected[socket_id].emit(action_key, resp_data);
                }
            }
        }
    }
};

/**
 * send emit to client
 *  find all sockes of receiver (by user id), then emit data to those
 * @param action_key
 * @param toUserIds
 * @param resp_data
 * @returns {*}
 */
Common.prototype.get_offline_user = function (toUserIds) {
    var clone = toUserIds.slice();
    for (var i = 0; i < toUserIds.length; i++) {
        var user_id = toUserIds[i];
        if (common.isNotEmpty(global.online_sockets[user_id])) {
            for (var j = 0; j < global.online_sockets[user_id].length; j++) {
                var socket_id = global.online_sockets[user_id][j];
                if (global.io.sockets.connected[socket_id]) {
                    //remove user out of list
                    common.removeArrayItem(clone, user_id);
                    break;
                }
            }
        }
    }
    return clone;
};
//
Common.prototype.convert_obj_to_array = function(obj) {
    var arr_results = new Array();
    if (obj != null){
        Object.keys(obj).forEach(function(key){
            arr_results.push(obj[key]);
        });
    }
    return arr_results;
};
//convert object to array & return back to client
Common.prototype.reform_notif_response_format = function(res, obj_results){
    var arr_results = common.convert_obj_to_array(obj_results);
    res.rest.success({
        data: {list: arr_results}
    });
};
//merge both arrays of existed files & new files, key is fname (filename)
Common.prototype.merge_update_attach_array = function(existed_array, new_array, is_merge_media){
    var final_array = [];
    var new_array_len = new_array.length;
    var existed_array_len = existed_array.length;
    //check then update cloud id if file existed
    if (existed_array_len == 0){
        //there was no saved files
        if (new_array_len > 0){
            return new_array;
        }
    } else {
        //there was some saved files
        if (new_array_len > 0){
            var new_media_info;
            for (var i=0; i<new_array_len; i++){
                new_media_info = new_array[i];
                if (is_merge_media){
                    //merge image/video, require full info: org_size, thumb_size, fname, extension
                    if (common.isNotEmpty(new_media_info['org_size']) && common.isNotEmpty(new_media_info['thumb_size']) &&
                        common.isNotEmpty(new_media_info['fname']) && common.isNotEmpty(new_media_info['ext'])){
                        //search if existed array contained object with same fname?
                        for (var j=0; j<existed_array_len; j++){
                            if (existed_array[j]['fname'] == new_media_info['fname']){
                                existed_array[j] = new_media_info;      //update it
                            }
                        }
                    }
                } else {
                    //merge normal file, require full info: org_size, fname, extension
                    if (common.isNotEmpty(new_media_info['org_size']) &&
                        common.isNotEmpty(new_media_info['fname']) && common.isNotEmpty(new_media_info['ext'])){
                        //search if existed array contained object with same fname?
                        for (var j=0; j<existed_array_len; j++){
                            if (existed_array[j]['fname'] == new_media_info['fname']){
                                existed_array[j] = new_media_info;      //update it
                            }
                        }
                    }
                }
            }
            return existed_array;
        }
    }
    return final_array;
};
//remove duplicated item in array
Common.prototype.remove_duplicate_array_item = function(arr) {
    var obj = {};
    var len = arr.length;
    for (var i=0; i<len; i++){
        if (common.isEmpty(obj[arr[i]])){
            obj[arr[i]] = arr[i];
        }
    }
    return common.convert_obj_to_array(obj);
};
//========== global variable
var common = new Common();

module.exports = Common;