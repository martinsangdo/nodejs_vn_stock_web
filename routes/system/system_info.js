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
/*
 * insert new system, create new DB
 */
router.put('/create_new', common.checkLLOGToken, function(req, res) {
    //required params
    var email = common.trim(req.body[Constant.PARAM.EMAIL]);        //owner's email
    var system_name = common.trim(req.body[Constant.PARAM.NAME]);
    //get system info
    var system_db_address = req.headers[Constant.HEADER_PARAM.DB_ADDR];
    var system_db_name = req.headers[Constant.HEADER_PARAM.DB_NAME];
    var system_db_username = req.headers[Constant.HEADER_PARAM.DB_USERNAME];
    var system_db_password = req.headers[Constant.HEADER_PARAM.DB_PASSWORD];

    //do not check user id here
    if (common.isEmpty(email) || common.isEmpty(system_db_address) || common.isEmpty(system_db_name) || common.isEmpty(system_name)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS       //missing parameter
        });
        return;
    }
    common.tryConnectDB(system_db_username, system_db_password, system_db_address, system_db_name, function(conn_status){
        if (conn_status == Constant.OK_CODE){
            var existed_condition = {       //condition to verify whether system was existed in db or not
                db_server_link: system_db_address,
                db_id_name: system_db_name
            };
            //connect to specific system db
            var resp_conn = common.getSystemModel(req, DB_STRUCTURE.SystemInfo, Constant.COLLECTION_NAME.SYSTEM_INFO, res);
            if (resp_conn.result == Constant.FAILED_CODE){
                res.rest.badRequest({
                        message: resp_conn.message
                });
            } else {
                dbOperator.search_by_condition(resp_conn.db_model, existed_condition, {limit:1, skip:0}, '_id', {}, function (res_search){
                    if (res_search.result == Constant.OK_CODE){
                        if (res_search.data.length > 0 && common.isNotEmpty(res_search.data[0]['_id'])){
                            //found 1 system, do not allow to create new one
                            res.rest.badRequest({
                                message: Constant.EXISTED
                            });
                        } else {
                            common.dlog("========== [System] begin to create system: " + system_db_name);
                            create_new_system_document(req, res);
                        }
                    } else {
                        //db error
                        res.rest.serverError();
                    }
                });
            }
        } else {
            //cannot connect to system db
            res.rest.badRequest({
                message: Constant.SYSTEM_ADDRESS_NOT_FOUND
            });
        }
    });
});
/**
 * create new document in collection SystemInfo & SystemMember
 * @param req
 * @param res
 * @param db_server_link
 * @param db_id_name
 * @param user_id
 */
