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
 * create new group
 */
router.put('/create_new', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])){
        res.rest.unauthorized();
        return;
    }
    //required params
    var user_id = common.getLoginedUserId(req);        //owner's id
    // var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);
    var name = common.trim(req.body[Constant.PARAM.NAME]);
    var about = common.trim(req.body[Constant.PARAM.ABOUT]);
    //get common keys of users (including owner)
    var encrypted_group_common_keys = common.trim(req.body[Constant.PARAM.ENCRYPTED_GROUP_COMMON_KEY]);

    if (common.isEmpty(user_id) || common.isEmpty(name) || common.isEmpty(encrypted_group_common_keys)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS       //missing parameter
        });
        return;
    }
    var keys = JSON.parse(encrypted_group_common_keys);     //each group member encrypted common key {id1: key1, id2: key2}
    if (common.isEmpty(keys[user_id])){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS       //missing parameter
        });
        return;
    }
    //connect to specific system db
    var resp_conn_sys_mem = common.getSystemModel(req, DB_STRUCTURE.SystemMember, Constant.COLLECTION_NAME.SYSTEM_MEMBER, res);
    if (resp_conn_sys_mem.result == Constant.FAILED_CODE){
        res.rest.badRequest({
            message: resp_conn_sys_mem.message
        });
    } else {
        //search if owner is existed in system
        dbOperator.simple_search_by_condition(resp_conn_sys_mem.db_model, {_id: user_id}, '_id', function (res_sys_mem){
            var group_mem_num = common.get_obj_len(keys);
            if (res_sys_mem.result == Constant.OK_CODE && res_sys_mem.data.length > 0) {
                //found 1 user
                var resp_conn_sys_group = common.getSystemModel(req, DB_STRUCTURE.Group, Constant.COLLECTION_NAME.GROUP, res);
                var new_group_doc = {
                    name: name,
                    plain_name: name.toLowerCase(),
                    member_num: group_mem_num,      //owner is included
                    user_id: user_id
                };
                if (common.isNotEmpty(about)){
                    new_group_doc['about'] = about;
                }
                dbOperator.create(resp_conn_sys_group.db_model, new_group_doc, function(res_create_group){
                    if (res_create_group.result == Constant.FAILED_CODE){
                        res.rest.badRequest({
                            message: Constant.SERVER_ERR
                        });
                    } else {
                        //created document in Group ok
                        //insert owner into GroupMember
                        var new_group_id = res_create_group['_id'];
                        var new_group_mem_doc = {
                            is_co_admin: true,
                            group_id: new_group_id,
                            encrypted_group_common_key: keys[user_id],      //key of owner
                            user_id: user_id        //owner
                        };
                        var resp_conn_sys_group_member = common.getSystemModel(req, DB_STRUCTURE.GroupMember, Constant.COLLECTION_NAME.GROUP_MEMBER, res);
                        dbOperator.create(resp_conn_sys_group_member.db_model, new_group_mem_doc, function(res_create_group_member){
                            if (res_create_group_member.result == Constant.FAILED_CODE){
                                //delete previous Group document
                                dbOperator.delete_permanently(resp_conn_sys_group.db_model, {_id: new_group_id}, function () {});
                                res.rest.badRequest({
                                    message: Constant.SERVER_ERR
                                });
                            } else {
                                //created document in Group Member ok
                                //insert documents of other group members, if any
                                Object.keys(keys).forEach(function(group_mem_id){
                                    if (group_mem_id != user_id){
                                        var new_group_mem_doc = {
                                            group_id: new_group_id,
                                            encrypted_group_common_key: keys[group_mem_id],      //key of member
                                            user_id: group_mem_id        //member
                                        };
                                        dbOperator.create(resp_conn_sys_group_member.db_model, new_group_mem_doc, function(){});
                                    }
                                });
                                //
                                res.rest.success({
                                    data: {group_id: new_group_id}
                                });
                            }
                        });
                    }
                });
            } else {
                res.rest.badRequest({
                    message: Constant.USER_NOT_FOUND
                });
            }
        });
    }
});
/**
 *  update some info of group after creating
 */
router.put('/update_group_info_after_creating', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])){
        res.rest.unauthorized();
        return;
    }
    //required params
    var group_id = common.trim(req.body[Constant.PARAM.GROUP_ID]);
    //
    if (common.isEmpty(group_id)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    update_group_info(group_id, req, res, function(res_update){
        if (res_update.result == Constant.FAILED_CODE){
            res.rest.badRequest({
                message: res_update.message
            });
        } else {
            //update ok
            common.dlog('Updated group info successfully, system: ' + req.headers[Constant.HEADER_PARAM.DB_NAME]);
            //search all system admins to send notifications (except current user is system owner)
            var resp_conn_sys_mem = common.getSystemModel(req, DB_STRUCTURE.SystemMember, Constant.COLLECTION_NAME.SYSTEM_MEMBER, res);
            var logined_user_id = common.getLoginedUserId(req);
            dbOperator.simple_search_by_condition(resp_conn_sys_mem.db_model, {is_co_admin: true, _id: {$ne: logined_user_id}}, '_id', function(res_search_sys_mem){
                if (res_search_sys_mem.result == Constant.OK_CODE && res_search_sys_mem.data.length > 0){
                    //found some sys admins
                    var to_user_ids = new Array();
                    for (var i=0; i<res_search_sys_mem.data.length; i++){
                        to_user_ids.push(res_search_sys_mem.data[i]['_id']);
                    }
                    if (to_user_ids.length > 0){
                        var new_notif_doc = {
                            description: Constant.MESS.CREATE_GROUP,
                            type: Constant.NOTIF_TYPE.CREATE_GROUP,
                            group_id: group_id,
                            from_user_id: logined_user_id,
                            to_user_ids: to_user_ids
                        };
                        create_new_doc_notification(req, res, new_notif_doc, function(resp_notif_create){

                        });
                    }
                }
            });
            //
            res.rest.success();
        }
    });
});
/**
 * Martin: owner updates his group information
 * @param req
 * @param callback
 */
