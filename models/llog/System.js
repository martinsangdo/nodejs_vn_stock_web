/**
 * author: Martin
 * save basic info of all systems in LLOG
 */
//grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Constant = require('../../common/constant.js');

//define format of Collection
var SystemSchema = new Schema({
    name            :   {type: String, trim: true},
    plain_name      :   {type: String, trim: true},     //used in search, lowercase
	about   		: 	String,
    cloud_avatar_id :   {org_size: String, thumb_size: String},     //id of avatar in Google Drive
    db_server_link  :   String,     //Database URL of this system, it may differ from DB of L-LOG. Used to connect system DB. For ex: "http://145.33.55.205:3001"
    db_id_name      :   String,
    db_username         :   String,
    db_password         :   String,
    member_list_visibility  :   {type :Boolean, default:true},
    profile_visibility  :   {type :Boolean, default:true},      //this system can be search by name
    member_num  :   {type :Number, default:0},
    user_id     :   {type: Schema.Types.ObjectId, ref :'User'},
    app_code    :   String,
    cloud_id :   String,        //folder drive id of SYS_xxx
    join_type   :   String, //fake field for searching
    create_time   :   { type: Date, default: Date.now },        //auto created when new document is inserted
    update_time   :   { type: Date, default: Date.now }
}, { collection: 'System' });

//the schema is useless so far
//we need to create a model using it
var System = mongoose.model('System', SystemSchema);
/**
 * create new document
 * @param new_doc
 * @param resp_func
 */
System.prototype.create = function(new_doc, resp_func){
    var me = new System(new_doc);
    me.save(function(err, result){
        if(err) {
            var resp = {
                result : Constant.FAILED_CODE,
                message: Constant.SERVER_ERR,
                err: err
            };
            resp_func(resp);
        }else{
            var resp = {
                result : Constant.OK_CODE,
                _id: result._id
            };
            resp_func(resp);
        }
    });
};
/**
 * search systems
 * @param condition
 * @param paging
 * @param fields
 * @param sort
 * @param resp_func
 */
System.prototype.search_by_condition = function(condition, paging, fields, sort, resp_func){
    System.find(condition).limit(paging.limit).skip(paging.skip).select(fields).
        sort(sort).exec(function(err, res) {
        if (err) {
            var resp = {
                result : Constant.FAILED_CODE,
                message : Constant.SERVER_ERR,
                name: err.name,
                kind: err.kind
            };
            resp_func(resp);
        } else {
            var resp = {
                result : Constant.OK_CODE,
                data : res,
                count : 0,              //fake value for user total
                skip : paging.skip
            };
            resp_func(resp);
        }
    });
};
/**
 * find and modify documents
 * @param condition
 * @param update
 * @param resp_func
 */
System.prototype.update = function(existed_condition, update_data, resp_func){
    var options = { upsert: false };        //not allow to insert new
    System.update(existed_condition, update_data, options, function(err, numAffected){
        // numAffected is the number of updated documents
        if(err) {
            var resp = {
                result : Constant.FAILED_CODE,
                message: Constant.SERVER_ERR,
                err: err
            };
            resp_func(resp);
        }else{
            var resp = {
                result : Constant.OK_CODE
            };
            resp_func(resp);
        }
    });
};
/**
 * search system owner info
 * @param condition
 * @param resp_func
 */
System.prototype.search_system_owner_info = function(condition, resp_func){
    System.find(condition).populate({path: 'user_id'}).exec(function(err, res) {
        if (err) {
            var resp = {
                result : Constant.FAILED_CODE,
                message : Constant.SERVER_ERR
            };
            resp_func(resp);
        } else {
            var resp = {
                result : Constant.OK_CODE,
                data : res
            };
            resp_func(resp);
        }
    });
};
/**
 * search very simple with extra injection keys
 * @param condition
 * @param fields
 * @param resp_func
 */
System.prototype.simple_search_by_condition_w_keys = function (condition, fields, inj_keys, resp_func) {
    System.find(condition).select(fields).exec(function (err, res) {
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
 * delete documents permanently
 * @param condition
 * @param resp_func
 */
System.prototype.delete_permanently = function(condition, resp_func){
    System.find(condition).remove().exec();
};
//make this available to our users in our Node applications
module.exports = System;

