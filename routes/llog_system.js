/**
 * author: Martin
 * @type {*}
 */
var express = require('express');
var router = express.Router();
var User = require('../models/llog/User.js');
var System = require('../models/llog/System.js');
var UserSystem = require('../models/llog/UserSystem.js');
var NotificationLLOG = require('../models/llog/NotificationLLOG.js');
var ReadNotificationLLOG = require('../models/llog/ReadNotificationLLOG.js');

var Constant = require('../common/constant.js');
var Common = require('../common/common.js');
var common = new Common();

/**
 * create a new system, anyone can do it
 */
router.put('/create_new', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, Constant.SESSION.LLOG_DB_ID)){
        res.rest.unauthorized();
        return;
    }
    //required params
    var system_name = common.trim(req.body[Constant.PARAM.NAME]);
    var db_server_link = common.trim(req.body[Constant.PARAM.DB_SERVER_LINK]);
    var db_id_name = common.trim(req.body[Constant.PARAM.DB_ID_NAME]);
    var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);      //owner of this system

    //
    if (common.isEmpty(system_name) || common.isEmpty(db_server_link) || common.isEmpty(db_id_name) || common.isEmpty(user_id)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS       //missing parameter
        });
        return;
    }
    var existed_condition = {       //condition to verify whether system was existed in db or not
        db_server_link: db_server_link,
        db_id_name: db_id_name,
        user_id: {$ne: null}
    };
    var system = new System();
    //check if user existed in collection System
    system.search_by_condition(existed_condition, {limit:1, skip:0}, '_id', {}, function(result){
        if (result.result == Constant.OK_CODE){
            //check whether request has some information
            if (result.data.length > 0 && common.isNotEmpty(result.data[0]['_id'])){
                //found 1 system, do not allow to create new one
                res.rest.badRequest({
                    message: Constant.EXISTED
                });
            } else {
                create_new_system_document(req, res, db_server_link, db_id_name, user_id, system_name);
            }
        } else {
            //db error
            res.rest.serverError();
        }
    });
});
/**
 * create new document in collection System & UserSystem
 * @param req
 * @param res
 * @param db_server_link
 * @param db_id_name
 * @param user_id
 */
function create_new_system_document(req, res, db_server_link, db_id_name, user_id, system_name){
    var db_username = common.trim(req.body[Constant.PARAM.DB_USERNAME]);
    var db_password = common.trim(req.body[Constant.PARAM.DB_PASSWORD]);

    var update_data = {     //this info will be updated to collection System
        name: system_name,
        plain_name: system_name.toLowerCase(),
        db_server_link: db_server_link,
        db_id_name: db_id_name,
        user_id: user_id,           //onwer id
        member_num  : 1     //include system owner
    };
    var about = common.trim(req.body[Constant.PARAM.ABOUT]);
    if (common.isNotEmpty(about)){
        update_data['about'] = about;
    }
    if (common.isNotEmpty(db_username)){
        update_data['db_username'] = db_username;
    }
    if (common.isNotEmpty(db_password)){
        update_data['db_password'] = db_password;
    }
    //insert new system
    var system = new System();
    system.create(update_data, function(res_sys_create){
        if (res_sys_create.result == Constant.OK_CODE){     //created new document in collection System
            common.dlog("========== [LLOG] created system: " + db_id_name);
            //now create new document in collection UserSystem, to indicate owner is one of member of that system
            create_new_doc_in_user_system(res_sys_create['_id'], user_id, '', function(res_code){
                if (res_code == Constant.OK_CODE){
                    //send back result to client
                    res.rest.success({
                        data: {
                            system_id: res_sys_create['_id']      //new created system id
                        }
                    });
                } else if (res_code == Constant.FAILED_CODE){
                    res.rest.serverError();
                } else {
                    res.rest.badRequest({
                        message: res_code
                    });
                }
            });
        } else if (common.isNotEmpty(res_sys_create.err) && common.isNotEmpty(res_sys_create.err.errors) &&
                    common.isNotEmpty(res_sys_create.err.errors['user_id']) && res_sys_create.err.errors['user_id']['name'] == Constant.CAST_ERROR &&
                    (res_sys_create.err.errors['user_id']['kind'] == Constant.ObjectID || res_sys_create.err.errors['user_id']['kind'] == Constant.ObjectId)) {
            //user id not existed
            res.rest.badRequest({
                message: Constant.USER_NOT_FOUND
            });
        } else {
            res.rest.serverError();
        }
    });
}
/**
 * create new document in collection UserSystem
 * @param system_id
 * @param user_id
 * @param join_type
 * @param callback: create ok or not
 */
