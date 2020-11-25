/**
 * author: Martin
 * user detail
 */
//grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Constant = require('../common/constant.js');

//define format of Collection
var AccountSchema = new Schema({
    document_id            :   {type: String, trim: true},  //unique to login
    code            :   {type: String, trim: true},
    coinbase_id           :   {type: String, trim: true},
    is_active          :   {type: Boolean},
    name        :   {type: String, trim: true},
    network: {type: String},
    primary: {type: Boolean},
    type: {type: String}
}, { collection: 'account' });

//the schema is useless so far
//we need to create a model using it
var Account = mongoose.model('Account', AccountSchema);

//
Account.prototype.findOne = function(condition, resp_func){
    Account.findOne(condition).exec(function(err, res) {
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
                data : res
            };
            resp_func(resp);
        }
    });
};
//create new document
Account.prototype.create = function(data, resp_func){
    var document = new Account(data);
    document.save(function(err, result){
        if(err) {
            var resp = {
                result : Constant.FAILED_CODE,
                message: Constant.SERVER_ERR,
                err: err
            };
            resp_func(resp);
        }else{
            var resp = { result : Constant.OK_CODE, _id: result['_id'] };
            resp_func(resp);
        }
    });
};
//
Account.prototype.update = function(existed_condition, update_data, resp_func){
    var options = { upsert: false };
    Account.updateMany(existed_condition, update_data, options, function(err, numAffected){
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
module.exports = Account;
