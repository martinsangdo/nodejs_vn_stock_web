/**
 * author: Martin
 * @type {*}
 */
var express = require('express');
var router = express.Router();
var config = require('../config/setting')();

var User = require('../models/llog/User.js');
var ReadNotificationLLOG = require('../models/llog/ReadNotificationLLOG.js');
var NotificationLLOG = require('../models/llog/NotificationLLOG.js');
var UserSystem = require('../models/llog/UserSystem.js');
var System = require('../models/llog/System.js');

var Constant = require('../common/constant.js');
var Common = require('../common/common.js');
var common = new Common();

var DB_STRUCTURE = require('../models/system/DBStructure.js');
var DBOperater = require('../models/db_operator.js');
var dbOperator = new DBOperater();

/**
 * login system
 */
router.post('/login', common.checkLLOGToken, function(req, res) {
    var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);
    if (common.isEmpty(user_id)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    //search if user existed
    var user = new User();
    user.search_by_condition({_id: user_id}, {limit:1, skip:0}, '_id android_tokens', '', function(res_search){
        if (res_search.result == Constant.OK_CODE){
            //check whether request has some information
            if (res_search.data.length > 0 && common.isNotEmpty(res_search.data[0]['_id'])){
                //found 1 user
                common.saveSessionLogin(req, Constant.SESSION.LLOG_DB_ID, res_search.data[0]['_id']);
                var new_token = common.trim(req.body[Constant.PARAM.ANDROID_TOKENS]);
                add_new_token(res_search.data[0]['_id'], new_token, function(resp_add){
                    if (resp_add.result == Constant.OK_CODE){
                        res.rest.success();
                    } else {
                        res.rest.serverError();
                    }
                });
            } else {
                //user not found
                res.rest.badRequest({
                    message: Constant.NOT_FOUND
                });
            }
        } else if (res_search.name == Constant.CAST_ERROR && (res_search.kind == Constant.ObjectID || res_search.kind == Constant.ObjectId)) {
            //user not found
            res.rest.badRequest({
                message: Constant.NOT_FOUND
            });
        } else {
            res.rest.serverError();
        }
    });
});
/**
 * add new token to User
 * @param user_id
 */
function add_new_token(user_id, new_token, callback){
    var condition = {
        _id: user_id,
        android_tokens: {$ne: new_token}
    };
    var update_data = {
        $addToSet: {android_tokens: new_token}
    };
    var user = new User();
    user.update(condition, update_data, callback);
}
/**
 * logout system
 */
router.post('/logout', common.checkLLOGToken, function(req, res) {
    var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);
    if (common.isEmpty(user_id)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    //search if user existed
    var user = new User();
    user.search_by_condition({_id: user_id}, {limit:1, skip:0}, '_id android_tokens', '', function(res_search){
        if (res_search.result == Constant.OK_CODE){
            //check whether request has some information
            if (res_search.data.length > 0 && common.isNotEmpty(res_search.data[0]['_id'])){
                //found 1 user
                common.removeSessionLogin(req, Constant.SESSION.LLOG_DB_ID);
                var android_token = common.trim(req.body[Constant.PARAM.ANDROID_TOKENS]);
                remove_token(res_search.data[0]['_id'], android_token, function(resp_add){
                    if (resp_add.result == Constant.OK_CODE){
                        res.rest.success();
                    } else {
                        res.rest.serverError();
                    }
                });
            } else {
                //user not found
                res.rest.badRequest({
                    message: Constant.NOT_FOUND
                });
            }
        } else if (res_search.name == Constant.CAST_ERROR && (res_search.kind == Constant.ObjectID || res_search.kind == Constant.ObjectId)) {
            //user not found
            res.rest.badRequest({
                message: Constant.NOT_FOUND
            });
        } else {
            res.rest.serverError();
        }
    });
});
/**
 * remove token
 * @param user_id
 */
function remove_token(user_id, android_token, callback){
    var condition = {
        _id: user_id
    };
    var update_data = {
        $pull: {android_tokens: android_token}
    };
    var user = new User();
    user.update(condition, update_data, callback);
}
/**
 * find user by email
 * if not found, insert into DB
 * (save session after create / update user)
 */