function create_new_doc_in_user_system(system_id, user_id, join_type, callback){
    if (common.isEmpty(system_id) || common.isEmpty(user_id)){
        callback(Constant.MISMATCH_PARAMS);     //missing parameters
        return;
    }
    var existed_condition = data = {
        system_id: system_id,
        user_id: user_id
    };
    var userSystem = new UserSystem();
    userSystem.search_by_condition(existed_condition, {limit: 1, skip:0}, '_id join_type', '', function(resp_search){
        if (resp_search.result == Constant.OK_CODE){
            if (common.isNotEmpty(join_type)) {
                data['join_type'] = join_type;
            }
            if (common.isNotEmpty(resp_search.data[0]) && common.isNotEmpty(resp_search.data[0]['_id'])){
                //found one
                if (resp_search.data[0]['join_type'] != join_type) {
                    //update it
                    data['update_time'] = new Date();
                    userSystem.update({_id: resp_search.data[0]['id']}, data, function (resp_update) {
                        if (resp_update.result == Constant.OK_CODE) {
                            callback(Constant.OK_CODE);
                        } else {
                            callback(Constant.FAILED_CODE);
                        }
                    });
                } else {
                    callback(Constant.OK_CODE);     //same, not update anything
                }
            } else {
                //insert new document
                userSystem.create(data, function(resp_create){
                    if (resp_create.result == Constant.OK_CODE){
                        callback(Constant.OK_CODE);
                    } else {
                        callback(Constant.FAILED_CODE);
                    }
                });
            }
        } else {
            callback(Constant.FAILED_CODE);
        }
    });
}
/**
 * increase / decrease member number in collection System
 * @param system_id
 * @param change_factor
 */
function change_member_num(system_id, change_factor, callback){
    var system = new System();
    system.update({_id: system_id}, {$inc: {member_num: change_factor}}, function(response){
        callback(response);
    });
}
/**
 * search system by condition (allow search all), check profile_visibility too
 * case insensitive
 */
router.post('/search_by_condition', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, Constant.SESSION.LLOG_DB_ID)){
        res.rest.unauthorized();
        return;
    }
    var name = common.trim(req.body[Constant.PARAM.NAME]);
    var query_condition = {            //default search all
        profile_visibility: true,
        user_id: {$ne: null}
    };
    if (common.isNotEmpty(name)) {
        query_condition['name'] = {'$regex' : name, '$options' : 'i'};      //case insensitive
    }
    var paging = {
        limit:  common.isNotEmpty(common.trim(req.body[Constant.PARAM.LENGTH])) && common.trim(req.body[Constant.PARAM.LENGTH])>0?parseInt(common.trim(req.body[Constant.PARAM.LENGTH])):Constant.DEFAULT_PAGE_LENGTH, //Constant.DEFAULT_PAGE_LENGTH,
        skip:   common.isNotEmpty(common.trim(req.body[Constant.PARAM.OFFSET])) && common.trim(req.body[Constant.PARAM.OFFSET])>0?parseInt(common.trim(req.body[Constant.PARAM.OFFSET])):0
    };
    var sort = {
        plain_name: 1, name: 1
    };
    var system = new System();
    system.search_by_condition(query_condition, paging, '', sort, function (res_search) {
        if (res_search.result == Constant.OK_CODE) {
            var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);
            var sys_num = res_search.data.length;
            if (common.isNotEmpty(user_id) && sys_num > 0){
                var count = 0;
                var userSystem = new UserSystem();
                var final_result = {};
                for (var i=0; i<sys_num; i++){
                    final_result[res_search.data[i]['_id']] = res_search.data[i];
                    userSystem.search_by_condition({user_id: user_id, system_id: res_search.data[i]['_id']}, {limit:1, skip:0}, 'join_type system_id', '', function(res_us_search){
                        if (res_us_search.result == Constant.OK_CODE &&
                            common.isNotEmpty(res_us_search.data[0]) && common.isNotEmpty(res_us_search.data[0]['join_type'])){
                            final_result[res_us_search.data[0]['system_id']]['join_type'] = res_us_search.data[0]['join_type'];
                        } else {
                            //skip it
                        }
                        count++;
                        if (count == sys_num){      //got result of all queries
                            var final_list = [];
                            //reform output results
                            for (var key in final_result){
                                final_list.push(final_result[key]);
                            }
                            res.rest.success({
                                data: {list: final_list}
                            });
                        }
                    });
                }
            } else {
                res.rest.success({
                    data: {list: res_search.data}
                });
            }
        } else {
            res.rest.serverError();
        }
    });
});
/**
 * get info of system to show in Profile page
 */
