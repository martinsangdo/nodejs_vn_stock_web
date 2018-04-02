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

/**
 * search members in system by condition (name AND/OR email), check profile_visibility too
 * case insensitive
 */
router.post('/get_message_detail', common.checkLLOGToken, function (req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])) {
        res.rest.unauthorized();
        return;
    }
    var from_user_id = common.trim(req.body[Constant.PARAM.FROM_USER_ID]);
    var to_user_ids = common.trim(req.body[Constant.PARAM.TO_USER_IDS]);
    var last_message_id = common.trim(req.body[Constant.PARAM.LAST_MESSAGE_ID]);

    if (common.isEmpty(from_user_id) && common.isEmpty(to_user_ids)) {
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }

    var oldest_message = common.trim(req.body[Constant.PARAM.TIME_OF_OLDEST_MESSAGE]);
    var query_condition = {
        $or: [
            {from_user_id: from_user_id, to_user_ids: to_user_ids},
            {from_user_id: to_user_ids, to_user_ids: from_user_id}
        ]
    };
    if (common.isNotEmpty(oldest_message)) {
        query_condition["create_time"] = {
            $lt: oldest_message
        }
    }
    var limit = common.isNotEmpty(common.trim(req.body[Constant.PARAM.LENGTH])) ? parseInt(common.trim(req.body[Constant.PARAM.LENGTH])) : Constant.DEFAULT_PAGE_LENGTH;

    //connect to specific system db
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.Message, Constant.COLLECTION_NAME.MESSAGE, res);
    if (resp_conn.result == Constant.FAILED_CODE) {
        res.rest.badRequest({
            message: resp_conn.message
        });
    } else {

        var resp_last_mess_conn = common.getSystemModel(req, DB_STRUCTURE.LastMessage, Constant.COLLECTION_NAME.LAST_MESSAGE, res);

        // if (common.isNotEmpty(last_message_id)) {

        //check whether 2 users chatted or not before
        // var condition_last_message = {
        //     _id: last_message_id
        // };
        var condition_last_message = {
            $or: [
                {creator_id: from_user_id, to_user_ids: to_user_ids},
                {creator_id: to_user_ids, to_user_ids: from_user_id}
            ]
        };

        //update this last message is read
        dbOperator.search_one_by_condition(resp_last_mess_conn.db_model, condition_last_message, '_id creator_name creator_id read status', function (res_channel_search) {
            if (res_channel_search.result == Constant.OK_CODE && common.isNotEmpty(res_channel_search.data) && from_user_id != res_channel_search.data.creator_id) {
                // res_channel_search.data.read = true;
                res_channel_search.data.status = Constant.MESSAGE_STATUS.READ;
                res_channel_search.data.save(function (err) {
                    if (!err) {
                        //emit to client
                    } else {
                    }
                });

            }

            var updateCon = {
                from_user_id: to_user_ids,
                to_user_ids: from_user_id,
                status : { $ne: Constant.MESSAGE_STATUS.READ }// status != read
            };
            // updateCon['$or'] = [{read: {$exists: false}}, {read: false}];
            // update message
            dbOperator.update(resp_conn.db_model, updateCon, {status: Constant.MESSAGE_STATUS.READ}, function (resp_update) {
                    if (common.isNotEmpty(resp_update) && resp_update.result == Constant.OK_CODE && common.isNotEmpty(resp_update.data) &&
                        resp_update.data.nModified > 0) {

                        var send_data = {
                            last_message_id: last_message_id
                        };
                        common.emit_to_clients("update_read_status", [to_user_ids], send_data);
                        // common.xlog("Nhan mess update222 : ", resp_update);
                    }
                }
            );

            //search if user existed
            dbOperator.get_my_message_thread_limit(resp_conn.db_model, query_condition, limit, '', function (res_search) {
                if (res_search.result == Constant.OK_CODE) {
                    //get public key of to_user_id
                    var resp_sys_mem_conn = common.getSystemModel(req, DB_STRUCTURE.SystemMember, Constant.COLLECTION_NAME.SYSTEM_MEMBER, res);
                    dbOperator.search_one_by_condition(resp_sys_mem_conn.db_model, {_id: to_user_ids}, 'public_key cloud_avatar_id edit_detail', function (resp_sys_mem_info) {
                        var result = {
                            data: {
                                list: res_search.data           //list of users
                            }
                        };
                        if (resp_sys_mem_info.result == Constant.OK_CODE) {
                            result.data['friend_public_key'] = resp_sys_mem_info.data['public_key'];
                        }
                        if (common.isNotEmpty(res_channel_search.data)) {
                            result.data.channel = res_channel_search.data;
                        }
                        // common.xlog("Nhan mess result: ", result);
                        res.rest.success(result);
                    });
                } else {
                    res.rest.serverError();
                }
            });
        });
    }
    // }
})
;
/**
 * check if I having some unread messages, called when open app to show notification
 */