router.put('/upsert_user', common.checkLLOGToken, function(req, res) {
    //required params
    var name = common.trim(req.body[Constant.PARAM.NAME]);
    var email = common.trim(req.body[Constant.PARAM.EMAIL]);
    var public_key = common.trim(req.body[Constant.PARAM.PUBLIC_KEY]);
    var security_code = common.trim(req.body[Constant.PARAM.SECURITY_CODE]);
    var new_android_token = common.trim(req.body[Constant.PARAM.ANDROID_TOKENS]);
    //
    if (common.isEmpty(name) || common.isEmpty(email) || common.isEmpty(public_key) || common.isEmpty(security_code)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    var existed_condition = {email: email};     //if email existed in collection User, not insert any longer
    var user = new User();
    //check if user existed
    user.search_by_condition(existed_condition, {limit:1, skip:0}, '_id name android_tokens', {}, function(result){
        if (result.result == Constant.OK_CODE){
            //check whether request has some information
            if (result.data.length > 0 && common.isNotEmpty(result.data[0]['_id'])){
                //found 1 user
                if (common.isNotEmpty(new_android_token)){
                    var update_data = {};
                    if (common.isNotEmpty(public_key)){
                        update_data['public_key'] = public_key;
                    }
                    if (common.isNotEmpty(security_code)){
                        update_data['security_code'] = security_code;
                    }
                    if (common.isNotEmpty(result.data[0]['android_tokens'])){
                        update_data['android_tokens'] = result.data[0]['android_tokens'];   //old tokens
                        if (result.data[0]['android_tokens'].indexOf(new_android_token) < 0){       //not existed in DB
                            update_data['android_tokens'].push(new_android_token);   //insert new token
                        }
                        user.update(existed_condition, update_data, function(res_update){
                            //do nothing
                        });
                    } else {
                        update_data['android_tokens'] = [new_android_token];
                        user.update(existed_condition, update_data, function(res_update){
                            //do nothing
                        });
                    }
                }
                common.saveSessionLogin(req, Constant.SESSION.LLOG_DB_ID, result.data[0]['_id']);
                res.rest.success({
                    data: {
                        user_id: result.data[0]['_id'],
                        name: result.data[0]['name']
                    }
                });
            } else {
                //user not found, insert new one
                var update_data = {     //this info will be inserted to collection User
                    name: name,
                    plain_name: name.toLowerCase(),
                    email: email,
                    public_key: public_key,
                    security_code: security_code
                };
                if (common.isNotEmpty(new_android_token)){
                    update_data['android_tokens'] = [new_android_token];
                }
                user.create(update_data, function(res_create){
                    if (res_create.result == Constant.OK_CODE){
                        common.saveSessionLogin(req, Constant.SESSION.LLOG_DB_ID, res_create['user_id']);
                        //send back result to client
                        res.rest.success({
                            data: {
                                user_id: res_create['user_id']
                            }
                        });
                    } else {
                        res.rest.badRequest({
                            message: Constant.SERVER_ERR
                        });
                    }
                });
            }
        } else {
            //db error
            res.rest.badRequest({
                message: Constant.SERVER_ERR
            });
        }
    });
});
/**
 * update user info by _id
 * only owner can update his info
 */
router.put('/update_user_info', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, Constant.SESSION.LLOG_DB_ID)){
        res.rest.unauthorized();
        return;
    }
    //required params
    var _id = common.trim(req.body[Constant.PARAM._ID]);
    //
    if (common.isEmpty(_id)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    } else if (_id != common.getLoginedUserId(req)){        //prevent hacking
        // res.rest.unauthorized();
        res.rest.badRequest({
            message: Constant.NOT_FOUND
        });
        return;
    }
    var existed_condition = {_id: _id};     //if email existed in collection User, not insert any longer
    var user = new User();
    //check if user existed
    user.search_by_condition(existed_condition, {limit:1, skip:0}, '_id android_tokens', {}, function(result){
        if (result.result == Constant.OK_CODE){
            var update_data = {     //this info will be updated to collection User
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
            if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.SECURITY_CODE]))){
                update_data['security_code'] = common.trim(req.body[Constant.PARAM.SECURITY_CODE]);
            }
            if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.PUBLIC_KEY]))){
                update_data['public_key'] = common.trim(req.body[Constant.PARAM.PUBLIC_KEY]);
            }
            if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.PROFILE_VISIBILITY]))){
                update_data['profile_visibility'] = common.trim(req.body[Constant.PARAM.PROFILE_VISIBILITY]);
            }
            if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.FRIEND_LIST_VISIBILITY]))){
                update_data['friend_list_visibility'] = common.trim(req.body[Constant.PARAM.FRIEND_LIST_VISIBILITY]);
            }
            if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.GROUP_LIST_VISIBILITY]))){
                update_data['group_list_visibility'] = common.trim(req.body[Constant.PARAM.GROUP_LIST_VISIBILITY]);
            }
            if (result.data.length > 0 && common.isNotEmpty(result.data[0]['_id'])){
                //found 1 user, update it
                //update android token, if any
                if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.ANDROID_TOKENS]))){
                    if (common.isNotEmpty(result.data[0]['android_tokens'])){
                        update_data['android_tokens'] = result.data[0]['android_tokens'];
                        if (result.data[0]['android_tokens'].indexOf(common.trim(req.body[Constant.PARAM.ANDROID_TOKENS])) < 0){       //not existed
                            update_data['android_tokens'].push(common.trim(req.body[Constant.PARAM.ANDROID_TOKENS]));   //insert more tokens
                        }
                    } else {
                        update_data['android_tokens'] = [common.trim(req.body[Constant.PARAM.ANDROID_TOKENS])];
                    }
                }
                //update to User, if any
                if (common.get_obj_len(update_data) > 0){       //has something to update
                    update_data['update_time'] = new Date();
                    user.update(existed_condition, update_data, function(res_update){
                        if (res_update.result == Constant.OK_CODE){
                            res.rest.success({
                                data: {user_id: result.data[0]['_id']}
                            });
                        } else {
                            res.rest.serverError();
                        }
                    });
                } else {
                    res.rest.success({
                        data: {user_id: result.data[0]['_id']}
                    });
                }
            } else {
                //user not found
                res.rest.badRequest({
                    message: Constant.NOT_FOUND
                });
            }
        } else {
            //db error
            res.rest.serverError();
        }
    });
});
/**
 * update user info by _id
 * only owner can update his info & this one used in Edit name & avatar, so not required to login
 */