router.post('/get_info_by_id', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, Constant.SESSION.LLOG_DB_ID)){
        res.rest.unauthorized();
        return;
    }
    var system_id = common.trim(req.body[Constant.PARAM.SYSTEM_ID]);
    var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);

    if (common.isEmpty(user_id) || common.isEmpty(system_id)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS       //missing parameter
        });
        return;
    }
    var query_condition = {            //default search all
        _id: system_id
    };
    var system = new System();
    system.search_by_condition(query_condition, {limit:1, skip:0}, '', {}, function (resp_sys_info) {
        if (resp_sys_info.result == Constant.OK_CODE && resp_sys_info.data.length > 0) {
            var userSystem = new UserSystem();
            var final_response = {      //final response back to app
                detail: resp_sys_info.data[0].toObject()
            };
            //search relationship between user & system
            userSystem.search_by_condition({user_id: user_id, system_id: system_id}, {limit:1, skip:0}, 'join_type system_id', '', function(res_us_search){
                if (res_us_search.result == Constant.OK_CODE &&
                    common.isNotEmpty(res_us_search.data[0]) && common.isNotEmpty(res_us_search.data[0]['join_type'])){
                    final_response['rel'] = {join_type: res_us_search.data[0]['join_type']};
                } else {
                    //skip it
                }
                res.rest.success({
                    data: final_response
                });
            });
        } else {
            res.rest.badRequest({
                message: Constant.NOT_FOUND
            });
        }
    });

});
/**
 * search systems which I created or joined
 */
router.post('/search_my_joined_systems', common.checkLLOGToken, function(req, res) {
    var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);
    if (common.isEmpty(user_id)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    var query_condition = {            //default search all
        'user_id': user_id,
        '$or': [{join_type: Constant.JOIN_TYPE.NONE}, {join_type: Constant.JOIN_TYPE.ACCEPTED}]
    };
    var userSystem = new UserSystem();
    userSystem.search_my_joined_systems(query_condition, '', {'system_id.name': 1, 'system_id.plain_name': 1}, function(res_us_search){
        if (res_us_search.result == Constant.OK_CODE){
            for (var i=res_us_search.data.length - 1; i>=0; i--){
                if (common.isEmpty(res_us_search.data[i]['system_id'])){
                    res_us_search.data.splice(i, 1);     //remove empty item
                }
            }
            res.rest.success({
                data: {list: res_us_search.data}
            });
        } else {
            res.rest.serverError();
        }
    });
});
/**
 * update some info of system
 */