function create_new_system_document(req, res){
    var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);    //owner of this system
    var system_name = common.trim(req.body[Constant.PARAM.NAME]);
    //create document in SystemMember firstly
    var owner_info = {     //info of system owner
        user_id:    user_id,        //to make sure _id in system db & lldb should be same
        name:   common.trim(req.body[Constant.PARAM.USER_NAME]),
        plain_name: common.trim(req.body[Constant.PARAM.USER_NAME]).toLowerCase(),
        email:  common.trim(req.body[Constant.PARAM.EMAIL]),
        android_tokens: [common.trim(req.body[Constant.PARAM.ANDROID_TOKENS])],
        public_key: common.trim(req.body[Constant.PARAM.PUBLIC_KEY]),
        join_type:  Constant.JOIN_TYPE.NONE,        //he is owner of this system
        is_co_admin:    true,       //he is owner of this system
        encrypted_sys_common_key:   common.trim(req.body[Constant.PARAM.ENCRYPTED_SYS_COMMON_KEY])
    };
    create_new_system_member(req, res, owner_info, function(resp_create_member){
        if (resp_create_member.result == Constant.OK_CODE) {
            var new_sys_doc = {     //this info will be added to collection SystemInfo
                name: system_name,
                plain_name: system_name.toLowerCase(),
                db_server_link: req.headers[Constant.HEADER_PARAM.DB_ADDR],
                db_id_name: req.headers[Constant.HEADER_PARAM.DB_NAME],
                member_num  : 1         //system owner
            };
            if (common.isNotEmpty(user_id)) {
                new_sys_doc['user_id'] = user_id;
            } else {
                new_sys_doc['user_id'] = resp_create_member['_id'];
            }
            if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.SYSTEM_ID]))) {
                new_sys_doc['_id'] = common.trim(req.body[Constant.PARAM.SYSTEM_ID]);     //_id in LLOG DB & System db should be same
            }
            if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.ABOUT]))) {
                new_sys_doc['about'] = common.trim(req.body[Constant.PARAM.ABOUT]);
            }
            if (common.isNotEmpty(req.headers[Constant.HEADER_PARAM.DB_USERNAME])) {
                new_sys_doc['db_username'] = req.headers[Constant.HEADER_PARAM.DB_USERNAME];
            }
            if (common.isNotEmpty(req.headers[Constant.HEADER_PARAM.DB_PASSWORD])) {
                new_sys_doc['db_password'] = req.headers[Constant.HEADER_PARAM.DB_PASSWORD];
            }

            //connect to specific system db
            var resp_conn = common.getSystemModel(req, DB_STRUCTURE.SystemInfo, Constant.COLLECTION_NAME.SYSTEM_INFO, res);
            if (resp_conn.result == Constant.FAILED_CODE){
                res.rest.badRequest({
                    message: resp_conn.message
                });
            } else {
                dbOperator.create(resp_conn.db_model, new_sys_doc, function (res_sys_create){
                    if (res_sys_create.result == Constant.OK_CODE) {     //created new document in collection SystemInfo
                        //now create new document in collection SystemInfo
                        //send back result to client
                        res.rest.success({
                            data: {
                                system_id: res_sys_create['_id']      //new created system id
                            }
                        });
                    } else {
                        res.rest.serverError();
                    }
                });
            }
        } else {
            res.rest.serverError({message: resp_create_member.message});
        }
    });
}
/**
 * create new document in collection SystemMember
 * @param member_info
 * @param callback
 */
function create_new_system_member(req, res, member_info, callback){
    var new_doc = {
        email: member_info[Constant.PARAM.EMAIL]
    };
    if (common.isNotEmpty(member_info[Constant.PARAM.USER_ID])) {
        new_doc['_id'] = member_info[Constant.PARAM.USER_ID];       //to make sure _id in system db & lldb should be same
    }
    if (common.isNotEmpty(member_info[Constant.PARAM.NAME])) {
        new_doc['name'] = member_info[Constant.PARAM.NAME];
        new_doc['plain_name'] = member_info[Constant.PARAM.NAME].toLowerCase();
    }
    if (common.isNotEmpty(member_info[Constant.PARAM.JOIN_TYPE])) {
        new_doc['join_type'] = member_info[Constant.PARAM.JOIN_TYPE];
    }
    if (common.isNotEmpty(member_info[Constant.PARAM.PUBLIC_KEY])) {
        new_doc['public_key'] = member_info[Constant.PARAM.PUBLIC_KEY];
    }
    if (common.isNotEmpty(member_info[Constant.PARAM.ENCRYPTED_SYS_COMMON_KEY])) {
        new_doc['encrypted_sys_common_key'] = member_info[Constant.PARAM.ENCRYPTED_SYS_COMMON_KEY];
    }
    if (common.isNotEmpty(member_info[Constant.PARAM.IS_CO_ADMIN])) {
        new_doc['is_co_admin'] = member_info[Constant.PARAM.IS_CO_ADMIN];
    }
    if (common.isNotEmpty(member_info[Constant.PARAM.ANDROID_TOKENS])) {
        new_doc['android_tokens'] = [member_info[Constant.PARAM.ANDROID_TOKENS]];
    }

    //connect to specific system db
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.SystemMember, Constant.COLLECTION_NAME.SYSTEM_MEMBER, res);
    if (resp_conn.result == Constant.FAILED_CODE){
        callback({result:Constant.FAILED_CODE, message: resp_conn.message});
    } else {
        var existed_condition = {email: member_info[Constant.PARAM.EMAIL]};
        dbOperator.simple_search_by_condition(resp_conn.db_model, existed_condition, '_id', function(res_search){
            if (res_search.result == Constant.OK_CODE && common.isNotEmpty(res_search.data[0]) &&
                    common.isNotEmpty(res_search.data[0]['_id'])){
                //update document
                dbOperator.update(resp_conn.db_model, existed_condition, new_doc, function (res_upsert){
                    if (res_upsert.result == Constant.OK_CODE){
                        callback({result:Constant.OK_CODE, _id: res_upsert['_id']});
                    } else {
                        callback({result:Constant.FAILED_CODE, message: Constant.SERVER_ERR});
                    }
                });
            } else {
                //not found, insert one
                dbOperator.create(resp_conn.db_model, new_doc, function (res_upsert){
                    if (res_upsert.result == Constant.OK_CODE){
                        callback({result:Constant.OK_CODE, _id: res_upsert['_id']});
                    } else {
                        callback({result:Constant.FAILED_CODE, message: Constant.SERVER_ERR});
                    }
                });
            }
        });
    }
}
/*
 * user accepts to join a system OR ADMIN accepts new member to join his system
 * because Admin can accept from Notification list so that don't need login
 */
