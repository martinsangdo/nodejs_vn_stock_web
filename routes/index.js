var express = require('express');
var router = express.Router();
var fb_export = require("firebase");
var config = require('../config/setting')();
fb_export.initializeApp(config.crypto_db);
var Account = require('../models/Account.js');
var Constant = require('../common/constant.js');
var Address = require('../models/Address.js');
var ForgotPass = require('../models/ForgotPass.js');
var User = require('../models/User.js');

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
    backup_address();
    backup_forgot_pass();
    backup_user();

    res.render('export_db', { json: JSON.stringify([]) });
});

function backup_account(){
    try {
        var collection = fb_export.firestore().collection("account");
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


function backup_address(){
    try {
        var collection = fb_export.firestore().collection("address");
        var address = new Address();
        collection.get().then(snapshot => {
            snapshot.forEach(doc => {
                var data = doc.data();
                var id = doc.id;
                address.findOne({document_id: id}, function (resp_detail) {
                    if (resp_detail.result == Constant.OK_CODE && resp_detail.data != null && resp_detail.data['document_id'] == id){
                        //update
                        address.update({document_id: id}, data, function () { });
                    } else {
                        //create new
                        data['document_id'] = id;
                        address.create(data, function () { });
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


function backup_forgot_pass(){
    try {
        var collection = fb_export.firestore().collection("forgot_pass");
        var forgot_pass = new ForgotPass();
        collection.get().then(snapshot => {
            snapshot.forEach(doc => {
                var data = doc.data();
                var id = doc.id;
                forgot_pass.findOne({document_id: id}, function (resp_detail) {
                    if (resp_detail.result == Constant.OK_CODE && resp_detail.data != null && resp_detail.data['document_id'] == id){
                        //update
                        forgot_pass.update({document_id: id}, data, function () { });
                    } else {
                        //create new
                        data['document_id'] = id;
                        forgot_pass.create(data, function () { });
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


function backup_user(){
    try {
        var collection = fb_export.firestore().collection("user");
        var user = new User();
        collection.get().then(snapshot => {
            snapshot.forEach(doc => {
                var data = doc.data();
                var id = doc.id;
                user.findOne({document_id: id}, function (resp_detail) {
                    if (resp_detail.result == Constant.OK_CODE && resp_detail.data != null && resp_detail.data['document_id'] == id){
                        //update
                        user.update({document_id: id}, data, function () { });
                    } else {
                        //create new
                        data['document_id'] = id;
                        user.create(data, function () { });
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

module.exports = router;
