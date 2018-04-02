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
    var creator_name = common.trim(req.body[Constant.PARAM.USER_NAME]); //who created the comment
    var record_id = common.trim(req.body[Constant.PARAM.RECORD_ID]);
    var content = common.trim(req.body[Constant.PARAM.CONTENT]);
    //validate input
    if (common.isEmpty(creator_name) || common.isEmpty(user_id) || common.isEmpty(content) ||
                common.isEmpty(record_id)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    var new_doc = {
        record_id: record_id,
        user_id: user_id,
        content: content
    };
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
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.Comment, Constant.COLLECTION_NAME.COMMENT, res);
    if (resp_conn.result == Constant.FAILED_CODE){
        res.rest.badRequest({
            message: resp_conn.message
        });
    } else {
        dbOperator.create(resp_conn.db_model, new_doc, function (res_create){
            if (res_create.result == Constant.OK_CODE) {
                //increase comment number in record
                update_comment_total(req, res, record_id, Constant.INCREASE_1_FACTOR, function(resp){});
                //save to notification & send Push
                save_notif_after_create_comment(req, res, user_id, creator_name, record_id, res_create['_id'], function(resp){});
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
//change no. of comments in Record
function update_comment_total(req, res, record_id, change_factor, callback){
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.Record, Constant.COLLECTION_NAME.RECORD, res);
    if (resp_conn.result == Constant.FAILED_CODE){
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn.message
        });
    } else {
        dbOperator.update(resp_conn.db_model, {_id: record_id}, {$inc: {cmt_num: change_factor}}, callback);
    }
}
/**
 * save Notification & send Push to relative users (record owner & previous commenters)
 * @param user_id
 * @param creator_name
 * @param record_id
 * @param comment_id
 */
function save_notif_after_create_comment(req, res, user_id, creator_name, record_id, comment_id, callback){
    //check if I am owner of the record
    get_record_info(req, res, {_id: record_id}, 'user_id', function(resp_record_info){
        if (resp_record_info.result == Constant.FAILED_CODE){
            callback({
                result: Constant.FAILED_CODE,
                message: resp_record_info.message
            });
        } else {
            var to_user_ids = new Array();          //user ids who will receive Push
            var android_tokens = new Array();       //all tokens of people will receive the Push

            if (common.isNotEmpty(resp_record_info.data[0]) && resp_record_info.data[0]['user_id']['_id'] == user_id){
                //I am owner of this record, do not send Push & save notif to me
            } else if (resp_record_info.data[0]['user_id']['_id']){
                to_user_ids.push(resp_record_info.data[0]['user_id']['_id']);      //send to post owner
                if (common.isNotEmpty(resp_record_info.data[0]['user_id']['android_tokens']) && resp_record_info.data[0]['user_id']['android_tokens'].length > 0){
                    //user logined in 1 or many phones
                    for (var i=0; i<resp_record_info.data[0]['user_id']['android_tokens'].length; i++){
                        android_tokens.push(resp_record_info.data[0]['user_id']['android_tokens'][i]);
                    }
                }
            }
            //search previous commenters
            var cmt_cond = {
                record_id: record_id,
                user_id: {$ne: user_id}     //not including me
            };
            search_commenters_distinct_join(req, res, cmt_cond, 'user_id', 'user_id', function(resp_cmt_list){
                if (resp_cmt_list.result == Constant.FAILED_CODE){
                    //do nothing
                } else {
                    var comment_ids = resp_cmt_list.data;
                    var comment_len = comment_ids.length;
                    for (var i=0; i<comment_len; i++){
                        if (common.isNotEmpty(comment_ids[i]['user_id']['_id'])){
                            to_user_ids.push(comment_ids[i]['user_id']['_id']);
                        }
                        if (common.isNotEmpty(comment_ids[i]['user_id']['android_tokens'])){
                            for (var j=0; j<comment_ids[i]['user_id']['android_tokens'].length; j++){
                                android_tokens.push(comment_ids[i]['user_id']['android_tokens'][j]);
                            }
                        }
                    }
                    to_user_ids = common.remove_duplicate_array_item(to_user_ids);
                    android_tokens = common.remove_duplicate_array_item(android_tokens);
                    if (to_user_ids.length > 0){    //someone commented
                        var notif_content = {
                            description: Constant.MESS.CREATED_NEW_COMMENT,
                            type: Constant.NOTIF_TYPE.CREATE_COMMENT,
                            record_id: record_id,
                            from_user_id: user_id,
                            to_user_ids: to_user_ids,
                        };
                        create_new_notification(req, res, notif_content, function(){});
                        //send push
                        if (android_tokens.length > 0){
                            pushNotif.send_push_new_created_comment(android_tokens, {record_id: record_id},
                                creator_name, Constant.MESS.CREATED_NEW_COMMENT_BODY);
                        }
                    }
                }
            });
        }
    });
}
//search record info
function get_record_info(req, res, condition, field, callback){
    var resp_conn_sys_mem = common.getSystemModel(req, DB_STRUCTURE.SystemMember, Constant.COLLECTION_NAME.SYSTEM_MEMBER, res);     //don't delete it
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.Record, Constant.COLLECTION_NAME.RECORD, res);
    if (resp_conn.result == Constant.FAILED_CODE){    //cannot connect system DB
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn.message
        });
    } else {
        dbOperator.simple_search_by_condition_join_mem(resp_conn.db_model, condition, field, callback);
    }
}
//get comment list based on some conditions
function search_commenters_distinct_join(req, res, condition, fields, distinct_field, callback){
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.Comment, Constant.COLLECTION_NAME.COMMENT, res);
    if (resp_conn.result == Constant.FAILED_CODE){    //cannot connect system DB
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn.message
        });
    } else {
        dbOperator.simple_search_by_condition_distinct_join(resp_conn.db_model, condition, fields, distinct_field, callback);
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
 * update comment of post
 */
router.put('/update_comment', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])){
        res.rest.unauthorized();
        return;
    }
    var user_id = common.getLoginedUserId(req);      //logged user id
    // var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);
    var comment_id = common.trim(req.body[Constant.PARAM.COMMENT_ID]);
    //validate input
    if (common.isEmpty(user_id) || common.isEmpty(comment_id)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    //connect to specific system db
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.Comment, Constant.COLLECTION_NAME.COMMENT, res);
    if (resp_conn.result == Constant.FAILED_CODE){
        res.rest.badRequest({
            message: resp_conn.message
        });
    } else {
        //get record id
        dbOperator.simple_search_by_condition(resp_conn.db_model, {_id: comment_id}, 'user_id media_cloud_ids resource_ids', function(resp_cmt_info){
            if (resp_cmt_info.result == Constant.FAILED_CODE){
                res.rest.badRequest({
                    message: Constant.SERVER_ERR
                });
            } else if (resp_cmt_info.data.length == 0){
                res.rest.badRequest({
                    message: Constant.COMMENT_NOT_FOUND
                });
            } else if (resp_cmt_info.data[0]['user_id'] != user_id){     //modifier is not owner
                res.rest.badRequest({
                    message: Constant.UNAUTHORIZATION
                });
            } else {
                var update_data = {};
                //check optional params
                if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.CONTENT]))){
                    update_data['content'] = common.trim(req.body[Constant.PARAM.CONTENT]);
                }
                //check if there is any image/video
                if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.MEDIA_CLOUD_ARRAY]))){
                    var existed_media = resp_cmt_info.data[0]['media_cloud_ids'];
                    var new_media = JSON.parse(common.trim(req.body[Constant.PARAM.MEDIA_CLOUD_ARRAY]));
                    var merged_array = common.merge_update_attach_array(existed_media, new_media, true);
                    if (merged_array.length > 0){
                        update_data['media_cloud_ids'] = merged_array;
                    }
                }
                //check if there is any files
                if (common.isNotEmpty(common.trim(req.body[Constant.PARAM.RESOURCE_CLOUD_ARRAY]))){
                    var existed_files = resp_cmt_info.data[0]['resource_ids'];
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
                    dbOperator.update(resp_conn.db_model, {_id: comment_id}, update_data, function(resp_update){
                        if (resp_update.result == Constant.FAILED_CODE){
                            res.rest.badRequest({
                                message: Constant.SERVER_ERR
                            });
                        } else {
                            common.dlog('Updated comment info successfully, system: ' + req.headers[Constant.HEADER_PARAM.DB_NAME]);
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
 * get comments of record by condition, paging
 */
router.post('/get_comments_by_condition', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])){
        res.rest.unauthorized();
        return;
    }
    //required params
    var user_id = common.getLoginedUserId(req);      //logged user id
    // var user_id = common.trim(req.body[Constant.PARAM.USER_ID]);        //for unit testing
    //check input
    var record_id = common.trim(req.body[Constant.PARAM.RECORD_ID]);

    if (common.isEmpty(user_id) && common.isEmpty(record_id)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    //condition to select records
    var condition = {record_id: record_id};
    var paging = {
        limit:  common.isNotEmpty(common.trim(req.body[Constant.PARAM.LENGTH]))?parseInt(common.trim(req.body[Constant.PARAM.LENGTH])):Constant.DEFAULT_PAGE_LENGTH,
        skip:   common.isNotEmpty(common.trim(req.body[Constant.PARAM.OFFSET]))?parseInt(common.trim(req.body[Constant.PARAM.OFFSET])):0
    };
    var sort = {    //latest on top
        update_time: -1,
        create_time: -1
    };
    //connect to specific system db
    var resp_conn_sys_mem = common.getSystemModel(req, DB_STRUCTURE.SystemMember, Constant.COLLECTION_NAME.SYSTEM_MEMBER, res);     //must init to use populate
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.Comment, Constant.COLLECTION_NAME.COMMENT, res);
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
            } else {
                //have some comments
                res.rest.success({data: {list: resp_search.data}});
            }
        });
    }
});
/**
 * delete comment by id
 */