router.put('/create_new_system_member', common.checkLLOGToken, function(req, res) {
    var email = common.trim(req.body[Constant.PARAM.EMAIL]);
    var system_id = common.trim(req.body[Constant.PARAM.SYSTEM_ID]);
    if (common.isEmpty(system_id) || common.isEmpty(email)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS       //system is not existed
        });
        return;
    }

    //connect to specific system db
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.SystemInfo, Constant.COLLECTION_NAME.SYSTEM_INFO, res);
    if (resp_conn.result == Constant.FAILED_CODE){
        res.rest.badRequest({
            message: resp_conn.message       //system is not existed
        });
    } else {
        dbOperator.search_by_condition(resp_conn.db_model, {_id: system_id}, {limit: 1, skip: 0}, 'member_num', {}, function (response_sys_info) {
            if (response_sys_info.result == Constant.FAILED_CODE){
                if (response_sys_info.name == Constant.CAST_ERROR &&
                    (response_sys_info.kind == Constant.ObjectID || response_sys_info.kind == Constant.ObjectId)) {
                    res.rest.badRequest({
                        message: Constant.SYSTEM_NOT_FOUND
                    });
                } else {
                    res.rest.serverError();
                }
            } else {
                if (response_sys_info.data.length == 0){
                    res.rest.badRequest({
                        message: Constant.NOT_EXISTED       //system is not existed
                    });
                } else {
                    //system existed, add new user to collection SystemMember
                    var member_info = {
                        user_id:    common.trim(req.body[Constant.PARAM.USER_ID]),
                        name:   common.trim(req.body[Constant.PARAM.USER_NAME]),
                        plain_name:   common.trim(req.body[Constant.PARAM.USER_NAME]).toLowerCase(),
                        email:  email,
                        public_key: common.trim(req.body[Constant.PARAM.PUBLIC_KEY]),
                        join_type:  Constant.JOIN_TYPE.ACCEPTED,        //fix code
                        is_co_admin:    common.trim(req.body[Constant.PARAM.IS_CO_ADMIN]),
                        encrypted_sys_common_key:   common.trim(req.body[Constant.PARAM.ENCRYPTED_SYS_COMMON_KEY])
                    };
                    if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.ANDROID_TOKENS]))){
                        var token_arr = common.trim(req.body[Constant.PARAM.ANDROID_TOKENS]).split(Constant.COMMA);
                        member_info['android_tokens'] = token_arr;
                    }
                    //avatar
                    if (common.isNotEmpty(req.body[Constant.PARAM.AVATAR_ORG_SIZE_ID]) && common.isNotEmpty(req.body[Constant.PARAM.AVATAR_THUMB_SIZE_ID])){
                        member_info['cloud_avatar_id'] = {
                            org_size: common.trim(req.body[Constant.PARAM.AVATAR_ORG_SIZE_ID]),
                            thumb_size: common.trim(req.body[Constant.PARAM.AVATAR_THUMB_SIZE_ID])
                        };
                    }

                    create_new_system_member(req, res, member_info, function (response_create) {
                        if (response_create.result == Constant.OK_CODE){
                            //TODO: save & send Push Notification
                            //increase number of members in the system
                            dbOperator.update(resp_conn.db_model, {_id: system_id}, {$inc: {member_num: 1}, update_time: new Date()}, function(resp_update){
                                if (resp_update.result == Constant.OK_CODE){
                                    res.rest.success();     //finish
                                } else {
                                    res.rest.serverError();
                                }
                            });
                        } else if (response_create.result == Constant.FAILED_CODE){
                            res.rest.serverError();
                        } else {
                            res.rest.badRequest({
                                message: response_create.result
                            });
                        }
                    });
                }
            }
        });
    }
});
/**
 *  update some info of system
 */
