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
var CryptoJS = require('crypto-js');
var request = require('request');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'hi' });
});

/* GET home page. */
router.get('/get_transactions', function(req, res, next) {
    var headers = get_coinbase_header("GET" , "/v2/accounts/91735a18-d8ef-5c40-bb4f-8ce64acf8bba");
    headers['X-CMC_PRO_API_KEY'] = '0zGLoccZQkdc8ViE';
    headers['CB-ACCESS-KEY'] = '0zGLoccZQkdc8ViE';
    headers['CB-VERSION'] = '2018-06-02';
    const options = {
        hostname: 'https://api.coinbase.com',
        port: 443,
        path: '/v2/accounts/91735a18-d8ef-5c40-bb4f-8ce64acf8bba',
        method: 'GET',
        headers: headers
    };
    // console.log(options);

    request({
        headers: headers,
        uri: 'https://api.coinbase.com/v2/accounts/91735a18-d8ef-5c40-bb4f-8ce64acf8bba',
        method: 'GET'
    }, function (err, response, body) {
        //it works!
        // console.log(body);
        res.json(JSON.parse(body));
    });


});

function get_coinbase_header(method, uri){
    //https://github.com/brix/crypto-js
    var timestamp = Math.floor(Date.now() / 1000);
    var message = timestamp + method + uri;
    var rawHmac = CryptoJS.HmacSHA256(message, "xOzMvwhjmhVxq9UAdhCnMq29vUsf8FvC").toString();
    var extra_headers = {
        'CB-ACCESS-SIGN': rawHmac,
        'CB-ACCESS-TIMESTAMP': timestamp
    };
    return extra_headers;
}

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
