/**
 author: Martin 2017
 common operation functions of DB
 */
var Constant = require('../common/constant.js');
var Common = require('../common/common.js');
var common = new Common();

function DBOperater() {
}

//=========
/**
 * note that upsert working with predefined fields in Schema
 * @param db_model
 * @param condition
 * @param data
 * @param resp_func
 */
DBOperater.prototype.upsert = function (db_model, condition, data, resp_func) {
    var options = {upsert: true};     //insert if not existed
    db_model.update(condition, data, options, function (err, docs) {
        if (err) {
            // common.xlog('upsert', err);
            var resp = {
                result: Constant.FAILED_CODE,
                message: err
            };
            resp_func(resp);
        } else {
            var resp = {
                result: Constant.OK_CODE,
                data: docs
            };
            resp_func(resp);
        }
    });
};
/**
 *
 * @param db_model
 * @param existed_condition
 * @param update_data
 * @param resp_func
 */
DBOperater.prototype.update = function (db_model, existed_condition, update_data, resp_func) {
    var options = {
        upsert: false,
        multi: true
    };        //not allow to insert new
    db_model.update(existed_condition, update_data, options, function (err, docs) {
        if (err) {
            // common.xlog('update', err);
            var resp = {
                result: Constant.FAILED_CODE,
                message: Constant.SERVER_ERR,
                err: err
            };
            resp_func(resp);
        } else {
            var resp = {
                result: Constant.OK_CODE,
                data: docs
            };
            resp_func(resp);
        }
    });
};
/**
 * create a new document
 * @param db_model
 * @param new_doc
 * @param resp_func
 */
DBOperater.prototype.create = function (db_model, new_doc, resp_func) {
    var me = new db_model(new_doc);
    me.save(function (err, result) {
        if (err) {
            // common.xlog('create', err);
            var resp = {
                result: Constant.FAILED_CODE,
                message: Constant.SERVER_ERR,
                err: err
            };
            resp_func(resp);
        } else {
            var resp = {
                result: Constant.OK_CODE,
                _id: result._id,
                data: result
            };
            resp_func(resp);
        }
    });
};
/**
 * search with paging
 * @param db_model
 * @param condition
 * @param paging
 * @param fields
 * @param sort
 * @param resp_func
 */
DBOperater.prototype.search_by_condition = function (db_model, condition, paging, fields, sort, resp_func) {
    db_model.find(condition).sort(sort).limit(paging.limit).skip(paging.skip).select(fields).exec(function (err, res) {
        // common.xlog('search_by_condition', err);
        if (err) {
            var resp = {
                result: Constant.FAILED_CODE,
                message: Constant.SERVER_ERR,
                name: err.name,
                kind: err.kind,
                path: err.path
            };
            resp_func(resp);
        } else {
            var resp = {
                result: Constant.OK_CODE,
                data: res,
                count: 0,              //fake value for user total
                skip: paging.skip
            };
            resp_func(resp);
        }
    });
};

/**
 * search with paging
 * @param db_model
 * @param condition
 * @param fields
 * @param resp_func
 */
DBOperater.prototype.search_one_by_condition = function (db_model, condition, fields, resp_func) {
    db_model.findOne(condition)
        .select(fields)
        .exec(function (err, res) {
            if (err) {
                // common.xlog('search_by_condition', err);
                var resp = {
                    result: Constant.FAILED_CODE,
                    message: Constant.SERVER_ERR
                };
                resp_func(resp);
            } else {
                var resp = {
                    result: Constant.OK_CODE,
                    data: res
                };
                resp_func(resp);
            }
        });
};

/**
 * search with paging
 * @param db_model
 * @param condition
 * @param fields
 * @param resp_func
 */
DBOperater.prototype.search_one_by_condition = function (db_model, condition, fields, resp_func, flag_object) {
    db_model.findOne(condition)
        .select(fields)
        .exec(function (err, res) {
            if (err) {
                // common.xlog('search_by_condition', err);
                var resp = {
                    result: Constant.FAILED_CODE,
                    message: Constant.SERVER_ERR
                };
                resp_func(resp, flag_object);
            } else {
                var resp = {
                    result: Constant.OK_CODE,
                    data: res
                };
                resp_func(resp, flag_object);
            }
        });
};
/**
 * search with very simple condition
 * @param db_model
 * @param condition
 * @param fields
 * @param resp_func
 */