router.put('/update_system_info', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])){
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
    //connect to specific system db
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.SystemInfo, Constant.COLLECTION_NAME.SYSTEM_INFO, res);
    if (resp_conn.result == Constant.FAILED_CODE){
        res.rest.badRequest({
            message: resp_conn.message       //system is not existed
        });
    } else {
        dbOperator.search_by_condition(resp_conn.db_model, {_id: system_id}, {limit: 1, skip: 0}, '_id', {}, function (response_sys_info) {
            if (response_sys_info.result == Constant.FAILED_CODE){
                if (response_sys_info.name == Constant.CAST_ERROR &&
                    (response_sys_info.kind == Constant.ObjectID || response_sys_info.kind == Constant.ObjectId)) {
                    res.rest.badRequest({
                        message: Constant.SYSTEM_NOT_FOUND
                    });
                } else {
                    res.rest.serverError();
                }
            } else {
                if (response_sys_info.data.length == 0){
                    res.rest.badRequest({
                        message: Constant.SYSTEM_NOT_FOUND       //system is not existed
                    });
                } else {
                    //found 1 system, update it
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
                    if (common.get_obj_len(update_data) > 0){       //has something to update
                        update_data['update_time'] = new Date();
                        dbOperator.update(resp_conn.db_model, {_id: system_id}, update_data, function(res_update){
                            if (res_update.result == Constant.OK_CODE){
                                res.rest.success();
                            } else {
                                res.rest.serverError();
                            }
                        });
                    } else {
                        res.rest.success();
                    }
                }
            }
        });
    }
});
/**
 *  get system info of which I joined
 *  used when accept join this system
 */
router.post('/get_my_joined_system_info', common.checkLLOGToken, function(req, res) {
    //required params
    var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);
    var system_id = common.trim(req.body[Constant.PARAM.SYSTEM_ID]);
    //
    if (common.isEmpty(system_id) || common.isEmpty(user_id)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }

    //connect to specific system db
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.SystemMember, Constant.COLLECTION_NAME.SYSTEM_MEMBER, res);
    if (resp_conn.result == Constant.FAILED_CODE){
        res.rest.badRequest({
            message: resp_conn.message     //cannot connect
        });
    } else {
        dbOperator.simple_search_by_condition(resp_conn.db_model, {_id: user_id}, 'encrypted_sys_common_key', function (resp_search_mem) {
            if (resp_search_mem.result == Constant.FAILED_CODE){
                if (resp_search_mem.name == Constant.CAST_ERROR && (resp_search_mem.kind == Constant.ObjectID || resp_search_mem.kind == Constant.ObjectId)) {
                    //user not found
                    res.rest.badRequest({
                        message: Constant.USER_NOT_FOUND
                    });
                } else {
                    res.rest.serverError();
                }
            } else {
                if (resp_search_mem.data.length == 0){
                    res.rest.badRequest({
                        message: Constant.USER_NOT_FOUND       //system member is not existed
                    });
                } else {
                    //search system info
                    var resp_conn_sys = common.getSystemModel(req, DB_STRUCTURE.SystemInfo, Constant.COLLECTION_NAME.SYSTEM_INFO, res);
                    dbOperator.simple_search_by_condition(resp_conn_sys.db_model, {_id: system_id}, '', function (resp_search_sys) {
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
                                response['encrypted_sys_common_key'] = resp_search_mem.data[0]['encrypted_sys_common_key'];
                                res.rest.success({
                                    data: {detail: response}
                                });
                            }
                        }
                    });
                }
            }
        });
    }
});
/**
 * get total of unread records in a system
 */