router.put('/update_user_info_not_login', common.checkLLOGToken, function(req, res) {
    //required params
    var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);
    var private_access_token = req.headers[Constant.HEADER_PARAM.PRIVATE_ACCESS_TOKEN];
    var fullname = common.trim(req.body[Constant.PARAM.NAME]);
    var avatar_org_size_id = common.trim(req.body[Constant.PARAM.AVATAR_ORG_SIZE_ID]);
    var avatar_thumb_size_id = common.trim(req.body[Constant.PARAM.AVATAR_THUMB_SIZE_ID]);
    var is_edit_avatar = common.trim(req.body[Constant.PARAM.IS_EDIT_AVATAR]);
    //
    if (common.isEmpty(user_id) ||
        (common.isEmpty(fullname) && common.isEmpty(avatar_org_size_id) && common.isEmpty(avatar_thumb_size_id)) && common.isEmpty(is_edit_avatar)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    } else if (private_access_token != config.private_access_token){
        res.rest.badRequest({
            message: Constant.UNAUTHORIZATION
        });
        return;
    }
    var existed_condition = {_id: user_id};     //
    var user = new User();
    //check if user existed
    user.search_by_condition(existed_condition, {limit:1, skip:0}, '_id name edit_detail', {}, function(result){
        if (result.result == Constant.OK_CODE){
            if (result.data.length > 0 && common.isNotEmpty(result.data[0]['_id'])){
                //found 1 user
                var update_data = {     //this info will be updated to collection User
                };
                var currentDate = new Date();
                if (common.isNotEmpty(result.data[0]['edit_detail'])){
                    var edit_detail = result.data[0]['edit_detail'];
                } else {
                    var edit_detail = {
                        name: currentDate, avatar: currentDate
                    };
                }
                if (common.isNotEmpty(fullname)){
                    update_data['name'] = fullname;
                    update_data['plain_name'] = fullname.toLowerCase();
                    //update edit time in DB
                    edit_detail['name'] = currentDate;
                }
                //check whether request has some information
                if (common.isNotEmpty(is_edit_avatar) && is_edit_avatar > 0){
                    if (common.isNotEmpty(avatar_org_size_id) && common.isNotEmpty(avatar_thumb_size_id)){
                        update_data['cloud_avatar_id'] = {
                            org_size: avatar_org_size_id,
                            thumb_size: avatar_thumb_size_id
                        };
                    }
                    //update edit time in DB
                    edit_detail['avatar'] = currentDate;
                    common.dlog('LLOG: received request to update user avatar');
                }
                update_data['edit_detail'] = edit_detail;
                //update to User, if any
                if (common.get_obj_len(update_data) > 0){       //has something to update
                    update_data['update_time'] = new Date();
                    user.update(existed_condition, update_data, function(res_update){
                        if (res_update.result == Constant.OK_CODE){
                            common.dlog('LLOG: updated user info successfully');
                            res.rest.success({
                                data: {update_time: currentDate}
                            });
                        } else {
                            res.rest.badRequest({
                                message: Constant.NOT_FOUND
                            });
                        }
                    });
                } else {
                    res.rest.success({
                        data: {update_time: currentDate}
                    });
                }
            } else {
                //user not found
                res.rest.badRequest({
                    message: Constant.NOT_FOUND
                });
            }
        } else {
            //db error
            res.rest.badRequest({
                message: Constant.SERVER_ERR
            });
        }
    });
});
/**
 * search users by condition (name AND/OR email), check profile_visibility too
 * case insensitive
 */
