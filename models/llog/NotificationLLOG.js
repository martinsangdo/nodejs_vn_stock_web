/**
 * author: Martin
 * save notifications of all users in LLOG involving to systems & friends
 */
//grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Constant = require('../../common/constant.js');

//define format of Collection
var NotificationLLOGSchema = new Schema({
    description     :   String,
    to_user_ids     :   [{type: Schema.Types.ObjectId, ref :'User'}],
    type            :   {type: String, enum: ['none', 'request_join', 'accepted', 'rejected', 'invite_join', 'accept_invite', 'add_co_admin', 'co_admin_left', 'request_friend', 'accept_friend', 'ignore_friend'] , default: 'none'},
    from_user_id    :   {type: Schema.Types.ObjectId, ref :'User'},
    system_id       :   {type: Schema.Types.ObjectId, ref :'System'},
    create_time     :   { type: Date, default: Date.now },
    update_time     :   { type: Date, default: Date.now }
}, { collection: 'NotificationLLOG' });

//the schema is useless so far
//we need to create a model using it
var NotificationLLOG = mongoose.model('NotificationLLOG', NotificationLLOGSchema);
//
NotificationLLOG.prototype.create = function(new_doc, resp_func){
    var me = new NotificationLLOG(new_doc);
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
 * @param condition
 * @param paging
 * @param fields
 * @param sort
 * @param resp_func
 */
NotificationLLOG.prototype.search_by_condition = function(condition, paging, fields, sort, resp_func){
    NotificationLLOG.find(condition).limit(paging.limit).skip(paging.skip).select(fields).sort(sort).exec(function(err, res) {
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
 * find and modify documents
 * @param condition
 * @param update
 * @param resp_func
 */
NotificationLLOG.prototype.update = function(existed_condition, update_data, resp_func){
    var options = { upsert: false };        //not allow to insert new
    NotificationLLOG.update(existed_condition, update_data, options, function(err, docs){
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
                result : Constant.OK_CODE,
                data: docs
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
NotificationLLOG.prototype.delete_permanently = function(condition, resp_func){
    NotificationLLOG.find(condition).remove().exec();
};
//make this available to our users in our Node applications
module.exports = NotificationLLOG;

