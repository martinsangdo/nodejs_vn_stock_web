/**
 * author: Martin
 * save basic info of all users in LLOG
 */
//grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Constant = require('../../common/constant.js');

//define format of Collection
var UserSchema = new Schema({
    name            :   {type: String, trim: true},
	email   		: 	{type: String, trim: true},
    plain_name      :   {type: String, trim: true},     //used in search, lowercase
    security_code   : 	{type: String, trim: true},     //encrypted by a predefined password of LLOG, to prevent someone else steal DB
    cloud_avatar_id :   {org_size: String, thumb_size: String},     //id of avatar in Google Drive
    android_tokens  :   [{type: String, trim: true}],   //android tokens of phones which user is using, use this token to send push notification
    profile_visibility  :   {type :Boolean, default:true},      //this user can be search by name by another user or not
    friend_list_visibility  :   {type: String, enum: ['public', 'friend', 'private'] , default: 'public'}, //this user allows others to see his friend list or not
    group_list_visibility   :   {type: String, enum: ['public', 'friend', 'private'] , default: 'public'}, //this user allows others to see his group list or not
    public_key      :   {type: String, trim: true},
    edit_detail     :   {name: Date, avatar: Date},     //time of changed specific info
    register_time   :   { type: Date, default: Date.now },     //the time when user joins into LLOG server
    update_time   :   { type: Date, default: Date.now }
}, { collection: 'User' });

//the schema is useless so far
//we need to create a model using it
var User = mongoose.model('User', UserSchema);

/**
 * insert new document (if not existed) or update it
 * @param existed_condition: to check whether document existed or not
 * @param update_data: batch data need to insert or update
 * @param resp_func: callback of response
 */
User.prototype.create = function(user_data, resp_func){
    var user = new User(user_data);
    user.save(function(err, result){
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
                user_id: result._id
            };
            resp_func(resp);
        }
    });
};
/**
 * insert new document (if not existed) or update it
 * @param existed_condition: to check whether document existed or not
 * @param update_data: batch data need to insert or update
 * @param resp_func: callback of response
 */
User.prototype.update = function(existed_condition, update_data, resp_func){
    var options = { upsert: false };
    User.update(existed_condition, update_data, options, function(err, numAffected){
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
 * search users
 * @param condition
 * @param paging
 * @param fields
 * @param sort
 * @param resp_func
 */
User.prototype.search_by_condition = function(condition, paging, fields, sort, resp_func){
    User.find(condition).limit(paging.limit).skip(paging.skip).select(fields).sort(sort).exec(function(err, res) {
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
//
User.prototype.search_no_paging = function(condition, fields, sort, resp_func){
    User.find(condition).select(fields).sort(sort).exec(function(err, res) {
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
                count : 0              //fake value for user total
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
User.prototype.simple_search_by_condition_w_keys = function (condition, fields, inj_keys, resp_func) {
    User.find(condition).select(fields).exec(function (err, res) {
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
//
User.prototype.delete_permanently = function(condition, resp_func) {
    User.find(condition).remove().exec();
};

//make this available to our users in our Node applications
module.exports = User;

