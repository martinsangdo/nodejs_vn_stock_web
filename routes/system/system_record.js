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
var PushNotif = require('../../common/push_notif.js');
var pushNotif = new PushNotif();
/**
 * create new record/post
 */
router.put('/create_new', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])){
        res.rest.unauthorized();
        return;
    }
    var user_id = common.getLoginedUserId(req);      //logged user id
    // var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);
    var creator_name = common.trim(req.body[Constant.PARAM.USER_NAME]); //who created the post
    var group_id = common.trim(req.body[Constant.PARAM.GROUP_ID]);
    var is_system_scope = common.trim(req.body[Constant.PARAM.IS_SYSTEM_SCOPE]);
    var title = common.trim(req.body[Constant.PARAM.TITLE]);
    //validate input
    if (common.isEmpty(creator_name) || common.isEmpty(user_id) || common.isEmpty(title) ||
            (common.isEmpty(group_id) && common.isEmpty(is_system_scope)) ||
            (common.isNotEmpty(group_id) && common.isNotEmpty(is_system_scope))){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    var new_doc = {
        user_id: user_id,
        title: title
    };
    //check optional params
    if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.DESCRIPTION]))){
        new_doc['description'] = common.trim(req.body[Constant.PARAM.DESCRIPTION]);
    }
    if (common.isNotEmpty(group_id)){
        new_doc['group_id'] = group_id;
    }
    if (common.isNotEmpty(is_system_scope)){
        new_doc['is_system_scope'] = is_system_scope;
    }
    //check if there is any image/video
    if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.MEDIA_CLOUD_ARRAY]))){
        var new_media = JSON.parse(common.trim(req.body[Constant.PARAM.MEDIA_CLOUD_ARRAY]));
        if (new_media.length > 0){
            new_doc['media_cloud_ids'] = new_media;
        }
    }
    //check if there is any files
    if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.RESOURCE_CLOUD_ARRAY]))){
        var new_files = JSON.parse(common.trim(req.body[Constant.PARAM.RESOURCE_CLOUD_ARRAY]));
        if (new_files.length > 0){
            new_doc['resource_ids'] = new_files;
        }
    }
    //connect to specific system db
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.Record, Constant.COLLECTION_NAME.RECORD, res);
    if (resp_conn.result == Constant.FAILED_CODE){
        res.rest.badRequest({
            message: resp_conn.message
        });
    } else {
        dbOperator.create(resp_conn.db_model, new_doc, function (res_create){
            if (res_create.result == Constant.OK_CODE) {
                save_notif_after_create_post(req, res, user_id, creator_name, is_system_scope, group_id, res_create['_id']);
                //return new id
                res.rest.success({
                    data: {detail: res_create['_id']}
                });
            } else {
                res.rest.badRequest({
                    message: Constant.SERVER_ERR
                });
            }
        });
    }
});
/**
 * save Notification & send Push to relative users
 * @param user_id
 * @param is_system_scope
 * @param group_id
 */
