var express = require('express');
var router = express.Router();
var fb_export = require("firebase");
var config = require('../config/setting')();
fb_export.initializeApp(config.crypto_db);

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

module.exports = router;