function update_group_info(group_id, req, res, callback){
    var logined_user_id = common.getLoginedUserId(req);
    //connect to specific system db
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.Group, Constant.COLLECTION_NAME.GROUP, res);
    if (resp_conn.result == Constant.FAILED_CODE){
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn.message
        });
    } else {
        //search if group existed
        dbOperator.simple_search_by_condition(resp_conn.db_model, {_id: group_id}, 'user_id', function (response_group_info) {
            if (response_group_info.result == Constant.FAILED_CODE){
                callback({
                    result: Constant.FAILED_CODE,
                    message: Constant.SERVER_ERR
                });
            } else {
                if (response_group_info.data.length == 0){
                    callback({
                        result: Constant.FAILED_CODE,
                        message: Constant.GROUP_NOT_FOUND       //group is not existed
                    });
                }
                else if (response_group_info.data[0]['user_id'] != logined_user_id){
                    callback({


                        result: Constant.FAILED_CODE,
                        message: Constant.UNAUTHORIZATION       //login user is not group owner
                    });
                }
                else {
                    //found 1 group, update it
                    var update_data = {     //this info will be updated to collection Group
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
                    if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.PROFILE_VISIBILITY]))){
                        update_data['profile_visibility'] = common.trim(req.body[Constant.PARAM.PROFILE_VISIBILITY]);
                    }
                    if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.PROFILE_VISIBILITY]))){
                        update_data['profile_visibility'] = common.trim(req.body[Constant.PARAM.PROFILE_VISIBILITY]);
                    }
                    if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.MEMBER_LIST_VISIBILITY]))){
                        update_data['member_list_visibility'] = common.trim(req.body[Constant.PARAM.MEMBER_LIST_VISIBILITY]);
                    }
                    if (common.get_obj_len(update_data) > 0){       //has something to update
                        update_data['update_time'] = new Date();
                        dbOperator.update(resp_conn.db_model, {_id: group_id}, update_data, function(res_update){
                            if (res_update.result == Constant.OK_CODE){
                                callback({
                                    result: Constant.OK_CODE
                                });
                            } else {
                                callback({
                                    result: Constant.FAILED_CODE,
                                    message: Constant.SERVER_ERR
                                });
                            }
                        });
                    } else {
                        callback({
                            result: Constant.OK_CODE
                        });
                    }
                }
            }
        });
    }
}
/**
 * search with paging, search all if there is no group name
 */
router.post('/search_by_condition', common.checkLLOGToken, function(req, res) {
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
    var name = common.trim(req.body[Constant.PARAM.NAME]);  //keyword
    var query_condition = {            //default search all
        profile_visibility: true,
        cloud_id: {$ne: null},
        user_id: {$ne: null}
    };
    if (common.isNotEmpty(name)) {
        query_condition['name'] = {'$regex' : name, '$options' : 'i'};      //case insensitive
    }
    var paging = {
        limit:  common.isNotEmpty(common.trim(req.body[Constant.PARAM.LENGTH]))?parseInt(common.trim(req.body[Constant.PARAM.LENGTH])):Constant.DEFAULT_PAGE_LENGTH, //Constant.DEFAULT_PAGE_LENGTH,
        skip:   common.isNotEmpty(common.trim(req.body[Constant.PARAM.OFFSET]))?parseInt(common.trim(req.body[Constant.PARAM.OFFSET])):0
    };
    var sort = {
        plain_name:1, name: 1
    };
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.Group, Constant.COLLECTION_NAME.GROUP, res);
    if (resp_conn.result == Constant.FAILED_CODE){
        res.rest.badRequest({
            message: resp_conn.message
        });
    } else {
        dbOperator.search_by_condition(resp_conn.db_model, query_condition, paging, '_id name cloud_avatar_id cloud_id', sort, function(res_search){
            if (res_search.result == Constant.OK_CODE){
                //found some group
                var group_num = res_search.data.length;
                if (group_num > 0){
                    var resp_conn_group_mem = common.getSystemModel(req, DB_STRUCTURE.GroupMember, Constant.COLLECTION_NAME.GROUP_MEMBER, res);
                    //find relationship between current user & each group
                    var count = 0;
                    var final_result = {};
                    for (var i=0; i<group_num; i++){
                        final_result[res_search.data[i]['_id']] = res_search.data[i].toObject();       //keep group info
                        var group_mem_cond = {
                            user_id: user_id,
                            group_id: res_search.data[i]['_id'],
                            // encrypted_group_common_key: {$ne: null}     //valid key existed if user is owner of this group
                        };
                        //find relationship between current user & this group
                        dbOperator.simple_search_by_condition(resp_conn_group_mem.db_model, group_mem_cond,
                            'join_type group_id', function(res_gm_search){
                            if (res_gm_search.result == Constant.OK_CODE &&
                                common.isNotEmpty(res_gm_search.data[0]) && common.isNotEmpty(res_gm_search.data[0]['join_type'])){
                                final_result[res_gm_search.data[0]['group_id']]['join_type'] = res_gm_search.data[0]['join_type'];
                            } else {
                                //skip it
                            }
                            if(res_gm_search.data.length > 0 &&
                                (res_gm_search.data[0]['join_type']==Constant.JOIN_TYPE.ACCEPTED || res_gm_search.data[0]['join_type'] == Constant.JOIN_TYPE.NONE)) {
                                //get unread records number inside this group
                                get_unread_record_in_group(req, res, user_id, res_gm_search.data[0]['group_id'], function (res_count) {
                                    if (res_count.result == Constant.FAILED_CODE) {
                                        final_result[res_count['group_id']]['unread_record_count'] = 0;
                                    } else {
                                        final_result[res_count['group_id']]['unread_record_count'] = res_count.data;
                                    }
                                    if (++count == group_num) {      //got result of all queries
                                        // common.dlog(common.convert_obj_to_array(final_result));
                                        res.rest.success({
                                            data: {list: common.convert_obj_to_array(final_result)}
                                        });
                                    }
                                });
                            }else{
                                if (++count == group_num) {      //got result of all queries
                                    // common.dlog(common.convert_obj_to_array(final_result));
                                    res.rest.success({
                                        data: {list: common.convert_obj_to_array(final_result)}
                                    });
                                }
                            }
                        });
                    }
                } else {
                    res.rest.success({
                        data: {list: res_search.data}
                    });
                }
            } else {
                res.rest.badRequest({
                    message: Constant.SERVER_ERR
                });
            }
        });
    }
});
/**
 * get my joined group
 */