function save_notif_after_create_post(req, res, user_id, creator_name, is_system_scope, group_id, record_id){
    if (is_system_scope == true || is_system_scope == 'true'){
        //check if I am not owner of the system
        get_sys_info_join_mem(req, res, {}, 'user_id name', function(resp_sys_info){
           if (resp_sys_info.result == Constant.OK_CODE){
               //creator is not system owner
               var notif_content = {
                   description: Constant.MESS.CREATED_NEW_RECORD,
                   type: Constant.NOTIF_TYPE.CREATE_POST,
                   record_id: record_id,
                   from_user_id: user_id,
                   to_user_ids: [resp_sys_info.data[0]['user_id']['_id']],
                   is_system_scope: true        //inform to everybody
               };
               create_new_notification(req, res, notif_content, function(){});
               //send push to all users in System, except owner
               var resp_conn_sys_mem = common.getSystemModel(req, DB_STRUCTURE.SystemMember, Constant.COLLECTION_NAME.SYSTEM_MEMBER, res);
               dbOperator.simple_search_by_condition(resp_conn_sys_mem.db_model, {_id: {$ne: user_id}}, 'android_tokens', function(resp_sys_mem){
                   if (resp_sys_mem.result = Constant.OK_CODE){
                       //collect all anndroid tokens
                       var tokens = [];
                       for (var i=0; i<resp_sys_mem.data.length; i++){
                           for (var j=0; j<resp_sys_mem.data[i]['android_tokens'].length; j++){
                               tokens.push(resp_sys_mem.data[i]['android_tokens'][j]);
                           }
                       }
                       pushNotif.send_push_new_created_post(tokens, {record_id: record_id},
                           creator_name, Constant.MESS.CREATED_NEW_RECORD_BODY + resp_sys_info.data[0]['name']);
                   } else {
                        //not send Push
                   }
               });
           } else {
               //not send Push
           }
        });
    } else if (common.isNotEmpty(group_id)){
        //check if I am not owner of the group
        get_group_info_join_mem(req, res, {}, 'name user_id', function(resp_group_info){
            if (resp_group_info.result == Constant.OK_CODE &&
                resp_group_info.data[0]['user_id']['_id'] != user_id){
                //creator is not group owner
                var notif_content = {
                    description: Constant.MESS.CREATED_NEW_RECORD,
                    type: Constant.NOTIF_TYPE.CREATE_POST,
                    group_id: group_id,
                    record_id: record_id,
                    from_user_id: user_id,
                    to_user_ids: [resp_group_info.data[0]['user_id']['_id']],
                };
                create_new_notification(req, res, notif_content, function(){});
                //send push
                pushNotif.send_push_new_created_post(resp_group_info.data[0]['user_id']['android_tokens'], {record_id: record_id},
                    creator_name, Constant.MESS.CREATED_NEW_RECORD_BODY + resp_group_info.data[0]['name']);
            }
        });
    }
}
//search system info
function get_sys_info_join_mem(req, res, condition, field, callback){
    var resp_conn_sys_mem = common.getSystemModel(req, DB_STRUCTURE.SystemMember, Constant.COLLECTION_NAME.SYSTEM_MEMBER, res);
    var resp_conn_sys = common.getSystemModel(req, DB_STRUCTURE.SystemInfo, Constant.COLLECTION_NAME.SYSTEM_INFO, res);
    if (resp_conn_sys.result == Constant.FAILED_CODE){    //cannot connect system DB
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn_sys.message
        });
    } else {
        dbOperator.simple_search_by_condition_join_mem(resp_conn_sys.db_model, condition, field, callback);
    }
}
//search group info
function get_group_info_join_mem(req, res, condition, field, callback){
    var resp_conn_sys_mem = common.getSystemModel(req, DB_STRUCTURE.SystemMember, Constant.COLLECTION_NAME.SYSTEM_MEMBER, res);
    var resp_conn_group = common.getSystemModel(req, DB_STRUCTURE.Group, Constant.COLLECTION_NAME.GROUP, res);
    if (resp_conn_group.result == Constant.FAILED_CODE){    //cannot connect system DB
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn_group.message
        });
    } else {
        dbOperator.simple_search_by_condition_join_mem(resp_conn_group.db_model, condition, field, callback);
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
/**
 * update record/post
 */
router.put('/update_record', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])){
        res.rest.unauthorized();
        return;
    }
    var user_id = common.getLoginedUserId(req);      //logged user id
    // var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);
    var record_id = common.trim(req.body[Constant.PARAM.RECORD_ID]);
    //validate input
    if (common.isEmpty(user_id) || common.isEmpty(record_id)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    //connect to specific system db
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.Record, Constant.COLLECTION_NAME.RECORD, res);
    if (resp_conn.result == Constant.FAILED_CODE){
        res.rest.badRequest({
            message: resp_conn.message
        });
    } else {
        //get record id
        dbOperator.simple_search_by_condition(resp_conn.db_model, {_id: record_id}, 'user_id media_cloud_ids resource_ids', function(resp_record_info){
            if (resp_record_info.result == Constant.FAILED_CODE){
                res.rest.badRequest({
                    message: Constant.SERVER_ERR
                });
            } else if (resp_record_info.data.length == 0){
                res.rest.badRequest({
                    message: Constant.RECORD_NOT_FOUND
                });
            } else if (resp_record_info.data[0]['user_id'] != user_id){     //modifier is not owner
                res.rest.badRequest({
                    message: Constant.UNAUTHORIZATION
                });
            } else {
                var update_data = {};
                //check optional params
                if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.TITLE]))){
                    update_data['title'] = common.trim(req.body[Constant.PARAM.TITLE]);
                }
                if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.DESCRIPTION]))){
                    update_data['description'] = common.trim(req.body[Constant.PARAM.DESCRIPTION]);
                }
                if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.GROUP_ID]))){
                    update_data['group_id'] = common.trim(req.body[Constant.PARAM.GROUP_ID]);
                }
                if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.IS_SYSTEM_SCOPE]))){
                    update_data['is_system_scope'] = common.trim(req.body[Constant.PARAM.IS_SYSTEM_SCOPE]);
                }
                if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.VISIBILITY]))){
                    update_data['visibility'] = common.trim(req.body[Constant.PARAM.VISIBILITY]);
                }
                //check if there is any image/video
                if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.MEDIA_CLOUD_ARRAY]))){
                    var existed_media = resp_record_info.data[0]['media_cloud_ids'];
                    var new_media = JSON.parse(common.trim(req.body[Constant.PARAM.MEDIA_CLOUD_ARRAY]));
                    var merged_array = common.merge_update_attach_array(existed_media, new_media, true);
                    if (merged_array.length > 0){
                        update_data['media_cloud_ids'] = merged_array;
                    }
                }
                //check if there is any files
                if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.RESOURCE_CLOUD_ARRAY]))){
                    var existed_files = resp_record_info.data[0]['resource_ids'];
                    var new_files = JSON.parse(common.trim(req.body[Constant.PARAM.RESOURCE_CLOUD_ARRAY]));
                    var merged_array = common.merge_update_attach_array(existed_files, new_files, false);
                    if (merged_array.length > 0){
                        update_data['resource_ids'] = merged_array;
                    }
                }
                //
                if (common.get_obj_len(update_data)){
                    update_data['update_time'] = new Date();
                    //there is something need to update
                    dbOperator.update(resp_conn.db_model, {_id: record_id}, update_data, function(resp_update){
                        if (resp_update.result == Constant.FAILED_CODE){
                            res.rest.badRequest({
                                message: Constant.SERVER_ERR
                            });
                        } else {
                            common.dlog('Updated post info successfully, system: ' + req.headers[Constant.HEADER_PARAM.DB_NAME]);
                            res.rest.success();
                        }
                    });
                } else {
                    res.rest.success();
                }
            }
        });
    }
});
/**
 * get records by condition, paging
 */