router.post('/get_unread_records_num', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])){
        res.rest.unauthorized();
        return;
    }
    //required params
    var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);
    //
    if (common.isEmpty(user_id)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    var resp_conn_record = common.getSystemModel(req, DB_STRUCTURE.Record, Constant.COLLECTION_NAME.RECORD, res);
    if (resp_conn_record.result == Constant.FAILED_CODE){    //cannot connect system DB
        res.rest.badRequest({
            result: Constant.FAILED_CODE,
            message: resp_conn_record.message
        });
    } else {
        //search all records which I can read
        get_all_my_joined_groups(req, res, user_id, function(res_my_groups){
            var search_cond = {
                visibility: true,
                user_id: {$ne: user_id}     //not my posts
            };
            if (res_my_groups.data != null && res_my_groups.data.length > 0) {
                //found some groups
                var my_group_ids = new Array();
                for (var j=0; j<res_my_groups.data.length; j++){
                    my_group_ids.push(res_my_groups.data[j]['group_id']);
                }
                search_cond['$or'] = [{is_system_scope: true}, {group_id: {$in: my_group_ids}}];
            } else {
                search_cond['is_system_scope'] = true;
            }
            //search all records in this system
            dbOperator.search_all_by_condition(resp_conn_record.db_model, search_cond, '_id', {}, function (res_search){
                if (res_search.result == Constant.FAILED_CODE){
                    res.rest.badRequest({
                        result: Constant.FAILED_CODE,
                        message: Constant.SERVER_ERR
                    });
                } else if (res_search.data.length == 0){
                    res.rest.success({
                        result: Constant.OK_CODE,
                        data: 0
                    });
                } else {
                    var record_total = res_search.data.length;      //total record number of system scope
                    //must find how many records I haven't read yet
                    var resp_conn_read_record = common.getSystemModel(req, DB_STRUCTURE.ReadRecord, Constant.COLLECTION_NAME.READ_RECORD, res);
                    if (resp_conn_record.result == Constant.FAILED_CODE){    //cannot connect system DB
                        res.rest.badRequest({
                            result: Constant.FAILED_CODE,
                            message: resp_conn_read_record.message
                        });
                    } else {
                        //count how many records which user read
                        var record_array = new Array();
                        for (var i=0; i<record_total; i++){
                            record_array.push(res_search.data[i]['_id']);
                        }
                        var cond = {
                            user_id: user_id,
                            read: true,
                            record_id: {$in: record_array}
                        };
                        dbOperator.count_by_condition(resp_conn_read_record.db_model, cond, function(res_count){
                            if (res_count.result == Constant.FAILED_CODE){
                                res.rest.badRequest({
                                    result: Constant.FAILED_CODE,
                                    message: Constant.SERVER_ERR
                                });
                            } else {
                                res.rest.success({
                                    result: Constant.OK_CODE,
                                    data: record_total - res_count.data
                                });
                            }
                        });
                    }
                }
            });
        });
    }
});
//get all joined groups
function get_all_my_joined_groups(req, res, user_id, callback){
    var condition = {
        user_id: user_id,
        $or: [{join_type: Constant.JOIN_TYPE.ACCEPTED}, {join_type: Constant.JOIN_TYPE.NONE}],
        encrypted_group_common_key: {$ne: null}     //must have valid key
    };
    var resp_conn_group_mem = common.getSystemModel(req, DB_STRUCTURE.GroupMember, Constant.COLLECTION_NAME.GROUP_MEMBER, res);
    if (resp_conn_group_mem.result == Constant.FAILED_CODE){    //cannot connect system DB
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn_group_mem.message
        });
    } else {
        dbOperator.simple_search_by_condition(resp_conn_group_mem.db_model, condition, 'group_id', callback);
    }
}
//get member list paging
function get_sys_mem_paging(req, res, condition, paging, fields, sort, callback){
    var resp_conn_sys_mem = common.getSystemModel(req, DB_STRUCTURE.SystemMember, Constant.COLLECTION_NAME.SYSTEM_MEMBER, res);
    if (resp_conn_sys_mem.result == Constant.FAILED_CODE){    //cannot connect system DB
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn_sys_mem.message
        });
    } else {
        dbOperator.search_by_condition(resp_conn_sys_mem.db_model, condition, paging, fields, sort, callback);
    }
}
//get group member list paging
function get_group_mem_paging(req, res, condition, paging, fields, sort, callback){
    var resp_conn_group_mem = common.getSystemModel(req, DB_STRUCTURE.GroupMember, Constant.COLLECTION_NAME.GROUP_MEMBER, res);
    if (resp_conn_group_mem.result == Constant.FAILED_CODE){    //cannot connect system DB
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn_group_mem.message
        });
    } else {
        dbOperator.search_by_condition(resp_conn_group_mem.db_model, condition, paging, fields, sort, callback);
    }
}
//get group list paging with relationship to current user
function get_group_paging_with_rel(req, res, user_id, condition, paging, fields, sort, callback){
    var resp_conn_group = common.getSystemModel(req, DB_STRUCTURE.Group, Constant.COLLECTION_NAME.GROUP, res);
    if (resp_conn_group.result == Constant.FAILED_CODE){    //cannot connect system DB
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn_group.message
        });
    } else {
        dbOperator.search_by_condition(resp_conn_group.db_model, condition, paging, fields, sort, function(resp_group_list){
            if (resp_group_list.result == Constant.FAILED_CODE){
                callback(resp_group_list);
            } else {
                var group_len = resp_group_list.data.length;
                if (group_len == 0){
                    callback(resp_group_list);
                } else {
                    var final_response = {};
                    var count = 0;
                    for (var i=0; i<group_len; i++){
                        final_response[resp_group_list.data[i]['_id']] = resp_group_list.data[i].toObject();       //keep group info
                        get_group_mem_paging(req, res, {user_id: user_id, group_id: resp_group_list.data[i]['_id']},
                            {limit:1, skip:0}, 'group_id join_type', {}, function(resp_group_mem_info){
                            if (resp_group_mem_info.result == Constant.OK_CODE && resp_group_mem_info.data.length > 0 &&
                                common.isNotEmpty(resp_group_mem_info.data[0]['join_type'])){
                                final_response[resp_group_mem_info.data[0]['group_id']]['join_type'] = resp_group_mem_info.data[0]['join_type']
                            }
                            //
                            if (++count == group_len){
                                var array = common.convert_obj_to_array(final_response);
                                //got all results
                                callback({
                                    result: Constant.OK_CODE,
                                    data: array
                                });
                            }
                        });
                    }
                }
            }
        });
    }
}
/**
 * get info of system to show in Profile page
 */