router.put('/update_system_info', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, Constant.SESSION.LLOG_DB_ID)){
        res.rest.unauthorized();
        return;
    }
    //required params
    var system_id = common.trim(req.body[Constant.PARAM.SYSTEM_ID]);
    //
    if (common.isEmpty(system_id)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    var existed_condition = {
        _id: system_id,
        user_id: {$ne: null}
    };     //if email existed in collection User, not insert any longer
    var system = new System();
    //check if system existed
    system.search_by_condition(existed_condition, {limit:1, skip:0}, '_id user_id', {}, function(result){
        if (result.result == Constant.OK_CODE){
            var update_data = {     //this info will be updated to collection System
            };
            //check whether request has some information
            if (common.isNotEmpty(req.body[Constant.PARAM.AVATAR_ORG_SIZE_ID]) && common.isNotEmpty(req.body[Constant.PARAM.AVATAR_THUMB_SIZE_ID])){
                update_data['cloud_avatar_id'] = {
                    org_size: common.trim(req.body[Constant.PARAM.AVATAR_ORG_SIZE_ID]),
                    thumb_size: common.trim(req.body[Constant.PARAM.AVATAR_THUMB_SIZE_ID])
                };
            }
            if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.NAME]))){
                update_data['name'] = common.trim(req.body[Constant.PARAM.NAME]);
                update_data['plain_name'] = common.trim(req.body[Constant.PARAM.NAME]).toLowerCase();
            }
            if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.ABOUT]))){
                update_data['about'] = common.trim(req.body[Constant.PARAM.ABOUT]);
            }
            if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.CLOUD_ID]))){
                update_data['cloud_id'] = common.trim(req.body[Constant.PARAM.CLOUD_ID]);
            }
            if (result.data.length > 0 && common.isNotEmpty(result.data[0]['_id'])){
                //found 1 system, update it
                if (common.get_obj_len(update_data) > 0){       //has something to update
                    update_data['update_time'] = new Date();
                    system.update(existed_condition, update_data, function(res_update){
                        if (res_update.result == Constant.OK_CODE){
                            common.dlog('Updated system info successfully, system id: ' + system_id);
                            res.rest.success();
                        } else {
                            res.rest.serverError();
                        }
                    });
                } else {
                    res.rest.success();
                }
            } else {
                //system not found
                res.rest.badRequest({
                    message: Constant.NOT_FOUND
                });
            }
        } else if (result.name == Constant.CAST_ERROR && (result.kind == Constant.ObjectID || result.kind == Constant.ObjectId)) {
            //user not found
            res.rest.badRequest({
                message: Constant.NOT_FOUND
            });
        } else {
            //db error
            res.rest.serverError();
        }
    });
});
/**
 * user requests to join a system
 */