router.post('/get_records_by_condition', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])){
        res.rest.unauthorized();
        return;
    }
    //required params
    var user_id = common.getLoginedUserId(req);      //logged user id
    // var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);        //for unit testing
    //check input
    var is_system_scope = common.trim(req.body[Constant.PARAM.IS_SYSTEM_SCOPE]);
    var group_ids = common.trim(req.body[Constant.PARAM.GROUP_ID_LIST]);      //a list of joined group IDs

    if (common.isEmpty(is_system_scope) && common.isEmpty(group_ids)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    //condition to select records
    var condition = {};
    if (common.isNotEmpty(is_system_scope) && common.isNotEmpty(group_ids)){
        group_ids = JSON.parse(group_ids);
        condition = {
            $or: [{is_system_scope: is_system_scope}, {group_id: {$in: group_ids}}]
        };
    } else if (common.isNotEmpty(is_system_scope)){
        condition['is_system_scope'] = is_system_scope;
    } else if (common.isNotEmpty(group_ids)){
        group_ids = JSON.parse(group_ids);
        condition = {group_id: {$in: group_ids}};
    }
    condition['visibility'] = true;     //must public
    var paging = {
        limit:  common.isNotEmpty(common.trim(req.body[Constant.PARAM.LENGTH]))?parseInt(common.trim(req.body[Constant.PARAM.LENGTH])):Constant.DEFAULT_PAGE_LENGTH,
        skip:   common.isNotEmpty(common.trim(req.body[Constant.PARAM.OFFSET]))?parseInt(common.trim(req.body[Constant.PARAM.OFFSET])):0
    };
    var sort = {
        update_time: -1     //get latest posts
    };
    //connect to specific system db
    var resp_conn_sys_mem = common.getSystemModel(req, DB_STRUCTURE.SystemMember, Constant.COLLECTION_NAME.SYSTEM_MEMBER, res);     //must init to use populate
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.Record, Constant.COLLECTION_NAME.RECORD, res);
    if (resp_conn.result == Constant.FAILED_CODE){
        res.rest.badRequest({
            message: resp_conn.message
        });
    } else {
        dbOperator.search_by_condition_join_owner(resp_conn.db_model, condition, paging, '', sort, function(resp_search){
            if (resp_search.result == Constant.FAILED_CODE){
                res.rest.badRequest({
                    result: Constant.FAILED_CODE,
                    message: Constant.SERVER_ERR
                });
            } else if (resp_search.data.length == 0){
                res.rest.success({data: {list: []}});
            } else {
                //have some records
                var records = resp_search.data;
                var record_len = records.length;
                var obj_records = {};       //convert array to records
                //collect list of records
                var record_ids = new Array();
                for (var i=0; i<record_len; i++){
                    record_ids.push(records[i]['_id']);
                    obj_records[records[i]['_id']] = records[i];        //save it to object
                }
                //search whether I read each record
                var resp_conn_read_record = common.getSystemModel(req, DB_STRUCTURE.ReadRecord, Constant.COLLECTION_NAME.READ_RECORD, res);
                if (resp_conn_read_record.result == Constant.FAILED_CODE){
                    res.rest.success({data: {list: records}});
                } else {
                    var read_flag_cond = {
                        user_id: user_id,
                        record_id: {$in: record_ids}
                    };
                    dbOperator.simple_search_by_condition(resp_conn_read_record.db_model, read_flag_cond, 'record_id', function(resp_read_search){
                        if (resp_read_search.result == Constant.FAILED_CODE){
                            res.rest.success({data: {list: records}});
                        } else {
                            var read_records = resp_read_search.data;
                            var read_records_len = read_records.length;
                            //attach result to final records list
                            for (var i=0; i<read_records_len; i++){
                                if (common.isNotEmpty(obj_records[read_records[i]['record_id']]) ||
                                    obj_records[read_records[i]['record_id']]['user_id'] == user_id){       //I read this or I am owner of this
                                    obj_records[read_records[i]['record_id']] = obj_records[read_records[i]['record_id']].toObject();
                                    obj_records[read_records[i]['record_id']]['read'] = true;
                                }
                            }
                            //transform object to final array again
                            res.rest.success({data: {list: common.convert_obj_to_array(obj_records)}});
                        }
                    });
                }
            }
        });
    }
});
/**
 * insert/update Read flag
 */