router.post('/get_info_by_id', common.checkLLOGToken, function(req, res) {
    var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);        //for unit testing
    //
    var system_id = common.trim(req.body[Constant.PARAM.SYSTEM_ID]);
    if (common.isEmpty(user_id) || common.isEmpty(system_id)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    var is_get_mem_list = common.trim(req.body[Constant.PARAM.IS_GET_MEM_LIST]);
    is_get_mem_list = is_get_mem_list == true || is_get_mem_list == 'true';     //get list of system members or not
    var is_get_group_list = common.trim(req.body[Constant.PARAM.IS_GET_GROUP_LIST]);
    is_get_group_list = is_get_group_list == true || is_get_group_list == 'true';       //get list of groups or not
    //
    var resp_conn_sys_info = common.getSystemModel(req, DB_STRUCTURE.SystemInfo, Constant.COLLECTION_NAME.SYSTEM_INFO, res);
    if (resp_conn_sys_info.result == Constant.FAILED_CODE){    //cannot connect system DB
        res.rest.badRequest({
            result: Constant.FAILED_CODE,
            message: resp_conn_sys_info.message
        });
    } else {
        //search system info
        dbOperator.simple_search_by_condition(resp_conn_sys_info.db_model, {_id: system_id}, '', function(resp_sys_info){
            if (resp_sys_info.result == Constant.FAILED_CODE) {
                res.rest.badRequest({
                    message: Constant.SERVER_ERR
                });
            } else if (resp_sys_info.data.length == 0){
                res.rest.success({data: {detail: {}}});     //no info
            } else {
                var final_response = {      //final response back to app
                    detail: resp_sys_info.data[0]
                };
                //search relationship between me & current system
                get_sys_mem_paging(req, res, {_id:user_id}, {limit:1, skip:0}, 'join_type encrypted_sys_common_key edit_detail', {plain_name:1, name: 1}, function (resp_my_sys_mem) {
                    if (resp_my_sys_mem.result == Constant.FAILED_CODE){
                        //cannot retrieve my relationship
                        res.rest.success({data: final_response});
                    } else {
                        if (common.isNotEmpty(resp_my_sys_mem.data) && resp_my_sys_mem.data.length > 0){
                            final_response['rel'] = resp_my_sys_mem.data[0];
                        }
                        //if user logined into this system, get extra members/groups list
                        if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])) {
                            //get neither member & group list
                            res.rest.success({data: final_response});
                        } else {
                            //check whether get extra list
                            if (is_get_mem_list && is_get_group_list){
                                //get both group list & member list
                                var mem_condition = {
                                    profile_visibility: true,
                                    _id: {$ne: user_id}          //get valid users, except myself
                                };
                                get_sys_mem_paging(req, res, mem_condition, {limit:Constant.DEFAULT_PAGE_LENGTH, skip:0},
                                    'name email cloud_avatar_id public_key encrypted_sys_common_key join_type edit_detail', {plain_name:1, name: 1}, function (resp_mem_list) {
                                        if (resp_mem_list.result == Constant.OK_CODE){
                                            final_response['mem_list'] = resp_mem_list.data;
                                        }
                                        //get extra group list
                                        var group_condition = {
                                            profile_visibility: true
                                        };
                                        get_group_paging_with_rel(req, res, user_id, group_condition, {limit:Constant.DEFAULT_PAGE_LENGTH, skip:0},
                                            'name cloud_avatar_id', {plain_name:1, name: 1}, function (resp_group_list) {
                                                if (resp_group_list.result == Constant.OK_CODE){
                                                    final_response['group_list'] = resp_mem_list.data;
                                                }
                                                res.rest.success({data: final_response});
                                            });
                                    });
                            } else if (is_get_mem_list){
                                //get extra member list
                                var mem_condition = {
                                    profile_visibility: true,
                                    _id: {$ne: user_id}          //get valid users, except myself
                                };
                                get_sys_mem_paging(req, res, mem_condition, {limit:Constant.DEFAULT_PAGE_LENGTH, skip:0},
                                    'name email cloud_avatar_id public_key encrypted_sys_common_key join_type edit_detail', {plain_name:1, name: 1}, function (resp_mem_list) {
                                        if (resp_mem_list.result == Constant.OK_CODE){
                                            final_response['mem_list'] = resp_mem_list.data;
                                        }
                                        res.rest.success({data: final_response});
                                    });
                            } else if (is_get_group_list){
                                //get extra group list
                                var group_condition = {
                                    profile_visibility: true
                                };
                                get_group_paging_with_rel(req, res, user_id, group_condition, {limit:Constant.DEFAULT_PAGE_LENGTH, skip:0},
                                    'name cloud_avatar_id', {plain_name:1, name: 1}, function (resp_group_list) {
                                        if (resp_group_list.result == Constant.OK_CODE){
                                            final_response['group_list'] = resp_group_list.data;
                                        }
                                        common.xlog('sys info', final_response);
                                        common.xlog('session', req.session[Constant.SESSION.KEY_USER_ID]);
                                        res.rest.success({data: final_response});
                                    });
                            } else {
                                //get neither member & group list
                                res.rest.success({data: final_response});
                            }
                        }
                    }   //end check login
                });
            }
        });
    }
});
/**
 * get member list inside system
 */