router.put('/request_join_system', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, Constant.SESSION.LLOG_DB_ID)){
        res.rest.unauthorized();
        return;
    }
    //required params
    var user_id = common.getLoginedUserId(req);      //logged user id
    // var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);        //for unit testing
    var system_id = common.trim(req.body[Constant.PARAM.SYSTEM_ID]);
    //
    if (common.isEmpty(user_id) || common.isEmpty(system_id)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    //check relationship between user and system
    var userSystem = new UserSystem();
    userSystem.search_no_paging({user_id: user_id, system_id: system_id}, '_id join_type', {}, function(res_search_user_sys){
        if (res_search_user_sys.result == Constant.FAILED_CODE){
            if (res_search_user_sys.name == Constant.CAST_ERROR && res_search_user_sys.path == Constant.PARAM.SYSTEM_ID &&
                (res_search_user_sys.kind == Constant.ObjectID || res_search_user_sys.kind == Constant.ObjectId)){
                res.rest.badRequest({
                    message: Constant.SYSTEM_NOT_FOUND
                });
            } else {
                res.rest.badRequest({
                    message: Constant.SERVER_ERR
                });
            }
        } else if (res_search_user_sys.data.length > 0 && res_search_user_sys.data[0]['join_type'] != Constant.JOIN_TYPE.REJECTED){
            //a relationship was made (except Rejected: #2459 - allow to join again)
            res.rest.badRequest({
                message: Constant.EXISTED
            });
        } else {
            //get system & owner info
            var system = new System();
            system.search_by_condition({_id: system_id}, {limit:1, skip:0}, 'user_id', {}, function(res_sys_info){
                if (res_sys_info.result == Constant.FAILED_CODE){
                    res.rest.badRequest({
                        message: Constant.SERVER_ERR
                    });
                } else {
                    if (res_sys_info.data.length == 0){
                        res.rest.badRequest({
                            message: Constant.SYSTEM_NOT_FOUND
                        });
                    } else if (res_sys_info.data[0]['user_id'] == null){
                        res.rest.badRequest({
                            message: Constant.SYSTEM_OWNER_NOT_FOUND
                        });
                    } else {
                        //get system owner info
                        var user = new User();
                        user.search_no_paging({_id: res_sys_info.data[0]['user_id']}, 'android_tokens', {}, function(res_sys_owner_info){
                            if (res_sys_owner_info.result == Constant.FAILED_CODE){
                                res.rest.badRequest({
                                    message: Constant.SERVER_ERR
                                });
                            } else if (res_sys_owner_info.data.length == 0) {
                                res.rest.badRequest({
                                    message: Constant.SYSTEM_OWNER_NOT_FOUND
                                });
                            } else {
                                var android_tokens = res_sys_owner_info.data[0]['android_tokens'];     //tokens of system owner
                                //check whether user is rejected before
                                if (res_search_user_sys.data.length > 0 && res_search_user_sys.data[0]['join_type'] == Constant.JOIN_TYPE.REJECTED){
                                    //rejected, change the type again
                                    userSystem.update({_id: res_search_user_sys.data[0]['_id']}, {join_type: Constant.JOIN_TYPE.REQUESTING_JOIN}, function(res_update_user_sys){
                                        if (res_update_user_sys.result == Constant.FAILED_CODE){
                                            res.rest.badRequest({
                                                message: Constant.SERVER_ERR
                                            });
                                        } else {
                                            var user_sys_id = res_search_user_sys.data[0]['_id'];
                                            //insert into Notification
                                            var new_notif = {
                                                description: Constant.MESS.REQUESTING_JOIN_SYSTEM,
                                                type: Constant.JOIN_TYPE.REQUESTING_JOIN,
                                                system_id: system_id,
                                                from_user_id: user_id,
                                                to_user_ids: [res_sys_owner_info.data[0]['_id']]  //system owner ID
                                            };
                                            var notif = new NotificationLLOG();
                                            notif.create(new_notif, function(res_create_notif){
                                                if (res_create_notif.result == Constant.FAILED_CODE){
                                                    //delete user system created
                                                    userSystem.delete_permanently({_id: user_sys_id}, function(){});
                                                    res.rest.badRequest({
                                                        message: Constant.SERVER_ERR
                                                    });
                                                } else {
                                                    res.rest.success({
                                                        data: {detail: user_sys_id}
                                                    });
                                                    //todo: send Push to system owner
                                                }
                                            });
                                        }
                                    });
                                } else {
                                    //send request at first time, insert into UserSystem
                                    var new_user_sys = {
                                        join_type: Constant.JOIN_TYPE.REQUESTING_JOIN,
                                        system_id: system_id,
                                        user_id: user_id
                                    };
                                    userSystem.create(new_user_sys, function(res_create_user_sys) {
                                        if (res_create_user_sys.result == Constant.FAILED_CODE){
                                            res.rest.badRequest({
                                                message: Constant.SERVER_ERR
                                            });
                                        } else {
                                            var user_sys_id = res_create_user_sys['_id'];
                                            //insert into Notification
                                            var new_notif = {
                                                description: Constant.MESS.REQUESTING_JOIN_SYSTEM,
                                                type: Constant.JOIN_TYPE.REQUESTING_JOIN,
                                                system_id: system_id,
                                                from_user_id: user_id,
                                                to_user_ids: [res_sys_owner_info.data[0]['_id']]  //system owner ID
                                            };
                                            var notif = new NotificationLLOG();
                                            notif.create(new_notif, function(res_create_notif){
                                                if (res_create_notif.result == Constant.FAILED_CODE){
                                                    //delete user system created
                                                    userSystem.delete_permanently({_id: user_sys_id}, function(){});
                                                    res.rest.badRequest({
                                                        message: Constant.SERVER_ERR
                                                    });
                                                } else {
                                                    res.rest.success({
                                                        data: {detail: user_sys_id}
                                                    });
                                                    //todo: send Push to system owner
                                                }
                                            });
                                        }
                                    });
                                }
                            }
                        });
                    }
                }
            });
        }
    });
});
/**
 * user accepts someone to join a system
 */