router.post('/search_by_condition', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, Constant.SESSION.LLOG_DB_ID)){
        res.rest.unauthorized();
        return;
    }
    var user_name = common.trim(req.body[Constant.PARAM.USER_NAME]);
    var email = common.trim(req.body[Constant.PARAM.EMAIL]);
    var search_type = common.trim(req.body[Constant.PARAM.SEARCH_TYPE]);
    //validate input
    if (common.isNotEmpty(user_name) && common.isNotEmpty(email) && common.isEmpty(search_type)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS       //missing name or email
        });
        return;
    } else if (common.isNotEmpty(search_type) && search_type != Constant.SEARCH_TYPE_AND && search_type != Constant.SEARCH_TYPE_OR){
        res.rest.badRequest({
            message: Constant.INVALID_PARAM_VALUE
        });
        return;
    }
    var query_condition = {};       //default search all
    //now we sure to have name or email
    if (common.isNotEmpty(user_name) && common.isNotEmpty(email)){
        if (search_type == Constant.SEARCH_TYPE_OR){
            query_condition = {$or: [
                {name: {'$regex' : user_name, '$options' : 'i'}},
                {email: {'$regex' : email, '$options' : 'i'}}
            ]};
        } else {
            query_condition = {
                name: {'$regex' : user_name, '$options' : 'i'},
                email: {'$regex' : email, '$options' : 'i'}
            };
        }
    } else if (common.isNotEmpty(user_name)) {
        query_condition = {name: {'$regex' : user_name, '$options' : 'i'}};      //case insensitive
    } else if (common.isNotEmpty(email)) {
        query_condition = {email: {'$regex' : email, '$options' : 'i'}};      //case insensitive
    }
    query_condition['profile_visibility'] = true;       //allow to search
    var paging = {
        limit:  common.isNotEmpty(common.trim(req.body[Constant.PARAM.LENGTH]))?parseInt(common.trim(req.body[Constant.PARAM.LENGTH])):100, //Constant.DEFAULT_PAGE_LENGTH,
        skip:   common.isNotEmpty(common.trim(req.body[Constant.PARAM.OFFSET]))?parseInt(common.trim(req.body[Constant.PARAM.OFFSET])):0
    };
    var sort = {
        name: 1
    };
    var user = new User();
    user.search_by_condition(query_condition, paging, '', sort, function (res_search) {
        if (res_search.result == Constant.OK_CODE) {
            res.rest.success({
                data: {list: res_search.data}
            });
        } else {
            res.rest.serverError();
        }
    });
});
/**
 * Martin: clean unused data in DB
 */