router.put('/upsert_read_detail', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])) {
        res.rest.unauthorized();
        return;
    }
    //required params
    var user_id = common.getLoginedUserId(req);      //logged user id
    // var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);        //for unit testing
    //check input
    var record_id = common.trim(req.body[Constant.PARAM.RECORD_ID]);

    if (common.isEmpty(record_id) || common.isEmpty(user_id)) {
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    //search if record existed
    var resp_conn_record = common.getSystemModel(req, DB_STRUCTURE.Record, Constant.COLLECTION_NAME.RECORD, res);
    if (resp_conn_record.result == Constant.FAILED_CODE){
        res.rest.badRequest({
            message: resp_conn.message
        });
    } else {
        dbOperator.simple_search_by_condition(resp_conn_record.db_model, {_id: record_id}, '_id', function(resp_search){
           if (resp_search.result == Constant.FAILED_CODE){
               res.rest.badRequest({
                   result: Constant.FAILED_CODE,
                   message: Constant.SERVER_ERR
               });
           } else if (resp_search.data.length == 0){
               res.rest.badRequest({
                   result: Constant.FAILED_CODE,
                   message: Constant.RECORD_NOT_FOUND
               });
           } else {
               //upsert Read value
               var cond = {
                   user_id: user_id,
                   record_id: record_id
               }
               var update_data = {
                   read: true,
                   user_id: user_id,
                   record_id: record_id,
                   update_time: new Date()
               };
               var resp_conn_read_record = common.getSystemModel(req, DB_STRUCTURE.ReadRecord, Constant.COLLECTION_NAME.READ_RECORD, res);
               if (resp_conn_read_record.result == Constant.FAILED_CODE){
                   res.rest.badRequest({
                       result: Constant.FAILED_CODE,
                       message: Constant.SERVER_ERR
                   });
               } else {
                   dbOperator.upsert(resp_conn_read_record.db_model, cond, update_data, function(resp_upsert){
                      if (resp_upsert.result == Constant.FAILED_CODE){
                          res.rest.badRequest({
                              result: Constant.FAILED_CODE,
                              message: Constant.SERVER_ERR
                          });
                      } else {
                          res.rest.success();
                      }
                   });
               }
           }
        });
    }
});
/**
 * get comment list join with user
 * @param req
 * @param res
 * @param condition
 * @param paging
 * @param fields
 * @param sort
 * @param callback
 */