router.put('/accept_join', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, Constant.SESSION.LLOG_DB_ID)){
        res.rest.unauthorized();
        return;
    }
    //required params
    var user_id = common.getLoginedUserId(req);      //logged user id, who will accept
    // var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);        //for unit testing
    var requester_id = common.trim(req.body[Constant.PARAM.TO_USER_IDS]);
    var system_id = common.trim(req.body[Constant.PARAM.SYSTEM_ID]);
    //
    if (common.isEmpty(user_id) || common.isEmpty(requester_id) || common.isEmpty(system_id) || user_id==requester_id){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    //check if requester till existing in LLOG
    var user = new User();
    user.search_no_paging({_id: requester_id}, '', {}, function(res_search_requester_info){
        if (res_search_requester_info.result == Constant.FAILED_CODE){
            if (res_search_requester_info.name == Constant.CAST_ERROR &&
                (res_search_requester_info.kind == Constant.ObjectId || res_search_requester_info.kind==Constant.ObjectID)){
                res.rest.badRequest({
                    message: Constant.USER_NOT_FOUND
                });
            } else {
                res.rest.badRequest({
                    message: Constant.SERVER_ERR
                });
            }
        } else if (res_search_requester_info.data.length == 0){
            res.rest.badRequest({
                message: Constant.USER_NOT_FOUND        //cannot find requester info
            });
        } else {
            //check if I am owner or co admin of this system
            var rel_cond = {
                user_id: user_id,
                system_id: system_id,
                join_type: Constant.JOIN_TYPE.NONE
            };
            var userSystem = new UserSystem();
            userSystem.search_no_paging(rel_cond, 'join_type system_id', {}, function(res_search_user_sys){
                if (res_search_user_sys.result == Constant.FAILED_CODE){
                    if (res_search_user_sys.name == Constant.CAST_ERROR && res_search_user_sys.path == Constant.PARAM.SYSTEM_ID &&
                        (res_search_user_sys.kind == Constant.ObjectID || res_search_user_sys.kind == Constant.ObjectId)){
                        res.rest.badRequest({
                            message: Constant.SYSTEM_NOT_FOUND
                        });
                    } else if (res_search_user_sys.name == Constant.CAST_ERROR && res_search_user_sys.path == Constant.PARAM.USER_ID &&
                        (res_search_user_sys.kind == Constant.ObjectID || res_search_user_sys.kind == Constant.ObjectId)){
                        res.rest.badRequest({
                            message: Constant.USER_NOT_FOUND
                        });
                    } else {
                        res.rest.badRequest({
                            message: Constant.SERVER_ERR
                        });
                    }
                } else if (res_search_user_sys.data.length == 0){
                    res.rest.badRequest({
                        message: Constant.UNAUTHORIZATION
                    });
                } else if (common.isEmpty(res_search_user_sys.data[0]['system_id'])){
                    res.rest.badRequest({
                        message: Constant.SYSTEM_NOT_FOUND
                    });
                } else {
                    //check relationship between requester and system
                    userSystem.search_no_paging({user_id: requester_id, system_id: system_id, join_type: Constant.JOIN_TYPE.REQUESTING_JOIN}, '_id join_type', {}, function(res_search_user_sys_requester){
                        if (res_search_user_sys_requester.result == Constant.FAILED_CODE){
                            if (res_search_user_sys_requester.name == Constant.CAST_ERROR && res_search_user_sys_requester.path == Constant.PARAM.SYSTEM_ID &&
                                (res_search_user_sys_requester.kind == Constant.ObjectID || res_search_user_sys_requester.kind == Constant.ObjectId)){
                                res.rest.badRequest({
                                    message: Constant.SYSTEM_NOT_FOUND
                                });
                            } else if (res_search_user_sys_requester.name == Constant.CAST_ERROR && res_search_user_sys_requester.path == Constant.PARAM.USER_ID &&
                                (res_search_user_sys_requester.kind == Constant.ObjectID || res_search_user_sys_requester.kind == Constant.ObjectId)){
                                res.rest.badRequest({
                                    message: Constant.USER_NOT_FOUND
                                });
                            } else {
                                res.rest.badRequest({
                                    message: Constant.SERVER_ERR
                                });
                            }
                        } else if (res_search_user_sys_requester.data.length == 0 || res_search_user_sys_requester.data[0]['join_type']!=Constant.JOIN_TYPE.REQUESTING_JOIN){
                            res.rest.badRequest({
                                message: Constant.INVALID_REQUEST
                            });
                        } else {
                            //there is valid request to join
                            var upsert_cond = {
                                _id: res_search_user_sys_requester.data[0]['_id']
                            };
                            var user_sys_data = {
                                join_type: Constant.JOIN_TYPE.ACCEPTED,
                                update_time: new Date()
                            };
                            userSystem.upsert(upsert_cond, user_sys_data, function(res_upsert_user_sys){
                                if (res_upsert_user_sys.result == Constant.FAILED_CODE){
                                    res.rest.badRequest({
                                        message: Constant.SERVER_ERR
                                    });
                                } else {
                                    //inform to requester that Admin accepted
                                    var new_notif = {
                                        description: Constant.MESS.ACCEPTED_JOIN_SYSTEM,
                                        type: Constant.JOIN_TYPE.ACCEPTED,
                                        system_id: system_id,
                                        from_user_id: user_id,
                                        to_user_ids: [requester_id]
                                    };
                                    var notif = new NotificationLLOG();
                                    notif.create(new_notif, function(res_create_notif){
                                        if (res_create_notif.result == Constant.FAILED_CODE){
                                            //revert in UserSystem
                                            userSystem.upsert(upsert_cond, {join_type: Constant.JOIN_TYPE.REQUESTING_JOIN}, function(){});
                                            res.rest.badRequest({
                                                message: Constant.SERVER_ERR
                                            });
                                        } else {
                                            var new_notif_id = res_create_notif['_id'];
                                            //update notification of Admin
                                            var notif_cond = {
                                                system_id: system_id,
                                                from_user_id: requester_id,
                                                to_user_ids: user_id,
                                                type: Constant.JOIN_TYPE.REQUESTING_JOIN
                                            };
                                            notif.update(notif_cond, {type: Constant.JOIN_TYPE.ACCEPTED, update_time: new Date()}, function(res_update_notif){
                                                if (res_update_notif.result == Constant.FAILED_CODE){
                                                    //revert in notification
                                                    userSystem.upsert(upsert_cond, {join_type: Constant.JOIN_TYPE.REQUESTING_JOIN}, function(){});
                                                    notif.delete_permanently({_id: new_notif_id}, function(){});
                                                    res.rest.badRequest({
                                                        message: Constant.SERVER_ERR
                                                    });
                                                } else {
                                                    //success
                                                    //increase member no. of system by 1
                                                    change_member_num(system_id, 1, function(){});
                                                    res.rest.success({
                                                        data: res_search_requester_info.data[0]
                                                    });
                                                    //todo: send Push
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
    });
});
/**
 * user denies someone to join a system
 */
router.put('/deny_join', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, Constant.SESSION.LLOG_DB_ID)){
        res.rest.unauthorized();
        return;
    }
    //required params
    var user_id = common.getLoginedUserId(req);      //logged user id, who will accept
    // var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);        //for unit testing
    var requester_id = common.trim(req.body[Constant.PARAM.TO_USER_IDS]);
    var system_id = common.trim(req.body[Constant.PARAM.SYSTEM_ID]);
    //
    if (common.isEmpty(user_id) || common.isEmpty(requester_id) || common.isEmpty(system_id) ||
        user_id==requester_id){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    //check if I am owner or co admin of this system
    var rel_cond = {
        user_id: user_id,
        system_id: system_id,
        join_type: Constant.JOIN_TYPE.NONE
    };
    var userSystem = new UserSystem();
    userSystem.search_no_paging(rel_cond, 'join_type system_id', {}, function(res_search_user_sys){
        if (res_search_user_sys.result == Constant.FAILED_CODE){
            if (res_search_user_sys.name == Constant.CAST_ERROR && res_search_user_sys.path == Constant.PARAM.SYSTEM_ID &&
                (res_search_user_sys.kind == Constant.ObjectID || res_search_user_sys.kind == Constant.ObjectId)){
                res.rest.badRequest({
                    message: Constant.SYSTEM_NOT_FOUND
                });
            } else if (res_search_user_sys.name == Constant.CAST_ERROR && res_search_user_sys.path == Constant.PARAM.USER_ID &&
                (res_search_user_sys.kind == Constant.ObjectID || res_search_user_sys.kind == Constant.ObjectId)){
                res.rest.badRequest({
                    message: Constant.USER_NOT_FOUND
                });
            } else {
                res.rest.badRequest({
                    message: Constant.SERVER_ERR
                });
            }
        } else if (res_search_user_sys.data.length == 0){
            res.rest.badRequest({
                message: Constant.UNAUTHORIZATION
            });
        } else if (common.isEmpty(res_search_user_sys.data[0]['system_id'])){
            res.rest.badRequest({
                message: Constant.SYSTEM_NOT_FOUND
            });
        } else {
            //check relationship between requester and system
            userSystem.search_no_paging({user_id: requester_id, system_id: system_id, join_type: Constant.JOIN_TYPE.REQUESTING_JOIN}, '_id join_type system_id', {}, function(res_search_user_sys_requester){
                if (res_search_user_sys_requester.result == Constant.FAILED_CODE){
                    if (res_search_user_sys_requester.name == Constant.CAST_ERROR && res_search_user_sys_requester.path == Constant.PARAM.SYSTEM_ID &&
                        (res_search_user_sys_requester.kind == Constant.ObjectID || res_search_user_sys_requester.kind == Constant.ObjectId)){
                        res.rest.badRequest({
                            message: Constant.SYSTEM_NOT_FOUND
                        });
                    } else if (res_search_user_sys_requester.name == Constant.CAST_ERROR && res_search_user_sys_requester.path == Constant.PARAM.USER_ID &&
                        (res_search_user_sys_requester.kind == Constant.ObjectID || res_search_user_sys_requester.kind == Constant.ObjectId)){
                        res.rest.badRequest({
                            message: Constant.USER_NOT_FOUND
                        });
                    } else {
                        res.rest.badRequest({
                            message: Constant.SERVER_ERR
                        });
                    }
                } else if (res_search_user_sys_requester.data.length == 0 || res_search_user_sys_requester.data[0]['join_type']!=Constant.JOIN_TYPE.REQUESTING_JOIN){
                    res.rest.badRequest({
                        message: Constant.INVALID_REQUEST
                    });
                } else {
                    //there is valid request to join
                    var upsert_cond = {
                        _id: res_search_user_sys_requester.data[0]['_id']
                    };
                    var user_sys_data = {
                        join_type: Constant.JOIN_TYPE.REJECTED,
                        update_time: new Date()
                    };
                    userSystem.upsert(upsert_cond, user_sys_data, function(res_upsert_user_sys){
                        if (res_upsert_user_sys.result == Constant.FAILED_CODE){
                            res.rest.badRequest({
                                message: Constant.SERVER_ERR
                            });
                        } else {
                            //inform to requester that Admin rejected the request
                            var new_notif = {
                                description: Constant.MESS.REJECTED_JOIN_SYSTEM,
                                type: Constant.JOIN_TYPE.REJECTED,
                                system_id: system_id,
                                from_user_id: user_id,
                                to_user_ids: [requester_id]
                            };
                            var notif = new NotificationLLOG();
                            notif.create(new_notif, function(res_create_notif){
                                if (res_create_notif.result == Constant.FAILED_CODE){
                                    //revert in UserSystem
                                    userSystem.upsert(upsert_cond, {join_type: Constant.JOIN_TYPE.REQUESTING_JOIN}, function(){});
                                    res.rest.badRequest({
                                        message: Constant.SERVER_ERR
                                    });
                                } else {
                                    var new_notif_id = res_create_notif['_id'];
                                    //continue
                                    var notif_cond = {
                                        system_id: system_id,
                                        from_user_id: requester_id,
                                        to_user_ids: user_id,
                                        type: Constant.JOIN_TYPE.REQUESTING_JOIN
                                    };
                                    notif.update(notif_cond, {type: Constant.JOIN_TYPE.REJECTED, update_time: new Date()}, function(res_update_notif){
                                        if (res_update_notif.result == Constant.FAILED_CODE){
                                            //revert in notification
                                            userSystem.upsert(upsert_cond, {join_type: Constant.JOIN_TYPE.REQUESTING_JOIN}, function(){});
                                            notif.delete_permanently({_id: new_notif_id}, function(){});
                                            res.rest.badRequest({
                                                message: Constant.SERVER_ERR
                                            });
                                        } else {
                                            //success
                                            res.rest.success();
                                            //todo: send Push
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
    });
});
//
module.exports = router;