router.post('/delete_comment_by_id', common.checkLLOGToken, function(req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])){
        res.rest.unauthorized();
        return;
    }
    //required params
    var comment_id = common.trim(req.body[Constant.PARAM.COMMENT_ID]);
    //
    if (common.isEmpty(comment_id)){
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    delete_notification_by_comment_id(comment_id, req, res, function(){});
    //decrease comment number in Record
    get_comment_info(req, res, {_id: comment_id}, 'record_id', function(resp_record_info){
        if (resp_record_info.result == Constant.OK_CODE && !common.isEmpty(resp_record_info.data[0]) &&
                !common.isEmpty(resp_record_info.data[0]['record_id'])){
            update_comment_total(req, res, resp_record_info.data[0]['record_id'], Constant.DECREASE_1_FACTOR, function(){});
        }
    });
    delete_comment(comment_id, req, res, function(){});
    res.rest.success();
});
//delete document in collection Comment
function delete_comment(comment_id, req, res, callback){
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.Comment, Constant.COLLECTION_NAME.COMMENT, res);
    if (resp_conn.result == Constant.FAILED_CODE){
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn.message
        });
    } else {
        dbOperator.delete_permanently(resp_conn.db_model, {_id: comment_id}, callback);
    }
}
//delete document in collection Notification
function delete_notification_by_comment_id(comment_id, req, res, callback){
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.Notification, Constant.COLLECTION_NAME.NOTIFICATION, res);
    if (resp_conn.result == Constant.FAILED_CODE){
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn.message
        });
    } else {
        dbOperator.delete_permanently(resp_conn.db_model, {comment_id: comment_id}, callback);
    }
}
//search comment info
function get_comment_info(req, res, condition, field, callback){
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.Comment, Constant.COLLECTION_NAME.COMMENT, res);
    if (resp_conn.result == Constant.FAILED_CODE){    //cannot connect system DB
        callback({
            result: Constant.FAILED_CODE,
            message: resp_conn.message
        });
    } else {
        dbOperator.simple_search_by_condition(resp_conn.db_model, condition, field, callback);
    }
}
//
module.exports = router;