router.post('/clean_db', common.checkLLOGToken, function(req, res) {
    // var email = 'testengma5@gmail.com';
    // var user = new User();
    // user.delete_account({email: email});
});
/**
 * check if I having some unread notification, called when open app to show notification
 */
router.post('/get_my_unread_notification', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, Constant.SESSION.LLOG_DB_ID)){
        res.rest.unauthorized();
        return;
    }
    var user_id = common.getLoginedUserId(req);      //logged user id
    // var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);
    if (common.isEmpty(user_id)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    //get system notification or direct to me
    var query_condition = {
        to_user_ids: user_id
    };
    var paging = {
        limit:  common.isNotEmpty(common.trim(req.body[Constant.PARAM.LENGTH]))?parseInt(common.trim(req.body[Constant.PARAM.LENGTH])):Constant.DEFAULT_PAGE_LENGTH, //Constant.DEFAULT_PAGE_LENGTH,
        skip:   common.isNotEmpty(common.trim(req.body[Constant.PARAM.OFFSET]))?parseInt(common.trim(req.body[Constant.PARAM.OFFSET])):0
    };
    var sort = {
        update_time: -1
    };
    //get list of notification
    var notif = new NotificationLLOG();
    notif.search_by_condition(query_condition, paging, 'description system_id from_user_id type update_time', sort, function(res_search_notif){
        if (res_search_notif.result == Constant.FAILED_CODE){
            res.rest.badRequest({
                message: Constant.SERVER_ERR
            });
        } else {
            //found some notifications
            var notif_num = res_search_notif.data.length;
            if (notif_num > 0){
                //get detail of each notification
                var notif_id, from_user_id, system_id;
                var final_results = {};
                var count = 0;      //count how many responses return
                var user = new User();
                var system = new System();
                var sys_fields = 'name cloud_avatar_id db_server_link db_id_name db_username db_password edit_detail';
                for (var i=0; i<notif_num; i++){
                    notif_id = res_search_notif.data[i]['_id'];
                    final_results[notif_id] = res_search_notif.data[i].toObject();       //keep it to update in async queries
                    from_user_id = res_search_notif.data[i]['from_user_id'];
                    system_id = res_search_notif.data[i]['system_id'];
                    //get info of from user
                    user.simple_search_by_condition_w_keys({_id: from_user_id}, 'name email cloud_avatar_id public_key edit_detail', {notif_id: notif_id, system_id: system_id}, function(res_user_info){
                        if (res_user_info.result == Constant.FAILED_CODE){
                            final_results[res_user_info.inj_keys.notif_id]['from_user_id'] = null;     //set from user = null because of error
                            count++;
                        } else {
                            if (res_user_info.data.length > 0) {
                                //found 1 user
                                final_results[res_user_info.inj_keys.notif_id]['from_user_id'] = res_user_info.data[0];
                            } else {
                                //user not found
                                delete final_results[res_user_info.inj_keys.notif_id]['from_user_id'];
                            }
                            if (common.isNotEmpty(res_user_info.inj_keys.system_id)) {
                                //get system info
                                system.simple_search_by_condition_w_keys({_id: res_user_info.inj_keys.system_id}, sys_fields, res_user_info.inj_keys, function(res_system_info) {
                                    if (res_system_info.result == Constant.FAILED_CODE){
                                        final_results[res_system_info.inj_keys.notif_id]['system_id'] = null;     //set system info = null because of error
                                    } else {
                                        final_results[res_system_info.inj_keys.notif_id]['system_id'] = res_system_info.data[0];
                                    }
                                    count++;
                                    if (count == notif_num){
                                        common.reform_notif_response_format(res, final_results);
                                    }
                                });
                            } else {
                                count++;
                            }
                        }
                        if (count == notif_num){
                            //got all results from async queries
                            common.reform_notif_response_format(res, final_results);
                        }
                    });
                }
            } else {
                res.rest.success({
                    data: {list: res_search_notif.data}       //empty list
                });
            }
        }
    });
});
/**
 * open notification list page, set I read all notification
 */
