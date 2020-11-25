/**
 * author: Martin
 */
//grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Constant = require('../common/constant.js');

//define format of Collection
var ForgotPassSchema = new Schema({
    document_id            :   {type: String, trim: true},  //unique to login
    email            :   {type: String, trim: true},
    create_time           :   {type: String, trim: true}
}, { collection: 'forgot_pass' });

//the schema is useless so far
//we need to create a model using it
var ForgotPass = mongoose.model('ForgotPass', ForgotPassSchema);

//
ForgotPass.prototype.findOne = function(condition, resp_func){
    ForgotPass.findOne(condition).exec(function(err, res) {
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
ForgotPass.prototype.create = function(data, resp_func){
    var document = new ForgotPass(data);
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
ForgotPass.prototype.update = function(existed_condition, update_data, resp_func){
    var options = { upsert: false };
    ForgotPass.updateMany(existed_condition, update_data, options, function(err, numAffected){
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
module.exports = ForgotPass;
