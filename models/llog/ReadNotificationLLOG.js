/**
 * author: Martin
 */
//grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Constant = require('../../common/constant.js');

//Last chat message between 1 user
var ReadNotificationLLOGSchema = new Schema({
	notification_id   		: 	{type: Schema.Types.ObjectId, ref :'NotificationLLOG'},
    to_user_id     :   {type: Schema.Types.ObjectId, ref :'User'},
    read:    { type: Boolean, default: false },
    update_time  :   { type: Date, default: Date.now }
}, { collection: 'ReadNotificationLLOG' });

//the schema is useless so far
//we need to create a model using it
var ReadNotificationLLOG = mongoose.model('ReadNotificationLLOG', ReadNotificationLLOGSchema);
/**
 * insert or update 1 record based on condition
 * @param condition
 * @param data
 * @param resp_func
 */
ReadNotificationLLOG.prototype.upsert = function(condition, data, resp_func){
    var options = { upsert: true };     //insert if not existed
    ReadNotificationLLOG.update(condition, data, options, function (err, numAffected, docs) {
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
 *
 * @param existed_condition
 * @param update_data
 * @param resp_func
 */
ReadNotificationLLOG.prototype.update = function(existed_condition, update_data, resp_func){
    var options = { upsert: false };
    ReadNotificationLLOG.update(existed_condition, update_data, options, function(err, numAffected){
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
 * get unread notification involving to me
 * @param condition
 * @param select_list
 * @param resp_func
 */
ReadNotificationLLOG.prototype.getMyInvolvingNotif = function(condition, select_list, resp_func){
    //do not need paging here
    ReadNotificationLLOG.find(condition).select(select_list).
        populate({
                path: 'notification_id',
                select: '_id from_user_id description type system_id',
                populate: {
                    path: 'system_id',
                    select: 'db_server_link db_id_name db_username db_password',
                    model: 'System'
                }
            }).sort({update_time: 1}).exec(function(err, data){
		if(err){
			var resp = {
					result : Constant.FAILED_CODE,
					message: Constant.SERVER_ERR
				};
			resp_func(resp);
		} else {
			var resp = {
					result : Constant.OK_CODE,
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
ReadNotificationLLOG.prototype.delete_permanently = function(condition, resp_func){
    ReadNotificationLLOG.find(condition).remove().exec();
};
//make this available to our users in our Node applications
module.exports = ReadNotificationLLOG;

