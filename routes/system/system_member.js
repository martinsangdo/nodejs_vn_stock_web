/**
 * author: Martin
 * @type {*}
 */
var express = require('express');
var router = express.Router();
var Constant = require('../../common/constant.js');
var Common = require('../../common/common.js');
var common = new Common();
var DB_STRUCTURE = require('../../models/system/DBStructure.js');
var DBOperater = require('../../models/db_operator.js');
var dbOperator = new DBOperater();
var config = require('../../config/setting')();

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
    //connect to specific system db
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.SystemMember, Constant.COLLECTION_NAME.SYSTEM_MEMBER, res);
    if (resp_conn.result == Constant.FAILED_CODE){
        res.rest.badRequest({
            message: resp_conn.message
        });
    } else {
        //search if user existed
        var valid_user_cond = {
            _id: user_id,
            $or: [{join_type: Constant.JOIN_TYPE.ACCEPTED}, {join_type: Constant.JOIN_TYPE.NONE}]
        };
        dbOperator.search_by_condition(resp_conn.db_model, valid_user_cond, {limit: 1, skip: 0}, '_id android_tokens encrypted_sys_common_key', {}, function (res_search) {
            if (res_search.result == Constant.OK_CODE){
                //check whether request has some information
                if (res_search.data.length > 0 && common.isNotEmpty(res_search.data[0]['_id'])){
                    //found 1 user
                    common.saveSessionLogin(req, req.headers[Constant.HEADER_PARAM.DB_NAME], res_search.data[0]['_id']);
                    // common.xlog('logined system', req.headers[Constant.HEADER_PARAM.DB_NAME]);
                    var new_token = common.trim(req.body[Constant.PARAM.ANDROID_TOKENS]);
                    add_new_token(resp_conn.db_model, res_search.data[0]['_id'], new_token, function(resp_add){
                        if (resp_add.result == Constant.OK_CODE){
                            //search system info
                            var resp_conn_sys = common.getSystemModel(req, DB_STRUCTURE.SystemInfo, Constant.COLLECTION_NAME.SYSTEM_INFO, res);
                            dbOperator.simple_search_by_condition(resp_conn_sys.db_model, {}, '', function (resp_search_sys) {
                                if (resp_search_sys.result == Constant.FAILED_CODE){
                                    res.rest.serverError();
                                } else {
                                    if (resp_search_sys.data.length == 0){
                                        res.rest.badRequest({
                                            message: Constant.SYSTEM_NOT_FOUND       //system is not existed
                                        });
                                    } else {
                                        var response = resp_search_sys.data[0];
                                        response = response.toObject();
                                        response['encrypted_sys_common_key'] = res_search.data[0]['encrypted_sys_common_key'];
                                        res.rest.success({
                                            data: {detail: response}
                                        });
                                    }
                                }
                            });
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
            } else {
                res.rest.serverError();
            }
        });
    }
});

/**
 * add new token to SystemMember, skip duplicate item
 * @param user_id
 */
function add_new_token(db_model, user_id, new_token, callback){
    var condition = {
        _id: user_id,
        android_tokens: {$ne: new_token}
    };
    var update_data = {
        $addToSet: {android_tokens: new_token}
    };
    dbOperator.update(db_model, condition, update_data, callback);
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
//connect to specific system db
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.SystemMember, Constant.COLLECTION_NAME.SYSTEM_MEMBER, res);
    if (resp_conn.result == Constant.FAILED_CODE){
        res.rest.badRequest({
            message: resp_conn.message
        });
    } else {
        //search if user existed
        dbOperator.search_by_condition(resp_conn.db_model, {_id: user_id}, {limit: 1, skip: 0}, '_id android_tokens', {}, function (res_search) {
            if (res_search.result == Constant.OK_CODE){
                //check whether request has some information
                if (res_search.data.length > 0 && common.isNotEmpty(res_search.data[0]['_id'])){
                    //found 1 user
                    common.removeSessionLogin(req, req.headers[Constant.HEADER_PARAM.DB_NAME]);
                    var android_token = common.trim(req.body[Constant.PARAM.ANDROID_TOKENS]);
                    remove_token(resp_conn.db_model, res_search.data[0]['_id'], android_token, function(resp_add){
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
            } else {
                res.rest.serverError();
            }
        });
    }
});
/**
 * remove token
 * @param user_id
 */
function remove_token(db_model, user_id, android_token, callback){
    var condition = {
        _id: user_id
    };
    var update_data = {
        $pull: {android_tokens: android_token}
    };
    dbOperator.update(db_model, condition, update_data, callback);
}
/*
 * update document in collection SystemMember
 */
router.put('/update_member_info', common.checkLLOGToken, function(req, res) {
    var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);
    if (common.isEmpty(user_id)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS       //missing parameters
        });
        return;
    }
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.SystemMember, Constant.COLLECTION_NAME.SYSTEM_MEMBER, res);
    if (resp_conn.result == Constant.FAILED_CODE){
        res.rest.badRequest({
            message: resp_conn.message
        });
    } else {
        var existed_condition = {_id: user_id};
        //search if user existed
        dbOperator.search_by_condition(resp_conn.db_model, existed_condition, {limit: 1, skip: 0}, '_id android_tokens', {}, function (res_search) {
            if (res_search.result == Constant.OK_CODE){
                var update_data = {     //this info will be updated to collection User
                };
                //check whether request has some information
                if (common.isNotEmpty(req.body[Constant.PARAM.AVATAR_ORG_SIZE_ID]) && common.isNotEmpty(req.body[Constant.PARAM.AVATAR_THUMB_SIZE_ID])){
                    update_data['cloud_avatar_id'] = {
                        org_size: common.trim(req.body[Constant.PARAM.AVATAR_ORG_SIZE_ID]),
                        thumb_size: common.trim(req.body[Constant.PARAM.AVATAR_THUMB_SIZE_ID])
                    };
                }

                if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.USER_NAME]))){
                    update_data['name'] = common.trim(req.body[Constant.PARAM.USER_NAME]);
                    update_data['plain_name'] = common.trim(req.body[Constant.PARAM.USER_NAME]).toLowerCase();
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
                if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.ENCRYPTED_SYS_COMMON_KEY]))){
                    update_data['encrypted_sys_common_key'] = common.trim(req.body[Constant.PARAM.ENCRYPTED_SYS_COMMON_KEY]);
                }
                if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.JOIN_TYPE]))){
                    update_data['join_type'] = common.trim(req.body[Constant.PARAM.JOIN_TYPE]);
                }
                if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.MY_SYS_CLOUD_ID]))){
                    update_data['my_sys_cloud_id'] = common.trim(req.body[Constant.MY_SYS_CLOUD_ID.MY_SYS_CLOUD_ID]);
                }
                if (res_search.data.length > 0 && common.isNotEmpty(res_search.data[0]['_id'])){
                    //update android token, if any
                    if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.ANDROID_TOKENS]))){
                        if (common.isNotEmpty(res_search.data[0]['android_tokens'])){
                            update_data['android_tokens'] = res_search.data[0]['android_tokens'];
                            if (res_search.data[0]['android_tokens'].indexOf(common.trim(req.body[Constant.PARAM.ANDROID_TOKENS])) < 0){       //not existed
                                update_data['android_tokens'].push(common.trim(req.body[Constant.PARAM.ANDROID_TOKENS]));   //insert more tokens
                            }
                        } else {
                            update_data['android_tokens'] = [common.trim(req.body[Constant.PARAM.ANDROID_TOKENS])];
                        }
                    }
                    //update to User, if any
                    if (common.get_obj_len(update_data) > 0){       //has something to update
                        update_data['update_time'] = new Date();
                        dbOperator.update(resp_conn.db_model, existed_condition, update_data, function(res_update){
                            if (res_update.result == Constant.OK_CODE){
                                res.rest.success();
                            } else {
                                res.rest.serverError();
                            }
                        });
                    } else {
                        res.rest.success();
                    }
                } else {
                    //user not found
                    res.rest.badRequest({
                        message: Constant.NOT_FOUND
                    });
                }
            } else {
                res.rest.serverError();
            }
        });
    }
});
/**
 * search members in system by condition (name AND/OR email), check profile_visibility too
 * case insensitive
 */