DBOperater.prototype.simple_search_by_condition = function (db_model, condition, fields, resp_func) {
    db_model.find(condition).select(fields).exec(function (err, res) {
        if (err) {
            // common.xlog('simple_search_by_condition', err);
            var resp = {
                result: Constant.FAILED_CODE,
                message: Constant.SERVER_ERR,
                name: err.name,
                kind: err.kind,
                path: err.path
            };
            resp_func(resp);
        } else {
            var resp = {
                result: Constant.OK_CODE,
                data: res,
                count: 0              //fake value for user total
            };
            resp_func(resp);
        }
    });
};
/**
 * search very simple with extra injection keys
 * @param db_model
 * @param condition
 * @param fields
 * @param resp_func
 */
DBOperater.prototype.simple_search_by_condition_w_keys = function (db_model, condition, fields, inj_keys, resp_func) {
    db_model.find(condition).select(fields).exec(function (err, res) {
        if (err) {
            // common.xlog('simple_search_by_condition', err);
            var resp = {
                result: Constant.FAILED_CODE,
                message: Constant.SERVER_ERR,
                inj_keys: inj_keys
            };
            resp_func(resp);
        } else {
            var resp = {
                result: Constant.OK_CODE,
                data: res,
                inj_keys: inj_keys,
                count: 0              //fake value for user total
            };
            resp_func(resp);
        }
    });
};
/**
 * search all
 * @param db_model
 * @param condition
 * @param fields
 * @param sort
 * @param resp_func
 */
DBOperater.prototype.search_all_by_condition = function (db_model, condition, fields, sort, resp_func) {
    db_model.find(condition).select(fields).sort(sort).exec(function (err, res) {
        if (err) {
            // common.xlog('search_all_by_condition', err);
            var resp = {
                result: Constant.FAILED_CODE,
                message: Constant.SERVER_ERR
            };
            resp_func(resp);
        } else {
            var resp = {
                result: Constant.OK_CODE,
                data: res
            };
            resp_func(resp);
        }
    });
};
/**
 * Martin: count documents by condition
 * @param db_model
 * @param condition
 * @param resp_func
 */
DBOperater.prototype.count_by_condition = function (db_model, condition, resp_func) {
    db_model.count(condition, function (err, count) {
        if (err) {
            // common.xlog('count_by_condition', err);
            var resp = {
                result: Constant.FAILED_CODE,
                message: Constant.SERVER_ERR
            };
            resp_func(resp);
        } else {
            var resp = {
                result: Constant.OK_CODE,
                data: count
            };
            resp_func(resp);
        }
    });
};
//========== SPECIAL FUNCTIONS
/**
 * get my final message in collection Message
 * @param db_model
 * @param condition
 * @param fields
 * @param resp_func
 */
DBOperater.prototype.get_my_final_message = function (db_model, condition, fields, resp_func) {
    db_model.find(condition).select(fields).limit(1).skip(0).sort({update_time: -1})
        .populate({path: 'from_user_id', select: '_id name'})
        .exec(function (err, res) {
            if (err) {
                // common.xlog('simple_search_by_condition', err);
                var resp = {
                    result: Constant.FAILED_CODE,
                    message: Constant.SERVER_ERR
                };
                resp_func(resp);
            } else {
                var resp = {
                    result: Constant.OK_CODE,
                    data: res,
                    count: 0              //fake value for user total
                };
                resp_func(resp);
            }
        });
};
/*
 * get message thread
 */
DBOperater.prototype.get_my_message_thread = function (db_model, condition, fields, resp_func) {
    db_model.find(condition).select(fields)
        .populate({path: 'to_user_ids', select: '_id name email public_key cloud_avatar_id edit_detail'})
        .exec(function (err, res) {
            if (err) {
                // common.xlog('simple_search_by_condition', err);
                var resp = {
                    result: Constant.FAILED_CODE,
                    message: Constant.SERVER_ERR
                };
                resp_func(resp);
            } else {
                var resp = {
                    result: Constant.OK_CODE,
                    data: res,
                    count: 0              //fake value for user total
                };
                resp_func(resp);
            }
        });
};
//
DBOperater.prototype.get_my_message_thread_limit = function (db_model, condition, limit, fields, resp_func) {
    db_model.find(condition).select(fields)
        .limit(limit)
        .sort({_id : -1})
        .populate({path: 'to_user_ids', select: '_id name email public_key cloud_avatar_id edit_detail'})
        .exec(function (err, res) {
            if (err) {
                // common.xlog('simple_search_by_condition', err);
                var resp = {
                    result: Constant.FAILED_CODE,
                    message: Constant.SERVER_ERR
                };
                resp_func(resp);
            } else {
                var resp = {
                    result: Constant.OK_CODE,
                    data: res,
                    count: 0              //fake value for user total
                };
                resp_func(resp);
            }
        });
};
/**
 * called to get my unread messages
 * @param db_model
 * @param condition
 * @param select_list
 * @param resp_func
 */