function get_cmt_list_join_paging(req, res, condition, paging, fields, sort, callback){
    //connect to specific system db
    var resp_conn_sys_mem = common.getSystemModel(req, DB_STRUCTURE.SystemMember, Constant.COLLECTION_NAME.SYSTEM_MEMBER, res);     //must init to use populate
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.Comment, Constant.COLLECTION_NAME.COMMENT, res);
    if (resp_conn.result == Constant.FAILED_CODE){
        callback({
            message: resp_conn.message
        });
    } else {
        dbOperator.search_by_condition_join_owner(resp_conn.db_model, condition, paging, fields, sort, function(resp_search){
            if (resp_search.result == Constant.FAILED_CODE){
                callback({
                    result: Constant.FAILED_CODE,
                    message: Constant.SERVER_ERR
                });
            } else {
                //have some comments
                callback(resp_search.data);     //list of comments
            }
        });
    }
}
/**
 * get record detail by ID
 */
router.post('/get_record_by_id', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])){
        res.rest.unauthorized();
        return;
    }
    //required params
    var user_id = common.getLoginedUserId(req);      //logged user id
    // var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);        //for unit testing
    //check input
    var record_id = common.trim(req.body[Constant.PARAM.RECORD_ID]);

    if (common.isEmpty(record_id) || common.isEmpty(user_id)) {
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    //search if record existed
    var resp_conn_sys_mem = common.getSystemModel(req, DB_STRUCTURE.SystemMember, Constant.COLLECTION_NAME.SYSTEM_MEMBER, res);     //must init to use populate
    var resp_conn_record = common.getSystemModel(req, DB_STRUCTURE.Record, Constant.COLLECTION_NAME.RECORD, res);
    if (resp_conn_record.result == Constant.FAILED_CODE){
        res.rest.badRequest({
            message: resp_conn.message
        });
    } else {
        dbOperator.search_by_condition_join_owner(resp_conn_record.db_model, {_id: record_id, visibility: true},
            {limit:1, skip:0}, '', {}, function (resp_search) {
            if (resp_search.result == Constant.FAILED_CODE) {
                res.rest.badRequest({
                    result: Constant.FAILED_CODE,
                    message: Constant.SERVER_ERR
                });
            } else if (resp_search.data.length == 0) {
                res.rest.badRequest({
                    result: Constant.FAILED_CODE,
                    message: Constant.RECORD_NOT_FOUND
                });
            } else {
                var is_get_cmt_list = common.trim(req.body[Constant.PARAM.IS_GET_COMMENT_LIST]);
                //check to get common key if record belongs to Group
                var record_detail = resp_search.data[0];
                if (common.isNotEmpty(record_detail['group_id'])){
                    //belong to Group
                    var resp_conn_group_mem = common.getSystemModel(req, DB_STRUCTURE.GroupMember, Constant.COLLECTION_NAME.GROUP_MEMBER, res);
                    if (resp_conn_group_mem.result == Constant.FAILED_CODE){
                        res.rest.badRequest({
                            message: resp_conn.message
                        });
                    } else {
                        var group_mem_cond = {
                            user_id: user_id,
                            $or: [{join_type: Constant.JOIN_TYPE.NONE}, {join_type: Constant.JOIN_TYPE.ACCEPTED}]
                        };
                        dbOperator.simple_search_by_condition(resp_conn_group_mem.db_model, group_mem_cond, 'encrypted_group_common_key',
                                function(resp_group_mem){
                            if (resp_group_mem.result == Constant.OK_CODE && resp_group_mem.data.length > 0 &&
                                common.isNotEmpty(resp_group_mem.data[0]['encrypted_group_common_key'])){
                                record_detail = record_detail.toObject();
                                record_detail['encrypted_group_common_key'] = resp_group_mem.data[0]['encrypted_group_common_key'];
                            }
                            if (is_get_cmt_list==true || is_get_cmt_list=='true'){
                                get_cmt_list_join_paging(req, res, condition, paging, fields, sort, function (resp_cmt_list) {
                                    if (resp_cmt_list.result == Constant.OK_CODE){
                                        res.rest.success({
                                            data: {detail: record_detail, cmt_list: resp_cmt_list.data}
                                        });
                                    } else {
                                        res.rest.success({
                                            data: {detail: record_detail}
                                        });
                                    }
                                });
                            } else {
                                res.rest.success({
                                    data: {detail: record_detail}
                                });
                            }
                        });
                    }
                } else {
                    if (is_get_cmt_list==true || is_get_cmt_list=='true'){
                        get_cmt_list_join_paging(req, res, condition, paging, fields, sort, function (resp_cmt_list) {
                            if (resp_cmt_list.result == Constant.OK_CODE){
                                res.rest.success({
                                    data: {detail: record_detail, cmt_list: resp_cmt_list.data}
                                });
                            } else {
                                res.rest.success({
                                    data: {detail: record_detail}
                                });
                            }
                        });
                    } else {
                        res.rest.success({
                            data: {detail: record_detail}
                        });
                    }
                }
            }
        });
    }
});
/**
 * delete record by id
 */