router.post('/search_members_by_condition', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])){
        res.rest.unauthorized();
        return;
    }
    var user_name = common.trim(req.body[Constant.PARAM.USER_NAME]);
    var email = common.trim(req.body[Constant.PARAM.EMAIL]);
    var search_type = common.trim(req.body[Constant.PARAM.SEARCH_TYPE]);
    var except_login_user = common.trim(req.body[Constant.PARAM.EXCEPT_LOGIN_USER]);
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
    if (common.isNotEmpty(except_login_user) && except_login_user){
        var user_id = common.getLoginedUserId(req);
        query_condition['_id'] = {$ne: user_id};
    }
    query_condition['profile_visibility'] = true;       //allow to search
    var paging = {
        limit:  common.isNotEmpty(common.trim(req.body[Constant.PARAM.LENGTH]))?parseInt(common.trim(req.body[Constant.PARAM.LENGTH])):Constant.DEFAULT_PAGE_LENGTH,
        skip:   common.isNotEmpty(common.trim(req.body[Constant.PARAM.OFFSET]))?parseInt(common.trim(req.body[Constant.PARAM.OFFSET])):0
    };
    var sort = {
        plain_name:1, name: 1
    };

    //connect to specific system db
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.SystemMember, Constant.COLLECTION_NAME.SYSTEM_MEMBER, res);
    if (resp_conn.result == Constant.FAILED_CODE){
        res.rest.badRequest({
            message: resp_conn.message
        });
    } else {
        dbOperator.search_by_condition(resp_conn.db_model, query_condition, paging, '_id name email cloud_avatar_id public_key edit_detail', sort, function (res_search){
            if (res_search.result == Constant.OK_CODE) {
                res.rest.success({
                    data: {list: res_search.data}
                });
            } else {
                res.rest.serverError();
            }
        });
    }
});
/**
 * get information of user in system
 */