router.put('/update_my_read_status', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, Constant.SESSION.LLOG_DB_ID)){
        res.rest.unauthorized();
        return;
    }
    var my_user_id = common.trim(req.body[Constant.PARAM.USER_ID]);

    if (common.isEmpty(my_user_id)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    var query_condition = {to_user_id: my_user_id};
    var update_data = {
        read: true,
        update_time: new Date()
    };

    var readNotif = new ReadNotificationLLOG();
    readNotif.update(query_condition, update_data, function (res_search) {
        if (res_search.result == Constant.OK_CODE) {
            res.rest.success();
        } else {
            res.rest.serverError();
        }
    });
});
/**
 * Delete user PERMANENTLY from LLOG system & his system, use it carefully
 * CANNOT BE UNDO
 */
router.post('/delete_account_permanently', common.checkLLOGToken, function(req, res) {
    var email = common.trim(req.body[Constant.PARAM.EMAIL]);
    //validate input
    if (common.isEmpty(email)) {
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS       //missing name or email
        });
        return;
    }
    //
    var user = new User();
    user.search_by_condition({email: email}, {limit: 1, skip:0}, '_id', {}, function(res_search){
       if (res_search.result == Constant.OK_CODE){
            if (common.isNotEmpty(res_search.data[0]) && common.isNotEmpty(res_search.data[0]['_id'])){
                //found 1 user
                var user_id = res_search.data[0]['_id'];
                //
                var userSystem = new UserSystem();
                //find systems which I created or joined
                userSystem.search_no_paging({user_id: user_id}, '', {}, function(my_sys){
                    // common.dlog(my_sys);
                    if (my_sys.result == Constant.OK_CODE){
                        var my_systems = my_sys.data;
                        var len = my_systems.length;
                        for (var i=0; i<len; i++){
                            if (common.isNotEmpty(my_systems[i]['system_id']) && common.isNotEmpty(my_systems[i]['system_id']['db_server_link'])){
                                //connect to each system DB & delete data there
                                delete_account_in_system(user_id, my_systems[i]['system_id']['db_server_link'], my_systems[i]['system_id']['db_id_name'],
                                    my_systems[i]['system_id']['db_user_name'], my_systems[i]['system_id']['db_password'],
                                    (my_systems[i]['join_type'] == Constant.JOIN_TYPE.NONE), res);
                            }
                        }
                    } else {
                        res.rest.serverError();
                    }
                    //delete info in LLOG db
                    userSystem.delete_permanently({user_id: user_id}, function(){});
                    //
                    var system = new System();
                    system.delete_permanently({user_id: user_id}, function(){});
                    //
                    var readNotificationLLOG = new ReadNotificationLLOG();
                    readNotificationLLOG.delete_permanently({to_user_id: user_id}, function(){});
                    //
                    var notifLLOG = new NotificationLLOG();
                    notifLLOG.delete_permanently({$or: [{from_user_id: user_id}, {to_user_ids: user_id}]}, function(){});
                    //
                    user.delete_permanently({_id: user_id}, function(resp_del_user){
                        if (resp_del_user.result == Constant.OK_CODE){
                            common.dlog("Deleted user: " + email);
                            res.rest.success();
                        } else {
                            res.rest.serverError();
                        }
                    });
                });
            } else {
                res.rest.badRequest({
                    message: Constant.NOT_FOUND       //not found any user
                });
            }
       } else {
           res.rest.serverError();
       }
    });
});
//
function delete_account_in_system(user_id, db_server_link, db_id_name, db_username, db_password, is_del_system, res){
//connect to specific system db
    var resp_read_mess_conn = common.getSystemModelFromSysInfo(db_server_link, db_id_name, db_username, db_password, DB_STRUCTURE.ReadMessage, Constant.COLLECTION_NAME.READ_MESSAGE, res);
    if (resp_read_mess_conn.result == Constant.FAILED_CODE){
        // common.dlog('cannot connect: ' + db_server_link + '/' + db_id_name)
    } else {
        dbOperator.delete_permanently(resp_read_mess_conn.db_model, {to_user_id: user_id}, function () {});
        //
        var resp_last_mess_conn = common.getSystemModelFromSysInfo(db_server_link, db_id_name, db_username, db_password, DB_STRUCTURE.LastMessage, Constant.COLLECTION_NAME.LAST_MESSAGE, res);
        var condition = {$or: [{creator_id: user_id}, {to_user_ids: user_id}]};
        dbOperator.delete_permanently(resp_last_mess_conn.db_model, condition, function () {});
        //
        var resp_mess_conn = common.getSystemModelFromSysInfo(db_server_link, db_id_name, db_username, db_password, DB_STRUCTURE.Message, Constant.COLLECTION_NAME.MESSAGE, res);
        dbOperator.delete_permanently(resp_mess_conn.db_model, {$or: [{from_user_id: user_id}, {to_user_ids: user_id}]}, function () {});
        //
        var resp_sys_comment_conn = common.getSystemModelFromSysInfo(db_server_link, db_id_name, db_username, db_password, DB_STRUCTURE.Comment, Constant.COLLECTION_NAME.COMMENT, res);
        dbOperator.delete_permanently(resp_sys_comment_conn.db_model, {user_id: user_id}, function () {});
        //
        var resp_sys_read_record_conn = common.getSystemModelFromSysInfo(db_server_link, db_id_name, db_username, db_password, DB_STRUCTURE.ReadRecord, Constant.COLLECTION_NAME.READ_RECORD, res);
        dbOperator.delete_permanently(resp_sys_read_record_conn.db_model, {user_id: user_id}, function () {});
        //
        var resp_sys_record_conn = common.getSystemModelFromSysInfo(db_server_link, db_id_name, db_username, db_password, DB_STRUCTURE.Record, Constant.COLLECTION_NAME.RECORD, res);
        dbOperator.delete_permanently(resp_sys_record_conn.db_model, {user_id: user_id}, function () {});
        //
        var resp_sys_read_notif_conn = common.getSystemModelFromSysInfo(db_server_link, db_id_name, db_username, db_password, DB_STRUCTURE.ReadNotification, Constant.COLLECTION_NAME.READ_NOTIFICATION, res);
        dbOperator.delete_permanently(resp_sys_read_notif_conn.db_model, {user_id: user_id}, function () {});
        //
        var resp_sys_notif_conn = common.getSystemModelFromSysInfo(db_server_link, db_id_name, db_username, db_password, DB_STRUCTURE.Notification, Constant.COLLECTION_NAME.NOTIFICATION, res);
        dbOperator.delete_permanently(resp_sys_notif_conn.db_model, {user_id: user_id}, function () {});
        //
        var resp_sys_group_member_conn = common.getSystemModelFromSysInfo(db_server_link, db_id_name, db_username, db_password, DB_STRUCTURE.GroupMember, Constant.COLLECTION_NAME.GROUP_MEMBER, res);
        dbOperator.delete_permanently(resp_sys_group_member_conn.db_model, {user_id: user_id}, function () {});
        //
        var resp_sys_group_conn = common.getSystemModelFromSysInfo(db_server_link, db_id_name, db_username, db_password, DB_STRUCTURE.Group, Constant.COLLECTION_NAME.GROUP, res);
        dbOperator.delete_permanently(resp_sys_group_conn.db_model, {user_id: user_id}, function () {});
        //
        var resp_sys_mem_conn = common.getSystemModelFromSysInfo(db_server_link, db_id_name, db_username, db_password, DB_STRUCTURE.SystemMember, Constant.COLLECTION_NAME.SYSTEM_MEMBER, res);
        dbOperator.delete_permanently(resp_sys_mem_conn.db_model, {_id: user_id}, function () {});
        //
        // common.dlog('Deleted data in sys: ' + db_server_link + '/' + db_id_name);

        if (is_del_system){
            var resp_sys_info_conn = common.getSystemModelFromSysInfo(db_server_link, db_id_name, db_username, db_password, DB_STRUCTURE.SystemInfo, Constant.COLLECTION_NAME.SYSTEM_INFO, res);
            dbOperator.delete_permanently(resp_sys_info_conn.db_model, {user_id: user_id}, function () {});
        }
    }
}
/**
 * delete trash documents in all collections
 */