router.post('/get_my_unread_message', common.checkLLOGToken, function (req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])) {
        res.rest.unauthorized();
        return;
    }
    var my_user_id = common.trim(req.body[Constant.PARAM.USER_ID]);
    if (common.isEmpty(my_user_id)) {
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }

    var condition = {
        to_user_id: my_user_id,
        status : { $ne: Constant.MESSAGE_STATUS.READ }// status != read
        // read: false
    };
    //connect to specific db
    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.ReadMessage, Constant.COLLECTION_NAME.READ_MESSAGE, res);
    if (resp_conn.result == Constant.FAILED_CODE) {
        res.rest.badRequest({
            message: resp_conn.message
        });
    } else {
        dbOperator.simple_search_by_condition(resp_conn.db_model, condition, 'creator_id creator_name content mess_type', function (res_search) {
            if (res_search.result == Constant.OK_CODE) {
                res.rest.success({
                    data: {list: res_search.data}
                });
            } else if (res_search.name == Constant.CAST_ERROR && res_search.path == 'to_user_id' &&
                (res_search.kind == Constant.ObjectID || res_search.kind == Constant.ObjectId)) {
                //user not found
                res.rest.badRequest({
                    message: Constant.USER_NOT_FOUND
                });
            } else {
                res.rest.serverError();
            }
        });
    }
});
/**
 * open message detail page, set I read this message
 */
router.put('/update_my_read_status', common.checkLLOGToken, function (req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])) {
        res.rest.unauthorized();
        return;
    }
    var my_user_id = common.trim(req.body[Constant.PARAM.USER_ID]);
    var user_id2 = common.trim(req.body[Constant.PARAM.TO_USER_IDS]);

    if (common.isEmpty(my_user_id) || common.isEmpty(user_id2)) {
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }
    var query_condition = {
        $or: [
            {creator_id: my_user_id, to_user_ids: user_id2},
            {creator_id: user_id2, to_user_ids: my_user_id}
        ]
    };

    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.LastMessage, Constant.COLLECTION_NAME.LAST_MESSAGE, res);
    if (resp_conn.result == Constant.FAILED_CODE) {
        res.rest.badRequest({
            message: resp_conn.message
        });
    } else {
        var resp_read_mess_conn = common.getSystemModel(req, DB_STRUCTURE.ReadMessage, Constant.COLLECTION_NAME.READ_MESSAGE, res);

        dbOperator.simple_search_by_condition(resp_conn.db_model, query_condition, '_id', function (res_search) {
            if (res_search.result == Constant.OK_CODE) {
                if (common.isNotEmpty(res_search.data) && common.isNotEmpty(res_search.data[0])) {
                    //found 1 last message, then set flag "read" = true
                    var condition = {
                        last_mess_id: res_search.data[0]['_id'],
                        to_user_id: my_user_id
                    };
                    var update_data = {
                        last_mess_id: res_search.data[0]['_id'],
                        to_user_id: my_user_id,
                        // read: true,     //I read this message
                        status : Constant.MESSAGE_STATUS.READ,// status = read
                        update_time: new Date()
                    };
                    dbOperator.upsert(resp_read_mess_conn.db_model, condition, update_data, function (resp_upsert) {
                        if (resp_upsert.result == Constant.OK_CODE) {
                            res.rest.success();
                        } else {
                            res.rest.serverError();
                        }
                    });
                }
            } else {
                res.rest.serverError();
            }
        });
    }
});

/**
 * open message detail page, set I read this message
 */
router.post('/delete_messages', common.checkLLOGToken, function (req, res) {
    if (common.isNotLogined(req, req.headers[Constant.HEADER_PARAM.DB_NAME])) {
        res.rest.unauthorized();
        return;
    }

    var loginedId = common.getLoginedUserId(req);
    var messageId = common.trim(req.body[Constant.PARAM.MESSAGE_ID]);

    if (common.isEmpty(messageId)) {
        res.rest.badRequest({
            message: Constant.MISMATCH_PARAMS
        });
        return;
    }

    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.Message, Constant.COLLECTION_NAME.MESSAGE, res);
    if (resp_conn.result == Constant.FAILED_CODE) {
        res.rest.badRequest({
            message: resp_conn.message
        });
    } else {
        dbOperator.search_one_by_condition(resp_conn.db_model, {_id: messageId}, '', function (res_search) {
            if (res_search.result == Constant.OK_CODE) {
                if (common.isNotEmpty(res_search.data)) {
                    if (res_search.data.from_user_id == loginedId) {
                        res_search.data.remove(function (err) {
                            if (!err) {
                                res.rest.success();
                            } else {
                                res.rest.serverError();
                            }
                        });
                    } else {
                        res.rest.unauthorized();
                    }
                } else {
                    res.rest.success();     //not found, assume it's deleted
                }
            } else {
                res.rest.serverError();
            }
        });
    }
});
module.exports = router;