router.post('/search_members_by_id', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])){
        res.rest.unauthorized();
        return;
    }
    var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);
    //validate input
    if (common.isEmpty(user_id)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS       //missing id
        });
        return;
    }
    var query_condition = {
        profile_visibility: true,
        _id: user_id
    };
    //connect to specific system db
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.SystemMember, Constant.COLLECTION_NAME.SYSTEM_MEMBER, res);
    if (resp_conn.result == Constant.FAILED_CODE){
        res.rest.badRequest({
            message: resp_conn.message
        });
    } else {
        var select_fields = 'name email cloud_avatar_id public_key encrypted_sys_common_key edit_detail';
        dbOperator.search_by_condition(resp_conn.db_model, query_condition, {limit: 1, skip:0}, select_fields, {}, function (res_search){
            if (res_search.result == Constant.OK_CODE) {
                res.rest.success({
                    data: {list: res_search.data}
                });
            } else {
                res.rest.serverError();
            }
        });
    }
});
/**
 * get information of user in group
 */
router.post('/get_group_member_info', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])){
        res.rest.unauthorized();
        return;
    }
    var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);
    var group_id = common.trim(req.body[Constant.PARAM.GROUP_ID]);
    //validate input
    if (common.isEmpty(user_id) || common.isEmpty(group_id)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    var query_condition = {
        group_id: group_id,
        user_id: user_id
    };
    if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.JOIN_TYPE]))){
        query_condition['join_type'] = common.trim(req.body[Constant.PARAM.JOIN_TYPE]);
    }
    //connect to specific system db
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.GroupMember, Constant.COLLECTION_NAME.GROUP_MEMBER, res);
    if (resp_conn.result == Constant.FAILED_CODE){
        res.rest.badRequest({
            message: resp_conn.message
        });
    } else {
        var select_fields = 'encrypted_group_common_key';
        dbOperator.search_by_condition(resp_conn.db_model, query_condition, {limit: 1, skip:0}, select_fields, {}, function (res_search){
            if (res_search.result == Constant.OK_CODE) {
                if (res_search.data.length > 0){
                    res.rest.success({
                        data: {detail: res_search.data[0]}
                    });
                } else {
                    res.rest.badRequest({
                        message: Constant.NOT_FOUND
                    });
                }
            } else {
                res.rest.serverError();
            }
        });
    }
});
/**
 * get all my notifications involving inside current system
 */