router.post('/delete_trash_docs', common.checkLLOGToken, function(req, res) {
    var user = new User();
    user.search_no_paging({email: {'$regex' : '@gmail.com', '$options' : 'i'}}, '_id', {}, function(res_search){
        if (res_search.result == Constant.OK_CODE){
            var users = res_search.data;
            var len = users.length;
            var user_list = [];
            for (var i=0; i<len; i++){
                user_list.push(users[i]['_id']);
            }
            // common.dlog(user_list);

            var userSystem = new UserSystem();
            //delete info in LLOG db
            userSystem.delete_permanently({user_id: {$nin: user_list}}, function(){});
            //
            var system = new System();
            system.delete_permanently({user_id: {$nin: user_list}}, function(){});
            //
            var readNotificationLLOG = new ReadNotificationLLOG();
            readNotificationLLOG.delete_permanently({to_user_id: {$nin: user_list}}, function(){});
            //
            var notifLLOG = new NotificationLLOG();
            notifLLOG.delete_permanently({$or: [{from_user_id: {$nin: user_list}}, {to_user_ids: {$nin: user_list}}]}, function(resp_del){
                if (resp_del.result == Constant.OK_CODE){
                    res.rest.success();
                } else {
                    res.rest.serverError();
                }
            });
        } else {
            res.rest.serverError();
        }
    });
});
/**
 * delete trash documents in all collections
 */