router.post('/get_member_list_paging', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])) {
        res.rest.unauthorized();
        return;
    }
    var user_id = common.getLoginedUserId(req);      //logged user id
    // var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);        //for unit testing

    var paging = {
        limit:  common.isNotEmpty(common.trim(req.body[Constant.PARAM.LENGTH]))?parseInt(common.trim(req.body[Constant.PARAM.LENGTH])):Constant.DEFAULT_PAGE_LENGTH,
        skip:   common.isNotEmpty(common.trim(req.body[Constant.PARAM.OFFSET]))?parseInt(common.trim(req.body[Constant.PARAM.OFFSET])):0
    };

    var mem_condition = {
        profile_visibility: true
        // _id: {$ne: user_id}          //get valid users, except myself
    };
    //
    get_sys_mem_paging(req, res, mem_condition, paging,
        'name email cloud_avatar_id public_key encrypted_sys_common_key join_type edit_detail', {plain_name:1, name: 1}, function (resp_mem_list) {
            if (resp_mem_list.result == Constant.OK_CODE){
                res.rest.success({data: {list: resp_mem_list.data}});
            } else {
                res.rest.badRequest({
                    result: Constant.FAILED_CODE,
                    message: resp_mem_list.message
                });
            }
        });
});
/**
 * get group list inside system
 */
