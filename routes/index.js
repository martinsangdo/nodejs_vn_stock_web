var express = require('express');
var router = express.Router();
var fb_export = require("firebase");
var config = require('../config/setting')();
fb_export.initializeApp(config.crypto_db);
var Account = require('../models/Account.js');
var Constant = require('../common/constant.js');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

/* GET home page. */
router.get('/crypto-db-backup', function(req, res, next) {
  var results = [];
  try {
    var collection = fb_export.firestore().collection(req.query["collection_name"]);

     collection.get().then(snapshot => {
        snapshot.forEach(doc => {
           results.push(doc.data());
        });
        res.render('export_db', { json: JSON.stringify(results) });
     }).catch(err => {
        console.log('Error: ', JSON.stringify(err));
        res.render('export_db', { json: JSON.stringify(err) });
     });
  } catch(err){
    console.log('Error: ', err);
    res.render('export_db', { json: JSON.stringify(err) });
  }
});

/* GET home page. */
router.get('/crypto-db-backup-db', function(req, res, next) {
    backup_account();

    res.render('export_db', { json: JSON.stringify([]) });
});

function backup_account(){
    var collection_name = "account";
    try {
        var collection = fb_export.firestore().collection(collection_name);
        var account = new Account();
        collection.get().then(snapshot => {
            snapshot.forEach(doc => {
                var data = doc.data();
                var id = doc.id;
                account.findOne({document_id: id}, function (resp_detail) {
                    if (resp_detail.result == Constant.OK_CODE && resp_detail.data != null && resp_detail.data['document_id'] == id){
                        //update
                        account.update({document_id: id}, data, function () { });
                    } else {
                        //create new
                        data['document_id'] = id;
                        account.create(data, function () { });
                    }
                });
            });
        }).catch(err => {
            console.log('Error: ', JSON.stringify(err));
        });
    } catch(err){
        console.log('Error: ', err);
    }
}

function upsert_address(id, data){
    var account = new Account();
    account.findOne({document_id: id}, function (resp_detail) {
        if (resp_detail.result == Constant.OK_CODE && resp_detail.data != null && resp_detail.data['document_id'] == id){
            //update
            account.update({document_id: id}, data, function () { });
        } else {
            //create new
            data['document_id'] = id;
            account.create(data, function () { });
        }
    });
}

function upsert_forgot_pass(id, data){
    var account = new Account();
    account.findOne({document_id: id}, function (resp_detail) {
        if (resp_detail.result == Constant.OK_CODE && resp_detail.data != null && resp_detail.data['document_id'] == id){
            //update
            account.update({document_id: id}, data, function () { });
        } else {
            //create new
            data['document_id'] = id;
            account.create(data, function () { });
        }
    });
}

function upsert_user(id, data){
    var account = new Account();
    account.findOne({document_id: id}, function (resp_detail) {
        if (resp_detail.result == Constant.OK_CODE && resp_detail.data != null && resp_detail.data['document_id'] == id){
            //update
            account.update({document_id: id}, data, function () { });
        } else {
            //create new
            data['document_id'] = id;
            account.create(data, function () { });
        }
    });
}

module.exports = router;
