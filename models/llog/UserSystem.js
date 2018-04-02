/**
 * author: Martin
 * relationship between users & system
 */
//grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Constant = require('../../common/constant.js');

//define format of Collection
var UserSystemSchema = new Schema({
    join_type       :   {type: String, enum: ['none', 'accepted', 'request_join', 'rejected', 'removed', 'inviting', 'blocked', 'remove_blocked'] , default: 'none'}, //none: he is owner of the System
    user_id         :   {type: Schema.Types.ObjectId, ref :'User'},
    system_id       :   {type: Schema.Types.ObjectId, ref :'System'},
    create_time     :   { type: Date, default: Date.now },
    update_time     :   { type: Date, default: Date.now }
}, { collection: 'UserSystem' });

//the schema is useless so far
//we need to create a model using it
var UserSystem = mongoose.model('UserSystem', UserSystemSchema);

/**
 * create new document
 * @param new_doc
 * @param resp_func
 */
UserSystem.prototype.create = function(new_doc, resp_func){
    var me = new UserSystem(new_doc);
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
 * update document
 * @param existed_condition
 * @param update_data
 * @param resp_func
 */
UserSystem.prototype.update = function(existed_condition, update_data, resp_func){
    var options = { upsert: false };        //not allow to insert new
    UserSystem.update(existed_condition, update_data, options, function(err, numAffected){
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
 *
 * @param condition
 * @param data
 * @param resp_func
 */
UserSystem.prototype.upsert = function(condition, data, resp_func){
    var options = { upsert: true };     //insert if not existed
    UserSystem.update(condition, data, options, function (err, numAffected, docs) {
        // numAffected is the number of updated documents
        if(err) {
            var resp = {
                result : Constant.FAILED_CODE,
                message: err
            };
            resp_func(resp);
        } else {
            var resp = {
                result : 	Constant.OK_CODE,
                data :		numAffected
            };
            resp_func(resp);
        }
    });
};
/**
 * general searching
 * @param condition
 * @param paging
 * @param fields
 * @param sort
 * @param resp_func
 */
UserSystem.prototype.search_by_condition = function(condition, paging, fields, sort, resp_func){
    UserSystem.find(condition).limit(paging.limit).skip(paging.skip).select(fields).sort(sort).exec(function(err, res) {
        if (err) {
            var resp = {
                result : Constant.FAILED_CODE,
                message : Constant.SERVER_ERR
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
 * search all, take care with populate
 * @param condition
 * @param paging
 * @param fields
 * @param sort
 * @param resp_func
 */
UserSystem.prototype.search_no_paging = function(condition, fields, sort, resp_func){
    UserSystem.find(condition).select(fields).sort(sort).populate({path: 'system_id'}).exec(function(err, res) {
        if (err) {
            var resp = {
                result : Constant.FAILED_CODE,
                message : Constant.SERVER_ERR,
                name: err.name,
                kind: err.kind,
                path: err.path
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
 * search systems which I created or joined
 * @param condition
 * @param paging
 * @param fields
 * @param sort
 * @param resp_func
 */
UserSystem.prototype.search_my_joined_systems = function(condition, fields, sort, resp_func){
    UserSystem.find(condition).select(fields).sort(sort).populate({path: 'system_id'}).exec(function(err, res) {
        if (err) {
            var resp = {
                result : Constant.FAILED_CODE,
                message : Constant.SERVER_ERR
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
 * delete documents permanently
 * @param condition
 * @param resp_func
 */
UserSystem.prototype.delete_permanently = function(condition, resp_func){
    UserSystem.find(condition).remove().exec();
};
//make this available to our users in our Node applications
module.exports = UserSystem;