router.post('/delete_trash_docs_system', common.checkLLOGToken, function(req, res) {
    //connect to specific system db
    var resp_sys_mem_conn = common.getSystemModel(req, DB_STRUCTURE.SystemMember, Constant.COLLECTION_NAME.SYSTEM_MEMBER, res);
    if (resp_sys_mem_conn.result == Constant.FAILED_CODE){
        res.rest.badRequest({
            message: resp_conn.message
        });
        return;
    }
    //find system members
    dbOperator.simple_search_by_condition(resp_sys_mem_conn.db_model, {email: {'$regex' : '@gmail.com', '$options' : 'i'}}, '_id', function(res_search) {
        if (res_search.result == Constant.OK_CODE) {
            var users = res_search.data;
            var len = users.length;
            if (len == 0){
                res.rest.badRequest({
                    message: Constant.NOT_FOUND       //not found any user
                });
                return;
            }
            var user_list = [];
            for (var i = 0; i < len; i++) {
                user_list.push(users[i]['_id']);
            }
            // common.dlog(user_list);
            //
            var resp_read_mess_conn = common.getSystemModel(req, DB_STRUCTURE.ReadMessage, Constant.COLLECTION_NAME.READ_MESSAGE, res);
            dbOperator.delete_permanently(resp_read_mess_conn.db_model, {to_user_id: {$nin: user_list}}, function () {});
            //
            var resp_last_mess_conn = common.getSystemModel(req, DB_STRUCTURE.LastMessage, Constant.COLLECTION_NAME.LAST_MESSAGE, res);
            var condition = {$or: [{creator_id: {$nin: user_list}}, {to_user_ids: {$nin: user_list}}]};
            dbOperator.delete_permanently(resp_last_mess_conn.db_model, condition, function () {});
            //
            var resp_mess_conn = common.getSystemModel(req, DB_STRUCTURE.Message, Constant.COLLECTION_NAME.MESSAGE, res);
            dbOperator.delete_permanently(resp_mess_conn.db_model, {$or: [{from_user_id: {$nin: user_list}}, {to_user_ids: {$nin: user_list}}]}, function () {});
            // var resp_read_notif_conn = common.getSystemModel(req, DB_STRUCTURE., Constant.COLLECTION_NAME.READ_MESSAGE, res);
            // var resp_notif_conn = common.getSystemModel(req, DB_STRUCTURE.Notification, Constant.COLLECTION_NAME.READ_MESSAGE, res);
            var resp_sys_mem_conn = common.getSystemModel(req, DB_STRUCTURE.SystemMember, Constant.COLLECTION_NAME.SYSTEM_MEMBER, res);
            dbOperator.delete_permanently(resp_sys_mem_conn.db_model, {_id: {$nin: user_list}}, function () {});
            //
            var resp_sys_info_conn = common.getSystemModel(req, DB_STRUCTURE.SystemInfo, Constant.COLLECTION_NAME.SYSTEM_INFO, res);
            dbOperator.delete_permanently(resp_sys_info_conn.db_model, {user_id: {$nin: user_list}}, function () {});
        } else {
            res.rest.serverError();
        }
    });
});
//
module.exports = router;