router.post('/get_my_notification_paging', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])){
        res.rest.unauthorized();
        return;
    }
    //required params
    // var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);
    var user_id = common.getLoginedUserId(req);      //logged user id
    //
    if (common.isEmpty(user_id)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    //get info of logged user
    get_sys_mem_info(req, res, {_id: user_id}, '_id', {}, function(res_search_sys_mem_info) {
        if (res_search_sys_mem_info.result == Constant.FAILED_CODE) {
            res.rest.badRequest({
                message: Constant.SERVER_ERR
            });
        } else if (res_search_sys_mem_info.data.length == 0) {
            res.rest.badRequest({
                message: Constant.USER_NOT_FOUND
            });
        } else {
            //get system notification or direct to me
            var query_condition = {
                $or: [{is_system_scope: true}, {to_user_ids: user_id}],
                from_user_id: {$ne: user_id}        //not from me
            };
            var paging = {
                limit:  common.isNotEmpty(common.trim(req.body[Constant.PARAM.LENGTH]))?parseInt(common.trim(req.body[Constant.PARAM.LENGTH])):Constant.DEFAULT_PAGE_LENGTH, //Constant.DEFAULT_PAGE_LENGTH,
                skip:   common.isNotEmpty(common.trim(req.body[Constant.PARAM.OFFSET]))?parseInt(common.trim(req.body[Constant.PARAM.OFFSET])):0
            };
            var sort = {
                update_time: -1
            };
            var resp_conn_notif = common.getSystemModel(req, DB_STRUCTURE.Notification, Constant.COLLECTION_NAME.NOTIFICATION, res);
            if (resp_conn_notif.result == Constant.FAILED_CODE){
                res.rest.badRequest({
                    message: resp_conn_notif.message
                });
            } else {
                var sel_fields = 'description group_id from_user_id is_system_scope type update_time';
                dbOperator.search_by_condition(resp_conn_notif.db_model, query_condition, paging, sel_fields, sort, function(res_search){
                    if (res_search.result == Constant.OK_CODE){
                        //found some notifications
                        var notif_num = res_search.data.length;
                        if (notif_num > 0){
                            //get detail of each notification
                            var notif_id, from_user_id, group_id;
                            var final_results = {};
                            var count = 0;      //count how many responses return
                            for (var i=0; i<notif_num; i++){
                                notif_id = res_search.data[i]['_id'];
                                final_results[notif_id] = res_search.data[i].toObject();       //keep it to update in async queries
                                from_user_id = res_search.data[i]['from_user_id'];
                                group_id = res_search.data[i]['group_id'];
                                //get info of from user
                                get_sys_mem_info(req, res, {_id: from_user_id}, 'name cloud_avatar_id email public_key edit_detail', {notif_id: notif_id, group_id: group_id}, function(res_sys_mem_info){
                                    if (res_sys_mem_info.result == Constant.FAILED_CODE){
                                        final_results[res_sys_mem_info.inj_keys.notif_id]['from_user_id'] = {_id: final_results[res_sys_mem_info.inj_keys.notif_id]['from_user_id']};
                                        count++;
                                    } else {
                                        if (res_sys_mem_info.data.length > 0){
                                            final_results[res_sys_mem_info.inj_keys.notif_id]['from_user_id'] = res_sys_mem_info.data[0];
                                        } else {
                                            final_results[res_sys_mem_info.inj_keys.notif_id]['from_user_id'] = {_id: final_results[res_sys_mem_info.inj_keys.notif_id]['from_user_id']};
                                        }
                                        if (common.isNotEmpty(res_sys_mem_info.inj_keys.group_id)) {
                                            //this notification involving to group
                                            //get group info
                                            get_group_info(req, res, {_id: res_sys_mem_info.inj_keys.group_id}, 'name cloud_avatar_id', res_sys_mem_info.inj_keys, function(res_group_info){
                                                if (res_group_info.result == Constant.FAILED_CODE){
                                                    final_results[res_group_info.inj_keys.notif_id]['group_id'] = null;     //set group info = null because of error
                                                } else {
                                                    final_results[res_group_info.inj_keys.notif_id]['group_id'] = res_group_info.data[0];
                                                }
                                                count++;
                                                if (count == notif_num){
                                                    common.reform_notif_response_format(res, final_results);
                                                }
                                            });
                                        } else {
                                            //this notification involving to system
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
                                data: {list: res_search.data}       //empty list
                            });
                        }
                    } else {
                        res.rest.badRequest({
                            message: Constant.SERVER_ERR
                        });
                    }
                });
            }
        }
    });
});
//get system member info
function get_sys_mem_info(req, res, condition, field, keys, callback){
    var resp_conn_sys_mem = common.getSystemModel(req, DB_STRUCTURE.SystemMember, Constant.COLLECTION_NAME.SYSTEM_MEMBER, res);
    if (resp_conn_sys_mem.result == Constant.FAILED_CODE){    //cannot connect system DB
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn_sys_mem.message
        });
    } else {
        dbOperator.simple_search_by_condition_w_keys(resp_conn_sys_mem.db_model, condition, field, keys, callback);
    }
}
//search group info
function get_group_info(req, res, condition, field, keys, callback){
    var resp_conn_group = common.getSystemModel(req, DB_STRUCTURE.Group, Constant.COLLECTION_NAME.GROUP, res);
    if (resp_conn_group.result == Constant.FAILED_CODE){    //cannot connect system DB
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn_group.message
        });
    } else {
        dbOperator.simple_search_by_condition_w_keys(resp_conn_group.db_model, condition, field, keys, callback);
    }
}
//update status "read" of each notification
router.put('/update_my_read_notif_time', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])){
        res.rest.unauthorized();
        return;
    }
    //required params
    var user_id = common.getLoginedUserId(req);      //logged user id
    // var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);
    var notif_ids = common.trim(req.body[Constant.PARAM.NOTIF_IDS]);
    //
    if (common.isEmpty(user_id) || common.isEmpty(notif_ids)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    notif_ids = JSON.parse(notif_ids);
    //
    if (notif_ids.length == 0){
        res.rest.success();
        return;
    }
    var resp_conn_read_notif = common.getSystemModel(req, DB_STRUCTURE.ReadNotification, Constant.COLLECTION_NAME.READ_NOTIFICATION, res);
    if (resp_conn_read_notif.result == Constant.FAILED_CODE){    //cannot connect system DB
        res.rest.badRequest({
            result: Constant.FAILED_CODE,
            message: resp_conn_read_notif.message
        });
    } else {
        //
        for (var i=0; i<notif_ids.length; i++){
            var upsert_cond = {
                user_id: user_id,
                notification_id: notif_ids[i]
            };
            var upsert_doc = {
                user_id: user_id,
                notification_id: notif_ids[i],
                read: true,
                update_time: new Date()
            };
            dbOperator.upsert(resp_conn_read_notif.db_model, upsert_cond, upsert_doc, function(){});
        }
        res.rest.success();
    }
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
    var existed_condition = {_id: user_id};
    var resp_conn_sys_mem = common.getSystemModel(req, DB_STRUCTURE.SystemMember, Constant.COLLECTION_NAME.SYSTEM_MEMBER, res);
    if (resp_conn_sys_mem.result == Constant.FAILED_CODE){    //cannot connect system DB
        res.rest.badRequest({
            result: Constant.FAILED_CODE,
            message: resp_conn_sys_mem.message
        });
    } else {
        //check if user existed
        dbOperator.search_by_condition(resp_conn_sys_mem.db_model, existed_condition, {
            limit: 1,
            skip: 0
        }, '_id name email edit_detail', {}, function (result) {
            if (result.result == Constant.OK_CODE) {
                if (result.data.length > 0 && common.isNotEmpty(result.data[0]['_id'])) {
                    //found 1 user
                    var update_data = {     //this info will be updated to collection User
                    };
                    var last_message_update_data = {}; // //this info will be updated to collection LastMessage
                    var currentDate = new Date();
                    if (common.isNotEmpty(result.data[0]['edit_detail'])) {
                        var edit_detail = result.data[0]['edit_detail'];
                    } else {
                        var edit_detail = {
                            name: currentDate, avatar: currentDate
                        };
                    }
                    if (common.isNotEmpty(fullname)) {
                        update_data['name'] = fullname;
                        update_data['plain_name'] = fullname.toLowerCase();
                        //update edit time in DB
                        edit_detail['name'] = currentDate;
                        //update name in collection LastMessage
                        last_message_update_data['name'] = fullname;
                        //update LastMessage
                        update_last_message(req, res, result.data[0]['_id'], result.data[0].email, last_message_update_data);

                    }
                    //check whether request has some information
                    if (common.isNotEmpty(is_edit_avatar) && is_edit_avatar > 0) {
                        if (common.isNotEmpty(avatar_org_size_id) && common.isNotEmpty(avatar_thumb_size_id)) {
                            update_data['cloud_avatar_id'] = {
                                org_size: avatar_org_size_id,
                                thumb_size: avatar_thumb_size_id
                            };

                            //update cloud_avatar_id in collection LastMessage
                            last_message_update_data['cloud_avatar_id'] = {
                                org_size: avatar_org_size_id,
                                thumb_size: avatar_thumb_size_id
                            };
                            //update LastMessage
                            update_last_message(req, res, result.data[0]['_id'], result.data[0].email, last_message_update_data);

                        }
                        //update edit time in DB
                        edit_detail['avatar'] = currentDate;
                        common.dlog('Received request to update user avatar, system: ' + req.headers[Constant.HEADER_PARAM.DB_NAME]);
                    }
                    update_data['edit_detail'] = edit_detail;
                    //update to User, if any
                    if (common.get_obj_len(update_data) > 0) {       //has something to update
                        update_data['update_time'] = new Date();
                        dbOperator.update(resp_conn_sys_mem.db_model, existed_condition, update_data, function (res_update) {
                            if (res_update.result == Constant.OK_CODE) {
                                common.dlog('Updated user info successfully, system: ' + req.headers[Constant.HEADER_PARAM.DB_NAME]);
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
    } //end resps_conn_sys_mem
});
//

/*
*  function update receiver & sender in collection last_message
*/
function update_last_message(req, res, user_id, user_email, last_message_update_data) {
    var resp_conn_last_message = common.getSystemModel(req, DB_STRUCTURE.LastMessage, Constant.COLLECTION_NAME.LAST_MESSAGE, res);
    if(resp_conn_last_message.result == Constant.OK_CODE) {
        var last_message_existed_condition = {"first_receiver_info.email": user_email};
        var last_message_update_data_receiver = {};
        if (common.isEmpty(last_message_update_data['cloud_avatar_id']) && common.isNotEmpty(last_message_update_data['name'])) {
            last_message_update_data_receiver = {
                $set: {
                    "first_receiver_info.name": last_message_update_data['name']
                }
            };
        }
        else if (common.isEmpty(last_message_update_data['name']) && common.isNotEmpty(last_message_update_data['cloud_avatar_id'])) {
            last_message_update_data_receiver = {
                $set: {
                    "first_receiver_info.cloud_avatar_id": last_message_update_data['cloud_avatar_id']
                }
            };
        }
        else {
            last_message_update_data_receiver = {
                $set: {
                    "first_receiver_info.name": last_message_update_data['name'],
                    "first_receiver_info.cloud_avatar_id": last_message_update_data['cloud_avatar_id']
                }
            };
        }

        dbOperator.update(resp_conn_last_message.db_model, last_message_existed_condition, last_message_update_data_receiver, function (last_message_res_updater) {

        });
        //end update LastMessage for first_receiver_info

        var last_message_existed_condition = {"first_sender_info.email": user_email};
        var last_message_update_data_sender = {};
        if (common.isEmpty(last_message_update_data['cloud_avatar_id']) && common.isNotEmpty(last_message_update_data['name'])) {
            last_message_update_data_sender = {
                $set: {
                    "first_sender_info.name": last_message_update_data['name']
                }
            };
        }
        else if (common.isEmpty(last_message_update_data['name']) && common.isNotEmpty(last_message_update_data['cloud_avatar_id'])) {
            last_message_update_data_sender = {
                $set: {
                    "first_sender_info.cloud_avatar_id": last_message_update_data['cloud_avatar_id']
                }
            };
        }
        else {
            last_message_update_data_sender = {
                $set: {
                    "first_sender_info.name": last_message_update_data['name'],
                    "first_sender_info.cloud_avatar_id": last_message_update_data['cloud_avatar_id']
                }
            };
        }

        dbOperator.update(resp_conn_last_message.db_model, last_message_existed_condition, last_message_update_data_sender, function (last_message_res_updater) {

        });
        //end update LastMessage for first_receiver_info

        //========== update creator_name if needed
        if (common.isNotEmpty(last_message_update_data['name'])) {
            var last_message_existed_condition = {"creator_id": user_id};
            var last_message_update_data_creator = {
                $set: {
                    "creator_name": last_message_update_data['name']
                }
            };
            dbOperator.update(resp_conn_last_message.db_model, last_message_existed_condition, last_message_update_data_creator, function (last_message_res_updater) {

            });
        }

    }// end resp_conn_last_message
}

module.exports = router;