DBOperater.prototype.getMyInvolvingMessages = function (db_model, condition, select_list, resp_func) {
    //do not need paging here
    db_model.find(condition).select(select_list).populate({path: 'last_mess_id'}).exec(function (err, data) {
        if (err) {
            var resp = {
                result: Constant.FAILED_CODE,
                message: Constant.SERVER_ERR
            };
            resp_func(resp);
        } else {
            var resp = {
                result: Constant.OK_CODE,
                data: data
            };
            resp_func(resp);
        }
    });
};
/**
 * delete documents permanently
 * @param condition
 * @param resp_func
 */
DBOperater.prototype.delete_permanently = function (db_model, condition, resp_func) {
    db_model.find(condition).remove().exec();
};
/**
 * search with paging & join with owner info (used in list posts, comments)
 * @param db_model
 * @param condition
 * @param paging
 * @param fields
 * @param sort
 * @param resp_func
 */
DBOperater.prototype.search_by_condition_join_owner = function (db_model, condition, paging, fields, sort, resp_func) {
    db_model.find(condition).limit(paging.limit).skip(paging.skip).select(fields).
            sort(sort).
            populate({path: 'user_id', select: '_id name email cloud_avatar_id edit_detail'}).exec(function (err, res) {
        if (err) {
            // common.xlog('search_by_condition', err);
            var resp = {
                result: Constant.FAILED_CODE,
                message: Constant.SERVER_ERR
            };
            resp_func(resp);
        } else {
            var resp = {
                result: Constant.OK_CODE,
                data: res,
                count: 0,              //fake value for user total
                skip: paging.skip
            };
            resp_func(resp);
        }
    });
};
/**
 * search with very simple condition join with SystemMember
 * @param db_model
 * @param condition
 * @param fields
 * @param resp_func
 */
DBOperater.prototype.simple_search_by_condition_join_mem = function (db_model, condition, fields, resp_func) {
    db_model.find(condition).select(fields).
    populate({path: 'user_id', select: '_id name android_tokens'}).
    exec(function (err, res) {
        if (err) {
            // common.xlog('simple_search_by_condition', err);
            var resp = {
                result: Constant.FAILED_CODE,
                message: Constant.SERVER_ERR
            };
            resp_func(resp);
        } else {
            var resp = {
                result: Constant.OK_CODE,
                data: res,
                count: 0              //fake value for user total
            };
            resp_func(resp);
        }
    });
};
/**
 * search with very simple condition join with Group
 * @param db_model
 * @param condition
 * @param fields
 * @param resp_func
 */
DBOperater.prototype.simple_search_by_condition_join_group = function (db_model, condition, fields, resp_func) {
    db_model.find(condition).select(fields).
    populate({path: 'group_id', select: '_id name'}).
    exec(function (err, res) {
        if (err) {
            // common.xlog('simple_search_by_condition', err);
            var resp = {
                result: Constant.FAILED_CODE,
                message: Constant.SERVER_ERR
            };
            resp_func(resp);
        } else {
            var resp = {
                result: Constant.OK_CODE,
                data: res,
                count: 0              //fake value for user total
            };
            resp_func(resp);
        }
    });
};
/**
 * search documents with distinct field
 * @param db_model
 * @param condition
 * @param fields
 * @param distinct_field
 * @param resp_func
 */
DBOperater.prototype.simple_search_by_condition_distinct_join = function (db_model, condition, fields, distinct_field, resp_func) {
    db_model.find(condition).select(fields).
    populate({path: 'user_id', select: '_id name android_tokens'}).
    exec(function (err, res) {
        if (err) {
            // common.xlog('simple_search_by_condition_distinct', err);
            var resp = {
                result: Constant.FAILED_CODE,
                message: Constant.SERVER_ERR
            };
            resp_func(resp);
        } else {
            var resp = {
                result: Constant.OK_CODE,
                data: res,
                count: 0              //fake value for user total
            };
            resp_func(resp);
        }
    });
};
//==========
module.exports = DBOperater;