router.post('/get_my_joined_group', common.checkLLOGToken, function(req, res) {
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
    var query_condition = {
        user_id: user_id,
        $or: [{join_type: Constant.JOIN_TYPE.NONE}, {join_type: Constant.JOIN_TYPE.ACCEPTED}],
        encrypted_group_common_key: {$ne: null}     //must have valid key
    };
    var paging = {
        limit:  common.isNotEmpty(common.trim(req.body[Constant.PARAM.LENGTH]))?parseInt(common.trim(req.body[Constant.PARAM.LENGTH])):Constant.DEFAULT_PAGE_LENGTH, //Constant.DEFAULT_PAGE_LENGTH,
        skip:   common.isNotEmpty(common.trim(req.body[Constant.PARAM.OFFSET]))?parseInt(common.trim(req.body[Constant.PARAM.OFFSET])):0
    };
    var sort = {plain_name: 1, name: 1};
    var resp_conn_group_mem = common.getSystemModel(req, DB_STRUCTURE.GroupMember, Constant.COLLECTION_NAME.GROUP_MEMBER, res);
    if (resp_conn_group_mem.result == Constant.FAILED_CODE){
        res.rest.badRequest({
            message: resp_conn_group_mem.message
        });
    } else {
        dbOperator.search_by_condition(resp_conn_group_mem.db_model, query_condition, paging, 'group_id encrypted_group_common_key', sort, function(res_search){
            if (res_search.result == Constant.OK_CODE){
                //found some groups
                var group_num = res_search.data.length;

                if (group_num > 0){
                    var group_ids = new Array();
                    for (var i=0; i<group_num; i++){
                        group_ids.push(res_search.data[i]['group_id']);
                    }
                    //get each group info
                    var cond = {_id: {$in: group_ids}, cloud_id: {$ne: null}};
                    var resp_conn_group = common.getSystemModel(req, DB_STRUCTURE.Group, Constant.COLLECTION_NAME.GROUP, res);
                    dbOperator.search_by_condition(resp_conn_group.db_model, cond, paging,
                        '_id name cloud_avatar_id cloud_id', sort, function(res_search_group){
                            if (res_search_group.result == Constant.OK_CODE){
                                return_extra_unread_records(req, res, user_id, res_search_group);
                            } else {
                                res.rest.badRequest({
                                    message: Constant.SERVER_ERR
                                });
                            }
                        });
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
});
//get unread records in each group
function return_extra_unread_records(req, res, user_id, res_search_group){
    var group_num = res_search_group.data.length;
    if (group_num > 0){
        var final_response = {};
        var count = 0;
        for (var i=0; i<group_num; i++){
            final_response[res_search_group.data[i]['_id']] = res_search_group.data[i].toObject();
            get_unread_record_in_group(req, res, user_id, res_search_group.data[i]['_id'], function(res_count){
                if (res_count.result == Constant.FAILED_CODE){
                    final_response[res_count['group_id']]['unread_record_count'] = 0;
                } else {
                    final_response[res_count['group_id']]['unread_record_count'] = res_count.data;
                }
                final_response[res_count['group_id']]['join_type'] = Constant.JOIN_TYPE.ACCEPTED;       //include my created group too, used to not show button JOIN
                if (++count == group_num){
                    // common.dlog(common.convert_obj_to_array(final_response));
                    res.rest.success({
                        data: {list: common.convert_obj_to_array(final_response)}
                    });
                }
            });
        }
    } else {
        res.rest.success({
            data: {list: res_search_group.data}     //empty
        });
    }
}
/**
 * delete group by id
 */
router.post('/delete_group_n_member', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])){
        res.rest.unauthorized();
        return;
    }
    //required params
    var group_id = common.trim(req.body[Constant.PARAM.GROUP_ID]);
    //
    if (common.isEmpty(group_id)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    delete_group_member(group_id, req, res, function(){});
    delete_group(group_id, req, res, function(){});
    res.rest.success();
});
//delete document in collection Group
function delete_group(group_id, req, res, callback){
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.Group, Constant.COLLECTION_NAME.GROUP, res);
    if (resp_conn.result == Constant.FAILED_CODE){
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn.message
        });
    } else {
        dbOperator.simple_search_by_condition(resp_conn.db_model, {_id: group_id}, 'user_id', function(res_search){
            if (res_search.result == Constant.FAILED_CODE){
                callback({
                    result: Constant.FAILED_CODE,
                    message: Constant.SERVER_ERR
                });
            } else if (res_search.data.length > 0){
                var logined_user_id = common.getLoginedUserId(req);     //who can delete the group
                if (logined_user_id != res_search.data[0]['user_id']){
                    callback({
                        result: Constant.FAILED_CODE,
                        message: Constant.UNAUTHORIZATION
                    });
                } else {
                    dbOperator.delete_permanently(resp_conn.db_model, {_id: group_id}, callback);
                }
            } else {
                //not found
                callback({
                    result: Constant.FAILED_CODE,
                    message: Constant.NOT_FOUND
                });
            }
        });
    }
}
//delete document in collection GroupMember
function delete_group_member(group_id, req, res, callback){
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.GroupMember, Constant.COLLECTION_NAME.GROUP_MEMBER, res);
    if (resp_conn.result == Constant.FAILED_CODE){
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn.message
        });
    } else {
        dbOperator.delete_permanently(resp_conn.db_model, {group_id: group_id}, callback);
    }
}
//create new document in collection Notification
function create_new_doc_notification(req, res, new_doc, callback){
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.Notification, Constant.COLLECTION_NAME.NOTIFICATION, res);
    if (resp_conn.result == Constant.FAILED_CODE){
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn.message
        });
    } else {
        dbOperator.create(resp_conn.db_model, new_doc, callback);
    }
}
/**
 * user requests to join a group
 */
