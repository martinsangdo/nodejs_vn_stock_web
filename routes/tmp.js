var express = require('express');
var router = express.Router();
var MongoClient = require('mongodb').MongoClient;
var Common = require('../common/common.js');
var common = new Common();
var PushNotif = require('../common/push_notif.js');
var pushNotif = new PushNotif();
var Constant = require('../common/constant.js');
var DB_STRUCTURE = require('../models/system/DBStructure.js');
var DBOperater = require('../models/db_operator.js');
var dbOperator = new DBOperater();
var mongoose = require('mongoose');

/* GET users listing. */
router.get('/', function(req, res, next) {
    res.render('tmp_view', {data: new Date()});
});
/**
 * create new db & random collection
 */
router.post('/create_new_db', function(req, res, next) {
    if (req.body['new_db_name'] && req.body['new_db_collection']){
        MongoClient.connect('mongodb://localhost:27017/'+req.body['new_db_name'], function(err, db) {
            var collection = db.collection(req.body['new_db_collection']);
            collection.insert([{a:1, b:1}], {w:1}, function(err, result) {
                res.send(JSON.stringify({message : 'Created database: ' + req.body['new_db_name']}));
            });
        });
    }
});

/**
 * test connecting db system
 */
router.post('/test_connect_db', function(req, res, next) {
    var system_db_name = req.headers[Constant.HEADER_PARAM.DB_NAME];
    if (common.isEmpty(system_db_name)){
        res.rest.badRequest({message: Constant.SYSTEM_ADDRESS_NOT_FOUND});
    }

    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.LastMessage, 'LastMessage', res);
    if (resp_conn.result == Constant.FAILED_CODE){
        res.rest.badRequest({
            message: resp_conn.message
        });
    } else {
        res.rest.success({result: 'ok'});
        // dbOperator.upsert(resp_conn.db_model, {rand_str: 'not_existed'}, {rand_str:new Date(), last_modified_time:new Date()}, function (resp_update){
        //     res.rest.success(resp_update);
        // });
    }
});

router.post('/test_connect_db_2', function(req, res, next) {
    var system_db_name = req.headers[Constant.HEADER_PARAM.DB_NAME];
    if (common.isEmpty(system_db_name)){
        res.rest.badRequest({message: Constant.SYSTEM_ADDRESS_NOT_FOUND});
    }

    var resp_conn = common.getSystemModel(req, DB_STRUCTURE.Message, 'Message', res);
    if (resp_conn.result == Constant.FAILED_CODE){
        res.rest.badRequest({
            message: resp_conn.message
        });
    } else {
        res.rest.success({result: 'ok'});
        // dbOperator.upsert(resp_conn.db_model, {rand_str: 'not_existed'}, {rand_str:new Date(), last_modified_time:new Date()}, function (resp_update){
        //     res.rest.success(resp_update);
        // });
    }
});
/**
 * chat client to connect socket
 */
router.get('/chat_client', function(req, res, next) {
    res.render('chat_client', {});
});
/**
 * test send push notification
 */
router.post('/send_push_message', function(req, res, next) {
    if (req.body['token'] && req.body['content']){
        pushNotif.send_push_new_message([req.body['token']], {jid: 'xxx'}, req.body['content']);
    }
    res.rest.success();
});
//
router.post('/test_connect_server', function(req, res, next) {
    res.rest.success();
});

module.exports = router;