router.post('/delete_record_by_id', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])){
        res.rest.unauthorized();
        return;
    }
    //required params
    var record_id = common.trim(req.body[Constant.PARAM.RECORD_ID]);
    //
    if (common.isEmpty(record_id)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    delete_read_by_record_id(record_id, req, res, function(){});
    delete_notification_by_record_id(record_id, req, res, function(){});
    delete_record(record_id, req, res, function(){});
    res.rest.success();
});
//delete document in collection Record
function delete_record(record_id, req, res, callback){
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.Record, Constant.COLLECTION_NAME.RECORD, res);
    if (resp_conn.result == Constant.FAILED_CODE){
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn.message
        });
    } else {
        dbOperator.delete_permanently(resp_conn.db_model, {_id: record_id}, callback);
    }
}
//delete document in collection ReadRecord
function delete_read_by_record_id(record_id, req, res, callback){
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.ReadRecord, Constant.COLLECTION_NAME.READ_RECORD, res);
    if (resp_conn.result == Constant.FAILED_CODE){
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn.message
        });
    } else {
        dbOperator.delete_permanently(resp_conn.db_model, {record_id: record_id}, callback);
    }
}
//delete document in collection Notification
function delete_notification_by_record_id(record_id, req, res, callback){
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.Notification, Constant.COLLECTION_NAME.NOTIFICATION, res);
    if (resp_conn.result == Constant.FAILED_CODE){
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn.message
        });
    } else {
        dbOperator.delete_permanently(resp_conn.db_model, {record_id: record_id}, callback);
    }
}

//
module.exports = router;