router.put('/request_join_group', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])){
        res.rest.unauthorized();
        return;
    }
    //required params
    var user_id = common.getLoginedUserId(req);      //logged user id, who send request to join
    // var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);        //for unit testing
    var group_id = common.trim(req.body[Constant.PARAM.GROUP_ID]);
    //
    if (common.isEmpty(user_id) || common.isEmpty(group_id)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    //check relationship between user and group
    get_group_mem_info(req, res, {user_id: user_id, group_id: group_id}, '_id join_type', function(res_search_group_mem){
        if (res_search_group_mem.result == Constant.FAILED_CODE){
            res.rest.badRequest({
                message: Constant.SERVER_ERR
            });
        } else if (res_search_group_mem.data.length > 0 && res_search_group_mem.data[0]['join_type'] != Constant.JOIN_TYPE.REJECTED){
            //a relationship was made (except Rejected: #2459 - allow to join again)
            res.rest.badRequest({
                message: Constant.EXISTED
            });
        } else {
            //get group & owner info
            get_group_info(req, res, {_id: group_id}, 'user_id', function(res_search_group){
                if (res_search_group.result == Constant.FAILED_CODE){
                    res.rest.badRequest({
                        message: Constant.SERVER_ERR
                    });
                } else {
                    if (res_search_group.data.length == 0){
                        res.rest.badRequest({
                            message: Constant.GROUP_NOT_FOUND
                        });
                    } else if (res_search_group.data[0]['user_id'] == null){
                        res.rest.badRequest({
                            message: Constant.GROUP_OWNER_NOT_FOUND        //group owner not found
                        });
                    } else {
                        //get group owner info
                        get_sys_mem_info(req, res, {_id: res_search_group.data[0]['user_id']}, 'android_tokens', function(res_search_sys_mem_info){
                            if (res_search_sys_mem_info.result == Constant.FAILED_CODE){
                                res.rest.badRequest({
                                    message: Constant.SERVER_ERR
                                });
                            } else if (res_search_sys_mem_info.data.length == 0) {
                                res.rest.badRequest({
                                    message: Constant.GROUP_OWNER_NOT_FOUND        //group owner not found
                                });
                            } else {
                                var android_tokens = res_search_sys_mem_info.data[0]['android_tokens'];     //tokens of group owner
                                //check whether user is rejected before
                                if (res_search_group_mem.data.length > 0 && res_search_group_mem.data[0]['join_type'] == Constant.JOIN_TYPE.REJECTED) {
                                    //rejected, change the type again
                                    upsert_group_mem(req, res, {_id: res_search_group_mem.data[0]['_id']}, {join_type: Constant.JOIN_TYPE.REQUESTING_JOIN}, function(res_update_group_mem){
                                        if (res_update_group_mem.result == Constant.FAILED_CODE){
                                            res.rest.badRequest({
                                                message: Constant.SERVER_ERR
                                            });
                                        } else {
                                            var group_mem_id = res_search_group_mem.data[0]['_id'];
                                            //insert into Notification
                                            var new_notif = {
                                                description: Constant.MESS.REQUEST_JOIN_GROUP,
                                                type: Constant.JOIN_TYPE.REQUESTING_JOIN,
                                                group_id: group_id,
                                                from_user_id: user_id,
                                                to_user_ids: [res_search_sys_mem_info.data[0]['_id']]  //group owner ID
                                            };
                                            create_new_notification(req, res, new_notif, function(res_create_notif){
                                                if (res_create_notif.result == Constant.FAILED_CODE){
                                                    //delete group member created
                                                    delete_group_mem(req, res, {_id: group_mem_id}, function(){});
                                                    res.rest.badRequest({
                                                        message: Constant.SERVER_ERR
                                                    });
                                                } else {
                                                    res.rest.success({data: {detail: group_mem_id}});
                                                    //todo: send Push to group owner
                                                }
                                            });
                                        }
                                    });
                                } else {
                                    //send request at first time, insert into GroupMember
                                    var new_group_mem = {
                                        join_type: Constant.JOIN_TYPE.REQUESTING_JOIN,
                                        group_id: group_id,
                                        user_id: user_id
                                    };
                                    create_new_group_mem(req, res, new_group_mem, function(res_create_group_mem){
                                        if (res_create_group_mem.result == Constant.FAILED_CODE){
                                            res.rest.badRequest({
                                                message: Constant.SERVER_ERR
                                            });
                                        } else {
                                            var group_mem_id = res_create_group_mem['_id'];
                                            //insert into Notification
                                            var new_notif = {
                                                description: Constant.MESS.REQUEST_JOIN_GROUP,
                                                type: Constant.JOIN_TYPE.REQUESTING_JOIN,
                                                group_id: group_id,
                                                from_user_id: user_id,
                                                to_user_ids: [res_search_sys_mem_info.data[0]['_id']]  //group owner ID
                                            };
                                            create_new_notification(req, res, new_notif, function(res_create_notif){
                                                if (res_create_notif.result == Constant.FAILED_CODE){
                                                    //delete group member created
                                                    delete_group_mem(req, res, {_id: group_mem_id}, function(){});
                                                    res.rest.badRequest({
                                                        message: Constant.SERVER_ERR
                                                    });
                                                } else {
                                                    res.rest.success({data: {detail: group_mem_id}});
                                                    //todo: send Push to group owner
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
//search group info
function get_group_info(req, res, condition, field, callback){
    var resp_conn_group = common.getSystemModel(req, DB_STRUCTURE.Group, Constant.COLLECTION_NAME.GROUP, res);
    if (resp_conn_group.result == Constant.FAILED_CODE){    //cannot connect system DB
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn_group.message
        });
    } else {
        dbOperator.simple_search_by_condition(resp_conn_group.db_model, condition, field, callback);
    }
}
//search user info in group member
function get_group_mem_info(req, res, condition, field, callback){
    var resp_conn_group_mem = common.getSystemModel(req, DB_STRUCTURE.GroupMember, Constant.COLLECTION_NAME.GROUP_MEMBER, res);
    if (resp_conn_group_mem.result == Constant.FAILED_CODE){    //cannot connect system DB
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn_group_mem.message
        });
    } else {
        dbOperator.simple_search_by_condition(resp_conn_group_mem.db_model, condition, field, callback);
    }
}
//search user info in group member join with Group
function get_group_mem_info_join_group(req, res, condition, field, callback){
    var resp_conn_group = common.getSystemModel(req, DB_STRUCTURE.Group, Constant.COLLECTION_NAME.GROUP, res);      //don't delete it
    var resp_conn_group_mem = common.getSystemModel(req, DB_STRUCTURE.GroupMember, Constant.COLLECTION_NAME.GROUP_MEMBER, res);
    if (resp_conn_group_mem.result == Constant.FAILED_CODE){    //cannot connect system DB
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn_group_mem.message
        });
    } else {
        dbOperator.simple_search_by_condition_join_group(resp_conn_group_mem.db_model, condition, field, callback);
    }
}
//get system member info
function get_sys_mem_info(req, res, condition, field, callback){
    var resp_conn_sys_mem = common.getSystemModel(req, DB_STRUCTURE.SystemMember, Constant.COLLECTION_NAME.SYSTEM_MEMBER, res);
    if (resp_conn_sys_mem.result == Constant.FAILED_CODE){    //cannot connect system DB
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn_sys_mem.message
        });
    } else {
        dbOperator.simple_search_by_condition(resp_conn_sys_mem.db_model, condition, field, callback);
    }
}
//create new group member
function create_new_group_mem(req, res, new_doc, callback){
    var resp_conn_group_mem = common.getSystemModel(req, DB_STRUCTURE.GroupMember, Constant.COLLECTION_NAME.GROUP_MEMBER, res);
    if (resp_conn_group_mem.result == Constant.FAILED_CODE){    //cannot connect system DB
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn_group_mem.message
        });
    } else {
        dbOperator.create(resp_conn_group_mem.db_model, new_doc, callback);
    }
}
//update/insert group member
function upsert_group_mem(req, res, cond, data, callback){
    var resp_conn_group_mem = common.getSystemModel(req, DB_STRUCTURE.GroupMember, Constant.COLLECTION_NAME.GROUP_MEMBER, res);
    if (resp_conn_group_mem.result == Constant.FAILED_CODE){    //cannot connect system DB
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn_group_mem.message
        });
    } else {
        dbOperator.upsert(resp_conn_group_mem.db_model, cond, data, callback);
    }
}
//delete group member
function delete_group_mem(req, res, condition, callback){
    var resp_conn_group_mem = common.getSystemModel(req, DB_STRUCTURE.GroupMember, Constant.COLLECTION_NAME.GROUP_MEMBER, res);
    if (resp_conn_group_mem.result == Constant.FAILED_CODE){    //cannot connect system DB
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn_group_mem.message
        });
    } else {
        dbOperator.delete_permanently(resp_conn_group_mem.db_model, condition, callback);
    }
}
//create new notification
function create_new_notification(req, res, new_doc, callback){
    var resp_conn_notif = common.getSystemModel(req, DB_STRUCTURE.Notification, Constant.COLLECTION_NAME.NOTIFICATION, res);
    if (resp_conn_notif.result == Constant.FAILED_CODE){    //cannot connect system DB
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn_notif.message
        });
    } else {
        dbOperator.create(resp_conn_notif.db_model, new_doc, callback);
    }
}
//update notification
function update_notification(req, res, cond, data, callback){
    var resp_conn_notif = common.getSystemModel(req, DB_STRUCTURE.Notification, Constant.COLLECTION_NAME.NOTIFICATION, res);
    if (resp_conn_notif.result == Constant.FAILED_CODE){    //cannot connect system DB
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn_notif.message
        });
    } else {
        dbOperator.update(resp_conn_notif.db_model, cond, data, callback);
    }
}
//delete notification
function delete_notification(req, res, condition, callback){
    var resp_conn_notif = common.getSystemModel(req, DB_STRUCTURE.Notification, Constant.COLLECTION_NAME.NOTIFICATION, res);
    if (resp_conn_notif.result == Constant.FAILED_CODE){    //cannot connect system DB
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn_notif.message
        });
    } else {
        dbOperator.delete_permanently(resp_conn_notif.db_model, condition, callback);
    }
}
/**
 * user accepts someone to join a group
 */