router.post('/get_group_list_paging', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])) {
        res.rest.unauthorized();
        return;
    }
    var user_id = common.getLoginedUserId(req);      //logged user id
    // var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);        //for unit testing

    var paging = {
        limit:  common.isNotEmpty(common.trim(req.body[Constant.PARAM.LENGTH]))?parseInt(common.trim(req.body[Constant.PARAM.LENGTH])):Constant.DEFAULT_PAGE_LENGTH,
        skip:   common.isNotEmpty(common.trim(req.body[Constant.PARAM.OFFSET]))?parseInt(common.trim(req.body[Constant.PARAM.OFFSET])):0
    };
    var group_condition = {
        profile_visibility: true
    };
    get_group_paging_with_rel(req, res, user_id, group_condition, paging,
        'name cloud_avatar_id', {plain_name:1, name: 1}, function (resp_group_list) {
            if (resp_group_list.result == Constant.OK_CODE){
                res.rest.success({data: {list: resp_group_list.data}});
            } else {
                res.rest.badRequest({
                    result: Constant.FAILED_CODE,
                    message: resp_group_list.message
                });
            }
        });
});
/**
 * try to connect a database
 */
router.post('/try_connect_db', common.checkLLOGToken, function(req, res) {
    //get system info from header
    var system_db_address = req.headers[Constant.HEADER_PARAM.DB_ADDR];
    var system_db_name = req.headers[Constant.HEADER_PARAM.DB_NAME];
    var system_db_username = req.headers[Constant.HEADER_PARAM.DB_USERNAME];
    var system_db_password = req.headers[Constant.HEADER_PARAM.DB_PASSWORD];
    //do not check user id here
    if (common.isEmpty(system_db_address) || common.isEmpty(system_db_name)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS       //missing parameter
        });
        return;
    }
    common.tryConnectDB(system_db_username, system_db_password, system_db_address, system_db_name, function(conn_status) {
        if (conn_status == Constant.OK_CODE) {
            res.rest.success();
        } else {
            res.rest.badRequest({
                result: Constant.FAILED_CODE,
                message: Constant.CANNOT_CONNECTED
            });
        }
    });
});
//
module.exports = router;