router.put('/accept_join_user', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])){
        res.rest.unauthorized();
        return;
    }
    //required params
    var user_id = common.getLoginedUserId(req);      //logged user id
    // var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);        //for unit testing
    var requester_id = common.trim(req.body[Constant.PARAM.TO_USER_IDS]);
    var group_id = common.trim(req.body[Constant.PARAM.GROUP_ID]);
    var encrypted_group_common_key = common.trim(req.body[Constant.PARAM.ENCRYPTED_GROUP_COMMON_KEY]);
    //
    if (common.isEmpty(user_id) || common.isEmpty(requester_id) || common.isEmpty(group_id) ||
        common.isEmpty(encrypted_group_common_key) || user_id==requester_id){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    //check if I am owner or co admin of this group
    var rel_cond = {
        user_id: user_id,
        group_id: group_id,
        $or: [{join_type: Constant.JOIN_TYPE.NONE}, {is_co_admin: true}]
    };
    //check if group existed
    get_group_info(req, res, {_id: group_id}, 'user_id', function(res_search_group) {
        if (res_search_group.result == Constant.FAILED_CODE){
            res.rest.badRequest({
                message: Constant.SERVER_ERR
            });
        } else {
            if (res_search_group.data.length == 0) {
                res.rest.badRequest({
                    message: Constant.GROUP_NOT_FOUND
                });
            } else if (res_search_group.data[0]['user_id'] == null) {
                res.rest.badRequest({
                    message: Constant.GROUP_OWNER_NOT_FOUND        //group owner not found
                });
            } else {
                //check if there is any request was made
                get_group_mem_info(req, res, rel_cond, 'group_id join_type', function(res_search_group_mem){
                    if (res_search_group_mem.result == Constant.FAILED_CODE){
                        res.rest.badRequest({
                            message: Constant.SERVER_ERR
                        });
                    } else if (res_search_group_mem.data.length == 0){
                        res.rest.badRequest({
                            message: Constant.UNAUTHORIZATION
                        });
                    } else {
                        //check if requester existed
                        get_sys_mem_info(req, res, {_id: requester_id}, 'name', function (res_requester_info) {
                            if (res_requester_info.result == Constant.FAILED_CODE){
                                res.rest.badRequest({
                                    message: Constant.SERVER_ERR
                                });
                            } else if (res_requester_info.data.length == 0){
                                res.rest.badRequest({
                                    message: Constant.USER_NOT_FOUND
                                });
                            } else {
                                //check relationship between requester & group
                                get_group_mem_info(req, res, {user_id: requester_id, group_id: group_id, join_type: Constant.JOIN_TYPE.REQUESTING_JOIN}, '_id join_type', function(res_search_group_mem_requester){
                                    if (res_search_group_mem_requester.result == Constant.FAILED_CODE){
                                        res.rest.badRequest({
                                            message: Constant.SERVER_ERR
                                        });
                                    } else if (res_search_group_mem_requester.data.length == 0 || res_search_group_mem_requester.data[0]['join_type']!=Constant.JOIN_TYPE.REQUESTING_JOIN){
                                        res.rest.badRequest({
                                            message: Constant.INVALID_REQUEST
                                        });
                                    } else {
                                        //there is valid request to join
                                        var upsert_cond = {
                                            _id: res_search_group_mem_requester.data[0]['_id']
                                        };
                                        var group_mem_data = {
                                            join_type: Constant.JOIN_TYPE.ACCEPTED,
                                            encrypted_group_common_key: encrypted_group_common_key,
                                            update_time: new Date()
                                        };
                                        upsert_group_mem(req, res, upsert_cond, group_mem_data, function(res_upsert_group_mem){
                                            if (res_upsert_group_mem.result == Constant.FAILED_CODE){
                                                res.rest.badRequest({
                                                    message: Constant.SERVER_ERR
                                                });
                                            } else {
                                                increase_group_member_no(req, res, group_id, 1, function(){});
                                                //inform to requester that Admin accepted
                                                var new_notif = {
                                                    description: Constant.MESS.ACCEPT_JOIN_GROUP,
                                                    type: Constant.JOIN_TYPE.ACCEPTED,
                                                    group_id: group_id,
                                                    from_user_id: user_id,
                                                    to_user_ids: [requester_id]
                                                };
                                                create_new_notification(req, res, new_notif, function(res_create_notif){
                                                    if (res_create_notif.result == Constant.FAILED_CODE){
                                                        //revert in GroupMember
                                                        upsert_group_mem(req, res, upsert_cond, {join_type: Constant.JOIN_TYPE.REQUESTING_JOIN}, function(){});
                                                        res.rest.badRequest({
                                                            message: Constant.CREATE_NOTIF_FAIL
                                                        });
                                                    } else {
                                                        var new_notif_id = res_create_notif['_id'];
                                                        //continue
                                                        var notif_cond = {
                                                            group_id: group_id,
                                                            from_user_id: requester_id,
                                                            to_user_ids: user_id,
                                                            type: Constant.JOIN_TYPE.REQUESTING_JOIN
                                                        };
                                                        update_notification(req, res, notif_cond, {type: Constant.JOIN_TYPE.ACCEPTED, update_time: new Date()}, function(res_update_notif){
                                                            if (res_update_notif.result == Constant.FAILED_CODE){
                                                                //revert in notification
                                                                upsert_group_mem(req, res, upsert_cond, {join_type: Constant.JOIN_TYPE.REQUESTING_JOIN}, function(){});
                                                                delete_notification(req, res, {_id: new_notif_id}, function(){});
                                                                res.rest.badRequest({
                                                                    message: Constant.SERVER_ERR
                                                                });
                                                            } else {
                                                                //success
                                                                //increase member no. of group by 1
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
                    }
                });
            }
        }
    });
});
//increase group member number by +/- 1
function increase_group_member_no(req, res, group_id, change_factor, callback){
    var resp_conn_group = common.getSystemModel(req, DB_STRUCTURE.Group, Constant.COLLECTION_NAME.GROUP, res);
    if (resp_conn_group.result == Constant.FAILED_CODE){    //cannot connect system DB
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn_group.message
        });
    } else {
        dbOperator.update(resp_conn_group.db_model, {_id: group_id}, {$inc: {member_num: change_factor}}, callback);
    }
}
/**
 * user denies someone to join a group
 */
router.put('/deny_join_user', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])){
        res.rest.unauthorized();
        return;
    }
    //required params
    var user_id = common.getLoginedUserId(req);      //logged user id
    // var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);        //for unit testing
    var requester_id = common.trim(req.body[Constant.PARAM.TO_USER_IDS]);
    var group_id = common.trim(req.body[Constant.PARAM.GROUP_ID]);
    //
    if (common.isEmpty(user_id) || common.isEmpty(requester_id) || common.isEmpty(group_id) ||
        user_id==requester_id){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    //check if group existed
    get_group_info(req, res, {_id: group_id}, 'user_id', function(res_search_group) {
        if (res_search_group.result == Constant.FAILED_CODE) {
            res.rest.badRequest({
                message: Constant.SERVER_ERR
            });
        } else {
            if (res_search_group.data.length == 0) {
                res.rest.badRequest({
                    message: Constant.GROUP_NOT_FOUND
                });
            } else if (res_search_group.data[0]['user_id'] == null) {
                res.rest.badRequest({
                    message: Constant.GROUP_OWNER_NOT_FOUND        //group owner not found
                });
            } else {
                //check if I am owner or co admin of this group
                var rel_cond = {
                    user_id: user_id,
                    group_id: group_id,
                    $or: [{join_type: Constant.JOIN_TYPE.NONE}, {is_co_admin: true}]
                };
                get_group_mem_info(req, res, rel_cond, 'group_id join_type', function(res_search_group_mem){
                    if (res_search_group_mem.result == Constant.FAILED_CODE){
                        res.rest.badRequest({
                            message: Constant.SERVER_ERR
                        });
                    } else if (res_search_group_mem.data.length == 0){
                        res.rest.badRequest({
                            message: Constant.UNAUTHORIZATION
                        });
                    } else {
                        //check if requester existed
                        get_sys_mem_info(req, res, {_id: requester_id}, 'name', function (res_requester_info) {
                            if (res_requester_info.result == Constant.FAILED_CODE) {
                                res.rest.badRequest({
                                    message: Constant.SERVER_ERR
                                });
                            } else if (res_requester_info.data.length == 0) {
                                res.rest.badRequest({
                                    message: Constant.USER_NOT_FOUND
                                });
                            } else {
                                //check whether there was valid request
                                get_group_mem_info(req, res, {user_id: requester_id, group_id: group_id, join_type: Constant.JOIN_TYPE.REQUESTING_JOIN}, '_id join_type', function(res_search_group_mem_requester){
                                    if (res_search_group_mem_requester.result == Constant.FAILED_CODE){
                                        res.rest.badRequest({
                                            message: Constant.SERVER_ERR
                                        });
                                    } else if (res_search_group_mem_requester.data.length == 0 || res_search_group_mem_requester.data[0]['join_type']!=Constant.JOIN_TYPE.REQUESTING_JOIN){
                                        res.rest.badRequest({
                                            message: Constant.INVALID_REQUEST
                                        });
                                    } else {
                                        //there is valid request to join
                                        var upsert_cond = {
                                            _id: res_search_group_mem_requester.data[0]['_id']
                                        };
                                        var group_mem_data = {
                                            join_type: Constant.JOIN_TYPE.REJECTED,
                                            update_time: new Date()
                                        };
                                        upsert_group_mem(req, res, upsert_cond, group_mem_data, function(res_upsert_group_mem){
                                            if (res_upsert_group_mem.result == Constant.FAILED_CODE){
                                                res.rest.badRequest({
                                                    message: Constant.SERVER_ERR
                                                });
                                            } else {
                                                //inform to requester that Admin rejected
                                                var new_notif = {
                                                    description: Constant.MESS.REJECTED_JOIN_GROUP,
                                                    type: Constant.JOIN_TYPE.REJECTED,
                                                    group_id: group_id,
                                                    from_user_id: user_id,
                                                    to_user_ids: [requester_id]
                                                };
                                                create_new_notification(req, res, new_notif, function(res_create_notif){
                                                    if (res_create_notif.result == Constant.FAILED_CODE){
                                                        //revert in GroupMember
                                                        upsert_group_mem(req, res, upsert_cond, {join_type: Constant.JOIN_TYPE.REQUESTING_JOIN}, function(){});
                                                        res.rest.badRequest({
                                                            message: Constant.CREATE_NOTIF_FAIL
                                                        });
                                                    } else {
                                                        var new_notif_id = res_create_notif['_id'];
                                                        var notif_cond = {
                                                            group_id: group_id,
                                                            from_user_id: requester_id,
                                                            to_user_ids: user_id,
                                                            type: Constant.JOIN_TYPE.REQUESTING_JOIN
                                                        };
                                                        //change notification of requester
                                                        update_notification(req, res, notif_cond, {type: Constant.JOIN_TYPE.REJECTED, update_time: new Date()}, function(res_update_notif){
                                                            if (res_update_notif.result == Constant.FAILED_CODE){
                                                                //revert in notification
                                                                upsert_group_mem(req, res, upsert_cond, {join_type: Constant.JOIN_TYPE.REQUESTING_JOIN}, function(){});
                                                                delete_notification(req, res, {_id: new_notif_id}, function(){});
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
                    }
                });
            }
        }
    });
});
//get number of records in the group which I haven't read yet
function get_unread_record_in_group(req, res, user_id, group_id, callback){
    var resp_conn_record = common.getSystemModel(req, DB_STRUCTURE.Record, Constant.COLLECTION_NAME.RECORD, res);
    if (resp_conn_record.result == Constant.FAILED_CODE){    //cannot connect system DB
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn_record.message
        });
    } else {
        //search all records in the group
        var unread_cond = {
            group_id: group_id,
            visibility: true,
            user_id: {$ne: user_id}         //skip records which created by me
        };
        dbOperator.search_all_by_condition(resp_conn_record.db_model, unread_cond, '_id', {}, function (res_search){
            if (res_search.result == Constant.FAILED_CODE){
                callback({
                    result: Constant.FAILED_CODE,
                    message: Constant.SERVER_ERR
                });
            } else if (res_search.data.length == 0){
                callback({
                    result: Constant.OK_CODE,
                    group_id: group_id,
                    data: 0
                });
            } else {
                var record_total = res_search.data.length;
                //must find how many records I haven't read yet
                var resp_conn_read_record = common.getSystemModel(req, DB_STRUCTURE.ReadRecord, Constant.COLLECTION_NAME.READ_RECORD, res);
                if (resp_conn_record.result == Constant.FAILED_CODE){    //cannot connect system DB
                    callback({
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
                            callback({
                                result: Constant.FAILED_CODE,
                                message: Constant.SERVER_ERR
                            });
                        } else {
                            callback({
                                result: Constant.OK_CODE,
                                group_id: group_id,
                                data: record_total - res_count.data
                            });
                        }
                    });
                }
            }
        });
    }
}
/**
 * get all my joined groups, no paging
 */
router.post('/get_all_my_joined_groups', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])){
        res.rest.unauthorized();
        return;
    }
    //required params
    var user_id = common.getLoginedUserId(req);      //logged user id
    // var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);        //for unit testing
    var condition = {
        user_id: user_id,
        $or: [{join_type: Constant.JOIN_TYPE.ACCEPTED}, {join_type: Constant.JOIN_TYPE.NONE}],
        encrypted_group_common_key: {$ne: null}     //must have valid key
    };
    get_group_mem_info_join_group(req, res, condition, 'group_id encrypted_group_common_key', function(res_search){
        if (res_search.result == Constant.FAILED_CODE){
            res.rest.badRequest({
                result: Constant.FAILED_CODE,
                message: Constant.SERVER_ERR
            });
        } else {
            res.rest.success({
                data: {list: res_search.data}
            });
        }
    });
});
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
/**
 * get info of group to show in Profile page
 */
router.post('/get_info_by_id', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])){
        res.rest.unauthorized();
        return;
    }
    var user_id = common.getLoginedUserId(req);      //logged user id
    // var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);        //for unit testing
    //
    var group_id = common.trim(req.body[Constant.PARAM.GROUP_ID]);
    if (common.isEmpty(user_id) || common.isEmpty(group_id)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    var is_get_mem_list = common.trim(req.body[Constant.PARAM.IS_GET_MEM_LIST]);
    is_get_mem_list = is_get_mem_list == true || is_get_mem_list == 'true';     //get list of group members or not
    //
    var resp_conn_group = common.getSystemModel(req, DB_STRUCTURE.Group, Constant.COLLECTION_NAME.GROUP, res);
    if (resp_conn_group.result == Constant.FAILED_CODE){    //cannot connect system DB
        res.rest.badRequest({
            result: Constant.FAILED_CODE,
            message: resp_conn_group.message
        });
    } else {
        //search group info
        var cond = {_id: group_id, profile_visibility: true};
        dbOperator.simple_search_by_condition(resp_conn_group.db_model, cond, '', function(resp_group_info){
            if (resp_group_info.result == Constant.FAILED_CODE) {
                res.rest.badRequest({
                    message: Constant.SERVER_ERR
                });
            } else if (resp_group_info.data.length == 0){
                res.rest.success({data: {detail: {}}});     //no info
            } else {
                var final_response = {      //final response back to app
                    detail: resp_group_info.data[0]
                };
                //search relationship between me & current group
                get_group_mem_info(req, res, {user_id: user_id, group_id: group_id}, 'join_type encrypted_group_common_key', function (resp_my_group_mem) {
                    if (resp_my_group_mem.result == Constant.FAILED_CODE){
                        //cannot retrieve my relationship
                        res.rest.success({data: final_response});
                    } else {
                        if (common.isNotEmpty(resp_my_group_mem.data) && resp_my_group_mem.data.length > 0){
                            final_response['rel'] = resp_my_group_mem.data[0];
                        }
                        //check whether get extra list
                        if (is_get_mem_list){
                            //search member list of the group
                            get_group_mem_info(req, res, {group_id: group_id, user_id: {$ne: user_id}}, 'user_id', function(resp_group_mem){
                                if (resp_group_mem.result == Constant.FAILED_CODE){
                                    res.rest.success({data: final_response});   //cannot find
                                } else if (resp_group_mem.data.length == 0){
                                    res.rest.success({data: final_response});   //member not found
                                } else {
                                    var mem_group_len = resp_group_mem.data.length;
                                    var mem_ids = new Array();
                                    for (var i=0; i<mem_group_len; i++){
                                        if (common.isNotEmpty(resp_group_mem.data[i]['user_id'])){
                                            mem_ids.push(resp_group_mem.data[i]['user_id']);
                                        }
                                    }
                                    //search system member info, sorted by name
                                    var mem_condition = {
                                        profile_visibility: true,
                                        _id: {$in: mem_ids}          //get valid users, except myself
                                    };
                                    get_sys_mem_paging(req, res, mem_condition, {limit:Constant.DEFAULT_PAGE_LENGTH, skip:0},
                                        'name email cloud_avatar_id public_key encrypted_sys_common_key join_type edit_detail', {plain_name: 1, name: 1}, function (resp_mem_list) {
                                            if (resp_mem_list.result == Constant.OK_CODE){
                                                final_response['mem_list'] = resp_mem_list.data;
                                            }
                                            res.rest.success({data: final_response});
                                        });
                                }
                            });
                        } else {
                            //not get member list
                            res.rest.success({data: final_response});
                        }
                    }
                });
            }
        });
    }
});
/**
 * get member list inside group
 */
router.post('/get_member_list_paging', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])) {
        res.rest.unauthorized();
        return;
    }
    var user_id = common.getLoginedUserId(req);      //logged user id
    // var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);        //for unit testing
    var group_id = common.trim(req.body[Constant.PARAM.GROUP_ID]);
    if (common.isEmpty(user_id) || common.isEmpty(group_id)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }

    var paging = {
        limit:  common.isNotEmpty(common.trim(req.body[Constant.PARAM.LENGTH]))?parseInt(common.trim(req.body[Constant.PARAM.LENGTH])):Constant.DEFAULT_PAGE_LENGTH,
        skip:   common.isNotEmpty(common.trim(req.body[Constant.PARAM.OFFSET]))?parseInt(common.trim(req.body[Constant.PARAM.OFFSET])):0
    };
    var final_response = {mem_list: []};
    //get list of members in group, including me
    var cond_group_mem = {
        group_id: group_id,
        $or: [{join_type: Constant.JOIN_TYPE.NONE}, {join_type: Constant.JOIN_TYPE.ACCEPTED}],
        encrypted_group_common_key: {$ne: null}     //must have valid key
    };
    //todo Viet: get list of members sorted by name
    get_group_mem_info(req, res, cond_group_mem, 'user_id', function(resp_group_mem){
        if (resp_group_mem.result == Constant.FAILED_CODE){
            res.rest.success({data: final_response});   //cannot find
        } else if (resp_group_mem.data.length == 0){
            res.rest.success({data: final_response});   //member not found
        } else {
            var mem_group_len = resp_group_mem.data.length;
            var mem_ids = new Array();
            for (var i=0; i<mem_group_len; i++){
                if (common.isNotEmpty(resp_group_mem.data[i]['user_id'])){
                    mem_ids.push(resp_group_mem.data[i]['user_id']);
                }
            }
            //search system member info, sorted by name
            var mem_condition = {
                profile_visibility: true,
                _id: {$in: mem_ids}          //get valid users, except myself
            };
            get_sys_mem_paging(req, res, mem_condition, paging,
                'name email cloud_avatar_id public_key encrypted_sys_common_key join_type edit_detail', {plain_name:1, name: 1}, function (resp_mem_list) {
                    if (resp_mem_list.result == Constant.OK_CODE){
                        final_response['mem_list'] = resp_mem_list.data;
                    }
                    res.rest.success({data: final_response});
                });
        }
    });
});
//
module.exports = router;
